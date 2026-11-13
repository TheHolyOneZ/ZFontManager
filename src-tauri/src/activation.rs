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
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    if crate::aliases::applies(state, path) {
        let mut aliases = crate::aliases::Aliases::read(&crate::aliases::dir());
        let result = sync_watched(state, &mut aliases, path, active);
        refresh_watched(state);
        return result;
    }
    let result = sync_one(state, path, active);
    refresh_other_apps(state);
    result
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn sync_watched(
    state: &mut AppState,
    aliases: &mut crate::aliases::Aliases,
    path: &str,
    active: bool,
) -> Result<(), String> {
    let result = aliases.set(std::path::Path::new(path), active);
    if result.is_ok() {
        state.deactivated.remove(path);
    }
    crate::diag::activation(path, active, &result);
    result
}

#[cfg(target_os = "linux")]
fn refresh_watched(state: &AppState) {
    let _ = write_rejects(state);
    refresh_font_cache();
}

#[cfg(target_os = "macos")]
fn refresh_watched(_state: &AppState) {}

pub fn release(state: &AppState, path: &str) {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    if crate::aliases::applies(state, path) {
        let mut aliases = crate::aliases::Aliases::read(&crate::aliases::dir());
        if aliases.set(std::path::Path::new(path), false).is_ok() {
            refresh_watched(state);
        }
    }
    #[cfg(target_os = "windows")]
    {
        let _ = (state, path);
    }
}

fn sync_one(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {
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
    #[cfg(target_os = "macos")]
    let mut aliases: Option<crate::aliases::Aliases> = None;
    for path in paths {
        #[cfg(target_os = "macos")]
        if crate::aliases::applies(state, path) {
            let aliases = aliases.get_or_insert_with(|| crate::aliases::Aliases::read(&crate::aliases::dir()));
            match sync_watched(state, aliases, path, active) {
                Ok(()) => batch.done.push(path.clone()),
                Err(e) => batch.failed.push(e),
            }
            continue;
        }
        match sync_one(state, path, active) {
            Ok(()) => batch.done.push(path.clone()),
            Err(e) => batch.failed.push(e),
        }
    }
    refresh_other_apps(state);
    batch
}

#[cfg(not(target_os = "windows"))]
fn refresh_other_apps(_state: &AppState) {}

#[cfg(target_os = "windows")]
fn refresh_other_apps(state: &AppState) {
    use crate::registry;
    use std::path::Path;

    let var = |key: &str| std::env::var(key).ok();
    let Some(config) = crate::fontconf::windows::config_home(var) else {
        return;
    };
    let user_dir = crate::scanner::managed_font_dir();
    let mut known = vec![registry::normalize(&user_dir.to_string_lossy())];
    known.push(registry::normalize(&format!(
        "{}\\Fonts",
        std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string())
    )));
    if let Some(data) = crate::fontconf::windows::data_home(var) {
        known.push(registry::normalize(&data.join("fonts").to_string_lossy()));
    }
    if let Some(home) = var("HOME").filter(|h| !h.is_empty()).or_else(|| var("USERPROFILE")) {
        known.push(registry::normalize(&Path::new(&home).join(".fonts").to_string_lossy()));
    }
    let already_seen = |path: &str| {
        let path = registry::normalize(path);
        known.iter().any(|dir| path.starts_with(&format!("{}\\", dir.trim_end_matches('\\'))))
    };

    let visible: Vec<String> = registry::user_entries()
        .into_iter()
        .map(|(_, path)| path)
        .filter(|path| !already_seen(path.as_str()) && Path::new(path.as_str()).is_file())
        .collect();

    let registered = registry::registered_paths();
    let mut hidden: Vec<String> = state
        .registry_backup
        .values()
        .filter(|path| Path::new(path.as_str()).is_file())
        .cloned()
        .collect();
    if let Ok(entries) = std::fs::read_dir(&user_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            let text = path.to_string_lossy().into_owned();
            if crate::parser::is_font_file(&path) && !registered.contains(&registry::normalize(&text)) {
                hidden.push(text);
            }
        }
    }

    let xml = crate::fontconf::windows::windows_fragment(&visible, &hidden);
    let dir = config.join("fontconfig").join("conf.d");
    match crate::fontconf::write_fragment(&dir, xml.as_deref()) {
        Ok(()) if xml.is_none() => {
            let _ = std::fs::remove_dir(&dir);
            let _ = std::fs::remove_dir(config.join("fontconfig"));
        }
        Ok(()) => crate::diag::log(&format!(
            "fontconfig: {} active font(s) outside the font folders shown, {} hidden",
            visible.len(),
            hidden.len()
        )),
        Err(e) => crate::diag::log(&format!("fontconfig: couldn't update {}: {e}", dir.display())),
    }
}

#[cfg(target_os = "linux")]
pub fn sync_many(state: &mut AppState, paths: &[String], active: bool) -> Batch {
    let mut batch = Batch::default();
    let mut changed: Vec<(&String, bool)> = Vec::with_capacity(paths.len());
    let mut aliases: Option<crate::aliases::Aliases> = None;
    let mut linked = false;
    for path in paths {
        if crate::aliases::applies(state, path) {
            linked = true;
            let aliases = aliases.get_or_insert_with(|| crate::aliases::Aliases::read(&crate::aliases::dir()));
            match sync_watched(state, aliases, path, active) {
                Ok(()) => batch.done.push(path.clone()),
                Err(e) => batch.failed.push(e),
            }
            continue;
        }
        let was_deactivated = state.deactivated.contains(path);
        linked |= state.linked.contains(path);
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
    if linked {
        refresh_font_cache();
    }
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
#[derive(Default, Debug)]
struct Rules {
    reject: std::collections::BTreeSet<String>,
    accept: std::collections::BTreeSet<String>,
    names: std::collections::BTreeSet<String>,
}

#[cfg(target_os = "linux")]
fn rules(deactivated: &std::collections::HashSet<String>) -> Rules {
    use std::collections::{BTreeMap, BTreeSet};
    use std::path::Path;

    let mut rules = Rules::default();
    let mut by_dir: BTreeMap<&Path, Vec<&String>> = BTreeMap::new();
    for path in deactivated {
        match Path::new(path).parent() {
            Some(dir) if dir.parent().is_some() => by_dir.entry(dir).or_default().push(path),
            _ => {
                rules.reject.insert(path.clone());
            }
        }
    }
    for (dir, dead) in by_dir {
        let Ok(entries) = std::fs::read_dir(dir) else {
            rules.reject.extend(dead.into_iter().cloned());
            continue;
        };
        let mut files: BTreeSet<String> = BTreeSet::new();
        let mut nested = false;
        for entry in entries.filter_map(Result::ok) {
            let file = entry.path();
            if file.is_dir() {
                nested = true;
            } else if crate::parser::is_font_file(&file) {
                files.insert(file.to_string_lossy().into_owned());
            }
        }
        let dead: BTreeSet<String> = dead.into_iter().filter(|p| files.contains(*p)).cloned().collect();
        if dead.is_empty() {
            continue;
        }
        for path in &dead {
            if let Some(name) = Path::new(path).file_name() {
                rules.names.insert(name.to_string_lossy().into_owned());
            }
        }
        let live: Vec<String> = files.difference(&dead).cloned().collect();
        if !nested && live.len() + 1 < dead.len() {
            rules.reject.insert(format!("{}/*", dir.display()));
            rules.accept.extend(live);
        } else {
            rules.reject.extend(dead);
        }
    }
    rules
}

#[cfg(target_os = "linux")]
#[derive(Default)]
struct Bundled {
    opt: std::collections::HashSet<String>,
    flatpak: std::collections::HashSet<String>,
}

#[cfg(target_os = "linux")]
impl Bundled {
    fn names_in(dirs: impl IntoIterator<Item = std::path::PathBuf>) -> std::collections::HashSet<String> {
        dirs.into_iter()
            .filter_map(|dir| std::fs::read_dir(dir).ok())
            .flat_map(|entries| entries.filter_map(Result::ok))
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect()
    }

    fn find(home: &std::path::Path) -> Self {
        use std::path::PathBuf;

        let truetype = "share/fonts/truetype";
        let opt: Vec<PathBuf> = std::fs::read_dir("/opt")
            .map(|entries| {
                entries
                    .filter_map(Result::ok)
                    .filter(|e| e.file_name().to_string_lossy().starts_with("libreoffice"))
                    .map(|e| e.path().join(truetype))
                    .collect()
            })
            .unwrap_or_default();
        let flatpak = [home.join(".local/share/flatpak"), PathBuf::from("/var/lib/flatpak")].map(|base| {
            base.join("app/org.libreoffice.LibreOffice/current/active/files/libreoffice").join(truetype)
        });
        Bundled {
            opt: Self::names_in(opt),
            flatpak: Self::names_in(flatpak),
        }
    }
}

#[cfg(target_os = "linux")]
fn fragment_xml(
    reject: impl IntoIterator<Item = String>,
    accept: impl IntoIterator<Item = String>,
) -> Option<String> {
    let line = |glob: String| format!("      <glob>{}</glob>\n", crate::fontconf::escape(&glob));
    let reject: String = reject.into_iter().map(line).collect();
    if reject.is_empty() {
        return None;
    }
    let accept: String = accept.into_iter().map(line).collect();
    let mut xml = String::from(
        "<?xml version=\"1.0\"?>\n<!DOCTYPE fontconfig SYSTEM \"fonts.dtd\">\n<fontconfig>\n  <selectfont>\n    <rejectfont>\n",
    );
    xml.push_str(&reject);
    xml.push_str("    </rejectfont>\n");
    if !accept.is_empty() {
        xml.push_str("    <acceptfont>\n");
        xml.push_str(&accept);
        xml.push_str("    </acceptfont>\n");
    }
    xml.push_str("  </selectfont>\n</fontconfig>\n");
    Some(xml)
}

#[cfg(target_os = "linux")]
fn host_fragment(rules: &Rules, bundled: &Bundled) -> Option<String> {
    let libreoffice = rules
        .names
        .iter()
        .filter(|name| bundled.opt.contains(*name))
        .map(|name| format!("/opt/libreoffice*/share/fonts/truetype/{name}"));
    fragment_xml(rules.reject.iter().cloned().chain(libreoffice), rules.accept.iter().cloned())
}

#[cfg(target_os = "linux")]
fn sandbox_fragment(rules: &Rules, bundled: &Bundled, home: &std::path::Path, libreoffice: bool) -> Option<String> {
    let bundled_copies = rules
        .names
        .iter()
        .filter(|name| libreoffice && bundled.flatpak.contains(*name))
        .map(|name| format!("/app/libreoffice/share/fonts/truetype/{name}"));
    fragment_xml(
        rules.reject.iter().filter_map(|p| sandbox_path(p, home)).chain(bundled_copies),
        rules.accept.iter().filter_map(|p| sandbox_path(p, home)),
    )
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
    let rules = rules(&state.deactivated);
    let bundled = if state.deactivated.is_empty() { Bundled::default() } else { Bundled::find(home) };
    let host = host_fragment(&rules, &bundled);
    crate::fontconf::write_fragment(&config.join("fontconfig").join("conf.d"), host.as_deref())?;
    for dir in flatpak_conf_dirs(home) {
        let libreoffice = dir.ancestors().any(|a| a.ends_with("org.libreoffice.LibreOffice"));
        let xml = sandbox_fragment(&rules, &bundled, home, libreoffice);
        if let Err(e) = crate::fontconf::write_fragment(&dir, xml.as_deref()) {
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
    write_all_fragments(state, &home, &config)
}

#[cfg(target_os = "linux")]
fn refresh_font_cache() {
    if cfg!(test) {
        return;
    }
    if let Ok(mut child) = std::process::Command::new("fc-cache").spawn() {
        std::thread::spawn(move || {
            let _ = child.wait();
        });
    }
}

#[cfg(target_os = "linux")]
fn apply(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {
    sync_linked_alias(state, path, active)?;
    if state.linked.contains(path) {
        refresh_font_cache();
    }
    write_rejects(state)
}

#[cfg(target_os = "macos")]
fn move_file(from: &std::path::Path, to: &std::path::Path) -> Result<(), String> {
    use std::fs;

    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    fs::copy(from, to).map_err(|e| e.to_string())?;
    fs::remove_file(from).map_err(|e| e.to_string())
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

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn settle_watched(state: &mut AppState) {
    let mut changed = false;
    #[cfg(target_os = "macos")]
    {
        let parked: Vec<(String, String)> = state
            .parked
            .iter()
            .filter(|(orig, _)| crate::aliases::applies(state, orig))
            .map(|(orig, parked)| (orig.clone(), parked.clone()))
            .collect();
        for (orig, parked) in parked {
            let back = std::path::Path::new(&orig);
            if back.exists() {
                continue;
            }
            match move_file(std::path::Path::new(&parked), back) {
                Ok(()) => {
                    state.parked.remove(&orig);
                    changed = true;
                    crate::diag::log(&format!("watched: moved {orig} back from Deactivated"));
                }
                Err(e) => crate::diag::log(&format!("watched: couldn't move {orig} back: {e}")),
            }
        }
    }
    let before = state.deactivated.len();
    let watched: Vec<String> = state
        .deactivated
        .iter()
        .filter(|p| crate::aliases::applies(state, p) && !state.parked.contains_key(*p))
        .cloned()
        .collect();
    for path in &watched {
        state.deactivated.remove(path);
    }
    changed |= state.deactivated.len() != before;

    let roots: Vec<std::path::PathBuf> = state.extra_dirs.iter().map(std::path::PathBuf::from).collect();
    let mut aliases = crate::aliases::Aliases::read(&crate::aliases::dir());
    let pruned = aliases.prune(|target| {
        roots.iter().any(|r| target.starts_with(r)) && !crate::scanner::seen_by_system(target)
    });
    if pruned > 0 {
        crate::diag::log(&format!("watched: removed {pruned} link(s) to fonts that are gone"));
    }
    if changed {
        let _ = crate::store::save(state);
    }
}

#[cfg(target_os = "linux")]
pub fn reconcile(state: &mut AppState) {
    settle_watched(state);
    let _ = write_rejects(state);
}

#[cfg(target_os = "windows")]
pub fn reconcile(state: &mut AppState) {
    refresh_other_apps(state);
    let managed = crate::scanner::effective_managed_dir(state.active_library_dir());
    std::thread::spawn(move || {
        crate::registry::load_registered_outside(&managed);
    });
}

#[cfg(target_os = "macos")]
pub fn reconcile(state: &mut AppState) {
    settle_watched(state);
}

pub struct Probe {
    #[cfg(target_os = "windows")]
    registered: std::collections::HashSet<String>,
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    aliases: crate::aliases::Aliases,
}

pub fn probe() -> Probe {
    Probe {
        #[cfg(target_os = "windows")]
        registered: crate::registry::registered_paths(),
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        aliases: crate::aliases::Aliases::read(&crate::aliases::dir()),
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
        if crate::aliases::applies(state, &face.path) {
            return probe.aliases.contains(std::path::Path::new(&face.path));
        }
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

    fn fonts(dir: &std::path::Path, names: &[&str]) -> Vec<String> {
        std::fs::create_dir_all(dir).unwrap();
        names
            .iter()
            .map(|n| {
                let p = dir.join(n);
                std::fs::write(&p, b"font").unwrap();
                p.to_string_lossy().into_owned()
            })
            .collect()
    }

    #[test]
    fn fragment_lifecycle() {
        let tmp = std::env::temp_dir().join(format!("zfm-test-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();

        unsafe { std::env::set_var("XDG_CONFIG_HOME", &tmp) };
        let fragment = tmp.join("fontconfig/conf.d/99-zfontmanager.conf");

        let lib = tmp.join("lib");
        let font = fonts(&lib, &["My <Fancy> & Font.ttf", "Other.ttf", "Third.ttf"]).remove(0);
        let mut state = AppState::default();

        sync(&mut state, &font, false).unwrap();
        assert!(state.deactivated.contains(&font));
        let xml = std::fs::read_to_string(&fragment).unwrap();
        assert!(xml.contains("<rejectfont>"));
        assert!(xml.contains("My &lt;Fancy&gt; &amp; Font.ttf"));
        assert!(!xml.contains("<!--"));

        sync(&mut state, &font, true).unwrap();
        assert!(!state.deactivated.contains(&font));
        assert!(!fragment.exists(), "fragment should be removed when nothing is deactivated");
        assert!(is_active_path(&state, &font));

        let names: Vec<String> = (0..50).map(|i| format!("batch-{i}.ttf")).collect();
        let refs: Vec<&str> = names.iter().map(String::as_str).collect();
        let paths = fonts(&tmp.join("batch"), &refs);
        let batch = sync_many(&mut state, &paths, false);
        assert_eq!(batch.done.len(), 50);
        assert!(batch.failed.is_empty());
        assert_eq!(state.deactivated.len(), 50);
        let xml = std::fs::read_to_string(&fragment).unwrap();
        assert!(xml.contains(&format!("{}/*", tmp.join("batch").display())));
        assert!(!xml.contains("batch-49.ttf"));

        let batch = sync_many(&mut state, &paths, true);
        assert_eq!(batch.done.len(), 50);
        assert!(state.deactivated.is_empty());
        assert!(!fragment.exists());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn a_mostly_switched_off_folder_takes_a_few_lines() {
        let tmp = std::env::temp_dir().join(format!("zfm-big-{}", std::process::id()));
        let lib = tmp.join("ZFontManager");
        let names: Vec<String> = (0..3000).map(|i| format!("SomeFamily-SemiBoldItalic{i:04}.otf")).collect();
        let refs: Vec<&str> = names.iter().map(String::as_str).collect();
        let paths = fonts(&lib, &refs);
        let deactivated: std::collections::HashSet<String> = paths[200..].iter().cloned().collect();

        let rules = rules(&deactivated);
        assert_eq!(rules.reject.len(), 1);
        assert!(rules.reject.contains(&format!("{}/*", lib.display())));
        assert_eq!(rules.accept.len(), 200);
        assert!(rules.accept.contains(&paths[0]));
        assert!(!rules.accept.contains(&paths[200]));
        let xml = host_fragment(&rules, &Bundled::default()).unwrap();
        assert!(xml.len() < 40_000, "fragment is {} bytes", xml.len());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn a_few_switched_off_fonts_are_listed_one_by_one() {
        let tmp = std::env::temp_dir().join(format!("zfm-few-{}", std::process::id()));
        let paths = fonts(&tmp.join("lib"), &["A.ttf", "B.ttf", "C.ttf", "D.ttf"]);
        let nested = fonts(&tmp.join("tree"), &["X.ttf", "Y.ttf", "Z.ttf"]);
        fonts(&tmp.join("tree/sub"), &["Inner.ttf"]);
        let gone = tmp.join("lib/Deleted.ttf").to_string_lossy().into_owned();
        let unreadable = "/nonexistent-zfm/Font.ttf".to_string();
        let deactivated: std::collections::HashSet<String> = [
            paths[0].clone(),
            nested[0].clone(),
            nested[1].clone(),
            nested[2].clone(),
            gone.clone(),
            unreadable.clone(),
        ]
        .into();

        let rules = rules(&deactivated);
        assert!(rules.reject.contains(&paths[0]));
        assert!(nested.iter().all(|p| rules.reject.contains(p)), "a folder with subfolders is never rejected whole");
        assert!(!rules.reject.contains(&gone), "deleted files need no rule");
        assert!(rules.reject.contains(&unreadable), "files on a missing drive keep their rule");
        assert!(rules.accept.is_empty());
        assert_eq!(rules.reject.len(), 5);
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
    fn libreoffice_copies_are_only_named_when_libreoffice_bundles_them() {
        let mut rules = Rules::default();
        rules.reject.insert("/usr/share/fonts/noto/NotoSans-Regular.ttf".into());
        rules.reject.insert("/usr/share/fonts/misc/Rare.ttf".into());
        rules.names.insert("NotoSans-Regular.ttf".into());
        rules.names.insert("Rare.ttf".into());
        let bundled = Bundled {
            opt: ["NotoSans-Regular.ttf".to_string()].into(),
            flatpak: ["NotoSans-Regular.ttf".to_string()].into(),
        };
        let home = std::path::Path::new("/home/me");

        let host = host_fragment(&rules, &bundled).unwrap();
        assert!(host.contains("/opt/libreoffice*/share/fonts/truetype/NotoSans-Regular.ttf"));
        assert!(!host.contains("truetype/Rare.ttf"));
        assert!(!host.contains("/run/host/"));
        assert!(!host.contains("/app/libreoffice"));

        let office = sandbox_fragment(&rules, &bundled, home, true).unwrap();
        assert!(office.contains("/app/libreoffice/share/fonts/truetype/NotoSans-Regular.ttf"));
        assert!(office.contains("/run/host/fonts/misc/Rare.ttf"));
        assert!(!office.contains("/usr/share/fonts"));

        let other = sandbox_fragment(&rules, &bundled, home, false).unwrap();
        assert!(!other.contains("/app/libreoffice"));
    }

    #[test]
    fn flatpak_apps_get_the_fragment_and_lose_it_again() {
        let tmp = std::env::temp_dir().join(format!("zfm-flatpak-{}", std::process::id()));
        let home = tmp.join("home");
        let config = tmp.join("config");
        let app = home.join(".var/app/org.example.App");
        std::fs::create_dir_all(&app).unwrap();
        let font = fonts(&home.join(".local/share/fonts/sub"), &["a.ttf", "b.ttf"]).remove(0);
        let mut state = AppState::default();
        state.deactivated.insert(font.clone());

        write_all_fragments(&state, &home, &config).unwrap();
        let host = config.join("fontconfig/conf.d").join(crate::fontconf::FRAGMENT);
        let sandboxed = app.join("config/fontconfig/conf.d").join(crate::fontconf::FRAGMENT);
        let xml = std::fs::read_to_string(&sandboxed).unwrap();
        assert!(xml.contains("/run/host/user-fonts/sub/a.ttf"));
        assert!(!xml.contains(&font));
        assert!(std::fs::read_to_string(&host).unwrap().contains(&font));

        let before = std::fs::metadata(&host).unwrap().modified().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        write_all_fragments(&state, &home, &config).unwrap();
        assert_eq!(std::fs::metadata(&host).unwrap().modified().unwrap(), before, "unchanged rules are not rewritten");

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
