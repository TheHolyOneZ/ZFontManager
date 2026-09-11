

#![cfg(target_os = "windows")]

use std::collections::HashSet;
use std::path::Path;
use std::ptr::null_mut;
use windows_sys::Win32::Foundation::{ERROR_NO_MORE_ITEMS, ERROR_SUCCESS};
use windows_sys::Win32::Graphics::Gdi::{AddFontResourceW, RemoveFontResourceW};
use windows_sys::Win32::System::Registry::{
    RegCloseKey, RegDeleteValueW, RegEnumValueW, RegOpenKeyExW, RegSetValueExW, HKEY,
    HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_SET_VALUE, REG_EXPAND_SZ, REG_SZ,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SendNotifyMessageW, HWND_BROADCAST, WM_FONTCHANGE,
};

const FONTS_KEY: &str = r"Software\Microsoft\Windows NT\CurrentVersion\Fonts";

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

struct Key(HKEY);

impl Drop for Key {
    fn drop(&mut self) {
        unsafe {
            RegCloseKey(self.0);
        }
    }
}

fn open(root: HKEY, access: u32) -> Result<Key, String> {
    let mut handle: HKEY = null_mut();
    let rc = unsafe { RegOpenKeyExW(root, wide(FONTS_KEY).as_ptr(), 0, access, &mut handle) };
    if rc == ERROR_SUCCESS {
        Ok(Key(handle))
    } else {
        Err(format!("couldn't open the font registry key (error {rc})"))
    }
}

fn system_font_dir() -> String {
    let windir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());
    format!("{}\\Fonts", windir.trim_end_matches(['\\', '/']))
}

pub fn normalize(path: &str) -> String {
    let p = path.strip_prefix(r"\\?\").unwrap_or(path);
    p.replace('/', "\\").to_lowercase()
}

fn entries(root: HKEY) -> Vec<(String, String)> {
    let Ok(key) = open(root, KEY_READ) else {
        return Vec::new();
    };
    let system_dir = system_font_dir();
    let mut out = Vec::new();
    let mut name_buf = vec![0u16; 16_384];
    let mut data_buf = vec![0u8; 65_536];
    let mut index = 0u32;
    loop {
        let mut name_len = name_buf.len() as u32;
        let mut data_len = data_buf.len() as u32;
        let mut kind = 0u32;
        let rc = unsafe {
            RegEnumValueW(
                key.0,
                index,
                name_buf.as_mut_ptr(),
                &mut name_len,
                null_mut(),
                &mut kind,
                data_buf.as_mut_ptr(),
                &mut data_len,
            )
        };
        if rc == ERROR_NO_MORE_ITEMS {
            break;
        }
        index += 1;
        if rc != ERROR_SUCCESS || (kind != REG_SZ && kind != REG_EXPAND_SZ) {
            continue;
        }
        let name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
        let words: Vec<u16> = data_buf[..data_len as usize]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .take_while(|&w| w != 0)
            .collect();
        let value = String::from_utf16_lossy(&words);
        if value.trim().is_empty() {
            continue;
        }
        let path = if value.contains('\\') || value.contains('/') {
            value
        } else {
            format!("{system_dir}\\{value}")
        };
        out.push((name, path));
    }
    out
}

pub fn user_entries() -> Vec<(String, String)> {
    entries(HKEY_CURRENT_USER)
}

pub fn registered_paths() -> HashSet<String> {
    entries(HKEY_LOCAL_MACHINE)
        .into_iter()
        .chain(entries(HKEY_CURRENT_USER))
        .map(|(_, p)| normalize(&p))
        .collect()
}

pub fn is_machine_registered(path: &str) -> bool {
    let wanted = normalize(path);
    entries(HKEY_LOCAL_MACHINE)
        .iter()
        .any(|(_, p)| normalize(p) == wanted)
}

pub fn user_entries_for(path: &str) -> Vec<String> {
    let wanted = normalize(path);
    user_entries()
        .into_iter()
        .filter(|(_, p)| normalize(p) == wanted)
        .map(|(name, _)| name)
        .collect()
}

pub fn set_user_entry(name: &str, path: &str) -> Result<(), String> {
    let key = open(HKEY_CURRENT_USER, KEY_SET_VALUE)?;
    let data = wide(path);
    let rc = unsafe {
        RegSetValueExW(
            key.0,
            wide(name).as_ptr(),
            0,
            REG_SZ,
            data.as_ptr() as *const u8,
            (data.len() * 2) as u32,
        )
    };
    if rc == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(format!("couldn't write the font registry entry (error {rc})"))
    }
}

pub fn delete_user_entry(name: &str) -> Result<(), String> {
    let key = open(HKEY_CURRENT_USER, KEY_SET_VALUE)?;
    let rc = unsafe { RegDeleteValueW(key.0, wide(name).as_ptr()) };
    if rc == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(format!("couldn't remove the font registry entry (error {rc})"))
    }
}

pub fn value_name_for(path: &str) -> String {
    let p = Path::new(path);
    let fallback = || {
        p.file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "Font".to_string())
    };
    let Ok(data) = std::fs::read(p) else {
        return format!("{} (TrueType)", fallback());
    };
    let flavour = if data.starts_with(b"OTTO") { "OpenType" } else { "TrueType" };
    let count = ttf_parser::fonts_in_collection(&data).unwrap_or(1);
    let mut names: Vec<String> = Vec::new();
    for index in 0..count {
        let Ok(face) = ttf_parser::Face::parse(&data, index) else {
            continue;
        };
        let pick = |id: u16| {
            face.names()
                .into_iter()
                .filter(|n| n.name_id == id)
                .find_map(|n| n.to_string())
        };
        let Some(family) = pick(ttf_parser::name_id::TYPOGRAPHIC_FAMILY)
            .or_else(|| pick(ttf_parser::name_id::FAMILY))
        else {
            continue;
        };
        let style = pick(ttf_parser::name_id::TYPOGRAPHIC_SUBFAMILY)
            .or_else(|| pick(ttf_parser::name_id::SUBFAMILY))
            .unwrap_or_default();
        let full = if style.is_empty() || style.eq_ignore_ascii_case("regular") {
            family
        } else {
            format!("{family} {style}")
        };
        if !names.contains(&full) {
            names.push(full);
        }
    }
    let base = if names.is_empty() { fallback() } else { names.join(" & ") };
    format!("{base} ({flavour})")
}

pub fn unique_user_name(base: &str, path: &str) -> String {
    let wanted = normalize(path);
    let existing = user_entries();
    let taken = |name: &str| {
        existing
            .iter()
            .any(|(n, p)| n.eq_ignore_ascii_case(name) && normalize(p) != wanted)
    };
    if !taken(base) {
        return base.to_string();
    }
    let (stem, suffix) = match base.rfind(" (") {
        Some(at) => (&base[..at], &base[at..]),
        None => (base, ""),
    };
    (2..)
        .map(|n| format!("{stem} ({n}){suffix}"))
        .find(|candidate| !taken(candidate))
        .unwrap_or_else(|| base.to_string())
}

pub fn add_font_resource(path: &str) {
    let w = wide(path);
    unsafe {
        AddFontResourceW(w.as_ptr());
    }
}

pub fn remove_font_resource(path: &str) {
    let w = wide(path);
    unsafe {
        for _ in 0..16 {
            if RemoveFontResourceW(w.as_ptr()) == 0 {
                break;
            }
        }
    }
}

pub fn broadcast_font_change() {
    unsafe {
        SendNotifyMessageW(HWND_BROADCAST, WM_FONTCHANGE, 0, 0);
    }
}

pub fn load_registered_outside(dir: &Path) {
    let inside = normalize(&dir.to_string_lossy());
    let mut loaded = 0;
    for (_, path) in user_entries() {
        if normalize(&path).starts_with(&inside) || !Path::new(&path).is_file() {
            continue;
        }
        add_font_resource(&path);
        loaded += 1;
    }
    if loaded > 0 {
        broadcast_font_change();
    }
}
