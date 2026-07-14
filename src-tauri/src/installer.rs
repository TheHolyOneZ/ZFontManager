use crate::font_types::{FontFace, FontSource, TrashEntry};
use crate::parser;
use crate::scanner;
use serde::Serialize;
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


pub fn install(app: &tauri::AppHandle, dropped: Vec<String>) -> InstallResult {
    let managed = scanner::managed_font_dir();
    let staging = crate::store::app_data_dir().join("staging");
    let mut result = InstallResult::default();

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
                let faces = parser::parse_font_file(&dest, FontSource::Managed);
                #[cfg(target_os = "windows")]
                if let Some(f) = faces.first() {
                    register_user_font(&dest, &f.family, &f.style);
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
    use windows_sys::Win32::Graphics::Gdi::RemoveFontResourceW;

    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {

        while RemoveFontResourceW(wide.as_ptr()) != 0 {}
    }
    let key = r"HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts";
    if let Ok(out) = crate::activation::hidden_reg().args(["query", key]).output() {
        let text = String::from_utf8_lossy(&out.stdout).into_owned();
        for line in text.lines() {
            let l = line.trim();
            if let Some((name, rest)) = l.split_once("REG_SZ") {
                if rest.trim().eq_ignore_ascii_case(path) {
                    let _ = crate::activation::hidden_reg()
                        .args(["delete", key, "/v", name.trim(), "/f"])
                        .output();
                }
            }
        }
    }
    refresh_system_font_cache();
}


#[cfg(target_os = "windows")]
fn register_user_font(path: &Path, family: &str, style: &str) {
    use windows_sys::Win32::Graphics::Gdi::AddFontResourceW;

    let value_name = if style.eq_ignore_ascii_case("regular") {
        format!("{family} (TrueType)")
    } else {
        format!("{family} {style} (TrueType)")
    };
    let path_str = path.to_string_lossy();
    let _ = crate::activation::hidden_reg()
        .args([
            "add",
            r"HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts",
            "/v",
            &value_name,
            "/t",
            "REG_SZ",
            "/d",
            &path_str,
            "/f",
        ])
        .output();
    let wide: Vec<u16> = path_str.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        AddFontResourceW(wide.as_ptr());
    }
}
