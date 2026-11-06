use std::fs;
use std::path::Path;

pub const FRAGMENT: &str = "99-zfontmanager.conf";

pub fn write_fragment(dir: &Path, xml: Option<&str>) -> Result<(), String> {
    let file = dir.join(FRAGMENT);
    let Some(xml) = xml else {
        if file.exists() {
            fs::remove_file(&file).map_err(|e| e.to_string())?;
        }
        return Ok(());
    };
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = file.with_extension("conf.tmp");
    fs::write(&tmp, xml).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &file).map_err(|e| e.to_string())
}

pub fn escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

#[cfg(any(target_os = "windows", test))]
pub mod windows {
    use super::escape;
    use std::collections::BTreeSet;
    use std::path::PathBuf;

    pub fn config_home(var: impl Fn(&str) -> Option<String>) -> Option<PathBuf> {
        let set = |key: &str| var(key).filter(|v| !v.is_empty());
        if let Some(dir) = set("XDG_CONFIG_HOME") {
            return Some(PathBuf::from(dir));
        }
        let home = set("HOME").or_else(|| set("USERPROFILE"))?;
        Some(PathBuf::from(home).join(".config"))
    }

    pub fn data_home(var: impl Fn(&str) -> Option<String>) -> Option<PathBuf> {
        let set = |key: &str| var(key).filter(|v| !v.is_empty());
        if let Some(dir) = set("XDG_DATA_HOME") {
            return Some(PathBuf::from(dir));
        }
        let home = set("HOME").or_else(|| set("USERPROFILE"))?;
        Some(PathBuf::from(home).join(".local").join("share"))
    }

    pub fn dos_path(path: &str) -> String {
        let path = path.strip_prefix(r"\\?\").unwrap_or(path);
        let mut chars = path.chars();
        let mut out = String::with_capacity(path.len());
        let mut last = '\0';
        if let Some(first) = chars.next() {
            if first == '\\' {
                out.push('/');
            } else {
                out.push(first);
                last = first;
            }
        }
        for c in chars {
            let c = if c == '\\' { '/' } else { c };
            if c != '/' || last != '/' {
                out.push(c);
            }
            last = c;
        }
        out
    }

    fn parent(path: &str) -> Option<&str> {
        let dir = &path[..path.rfind('/')?];
        let (rest, needed) = match dir.strip_prefix("//") {
            Some(unc) => (unc, 3),
            None => (dir.split_once(':').map_or(dir, |(_, rest)| rest), 1),
        };
        let segments = rest.split('/').filter(|s| !s.is_empty()).count();
        (segments >= needed).then_some(dir)
    }

    fn inside(path: &str, dir: &str) -> bool {
        let path = path.to_lowercase();
        let dir = dir.to_lowercase();
        path.len() > dir.len() && path.starts_with(&dir) && path.as_bytes()[dir.len()] == b'/'
    }

    pub fn windows_fragment(visible: &[String], hidden: &[String]) -> Option<String> {
        let files: BTreeSet<String> = visible.iter().map(|p| dos_path(p)).collect();
        let parents: BTreeSet<String> = files.iter().filter_map(|f| parent(f)).map(str::to_string).collect();
        let roots: Vec<&String> = parents
            .iter()
            .filter(|d| !parents.iter().any(|other| inside(d, other)))
            .collect();
        let mut accepted: BTreeSet<String> = BTreeSet::new();
        for file in &files {
            let Some(root) = roots.iter().find(|r| inside(file, r)) else {
                continue;
            };
            accepted.insert(file.clone());
            let mut dir = file.as_str();
            while let Some(end) = dir.rfind('/') {
                dir = &dir[..end];
                if dir.len() <= root.len() {
                    break;
                }
                accepted.insert(dir.to_string());
            }
        }
        let hidden: BTreeSet<String> = hidden
            .iter()
            .map(|p| dos_path(p))
            .filter(|h| !files.contains(h))
            .collect();
        if roots.is_empty() && hidden.is_empty() {
            return None;
        }

        let mut xml = String::from(
            "<?xml version=\"1.0\"?>\n<!DOCTYPE fontconfig SYSTEM \"fonts.dtd\">\n<fontconfig>\n",
        );
        for root in &roots {
            xml.push_str(&format!("  <dir>{}</dir>\n", escape(root)));
        }
        xml.push_str("  <selectfont>\n    <rejectfont>\n");
        for root in &roots {
            xml.push_str(&format!("      <glob>{}/*</glob>\n", escape(root)));
        }
        for path in &hidden {
            xml.push_str(&format!("      <glob>{}</glob>\n", escape(path)));
        }
        xml.push_str("    </rejectfont>\n");
        if !accepted.is_empty() {
            xml.push_str("    <acceptfont>\n");
            for path in &accepted {
                xml.push_str(&format!("      <glob>{}</glob>\n", escape(path)));
            }
            xml.push_str("    </acceptfont>\n");
        }
        xml.push_str("  </selectfont>\n</fontconfig>\n");
        Some(xml)
    }
}

#[cfg(test)]
mod tests {
    use super::windows::*;
    use super::*;
    use std::path::PathBuf;

    fn vars<'a>(pairs: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<String> + 'a {
        move |key| pairs.iter().find(|(k, _)| *k == key).map(|(_, v)| v.to_string())
    }

    #[test]
    fn config_home_follows_fontconfig_on_windows() {
        let env = [("USERPROFILE", r"C:\Users\Ana")];
        assert_eq!(config_home(vars(&env)), Some(PathBuf::from(r"C:\Users\Ana").join(".config")));
        let env = [("USERPROFILE", r"C:\Users\Ana"), ("HOME", r"D:\home")];
        assert_eq!(config_home(vars(&env)), Some(PathBuf::from(r"D:\home").join(".config")));
        let env = [("USERPROFILE", r"C:\Users\Ana"), ("XDG_CONFIG_HOME", r"E:\cfg"), ("HOME", "")];
        assert_eq!(config_home(vars(&env)), Some(PathBuf::from(r"E:\cfg")));
        assert_eq!(config_home(vars(&[])), None);
        let env = [("USERPROFILE", r"C:\Users\Ana")];
        assert_eq!(
            data_home(vars(&env)),
            Some(PathBuf::from(r"C:\Users\Ana").join(".local").join("share"))
        );
    }

    #[test]
    fn paths_are_written_the_way_fontconfig_stores_them() {
        assert_eq!(dos_path(r"D:\Fonts\Poppins-Regular.ttf"), "D:/Fonts/Poppins-Regular.ttf");
        assert_eq!(dos_path(r"\\?\D:\Fonts\a.ttf"), "D:/Fonts/a.ttf");
        assert_eq!(dos_path(r"D:\Fonts\\sub\a.ttf"), "D:/Fonts/sub/a.ttf");
        assert_eq!(dos_path(r"\\server\share\a.ttf"), "//server/share/a.ttf");
    }

    #[test]
    fn active_fonts_outside_known_folders_are_added_alone() {
        let visible = [
            r"D:\Fonts\Watched\Poppins-Regular.ttf".to_string(),
            r"D:\Fonts\Watched\sub\Poppins-Bold.ttf".to_string(),
        ];
        let xml = windows_fragment(&visible, &[]).unwrap();
        assert_eq!(xml.matches("<dir>").count(), 1);
        assert!(xml.contains("<dir>D:/Fonts/Watched</dir>"));
        assert!(xml.contains("<glob>D:/Fonts/Watched/*</glob>"));
        assert!(xml.contains("<acceptfont>"));
        assert!(xml.contains("<glob>D:/Fonts/Watched/Poppins-Regular.ttf</glob>"));
        assert!(xml.contains("<glob>D:/Fonts/Watched/sub/Poppins-Bold.ttf</glob>"));
        assert!(xml.contains("<glob>D:/Fonts/Watched/sub</glob>"));
        assert!(!xml.contains("<glob>D:/Fonts/Watched</glob>"));
    }

    #[test]
    fn deactivated_fonts_are_hidden() {
        let hidden = [r"C:\Users\Ana\AppData\Local\Microsoft\Windows\Fonts\Lato-Black.ttf".to_string()];
        let xml = windows_fragment(&[], &hidden).unwrap();
        assert!(!xml.contains("<dir>"));
        assert!(!xml.contains("<acceptfont>"));
        assert!(xml.contains("<glob>C:/Users/Ana/AppData/Local/Microsoft/Windows/Fonts/Lato-Black.ttf</glob>"));
    }

    #[test]
    fn whole_drives_are_never_added() {
        assert!(windows_fragment(&[r"D:\Font.ttf".to_string()], &[]).is_none());
        assert!(windows_fragment(&[r"\\server\share\Font.ttf".to_string()], &[]).is_none());
        let xml = windows_fragment(&[r"\\server\share\Fonts\a.ttf".to_string()], &[]).unwrap();
        assert!(xml.contains("<dir>//server/share/Fonts</dir>"));
    }

    #[test]
    fn nothing_to_say_means_no_file() {
        assert!(windows_fragment(&[], &[]).is_none());
    }

    #[test]
    fn special_characters_stay_valid_xml() {
        let xml = windows_fragment(&[r"D:\R&D <fonts>\a.ttf".to_string()], &[]).unwrap();
        assert!(xml.contains("<dir>D:/R&amp;D &lt;fonts&gt;</dir>"));
    }

    #[test]
    fn writing_nothing_removes_the_file() {
        let dir = std::env::temp_dir().join(format!("zfm-fontconf-{}", std::process::id()));
        write_fragment(&dir, Some("<fontconfig/>")).unwrap();
        assert!(dir.join(FRAGMENT).exists());
        write_fragment(&dir, None).unwrap();
        assert!(!dir.join(FRAGMENT).exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
