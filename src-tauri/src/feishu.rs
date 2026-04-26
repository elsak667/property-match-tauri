/**
 * 飞书 API 集成 — Rust 后端
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

const TOKEN_URL: &str = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
const SHEET_VALUES_URL: &str = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets";

// ── Spreadsheet 配置 ────────────────────────────────────────────────────────────
const PROPERTY_SHEET: &str = "X1jRs1PhLhR8WetSwktcM9Fgnhg";
const PROPERTY_BUILDING_SHEET_ID: &str = "4hdJSh"; // 楼宇

pub const POLICY_SHEET: &str = "DwqqsS6TShlGhAteDf3cHRwvnHe";
pub const POLICY_SHEET_ID: &str = "0aad30";
pub const STATS_SHEET_ID: &str = "2pLPm8";

// ── 数据结构 ──────────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, Deserialize)]
struct TokenRequest {
    app_id: String,
    app_secret: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenResponse {
    code: i32,
    msg: String,
    tenant_access_token: Option<String>,
    expire: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SheetValuesResponse {
    code: i32,
    msg: String,
    data: Option<SheetValuesData>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SheetValuesData {
    #[serde(rename = "valueRange")]
    value_range: Option<ValueRange>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ValueRange {
    values: Option<Vec<Vec<serde_json::Value>>>,
}

// ── Token 缓存 ────────────────────────────────────────────────────────────────
pub struct TokenCache {
    pub token: Option<String>,
    pub expires_at: Option<i64>,
}

impl Default for TokenCache {
    fn default() -> Self {
        Self { token: None, expires_at: None }
    }
}

pub type AppState = Mutex<TokenCache>;

pub fn get_app_id() -> String {
    std::env::var("FEISHU_APP_ID").ok().filter(|s| !s.is_empty())
        .unwrap_or_else(|| "cli_a950307a10b8dcb1".to_string())
}

pub fn get_app_secret() -> String {
    std::env::var("FEISHU_APP_SECRET").ok().filter(|s| !s.is_empty())
        .unwrap_or_else(|| "TFlBj160Jm4p48uZ3t4RETpL3qz1oxaj".to_string())
}

async fn fetch_new_token(app_id: &str, app_secret: &str) -> Result<String, String> {
    println!("[FEISHU] fetch_new_token called with app_id: {}", app_id);
    let body = serde_json::to_string(&TokenRequest {
        app_id: app_id.to_string(),
        app_secret: app_secret.to_string(),
    }).map_err(|e| e.to_string())?;

    println!("[FEISHU] Posting to {}", TOKEN_URL);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(true) // 跳过证书验证测试
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(TOKEN_URL)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await;

    match response {
        Ok(resp) => {
            let text = resp.text().await.map_err(|e| e.to_string())?;
            println!("[FEISHU] Token response: {}", &text[..text.len().min(200)]);
            let resp: TokenResponse = serde_json::from_str(&text).map_err(|e| e.to_string())?;
            if resp.code != 0 {
                return Err(format!("Token error {}: {}", resp.code, resp.msg));
            }
            resp.tenant_access_token.ok_or_else(|| "No token".to_string())
        }
        Err(e) => {
            println!("[FEISHU] HTTP error: {:?}", e);
            Err(format!("HTTP error: {:?}", e))
        }
    }
}

pub async fn fetch_sheet_values(
    spreadsheet_token: &str,
    sheet_id: &str,
    range: &str,
    token: &str,
) -> Result<Vec<Vec<serde_json::Value>>, String> {
    let url = format!(
        "{}/{}/values/{}!{}",
        SHEET_VALUES_URL, spreadsheet_token, sheet_id, range
    );
    let text = reqwest::Client::new()
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let resp: SheetValuesResponse = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if resp.code != 0 {
        return Err(format!("Sheet error {}: {}", resp.code, resp.msg));
    }
    Ok(resp.data.ok_or("No data")?.value_range.ok_or("No value_range")?.values.unwrap_or_default())
}

/// 获取有效 token（优先缓存，过期则刷新）
pub async fn get_valid_token(
    state: &State<'_, AppState>,
    app_id: &str,
    app_secret: &str,
) -> Result<String, String> {
    let cached_token = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
        if let (Some(t), Some(exp)) = (&guard.token, guard.expires_at) {
            if exp > now + 300_000 {
                Some(t.clone())
            } else {
                None
            }
        } else {
            None
        }
    };

    if let Some(t) = cached_token {
        return Ok(t);
    }

    let new_token = fetch_new_token(app_id, app_secret).await?;

    {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard.token = Some(new_token.clone());
        guard.expires_at = Some(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64 + 7200_000);
    }

    Ok(new_token)
}

// ── Tauri 命令 ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn feishu_debug() -> Result<HashMap<String, String>, String> {
    let app_id = get_app_id();
    let app_secret = get_app_secret();
    let mut result = HashMap::new();
    result.insert("app_id".to_string(), app_id.clone());
    result.insert("app_secret_set".to_string(), (!app_secret.is_empty()).to_string());
    result.insert("app_secret_prefix".to_string(),
        if app_secret.len() > 8 { app_secret[..8].to_string() + "..." } else { "⚠️ 太短".to_string() });

    if app_id.is_empty() || app_secret.is_empty() {
        result.insert("status".to_string(), "no_credentials".to_string());
        return Ok(result);
    }

    match fetch_new_token(&app_id, &app_secret).await {
        Ok(token) => {
            result.insert("status".to_string(), "token_ok".to_string());
            result.insert("token_prefix".to_string(), format!("{}...", &token[..20.min(token.len())]));
            match fetch_sheet_values(PROPERTY_SHEET, PROPERTY_BUILDING_SHEET_ID, "A1:S5", &token).await {
                Ok(rows) => {
                    let data_rows = if rows.len() > 2 { &rows[2..] } else { &[] };
                    result.insert("property_rows".to_string(), data_rows.len().to_string());
                    result.insert("property_sample".to_string(),
                        data_rows.first().map(|r| serde_json::to_string(r).unwrap_or_default()).unwrap_or_default());
                }
                Err(e) => {
                    result.insert("property_error".to_string(), e);
                }
            }
            match fetch_sheet_values(POLICY_SHEET, STATS_SHEET_ID, "A1:U10", &token).await {
                Ok(rows) => {
                    result.insert("policy_rows".to_string(), rows.len().to_string());
                    result.insert("policy_sample".to_string(),
                        rows.first().map(|r| serde_json::to_string(r).unwrap_or_default()).unwrap_or_default());
                }
                Err(e) => {
                    result.insert("policy_error".to_string(), e);
                }
            }
        }
        Err(e) => {
            result.insert("status".to_string(), "token_error".to_string());
            result.insert("token_error".to_string(), e);
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn feishu_config() -> Result<HashMap<String, String>, String> {
    let mut cfg = HashMap::new();
    cfg.insert("has_app_id".to_string(), (!get_app_id().is_empty()).to_string());
    cfg.insert("property_sheet".to_string(), PROPERTY_SHEET.to_string());
    cfg.insert("policy_sheet".to_string(), POLICY_SHEET.to_string());
    cfg.insert("has_credentials".to_string(),
        (!get_app_id().is_empty() && !get_app_secret().is_empty()).to_string()
    );
    Ok(cfg)
}

#[tauri::command]
pub async fn feishu_fetch_policies(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let app_id = get_app_id();
    let app_secret = get_app_secret();

    let token = get_valid_token(&state, &app_id, &app_secret).await?;
    let rows = fetch_sheet_values(POLICY_SHEET, POLICY_SHEET_ID, "A1:U600", &token).await?;

    if rows.len() < 2 {
        return Ok(serde_json::json!({ "headers": [], "data": [] }));
    }

    let headers: Vec<String> = rows.get(0)
        .map(|r| r.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let data: Vec<serde_json::Value> = rows.iter()
        .skip(1)
        .filter_map(|row| {
            if row.is_empty() || row[0].is_null() {
                return None;
            }
            let mut obj = serde_json::Map::new();
            for (i, h) in headers.iter().enumerate() {
                obj.insert(h.clone(), row.get(i).cloned().unwrap_or(serde_json::Value::Null));
            }
            Some(serde_json::Value::Object(obj))
        })
        .collect();

    Ok(serde_json::json!({ "headers": headers, "data": data }))
}

/// 获取飞书 tenant token（前端 policy.ts 需要）
/// 自动从环境变量读取凭证，无需前端传参
#[tauri::command]
pub async fn feishu_token() -> Result<String, String> {
    let app_id = get_app_id();
    let app_secret = get_app_secret();
    if app_id.is_empty() || app_secret.is_empty() {
        return Err("FEISHU_APP_ID or FEISHU_APP_SECRET not set".to_string());
    }
    fetch_new_token(&app_id, &app_secret).await
}

/// 通用飞书 sheet 读取（前端 policy.ts 需要）
#[tauri::command]
pub async fn feishu_sheet(
    token: String,
    spreadsheet: String,
    sheet_id: String,
    range: String,
) -> Result<serde_json::Value, String> {
    let rows = fetch_sheet_values(&spreadsheet, &sheet_id, &range, &token).await?;
    Ok(serde_json::json!({ "code": 0, "data": { "valueRange": { "values": rows } } }))
}
