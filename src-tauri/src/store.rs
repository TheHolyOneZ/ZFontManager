use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppState {
    pub deactivated: HashSet<String>,

    pub tags: HashMap<String, Vec<String>>,

    pub collections: HashMap<String, Vec<String>>,

    pub favorites: HashSet<String>,

    pub extra_dirs: Vec<String>,

    pub watch_enabled: bool,

    pub auto_activate_imports: bool,

    pub notes: HashMap<String, String>,

    pub prefs: serde_json::Value,

    pub parked: HashMap<String, String>,

    pub registry_backup: HashMap<String, String>,

    pub library_dir: Option<String>,

    pub library_dir_enabled: bool,

    pub linked: HashSet<String>,

    pub affinity_enabled: bool,

    #[serde(default = "default_true")]
    pub affinity_deactivate_on_quit: bool,

    pub online_fonts_enabled: bool,

    pub covers: HashMap<String, String>,
}

pub struct Store(pub Mutex<AppState>);

fn default_true() -> bool {
    true
}

impl AppState {
    pub fn active_library_dir(&self) -> Option<&str> {
        if self.library_dir_enabled {
            self.library_dir.as_deref()
        } else {
            None
        }
    }
}

pub const PORTABLE_MARKER: &str = "portable.txt";

pub fn portable_data_for(exe_dir: &std::path::Path) -> Option<PathBuf> {
    if !exe_dir.join(PORTABLE_MARKER).is_file() {
        return None;
    }
    let data = exe_dir.join("data");
    fs::create_dir_all(&data).ok()?;
    let probe = data.join(".zfm-write-test");
    fs::write(&probe, b"").ok()?;
    let _ = fs::remove_file(&probe);
    Some(data)
}

pub fn portable_dir() -> Option<&'static std::path::Path> {
    static DIR: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();
    DIR.get_or_init(|| {
        let exe = std::env::current_exe().ok()?;
        portable_data_for(exe.parent()?)
    })
    .as_deref()
}

fn state_path() -> PathBuf {
    if let Some(dir) = portable_dir() {
        return dir.join("state.json");
    }
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ZFontManager")
        .join("state.json")
}

pub fn app_data_dir() -> PathBuf {
    if let Some(dir) = portable_dir() {
        return dir.to_path_buf();
    }
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ZFontManager")
}

pub fn trash_dir() -> PathBuf {
    app_data_dir().join("Trash")
}

pub fn covers_dir() -> PathBuf {
    app_data_dir().join("Covers")
}

pub fn load() -> AppState {
    fs::read(state_path())
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn save(state: &AppState) -> Result<(), String> {
    let path = state_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(state).map_err(|e| e.to_string())?;
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod portable_tests {
    use super::*;

    #[test]
    fn portable_mode_needs_the_marker_and_keeps_data_beside_the_app() {
        let dir = std::env::temp_dir().join(format!("zfm-portable-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        assert_eq!(portable_data_for(&dir), None);
        assert!(!dir.join("data").exists());

        fs::write(dir.join(PORTABLE_MARKER), b"").unwrap();
        assert_eq!(portable_data_for(&dir), Some(dir.join("data")));
        assert!(dir.join("data").is_dir());
        assert!(!dir.join("data/.zfm-write-test").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
