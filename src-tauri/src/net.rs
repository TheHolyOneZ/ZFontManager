use crate::store::AppState;
use std::time::Duration;

pub const USER_AGENT: &str = concat!(
    "ZFontManager/",
    env!("CARGO_PKG_VERSION"),
    " (+https://zsync.eu/zfontmanager/)"
);

pub const ALLOWED_HOSTS: [&str; 5] = [
    "api.fontsource.org",
    "raw.githubusercontent.com",
    "github.com",
    "release-assets.githubusercontent.com",
    "objects.githubusercontent.com",
];

const MAX_REDIRECTS: usize = 5;

const TIMEOUT: Duration = Duration::from_secs(15);

pub fn client(state: &AppState) -> Result<reqwest::Client, String> {
    if !state.online_fonts_enabled {
        return Err("online fonts are switched off".to_string());
    }
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())
}

pub fn check_host(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" {
        return Err(format!("refusing non-https url: {url}"));
    }
    match parsed.host_str() {
        Some(h) if ALLOWED_HOSTS.contains(&h) => Ok(()),
        Some(h) => Err(format!("host not allowed: {h}")),
        None => Err(format!("url has no host: {url}")),
    }
}

pub async fn get_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    check_host(url)?;
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("{} returned HTTP {}", url, res.status().as_u16()));
    }
    res.text().await.map_err(|e| e.to_string())
}

pub async fn get_bytes(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    check_host(url)?;
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("{} returned HTTP {}", url, res.status().as_u16()));
    }
    res.bytes().await.map(|b| b.to_vec()).map_err(|e| e.to_string())
}

fn shown(url: &reqwest::Url) -> String {
    let mut clean = url.clone();
    clean.set_query(None);
    clean.to_string()
}

fn location(res: &reqwest::Response, from: &reqwest::Url) -> Result<reqwest::Url, String> {
    let raw = res
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| format!("{} redirected without a location", shown(from)))?;
    from.join(raw).map_err(|e| e.to_string())
}

pub async fn redirect_target(client: &reqwest::Client, url: &str) -> Result<String, String> {
    check_host(url)?;
    let from = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    let res = client.get(from.clone()).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_redirection() {
        return Err(format!("{} returned HTTP {} instead of a redirect", url, res.status().as_u16()));
    }
    Ok(location(&res, &from)?.to_string())
}

pub async fn get_following(
    client: &reqwest::Client,
    url: &str,
    timeout: Option<Duration>,
) -> Result<reqwest::Response, String> {
    let mut current = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    for _ in 0..=MAX_REDIRECTS {
        check_host(current.as_str())?;
        let mut req = client.get(current.clone());
        if let Some(t) = timeout {
            req = req.timeout(t);
        }
        let res = req.send().await.map_err(|e| e.to_string())?;
        if res.status().is_redirection() {
            current = location(&res, &current)?;
            continue;
        }
        if !res.status().is_success() {
            return Err(format!("{} returned HTTP {}", shown(&current), res.status().as_u16()));
        }
        return Ok(res);
    }
    Err(format!("too many redirects for {url}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_refuses_when_disabled() {
        let state = AppState::default();
        assert!(!state.online_fonts_enabled);
        assert!(client(&state).is_err());
    }

    #[test]
    fn host_allow_list() {
        assert!(check_host("https://api.fontsource.org/v1/fonts").is_ok());
        assert!(check_host("https://raw.githubusercontent.com/google/fonts/main/ofl/lora/OFL.txt").is_ok());
        assert!(check_host("https://fonts.googleapis.com/css2?family=Lora").is_err());
        assert!(check_host("http://api.fontsource.org/v1/fonts").is_err());
        assert!(check_host("https://evil.example/").is_err());
        assert!(check_host("https://github.com/ryanoasis/nerd-fonts/releases/latest").is_ok());
        assert!(check_host("https://release-assets.githubusercontent.com/x").is_ok());
        assert!(check_host("https://gist.github.com/").is_err());
    }
}
