use std::sync::Mutex;

use tauri::Manager;
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct ApiSidecar {
    _child: Mutex<Option<CommandChild>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let (mut receiver, child) = app.shell().sidecar("ecas-billing-api")?.spawn()?;
            app.manage(ApiSidecar {
                _child: Mutex::new(Some(child)),
            });

            tauri::async_runtime::spawn(async move {
                while let Some(event) = receiver.recv().await {
                    println!("ECAS API sidecar: {event:?}");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run ECAS legacy billing Tauri app");
}
