use crate::font_types::{Classification, FontFace, FontFormat, FontSource, VariationAxis};
use std::fs;
use std::path::Path;

const FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "ttc", "otc", "woff", "woff2"];

pub fn is_font_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| FONT_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn detect_format(data: &[u8], path: &Path) -> FontFormat {
    if data.len() >= 4 {
        match &data[0..4] {
            b"OTTO" => return FontFormat::Otf,
            [0x00, 0x01, 0x00, 0x00] | b"true" | b"ttcf" => return FontFormat::Ttf,
            b"wOFF" => return FontFormat::Woff,
            b"wOF2" => return FontFormat::Woff2,
            _ => {}
        }
    }
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("otf" | "otc") => FontFormat::Otf,
        Some("ttf" | "ttc") => FontFormat::Ttf,
        Some("woff") => FontFormat::Woff,
        Some("woff2") => FontFormat::Woff2,
        _ => FontFormat::Unknown,
    }
}

fn name_string(face: &ttf_parser::Face, id: u16) -> Option<String> {
    face.names()
        .into_iter()
        .filter(|n| n.name_id == id)
        .find_map(|n| n.to_string())
}


const SCRIPT_PROBES: &[(&str, &[u32])] = &[
    ("latin", &[0x0041, 0x007A]),
    ("cyrillic", &[0x0410, 0x044F]),
    ("greek", &[0x0391, 0x03C9]),
    ("arabic", &[0x0627, 0x0645]),
    ("hebrew", &[0x05D0, 0x05EA]),
    ("devanagari", &[0x0915, 0x093E]),
    ("thai", &[0x0E01, 0x0E32]),
    ("cjk", &[0x4E00, 0x3042]),
    ("korean", &[0xAC00, 0xD55C]),
    ("vietnamese", &[0x1EA1, 0x01B0]),
];

fn script_coverage(face: &ttf_parser::Face) -> Vec<String> {
    SCRIPT_PROBES
        .iter()
        .filter(|(_, probes)| {
            probes
                .iter()
                .all(|&cp| char::from_u32(cp).and_then(|c| face.glyph_index(c)).is_some())
        })
        .map(|(name, _)| (*name).to_string())
        .collect()
}


fn classify(face: &ttf_parser::Face, family: &str) -> Classification {
    if face.is_monospaced() {
        return Classification::Mono;
    }
    if let Some(os2) = face.raw_face().table(ttf_parser::Tag::from_bytes(b"OS/2")) {
        if os2.len() >= 42 {
            let class = os2[30];
            match class {
                1..=5 | 7 => return Classification::Serif,
                8 => return Classification::Sans,
                9 | 12 => return Classification::Display,
                10 => return Classification::Script,
                _ => {}
            }
            let panose = &os2[32..42];
            if panose[0] == 2 && panose[3] == 9 {
                return Classification::Mono;
            }
            match panose[0] {
                3 => return Classification::Script,
                4 | 5 => return Classification::Display,
                2 => {
                    return if (11..=15).contains(&panose[1]) {
                        Classification::Sans
                    } else if (2..=10).contains(&panose[1]) {
                        Classification::Serif
                    } else {
                        Classification::Unknown
                    };
                }
                _ => {}
            }
        }
    }
    let name = family.to_lowercase();
    if name.contains("mono") {
        Classification::Mono
    } else if name.contains("script") || name.contains("hand") {
        Classification::Script
    } else if name.contains("sans") {
        Classification::Sans
    } else if name.contains("serif") {
        Classification::Serif
    } else {
        Classification::Unknown
    }
}

fn parse_face(
    data: &[u8],
    index: u32,
    path: &Path,
    format: FontFormat,
    file_size: u64,
    source: FontSource,
) -> Option<FontFace> {
    let face = ttf_parser::Face::parse(data, index).ok()?;

    let family = name_string(&face, ttf_parser::name_id::TYPOGRAPHIC_FAMILY)
        .or_else(|| name_string(&face, ttf_parser::name_id::FAMILY))
        .unwrap_or_else(|| fallback_family(path));
    let style = name_string(&face, ttf_parser::name_id::TYPOGRAPHIC_SUBFAMILY)
        .or_else(|| name_string(&face, ttf_parser::name_id::SUBFAMILY))
        .unwrap_or_else(|| "Regular".to_string());
    let postscript_name = name_string(&face, ttf_parser::name_id::POST_SCRIPT_NAME);
    let foundry = name_string(&face, ttf_parser::name_id::MANUFACTURER)
        .or_else(|| name_string(&face, ttf_parser::name_id::DESIGNER));
    let license = name_string(&face, ttf_parser::name_id::LICENSE);
    let license_url = name_string(&face, ttf_parser::name_id::LICENSE_URL);

    let axes: Vec<VariationAxis> = face
        .variation_axes()
        .into_iter()
        .map(|a| VariationAxis {
            tag: String::from_utf8_lossy(&a.tag.to_bytes()).into_owned(),
            min: a.min_value,
            default: a.def_value,
            max: a.max_value,
        })
        .collect();

    let classification = classify(&face, &family);
    let scripts = script_coverage(&face);
    let path_str = path.to_string_lossy().into_owned();
    Some(FontFace {
        id: format!("{}#{}", path_str, index),
        path: path_str,
        face_index: index,
        family,
        style,
        postscript_name,
        foundry,
        license,
        license_url,
        format,
        is_variable: face.is_variable(),
        axes,
        weight: face.weight().to_number(),
        italic: face.is_italic(),
        monospaced: face.is_monospaced(),
        classification,
        scripts,
        file_size,
        source,
        deactivatable: crate::activation::can_deactivate(source),
        active: true,
    })
}

fn fallback_family(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Unknown".to_string())
}


pub fn parse_font_file(path: &Path, source: FontSource) -> Vec<FontFace> {
    let Ok(data) = fs::read(path) else {
        return Vec::new();
    };
    let file_size = data.len() as u64;
    let format = detect_format(&data, path);

    if matches!(format, FontFormat::Woff | FontFormat::Woff2) {
        let path_str = path.to_string_lossy().into_owned();
        return vec![FontFace {
            id: format!("{}#0", path_str),
            path: path_str,
            face_index: 0,
            family: fallback_family(path),
            style: "Regular".to_string(),
            postscript_name: None,
            foundry: None,
            license: None,
            license_url: None,
            format,
            is_variable: false,
            axes: Vec::new(),
            weight: 400,
            italic: false,
            monospaced: false,
            classification: Classification::Unknown,
            scripts: Vec::new(),
            file_size,
            source,
            deactivatable: crate::activation::can_deactivate(source),
            active: true,
        }];
    }

    let count = ttf_parser::fonts_in_collection(&data).unwrap_or(1);
    (0..count)
        .filter_map(|i| parse_face(&data, i, path, format, file_size, source))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn system_font() -> Option<std::path::PathBuf> {
        walkdir::WalkDir::new("/usr/share/fonts")
            .into_iter()
            .filter_map(|e| e.ok())
            .map(|e| e.into_path())
            .find(|p| {
                p.extension()
                    .and_then(|e| e.to_str())
                    .is_some_and(|e| e.eq_ignore_ascii_case("ttf") || e.eq_ignore_ascii_case("otf"))
            })
    }

    #[test]
    fn parses_a_real_system_font() {
        let Some(path) = system_font() else { return };
        let faces = parse_font_file(&path, FontSource::System);
        assert!(!faces.is_empty(), "no faces parsed from {path:?}");
        let f = &faces[0];
        assert!(!f.family.is_empty());
        assert!(f.file_size > 0);
    }

    #[test]
    fn rejects_non_font_files() {
        assert!(!is_font_file(Path::new("/tmp/readme.txt")));
        assert!(is_font_file(Path::new("/tmp/Inter.ttf")));
        assert!(is_font_file(Path::new("/tmp/Inter.WOFF2")));
    }
}
