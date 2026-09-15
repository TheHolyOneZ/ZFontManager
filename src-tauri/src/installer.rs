use crate::font_types::{FontFace, FontSource, TrashEntry};
use crate::parser;
use crate::scanner;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    pub file: String,
    pub done: usize,
    pub total: usize,
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub installed: Vec<FontFace>,
    pub errors: Vec<String>,
    pub duplicates: Vec<String>,
}

/// Identity used for duplicate detection: the PostScript name when present,
/// otherwise "Family Style". The frontend mirrors this exact formula.
pub fn dup_key(face: &FontFace) -> String {
    face.postscript_name
        .clone()
        .unwrap_or_else(|| format!("{} {}", face.family, face.style))
}

fn move_file(from: &Path, to: &Path) -> Result<(), String> {
    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    fs::copy(from, to).map_err(|e| e.to_string())?;
    fs::remove_file(from).map_err(|e| e.to_string())
}

fn unique_dest(dir: &Path, file_name: &std::ffi::OsStr) -> PathBuf {
    let mut dest = dir.join(file_name);
    let mut n = 1;
    while dest.exists() {
        dest = dir.join(format!("{n}-{}", file_name.to_string_lossy()));
        n += 1;
    }
    dest
}

fn expand_dropped(path: &Path, staging: &Path) -> Result<Vec<PathBuf>, String> {
    if path.is_dir() {
        return Ok(walkdir::WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .map(|e| e.into_path())
            .filter(|p| parser::is_font_file(p))
            .collect());
    }
    if path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("zip"))
    {
        let file = fs::File::open(path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        fs::create_dir_all(staging).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let Some(name) = entry.enclosed_name() else { continue };
            if !parser::is_font_file(&name) {
                continue;
            }
            let file_name = name.file_name().ok_or("bad zip entry")?.to_owned();
            let dest = unique_dest(staging, &file_name);
            let mut out_file = fs::File::create(&dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
            out.push(dest);
        }
        return Ok(out);
    }
    if parser::is_font_file(path) {
        return Ok(vec![path.to_path_buf()]);
    }
    Err(format!("not a font file: {}", path.display()))
}

pub fn install(
    app: &tauri::AppHandle,
    dropped: Vec<String>,
    existing: &HashSet<String>,
) -> InstallResult {
    let managed = scanner::managed_font_dir();
    let staging = crate::store::app_data_dir().join("staging");
    let mut result = InstallResult::default();
    let mut known: HashSet<String> = existing.clone();

    if let Err(e) = fs::create_dir_all(&managed) {
        result.errors.push(e.to_string());
        return result;
    }

    let mut files: Vec<PathBuf> = Vec::new();
    for p in &dropped {
        match expand_dropped(Path::new(p), &staging) {
            Ok(mut f) => files.append(&mut f),
            Err(e) => result.errors.push(e),
        }
    }

    let total = files.len();
    for (i, src) in files.into_iter().enumerate() {
        // Skip fonts that are already in the library (or earlier in this batch).
        // Unparseable files fall through to the regular path (old behavior).
        let src_faces = parser::parse_font_file(&src, FontSource::Managed);
        let src_keys: Vec<String> = src_faces.iter().map(dup_key).collect();
        if !src_keys.is_empty() && src_keys.iter().all(|k| known.contains(k)) {
            for k in &src_keys {
                if !result.duplicates.contains(k) {
                    result.duplicates.push(k.clone());
                }
            }
            let _ = app.emit(
                "install:progress",
                InstallProgress {
                    file: src
                        .file_name()
                        .map(|f| f.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                    done: i + 1,
                    total,
                    ok: true,
                    error: None,
                },
            );
            continue;
        }
        let file_name = src.file_name().map(|f| f.to_owned()).unwrap_or_default();
        let dest = unique_dest(&managed, &file_name);
        let copied = fs::copy(&src, &dest).map(|_| ()).map_err(|e| e.to_string());
        let (ok, error) = match &copied {
            Ok(()) => (true, None),
            Err(e) => (false, Some(e.clone())),
        };
        let _ = app.emit(
            "install:progress",
            InstallProgress {
                file: file_name.to_string_lossy().into_owned(),
                done: i + 1,
                total,
                ok,
                error: error.clone(),
            },
        );
        match copied {
            Ok(()) => {
                // New fonts start deactivated: parse only, do NOT register.
                // (activation::sync(..., false) runs right after in install_fonts,
                // and the toggle registers on demand.)
                let mut faces = parser::parse_font_file(&dest, FontSource::Managed);
                for face in &mut faces {
                    face.active = false;
                    known.insert(dup_key(face));
                }
                result.installed.extend(faces);
            }
            Err(e) => result.errors.push(e),
        }
    }

    let _ = fs::remove_dir_all(&staging);
    refresh_system_font_cache();
    result
}

pub fn uninstall(path: &str, family: &str) -> Result<TrashEntry, String> {

    #[cfg(target_os = "windows")]
    unregister_user_font(path);

    let trash = crate::store::trash_dir();
    fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
    let src = Path::new(path);
    let file_name = src.file_name().ok_or("invalid path")?;
    let dest = unique_dest(&trash, file_name);
    move_file(src, &dest)?;

    let entry = TrashEntry {
        id: dest.to_string_lossy().into_owned(),
        original_path: path.to_string(),
        trashed_path: dest.to_string_lossy().into_owned(),
        family: family.to_string(),
        trashed_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    };

    let meta = dest.with_extension(format!(
        "{}.zfmtrash",
        dest.extension().and_then(|e| e.to_str()).unwrap_or("bin")
    ));
    let _ = fs::write(&meta, serde_json::to_vec(&entry).unwrap_or_default());
    refresh_system_font_cache();
    Ok(entry)
}

pub fn list_trash() -> Vec<TrashEntry> {
    let trash = crate::store::trash_dir();
    let Ok(entries) = fs::read_dir(&trash) else {
        return Vec::new();
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().to_string_lossy().ends_with(".zfmtrash"))
        .filter_map(|e| {
            let bytes = fs::read(e.path()).ok()?;
            serde_json::from_slice::<TrashEntry>(&bytes).ok()
        })
        .filter(|t| Path::new(&t.trashed_path).exists())
        .collect()
}

pub fn restore(entry_id: &str) -> Result<(), String> {
    let entry = list_trash()
        .into_iter()
        .find(|t| t.id == entry_id)
        .ok_or("trash entry not found")?;
    if let Some(parent) = Path::new(&entry.original_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    move_file(Path::new(&entry.trashed_path), Path::new(&entry.original_path))?;
    remove_sidecar(&entry.trashed_path);
    refresh_system_font_cache();
    Ok(())
}

pub fn empty_trash() -> Result<(), String> {
    let trash = crate::store::trash_dir();
    if trash.exists() {
        fs::remove_dir_all(&trash).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn delete_trash_entry(entry_id: &str) -> Result<(), String> {
    let entry = list_trash()
        .into_iter()
        .find(|t| t.id == entry_id)
        .ok_or("trash entry not found")?;
    fs::remove_file(&entry.trashed_path).map_err(|e| e.to_string())?;
    remove_sidecar(&entry.trashed_path);
    Ok(())
}

fn remove_sidecar(trashed_path: &str) {
    let p = Path::new(trashed_path);
    let meta = p.with_extension(format!(
        "{}.zfmtrash",
        p.extension().and_then(|e| e.to_str()).unwrap_or("bin")
    ));
    let _ = fs::remove_file(meta);
}

fn refresh_system_font_cache() {
    #[cfg(target_os = "linux")]
    {
        if let Ok(mut child) = std::process::Command::new("fc-cache").spawn() {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
    }
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SendNotifyMessageW, HWND_BROADCAST, WM_FONTCHANGE,
        };
        SendNotifyMessageW(HWND_BROADCAST, WM_FONTCHANGE, 0, 0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uninstall_restore_roundtrip() {
        let tmp = std::env::temp_dir().join(format!("zfm-inst-test-{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();

        unsafe { std::env::set_var("XDG_DATA_HOME", &tmp) };

        let font = tmp.join("Fake Font.ttf");
        fs::write(&font, b"not really a font").unwrap();

        let entry = uninstall(font.to_str().unwrap(), "Fake Font").unwrap();
        assert!(!font.exists(), "file should be moved out");
        assert!(Path::new(&entry.trashed_path).exists());

        let listed = list_trash();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].family, "Fake Font");

        restore(&entry.id).unwrap();
        assert!(font.exists(), "file should be back after restore");
        assert!(list_trash().is_empty());

        let _ = fs::remove_dir_all(&tmp);
    }
}

#[cfg(target_os = "windows")]
fn unregister_user_font(path: &str) {
    use crate::registry;
    registry::remove_font_resource(path);
    for name in registry::user_entries_for(path) {
        let _ = registry::delete_user_entry(&name);
    }
    refresh_system_font_cache();
}
