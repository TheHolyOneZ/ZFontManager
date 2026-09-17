use super::{
    fontsource, license_file_name, license_info, licenses_dir, metadata_pb, slug_from_id, spdx_for_dir,
    staging_dir, DownloadProgress, DownloadResult, FamilyDetail,
};
use crate::net;
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

pub const RAW_BASE: &str = "https://raw.githubusercontent.com/google/fonts/main";

const DIRS: [&str; 3] = ["ofl", "apache", "ufl"];

fn encode_segment(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        let keep = b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b'_' | b'~');
        if keep {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

pub fn family_url(dir: &str, slug: &str, file: &str) -> String {
    format!("{RAW_BASE}/{dir}/{slug}/{}", encode_segment(file))
}

fn dir_order(preferred: &str) -> Vec<&'static str> {
    let mut v: Vec<&'static str> = Vec::with_capacity(3);
    if let Some(p) = DIRS.iter().find(|d| **d == preferred) {
        v.push(p);
    }
    for d in DIRS {
        if !v.contains(&d) {
            v.push(d);
        }
    }
    v
}

async fn locate(client: &reqwest::Client, slug: &str, preferred_dir: &str) -> Result<(String, metadata_pb::PbFamily), String> {
    let mut last_err = String::new();
    for dir in dir_order(preferred_dir) {
        match net::get_text(client, &family_url(dir, slug, "METADATA.pb")).await {
            Ok(text) => {
                let parsed = metadata_pb::parse(&text)?;
                return Ok((dir.to_string(), parsed));
            }
            Err(e) => last_err = e,
        }
    }
    Err(format!("family '{slug}' not found in google/fonts ({last_err})"))
}

pub async fn detail(client: &reqwest::Client, id: &str) -> Result<FamilyDetail, String> {
    let cached = fontsource::cached_family(id).ok_or_else(|| format!("'{id}' is not in the catalogue cache"))?;
    let (preferred_dir, _, _) = license_info(&cached.license);
    let slug = slug_from_id(id);
    let (dir, pb) = locate(client, &slug, preferred_dir).await?;
    let spdx = spdx_for_dir(&dir);
    let (_, license_name, license_url) = license_info(spdx);
    let license_text = net::get_text(client, &family_url(&dir, &slug, license_file_name(&dir))).await?;
    let copyright = pb.fonts.first().map(|f| f.copyright.clone()).unwrap_or_default();
    let reserved = metadata_pb::reserved_font_name(&copyright);
    Ok(FamilyDetail {
        id: id.to_string(),
        family: pb.name,
        designer: pb.designer,
        category: cached.category,
        license: spdx.to_string(),
        license_name: license_name.to_string(),
        license_url: license_url.to_string(),
        reserved_font_name: reserved,
        copyright,
        files: pb.fonts,
        license_text,
        source_dir: dir,
    })
}

fn safe_name(filename: &str) -> Result<String, String> {
    PathBuf::from(filename)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| format!("bad filename in METADATA.pb: {filename}"))
}

async fn fetch_into_staging(
    client: &reqwest::Client,
    det: &FamilyDetail,
    slug: &str,
    file: &metadata_pb::PbFont,
) -> Result<PathBuf, String> {
    let stage = staging_dir().join(slug);
    fs::create_dir_all(&stage).map_err(|e| e.to_string())?;
    let dest = stage.join(safe_name(&file.filename)?);
    if let Ok(meta) = fs::metadata(&dest) {
        if meta.len() > 1024 {
            return Ok(dest);
        }
    }
    let bytes = net::get_bytes(client, &family_url(&det.source_dir, slug, &file.filename)).await?;
    if bytes.len() < 1024 {
        return Err(format!("{} came back suspiciously small ({} bytes)", file.filename, bytes.len()));
    }
    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    Ok(dest)
}

pub fn preview_face(det: &FamilyDetail) -> Option<&metadata_pb::PbFont> {
    det.files
        .iter()
        .find(|f| f.style == "normal" && f.weight == 400)
        .or_else(|| det.files.iter().find(|f| f.style == "normal"))
        .or_else(|| det.files.first())
}

pub async fn preview(client: &reqwest::Client, id: &str) -> Result<String, String> {
    let det = detail(client, id).await?;
    let face = preview_face(&det).ok_or("family lists no files")?;
    let slug = slug_from_id(id);
    let path = fetch_into_staging(client, &det, &slug, face).await?;
    Ok(path.to_string_lossy().into_owned())
}

pub async fn download(app: &tauri::AppHandle, client: &reqwest::Client, id: &str) -> Result<DownloadResult, String> {
    let det = detail(client, id).await?;
    let slug = slug_from_id(id);

    let mut seen = std::collections::HashSet::new();
    let files: Vec<&metadata_pb::PbFont> = det.files.iter().filter(|f| seen.insert(f.filename.clone())).collect();
    let total = files.len();
    let mut paths: Vec<String> = Vec::with_capacity(total);

    for (i, f) in files.iter().enumerate() {
        let _ = app.emit(
            "online:progress",
            DownloadProgress {
                id: id.to_string(),
                file: f.filename.clone(),
                done: i,
                total,
            },
        );
        let dest = fetch_into_staging(client, &det, &slug, f).await?;
        paths.push(dest.to_string_lossy().into_owned());
    }
    let _ = app.emit(
        "online:progress",
        DownloadProgress {
            id: id.to_string(),
            file: String::new(),
            done: total,
            total,
        },
    );

    fs::create_dir_all(licenses_dir()).map_err(|e| e.to_string())?;
    let license_path = licenses_dir().join(format!("{slug}.txt"));
    let header = format!(
        "{}\nDesigner: {}\nLicence: {} ({})\nSource: {RAW_BASE}/{}/{slug}/\n{}\n\n",
        det.family, det.designer, det.license_name, det.license, det.source_dir, det.copyright
    );
    fs::write(&license_path, format!("{header}{}", det.license_text)).map_err(|e| e.to_string())?;

    Ok(DownloadResult {
        family: det.family,
        paths,
        license_path: license_path.to_string_lossy().into_owned(),
    })
}

pub fn clear_staging(id: &str) {
    let _ = fs::remove_dir_all(staging_dir().join(slug_from_id(id)));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_brackets_and_spaces() {
        assert_eq!(encode_segment("Lora[wght].ttf"), "Lora%5Bwght%5D.ttf");
        assert_eq!(encode_segment("Open Sans.ttf"), "Open%20Sans.ttf");
        assert_eq!(encode_segment("Lora-Italic.ttf"), "Lora-Italic.ttf");
    }

    #[test]
    fn builds_urls() {
        assert_eq!(
            family_url("ofl", "lora", "Lora[wght].ttf"),
            "https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora%5Bwght%5D.ttf"
        );
    }

    #[test]
    fn preferred_dir_first() {
        assert_eq!(dir_order("apache"), vec!["apache", "ofl", "ufl"]);
        assert_eq!(dir_order("ofl"), vec!["ofl", "apache", "ufl"]);
        assert_eq!(dir_order("bogus"), vec!["ofl", "apache", "ufl"]);
    }
}
