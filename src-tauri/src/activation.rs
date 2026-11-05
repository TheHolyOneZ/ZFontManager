use crate::font_types::FontSource;
use crate::store::AppState;

pub fn can_deactivate(source: FontSource) -> bool {
    #[cfg(target_os = "linux")]
    {
        let _ = source;
        true
    }
    #[cfg(target_os = "macos")]
    {
        source != FontSource::System
    }
    #[cfg(target_os = "windows")]
    {
        source != FontSource::System
    }
}

fn mark(state: &mut AppState, path: &str, deactivated: bool) {
    if deactivated {
        state.deactivated.insert(path.to_string());
    } else {
        state.deactivated.remove(path);
    }
}

pub fn sync(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {
    if !active && !cfg!(target_os = "linux") && crate::parser::is_web_path(std::path::Path::new(path)) {
        return Err(format!(
            "web fonts (WOFF/WOFF2) aren't installed as desktop fonts on this system, so there's nothing to turn off: {path}"
        ));
    }
    let was_deactivated = state.deactivated.contains(path);
    mark(state, path, !active);
    let result = apply(state, path, active);
    crate::diag::activation(path, active, &result);
    if result.is_err() {
        mark(state, path, was_deactivated);
    }
    result
}

#[derive(Default)]
pub struct Batch {
    pub done: Vec<String>,
    pub failed: Vec<String>,
}

#[cfg(not(target_os = "linux"))]
pub fn sync_many(state: &mut AppState, paths: &[String], active: bool) -> Batch {
    let mut batch = Batch::default();
    for path in paths {
        match sync(state, path, active) {
            Ok(()) => batch.done.push(path.clone()),
            Err(e) => batch.failed.push(e),
        }
    }
    batch
}

#[cfg(target_os = "linux")]
pub fn sync_many(state: &mut AppState, paths: &[String], active: bool) -> Batch {
    let mut batch = Batch::default();
    let mut changed: Vec<(&String, bool)> = Vec::with_capacity(paths.len());
    for path in paths {
        let was_deactivated = state.deactivated.contains(path);
        mark(state, path, !active);
        match sync_linked_alias(state, path, active) {
            Ok(()) => changed.push((path, was_deactivated)),
            Err(e) => {
                mark(state, path, was_deactivated);
                crate::diag::activation(path, active, &Err(e.clone()));
                batch.failed.push(e);
            }
        }
    }
    let written = write_rejects(state);
    for (path, was_deactivated) in changed {
        crate::diag::activation(path, active, &written);
        match &written {
            Ok(()) => batch.done.push(path.clone()),
            Err(e) => {
                mark(state, path, was_deactivated);
                batch.failed.push(e.clone());
            }
        }
    }
    batch
}

pub fn batch_error(failed: &[String], total: usize) -> Result<(), String> {
    match failed {
        [] => Ok(()),
        [only] if total == 1 => Err(only.clone()),
        [first, ..] => Err(format!("{} of {total} fonts failed: {first}", failed.len())),
    }
}

pub fn drop_linked_alias(state: &AppState, path: &str) {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        let _ = sync_linked_alias(state, path, false);
    }
    #[cfg(target_os = "windows")]
    {
        let _ = (state, path);
    }
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn sync_linked_alias(state: &AppState, path: &str, active: bool) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    if !state.linked.contains(path) {
        return Ok(());
    }
    let source = Path::new(path);
    let file_name = source.file_name().ok_or("invalid font path")?;
    let dir = crate::scanner::effective_managed_dir(state.active_library_dir());
    if source.parent() == Some(dir.as_path()) {
        return Ok(());
    }
    let alias = dir.join(file_name);

    if active {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        if fs::symlink_metadata(&alias).is_ok() {
            return Ok(());
        }
        std::os::unix::fs::symlink(source, &alias).map_err(|e| e.to_string())
    } else {
        match fs::symlink_metadata(&alias) {
            Ok(meta) if meta.file_type().is_symlink() => {
                fs::remove_file(&alias).map_err(|e| e.to_string())
            }
            _ => Ok(()),
        }
    }
}

#[cfg(target_os = "linux")]
const FRAGMENT: &str = "99-zfontmanager.conf";

#[cfg(target_os = "linux")]
fn sandbox_path(path: &str, home: &std::path::Path) -> Option<String> {
    use std::path::{Path, PathBuf};

    let mounts: [(PathBuf, &str); 4] = [
        (PathBuf::from("/usr/share/fonts"), "/run/host/fonts"),
        (PathBuf::from("/usr/local/share/fonts"), "/run/host/local-fonts"),
        (home.join(".local/share/fonts"), "/run/host/user-fonts"),
        (home.join(".fonts"), "/run/host/user-fonts"),
    ];
    let path = Path::new(path);
    mounts.iter().find_map(|(host, sandbox)| {
        let rest = path.strip_prefix(host).ok()?;
        Some(format!("{sandbox}/{}", rest.display()))
    })
}

#[cfg(target_os = "linux")]
fn reject_globs(path: &str, home: &std::path::Path) -> Vec<String> {
    let mut globs = vec![path.to_string()];
    globs.extend(sandbox_path(path, home));
    if let Some(name) = std::path::Path::new(path).file_name() {
        let name = name.to_string_lossy();
        globs.push(format!("/app/libreoffice/share/fonts/truetype/{name}"));
        globs.push(format!("/opt/libreoffice*/share/fonts/truetype/{name}"));
    }
    globs
}

#[cfg(target_os = "linux")]
fn reject_fragment(state: &AppState, home: &std::path::Path) -> String {
    use std::fmt::Write as _;

    let mut paths: Vec<&String> = state.deactivated.iter().collect();
    paths.sort();
    let mut globs = String::new();
    for path in paths {
        for glob in reject_globs(path, home) {
            let escaped = glob
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            let _ = writeln!(globs, "      <glob>{escaped}</glob>");
        }
    }
    format!(
        "<?xml version=\"1.0\"?>\n<!DOCTYPE fontconfig SYSTEM \"fonts.dtd\">\n\
         <!-- Managed by ZFontManager - do not edit; toggling fonts rewrites this file -->\n\
         <fontconfig>\n  <selectfont>\n    <rejectfont>\n{globs}    </rejectfont>\n  </selectfont>\n</fontconfig>\n"
    )
}

#[cfg(target_os = "linux")]
fn write_fragment(dir: &std::path::Path, xml: Option<&str>) -> Result<(), String> {
    use std::fs;

    let file = dir.join(FRAGMENT);
    let Some(xml) = xml else {
        if file.exists() {
            fs::remove_file(&file).map_err(|e| e.to_string())?;
        }
        return Ok(());
    };
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = file.with_extension("conf.tmp");
    fs::write(&tmp, xml).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &file).map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
fn flatpak_conf_dirs(home: &std::path::Path) -> Vec<std::path::PathBuf> {
    let Ok(apps) = std::fs::read_dir(home.join(".var/app")) else {
        return Vec::new();
    };
    apps.filter_map(Result::ok)
        .filter(|app| app.path().is_dir())
        .map(|app| app.path().join("config/fontconfig/conf.d"))
        .collect()
}

#[cfg(target_os = "linux")]
fn write_all_fragments(
    state: &AppState,
    home: &std::path::Path,
    config: &std::path::Path,
) -> Result<(), String> {
    let xml = (!state.deactivated.is_empty()).then(|| reject_fragment(state, home));
    write_fragment(&config.join("fontconfig").join("conf.d"), xml.as_deref())?;
    for dir in flatpak_conf_dirs(home) {
        if let Err(e) = write_fragment(&dir, xml.as_deref()) {
            crate::diag::log(&format!("flatpak: couldn't update {}: {e}", dir.display()));
        }
        if xml.is_none() {
            let _ = std::fs::remove_dir(&dir);
            if let Some(parent) = dir.parent() {
                let _ = std::fs::remove_dir(parent);
            }
        }
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn write_rejects(state: &AppState) -> Result<(), String> {
    let config = dirs::config_dir().ok_or("no config dir")?;
    let home = if cfg!(test) {
        config.clone()
    } else {
        dirs::home_dir().ok_or("no home dir")?
    };
    write_all_fragments(state, &home, &config)?;

    if let Ok(mut child) = std::process::Command::new("fc-cache").spawn() {
        std::thread::spawn(move || {
            let _ = child.wait();
        });
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn apply(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {
    sync_linked_alias(state, path, active)?;
    write_rejects(state)
}

#[cfg(target_os = "macos")]
fn apply(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {
    use std::fs;
    use std::path::{Path, PathBuf};

    if state.linked.contains(path) {
        return sync_linked_alias(state, path, active);
    }

    let parked_dir = crate::store::app_data_dir().join("Deactivated");
    fs::create_dir_all(&parked_dir).map_err(|e| e.to_string())?;

    fn move_file(from: &Path, to: &Path) -> Result<(), String> {
        if fs::rename(from, to).is_ok() {
            return Ok(());
        }

        fs::copy(from, to).map_err(|e| e.to_string())?;
        fs::remove_file(from).map_err(|e| e.to_string())
    }

    if active {
        let Some(parked) = state.parked.get(path).cloned() else {
            return Ok(());
        };
        move_file(Path::new(&parked), Path::new(path))?;
        state.parked.remove(path);
    } else {
        if state.parked.contains_key(path) {
            return Ok(());
        }
        let file_name = Path::new(path)
            .file_name()
            .ok_or("invalid font path")?;
        let mut dest: PathBuf = parked_dir.join(file_name);

        let mut n = 1;
        while dest.exists() {
            dest = parked_dir.join(format!("{n}-{}", file_name.to_string_lossy()));
            n += 1;
        }
        move_file(Path::new(path), &dest)?;
        state
            .parked
            .insert(path.to_string(), dest.to_string_lossy().into_owned());
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn apply(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {
    use crate::registry;

    if active {
        let loaded = registry::add_font_resource(path);
        crate::diag::log(&format!("windows: GDI loaded {loaded} font(s) from {path}"));
        if loaded == 0 {
            return Err(format!("Windows couldn't load this font file: {path}"));
        }

        let remembered = state
            .registry_backup
            .iter()
            .find(|(_, v)| v.as_str() == path)
            .map(|(k, _)| k.clone());
        let name = match remembered {
            Some(name) => name,
            None => registry::unique_user_name(&registry::value_name_for(path), path),
        };
        let existing = registry::user_entries_for(path);
        if existing.is_empty() {
            if let Err(e) = registry::set_user_entry(&name, path) {
                registry::remove_font_resource(path);
                return Err(e);
            }
            crate::diag::log(&format!("windows: registry value \"{name}\" written"));
        } else {
            crate::diag::log(&format!("windows: already registered as \"{}\"", existing.join("\", \"")));
        }
        state.registry_backup.remove(&name);
    } else {
        if registry::is_machine_registered(path) {
            return Err(format!(
                "this font is installed for all users; deactivating it needs administrator rights: {path}"
            ));
        }

        let names = registry::user_entries_for(path);
        for name in &names {
            registry::delete_user_entry(name)?;
        }
        if let Some(first) = names.into_iter().next() {
            state.registry_backup.insert(first, path.to_string());
        }
        registry::remove_font_resource(path);
    }
    registry::broadcast_font_change();
    Ok(())
}

#[cfg(target_os = "linux")]
pub fn reconcile(state: &mut AppState) {
    let _ = write_rejects(state);
}

#[cfg(target_os = "windows")]
pub fn reconcile(state: &mut AppState) {
    let managed = crate::scanner::effective_managed_dir(state.active_library_dir());
    std::thread::spawn(move || {
        crate::registry::load_registered_outside(&managed);
    });
}

#[cfg(target_os = "macos")]
pub fn reconcile(_state: &mut AppState) {}

pub struct Probe {
    #[cfg(target_os = "windows")]
    registered: std::collections::HashSet<String>,
}

pub fn probe() -> Probe {
    Probe {
        #[cfg(target_os = "windows")]
        registered: crate::registry::registered_paths(),
    }
}

pub fn is_active(probe: &Probe, state: &AppState, face: &crate::font_types::FontFace) -> bool {
    #[cfg(target_os = "windows")]
    {
        let _ = state;

        face.source == FontSource::System
            || probe
                .registered
                .contains(&crate::registry::normalize(&face.path))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = probe;
        is_active_path(state, &face.path)
    }
}

#[cfg(not(target_os = "windows"))]
fn is_active_path(state: &AppState, path: &str) -> bool {
    !state.deactivated.contains(path) && !state.parked.contains_key(path)
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;

    #[test]
    fn fragment_lifecycle() {
        let tmp = std::env::temp_dir().join(format!("zfm-test-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();

        unsafe { std::env::set_var("XDG_CONFIG_HOME", &tmp) };
        let fragment = tmp.join("fontconfig/conf.d/99-zfontmanager.conf");

        let mut state = AppState::default();
        let font = "/tmp/My <Fancy> & Font.ttf";

        sync(&mut state, font, false).unwrap();
        assert!(state.deactivated.contains(font));
        let xml = std::fs::read_to_string(&fragment).unwrap();
        assert!(xml.contains("<rejectfont>"));
        assert!(xml.contains("/tmp/My &lt;Fancy&gt; &amp; Font.ttf"));

        sync(&mut state, font, true).unwrap();
        assert!(!state.deactivated.contains(font));
        assert!(!fragment.exists(), "fragment should be removed when nothing is deactivated");

        assert!(is_active_path(&state, font));

        let paths: Vec<String> = (0..50).map(|i| format!("/tmp/batch-{i}.ttf")).collect();
        let batch = sync_many(&mut state, &paths, false);
        assert_eq!(batch.done.len(), 50);
        assert!(batch.failed.is_empty());
        assert_eq!(state.deactivated.len(), 50);
        assert!(std::fs::read_to_string(&fragment).unwrap().contains("/tmp/batch-49.ttf"));

        let batch = sync_many(&mut state, &paths, true);
        assert_eq!(batch.done.len(), 50);
        assert!(state.deactivated.is_empty());
        assert!(!fragment.exists());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn sandboxed_apps_get_the_paths_they_see() {
        let home = std::path::Path::new("/home/me");
        assert_eq!(
            sandbox_path("/usr/share/fonts/noto/NotoSans-Regular.ttf", home).as_deref(),
            Some("/run/host/fonts/noto/NotoSans-Regular.ttf")
        );
        assert_eq!(
            sandbox_path("/usr/local/share/fonts/a.ttf", home).as_deref(),
            Some("/run/host/local-fonts/a.ttf")
        );
        assert_eq!(
            sandbox_path("/home/me/.local/share/fonts/sub/a.ttf", home).as_deref(),
            Some("/run/host/user-fonts/sub/a.ttf")
        );
        assert_eq!(
            sandbox_path("/home/me/.fonts/a.ttf", home).as_deref(),
            Some("/run/host/user-fonts/a.ttf")
        );
        assert_eq!(sandbox_path("/mnt/fonts/a.ttf", home), None);
    }

    #[test]
    fn libreoffice_bundled_copies_are_rejected_by_file_name() {
        let globs = reject_globs("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", std::path::Path::new("/home/me"));
        assert!(globs.contains(&"/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf".to_string()));
        assert!(globs.contains(&"/run/host/fonts/truetype/noto/NotoSans-Regular.ttf".to_string()));
        assert!(globs.contains(&"/app/libreoffice/share/fonts/truetype/NotoSans-Regular.ttf".to_string()));
        assert!(globs.contains(&"/opt/libreoffice*/share/fonts/truetype/NotoSans-Regular.ttf".to_string()));
    }

    #[test]
    fn flatpak_apps_get_the_fragment_and_lose_it_again() {
        let tmp = std::env::temp_dir().join(format!("zfm-flatpak-{}", std::process::id()));
        let home = tmp.join("home");
        let config = tmp.join("config");
        let app = home.join(".var/app/org.example.App");
        std::fs::create_dir_all(&app).unwrap();
        let mut state = AppState::default();
        state.deactivated.insert("/usr/share/fonts/a.ttf".to_string());

        write_all_fragments(&state, &home, &config).unwrap();
        let host = config.join("fontconfig/conf.d").join(FRAGMENT);
        let sandboxed = app.join("config/fontconfig/conf.d").join(FRAGMENT);
        let xml = std::fs::read_to_string(&sandboxed).unwrap();
        assert!(xml.contains("/run/host/fonts/a.ttf"));
        assert_eq!(std::fs::read_to_string(&host).unwrap(), xml);

        state.deactivated.clear();
        write_all_fragments(&state, &home, &config).unwrap();
        assert!(!host.exists());
        assert!(!sandboxed.exists());
        assert!(!app.join("config/fontconfig").exists());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn batch_error_counts_failures() {
        assert_eq!(batch_error(&[], 12), Ok(()));
        assert_eq!(batch_error(&["boom".into()], 1), Err("boom".into()));
        assert_eq!(
            batch_error(&["a".into(), "b".into()], 12),
            Err("2 of 12 fonts failed: a".into())
        );
    }
}
