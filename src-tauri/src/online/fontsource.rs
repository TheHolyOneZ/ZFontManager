use super::{catalogue_path, now_secs, online_dir, Catalogue, CatalogueFamily, CatalogueResponse, CACHE_MAX_AGE_SECS};
use crate::net;
use serde::Deserialize;
use std::fs;

pub const LIST_URL: &str = "https://api.fontsource.org/v1/fonts";
pub const CDN_BASE: &str = "https://cdn.jsdelivr.net/fontsource/fonts";
const CARD_MAX_BYTES: usize = 2 * 1024 * 1024;

#[derive(Deserialize)]
struct ApiFamily {
    id: String,
    family: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    weights: Vec<u16>,
    #[serde(default)]
    styles: Vec<String>,
    #[serde(default)]
    subsets: Vec<String>,
    #[serde(default)]
    variable: bool,
    #[serde(default)]
    license: String,
    #[serde(default, rename = "lastModified")]
    last_modified: String,
    #[serde(default, rename = "type")]
    kind: String,
}

pub fn read_cache() -> Option<Catalogue> {
    let bytes = fs::read(catalogue_path()).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn write_cache(cat: &Catalogue) -> Result<(), String> {
    fs::create_dir_all(online_dir()).map_err(|e| e.to_string())?;
    let tmp = catalogue_path().with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec(cat).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, catalogue_path()).map_err(|e| e.to_string())
}

pub fn cache_is_fresh(cat: &Catalogue) -> bool {
    now_secs().saturating_sub(cat.fetched_at) < CACHE_MAX_AGE_SECS
}

pub fn parse_list(json: &str) -> Result<Vec<CatalogueFamily>, String> {
    let raw: Vec<ApiFamily> = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let mut out: Vec<CatalogueFamily> = raw
        .into_iter()
        .filter(|f| f.kind == "google")
        .filter(|f| matches!(f.license.as_str(), "OFL-1.1" | "Apache-2.0" | "UFL-1.0"))
        .map(|f| CatalogueFamily {
            id: f.id,
            family: f.family,
            category: f.category,
            weights: f.weights,
            styles: f.styles,
            subsets: f.subsets,
            variable: f.variable,
            license: f.license,
            last_modified: f.last_modified,
        })
        .collect();
    out.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
    Ok(out)
}

pub async fn catalogue(client: &reqwest::Client, force: bool) -> Result<CatalogueResponse, String> {
    if !force {
        if let Some(cached) = read_cache() {
            if cache_is_fresh(&cached) && !cached.families.is_empty() {
                return Ok(CatalogueResponse {
                    fetched_at: cached.fetched_at,
                    from_cache: true,
                    families: cached.families,
                });
            }
        }
    }
    let body = net::get_text(client, LIST_URL).await?;
    let families = parse_list(&body)?;
    if families.is_empty() {
        return Err("catalogue came back empty".to_string());
    }
    let cat = Catalogue {
        fetched_at: now_secs(),
        families,
    };
    write_cache(&cat)?;
    Ok(CatalogueResponse {
        fetched_at: cat.fetched_at,
        from_cache: false,
        families: cat.families,
    })
}

pub fn cached_family(id: &str) -> Option<CatalogueFamily> {
    read_cache()?.families.into_iter().find(|f| f.id == id)
}

pub fn cards_dir() -> std::path::PathBuf {
    online_dir().join("cards")
}

pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 100
        && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

pub fn card_file(f: &CatalogueFamily) -> Option<String> {
    if !f.subsets.iter().any(|s| s == "latin") {
        return None;
    }
    let weight = f
        .weights
        .iter()
        .copied()
        .min_by_key(|w| ((*w as i32 - 400).abs(), *w))
        .unwrap_or(400);
    let style = if f.styles.is_empty() || f.styles.iter().any(|s| s == "normal") {
        "normal"
    } else if f.styles.iter().any(|s| s == "italic") {
        "italic"
    } else {
        return None;
    };
    Some(format!("latin-{weight}-{style}.woff2"))
}

pub fn card_url(id: &str, file: &str) -> String {
    format!("{CDN_BASE}/{id}@latest/{file}")
}

pub async fn card_preview(client: &reqwest::Client, id: &str) -> Result<Vec<u8>, String> {
    if !valid_id(id) {
        return Err(format!("invalid font id: {id}"));
    }
    let path = cards_dir().join(format!("{id}.woff2"));
    if let Ok(bytes) = fs::read(&path) {
        if bytes.starts_with(b"wOF2") {
            return Ok(bytes);
        }
    }
    let family = cached_family(id).ok_or_else(|| format!("{id} isn't in the catalogue"))?;
    let file = card_file(&family).ok_or_else(|| format!("{id} has no Latin preview"))?;
    let bytes = net::get_bytes(client, &card_url(id, &file)).await?;
    if !bytes.starts_with(b"wOF2") || bytes.len() > CARD_MAX_BYTES {
        return Err(format!("{id}: the preview file isn't a usable font"));
    }
    fs::create_dir_all(cards_dir()).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("woff2.tmp");
    fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn family(weights: &[u16], styles: &[&str], subsets: &[&str]) -> CatalogueFamily {
        CatalogueFamily {
            id: "x".into(),
            family: "X".into(),
            category: "serif".into(),
            weights: weights.to_vec(),
            styles: styles.iter().map(|s| s.to_string()).collect(),
            subsets: subsets.iter().map(|s| s.to_string()).collect(),
            variable: false,
            license: "OFL-1.1".into(),
            last_modified: String::new(),
        }
    }

    #[test]
    fn card_previews_use_the_regular_latin_file() {
        assert_eq!(card_file(&family(&[300, 400, 700], &["normal", "italic"], &["latin", "greek"])).as_deref(), Some("latin-400-normal.woff2"));
        assert_eq!(card_file(&family(&[700, 900], &["normal"], &["latin"])).as_deref(), Some("latin-700-normal.woff2"));
        assert_eq!(card_file(&family(&[300, 500], &["normal"], &["latin"])).as_deref(), Some("latin-300-normal.woff2"));
        assert_eq!(card_file(&family(&[400], &["italic"], &["latin"])).as_deref(), Some("latin-400-italic.woff2"));
        assert_eq!(card_file(&family(&[], &[], &["latin"])).as_deref(), Some("latin-400-normal.woff2"));
        assert_eq!(card_file(&family(&[400], &["normal"], &["tamil"])), None);
        assert_eq!(
            card_url("noto-sans", "latin-400-normal.woff2"),
            "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-400-normal.woff2"
        );
        assert!(crate::net::check_host(&card_url("lora", "latin-400-normal.woff2")).is_ok());
    }

    #[test]
    fn card_ids_cannot_leave_the_cache_folder() {
        assert!(valid_id("noto-sans-jp"));
        assert!(valid_id("42dot-sans"));
        assert!(!valid_id("../catalogue"));
        assert!(!valid_id("a/b"));
        assert!(!valid_id("Lora"));
        assert!(!valid_id(""));
    }

    #[test]
    fn filters_to_google_and_known_licences() {
        let json = r#"[
          {"id":"lora","family":"Lora","category":"serif","weights":[400,700],"styles":["normal","italic"],"subsets":["latin"],"variable":true,"lastModified":"2025-01-01","license":"OFL-1.1","type":"google"},
          {"id":"other-font","family":"Other","category":"sans-serif","weights":[400],"styles":["normal"],"subsets":["latin"],"variable":false,"lastModified":"2025-01-01","license":"OFL-1.1","type":"other"},
          {"id":"weird","family":"Weird","category":"sans-serif","weights":[400],"styles":["normal"],"subsets":["latin"],"variable":false,"lastModified":"2025-01-01","license":"Unlicense","type":"google"},
          {"id":"abeezee","family":"ABeeZee","category":"sans-serif","weights":[400],"styles":["normal"],"subsets":["latin"],"variable":false,"lastModified":"2025-01-01","license":"OFL-1.1","type":"google"}
        ]"#;
        let out = parse_list(json).unwrap();
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].family, "ABeeZee");
        assert_eq!(out[1].family, "Lora");
        assert!(out[1].variable);
    }

    #[test]
    fn freshness() {
        let fresh = Catalogue { fetched_at: now_secs(), families: vec![] };
        assert!(cache_is_fresh(&fresh));
        let stale = Catalogue { fetched_at: now_secs() - CACHE_MAX_AGE_SECS - 1, families: vec![] };
        assert!(!cache_is_fresh(&stale));
    }
}
