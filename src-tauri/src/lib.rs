use std::{
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Size,
    State, WebviewWindow, WindowEvent,
};
use tauri_plugin_window_state::StateFlags;

const MAIN_WINDOW_LABEL: &str = "main";
const OFFER_WINDOW_LABEL: &str = "offer";
const START_EVENT: &str = "daily-incense:start";
const BURN_DURATION: Duration = Duration::from_secs(45 * 60);
const MAIN_WINDOW_SIZE: (f64, f64) = (240.0, 240.0);
const OFFER_COMPACT_SIZE: (f64, f64) = (122.0, 58.0);
const OFFER_EXPANDED_SIZE: (f64, f64) = (172.0, 256.0);
const OFFER_WINDOW_GAP: i32 = 8;

#[derive(Default)]
struct IncenseRuntime {
    burn_started_at: Mutex<Option<Instant>>,
    window_drag: Mutex<Option<WindowDragState>>,
}

struct WindowDragState {
    label: String,
    screen_x: f64,
    screen_y: f64,
    window_x: i32,
    window_y: i32,
}

impl IncenseRuntime {
    fn mark_burning(&self) {
        if let Ok(mut burn_started_at) = self.burn_started_at.lock() {
            *burn_started_at = Some(Instant::now());
        }
    }

    fn is_burning(&self) -> bool {
        let Ok(mut burn_started_at) = self.burn_started_at.lock() else {
            return true;
        };

        if let Some(started_at) = *burn_started_at {
            if started_at.elapsed() < BURN_DURATION {
                return true;
            }
            *burn_started_at = None;
        }

        false
    }
}

#[tauri::command(rename_all = "snake_case")]
fn start_incense(
    app: AppHandle,
    runtime: State<'_, IncenseRuntime>,
    wish_text: Option<String>,
) -> Result<(), String> {
    match wish_text {
        Some(wish_text) => {
            runtime.mark_burning();
            let _ = hide_labeled_window(&app, OFFER_WINDOW_LABEL);
            emit_start_incense(&app, wish_text)
        }
        None => show_offer_window(app, runtime),
    }
}

#[tauri::command]
fn show_pet_window(app: AppHandle) -> Result<(), String> {
    show_window(&app)
}

#[tauri::command]
fn show_offer_window(app: AppHandle, runtime: State<'_, IncenseRuntime>) -> Result<(), String> {
    if runtime.is_burning() {
        return show_window(&app);
    }

    set_offer_window_mode_inner(&app, "compact")?;
    show_labeled_window(&app, OFFER_WINDOW_LABEL)
}

#[tauri::command]
fn set_offer_window_mode(app: AppHandle, mode: String) -> Result<(), String> {
    set_offer_window_mode_inner(&app, &mode)
}

#[tauri::command(rename_all = "snake_case")]
fn begin_window_drag(
    window: WebviewWindow,
    runtime: State<'_, IncenseRuntime>,
    screen_x: f64,
    screen_y: f64,
) -> Result<(), String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let mut drag = runtime
        .window_drag
        .lock()
        .map_err(|_| "window drag lock is poisoned".to_string())?;
    *drag = Some(WindowDragState {
        label: window.label().to_string(),
        screen_x,
        screen_y,
        window_x: position.x,
        window_y: position.y,
    });
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn move_window_drag(
    window: WebviewWindow,
    runtime: State<'_, IncenseRuntime>,
    screen_x: f64,
    screen_y: f64,
) -> Result<(), String> {
    let drag = runtime
        .window_drag
        .lock()
        .map_err(|_| "window drag lock is poisoned".to_string())?;
    let Some(drag) = drag.as_ref() else {
        return Ok(());
    };
    if drag.label != window.label() {
        return Ok(());
    }

    let x = drag.window_x + (screen_x - drag.screen_x).round() as i32;
    let y = drag.window_y + (screen_y - drag.screen_y).round() as i32;
    window
        .set_position(Position::Physical(PhysicalPosition::new(x, y)))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn end_window_drag(runtime: State<'_, IncenseRuntime>) -> Result<(), String> {
    let mut drag = runtime
        .window_drag
        .lock()
        .map_err(|_| "window drag lock is poisoned".to_string())?;
    *drag = None;
    Ok(())
}

#[tauri::command]
fn hide_pet_window(app: AppHandle) -> Result<(), String> {
    hide_labeled_window(&app, MAIN_WINDOW_LABEL)?;
    hide_labeled_window(&app, OFFER_WINDOW_LABEL)
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(IncenseRuntime::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .setup(|app| {
            setup_tray(app.handle())?;
            enforce_window_sizes(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_incense,
            show_pet_window,
            show_offer_window,
            set_offer_window_mode,
            begin_window_drag,
            move_window_drag,
            end_window_drag,
            hide_pet_window,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let offer = MenuItem::with_id(app, "offer", "上香", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "显示/隐藏", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&offer, &toggle, &quit])?;
    let icon = app.default_window_icon().cloned();

    let mut builder = TrayIconBuilder::with_id("daily-incense")
        .menu(&menu)
        .tooltip("每日上香")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "offer" => {
                let runtime = app.state::<IncenseRuntime>();
                if runtime.is_burning() {
                    let _ = show_window(app);
                } else {
                    let _ = set_offer_window_mode_inner(app, "compact");
                    let _ = show_labeled_window(app, OFFER_WINDOW_LABEL);
                }
            }
            "toggle" => {
                let _ = toggle_window(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = toggle_window(tray.app_handle());
            }
        });

    if let Some(icon) = icon {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

fn emit_start_incense(app: &AppHandle, wish_text: String) -> Result<(), String> {
    show_window(app)?;
    let window = main_window(app)?;
    window
        .emit(START_EVENT, wish_text)
        .map_err(|error| error.to_string())
}

fn toggle_window(app: &AppHandle) -> Result<(), String> {
    let window = main_window(app)?;
    let is_visible = window.is_visible().map_err(|error| error.to_string())?;
    if is_visible {
        window.hide().map_err(|error| error.to_string())
    } else {
        show_window(app)
    }
}

fn show_window(app: &AppHandle) -> Result<(), String> {
    show_labeled_window(app, MAIN_WINDOW_LABEL)
}

fn show_labeled_window(app: &AppHandle, label: &str) -> Result<(), String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("{label} window is not available"))?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn enforce_window_sizes(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window
            .set_size(Size::Logical(LogicalSize::new(
                MAIN_WINDOW_SIZE.0,
                MAIN_WINDOW_SIZE.1,
            )))
            .map_err(|error| error.to_string())?;
    }

    set_offer_window_mode_inner(app, "compact")
}

fn set_offer_window_mode_inner(app: &AppHandle, mode: &str) -> Result<(), String> {
    let window = app
        .get_webview_window(OFFER_WINDOW_LABEL)
        .ok_or_else(|| "offer window is not available".to_string())?;
    let (width, height) = match mode {
        "compact" => OFFER_COMPACT_SIZE,
        "expanded" => OFFER_EXPANDED_SIZE,
        _ => return Err(format!("unsupported offer window mode: {mode}")),
    };

    window
        .set_size(Size::Logical(LogicalSize::new(width, height)))
        .map_err(|error| error.to_string())?;

    position_offer_window_below_main(app, &window)
}

fn position_offer_window_below_main(
    app: &AppHandle,
    offer_window: &WebviewWindow,
) -> Result<(), String> {
    let main_window = main_window(app)?;
    let main_position = main_window
        .outer_position()
        .map_err(|error| error.to_string())?;
    let main_size = main_window
        .outer_size()
        .map_err(|error| error.to_string())?;
    let offer_size = offer_window.outer_size().unwrap_or_else(|_| {
        PhysicalSize::new(OFFER_COMPACT_SIZE.0 as u32, OFFER_COMPACT_SIZE.1 as u32)
    });

    let x = main_position.x + ((main_size.width as i32 - offer_size.width as i32) / 2);
    let y = main_position.y + main_size.height as i32 + OFFER_WINDOW_GAP;

    offer_window
        .set_position(Position::Physical(PhysicalPosition::new(x, y)))
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn hide_labeled_window(app: &AppHandle, label: &str) -> Result<(), String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("{label} window is not available"))?;
    window.hide().map_err(|error| error.to_string())
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "main window is not available".to_string())
}
