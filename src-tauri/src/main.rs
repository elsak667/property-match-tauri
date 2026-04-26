// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::open_url;

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

#[tauri::command]
async fn open_in_browser(_app: tauri::AppHandle, url: String) -> Result<(), String> {
    open_url(&url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_temp_file(data: Vec<u8>, filename: String) -> Result<String, String> {
    let mut path = std::env::temp_dir();
    path.push(&filename);
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
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
async fn get_policy_stats(
    state: tauri::State<'_, feishu::AppState>,
) -> Result<PolicyStats, String> {
    let app_id = feishu::get_app_id();
    let app_secret = feishu::get_app_secret();

    let token = feishu::get_valid_token(&state, &app_id, &app_secret).await
        .map_err(|e| format!("token error: {}", e))?;

    // 拉取政策表前10行，查找"官网政策总数"元数据
    let rows = feishu::fetch_sheet_values(
        feishu::POLICY_SHEET,
        feishu::STATS_SHEET_ID,
        "A1:B10",
        &token,
    ).await.map_err(|e| format!("sheet error: {}", e))?;

    let mut official_count = -1i32;
    let mut data_row_count = 0i32;

    for row in rows.iter() {
        if row.is_empty() { continue; }
        // 第1列是 label，第2列是 value
        if let (Some(name_val), Some(cnt_val)) = (row.get(0), row.get(1)) {
            let name = name_val.as_str().unwrap_or("");
            if name == "官网政策总数" {
                if let Some(n) = cnt_val.as_i64() {
                    official_count = n as i32;
                }
            } else if name == "数据行数" {
                if let Some(n) = cnt_val.as_i64() {
                    data_row_count = n as i32;
                }
            }
        }
    }

    // 备用：如果没找到元数据，用行数估算
    if official_count < 0 {
        official_count = data_row_count.max(0);
    }

    Ok(PolicyStats {
        local_count: -1,
        official_count,
        coverage: "—".to_string(),
        diff: 0,
        source: "浦易达官网".to_string(),
        official_link: "https://pyd.pudong.gov.cn/website/pud/policyretrieval".to_string(),
    })
}

mod feishu;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .manage(Mutex::new(feishu::TokenCache::default()))
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
            save_pdf_file,
            feishu::feishu_config,
            feishu::feishu_debug,
            feishu::feishu_fetch_policies,
            feishu::feishu_token,
            feishu::feishu_sheet,
            open_in_browser,
            write_temp_file,
            get_policy_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
