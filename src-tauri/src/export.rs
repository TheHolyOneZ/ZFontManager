use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub name: String,
    pub files: Vec<GroupFile>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupFile {
    pub path: String,
    pub read_from: Option<String>,
}

#[derive(Serialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub folder: String,
    pub families: u32,
    pub files: u32,
    pub failed: Vec<String>,
}

const RESERVED: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

pub fn folder_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect();
    let mut out: String = cleaned.trim().trim_end_matches(['.', ' ']).chars().take(120).collect();
    out = out.trim_end_matches(['.', ' ']).to_string();
    if out.is_empty() {
        return "_".to_string();
    }
    let stem = out.split('.').next().unwrap_or("").trim().to_ascii_uppercase();
    if RESERVED.contains(&stem.as_str()) {
        out.insert(0, '_');
    }
    out
}

fn same_bytes(a: &Path, b: &Path) -> bool {
    match (fs::metadata(a), fs::metadata(b)) {
        (Ok(x), Ok(y)) if x.len() == y.len() => matches!((fs::read(a), fs::read(b)), (Ok(x), Ok(y)) if x == y),
        _ => false,
    }
}

fn numbered(name: &OsStr, n: u32) -> std::ffi::OsString {
    let file = Path::new(name);
    let mut out = file.file_stem().unwrap_or(name).to_os_string();
    out.push(format!(" ({n})"));
    if let Some(ext) = file.extension() {
        out.push(".");
        out.push(ext);
    }
    out
}

fn place(dir: &Path, name: &OsStr, source: &Path, taken: &mut HashSet<String>) -> (PathBuf, bool) {
    let mut n = 1;
    loop {
        let candidate = if n == 1 { name.to_os_string() } else { numbered(name, n) };
        let key = candidate.to_string_lossy().to_lowercase();
        let target = dir.join(&candidate);
        if !taken.contains(&key) {
            if !target.exists() {
                taken.insert(key);
                return (target, true);
            }
            if same_bytes(source, &target) {
                taken.insert(key);
                return (target, false);
            }
        }
        n += 1;
    }
}

pub fn export(dest: &Path, collection: &str, groups: &[Group]) -> Result<Report, String> {
    if !dest.is_dir() {
        return Err("destination is not a directory".into());
    }
    let root = dest.join(folder_name(collection));
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let mut report = Report {
        folder: root.to_string_lossy().into_owned(),
        ..Report::default()
    };
    let mut used: HashSet<String> = HashSet::new();

    for group in groups.iter().filter(|g| !g.files.is_empty()) {
        let base = folder_name(&group.name);
        let mut name = base.clone();
        let mut n = 2;
        while !used.insert(name.to_lowercase()) {
            name = format!("{base} ({n})");
            n += 1;
        }
        let dir = root.join(&name);
        if let Err(e) = fs::create_dir_all(&dir) {
            report.failed.push(format!("{}: {e}", group.name));
            continue;
        }
        let mut taken: HashSet<String> = HashSet::new();
        let mut copied = 0;
        let mut seen: HashSet<&str> = HashSet::new();
        for file in &group.files {
            if !seen.insert(file.path.as_str()) {
                continue;
            }
            let logical = Path::new(&file.path);
            let source = file.read_from.as_deref().map(Path::new).unwrap_or(logical);
            let Some(file_name) = logical.file_name() else {
                report.failed.push(file.path.clone());
                continue;
            };
            let (target, needs_copy) = place(&dir, file_name, source, &mut taken);
            if needs_copy {
                if let Err(e) = fs::copy(source, &target) {
                    report.failed.push(format!("{}: {e}", file.path));
                    continue;
                }
            }
            copied += 1;
        }
        if copied > 0 {
            report.families += 1;
            report.files += copied;
        } else {
            let _ = fs::remove_dir(&dir);
        }
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("zfm-export-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn file(path: &Path) -> GroupFile {
        GroupFile { path: path.to_string_lossy().into_owned(), read_from: None }
    }

    #[test]
    fn folder_names_work_on_every_system() {
        assert_eq!(folder_name("Inter"), "Inter");
        assert_eq!(folder_name("Client: A/B?"), "Client_ A_B_");
        assert_eq!(folder_name("  Trailing dots... "), "Trailing dots");
        assert_eq!(folder_name("con"), "_con");
        assert_eq!(folder_name("LPT1.fonts"), "_LPT1.fonts");
        assert_eq!(folder_name("Console"), "Console");
        assert_eq!(folder_name("..."), "_");
        assert_eq!(folder_name(""), "_");
        assert_eq!(folder_name(&"x".repeat(300)).len(), 120);
    }

    #[test]
    fn every_family_gets_its_own_folder() {
        let tmp = temp("layout");
        let src = tmp.join("messy");
        fs::create_dir_all(src.join("a")).unwrap();
        fs::create_dir_all(src.join("b")).unwrap();
        let regular = src.join("Inter-Regular.ttf");
        let bold = src.join("a/Inter-Bold.ttf");
        let dup_a = src.join("a/Font.otf");
        let dup_b = src.join("b/Font.otf");
        let parked = tmp.join("parked-Lato.ttf");
        fs::write(&regular, b"regular").unwrap();
        fs::write(&bold, b"bold").unwrap();
        fs::write(&dup_a, b"first").unwrap();
        fs::write(&dup_b, b"second").unwrap();
        fs::write(&parked, b"lato").unwrap();
        let out = tmp.join("out");
        fs::create_dir_all(&out).unwrap();

        let groups = vec![
            Group { name: "Inter".into(), files: vec![file(&regular), file(&bold), file(&regular)] },
            Group { name: "Odd/Name".into(), files: vec![file(&dup_a), file(&dup_b)] },
            Group {
                name: "Lato".into(),
                files: vec![GroupFile {
                    path: src.join("Lato-Regular.ttf").to_string_lossy().into_owned(),
                    read_from: Some(parked.to_string_lossy().into_owned()),
                }],
            },
            Group { name: "inter".into(), files: vec![file(&bold)] },
            Group { name: "Empty".into(), files: vec![] },
        ];
        let report = export(&out, "Client: X", &groups).unwrap();
        let root = out.join("Client_ X");
        assert_eq!(report.folder, root.to_string_lossy());
        assert_eq!(report.families, 4);
        assert_eq!(report.files, 6);
        assert!(report.failed.is_empty());
        assert_eq!(fs::read(root.join("Inter/Inter-Regular.ttf")).unwrap(), b"regular");
        assert_eq!(fs::read(root.join("Inter/Inter-Bold.ttf")).unwrap(), b"bold");
        assert_eq!(fs::read(root.join("Odd_Name/Font.otf")).unwrap(), b"first");
        assert_eq!(fs::read(root.join("Odd_Name/Font (2).otf")).unwrap(), b"second");
        assert_eq!(fs::read(root.join("Lato/Lato-Regular.ttf")).unwrap(), b"lato");
        assert!(root.join("inter (2)/Inter-Bold.ttf").is_file());
        assert!(!root.join("Empty").exists());
        assert!(regular.is_file() && dup_b.is_file());

        let again = export(&out, "Client: X", &groups).unwrap();
        assert_eq!(again.files, 6);
        assert_eq!(fs::read_dir(root.join("Odd_Name")).unwrap().count(), 2);
        assert_eq!(fs::read_dir(root.join("Inter")).unwrap().count(), 2);

        fs::write(&regular, b"changed").unwrap();
        export(&out, "Client: X", &groups).unwrap();
        assert_eq!(fs::read(root.join("Inter/Inter-Regular.ttf")).unwrap(), b"regular");
        assert_eq!(fs::read(root.join("Inter/Inter-Regular (2).ttf")).unwrap(), b"changed");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn missing_files_are_reported_not_fatal() {
        let tmp = temp("missing");
        let real = tmp.join("Real.ttf");
        fs::write(&real, b"real").unwrap();
        let groups = vec![Group {
            name: "Mixed".into(),
            files: vec![file(&tmp.join("Gone.ttf")), file(&real)],
        }];
        let report = export(&tmp, "C", &groups).unwrap();
        assert_eq!(report.files, 1);
        assert_eq!(report.failed.len(), 1);
        assert!(export(&tmp.join("nope"), "C", &groups).is_err());
        let _ = fs::remove_dir_all(&tmp);
    }
}
