

#![cfg_attr(
    not(any(target_os = "windows", target_os = "macos")),
    allow(dead_code, unused_imports)
)]

use std::process::Command;

pub const NOT_RUNNING: &str = "not-running";

#[derive(Clone, Copy)]
pub enum Target {
    Photoshop,
    Illustrator,
}

impl Target {
    pub fn parse(s: &str) -> Result<Self, String> {
        match s {
            "photoshop" => Ok(Target::Photoshop),
            "illustrator" => Ok(Target::Illustrator),
            other => Err(format!("unknown application: {other}")),
        }
    }
}

pub fn available() -> bool {
    cfg!(any(target_os = "windows", target_os = "macos"))
}

fn js_string(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string())
}

fn photoshop_script(postscript: &str, label: &str) -> String {
    format!(
        r#"(function () {{
  var font = {ps};
  var label = {label};
  if (app.documents.length === 0) {{ return "no-document"; }}
  var doc = app.activeDocument;

  function hasBackground() {{ try {{ doc.backgroundLayer; return true; }} catch (e) {{ return false; }} }}

  function selectedIndices() {{
    var out = [];
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    var desc = executeActionGet(ref);
    var key = stringIDToTypeID("targetLayers");
    if (desc.hasKey(key)) {{
      var list = desc.getList(key);
      var offset = hasBackground() ? 0 : 1;
      for (var i = 0; i < list.count; i++) {{ out.push(list.getReference(i).getIndex() + offset); }}
    }}
    return out;
  }}

  function selectByIndex(idx, add) {{
    var ref = new ActionReference();
    ref.putIndex(charIDToTypeID("Lyr "), idx);
    var desc = new ActionDescriptor();
    desc.putReference(charIDToTypeID("null"), ref);
    if (add) {{
      desc.putEnumerated(stringIDToTypeID("selectionModifier"), stringIDToTypeID("selectionModifierType"), stringIDToTypeID("addToSelection"));
    }}
    desc.putBoolean(charIDToTypeID("MkVs"), false);
    executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);
  }}

  // 1 = applied, 0 = not a text layer, -1 = Photoshop does not know the font
  function applyTo(layer) {{
    if (layer.kind !== LayerKind.TEXT) {{ return 0; }}
    layer.textItem.font = font;
    return layer.textItem.font === font ? 1 : -1;
  }}

  var applied = 0, unknown = false, r;
  var indices = [];
  try {{ indices = selectedIndices(); }} catch (e) {{ indices = []; }}
  if (indices.length > 1) {{
    for (var i = 0; i < indices.length; i++) {{
      try {{ selectByIndex(indices[i], false); r = applyTo(doc.activeLayer); if (r > 0) applied++; if (r < 0) unknown = true; }} catch (e) {{}}
    }}
    try {{ selectByIndex(indices[0], false); for (var j = 1; j < indices.length; j++) selectByIndex(indices[j], true); }} catch (e) {{}}
  }} else {{
    try {{ r = applyTo(doc.activeLayer); if (r > 0) applied++; if (r < 0) unknown = true; }} catch (e) {{}}
  }}
  if (applied > 0) {{ return "applied:" + applied; }}
  if (unknown) {{ return "font-not-found"; }}

  var prevUnits = app.preferences.rulerUnits;
  app.preferences.rulerUnits = Units.PIXELS;
  try {{
    var layer = doc.artLayers.add();
    layer.kind = LayerKind.TEXT;
    layer.name = label;
    layer.textItem.contents = label;
    layer.textItem.size = 48;
    layer.textItem.position = [doc.width.value / 8, doc.height.value / 2];
    layer.textItem.font = font;
    if (layer.textItem.font !== font) {{ layer.remove(); return "font-not-found"; }}
  }} finally {{
    app.preferences.rulerUnits = prevUnits;
  }}
  return "created";
}})();"#,
        ps = js_string(postscript),
        label = js_string(label),
    )
}

fn illustrator_script(postscript: &str, label: &str) -> String {
    format!(
        r#"(function () {{
  var name = {ps};
  var label = {label};
  if (app.documents.length === 0) {{ return "no-document"; }}
  var doc = app.activeDocument;
  var font = null;
  try {{ font = app.textFonts.getByName(name); }} catch (e) {{ return "font-not-found"; }}
  if (!font) {{ return "font-not-found"; }}

  var applied = 0;
  var sel = doc.selection;
  if (sel && sel.length) {{
    for (var i = 0; i < sel.length; i++) {{
      var item = sel[i];
      try {{
        if (item.typename === "TextFrame") {{ item.textRange.characterAttributes.textFont = font; applied++; }}
        else if (item.typename === "TextRange") {{ item.characterAttributes.textFont = font; applied++; }}
      }} catch (e) {{}}
    }}
  }}
  if (applied > 0) {{ return "applied:" + applied; }}

  var frame = doc.textFrames.add();
  frame.contents = label;
  frame.textRange.characterAttributes.textFont = font;
  frame.textRange.characterAttributes.size = 48;
  frame.position = [doc.width / 8, doc.height / 2];
  return "created";
}})();"#,
        ps = js_string(postscript),
        label = js_string(label),
    )
}

fn script_for(target: Target, postscript: &str, label: &str) -> String {
    match target {
        Target::Photoshop => photoshop_script(postscript, label),
        Target::Illustrator => illustrator_script(postscript, label),
    }
}

fn finish(out: std::process::Output) -> Result<String, String> {
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if stderr.is_empty() { stdout } else { stderr });
    }

    Ok(stdout.lines().last().unwrap_or("").trim().to_string())
}

#[cfg(target_os = "windows")]
pub fn apply(target: Target, postscript: &str, label: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let prog_id = match target {
        Target::Photoshop => "Photoshop.Application",
        Target::Illustrator => "Illustrator.Application",
    };

    let script_path = std::env::temp_dir().join(format!("zfontmanager-apply-{}.jsx", std::process::id()));
    std::fs::write(&script_path, script_for(target, postscript, label)).map_err(|e| e.to_string())?;
    let path_literal = script_path.to_string_lossy().replace('\'', "''");

    let ps = format!(
        "$ErrorActionPreference = 'Stop'\n\
         try {{ $a = [Runtime.InteropServices.Marshal]::GetActiveObject('{prog_id}') }} catch {{ Write-Output '{NOT_RUNNING}'; exit 0 }}\n\
         $code = [IO.File]::ReadAllText('{path_literal}', [Text.Encoding]::UTF8)\n\
         $r = $a.DoJavaScript($code)\n\
         Write-Output ([string]$r)\n"
    );

    let utf16: Vec<u8> = ps.encode_utf16().flat_map(|w| w.to_le_bytes()).collect();
    let encoded = base64_encode(&utf16);

    let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
    let exe = format!("{system_root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    let exe = if std::path::Path::new(&exe).exists() { exe } else { "powershell".to_string() };

    let out = Command::new(exe)
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", &encoded])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string());
    let _ = std::fs::remove_file(&script_path);
    finish(out?)
}

#[cfg(target_os = "windows")]
fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        out.push(TABLE[(n >> 18) as usize & 63] as char);
        out.push(TABLE[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { TABLE[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[n as usize & 63] as char } else { '=' });
    }
    out
}

#[cfg(target_os = "macos")]
pub fn apply(target: Target, postscript: &str, label: &str) -> Result<String, String> {
    let bundle = match target {
        Target::Photoshop => "com.adobe.Photoshop",
        Target::Illustrator => "com.adobe.illustrator",
    };

    let probe = Command::new("osascript")
        .args([
            "-e",
            &format!(
                r#"tell application "System Events" to (exists (first application process whose bundle identifier is "{bundle}"))"#
            ),
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if String::from_utf8_lossy(&probe.stdout).trim() != "true" {
        return Ok(NOT_RUNNING.to_string());
    }

    let out = Command::new("osascript")
        .args([
            "-e",
            "on run argv",
            "-e",
            &format!(r#"tell application id "{bundle}" to do javascript (item 1 of argv)"#),
            "-e",
            "end run",
            &script_for(target, postscript, label),
        ])
        .output()
        .map_err(|e| e.to_string())?;
    finish(out)
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn apply(_target: Target, _postscript: &str, _label: &str) -> Result<String, String> {
    Err("Photoshop and Illustrator integration is only available on Windows and macOS".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scripts_embed_names_safely() {
        let ps = photoshop_script("My\"Font-Bold", "Fam \\ ily");
        assert!(ps.contains(r#"var font = "My\"Font-Bold";"#));
        assert!(ps.contains(r#"var label = "Fam \\ ily";"#));
        let ai = illustrator_script("Inter-Regular", "Inter");
        assert!(ai.contains(r#"app.textFonts.getByName(name)"#));
        assert!(ai.contains(r#"var name = "Inter-Regular";"#));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn base64_matches_standard() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }
}

