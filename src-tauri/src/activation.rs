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

pub fn sync(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {
    if !active && !cfg!(target_os = "linux") && crate::parser::is_web_path(std::path::Path::new(path)) {
        return Err(format!(
            "web fonts (WOFF/WOFF2) aren't installed as desktop fonts on this system, so there's nothing to turn off: {path}"
        ));
    }
    let was_deactivated = state.deactivated.contains(path);
    if active {
        state.deactivated.remove(path);
    } else {
        state.deactivated.insert(path.to_string());
    }
    let result = apply(state, path, active);
    crate::diag::activation(path, active, &result);
    if result.is_err() {
        if was_deactivated {
            state.deactivated.insert(path.to_string());
        } else {
            state.deactivated.remove(path);
        }
    }
    result
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
fn apply(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {
    use std::fmt::Write as _;
    use std::fs;

    sync_linked_alias(state, path, active)?;

    let dir = dirs::config_dir()
        .ok_or("no config dir")?
        .join("fontconfig")
        .join("conf.d");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join("99-zfontmanager.conf");

    if state.deactivated.is_empty() {
        if file.exists() {
            fs::remove_file(&file).map_err(|e| e.to_string())?;
        }
    } else {
        let mut globs = String::new();
        let mut paths: Vec<&String> = state.deactivated.iter().collect();
        paths.sort();
        for p in paths {
            let escaped = p
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            let _ = writeln!(globs, "      <glob>{escaped}</glob>");
        }
        let xml = format!(
            "<?xml version=\"1.0\"?>\n<!DOCTYPE fontconfig SYSTEM \"fonts.dtd\">\n\
             <!-- Managed by ZFontManager - do not edit; toggling fonts rewrites this file -->\n\
             <fontconfig>\n  <selectfont>\n    <rejectfont>\n{globs}    </rejectfont>\n  </selectfont>\n</fontconfig>\n"
        );

        let tmp = file.with_extension("conf.tmp");
        fs::write(&tmp, xml).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &file).map_err(|e| e.to_string())?;
    }

    if let Ok(mut child) = std::process::Command::new("fc-cache").spawn() {
        std::thread::spawn(move || {
            let _ = child.wait();
        });
    }
    Ok(())
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
    let _ = apply(state, "", true);
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
