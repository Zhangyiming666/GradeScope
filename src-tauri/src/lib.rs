use std::fs;

/// 读取指定路径的文本文件内容。
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// 把文本内容写入指定路径（覆盖写）。
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, contents).map_err(|e| e.to_string())
}

/// 判断指定路径的文件是否存在。
#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).is_file()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            file_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
