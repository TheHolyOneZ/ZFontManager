use super::{catalogue_path, now_secs, online_dir, Catalogue, CatalogueFamily, CatalogueResponse, CACHE_MAX_AGE_SECS};
use crate::net;
use serde::Deserialize;
use std::fs;

pub const LIST_URL: &str = "https://api.fontsource.org/v1/fonts";

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

#[cfg(test)]
mod tests {
    use super::*;

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
