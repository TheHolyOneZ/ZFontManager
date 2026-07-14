use crate::parser;
use notify::{Event, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Emitter;


pub struct WatchHandle(pub Mutex<Option<notify::RecommendedWatcher>>);


pub fn start(app: tauri::AppHandle, dirs: Vec<PathBuf>) -> Result<notify::RecommendedWatcher, String> {
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        let Ok(event) = res else { return };


        let mutating = event.kind.is_create() || event.kind.is_modify() || event.kind.is_remove();
        if mutating && event.paths.iter().any(|p| parser::is_font_file(p)) {
            let _ = app.emit("fonts:changed", ());
        }
    })
    .map_err(|e| e.to_string())?;

    for dir in dirs {
        if dir.is_dir() {

            let _ = watcher.watch(&dir, RecursiveMode::Recursive);
        }
    }
    Ok(watcher)
}
