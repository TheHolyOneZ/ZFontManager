mod activation;
mod adobe;
mod affinity;
mod font_types;
mod installer;
mod parser;
mod registry;
mod scanner;
mod sound;
mod store;
mod watcher;

use font_types::{FontFace, FontSource, TrashEntry};
use std::collections::HashMap;
use store::Store;
use tauri::{Manager, State};

#[tauri::command]
async fn scan_fonts(app: tauri::AppHandle) -> Result<Vec<FontFace>, String> {
    let (extra, library_dir, linked) = {
        let store: State<Store> = app.state();
        let state = store.0.lock().map_err(|e| e.to_string())?;
        (
            state.extra_dirs.clone(),
            state.active_library_dir().map(|s| s.to_owned()),
            state.linked.clone(),
        )
    };
    let managed = scanner::effective_managed_dir(library_dir.as_deref());
    let mut faces = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || scanner::scan_all(&app, &extra, &managed)
    })
    .await
    .map_err(|e| e.to_string())?;

    // Linked fonts live outside the scanned dirs: parse them in place.
    // A linked file keeps its library (managed) identity over a scanned hit.
    let mut linked_faces = Vec::new();
    for path in &linked {
        let p = std::path::Path::new(path);
        if !p.is_file() {
            continue;
        }
        linked_faces.extend(parser::parse_font_file(p, FontSource::Managed));
    }
    if !linked_faces.is_empty() {
        let ids: std::collections::HashSet<&str> =
            linked_faces.iter().map(|f| f.id.as_str()).collect();
        faces.retain(|f| !ids.contains(f.id.as_str()));
        faces.extend(linked_faces);
    }

    let probe = activation::probe();
    let store: State<Store> = app.state();
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    // Drop links whose file is gone.
    let before = state.linked.len();
    state.linked.retain(|p| std::path::Path::new(p).is_file());
    if state.linked.len() != before {
        let _ = store::save(&state);
    }
    let mut faces: Vec<FontFace> = faces
        .into_iter()
        .map(|mut f| {
            f.active = activation::is_active(&probe, &state, &f);
            f
        })
        .collect();

    for (orig, parked) in &state.parked {
        for mut f in parser::parse_font_file(std::path::Path::new(parked), FontSource::User) {
            f.id = format!("{}#{}", orig, f.face_index);
            f.path = orig.clone();
            f.preview_path = Some(parked.clone());
            f.active = false;
            faces.push(f);
        }
    }
    Ok(faces)
}

#[tauri::command]
fn set_font_active(store: State<Store>, path: String, active: bool) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    activation::sync(&mut state, &path, active)?;
    store::save(&state)
}

#[tauri::command]
fn set_fonts_active(store: State<Store>, paths: Vec<String>, active: bool) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;

    let mut first_err = None;
    for path in &paths {
        if let Err(e) = activation::sync(&mut state, path, active) {
            first_err.get_or_insert(e);
        }
    }
    store::save(&state)?;
    first_err.map_or(Ok(()), Err)
}

#[tauri::command]
async fn install_fonts(
    app: tauri::AppHandle,
    store: State<'_, Store>,
    paths: Vec<String>,
    existing: Vec<String>,
    mode: String,
) -> Result<installer::InstallResult, String> {
    let mode = installer::InstallMode::parse(&mode)?;
    let library_dir = {
        let state = store.0.lock().map_err(|e| e.to_string())?;
        state.active_library_dir().map(|s| s.to_owned())
    };
    let library = scanner::effective_managed_dir(library_dir.as_deref());
    let known: std::collections::HashSet<String> = existing.into_iter().collect();
    let scope_app = app.clone();
    let mut result =
        tauri::async_runtime::spawn_blocking(move || installer::install(&app, paths, &known, mode, &library))
            .await
            .map_err(|e| e.to_string())?;
    // New fonts start deactivated on every OS: run them through the regular
    // deactivate path so a later toggle can bring them back.
    // The Settings toggle can opt back into auto-activation for small batches.
    let mut auto = false;
    if let Ok(mut state) = store.0.lock() {
        if mode == installer::InstallMode::Link {
            for face in &result.installed {
                state.linked.insert(face.path.clone());
            }
        }
        auto = state.auto_activate_imports && result.installed.len() < 64;
        for face in &result.installed {
            let _ = activation::sync(&mut state, &face.path, auto);
        }
        let _ = store::save(&state);
    }
    // Previews load through the asset protocol: allow the folders new files live in.
    for face in &result.installed {
        let p = std::path::Path::new(&face.path);
        if let Some(parent) = p.parent() {
            allow_dir(&scope_app, parent);
        }
    }
    // Report the state activation::sync just put these fonts in. Faces come out
    // of the parser active by default, so this has to be set either way.
    for face in &mut result.installed {
        face.active = auto;
    }
    Ok(result)
}

#[tauri::command]
fn uninstall_font(store: State<Store>, path: String, family: String) -> Result<TrashEntry, String> {

    {
        let mut state = store.0.lock().map_err(|e| e.to_string())?;
        if state.deactivated.contains(&path) {
            activation::sync(&mut state, &path, true)?;
            store::save(&state)?;
        }
        if state.linked.contains(&path) {
            // Linked file: never touch the original, only unregister.
            let entry = installer::unlink(&path, &family)?;
            state.linked.remove(&path);
            store::save(&state)?;
            return Ok(entry);
        }
    }
    installer::uninstall(&path, &family)
}

#[tauri::command]
fn list_trash() -> Vec<TrashEntry> {
    installer::list_trash()
}

#[tauri::command]
async fn affinity_connection() -> Result<affinity::AffinityConnection, String> {
    Ok(affinity::connection().await)
}

#[tauri::command]
fn affinity_session_activate(
    store: State<Store>,
    paths: Vec<String>,
) -> Result<Vec<String>, String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    let mut first_err = None;
    let mut activated = Vec::with_capacity(paths.len());
    for path in paths {
        match activation::sync(&mut state, &path, true) {
            Ok(()) => activated.push(path),
            Err(e) => {
                first_err.get_or_insert(e);
            }
        }
    }
    store::save(&state)?;
    affinity::note_activated(activated.clone());
    first_err.map_or(Ok(activated), Err)
}

#[tauri::command]
fn restore_from_trash(store: State<Store>, entry_id: String) -> Result<(), String> {
    match installer::restore(&entry_id)? {
        installer::RestoreOutcome::Moved => Ok(()),
        installer::RestoreOutcome::Relinked(path) => {
            let mut state = store.0.lock().map_err(|e| e.to_string())?;
            state.linked.insert(path);
            store::save(&state)
        }
    }
}

#[tauri::command]
fn delete_trash_entry(entry_id: String) -> Result<(), String> {
    installer::delete_trash_entry(&entry_id)
}

#[tauri::command]
fn empty_trash() -> Result<(), String> {
    installer::empty_trash()
}

#[tauri::command]
fn get_tags(store: State<Store>) -> Result<HashMap<String, Vec<String>>, String> {
    let state = store.0.lock().map_err(|e| e.to_string())?;
    Ok(state.tags.clone())
}

#[tauri::command]
fn set_tags(store: State<Store>, family: String, tags: Vec<String>) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    if tags.is_empty() {
        state.tags.remove(&family);
    } else {
        state.tags.insert(family, tags);
    }
    store::save(&state)
}

#[tauri::command]
fn get_collections(store: State<Store>) -> Result<HashMap<String, Vec<String>>, String> {
    let state = store.0.lock().map_err(|e| e.to_string())?;
    Ok(state.collections.clone())
}

#[tauri::command]
fn set_collection(store: State<Store>, name: String, families: Vec<String>) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    state.collections.insert(name, families);
    store::save(&state)
}

#[tauri::command]
fn delete_collection(store: State<Store>, name: String) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    state.collections.remove(&name);
    store::save(&state)
}

#[tauri::command]
fn rename_collection(store: State<Store>, from: String, to: String) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    if state.collections.contains_key(&to) {
        return Err(format!("a collection named \"{to}\" already exists"));
    }
    let families = state
        .collections
        .remove(&from)
        .ok_or_else(|| format!("collection \"{from}\" not found"))?;
    state.collections.insert(to, families);
    store::save(&state)
}

#[tauri::command]
fn play_sound(kind: String, level: String) {
    sound::play(&kind, &level);
}

#[tauri::command]
fn get_notes(store: State<Store>) -> Result<HashMap<String, String>, String> {
    let state = store.0.lock().map_err(|e| e.to_string())?;
    Ok(state.notes.clone())
}

#[tauri::command]
fn set_note(store: State<Store>, family: String, note: String) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    if note.trim().is_empty() {
        state.notes.remove(&family);
    } else {
        state.notes.insert(family, note);
    }
    store::save(&state)
}

#[tauri::command]
fn get_favorites(store: State<Store>) -> Result<Vec<String>, String> {
    let state = store.0.lock().map_err(|e| e.to_string())?;
    Ok(state.favorites.iter().cloned().collect())
}

#[tauri::command]
fn set_favorite(store: State<Store>, family: String, favorite: bool) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    if favorite {
        state.favorites.insert(family);
    } else {
        state.favorites.remove(&family);
    }
    store::save(&state)
}

#[tauri::command]
fn get_charset(path: String, face_index: u32) -> Result<Vec<u32>, String> {
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    let face = ttf_parser::Face::parse(&data, face_index).map_err(|e| e.to_string())?;
    let mut cps: Vec<u32> = Vec::new();
    if let Some(cmap) = face.tables().cmap {
        for sub in cmap.subtables {
            if !sub.is_unicode() {
                continue;
            }
            sub.codepoints(|cp| {

                if cp > 0x20 && cp != 0x7f {
                    cps.push(cp);
                }
            });
        }
    }
    cps.sort_unstable();
    cps.dedup();
    cps.truncate(4096);
    Ok(cps)
}

#[tauri::command]
fn export_font(src: String, dest: String) -> Result<(), String> {
    std::fs::copy(&src, &dest).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 8 * 1024 * 1024 {
        return Err("file is too large to be a library export".into());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

static SESSION_ACTIVATED: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());

#[tauri::command]
fn set_fonts_active_session(store: State<Store>, paths: Vec<String>) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    let mut first_err = None;
    let mut activated = Vec::with_capacity(paths.len());
    for path in paths {
        match activation::sync(&mut state, &path, true) {
            Ok(()) => activated.push(path),
            Err(e) => {
                first_err.get_or_insert(e);
            }
        }
    }
    store::save(&state)?;
    if let Ok(mut session) = SESSION_ACTIVATED.lock() {
        session.extend(activated);
    }
    first_err.map_or(Ok(()), Err)
}

fn revert_session_activations(app: &tauri::AppHandle) {
    use tauri::Manager;
    let paths: Vec<String> = match SESSION_ACTIVATED.lock() {
        Ok(mut s) => std::mem::take(&mut *s),
        Err(_) => return,
    };
    if paths.is_empty() {
        return;
    }
    let store = app.state::<Store>();
    let mut guard = match store.0.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    for p in &paths {
        let _ = activation::sync(&mut guard, p, false);
    }
    affinity::revert_session(&mut guard);
    let _ = store::save(&guard);
}

#[tauri::command]
fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_features(path: String, face_index: u32) -> Result<Vec<String>, String> {
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    let face = ttf_parser::Face::parse(&data, face_index).map_err(|e| e.to_string())?;
    let mut tags: Vec<String> = Vec::new();
    let mut collect = |table: Option<ttf_parser::opentype_layout::LayoutTable>| {
        if let Some(t) = table {
            for f in t.features {
                tags.push(String::from_utf8_lossy(&f.tag.to_bytes()).into_owned());
            }
        }
    };
    collect(face.tables().gsub);
    collect(face.tables().gpos);
    tags.sort_unstable();
    tags.dedup();
    Ok(tags)
}

#[tauri::command]
fn export_fonts(paths: Vec<String>, dest_dir: String) -> Result<u32, String> {
    let dir = std::path::Path::new(&dest_dir);
    if !dir.is_dir() {
        return Err("destination is not a directory".into());
    }
    let mut n = 0;
    for p in paths {
        let src = std::path::Path::new(&p);
        let name = src.file_name().ok_or("invalid font path")?;
        std::fs::copy(src, dir.join(name)).map_err(|e| e.to_string())?;
        n += 1;
    }
    Ok(n)
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    extra_dirs: Vec<String>,
    watch_enabled: bool,
    auto_activate_imports: bool,
    library_dir: Option<String>,
    library_dir_enabled: bool,
    affinity_enabled: bool,
    affinity_deactivate_on_quit: bool,
}

#[tauri::command]
fn get_settings(store: State<Store>) -> Result<Settings, String> {
    let state = store.0.lock().map_err(|e| e.to_string())?;
    Ok(Settings {
        extra_dirs: state.extra_dirs.clone(),
        watch_enabled: state.watch_enabled,
        auto_activate_imports: state.auto_activate_imports,
        library_dir: state.library_dir.clone(),
        library_dir_enabled: state.library_dir_enabled,
        affinity_enabled: state.affinity_enabled,
        affinity_deactivate_on_quit: state.affinity_deactivate_on_quit,
    })
}

#[tauri::command]
fn set_settings(
    app: tauri::AppHandle,
    store: State<Store>,
    settings: Settings,
) -> Result<(), String> {
    {
        let mut state = store.0.lock().map_err(|e| e.to_string())?;
        state.extra_dirs = settings.extra_dirs.clone();
        state.watch_enabled = settings.watch_enabled;
        state.auto_activate_imports = settings.auto_activate_imports;
        state.library_dir = settings.library_dir.clone();
        state.library_dir_enabled = settings.library_dir_enabled;
        state.affinity_enabled = settings.affinity_enabled;
        state.affinity_deactivate_on_quit = settings.affinity_deactivate_on_quit;
        store::save(&state)?;
    }
    allow_dir(
        &app,
        &scanner::effective_managed_dir(
            settings
                .library_dir_enabled
                .then(|| settings.library_dir.as_deref())
                .flatten(),
        ),
    );
    allow_previews(&app, &settings.extra_dirs);
    apply_watch(&app, settings.watch_enabled, &settings.extra_dirs)
}

#[tauri::command]
fn default_library_dir() -> String {
    scanner::managed_font_dir().to_string_lossy().into_owned()
}

fn allow_dir(app: &tauri::AppHandle, dir: &std::path::Path) {
    let dir = std::fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf());
    let _ = app.asset_protocol_scope().allow_directory(&dir, true);
}

fn allow_previews(app: &tauri::AppHandle, extra: &[String]) {
    let scope = app.asset_protocol_scope();
    for (dir, _) in scanner::all_dirs(extra) {

        let dir = std::fs::canonicalize(&dir).unwrap_or(dir);
        let _ = scope.allow_directory(&dir, true);
    }
}

fn apply_watch(app: &tauri::AppHandle, enabled: bool, extra: &[String]) -> Result<(), String> {
    let handle: State<watcher::WatchHandle> = app.state();
    let mut slot = handle.0.lock().map_err(|e| e.to_string())?;
    *slot = None;
    if enabled {
        let dirs = scanner::all_dirs(extra).into_iter().map(|(d, _)| d).collect();
        *slot = Some(watcher::start(app.clone(), dirs)?);
    }
    Ok(())
}

#[tauri::command]
fn get_prefs(store: State<Store>) -> Result<serde_json::Value, String> {
    let state = store.0.lock().map_err(|e| e.to_string())?;
    Ok(state.prefs.clone())
}

#[tauri::command]
fn set_prefs(store: State<Store>, prefs: serde_json::Value) -> Result<(), String> {
    let mut state = store.0.lock().map_err(|e| e.to_string())?;
    state.prefs = prefs;
    store::save(&state)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(format!("refusing to open non-web URL: {url}"));
    }

    #[cfg(target_os = "linux")]
    let spawned = std::process::Command::new("xdg-open").arg(&url).spawn();

    #[cfg(target_os = "macos")]
    let spawned = std::process::Command::new("open").arg(&url).spawn();

    #[cfg(target_os = "windows")]
    let spawned = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
    };

    spawned.map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn adobe_available() -> bool {
    adobe::available()
}

#[tauri::command]
async fn apply_font_in_app(
    app: String,
    postscript_name: String,
    label: String,
) -> Result<String, String> {
    let target = adobe::Target::parse(&app)?;
    tauri::async_runtime::spawn_blocking(move || adobe::apply(target, &postscript_name, &label))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut state = store::load();
    activation::reconcile(&mut state);

    let watch_enabled = state.watch_enabled;
    let extra_dirs = state.extra_dirs.clone();
    let library_dir = state.active_library_dir().map(|s| s.to_owned());
    let linked_dirs: Vec<String> = state.linked.iter().cloned().collect();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Store(std::sync::Mutex::new(state)))
        .manage(watcher::WatchHandle(std::sync::Mutex::new(None)))
        .setup(move |app| {
            allow_previews(app.handle(), &extra_dirs);
            allow_dir(
                app.handle(),
                &scanner::effective_managed_dir(library_dir.as_deref()),
            );
            for path in &linked_dirs {
                if let Some(parent) = std::path::Path::new(path).parent() {
                    allow_dir(app.handle(), parent);
                }
            }
            if watch_enabled {
                let _ = apply_watch(app.handle(), true, &extra_dirs);
            }
            // Affinity watcher: session-activate doc fonts while it runs.
            let affinity_app = app.handle().clone();
            std::thread::spawn(move || loop {
                affinity::tick(&affinity_app);
                std::thread::sleep(std::time::Duration::from_secs(2));
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_fonts,
            set_font_active,
            set_fonts_active,
            set_fonts_active_session,
            install_fonts,
            uninstall_font,
            list_trash,
            affinity_connection,
            affinity_session_activate,
            restore_from_trash,
            delete_trash_entry,
            empty_trash,
            get_tags,
            set_tags,
            get_collections,
            set_collection,
            delete_collection,
            rename_collection,
            export_font,
            export_fonts,
            write_text_file,
            read_text_file,
            write_binary_file,
            get_features,
            get_favorites,
            set_favorite,
            get_notes,
            set_note,
            play_sound,
            get_charset,
            get_prefs,
            set_prefs,
            get_settings,
            set_settings,
            default_library_dir,
            open_url,
            adobe_available,
            apply_font_in_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                revert_session_activations(app);
            }
        });
}
