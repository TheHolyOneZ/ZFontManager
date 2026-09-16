//! Affinity by Canva (v3) integration over its built-in MCP server.
//!
//! Affinity 3.2+ exposes a legacy-SSE MCP endpoint (default
//! `http://localhost:6767/sse`, enabled under Settings > Model Context
//! Protocol). We run a minimal client against it: open documents and the
//! fonts they use come from a read-only script, matched against the library
//! and session-activated while Affinity runs. No backward compatibility:
//! without a reachable MCP server the integration simply reports offline.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    Mutex, OnceLock,
};
use std::time::Duration;
use tauri::{Emitter, Manager};

use crate::store::{self, Store};

/// Affinity binds its MCP server to the IPv6 loopback on some systems, so a
/// `localhost` URL may resolve to an IPv4 address nothing listens on.
/// Try every loopback spelling, IPv6 first (observed in the wild).
const CANDIDATE_URLS: [&str; 3] = [
    "http://[::1]:6767/sse",
    "http://127.0.0.1:6767/sse",
    "http://localhost:6767/sse",
];

/// Protocol versions to offer, newest first (the server picks one it speaks).
const PROTOCOL_VERSIONS: [&str; 3] = ["2025-11-25", "2025-06-18", "2024-11-05"];
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
const SCRIPT_TIMEOUT: Duration = Duration::from_secs(30);

/// Read-only probe, verified live: open docs with the fonts they use.
/// `isInstalled` marks fonts missing from the system (those need activation).
const DOC_FONTS_SCRIPT: &str = r#"const { Document } = require('/document.js');
const out = [];
for (const doc of Document.all) {
    const fonts = [];
    doc.enumerateFontNames((name, isInstalled) => {
        fonts.push({ name: name, isInstalled: !!isInstalled });
        return 0;
    });
    out.push({ title: doc.title, path: doc.path, fonts: fonts });
}
console.log(JSON.stringify({ docs: out }));"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AffinityFontNeed {
    pub name: String,
    #[serde(default)]
    pub installed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AffinityDoc {
    pub title: String,
    pub path: String,
    #[serde(default)]
    pub fonts: Vec<AffinityFontNeed>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DocFontsResponse {
    #[serde(default)]
    docs: Vec<AffinityDoc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AffinityConnection {
    pub reachable: bool,
    pub version: Option<String>,
    pub doc_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AffinityEvent {
    kind: String,
    #[serde(default)]
    docs: Vec<AffinityDoc>,
    #[serde(default)]
    message: Option<String>,
}

// ---------------------------------------------------------------------------
// Minimal legacy-SSE MCP client (one session per query, no background tasks)
// ---------------------------------------------------------------------------

/// Split completed SSE frames (`event:`/`data:` pairs) off the buffer.
fn drain_frames(buf: &mut Vec<u8>) -> Vec<(String, String)> {
    let mut out = Vec::new();
    loop {
        let end = buf
            .windows(2)
            .position(|w| w == b"\n\n")
            .or_else(|| buf.windows(4).position(|w| w == b"\r\n\r\n").map(|p| p + 2));
        let Some(end) = end else { break };
        let raw: Vec<u8> = buf.drain(..end + 2).collect();
        let text = String::from_utf8_lossy(&raw);
        let mut event = "message".to_string();
        let mut data_lines = Vec::new();
        for line in text.lines() {
            let line = line.trim_end_matches('\r');
            if let Some(v) = line.strip_prefix("event:") {
                event = v.trim().to_string();
            } else if let Some(v) = line.strip_prefix("data:") {
                data_lines.push(v.trim_start().to_string());
            }
        }
        if !data_lines.is_empty() {
            out.push((event, data_lines.join("\n")));
        }
    }
    out
}

struct Session {
    client: reqwest::Client,
    endpoint: String,
    stream: reqwest::Response,
    buf: Vec<u8>,
    next_id: u64,
}

impl Session {
    async fn open(url: &str) -> Result<(Self, Option<String>), String> {
        let client = reqwest::Client::new();
        let mut stream = client
            .get(url)
            .header("Accept", "text/event-stream")
            .send()
            .await
            .map_err(|e| connect_error(&e.to_string()))?;
        let mut buf = Vec::new();
        let endpoint = tokio::time::timeout(CONNECT_TIMEOUT, async {
            loop {
                let chunk = stream
                    .chunk()
                    .await
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "MCP stream closed before the endpoint arrived".to_string())?;
                buf.extend_from_slice(&chunk);
                for (event, data) in drain_frames(&mut buf) {
                    if event == "endpoint" {
                        return Ok::<String, String>(join_endpoint(url, &data));
                    }
                }
            }
        })
        .await
        .map_err(|_| connect_error("timed out"))??;
        let mut session = Session {
            client,
            endpoint,
            stream,
            buf,
            next_id: 1,
        };
        // Server picks a protocol version it speaks; fall back to the older one.
        let mut version = None;
        let mut last_err = String::new();
        for v in PROTOCOL_VERSIONS {
            match session.request("initialize", serde_json::json!({
                "protocolVersion": v,
                "capabilities": {},
                "clientInfo": { "name": "ZFontManager", "version": env!("CARGO_PKG_VERSION") },
            }), CONNECT_TIMEOUT).await {
                Ok(res) => {
                    version = res
                        .pointer("/serverInfo/version")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    break;
                }
                Err(e) => last_err = e,
            }
        }
        if version.is_none() {
            let detail = if last_err.is_empty() {
                "no protocol version accepted".to_string()
            } else {
                last_err
            };
            return Err(detail);
        }
        session
            .notify("notifications/initialized", serde_json::json!({}))
            .await?;
        Ok((session, version))
    }

    async fn notify(&self, method: &str, params: serde_json::Value) -> Result<(), String> {
        self.client
            .post(&self.endpoint)
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "method": method,
                "params": params,
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    async fn request(
        &mut self,
        method: &str,
        params: serde_json::Value,
        timeout: Duration,
    ) -> Result<serde_json::Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        self.client
            .post(&self.endpoint)
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": method,
                "params": params,
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        tokio::time::timeout(timeout, async {
            loop {
                let chunk = self
                    .stream
                    .chunk()
                    .await
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "MCP stream closed while waiting for a response".to_string())?;
                self.buf.extend_from_slice(&chunk);
                for (event, data) in drain_frames(&mut self.buf) {
                    if event != "message" {
                        continue;
                    }
                    let msg: serde_json::Value =
                        serde_json::from_str(&data).map_err(|e| e.to_string())?;
                    if msg.get("id").and_then(|v| v.as_u64()) != Some(id) {
                        continue;
                    }
                    if let Some(err) = msg.get("error") {
                        return Err(err.to_string());
                    }
                    return msg
                        .get("result")
                        .cloned()
                        .ok_or_else(|| "MCP response had no result".to_string());
                }
            }
        })
        .await
        .map_err(|_| format!("MCP '{method}' timed out"))?
    }
}

fn join_endpoint(sse_url: &str, endpoint: &str) -> String {
    if endpoint.starts_with("http://") || endpoint.starts_with("https://") {
        return endpoint.to_string();
    }
    // Relative (usually "/messages?sessionId=…"): same origin as the SSE URL.
    match sse_url.find("://") {
        Some(scheme_end) => {
            let after_scheme = &sse_url[scheme_end + 3..];
            let host_end = after_scheme.find('/').unwrap_or(after_scheme.len());
            let origin = &sse_url[..scheme_end + 3 + host_end];
            if let Some(path) = endpoint.strip_prefix('/') {
                format!("{origin}/{path}")
            } else {
                format!("{origin}/{endpoint}")
            }
        }
        None => endpoint.to_string(),
    }
}

fn connect_error(detail: &str) -> String {
    let d = detail.to_lowercase();
    if d.contains("refused")
        || d.contains("timed out")
        || d.contains("could not connect")
        || d.contains("connection closed")
        || d.contains("dns")
    {
        "Affinity is not reachable — enable the MCP server in Affinity under Settings > Model Context Protocol, then restart Affinity.".to_string()
    } else {
        format!("Affinity link failed: {detail}")
    }
}

/// Pick the script-running tool and its script-text argument from tools/list.
fn pick_script_tool(tools: &[serde_json::Value]) -> Result<(String, String), String> {
    let mut fallback: Option<(&serde_json::Value, String)> = None;
    for tool in tools {
        let name = tool.get("name").and_then(|n| n.as_str()).unwrap_or("");
        let arg = script_arg_name(tool);
        let Some(arg) = arg else { continue };
        if name == "execute_script" {
            return Ok((name.to_string(), arg));
        }
        if fallback.is_none() && name.contains("script") {
            fallback = Some((tool, arg));
        }
    }
    if let Some((tool, arg)) = fallback {
        let name = tool.get("name").and_then(|n| n.as_str()).unwrap_or("");
        return Ok((name.to_string(), arg));
    }
    Err("the Affinity MCP server exposes no script tool".to_string())
}

fn script_arg_name(tool: &serde_json::Value) -> Option<String> {
    let props = tool.pointer("/inputSchema/properties")?.as_object()?;
    for key in ["script", "code", "source", "content", "text", "javascript"] {
        if props.contains_key(key) {
            return Some(key.to_string());
        }
    }
    let required: HashSet<&str> = tool
        .pointer("/inputSchema/required")
        .and_then(|r| r.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect())
        .unwrap_or_default();
    props
        .iter()
        .filter(|(_, v)| v.get("type").and_then(|t| t.as_str()) == Some("string"))
        .find(|(k, _)| required.contains(k.as_str()))
        .or_else(|| {
            props
                .iter()
                .find(|(_, v)| v.get("type").and_then(|t| t.as_str()) == Some("string"))
        })
        .map(|(k, _)| k.clone())
}

fn result_text(result: &serde_json::Value) -> String {
    result
        .get("content")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}

fn extract_json(text: &str) -> Result<serde_json::Value, String> {
    let start = text.find('{').ok_or_else(|| "no JSON in the script result".to_string())?;
    let end = text.rfind('}').ok_or_else(|| "no JSON in the script result".to_string())?;
    serde_json::from_str(&text[start..=end]).map_err(|e| e.to_string())
}

async fn tools_list(session: &mut Session) -> Result<Vec<serde_json::Value>, String> {
    let res = session
        .request("tools/list", serde_json::json!({}), CONNECT_TIMEOUT)
        .await?;
    res.get("tools")
        .and_then(|t| t.as_array())
        .cloned()
        .ok_or_else(|| "tools/list returned no tools".to_string())
}

/// Invoke a named tool and return its result; tool-level failures come back
/// as the tool's own error text.
async fn call_tool(
    session: &mut Session,
    name: &str,
    args: serde_json::Value,
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let res = session
        .request(
            "tools/call",
            serde_json::json!({ "name": name, "arguments": args }),
            timeout,
        )
        .await?;
    if res.get("isError").and_then(|v| v.as_bool()).unwrap_or(false) {
        return Err(result_text(&res));
    }
    Ok(res)
}

/// The server refuses `execute_script` until the preamble doc topic has been
/// read in the current session ("The preamble documentation topic has not yet
/// been read"). Do that first; if the docs tool is missing, try the script
/// anyway.
async fn read_preamble(session: &mut Session, tools: &[serde_json::Value]) -> Result<(), String> {
    let has_docs_tool = tools
        .iter()
        .any(|t| t.get("name").and_then(|n| n.as_str()) == Some("read_sdk_documentation_topic"));
    if !has_docs_tool {
        return Ok(());
    }
    call_tool(
        session,
        "read_sdk_documentation_topic",
        serde_json::json!({"filename": "preamble"}),
        CONNECT_TIMEOUT,
    )
    .await
    .map_err(|e| format!("Affinity preamble read failed: {e}"))?;
    Ok(())
}

async fn run_doc_fonts_script(session: &mut Session) -> Result<Vec<AffinityDoc>, String> {
    let tools = tools_list(session).await?;
    read_preamble(session, &tools).await?;
    let (tool_name, arg_name) = pick_script_tool(&tools)?;
    let mut args = serde_json::Map::new();
    args.insert(arg_name, serde_json::Value::String(DOC_FONTS_SCRIPT.to_string()));
    let res = call_tool(session, &tool_name, serde_json::Value::Object(args), SCRIPT_TIMEOUT)
        .await
        .map_err(|e| format!("Affinity script failed: {e}"))?;
    let parsed = extract_json(&result_text(&res))?;
    let resp: DocFontsResponse =
        serde_json::from_value(parsed).map_err(|e| format!("unexpected script result: {e}"))?;
    Ok(resp.docs)
}

/// Open a session on the first reachable loopback spelling.
async fn open_any() -> Result<(Session, Option<String>), String> {
    let mut last_err = String::new();
    for url in CANDIDATE_URLS {
        match Session::open(url).await {
            Ok(opened) => return Ok(opened),
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
}

/// Full query: connect, run the font probe, drop the session.
pub async fn doc_fonts() -> Result<(Option<String>, Vec<AffinityDoc>), String> {
    let (mut session, version) = open_any().await?;
    let docs = run_doc_fonts_script(&mut session).await?;
    Ok((version, docs))
}

pub async fn connection() -> AffinityConnection {
    match doc_fonts().await {
        Ok((version, docs)) => AffinityConnection {
            reachable: true,
            version,
            doc_count: docs.len(),
            error: None,
        },
        Err(e) => AffinityConnection {
            reachable: false,
            version: None,
            doc_count: 0,
            error: Some(e),
        },
    }
}

// ---------------------------------------------------------------------------
// Process watcher: session-activate while Affinity runs, revert on quit
// ---------------------------------------------------------------------------

static AFFINITY_SESSION: Mutex<Vec<String>> = Mutex::new(Vec::new());
static WAS_RUNNING: AtomicBool = AtomicBool::new(false);
static KNOWN_DOCS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
static TICK: AtomicU32 = AtomicU32::new(0);

fn known_docs() -> &'static Mutex<HashSet<String>> {
    KNOWN_DOCS.get_or_init(|| Mutex::new(HashSet::new()))
}

pub fn note_activated(paths: Vec<String>) {
    if let Ok(mut session) = AFFINITY_SESSION.lock() {
        for p in paths {
            if !session.contains(&p) {
                session.push(p);
            }
        }
    }
}

fn session_empty() -> bool {
    AFFINITY_SESSION.lock().map(|s| s.is_empty()).unwrap_or(true)
}

/// Deactivate everything the Affinity watcher turned on. Returns the count.
pub fn revert_session(state: &mut crate::store::AppState) -> usize {
    let paths: Vec<String> = match AFFINITY_SESSION.lock() {
        Ok(mut s) => std::mem::take(&mut *s),
        Err(_) => return 0,
    };
    let mut n = 0;
    for p in &paths {
        if crate::activation::sync(state, p, false).is_ok() {
            n += 1;
        }
    }
    let _ = store::save(state);
    n
}

fn is_affinity_running() -> bool {
    static SYS: OnceLock<Mutex<sysinfo::System>> = OnceLock::new();
    let lock = SYS.get_or_init(|| Mutex::new(sysinfo::System::new()));
    let Ok(mut sys) = lock.lock() else {
        return false;
    };
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.processes().values().any(|p| {
        let n = p.name().to_string_lossy().to_lowercase();
        n == "affinity" || n == "affinity.exe" || n == "affinity.real" || n == "affinity.real.exe"
    })
}

fn emit(app: &tauri::AppHandle, kind: &str, docs: Vec<AffinityDoc>, message: Option<String>) {
    let _ = app.emit(
        "affinity:event",
        AffinityEvent {
            kind: kind.to_string(),
            docs,
            message,
        },
    );
}

fn settings_snapshot(app: &tauri::AppHandle) -> Option<(bool, bool)> {
    let store = app.state::<Store>();
    let state = store.0.lock().ok()?;
    Some((state.affinity_enabled, state.affinity_deactivate_on_quit))
}

/// One watcher step, called every couple of seconds from a background thread.
pub fn tick(app: &tauri::AppHandle) {
    let Some((enabled, deactivate_on_quit)) = settings_snapshot(app) else {
        return;
    };
    if !enabled {
        WAS_RUNNING.store(false, Ordering::SeqCst);
        if !session_empty() {
            if let Some(store) = app.try_state::<Store>() {
                if let Ok(mut state) = store.0.lock() {
                    revert_session(&mut state);
                }
            }
            emit(app, "deactivated", Vec::new(), None);
        }
        if let Ok(mut known) = known_docs().lock() {
            known.clear();
        }
        return;
    }

    let running = is_affinity_running();
    let was = WAS_RUNNING.swap(running, Ordering::SeqCst);

    if running && !was {
        // Affinity just started: query everything.
        match tauri::async_runtime::block_on(doc_fonts()) {
            Ok((_, docs)) => {
                if let Ok(mut known) = known_docs().lock() {
                    *known = docs.iter().map(|d| d.path.clone()).collect();
                }
                emit(app, "needs", docs, None);
            }
            Err(e) => emit(app, "error", Vec::new(), Some(e)),
        }
    } else if running && was {
        // While running, re-query periodically for newly opened documents.
        let n = TICK.fetch_add(1, Ordering::SeqCst);
        if n % 5 == 0 {
            if let Ok((_, docs)) = tauri::async_runtime::block_on(doc_fonts()) {
                let fresh: Vec<AffinityDoc> = match known_docs().lock() {
                    Ok(mut known) => {
                        let fresh: Vec<AffinityDoc> = docs
                            .iter()
                            .filter(|d| !known.contains(&d.path))
                            .cloned()
                            .collect();
                        *known = docs.iter().map(|d| d.path.clone()).collect();
                        fresh
                    }
                    Err(_) => Vec::new(),
                };
                if !fresh.is_empty() {
                    emit(app, "needs", fresh, None);
                }
            }
        }
    } else if !running && was {
        if let Ok(mut known) = known_docs().lock() {
            known.clear();
        }
        if deactivate_on_quit && !session_empty() {
            if let Some(store) = app.try_state::<Store>() {
                if let Ok(mut state) = store.0.lock() {
                    revert_session(&mut state);
                }
            }
            emit(app, "deactivated", Vec::new(), None);
        }
    }
}
