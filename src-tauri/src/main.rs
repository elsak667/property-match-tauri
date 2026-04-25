// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri_plugin_dialog::DialogExt;

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

mod feishu;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
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
            feishu::feishu_fetch_properties,
            feishu::feishu_fetch_policies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
