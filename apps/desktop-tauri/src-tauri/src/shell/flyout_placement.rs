//! Where the user put the tray-panel flyout.
//!
//! The flyout opens anchored to the tray icon. Once the user drags it
//! somewhere else, that spot is remembered, and every later open and every
//! content-driven resize keeps the panel there instead of snapping it back to
//! the tray. Double-clicking the panel's move handle forgets the spot.
//!
//! A spot is recorded only when a Win32 move/size loop ends
//! (`WM_EXITSIZEMOVE`). Windows runs that loop for user drags of the window
//! or its frame, never for `SetWindowPos`, so the flyout's own re-anchoring
//! can't be mistaken for a user move.

use tauri::Manager;

use crate::geometry_store::{self, StoredGeometry};
use crate::window_positioner::{self, PanelSize};

/// Geometry-store key for the remembered flyout position. Lives in the
/// position `entries` map, separate from the size-only `"flyout"` entry.
const FLYOUT_POSITION_KEY: &str = "flyout";

/// The position the user dragged the flyout to, if any (physical px).
pub fn stored_position() -> Option<(i32, i32)> {
    geometry_store::load_entry(FLYOUT_POSITION_KEY).map(|geometry| (geometry.x, geometry.y))
}

fn save_position(x: i32, y: i32) {
    geometry_store::save_entry(
        FLYOUT_POSITION_KEY,
        StoredGeometry {
            x,
            y,
            width: None,
            height: None,
        },
    );
}

/// Forget the user's spot so the flyout anchors to the tray again.
pub fn clear_position() {
    geometry_store::remove_entry(FLYOUT_POSITION_KEY);
}

/// The remembered position, clamped into the work area of the monitor that
/// holds it (the primary monitor when that one is gone), so a monitor layout
/// change can't leave the panel off-screen. `None` when the user never moved
/// the flyout.
pub fn placed_position(window: &tauri::WebviewWindow) -> Option<(i32, i32)> {
    let (x, y) = stored_position()?;
    let monitor = window
        .monitor_from_point(f64::from(x), f64::from(y))
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())?;
    let outer = window.outer_size().ok()?;
    // The size is already physical, so clamp with a 1.0 scale.
    Some(window_positioner::clamp_position_to_work_area(
        x,
        y,
        &super::geometry::monitor_work_area_rect(&monitor),
        &PanelSize {
            width: outer.width,
            height: outer.height,
        },
        1.0,
    ))
}

/// Whether a mouse button is held with the cursor over the flyout.
///
/// Windows moves focus off the WebView the moment a move or resize starts on
/// the window frame, so the flyout sees a blur before the gesture even
/// begins. A blur while the user is pressing on the panel itself is that
/// gesture, not a click somewhere else.
pub fn pointer_pressed_inside(window: &tauri::Window) -> bool {
    if !mouse_button_down() {
        return false;
    }
    let (Ok(cursor), Ok(origin), Ok(size)) = (
        window.app_handle().cursor_position(),
        window.outer_position(),
        window.outer_size(),
    ) else {
        return false;
    };
    point_in_window(
        (cursor.x, cursor.y),
        (origin.x, origin.y),
        (size.width, size.height),
    )
}

fn point_in_window(point: (f64, f64), origin: (i32, i32), size: (u32, u32)) -> bool {
    let (x, y) = point;
    let left = f64::from(origin.0);
    let top = f64::from(origin.1);
    x >= left && x < left + f64::from(size.0) && y >= top && y < top + f64::from(size.1)
}

/// Outer window bounds in physical px, as `GetWindowRect` reports them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WindowBounds {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

/// One user move/size loop in progress.
#[derive(Debug, Clone, Copy)]
struct SizeMoveLoop {
    start: WindowBounds,
    /// The user dragged an edge (`WM_SIZING`) rather than the whole window.
    /// Compared bounds can't tell: a move onto a monitor with another DPI
    /// rescales the window too.
    resizing: bool,
}

/// The spot to remember after one user move/size loop, if any.
///
/// Dragging the whole window places the flyout. A resize from the top or left
/// edge also moves the window; that only updates the spot once the user has
/// placed the flyout, so resizing a tray-anchored panel keeps it tray-anchored.
fn placement_after_size_move(
    size_move: SizeMoveLoop,
    end: WindowBounds,
    already_placed: bool,
) -> Option<(i32, i32)> {
    let start = size_move.start;
    let moved = (start.left, start.top) != (end.left, end.top);
    (moved && (already_placed || !size_move.resizing)).then_some((end.left, end.top))
}

/// Record user drags of `window` from now on. The subclass must be installed
/// on the thread that owns the window, so this hops to the main thread.
#[cfg(windows)]
pub fn track_user_moves(window: &tauri::WebviewWindow) {
    let Some(hwnd) = super::activation::root_hwnd(window) else {
        tracing::warn!("flyout_placement: no window handle; user moves won't be remembered");
        return;
    };
    let scheduled = window.run_on_main_thread(move || {
        // SAFETY: `hwnd` is the live top-level flyout window and this runs on
        // its owning thread. The subclass proc forwards every message.
        let installed =
            unsafe { SetWindowSubclass(hwnd, size_move_subclass_proc, SIZE_MOVE_SUBCLASS_ID, 0) };
        if installed == 0 {
            tracing::warn!("flyout_placement: SetWindowSubclass failed");
        }
    });
    if let Err(error) = scheduled {
        tracing::warn!(%error, "flyout_placement: couldn't schedule move tracking");
    }
}

#[cfg(not(windows))]
pub fn track_user_moves(_window: &tauri::WebviewWindow) {}

/// Whether the user is dragging the flyout or one of its edges right now.
#[cfg(windows)]
pub fn user_move_in_progress() -> bool {
    SIZE_MOVE.lock().is_ok_and(|size_move| size_move.is_some())
}

#[cfg(not(windows))]
pub fn user_move_in_progress() -> bool {
    false
}

#[cfg(windows)]
const SIZE_MOVE_SUBCLASS_ID: usize = 0xC0DE_F1E0;
#[cfg(windows)]
const WM_ENTERSIZEMOVE: u32 = 0x0231;
#[cfg(windows)]
const WM_EXITSIZEMOVE: u32 = 0x0232;
#[cfg(windows)]
const WM_SIZING: u32 = 0x0214;

/// The move/size loop in progress. There is one flyout window, so one slot
/// is enough.
#[cfg(windows)]
static SIZE_MOVE: std::sync::Mutex<Option<SizeMoveLoop>> = std::sync::Mutex::new(None);

#[cfg(windows)]
unsafe extern "system" fn size_move_subclass_proc(
    hwnd: isize,
    msg: u32,
    wparam: usize,
    lparam: isize,
    _id: usize,
    _data: usize,
) -> isize {
    match msg {
        WM_ENTERSIZEMOVE => {
            if let Ok(mut size_move) = SIZE_MOVE.lock() {
                *size_move = window_bounds(hwnd).map(|start| SizeMoveLoop {
                    start,
                    resizing: false,
                });
            }
        }
        WM_SIZING => {
            if let Ok(mut size_move) = SIZE_MOVE.lock()
                && let Some(size_move) = size_move.as_mut()
            {
                size_move.resizing = true;
            }
        }
        WM_EXITSIZEMOVE => {
            let size_move = SIZE_MOVE
                .lock()
                .ok()
                .and_then(|mut size_move| size_move.take());
            if let (Some(size_move), Some(end)) = (size_move, window_bounds(hwnd))
                && let Some((x, y)) =
                    placement_after_size_move(size_move, end, stored_position().is_some())
            {
                save_position(x, y);
            }
        }
        _ => {}
    }
    // SAFETY: forwards the message this subclass received, unchanged.
    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}

#[cfg(windows)]
fn window_bounds(hwnd: isize) -> Option<WindowBounds> {
    let mut rect = Win32Rect::default();
    // SAFETY: `hwnd` is the live window the subclass is attached to and
    // `rect` is a caller-owned out-parameter.
    if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
        return None;
    }
    Some(WindowBounds {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
    })
}

#[cfg(windows)]
fn mouse_button_down() -> bool {
    // Physical buttons: with swapped buttons the primary one is VK_RBUTTON,
    // so check both.
    const VK_LBUTTON: i32 = 0x01;
    const VK_RBUTTON: i32 = 0x02;
    // SAFETY: GetAsyncKeyState only reads global input state. A negative
    // result means the key is down.
    [VK_LBUTTON, VK_RBUTTON]
        .into_iter()
        .any(|key| unsafe { GetAsyncKeyState(key) } < 0)
}

#[cfg(not(windows))]
fn mouse_button_down() -> bool {
    false
}

#[cfg(windows)]
#[repr(C)]
#[derive(Default)]
struct Win32Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[cfg(windows)]
#[link(name = "user32")]
// SAFETY: FFI declarations for user32 calls; every call site passes the live
// flyout window handle or caller-owned out-parameters.
unsafe extern "system" {
    fn GetAsyncKeyState(key: i32) -> i16;
    fn GetWindowRect(hwnd: isize, rect: *mut Win32Rect) -> i32;
}

#[cfg(windows)]
#[link(name = "comctl32")]
// SAFETY: FFI declarations for the comctl32 subclass API; called with the
// live flyout window handle and a `'static` subclass procedure.
unsafe extern "system" {
    fn SetWindowSubclass(
        hwnd: isize,
        proc: unsafe extern "system" fn(isize, u32, usize, isize, usize, usize) -> isize,
        id: usize,
        data: usize,
    ) -> i32;
    fn DefSubclassProc(hwnd: isize, msg: u32, wparam: usize, lparam: isize) -> isize;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bounds(left: i32, top: i32, width: i32, height: i32) -> WindowBounds {
        WindowBounds {
            left,
            top,
            right: left + width,
            bottom: top + height,
        }
    }

    fn moved(start: WindowBounds) -> SizeMoveLoop {
        SizeMoveLoop {
            start,
            resizing: false,
        }
    }

    fn resized(start: WindowBounds) -> SizeMoveLoop {
        SizeMoveLoop {
            start,
            resizing: true,
        }
    }

    #[test]
    fn dragging_the_window_places_the_flyout() {
        let start = bounds(1936, 511, 300, 873);
        let end = bounds(400, 200, 300, 873);
        assert_eq!(
            placement_after_size_move(moved(start), end, false),
            Some((400, 200))
        );
    }

    #[test]
    fn dragging_onto_a_monitor_with_another_dpi_still_places_the_flyout() {
        // Windows rescales the window on the way (100% -> 225%).
        let start = bounds(1808, 611, 340, 773);
        let end = bounds(600, -1500, 765, 1739);
        assert_eq!(
            placement_after_size_move(moved(start), end, false),
            Some((600, -1500))
        );
    }

    #[test]
    fn resizing_a_tray_anchored_flyout_from_the_top_left_keeps_it_tray_anchored() {
        let start = bounds(1936, 511, 300, 873);
        let end = bounds(1836, 411, 400, 973);
        assert_eq!(placement_after_size_move(resized(start), end, false), None);
    }

    #[test]
    fn resizing_a_placed_flyout_from_the_top_left_follows_its_new_corner() {
        let start = bounds(400, 200, 300, 873);
        let end = bounds(300, 100, 400, 973);
        assert_eq!(
            placement_after_size_move(resized(start), end, true),
            Some((300, 100))
        );
    }

    #[test]
    fn resizing_from_the_bottom_right_never_records_a_spot() {
        let start = bounds(400, 200, 300, 873);
        let end = bounds(400, 200, 360, 900);
        assert_eq!(placement_after_size_move(resized(start), end, true), None);
        assert_eq!(placement_after_size_move(resized(start), end, false), None);
    }

    #[test]
    fn a_drag_that_ends_where_it_started_records_nothing() {
        let start = bounds(400, 200, 300, 873);
        assert_eq!(placement_after_size_move(moved(start), start, false), None);
    }

    #[test]
    fn a_press_on_the_frame_counts_as_inside() {
        let origin = (100, 200);
        let size = (300, 800);
        assert!(point_in_window((100.0, 200.0), origin, size));
        assert!(point_in_window((399.0, 999.0), origin, size));
    }

    #[test]
    fn a_press_outside_the_window_is_not_inside() {
        let origin = (100, 200);
        let size = (300, 800);
        assert!(!point_in_window((400.0, 500.0), origin, size));
        assert!(!point_in_window((99.0, 500.0), origin, size));
        assert!(!point_in_window((200.0, 1000.0), origin, size));
        assert!(!point_in_window((200.0, 199.0), origin, size));
    }
}
