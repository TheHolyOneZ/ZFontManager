use super::{
    github::encode_segment, licenses_dir, now_secs, online_dir, slug_from_id, staging_dir, DownloadProgress,
    DownloadResult, CACHE_MAX_AGE_SECS,
};
use crate::font_types::FontSource;
use crate::{net, parser};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const REPO_URL: &str = "https://github.com/ryanoasis/nerd-fonts";
const RAW_BASE: &str = "https://raw.githubusercontent.com/ryanoasis/nerd-fonts";
const ARCHIVE_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const MAX_LICENSE_BYTES: u64 = 256 * 1024;
const PROGRESS_STEP: u64 = 512 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestFont {
    unpatched_name: String,
    license_id: String,
    #[serde(rename = "RFN", default)]
    rfn: bool,
    #[serde(default)]
    version: String,
    patched_name: String,
    folder_name: String,
    #[serde(default)]
    image_preview_font_source: String,
    #[serde(default)]
    is_monospaced: bool,
    #[serde(default)]
    description: String,
}

#[derive(Deserialize)]
struct Manifest {
    fonts: Vec<ManifestFont>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NerdFamily {
    pub id: String,
    pub family: String,
    pub patched_name: String,
    pub original: String,
    pub description: String,
    pub license: String,
    pub license_name: String,
    pub license_short: String,
    pub reserved_name: bool,
    pub monospaced: bool,
    pub version: String,
    pub preview_source: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NerdCatalogue {
    pub fetched_at: u64,
    pub release: String,
    pub families: Vec<NerdFamily>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NerdCatalogueResponse {
    pub fetched_at: u64,
    pub from_cache: bool,
    pub release: String,
    pub families: Vec<NerdFamily>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Variant {
    Standard,
    Mono,
    Propo,
}

impl Variant {
    pub fn parse(s: &str) -> Result<Self, String> {
        match s {
            "standard" => Ok(Self::Standard),
            "mono" => Ok(Self::Mono),
            "propo" => Ok(Self::Propo),
            other => Err(format!("unknown Nerd Font variant: {other}")),
        }
    }

    fn of(file_name: &str) -> Self {
        if file_name.contains("NerdFontMono") {
            Self::Mono
        } else if file_name.contains("NerdFontPropo") {
            Self::Propo
        } else {
            Self::Standard
        }
    }
}

fn cache_path() -> PathBuf {
    online_dir().join("nerd-catalogue.json")
}

fn read_cache() -> Option<NerdCatalogue> {
    let bytes = fs::read(cache_path()).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn write_cache(cat: &NerdCatalogue) -> Result<(), String> {
    fs::create_dir_all(online_dir()).map_err(|e| e.to_string())?;
    let tmp = cache_path().with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec(cat).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, cache_path()).map_err(|e| e.to_string())
}

fn valid_tag(tag: &str) -> bool {
    tag.len() <= 64
        && tag.starts_with(|c: char| c.is_ascii_alphanumeric())
        && tag.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

fn tag_from_location(location: &str) -> Option<String> {
    let tag = location.split("/releases/tag/").nth(1)?.split(['?', '#', '/']).next()?;
    valid_tag(tag).then(|| tag.to_string())
}

fn license_atom(spdx: &str) -> (&str, &str) {
    match spdx {
        "OFL-1.1-RFN" | "OFL-1.1-no-RFN" | "OFL-1.1" => ("SIL Open Font License 1.1", "OFL"),
        "MIT" => ("MIT License", "MIT"),
        "Apache-2.0" => ("Apache License 2.0", "Apache"),
        "Bitstream-Vera" => ("Bitstream Vera License", "Bitstream"),
        "LicenseRef-UbuntuFont" => ("Ubuntu Font Licence 1.0", "UFL"),
        "BSD-3-Clause" => ("BSD 3-Clause License", "BSD"),
        "BSD-3-Clause-Clear" => ("BSD 3-Clause Clear License", "BSD"),
        "CC-BY-SA-4.0" => ("Creative Commons BY-SA 4.0", "CC BY-SA"),
        "WTFPL" => ("WTFPL", "WTFPL"),
        "LGPL-2.1-only" => ("GNU LGPL 2.1", "LGPL"),
        "LicenseRef-VicFieger" => ("Vic Fieger freeware licence", "Freeware"),
        "LicenseRef-Monofur" => ("Monofur freeware licence", "Freeware"),
        other => (other, other),
    }
}

pub fn license_names(spdx: &str) -> (String, String) {
    let mut names = Vec::new();
    let mut shorts: Vec<&str> = Vec::new();
    let mut joiners = Vec::new();
    for token in spdx.split_whitespace() {
        match token.to_ascii_uppercase().as_str() {
            "AND" => joiners.push(" and "),
            "OR" => joiners.push(" or "),
            _ => {
                let (name, short) = license_atom(token);
                names.push(name.to_string());
                if !shorts.contains(&short) {
                    shorts.push(short);
                }
            }
        }
    }
    let mut long = String::new();
    for (i, name) in names.iter().enumerate() {
        if i > 0 {
            long.push_str(joiners.get(i - 1).copied().unwrap_or(" / "));
        }
        long.push_str(name);
    }
    (long, shorts.join(" / "))
}

fn build(manifest: &str, sums: &str) -> Result<Vec<NerdFamily>, String> {
    let manifest: Manifest = serde_json::from_str(manifest).map_err(|e| e.to_string())?;
    let sums: HashMap<&str, &str> = sums
        .lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let hash = parts.next()?;
            let name = parts.next()?;
            (hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit())).then_some((name, hash))
        })
        .collect();
    let mut out: Vec<NerdFamily> = manifest
        .fonts
        .into_iter()
        .filter_map(|f| {
            let sha = sums.get(format!("{}.tar.xz", f.folder_name).as_str())?;
            let (license_name, license_short) = license_names(&f.license_id);
            Some(NerdFamily {
                family: format!("{} Nerd Font", f.patched_name),
                id: f.folder_name,
                patched_name: f.patched_name,
                original: f.unpatched_name,
                description: f.description.replace('`', ""),
                license: f.license_id,
                license_name,
                license_short,
                reserved_name: f.rfn,
                monospaced: f.is_monospaced,
                version: f.version,
                preview_source: f.image_preview_font_source,
                sha256: sha.to_ascii_lowercase(),
            })
        })
        .collect();
    out.sort_by_key(|f| f.family.to_lowercase());
    Ok(out)
}

pub async fn catalogue(client: &reqwest::Client, force: bool) -> Result<NerdCatalogueResponse, String> {
    if !force {
        if let Some(cached) = read_cache() {
            if now_secs().saturating_sub(cached.fetched_at) < CACHE_MAX_AGE_SECS && !cached.families.is_empty() {
                return Ok(NerdCatalogueResponse {
                    fetched_at: cached.fetched_at,
                    from_cache: true,
                    release: cached.release,
                    families: cached.families,
                });
            }
        }
    }
    let location = net::redirect_target(client, &format!("{REPO_URL}/releases/latest")).await?;
    let release = tag_from_location(&location).ok_or_else(|| format!("couldn't read the release from {location}"))?;
    let manifest = net::get_text(client, &format!("{RAW_BASE}/{release}/bin/scripts/lib/fonts.json")).await?;
    let sums = net::get_following(client, &format!("{REPO_URL}/releases/download/{release}/SHA-256.txt"), None)
        .await?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let families = build(&manifest, &sums)?;
    if families.is_empty() {
        return Err("the Nerd Fonts catalogue came back empty".to_string());
    }
    let cat = NerdCatalogue {
        fetched_at: now_secs(),
        release,
        families,
    };
    write_cache(&cat)?;
    Ok(NerdCatalogueResponse {
        fetched_at: cat.fetched_at,
        from_cache: false,
        release: cat.release,
        families: cat.families,
    })
}

fn cached_family(id: &str) -> Result<(String, NerdFamily), String> {
    let cat = read_cache().ok_or("the Nerd Fonts catalogue isn't loaded")?;
    let fam = cat
        .families
        .into_iter()
        .find(|f| f.id == id)
        .ok_or_else(|| format!("'{id}' is not in the Nerd Fonts catalogue"))?;
    Ok((cat.release, fam))
}

fn stage_dir(id: &str) -> PathBuf {
    staging_dir().join(format!("nerd-{}", slug_from_id(id)))
}

fn encode_path(path: &str) -> String {
    path.split('/').filter(|s| !s.is_empty()).map(encode_segment).collect::<Vec<_>>().join("/")
}

pub async fn preview(client: &reqwest::Client, id: &str) -> Result<String, String> {
    let (release, fam) = cached_family(id)?;
    let name = Path::new(&fam.preview_source)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .filter(|n| parser::is_font_file(Path::new(n)))
        .ok_or("this family has no preview file")?;
    let dir = stage_dir(id).join("preview");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join(name);
    if fs::metadata(&dest).is_ok_and(|m| m.len() > 1024) {
        return Ok(dest.to_string_lossy().into_owned());
    }
    let url = format!("{RAW_BASE}/{release}/src/unpatched-fonts/{}", encode_path(&fam.preview_source));
    let bytes = net::get_bytes(client, &url).await?;
    if bytes.len() < 1024 {
        return Err(format!("{} came back suspiciously small ({} bytes)", fam.preview_source, bytes.len()));
    }
    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

fn file_sha256(path: &Path) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 16];
    loop {
        let n = file.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Some(format!("{:x}", hasher.finalize()))
}

fn emit(report: &(dyn Fn(DownloadProgress) + Send + Sync), id: &str, file: &str, done: u64, total: u64) {
    report(DownloadProgress {
        id: id.to_string(),
        file: file.to_string(),
        done: done as usize,
        total: total as usize,
        bytes: true,
    });
}

async fn fetch_archive(
    report: &(dyn Fn(DownloadProgress) + Send + Sync),
    client: &reqwest::Client,
    release: &str,
    fam: &NerdFamily,
    dest: &Path,
) -> Result<(), String> {
    let file_name = format!("{}.tar.xz", fam.id);
    let url = format!("{REPO_URL}/releases/download/{release}/{}", encode_segment(&file_name));
    let mut res = net::get_following(client, &url, Some(ARCHIVE_TIMEOUT)).await?;
    let total = res.content_length().unwrap_or(0);
    let part = dest.with_extension("part");
    let mut out = fs::File::create(&part).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut done = 0u64;
    let mut reported = 0u64;
    emit(report, &fam.id, &file_name, 0, total);
    loop {
        let chunk = match res.chunk().await {
            Ok(Some(chunk)) => chunk,
            Ok(None) => break,
            Err(e) => {
                let _ = fs::remove_file(&part);
                return Err(e.to_string());
            }
        };
        if let Err(e) = out.write_all(&chunk) {
            let _ = fs::remove_file(&part);
            return Err(e.to_string());
        }
        hasher.update(&chunk);
        done += chunk.len() as u64;
        if done - reported >= PROGRESS_STEP {
            reported = done;
            emit(report, &fam.id, &file_name, done, total);
        }
    }
    out.flush().map_err(|e| e.to_string())?;
    drop(out);
    emit(report, &fam.id, &file_name, done, total.max(done));
    let digest = format!("{:x}", hasher.finalize());
    if digest != fam.sha256 {
        let _ = fs::remove_file(&part);
        return Err(format!(
            "{file_name} failed its checksum (expected {}, got {digest}); nothing was installed",
            fam.sha256
        ));
    }
    fs::rename(&part, dest).map_err(|e| e.to_string())
}

fn is_license_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("licen") || lower.starts_with("ofl") || lower.starts_with("copying")
}

struct Unpacked {
    paths: Vec<PathBuf>,
    licenses: Vec<(String, String)>,
}

fn unpack(archive: &Path, dest: &Path, wanted: &HashSet<Variant>) -> Result<Unpacked, String> {
    let file = fs::File::open(archive).map_err(|e| e.to_string())?;
    let mut tar = tar::Archive::new(xz2::read::XzDecoder::new(std::io::BufReader::new(file)));
    let mut paths = Vec::new();
    let mut licenses = Vec::new();
    let mut used = HashSet::new();
    for entry in tar.entries().map_err(|e| e.to_string())? {
        let mut entry = entry.map_err(|e| e.to_string())?;
        if !entry.header().entry_type().is_file() {
            continue;
        }
        let Some(name) = entry
            .path()
            .ok()
            .and_then(|p| p.file_name().and_then(|n| n.to_str()).map(str::to_owned))
        else {
            continue;
        };
        if parser::is_font_file(Path::new(&name)) {
            if !wanted.contains(&Variant::of(&name)) {
                continue;
            }
            let mut target = name.clone();
            let mut n = 1;
            while !used.insert(target.to_ascii_lowercase()) {
                target = format!("{n}-{name}");
                n += 1;
            }
            let out = dest.join(&target);
            let mut f = fs::File::create(&out).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;
            paths.push(out);
        } else if is_license_name(&name) && entry.header().size().unwrap_or(u64::MAX) <= MAX_LICENSE_BYTES {
            let mut text = String::new();
            if entry.read_to_string(&mut text).is_ok() {
                licenses.push((name, text));
            }
        }
    }
    Ok(Unpacked { paths, licenses })
}

fn families_of(paths: &[PathBuf]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for path in paths {
        for face in parser::parse_font_file(path, FontSource::User) {
            if seen.insert(face.family.clone()) {
                out.push(face.family);
            }
        }
    }
    out
}

fn license_record(release: &str, fam: &NerdFamily, licenses: &[(String, String)]) -> String {
    let mut text = format!(
        "{} (Nerd Fonts {release})\nPatched from: {} {}\nLicence: {} ({})\nSource: {REPO_URL}/releases/tag/{release}\nLicence files: {REPO_URL}/tree/{release}/patched-fonts/{}\n",
        fam.family, fam.original, fam.version, fam.license_name, fam.license, fam.id
    );
    for (name, body) in licenses {
        text.push_str(&format!("\n=== {name} ===\n\n{}\n", body.trim_end()));
    }
    text
}

pub async fn download(
    report: &(dyn Fn(DownloadProgress) + Send + Sync),
    client: &reqwest::Client,
    id: &str,
    variants: &[String],
) -> Result<DownloadResult, String> {
    let (release, fam) = cached_family(id)?;
    let wanted: HashSet<Variant> = variants.iter().map(|v| Variant::parse(v)).collect::<Result<_, _>>()?;
    if wanted.is_empty() {
        return Err("pick at least one variant".to_string());
    }
    let stage = stage_dir(id);
    fs::create_dir_all(&stage).map_err(|e| e.to_string())?;
    let archive = stage.join("archive.tar.xz");
    if file_sha256(&archive).as_deref() != Some(fam.sha256.as_str()) {
        fetch_archive(report, client, &release, &fam, &archive).await?;
    }
    let fonts_dir = stage.join("fonts");
    let _ = fs::remove_dir_all(&fonts_dir);
    fs::create_dir_all(&fonts_dir).map_err(|e| e.to_string())?;
    let (unpacked, families) = tauri::async_runtime::spawn_blocking(move || {
        let unpacked = unpack(&archive, &fonts_dir, &wanted)?;
        let families = families_of(&unpacked.paths);
        Ok::<_, String>((unpacked, families))
    })
    .await
    .map_err(|e| e.to_string())??;
    if unpacked.paths.is_empty() {
        return Err("the archive holds no fonts for the chosen variants".to_string());
    }

    fs::create_dir_all(licenses_dir()).map_err(|e| e.to_string())?;
    let license_path = licenses_dir().join(format!("nerd-{}.txt", slug_from_id(id)));
    fs::write(&license_path, license_record(&release, &fam, &unpacked.licenses)).map_err(|e| e.to_string())?;

    Ok(DownloadResult {
        family: families.first().cloned().unwrap_or_else(|| fam.family.clone()),
        families,
        paths: unpacked.paths.iter().map(|p| p.to_string_lossy().into_owned()).collect(),
        license_path: license_path.to_string_lossy().into_owned(),
    })
}

pub fn clear_staging(id: &str) {
    let _ = fs::remove_dir_all(stage_dir(id));
}

#[cfg(test)]
mod tests {
    use super::*;

    const MANIFEST: &str = r#"{"fonts":[
      {"unpatchedName":"Hack","licenseId":"Bitstream-Vera AND MIT","RFN":false,"version":"3.003","patchedName":"Hack","folderName":"Hack","imagePreviewFontSource":"Hack/Regular/Hack-Regular.ttf","isMonospaced":true,"description":"`Dotted` zero"},
      {"unpatchedName":"Source Code Pro","licenseId":"OFL-1.1-RFN","RFN":true,"version":"2.042","patchedName":"SauceCodePro","folderName":"SourceCodePro","imagePreviewFontSource":"SourceCodePro/SourceCodePro-Regular.ttf","isMonospaced":true,"description":"Monospaced"},
      {"unpatchedName":"Ghost","licenseId":"MIT","RFN":false,"version":"1","patchedName":"Ghost","folderName":"Ghost","imagePreviewFontSource":"Ghost/Ghost.ttf","isMonospaced":false,"description":""}
    ]}"#;

    const SUMS: &str = "CDD389472E10E2261520140FF1B382B4F8A226AF5FD0B2735B975D31151D9C3C  Hack.tar.xz\n\
        8951412356611266734e2e9904173d437b804af1ffce4fe1804feef4fe9c8c3b  Hack.zip\n\
        0be3de53807798fc5bdca90eb972225b0b3880bdd9b505121b3c06750a08b698  SourceCodePro.tar.xz\n";

    #[test]
    fn builds_catalogue_from_release_files() {
        let fams = build(MANIFEST, SUMS).unwrap();
        assert_eq!(fams.len(), 2, "families without a release archive are dropped");
        assert_eq!(fams[0].family, "Hack Nerd Font");
        assert_eq!(fams[0].sha256, "cdd389472e10e2261520140ff1b382b4f8a226af5fd0b2735b975d31151d9c3c");
        assert_eq!(fams[0].description, "Dotted zero");
        assert_eq!(fams[0].license_name, "Bitstream Vera License and MIT License");
        assert_eq!(fams[0].license_short, "Bitstream / MIT");
        assert_eq!(fams[1].family, "SauceCodePro Nerd Font");
        assert_eq!(fams[1].original, "Source Code Pro");
        assert!(fams[1].reserved_name);
    }

    #[test]
    fn licence_names() {
        assert_eq!(license_names("OFL-1.1-no-RFN"), ("SIL Open Font License 1.1".into(), "OFL".into()));
        assert_eq!(
            license_names("OFL-1.1-no-RFN or LGPL-2.1-only"),
            ("SIL Open Font License 1.1 or GNU LGPL 2.1".into(), "OFL / LGPL".into())
        );
        assert_eq!(license_names("LicenseRef-Monofur").1, "Freeware");
    }

    #[test]
    fn reads_release_tag() {
        assert_eq!(
            tag_from_location("https://github.com/ryanoasis/nerd-fonts/releases/tag/v3.5.1").as_deref(),
            Some("v3.5.1")
        );
        assert_eq!(tag_from_location("https://github.com/ryanoasis/nerd-fonts/releases"), None);
        assert_eq!(tag_from_location("https://github.com/x/releases/tag/../../evil"), None);
    }

    #[test]
    fn variants_from_file_names() {
        assert_eq!(Variant::of("HackNerdFont-Regular.ttf"), Variant::Standard);
        assert_eq!(Variant::of("HackNerdFontMono-Bold.ttf"), Variant::Mono);
        assert_eq!(Variant::of("HackNerdFontPropo-Italic.ttf"), Variant::Propo);
        assert!(Variant::parse("bogus").is_err());
    }

    #[test]
    fn unpacks_only_wanted_variants_and_keeps_licences() {
        let tmp = std::env::temp_dir().join(format!("zfm-nerd-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(tmp.join("out")).unwrap();
        let archive = tmp.join("a.tar.xz");
        {
            let enc = xz2::write::XzEncoder::new(fs::File::create(&archive).unwrap(), 1);
            let mut b = tar::Builder::new(enc);
            for (name, body) in [
                ("HackNerdFont-Regular.ttf", "font-a"),
                ("HackNerdFontMono-Regular.ttf", "font-b"),
                ("HackNerdFontPropo-Regular.ttf", "font-c"),
                ("LICENSE.md", "licence text"),
                ("README.md", "readme"),
            ] {
                let mut h = tar::Header::new_gnu();
                h.set_size(body.len() as u64);
                h.set_mode(0o644);
                h.set_cksum();
                b.append_data(&mut h, name, body.as_bytes()).unwrap();
            }
            b.into_inner().unwrap().finish().unwrap();
        }
        let wanted: HashSet<Variant> = [Variant::Standard, Variant::Mono].into();
        let out = unpack(&archive, &tmp.join("out"), &wanted).unwrap();
        let mut names: Vec<String> = out
            .paths
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        names.sort();
        assert_eq!(names, ["HackNerdFont-Regular.ttf", "HackNerdFontMono-Regular.ttf"]);
        assert_eq!(out.licenses, vec![("LICENSE.md".to_string(), "licence text".to_string())]);
        assert_eq!(file_sha256(&archive).map(|s| s.len()), Some(64));
        let _ = fs::remove_dir_all(&tmp);
    }
}

#[cfg(test)]
mod live {
    use super::*;
    use crate::store::AppState;

    #[test]
    #[ignore]
    fn live_catalogue_preview_and_hack_download() {
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(async {
            let mut st = AppState::default();
            st.online_fonts_enabled = true;
            let client = net::client(&st).expect("client");

            let cat = catalogue(&client, true).await.expect("catalogue");
            assert!(cat.release.starts_with('v'), "release {}", cat.release);
            assert!(cat.families.len() >= 60, "only {} families", cat.families.len());
            let hack = cat.families.iter().find(|f| f.id == "Hack").expect("Hack listed");
            assert_eq!(hack.family, "Hack Nerd Font");
            assert!(cat.families.iter().any(|f| f.id == "JetBrainsMono"));
            assert!(cat.families.iter().any(|f| f.id == "Noto"));
            assert!(cat.families.iter().any(|f| f.id == "SourceCodePro" && f.family == "SauceCodePro Nerd Font"));

            let preview_path = preview(&client, "Hack").await.expect("preview");
            let faces = parser::parse_font_file(Path::new(&preview_path), FontSource::User);
            assert_eq!(faces.first().map(|f| f.family.as_str()), Some("Hack"));

            let seen = std::sync::Mutex::new(Vec::new());
            let report = |p: DownloadProgress| seen.lock().unwrap().push((p.done, p.total, p.bytes));
            let res = download(&report, &client, "Hack", &["standard".into(), "mono".into()])
                .await
                .expect("download");
            assert_eq!(res.paths.len(), 8, "{:?}", res.paths);
            assert!(res.families.contains(&"Hack Nerd Font".to_string()), "{:?}", res.families);
            assert!(res.families.contains(&"Hack Nerd Font Mono".to_string()), "{:?}", res.families);
            assert!(!res.families.iter().any(|f| f.contains("Propo")));
            let licence = fs::read_to_string(&res.license_path).unwrap();
            assert!(licence.contains("=== LICENSE.md ==="), "{licence}");
            let progress = seen.lock().unwrap();
            let last = progress.last().copied().expect("progress reported");
            assert!(last.2 && last.0 == last.1 && last.0 > 1_000_000, "{last:?}");

            let again = download(&report, &client, "Hack", &["propo".into()]).await.expect("reuses archive");
            assert_eq!(again.paths.len(), 4);
            clear_staging("Hack");
            assert!(!stage_dir("Hack").exists());
        });
    }
}
