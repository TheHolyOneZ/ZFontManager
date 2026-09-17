#[derive(Debug, Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PbFont {
    pub name: String,
    pub style: String,
    pub weight: u16,
    pub filename: String,
    pub post_script_name: String,
    pub full_name: String,
    pub copyright: String,
}

#[derive(Debug, Clone, Default)]
pub struct PbFamily {
    pub name: String,
    pub designer: String,
    pub license: String,
    pub category: String,
    pub fonts: Vec<PbFont>,
}

pub fn parse(text: &str) -> Result<PbFamily, String> {
    let mut fam = PbFamily::default();
    let mut depth = 0usize;
    let mut in_font = false;
    let mut cur = PbFont::default();

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if line.ends_with('{') {
            let key = line.trim_end_matches('{').trim();
            if depth == 0 && key == "fonts" {
                in_font = true;
                cur = PbFont::default();
            }
            depth += 1;
            continue;
        }
        if line == "}" {
            if depth == 0 {
                return Err("unbalanced '}' in METADATA.pb".to_string());
            }
            depth -= 1;
            if depth == 0 && in_font {
                fam.fonts.push(std::mem::take(&mut cur));
                in_font = false;
            }
            continue;
        }
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        if depth == 0 {
            match key {
                "name" => fam.name = unquote(value),
                "designer" => fam.designer = unquote(value),
                "license" => fam.license = unquote(value),
                "category" => fam.category = unquote(value),
                _ => {}
            }
        } else if depth == 1 && in_font {
            match key {
                "name" => cur.name = unquote(value),
                "style" => cur.style = unquote(value),
                "weight" => cur.weight = value.parse().unwrap_or(400),
                "filename" => cur.filename = unquote(value),
                "post_script_name" => cur.post_script_name = unquote(value),
                "full_name" => cur.full_name = unquote(value),
                "copyright" => cur.copyright = unquote(value),
                _ => {}
            }
        }
    }
    if depth != 0 {
        return Err("unterminated block in METADATA.pb".to_string());
    }
    if fam.name.is_empty() || fam.fonts.is_empty() {
        return Err("METADATA.pb has no name or no fonts".to_string());
    }
    Ok(fam)
}

fn unquote(v: &str) -> String {
    let v = v.trim();
    if v.len() < 2 || !v.starts_with('"') || !v.ends_with('"') {
        return v.to_string();
    }
    let inner = &v[1..v.len() - 1];
    let mut out = String::with_capacity(inner.len());
    let mut chars = inner.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some('\'') => out.push('\''),
                Some(o) => {
                    out.push('\\');
                    out.push(o);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

pub fn reserved_font_name(copyright: &str) -> Option<String> {
    let lower = copyright.to_ascii_lowercase();
    let idx = lower.find("reserved font name")?;
    let rest = &copyright[idx + "reserved font name".len()..];
    let rest = rest.trim_start_matches(|c: char| c == 's' || c == ':' || c.is_whitespace());
    let start = rest.find(|c| c == '"' || c == '\u{201C}' || c == '\'')? + 1;
    let after = &rest[start..];
    let end = after.find(|c| c == '"' || c == '\u{201D}' || c == '\'')?;
    let name = after[..end].trim();
    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LORA: &str = r#"name: "Lora"
designer: "Cyreal"
license: "OFL"
category: "SERIF"
date_added: "2011-07-06"
fonts {
  name: "Lora"
  style: "normal"
  weight: 400
  filename: "Lora[wght].ttf"
  post_script_name: "Lora-Regular"
  full_name: "Lora Regular"
  copyright: "Copyright 2011 The Lora Project Authors (https://github.com/cyrealtype/Lora-Cyrillic), with Reserved Font Name \"Lora\"."
}
fonts {
  name: "Lora"
  style: "italic"
  weight: 400
  filename: "Lora-Italic[wght].ttf"
  post_script_name: "Lora-Italic"
  full_name: "Lora Italic"
  copyright: "Copyright 2011 The Lora Project Authors, with Reserved Font Name \"Lora\"."
}
subsets: "cyrillic"
subsets: "latin"
axes {
  tag: "wght"
  min_value: 400.0
  max_value: 700.0
}
source {
  repository_url: "https://github.com/cyrealtype/Lora-Cyrillic"
  commit: "abc"
  files {
    source_file: "fonts/variable/Lora[wght].ttf"
    dest_file: "Lora[wght].ttf"
  }
}
"#;

    #[test]
    fn parses_lora() {
        let f = parse(LORA).unwrap();
        assert_eq!(f.name, "Lora");
        assert_eq!(f.designer, "Cyreal");
        assert_eq!(f.license, "OFL");
        assert_eq!(f.category, "SERIF");
        assert_eq!(f.fonts.len(), 2);
        assert_eq!(f.fonts[0].filename, "Lora[wght].ttf");
        assert_eq!(f.fonts[0].post_script_name, "Lora-Regular");
        assert_eq!(f.fonts[1].style, "italic");
        assert!(f.fonts[0].copyright.contains("Reserved Font Name \"Lora\""));
    }

    #[test]
    fn nested_source_block_is_skipped() {
        let f = parse(LORA).unwrap();
        assert!(!f.fonts.iter().any(|x| x.filename.contains("source_file")));
    }

    #[test]
    fn extracts_reserved_font_name() {
        assert_eq!(
            reserved_font_name("Copyright 2011, with Reserved Font Name \"Lora\"."),
            Some("Lora".to_string())
        );
        assert_eq!(
            reserved_font_name("Copyright 2020 with Reserved Font Names 'Inter' and 'Inter Tight'"),
            Some("Inter".to_string())
        );
        assert_eq!(reserved_font_name("Copyright 2020 The Roboto Project Authors"), None);
    }

    #[test]
    fn rejects_unbalanced() {
        assert!(parse("name: \"X\"\nfonts {\n  filename: \"a.ttf\"\n").is_err());
    }
}
