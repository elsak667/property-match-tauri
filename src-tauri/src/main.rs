// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri_plugin_dialog::DialogExt;
use tauri::{WebviewUrl, WebviewWindowBuilder};

static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(0);

fn rand_u64() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64
}

fn make_label() -> String {
    let count = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("print_window_{}_{}", count, rand_u64())
}

fn handle_connection(mut stream: TcpStream, html_content: Arc<String>) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html_content.len(),
        html_content.as_str()
    );
    stream.write_all(response.as_bytes()).ok();
    stream.flush().ok();
}

fn start_server(html_content: String, port: u16) -> String {
    let html_arc = Arc::new(html_content);
    let listener = TcpListener::bind(format!("127.0.0.1:{port}")).expect("Failed to bind port");
    listener.set_nonblocking(true).ok();

    let server_html = html_arc.clone();
    thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    handle_connection(stream, server_html.clone());
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(50));
                }
                Err(_) => break,
            }
        }
    });

    for _ in 0..50 {
        if TcpStream::connect(format!("127.0.0.1:{port}")).is_ok() {
            return format!("http://127.0.0.1:{port}");
        }
        thread::sleep(Duration::from_millis(20));
    }
    panic!("HTTP server failed to start");
}

#[tauri::command]
async fn open_print_window(app: tauri::AppHandle, html: String) -> Result<(), String> {
    let port = (4000..9000)
        .find(|p| TcpListener::bind(format!("127.0.0.1:{p}")).is_ok())
        .ok_or("No available port")?;

    let url_str = start_server(html, port);
    let url = WebviewUrl::External(url::Url::parse(&url_str).map_err(|e| e.to_string())?);

    let label = make_label();
    WebviewWindowBuilder::new(&app, &label, url)
        .title("打印政策")
        .inner_size(1400.0, 1000.0)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn save_pdf_file(app: tauri::AppHandle, data: Vec<u8>, filename: String) -> Result<String, String> {
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .add_filter("PDF 文件", &["pdf"])
        .blocking_save_file();

    let path_str: String = match file_path {
        Some(p) => p.as_path().expect("FilePath should have a valid path").to_string_lossy().into_owned(),
        None => return Err("用户取消".to_string()),
    };

    std::fs::write(&path_str, &data).map_err(|e| e.to_string())?;
    Ok(path_str)
}

#[derive(serde::Serialize)]
struct PolicyStats {
    local_count: i32,
    official_count: i32,
    coverage: String,
    diff: i32,
    source: String,
    official_link: String,
}

#[tauri::command]
async fn get_policy_stats() -> Result<PolicyStats, String> {
    let client = reqwest::Client::new();
    let data_resp = client
        .get("https://pyd.pudong.gov.cn/api/policy/list?page=1&pageSize=1")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let data_text = data_resp.text().await.map_err(|e| e.to_string())?;
    let data_json: serde_json::Value =
        serde_json::from_str(&data_text).map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = data_json
        .pointer("/data/valueRange/values")
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();

    let mut official_count = -1;
    for row in rows.iter().skip(1) {
        if let (Some(name), Some(val)) = (row.get(0), row.get(1)) {
            let n = name.as_str().unwrap_or("");
            if n == "官网政策总数" {
                official_count = val.as_i64().unwrap_or(-1) as i32;
            }
        }
    }

    log::info!("[get_policy_stats] official_count={}", official_count);

    Ok(PolicyStats {
        local_count: -1,
        official_count,
        coverage: "—".to_string(),
        diff: 0,
        source: "浦易达官网".to_string(),
        official_link: "https://pyd.pudong.gov.cn/website/pud/policyretrieval".to_string(),
    })
}

#[tauri::command]
async fn feishu_token(app_id: String, app_secret: String) -> Result<String, String> {
    log::info!("[feishu_token] app_id={}", app_id);
    let client = reqwest::Client::new();
    let resp = client
        .post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal")
        .json(&serde_json::json!({ "app_id": app_id, "app_secret": app_secret }))
        .send()
        .await
        .map_err(|e| { log::error!("[feishu_token] reqwest error: {}", e); e.to_string() })?;
    log::info!("[feishu_token] status={}", resp.status());
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    log::info!("[feishu_token] response={}", body);
    body.get("tenant_access_token")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| body.get("msg").and_then(|m| m.as_str()).unwrap_or("token error").to_string())
}

#[tauri::command]
async fn feishu_sheet(token: String, spreadsheet: String, sheet_id: String, range: String) -> Result<serde_json::Value, String> {
    log::info!("[feishu_sheet] spreadsheet={} sheet={} range={}", spreadsheet, sheet_id, range);
    let client = reqwest::Client::new();
    let url = format!(
        "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{}/values/{}!{}",
        spreadsheet, sheet_id, range
    );
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| { log::error!("[feishu_sheet] reqwest error: {}", e); e.to_string() })?;
    log::info!("[feishu_sheet] status={}", resp.status());
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
    let rows_count = parsed.pointer("/data/valueRange/values").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
    log::info!("[feishu_sheet] rows_count={}", rows_count);
    log::info!("[feishu_sheet] body_snippet={}", text.chars().take(200).collect::<String>());
    serde_json::from_str(&text)
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_print_window,
            save_pdf_file,
            get_policy_stats,
            feishu_token,
            feishu_sheet,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
