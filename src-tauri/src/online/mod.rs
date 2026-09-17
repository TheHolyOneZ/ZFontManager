pub mod fontsource;
pub mod github;
pub mod metadata_pb;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub const CACHE_MAX_AGE_SECS: u64 = 7 * 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueFamily {
    pub id: String,
    pub family: String,
    pub category: String,
    pub weights: Vec<u16>,
    pub styles: Vec<String>,
    pub subsets: Vec<String>,
    pub variable: bool,
    pub license: String,
    pub last_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalogue {
    pub fetched_at: u64,
    pub families: Vec<CatalogueFamily>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueResponse {
    pub fetched_at: u64,
    pub from_cache: bool,
    pub families: Vec<CatalogueFamily>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FamilyDetail {
    pub id: String,
    pub family: String,
    pub designer: String,
    pub category: String,
    pub license: String,
    pub license_name: String,
    pub license_url: String,
    pub reserved_font_name: Option<String>,
    pub copyright: String,
    pub files: Vec<metadata_pb::PbFont>,
    pub license_text: String,
    pub source_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub family: String,
    pub paths: Vec<String>,
    pub license_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub id: String,
    pub file: String,
    pub done: usize,
    pub total: usize,
}

pub fn online_dir() -> PathBuf {
    crate::store::app_data_dir().join("online")
}

pub fn catalogue_path() -> PathBuf {
    online_dir().join("catalogue.json")
}

pub fn licenses_dir() -> PathBuf {
    online_dir().join("licenses")
}

pub fn staging_dir() -> PathBuf {
    online_dir().join("staging")
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn license_info(spdx: &str) -> (&'static str, &'static str, &'static str) {
    match spdx {
        "OFL-1.1" => ("ofl", "SIL Open Font License 1.1", "https://openfontlicense.org/open-font-license-official-text/"),
        "Apache-2.0" => ("apache", "Apache License 2.0", "https://www.apache.org/licenses/LICENSE-2.0"),
        "UFL-1.0" => ("ufl", "Ubuntu Font Licence 1.0", "https://ubuntu.com/legal/font-licence"),
        _ => ("ofl", "SIL Open Font License 1.1", "https://openfontlicense.org/open-font-license-official-text/"),
    }
}

pub fn spdx_for_dir(dir: &str) -> &'static str {
    match dir {
        "apache" => "Apache-2.0",
        "ufl" => "UFL-1.0",
        _ => "OFL-1.1",
    }
}

pub fn license_file_name(dir: &str) -> &'static str {
    match dir {
        "apache" => "LICENSE.txt",
        "ufl" => "UFL.txt",
        _ => "OFL.txt",
    }
}

pub fn slug_from_id(id: &str) -> String {
    id.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_strips_hyphens() {
        assert_eq!(slug_from_id("open-sans"), "opensans");
        assert_eq!(slug_from_id("lora"), "lora");
        assert_eq!(slug_from_id("Noto-Sans-JP"), "notosansjp");
    }

    #[test]
    fn license_mapping() {
        assert_eq!(license_info("OFL-1.1").0, "ofl");
        assert_eq!(license_info("Apache-2.0").0, "apache");
        assert_eq!(license_info("UFL-1.0").0, "ufl");
        assert_eq!(license_file_name("apache"), "LICENSE.txt");
    }
}

#[cfg(test)]
mod live {
    use super::*;
    use crate::net;
    use crate::store::AppState;

    fn enabled_client() -> reqwest::Client {
        let mut st = AppState::default();
        st.online_fonts_enabled = true;
        net::client(&st).expect("client")
    }

    #[test]
    #[ignore]
    fn live_catalogue_then_lora_detail_then_one_file() {
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(async {
            let client = enabled_client();

            let cat = fontsource::catalogue(&client, true).await.expect("catalogue");
            assert!(cat.families.len() > 1500, "only {} families", cat.families.len());
            assert!(!cat.from_cache);
            assert!(cat.families.iter().any(|f| f.id == "lora"));
            assert!(cat.families.iter().any(|f| f.id == "open-sans"));
            assert!(cat.families.windows(2).all(|w| w[0].family.to_lowercase() <= w[1].family.to_lowercase()));
            assert!(cat.families.iter().all(|f| matches!(f.license.as_str(), "OFL-1.1" | "Apache-2.0" | "UFL-1.0")));

            let again = fontsource::catalogue(&client, false).await.expect("cached");
            assert!(again.from_cache);

            let det = github::detail(&client, "lora").await.expect("lora detail");
            assert_eq!(det.family, "Lora");
            assert_eq!(det.designer, "Cyreal");
            assert_eq!(det.license, "OFL-1.1");
            assert_eq!(det.source_dir, "ofl");
            assert_eq!(det.reserved_font_name.as_deref(), Some("Lora"));
            assert!(det.license_text.contains("SIL OPEN FONT LICENSE"));
            assert!(det.files.iter().any(|f| f.filename == "Lora[wght].ttf"));

            let os = github::detail(&client, "open-sans").await.expect("open-sans detail (hyphen slug)");
            assert_eq!(os.family, "Open Sans");

            let rob = github::detail(&client, "roboto").await.expect("roboto detail");
            assert_eq!(rob.source_dir, "ofl");
            assert_eq!(rob.license, "OFL-1.1");
            assert_eq!(rob.license_name, "SIL Open Font License 1.1");

            let slab = github::detail(&client, "roboto-slab").await.expect("roboto-slab detail (apache dir)");
            assert_eq!(slab.source_dir, "apache");
            assert_eq!(slab.license, "Apache-2.0");

            let ubuntu = github::detail(&client, "ubuntu").await.expect("ubuntu detail (ufl dir)");
            assert_eq!(ubuntu.source_dir, "ufl");
            assert_eq!(ubuntu.license, "UFL-1.0");

            let url = github::family_url(&det.source_dir, "lora", "Lora[wght].ttf");
            let bytes = net::get_bytes(&client, &url).await.expect("lora ttf");
            assert!(bytes.len() > 150_000, "lora variable ttf is {} bytes", bytes.len());
            assert_eq!(&bytes[..4], &[0, 1, 0, 0], "not a TrueType header");

            let face = github::preview_face(&det).expect("preview face");
            assert_eq!(face.style, "normal");
            assert_eq!(face.weight, 400);
            assert_eq!(face.filename, "Lora[wght].ttf");
            let p1 = github::preview(&client, "lora").await.expect("preview download");
            let m1 = std::fs::metadata(&p1).expect("preview file exists");
            assert!(m1.len() > 150_000);
            assert!(p1.ends_with("Lora[wght].ttf"));
            let before = std::fs::metadata(&p1).unwrap().modified().unwrap();
            let p2 = github::preview(&client, "lora").await.expect("second preview reuses staging");
            assert_eq!(p1, p2);
            assert_eq!(std::fs::metadata(&p2).unwrap().modified().unwrap(), before, "file was re-downloaded instead of reused");
            github::clear_staging("lora");
            assert!(!std::path::Path::new(&p1).exists());
        });
    }
}
