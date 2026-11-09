use crate::store::AppState;
use std::collections::{HashMap, HashSet};
use std::ffi::{OsStr, OsString};
use std::fs;
use std::path::{Path, PathBuf};

pub fn dir() -> PathBuf {
    crate::scanner::managed_font_dir()
}

pub fn applies(state: &AppState, path: &str) -> bool {
    if state.linked.contains(path) {
        return false;
    }
    let file = Path::new(path);
    state.extra_dirs.iter().any(|d| file.starts_with(d)) && !crate::scanner::seen_by_system(file)
}

pub struct Aliases {
    dir: PathBuf,
    targets: HashMap<PathBuf, Vec<PathBuf>>,
    names: HashSet<OsString>,
}

impl Aliases {
    pub fn read(dir: &Path) -> Self {
        let mut aliases = Self {
            dir: dir.to_path_buf(),
            targets: HashMap::new(),
            names: HashSet::new(),
        };
        let Ok(entries) = fs::read_dir(dir) else {
            return aliases;
        };
        for entry in entries.filter_map(Result::ok) {
            aliases.names.insert(entry.file_name());
            let alias = entry.path();
            let Ok(target) = fs::read_link(&alias) else {
                continue;
            };
            let target = if target.is_absolute() { target } else { dir.join(target) };
            if let Ok(real) = fs::canonicalize(&target) {
                if real != target {
                    aliases.targets.entry(real).or_default().push(alias.clone());
                }
            }
            aliases.targets.entry(target).or_default().push(alias);
        }
        aliases
    }

    fn find(&self, source: &Path) -> Vec<PathBuf> {
        let mut found = self.targets.get(source).cloned().unwrap_or_default();
        if let Ok(real) = fs::canonicalize(source) {
            for alias in self.targets.get(&real).into_iter().flatten() {
                if !found.contains(alias) {
                    found.push(alias.clone());
                }
            }
        }
        found
    }

    pub fn contains(&self, source: &Path) -> bool {
        self.targets.contains_key(source)
            || fs::canonicalize(source).is_ok_and(|real| self.targets.contains_key(&real))
    }

    pub fn set(&mut self, source: &Path, active: bool) -> Result<(), String> {
        if active {
            self.link(source)
        } else {
            self.unlink(source)
        }
    }

    fn link(&mut self, source: &Path) -> Result<(), String> {
        if self.contains(source) {
            return Ok(());
        }
        if !source.is_file() {
            return Err(format!("font file not found: {}", source.display()));
        }
        let name = source.file_name().ok_or("invalid font path")?;
        let alias = self.free_name(name);
        fs::create_dir_all(&self.dir).map_err(|e| e.to_string())?;
        std::os::unix::fs::symlink(source, &alias).map_err(|e| e.to_string())?;
        if let Some(name) = alias.file_name() {
            self.names.insert(name.to_os_string());
        }
        self.targets.entry(source.to_path_buf()).or_default().push(alias);
        Ok(())
    }

    fn taken(&self, name: &OsStr) -> bool {
        self.names.contains(name) || fs::symlink_metadata(self.dir.join(name)).is_ok()
    }

    fn free_name(&self, name: &OsStr) -> PathBuf {
        if !self.taken(name) {
            return self.dir.join(name);
        }
        let file = Path::new(name);
        let stem = file.file_stem().unwrap_or(name);
        let mut n = 2;
        loop {
            let mut candidate = stem.to_os_string();
            candidate.push(format!("-{n}"));
            if let Some(ext) = file.extension() {
                candidate.push(".");
                candidate.push(ext);
            }
            if !self.taken(&candidate) {
                return self.dir.join(candidate);
            }
            n += 1;
        }
    }

    fn unlink(&mut self, source: &Path) -> Result<(), String> {
        for alias in self.find(source) {
            match fs::remove_file(&alias) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(e.to_string()),
            }
            if let Some(name) = alias.file_name() {
                self.names.remove(name);
            }
        }
        self.targets.retain(|_, list| {
            list.retain(|alias| fs::symlink_metadata(alias).is_ok());
            !list.is_empty()
        });
        Ok(())
    }

    pub fn prune(&mut self, owned: impl Fn(&Path) -> bool) -> usize {
        let broken: Vec<PathBuf> = self
            .targets
            .iter()
            .filter(|(target, _)| owned(target) && fs::metadata(target).is_err())
            .flat_map(|(_, list)| list.iter().cloned())
            .collect();
        let mut removed = 0;
        for alias in broken {
            if fs::remove_file(&alias).is_ok() {
                removed += 1;
                if let Some(name) = alias.file_name() {
                    self.names.remove(name);
                }
            }
        }
        self.targets.retain(|_, list| {
            list.retain(|alias| fs::symlink_metadata(alias).is_ok());
            !list.is_empty()
        });
        removed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("zfm-aliases-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn switching_on_and_off_adds_and_removes_one_link() {
        let tmp = temp("toggle");
        let watched = tmp.join("watched/Client");
        fs::create_dir_all(&watched).unwrap();
        let font = watched.join("Poppins-Regular.ttf");
        fs::write(&font, b"font").unwrap();
        let fonts = tmp.join("fonts");

        let mut aliases = Aliases::read(&fonts);
        assert!(!aliases.contains(&font));
        aliases.set(&font, true).unwrap();
        aliases.set(&font, true).unwrap();
        let alias = fonts.join("Poppins-Regular.ttf");
        assert_eq!(fs::read_link(&alias).unwrap(), font);
        assert_eq!(fs::read_dir(&fonts).unwrap().count(), 1);

        let reread = Aliases::read(&fonts);
        assert!(reread.contains(&font));

        let mut reread = reread;
        reread.set(&font, false).unwrap();
        assert!(fs::symlink_metadata(&alias).is_err());
        assert!(font.is_file());
        assert!(!Aliases::read(&fonts).contains(&font));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn same_file_names_never_replace_each_other() {
        let tmp = temp("names");
        let fonts = tmp.join("fonts");
        fs::create_dir_all(&fonts).unwrap();
        let own = fonts.join("Inter.ttf");
        fs::write(&own, b"mine").unwrap();
        let a = tmp.join("a/Inter.ttf");
        let b = tmp.join("b/Inter.ttf");
        for f in [&a, &b] {
            fs::create_dir_all(f.parent().unwrap()).unwrap();
            fs::write(f, b"font").unwrap();
        }

        let mut aliases = Aliases::read(&fonts);
        aliases.set(&a, true).unwrap();
        aliases.set(&b, true).unwrap();
        assert_eq!(fs::read(&own).unwrap(), b"mine");
        assert_eq!(fs::read_link(fonts.join("Inter-2.ttf")).unwrap(), a);
        assert_eq!(fs::read_link(fonts.join("Inter-3.ttf")).unwrap(), b);

        aliases.set(&a, false).unwrap();
        assert!(fs::symlink_metadata(fonts.join("Inter-2.ttf")).is_err());
        assert!(fonts.join("Inter-3.ttf").exists());
        assert!(own.is_file());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn missing_files_are_not_linked_and_broken_links_are_pruned() {
        let tmp = temp("prune");
        let fonts = tmp.join("fonts");
        let watched = tmp.join("watched");
        fs::create_dir_all(&watched).unwrap();
        let gone = watched.join("Gone.otf");
        let mut aliases = Aliases::read(&fonts);
        assert!(aliases.set(&gone, true).is_err());

        fs::write(&gone, b"font").unwrap();
        aliases.set(&gone, true).unwrap();
        let elsewhere = tmp.join("Elsewhere.otf");
        fs::write(&elsewhere, b"font").unwrap();
        aliases.set(&elsewhere, true).unwrap();
        fs::remove_file(&gone).unwrap();
        fs::remove_file(&elsewhere).unwrap();

        let mut aliases = Aliases::read(&fonts);
        assert_eq!(aliases.prune(|target| target.starts_with(&watched)), 1);
        assert!(fs::symlink_metadata(fonts.join("Gone.otf")).is_err());
        assert!(fs::symlink_metadata(fonts.join("Elsewhere.otf")).is_ok());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn only_watched_fonts_outside_the_font_folders_need_a_link() {
        let mut state = AppState::default();
        let watched = std::env::temp_dir().join("zfm-watched-applies");
        state.extra_dirs.push(watched.to_string_lossy().into_owned());
        let inside = watched.join("Sub/Font.ttf").to_string_lossy().into_owned();
        assert!(applies(&state, &inside));
        assert!(!applies(&state, "/somewhere/else/Font.ttf"));
        state.linked.insert(inside.clone());
        assert!(!applies(&state, &inside));

        let home = dirs::home_dir().unwrap();
        #[cfg(target_os = "linux")]
        let visible = home.join(".local/share/fonts/Watched");
        #[cfg(target_os = "macos")]
        let visible = home.join("Library/Fonts/Watched");
        state.extra_dirs.push(visible.to_string_lossy().into_owned());
        assert!(!applies(&state, &visible.join("Font.ttf").to_string_lossy()));
    }
}
