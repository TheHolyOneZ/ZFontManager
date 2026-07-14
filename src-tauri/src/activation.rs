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
    if active {
        state.deactivated.remove(path);
    } else {
        state.deactivated.insert(path.to_string());
    }
    apply(state, path, active)
}

#[cfg(target_os = "linux")]
fn apply(state: &mut AppState, _path: &str, _active: bool) -> Result<(), String> {
    use std::fmt::Write as _;
    use std::fs;

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

        let parked = state
            .parked
            .remove(path)
            .ok_or_else(|| format!("no parked copy recorded for {path}"))?;
        move_file(Path::new(&parked), Path::new(path))?;
    } else {
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
pub fn hidden_reg() -> std::process::Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = std::process::Command::new("reg");
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(target_os = "windows")]
fn apply(state: &mut AppState, path: &str, active: bool) -> Result<(), String> {


    let key = r"HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts";
    if active {
        let value_name = state
            .registry_backup
            .iter()
            .find(|(_, v)| v.as_str() == path)
            .map(|(k, _)| k.clone())
            .ok_or_else(|| format!("no registry backup recorded for {path}"))?;
        let out = hidden_reg()
            .args(["add", key, "/v", &value_name, "/t", "REG_SZ", "/d", path, "/f"])
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).into_owned());
        }
        state.registry_backup.remove(&value_name);
        broadcast_font_change(path, true);
    } else {

        let out = hidden_reg()
            .args(["query", key])
            .output()
            .map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&out.stdout).into_owned();
        let value_name = text
            .lines()
            .filter_map(|l| {
                let l = l.trim();
                let (name, rest) = l.split_once("REG_SZ")?;
                (rest.trim().eq_ignore_ascii_case(path)).then(|| name.trim().to_string())
            })
            .next()
            .ok_or_else(|| format!("font not found in per-user registry: {path}"))?;
        let del = hidden_reg()
            .args(["delete", key, "/v", &value_name, "/f"])
            .output()
            .map_err(|e| e.to_string())?;
        if !del.status.success() {
            return Err(String::from_utf8_lossy(&del.stderr).into_owned());
        }
        state
            .registry_backup
            .insert(value_name, path.to_string());
        broadcast_font_change(path, false);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn broadcast_font_change(path: &str, add: bool) {
    use windows_sys::Win32::Graphics::Gdi::{AddFontResourceW, RemoveFontResourceW};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SendNotifyMessageW, HWND_BROADCAST, WM_FONTCHANGE,
    };

    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        if add {
            AddFontResourceW(wide.as_ptr());
        } else {
            RemoveFontResourceW(wide.as_ptr());
        }
        SendNotifyMessageW(HWND_BROADCAST, WM_FONTCHANGE, 0, 0);
    }
}


#[cfg(target_os = "linux")]
pub fn reconcile(state: &mut AppState) {


    let _ = apply(state, "", true);
}

#[cfg(not(target_os = "linux"))]
pub fn reconcile(_state: &mut AppState) {}


pub fn is_active(state: &AppState, path: &str) -> bool {
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

        assert!(is_active(&state, font));
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
