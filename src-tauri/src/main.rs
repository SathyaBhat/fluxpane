// Prevents additional console window on Windows in release mode, disable if you want to see console output
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
    WindowEvent,
};

/// Shows and focuses the main window.
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// tao's app delegate doesn't handle Dock-icon clicks, so add
/// `applicationShouldHandleReopen:hasVisibleWindows:` to it at runtime.
#[cfg(target_os = "macos")]
fn install_dock_reopen_handler(app: tauri::AppHandle) {
    use objc::runtime::{class_addMethod, Class, Object, Sel, BOOL, YES};
    use objc::{sel, sel_impl};
    use std::sync::OnceLock;

    static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
    let _ = APP.set(app);

    extern "C" fn should_handle_reopen(_: &Object, _: Sel, _: *mut Object, _: BOOL) -> BOOL {
        if let Some(app) = APP.get() {
            show_main_window(app);
        }
        YES
    }

    unsafe {
        if let Some(class) = Class::get("TaoAppDelegate") {
            let imp: extern "C" fn(&Object, Sel, *mut Object, BOOL) -> BOOL = should_handle_reopen;
            class_addMethod(
                class as *const Class as *mut Class,
                sel!(applicationShouldHandleReopen:hasVisibleWindows:),
                std::mem::transmute(imp),
                b"c@:@c\0".as_ptr() as *const _,
            );
        }
    }
}

fn main() {
    // System tray menu
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            install_dock_reopen_handler(_app.handle());
            Ok(())
        })
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => show_main_window(app),
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        // Closing the window hides it instead of destroying it, so the tray's
        // "Show" item or the Dock icon can bring it back.
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                api.prevent_close();
                let _ = event.window().hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {});
}
