use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_BYTES: u64 = 1_000_000;

static ACTIVE_NAMES: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);
static LIBRARY_POSTSCRIPT: Mutex<Option<HashMap<String, Vec<String>>>> = Mutex::new(None);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FaceNames {
    pub index: u32,
    pub family: String,
    pub subfamily: String,
    pub full: String,
    pub postscript: String,
    pub typographic_family: String,
    pub typographic_subfamily: String,
}

impl FaceNames {
    fn keys(&self) -> Vec<String> {
        let mut keys = Vec::new();
        if !self.family.is_empty() {
            keys.push(format!(
                "family/style \"{} / {}\"",
                self.family.to_lowercase(),
                self.subfamily.to_lowercase()
            ));
        }
        if !self.full.is_empty() {
            keys.push(format!("full name \"{}\"", self.full.to_lowercase()));
        }
        if !self.postscript.is_empty() {
            keys.push(format!("PostScript name \"{}\"", self.postscript.to_lowercase()));
        }
        keys
    }
}

pub fn log_path() -> PathBuf {
    crate::store::app_data_dir().join("activation.log")
}

pub fn log(line: &str) {
    if cfg!(test) {
        return;
    }
    let path = log_path();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if fs::metadata(&path).map(|m| m.len() > MAX_BYTES).unwrap_or(false) {
        let _ = fs::rename(&path, path.with_extension("old.log"));
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{} {line}", timestamp(SystemTime::now()));
    }
}

pub fn session_start() {
    log(&format!(
        "---- ZFontManager {} on {} ----",
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS
    ));
}

pub fn face_names(path: &Path) -> Vec<FaceNames> {
    let Ok(data) = crate::parser::read_sfnt(path) else {
        return Vec::new();
    };
    let count = ttf_parser::fonts_in_collection(&data).unwrap_or(1);
    (0..count)
        .filter_map(|index| {
            let face = ttf_parser::Face::parse(&data, index).ok()?;
            let pick = |id: u16| {
                face.names()
                    .into_iter()
                    .filter(|n| n.name_id == id)
                    .find_map(|n| n.to_string())
                    .unwrap_or_default()
            };
            Some(FaceNames {
                index,
                family: pick(ttf_parser::name_id::FAMILY),
                subfamily: pick(ttf_parser::name_id::SUBFAMILY),
                full: pick(ttf_parser::name_id::FULL_NAME),
                postscript: pick(ttf_parser::name_id::POST_SCRIPT_NAME),
                typographic_family: pick(ttf_parser::name_id::TYPOGRAPHIC_FAMILY),
                typographic_subfamily: pick(ttf_parser::name_id::TYPOGRAPHIC_SUBFAMILY),
            })
        })
        .collect()
}

pub fn name_clashes(
    active: &HashMap<String, String>,
    path: &str,
    names: &[FaceNames],
) -> Vec<(String, String)> {
    let mut clashes = Vec::new();
    for key in names.iter().flat_map(FaceNames::keys) {
        if let Some(other) = active.get(&key) {
            if other != path && !clashes.iter().any(|(k, _)| k == &key) {
                clashes.push((key, other.clone()));
            }
        }
    }
    clashes
}

pub fn postscript_index(faces: &[crate::font_types::FontFace]) -> HashMap<String, Vec<String>> {
    let mut index: HashMap<String, Vec<String>> = HashMap::new();
    for face in faces.iter().filter(|f| !crate::parser::is_web_format(f.format)) {
        let Some(ps) = face.postscript_name.as_deref().filter(|s| !s.is_empty()) else {
            continue;
        };
        let paths = index.entry(ps.to_lowercase()).or_default();
        if !paths.contains(&face.path) {
            paths.push(face.path.clone());
        }
    }
    index
}

pub fn index_library(faces: &[crate::font_types::FontFace]) {
    if let Ok(mut guard) = LIBRARY_POSTSCRIPT.lock() {
        *guard = Some(postscript_index(faces));
    }
}

pub fn library_clashes(
    index: &HashMap<String, Vec<String>>,
    path: &str,
    names: &[FaceNames],
) -> Vec<(String, String)> {
    let mut clashes: Vec<(String, String)> = Vec::new();
    for n in names.iter().filter(|n| !n.postscript.is_empty()) {
        for other in index.get(&n.postscript.to_lowercase()).into_iter().flatten() {
            if other != path && !clashes.iter().any(|(_, o)| o == other) {
                clashes.push((n.postscript.clone(), other.clone()));
            }
        }
    }
    clashes
}

pub fn activation(path: &str, active: bool, result: &Result<(), String>) {
    let verb = if active { "activate" } else { "deactivate" };
    match result {
        Ok(()) => log(&format!("{verb} ok      {path}")),
        Err(e) => log(&format!("{verb} FAILED  {path}: {e}")),
    }
    let Ok(mut guard) = ACTIVE_NAMES.lock() else {
        return;
    };
    let names_by_key = guard.get_or_insert_with(HashMap::new);
    if !active {
        if result.is_ok() {
            names_by_key.retain(|_, p| p != path);
        }
        return;
    }
    if result.is_err() {
        return;
    }
    let names = face_names(Path::new(path));
    for n in &names {
        let typographic = if n.typographic_family.is_empty() && n.typographic_subfamily.is_empty() {
            String::new()
        } else {
            format!(" typographic \"{} / {}\"", n.typographic_family, n.typographic_subfamily)
        };
        log(&format!(
            "  face {}: family \"{}\" style \"{}\" full \"{}\" postscript \"{}\"{typographic}",
            n.index, n.family, n.subfamily, n.full, n.postscript
        ));
    }
    let mut warned: Vec<String> = Vec::new();
    for (key, other) in name_clashes(names_by_key, path, &names) {
        log(&format!("  WARNING same {key} as {other}: apps may show only one of the two"));
        warned.push(other);
    }
    if let Ok(library) = LIBRARY_POSTSCRIPT.lock() {
        if let Some(index) = library.as_ref() {
            for (ps, other) in library_clashes(index, path, &names) {
                if !warned.contains(&other) {
                    log(&format!(
                        "  WARNING same PostScript name \"{ps}\" as {other} (found by the library scan): apps may show only one of the two"
                    ));
                }
            }
        }
    }
    for key in names.iter().flat_map(FaceNames::keys) {
        names_by_key.entry(key).or_insert_with(|| path.to_string());
    }
}

pub fn batch(active: bool, total: usize, failed: usize) {
    if total > 1 {
        let verb = if active { "activate" } else { "deactivate" };
        log(&format!("{verb} batch: {total} files, {failed} failed"));
    }
}

pub fn timestamp(at: SystemTime) -> String {
    let secs = at.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn face(family: &str, style: &str, full: &str, ps: &str) -> FaceNames {
        FaceNames {
            index: 0,
            family: family.into(),
            subfamily: style.into(),
            full: full.into(),
            postscript: ps.into(),
            typographic_family: String::new(),
            typographic_subfamily: String::new(),
        }
    }

    #[test]
    fn timestamps_are_utc_dates() {
        assert_eq!(timestamp(UNIX_EPOCH), "1970-01-01 00:00:00Z");
        let at = UNIX_EPOCH + Duration::from_secs(1_792_670_096);
        assert_eq!(timestamp(at), "2026-10-22 11:54:56Z");
        let leap = UNIX_EPOCH + Duration::from_secs(951_782_400);
        assert_eq!(timestamp(leap), "2000-02-29 00:00:00Z");
    }

    #[test]
    fn clashes_need_the_same_name_on_another_file() {
        let mut active = HashMap::new();
        for key in face("Serif Text", "Regular", "Serif Text", "SerifText-Regular").keys() {
            active.insert(key, "/fonts/text.otf".to_string());
        }

        let same_file = [face("Serif Text", "Regular", "Serif Text", "SerifText-Regular")];
        assert!(name_clashes(&active, "/fonts/text.otf", &same_file).is_empty());

        let other_family = [face("Serif Display", "Regular", "Serif Display", "SerifDisplay-Regular")];
        assert!(name_clashes(&active, "/fonts/display.otf", &other_family).is_empty());

        let copy = [face("SERIF TEXT", "Regular", "Other Full", "Other-PS")];
        let found = name_clashes(&active, "/fonts/copy.otf", &copy);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].1, "/fonts/text.otf");
        assert!(found[0].0.starts_with("family/style"));
    }

    #[test]
    fn library_clashes_find_copies_elsewhere() {
        let mut index = HashMap::new();
        index.insert(
            "serif-regular".to_string(),
            vec!["/lib/serif.otf".to_string(), "/system/serif.otf".to_string()],
        );
        let names = [face("Serif", "Regular", "Serif", "Serif-Regular")];
        let found = library_clashes(&index, "/lib/serif.otf", &names);
        assert_eq!(found, vec![("Serif-Regular".to_string(), "/system/serif.otf".to_string())]);
        let other = [face("Serif", "Bold", "Serif Bold", "Serif-Bold")];
        assert!(library_clashes(&index, "/lib/serif-bold.otf", &other).is_empty());
    }

    #[test]
    fn reads_names_from_a_real_font() {
        let Some(path) = ["/usr/share/fonts", "/usr/local/share/fonts"]
            .iter()
            .flat_map(|d| walkdir::WalkDir::new(d).into_iter().filter_map(|e| e.ok()))
            .map(|e| e.into_path())
            .find(|p| p.extension().is_some_and(|x| x == "ttf" || x == "otf"))
        else {
            return;
        };
        let names = face_names(&path);
        assert!(!names.is_empty());
        assert!(!names[0].family.is_empty());
    }
}
