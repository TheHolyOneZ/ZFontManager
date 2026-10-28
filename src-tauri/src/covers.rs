use crate::store::{covers_dir, AppState};
use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Read;
use std::path::{Path, PathBuf};

const MAX_BYTES: u64 = 25 * 1024 * 1024;

fn kind(head: &[u8]) -> Option<&'static str> {
    match head {
        [0x89, b'P', b'N', b'G', ..] => Some("png"),
        [0xFF, 0xD8, 0xFF, ..] => Some("jpg"),
        [b'G', b'I', b'F', b'8', ..] => Some("gif"),
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => Some("webp"),
        [b'B', b'M', ..] => Some("bmp"),
        _ => None,
    }
}

fn file_name_for(family: &str, ext: &str) -> String {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    family.hash(&mut h);
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{:016x}-{stamp}.{ext}", h.finish())
}

fn stored(name: &str) -> Option<PathBuf> {
    let file = Path::new(name).file_name()?;
    (file == name).then(|| covers_dir().join(file))
}

pub fn all(state: &AppState) -> HashMap<String, String> {
    state
        .covers
        .iter()
        .filter_map(|(family, name)| {
            let path = stored(name)?;
            path.is_file().then(|| (family.clone(), path.to_string_lossy().into_owned()))
        })
        .collect()
}

pub fn set(state: &mut AppState, family: &str, source: &Path) -> Result<String, String> {
    let meta = fs::metadata(source).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("not a file".to_string());
    }
    if meta.len() > MAX_BYTES {
        return Err(format!("the image is larger than {} MB", MAX_BYTES / 1024 / 1024));
    }
    let mut head = [0u8; 12];
    let n = fs::File::open(source)
        .and_then(|mut f| f.read(&mut head))
        .map_err(|e| e.to_string())?;
    let ext = kind(&head[..n]).ok_or("this file isn't a PNG, JPEG, WebP, GIF or BMP image")?;
    let dir = covers_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = file_name_for(family, ext);
    let dest = dir.join(&name);
    fs::copy(source, &dest).map_err(|e| e.to_string())?;
    if let Some(old) = state.covers.insert(family.to_string(), name).and_then(|n| stored(&n)) {
        let _ = fs::remove_file(old);
    }
    Ok(dest.to_string_lossy().into_owned())
}

pub fn remove(state: &mut AppState, family: &str) {
    if let Some(old) = state.covers.remove(family).and_then(|n| stored(&n)) {
        let _ = fs::remove_file(old);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sniffs_image_types() {
        assert_eq!(kind(b"\x89PNG\r\n\x1a\n...."), Some("png"));
        assert_eq!(kind(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("jpg"));
        assert_eq!(kind(b"RIFF\0\0\0\0WEBPVP8 "), Some("webp"));
        assert_eq!(kind(b"GIF89a"), Some("gif"));
        assert_eq!(kind(b"<svg xmlns"), None);
        assert_eq!(kind(b"OTTO"), None);
    }

    #[test]
    fn stored_names_cannot_escape_the_covers_folder() {
        assert!(stored("abc-1.png").is_some());
        assert!(stored("../state.json").is_none());
        assert!(stored("/etc/passwd").is_none());
    }
}
