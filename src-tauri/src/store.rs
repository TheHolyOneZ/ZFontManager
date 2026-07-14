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

    pub notes: HashMap<String, String>,

    pub prefs: serde_json::Value,

    pub parked: HashMap<String, String>,

    pub registry_backup: HashMap<String, String>,
}

pub struct Store(pub Mutex<AppState>);

fn state_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ZFontManager")
        .join("state.json")
}

pub fn app_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ZFontManager")
}

pub fn trash_dir() -> PathBuf {
    app_data_dir().join("Trash")
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
