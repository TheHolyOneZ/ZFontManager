use crate::font_types::{FontFace, FontSource};
use crate::parser;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub done: usize,
    pub total: usize,
}

pub fn managed_font_dir() -> PathBuf {
    #[cfg(target_os = "linux")]
    {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("fonts")
            .join("ZFontManager")
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library/Fonts")
    }
    #[cfg(target_os = "windows")]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Microsoft\\Windows\\Fonts")
    }
}

pub fn effective_managed_dir(library_dir: Option<&str>) -> PathBuf {
    match library_dir.map(str::trim).filter(|s| !s.is_empty()) {
        Some(dir) => PathBuf::from(dir),
        None => managed_font_dir(),
    }
}

fn font_dirs() -> Vec<(PathBuf, FontSource)> {
    let mut dirs_list: Vec<(PathBuf, FontSource)> = Vec::new();
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    #[cfg(target_os = "linux")]
    {
        dirs_list.push((PathBuf::from("/usr/share/fonts"), FontSource::System));
        dirs_list.push((PathBuf::from("/usr/local/share/fonts"), FontSource::System));
        dirs_list.push((home.join(".local/share/fonts"), FontSource::User));
        dirs_list.push((home.join(".fonts"), FontSource::User));
    }
    #[cfg(target_os = "macos")]
    {
        dirs_list.push((PathBuf::from("/System/Library/Fonts"), FontSource::System));
        dirs_list.push((PathBuf::from("/Library/Fonts"), FontSource::System));
        dirs_list.push((home.join("Library/Fonts"), FontSource::User));
    }
    #[cfg(target_os = "windows")]
    {
        dirs_list.push((PathBuf::from("C:\\Windows\\Fonts"), FontSource::System));
        if let Some(local) = dirs::data_local_dir() {
            dirs_list.push((local.join("Microsoft\\Windows\\Fonts"), FontSource::User));
        }
        let _ = home;
    }

    dirs_list
}

fn classify(path: &std::path::Path, base_source: FontSource, managed: &Path) -> FontSource {
    if base_source == FontSource::User && path.starts_with(managed) {
        FontSource::Managed
    } else {
        base_source
    }
}

pub fn all_dirs(extra: &[String]) -> Vec<(PathBuf, FontSource)> {
    let mut dirs_list = font_dirs();
    for d in extra {
        dirs_list.push((PathBuf::from(d), FontSource::User));
    }
    dirs_list
}

pub fn scan_all(app: &tauri::AppHandle, extra: &[String], managed: &Path) -> Vec<FontFace> {
    let files: Vec<(PathBuf, FontSource)> = all_dirs(extra)
        .into_iter()
        .flat_map(|(dir, source)| {
            WalkDir::new(dir)
                .follow_links(true)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .map(move |e| (e.into_path(), source))
                .filter(|(p, _)| parser::is_font_file(p))
                .collect::<Vec<_>>()
        })
        .collect();

    let total = files.len();
    let mut faces = Vec::with_capacity(total);
    for (done, (path, base_source)) in files.into_iter().enumerate() {
        let source = classify(&path, base_source, managed);
        faces.extend(parser::parse_font_file(&path, source));
        if done % 25 == 0 || done + 1 == total {
            let _ = app.emit("scan:progress", ScanProgress { done: done + 1, total });
        }
    }

    faces.sort_by(|a, b| a.id.cmp(&b.id));
    faces.dedup_by(|a, b| a.id == b.id);
    faces
}

pub fn merge_linked(mut faces: Vec<FontFace>, linked: &HashSet<String>) -> Vec<FontFace> {
    let mut linked_faces = Vec::new();
    let mut targets = HashSet::new();
    for path in linked {
        let p = Path::new(path);
        if !p.is_file() {
            continue;
        }
        if let Ok(real) = std::fs::canonicalize(p) {
            targets.insert(real);
        }
        linked_faces.extend(parser::parse_font_file(p, FontSource::Managed));
    }
    if linked_faces.is_empty() {
        return faces;
    }
    let ids: HashSet<&str> = linked_faces.iter().map(|f| f.id.as_str()).collect();
    faces.retain(|f| !ids.contains(f.id.as_str()) && !is_alias_of(Path::new(&f.path), &targets));
    faces.extend(linked_faces);
    faces
}

fn is_alias_of(path: &Path, targets: &HashSet<PathBuf>) -> bool {
    std::fs::symlink_metadata(path).is_ok_and(|m| m.file_type().is_symlink())
        && std::fs::canonicalize(path).is_ok_and(|real| targets.contains(&real))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn managed_symlink_is_alias_of_linked_original() {
        let tmp = std::env::temp_dir().join(format!("zfm-alias-{}", std::process::id()));
        let library = tmp.join("library");
        std::fs::create_dir_all(&library).unwrap();
        let original = tmp.join("Original.otf");
        let other = tmp.join("Other.otf");
        std::fs::write(&original, b"font").unwrap();
        std::fs::write(&other, b"font").unwrap();
        let alias = library.join("Original.otf");
        let copy = library.join("Copy.otf");
        std::os::unix::fs::symlink(&original, &alias).unwrap();
        std::fs::write(&copy, b"font").unwrap();
        let unrelated = library.join("Other.otf");
        std::os::unix::fs::symlink(&other, &unrelated).unwrap();

        let targets: HashSet<PathBuf> = [std::fs::canonicalize(&original).unwrap()].into();
        assert!(is_alias_of(&alias, &targets));
        assert!(!is_alias_of(&original, &targets));
        assert!(!is_alias_of(&copy, &targets));
        assert!(!is_alias_of(&unrelated, &targets));

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
