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

    /// Override for the folder moved imports are stored in (None = default).
    pub library_dir: Option<String>,

    /// Whether the custom library folder is in effect (the path is kept
    /// even while disabled, so re-enabling restores it without asking).
    pub library_dir_enabled: bool,

    /// Font files linked in place: part of the library, never copied or moved.
    pub linked: HashSet<String>,

    /// Auto-activate fonts for open Affinity documents (needs its MCP server).
    pub affinity_enabled: bool,

    /// Deactivate Affinity session fonts when Affinity quits.
    #[serde(default = "default_true")]
    pub affinity_deactivate_on_quit: bool,

    pub online_fonts_enabled: bool,
}

pub struct Store(pub Mutex<AppState>);

fn default_true() -> bool {
    true
}

impl AppState {
    /// The custom library folder actually in effect, if one is enabled.
    pub fn active_library_dir(&self) -> Option<&str> {
        if self.library_dir_enabled {
            self.library_dir.as_deref()
        } else {
            None
        }
    }
}

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
