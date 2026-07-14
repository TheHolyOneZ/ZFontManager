use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariationAxis {
    pub tag: String,
    pub min: f32,
    pub default: f32,
    pub max: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FontFormat {
    Otf,
    Ttf,
    Woff,
    Woff2,
    Unknown,
}


#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FontSource {

    System,

    User,

    Managed,
}


#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Classification {
    Serif,
    Sans,
    Mono,
    Display,
    Script,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FontFace {

    pub id: String,
    pub path: String,
    pub face_index: u32,
    pub family: String,
    pub style: String,
    pub postscript_name: Option<String>,
    pub foundry: Option<String>,
    pub license: Option<String>,
    pub license_url: Option<String>,
    pub format: FontFormat,
    pub is_variable: bool,
    pub axes: Vec<VariationAxis>,
    pub weight: u16,
    pub italic: bool,
    pub monospaced: bool,
    pub classification: Classification,

    pub scripts: Vec<String>,
    pub file_size: u64,
    pub source: FontSource,
    pub deactivatable: bool,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashEntry {
    pub id: String,
    pub original_path: String,
    pub trashed_path: String,
    pub family: String,
    pub trashed_at: u64,
}
