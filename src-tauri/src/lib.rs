#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Polls go through Rust rather than the WebView so the desktop build is not bound by CORS —
    // the same reason the reference app polls from its Electron main process. The URLs this may
    // reach are scoped in `capabilities/default.json`.
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
