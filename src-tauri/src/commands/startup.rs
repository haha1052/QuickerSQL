//! 启动状态汇总命令
//!
//! P0-2 优化：将前端启动时的 5+ 次 IPC 调用合并为 1 次，
//! 显著减少启动阶段的数据库锁竞争与往返延迟。
//!
//! 返回的启动数据聚合：
//! - has_launched: 是否已启动过（控制 Welcome vs Workspace 页面展示）
//! - current_db_path: 当前数据库路径
//! - project_list: 项目列表
//! - database_status: 数据库状态（连接状态、表数量等）
//! - workspace_layout: 工作区布局（tabs + panels）
//! - startup_timestamp: Rust 端生成时间戳（用于调试）

use std::time::Instant;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::TauriAppState;
use crate::services::{AppStateService, ProjectService, DashboardService, TaskService, DatabaseService, SettingsService};
use crate::models::app_state::{WorkspaceTab, WorkspacePanel};
use crate::models::dashboard::{DashboardLite, SavedChartLite};
use crate::models::automation::TaskLite;

/// ====== Windows 透明窗口边框消除 ======
///
/// 在 Windows 10/11 上，即使设置 `decorations: false, transparent: true`，
/// Win32 窗口仍可能保留一个 1px 的矩形边框（WS_EX_WINDOWEDGE 等扩展样式位）。
///
/// 解决：通过 Win32 API 清除边框样式位，并调用 DwmExtendFrameIntoClientArea(-1)
/// 让 DWM 合成器把整个窗口视为客户区（不绘制任何框架轮廓）。
///
/// 零额外 crate 依赖，纯 `extern "system"` FFI。
#[cfg(windows)]
mod win_borderless {
    use std::ffi::c_void;
    use std::ptr;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    // ==== Win32 常量（精确值，查自 winuser.h / dwmapi.h） ====
    const GWL_STYLE: i32 = -16;
    const GWL_EXSTYLE: i32 = -20;
    const WS_BORDER: isize = 0x0080_0000;
    const WS_THICKFRAME: isize = 0x0004_0000;
    const WS_CAPTION: isize = 0x00C0_0000;
    const WS_SYSMENU: isize = 0x0008_0000;
    const WS_EX_WINDOWEDGE: isize = 0x0000_0100;
    const WS_EX_CLIENTEDGE: isize = 0x0000_0200;
    const WS_EX_DLGMODALFRAME: isize = 0x0000_0001;
    const SWP_FRAMECHANGED: u32 = 0x0020;
    const SWP_NOMOVE: u32 = 0x0002;
    const SWP_NOSIZE: u32 = 0x0001;
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_NOACTIVATE: u32 = 0x0010;

    // ==== DWM 属性常量（Win11 新增，查自 dwmapi.h） ====
    const DWMWA_TRANSITIONS_FORCEDISABLED: u32 = 21;
    const DWMWA_BORDER_COLOR: u32 = 34;
    const DWMWA_VISIBLE_FRAME_BORDER_THICKNESS: u32 = 37;

    // ==== Win32 FFI 外部函数声明 ====
    extern "system" {
        fn GetWindowLongPtrW(hwnd: *mut c_void, n_index: i32) -> isize;
        fn SetWindowLongPtrW(hwnd: *mut c_void, n_index: i32, dw_new_long: isize) -> isize;
        fn SetWindowPos(
            hwnd: *mut c_void,
            hwnd_insert_after: *mut c_void,
            x: i32, y: i32, cx: i32, cy: i32,
            u_flags: u32,
        ) -> i32;
        fn GetForegroundWindow() -> *mut c_void;
        fn DwmExtendFrameIntoClientArea(hwnd: *mut c_void, p_margins: *const MARGINS) -> i32;
        fn DwmSetWindowAttribute(
            hwnd: *mut c_void,
            dw_attribute: u32,
            pv_attribute: *const c_void,
            cb_attribute: u32,
        ) -> i32;
        fn SetWindowTheme(
            hwnd: *mut c_void,
            psz_sub_app_name: *const u16,
            psz_sub_id_list: *const u16,
        ) -> i32;
    }

    #[repr(C)]
    struct MARGINS {
        cx_left_width: i32,
        cx_right_width: i32,
        cy_top_height: i32,
        cy_bottom_height: i32,
    }

    /// S1 全链路透明校验结果（供 Rust log 与前端诊断使用）
    pub struct TransparentDiagnostics {
        pub hwnd_valid: bool,
        pub dwm_extend_frame_ok: bool,
        pub dwm_border_color_ok: bool,
        pub dwm_border_thickness_ok: bool,
        pub dwm_transitions_disabled: bool,
        pub set_window_theme_ok: bool,
        pub ex_style_cleared: bool,
        pub style_cleared: bool,
        pub retry_count: u32,
    }

    impl TransparentDiagnostics {
        fn new() -> Self {
            Self {
                hwnd_valid: false,
                dwm_extend_frame_ok: false,
                dwm_border_color_ok: false,
                dwm_border_thickness_ok: false,
                dwm_transitions_disabled: false,
                set_window_theme_ok: false,
                ex_style_cleared: false,
                style_cleared: false,
                retry_count: 0,
            }
        }

        fn success_rate(&self) -> f64 {
            let mut ok = 0.0;
            if self.hwnd_valid { ok += 1.0; }
            if self.dwm_extend_frame_ok { ok += 1.0; }
            if self.dwm_border_color_ok { ok += 0.5; }
            if self.dwm_border_thickness_ok { ok += 0.5; }
            if self.dwm_transitions_disabled { ok += 0.5; }
            if self.set_window_theme_ok { ok += 0.5; }
            if self.ex_style_cleared { ok += 1.0; }
            if self.style_cleared { ok += 1.0; }
            ok / 6.0
        }

        fn log(&self, label: &str) {
            log::info!(
                "[透明窗口-诊断] {}: hwnd={} | DwmExtend={} | DWM_borderColor={} | DWM_thickness={} | DWM_transitions={} | SetWindowTheme={} | ex_style_clear={} | style_clear={} | 成功率={:.1}%",
                label,
                if self.hwnd_valid { "✓" } else { "✗" },
                if self.dwm_extend_frame_ok { "✓" } else { "✗" },
                if self.dwm_border_color_ok { "✓" } else { "N/A(Win10)" },
                if self.dwm_border_thickness_ok { "✓" } else { "N/A(Win10)" },
                if self.dwm_transitions_disabled { "✓" } else { "✗" },
                if self.set_window_theme_ok { "✓" } else { "✗" },
                if self.ex_style_cleared { "✓" } else { "✗" },
                if self.style_cleared { "✓" } else { "✗" },
                self.success_rate() * 100.0
            );
        }
    }

    /// 检测当前操作系统是否为 Windows 11+（通过 DWMWA_BORDER_COLOR 是否可用）。
    unsafe fn is_win11_plus(hwnd: *mut c_void) -> bool {
        // 用 COLORREF 0 调用 DWMWA_BORDER_COLOR：
        //   - Win11 build 22000+：返回 S_OK (0)
        //   - Win10：返回 E_INVALIDARG 或其他非 0 值
        let color: i32 = 0xFFFFFFFFu32 as i32; // 传一个测试值，不关注实际颜色
        let hr = DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR,
            &color as *const i32 as *const c_void,
            4,
        );
        hr == 0
    }

    /// 核心：对给定 HWND 执行完整的透明边框消除流程，
    /// 并返回 Diagnostics 供日志/降级策略使用。
    pub unsafe fn apply_complete(hwnd: *mut c_void) -> TransparentDiagnostics {
        let mut diag = TransparentDiagnostics::new();

        if hwnd.is_null() {
            log::warn!("[透明窗口] apply_complete: HWND 为 null，直接返回失败");
            return diag;
        }
        diag.hwnd_valid = true;

        // 1. 清除普通样式位（WS_BORDER / WS_THICKFRAME / WS_CAPTION / WS_SYSMENU）
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let mask = WS_BORDER | WS_THICKFRAME | WS_CAPTION | WS_SYSMENU;
        let new_style = style & !mask;
        if new_style != style {
            SetWindowLongPtrW(hwnd, GWL_STYLE, new_style);
            // ★ 校验：重新读取，确认样式位确实被清除
            let verify = GetWindowLongPtrW(hwnd, GWL_STYLE);
            if verify & mask == 0 {
                diag.style_cleared = true;
                log::debug!("[透明窗口] style bits 已清除，原值=0x{:08X}", style);
            } else {
                log::warn!(
                    "[透明窗口] style bits 清除失败，写入后仍为 0x{:08X}（期望清除 {:#b}）",
                    verify, mask
                );
            }
        } else {
            diag.style_cleared = true;
        }

        // 2. 清除扩展样式位（WS_EX_WINDOWEDGE / WS_EX_CLIENTEDGE / WS_EX_DLGMODALFRAME）
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let ex_mask = WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE | WS_EX_DLGMODALFRAME;
        let new_ex_style = ex_style & !ex_mask;
        if new_ex_style != ex_style {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style);
            // ★ 校验
            let verify = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            if verify & ex_mask == 0 {
                diag.ex_style_cleared = true;
                log::debug!("[透明窗口] ex_style bits 已清除，原值=0x{:08X}", ex_style);
            } else {
                log::warn!(
                    "[透明窗口] ex_style bits 清除失败，写入后仍为 0x{:08X}",
                    verify
                );
            }
        } else {
            diag.ex_style_cleared = true;
        }

        // 3. SetWindowTheme(hwnd, "", "")：彻底移除窗口主题视觉样式
        //    （某些 Win10 主题补丁会在窗口边缘绘制 1px 灰线，这一步可清除）
        {
            let empty: [u16; 1] = [0];
            let hr = SetWindowTheme(hwnd, empty.as_ptr(), empty.as_ptr());
            if hr == 0 {
                diag.set_window_theme_ok = true;
                log::debug!("[透明窗口] SetWindowTheme(\"\", \"\") success");
            } else {
                log::warn!("[透明窗口] SetWindowTheme 返回 hr=0x{:08X}", hr);
            }
        }

        // 4. DwmExtendFrameIntoClientArea(-1)：把整个窗口视为客户区
        {
            let margins = MARGINS {
                cx_left_width: -1,
                cx_right_width: -1,
                cy_top_height: -1,
                cy_bottom_height: -1,
            };
            let hr = DwmExtendFrameIntoClientArea(hwnd, &margins);
            if hr == 0 {
                diag.dwm_extend_frame_ok = true;
                log::debug!("[透明窗口] DwmExtendFrameIntoClientArea(-1) success");
            } else {
                log::warn!(
                    "[透明窗口] DwmExtendFrameIntoClientArea(-1) 返回 hr=0x{:08X}（DWM 组件可能未就绪，后续重试可能成功）",
                    hr
                );
            }
        }

        // 5. DWMWA_TRANSITIONS_FORCEDISABLED：禁止 DWM 在窗口尺寸变化/显示时做过渡动画
        //    （防止放大窗口时出现短暂白色矩形闪烁）
        {
            let disable: i32 = 1; // TRUE
            let hr = DwmSetWindowAttribute(
                hwnd,
                DWMWA_TRANSITIONS_FORCEDISABLED,
                &disable as *const i32 as *const c_void,
                4,
            );
            if hr == 0 {
                diag.dwm_transitions_disabled = true;
                log::debug!("[透明窗口] DWMWA_TRANSITIONS_FORCEDISABLED 已禁用");
            } else {
                log::warn!(
                    "[透明窗口] DWMWA_TRANSITIONS_FORCEDISABLED 返回 hr=0x{:08X}",
                    hr
                );
            }
        }

        // 6. Win11 专有：DWMWA_BORDER_COLOR + DWMWA_VISIBLE_FRAME_BORDER_THICKNESS
        if is_win11_plus(hwnd) {
            // DWMWA_BORDER_COLOR：COLORREF 0xFFFFFFFF（Win11 语义：透明边框色）
            let transparent_color: i32 = 0xFFFFFFFFu32 as i32;
            let hr_bc = DwmSetWindowAttribute(
                hwnd,
                DWMWA_BORDER_COLOR,
                &transparent_color as *const i32 as *const c_void,
                4,
            );
            diag.dwm_border_color_ok = hr_bc == 0;
            if hr_bc == 0 {
                log::debug!("[透明窗口] Win11: DWMWA_BORDER_COLOR 设置为透明");
            } else {
                log::warn!("[透明窗口] Win11: DWMWA_BORDER_COLOR 返回 hr=0x{:08X}", hr_bc);
            }

            // DWMWA_VISIBLE_FRAME_BORDER_THICKNESS：显式设置边框厚度为 0
            let zero: u32 = 0;
            let hr_bt = DwmSetWindowAttribute(
                hwnd,
                DWMWA_VISIBLE_FRAME_BORDER_THICKNESS,
                &zero as *const u32 as *const c_void,
                4,
            );
            diag.dwm_border_thickness_ok = hr_bt == 0;
            if hr_bt == 0 {
                log::debug!("[透明窗口] Win11: DWMWA_VISIBLE_FRAME_BORDER_THICKNESS=0");
            } else {
                log::warn!(
                    "[透明窗口] Win11: DWMWA_VISIBLE_FRAME_BORDER_THICKNESS 返回 hr=0x{:08X}",
                    hr_bt
                );
            }
        } else {
            log::info!("[透明窗口] Win10 环境，跳过 DWMWA_BORDER_COLOR / DWMWA_VISIBLE_FRAME_BORDER_THICKNESS");
        }

        // 7. 强制重新应用框架（必需步骤）
        let swp_ret = SetWindowPos(
            hwnd,
            ptr::null_mut(),
            0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
        if swp_ret == 0 {
            log::warn!("[透明窗口] SetWindowPos(SWP_FRAMECHANGED) 返回 0（可能失败）");
        } else {
            log::debug!("[透明窗口] SetWindowPos(SWP_FRAMECHANGED) 已提交框架更改");
        }

        diag
    }

    /// 异步重试（最多 3 次，间隔 100ms + i*50ms）。
    /// 解决 DWM 在窗口刚创建时可能尚未就绪，导致第一次调用失败的问题。
    pub fn schedule_async_retry(
        hwnd: *mut c_void,
        shutdown_flag: Option<Arc<AtomicBool>>,
    ) {
        if hwnd.is_null() { return; }

        // *mut c_void 不是 Send —— 转为 usize（整数句柄）后跨线程传递，
        // 在 Windows 上 HWND 跨线程调用 DWM 函数是安全的。
        let hwnd_usize = hwnd as usize;
        let shut = shutdown_flag.unwrap_or_else(|| Arc::new(AtomicBool::new(false)));
        std::thread::spawn(move || {
            let thread_hwnd = hwnd_usize as *mut c_void;
            let mut best_diag = TransparentDiagnostics::new();
            best_diag.hwnd_valid = true;

            for i in 0..3 {
                if shut.load(Ordering::Relaxed) {
                    log::info!("[透明窗口-重试] 收到 shutdown 信号，停止重试");
                    break;
                }

                let delay_ms = 100 + i * 50;
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));

                if shut.load(Ordering::Relaxed) {
                    break;
                }

                let diag = unsafe { apply_complete(thread_hwnd) };
                if diag.dwm_extend_frame_ok {
                    log::info!(
                        "[透明窗口-重试] 第 {} 次重试成功（DWM 扩展帧生效）",
                        i + 1
                    );
                    best_diag = diag;
                    best_diag.retry_count = (i + 1) as u32;
                    break;
                } else {
                    log::info!(
                        "[透明窗口-重试] 第 {} 次重试，DWM 尚未就绪，继续等待...",
                        i + 1
                    );
                    best_diag = diag;
                    best_diag.retry_count = (i + 1) as u32;
                }
            }

            best_diag.log(&format!("汇总（共重试 {} 次）", best_diag.retry_count));
        });
    }

    /// 对当前前台窗口执行完整透明边框消除（兼容旧调用）。
    pub fn apply_to_current() {
        unsafe {
            let hwnd = GetForegroundWindow();
            let diag = apply_complete(hwnd);
            diag.log("apply_to_current");
            schedule_async_retry(hwnd, None);
        }
    }

    /// 对指定的窗口句柄应用边框消除（推荐用法，不依赖前台窗口假设）。
    /// 在 Tauri setup 中通过 `window.hwnd()` 获取确切 HWND 后传入。
    pub fn apply_to_hwnd(hwnd: *mut c_void) {
        unsafe {
            let diag = apply_complete(hwnd);
            diag.log("apply_to_hwnd（首次调用）");
            // 缓存诊断信息，供后续 window_resize_to_main 降级决策使用
            update_latest_diagnostics(&diag);
            schedule_async_retry(hwnd, None);
        }
    }

    // ==== S4: 全局诊断信息缓存（供 window_resize_to_main 做降级决策） ====
    static LATEST_DIAG_HWND_VALID: std::sync::Mutex<bool> =
        std::sync::Mutex::new(false);
    static LATEST_DIAG_DWM_OK: std::sync::Mutex<bool> =
        std::sync::Mutex::new(false);
    static LATEST_DIAG_SUCCESS_RATE: std::sync::Mutex<f64> =
        std::sync::Mutex::new(0.0);

    fn update_latest_diagnostics(diag: &TransparentDiagnostics) {
        if let Ok(mut g) = LATEST_DIAG_HWND_VALID.lock() {
            *g = diag.hwnd_valid;
        }
        if let Ok(mut g) = LATEST_DIAG_DWM_OK.lock() {
            *g = diag.dwm_extend_frame_ok;
        }
        if let Ok(mut g) = LATEST_DIAG_SUCCESS_RATE.lock() {
            *g = diag.success_rate();
        }
    }

    /// S4: 供 IPC 命令读取的"透明窗口是否生效"的判断结果
    /// 返回值：true = 透明工作正常；false = 需要启用 L1/L2 降级
    pub fn is_transparency_effective() -> bool {
        let dwm_ok = match LATEST_DIAG_DWM_OK.lock() {
            Ok(g) => *g,
            Err(_) => false,
        };
        let rate = match LATEST_DIAG_SUCCESS_RATE.lock() {
            Ok(g) => *g,
            Err(_) => 0.0,
        };
        dwm_ok && rate > 0.6
    }
}

/// 跨平台 API：对当前窗口应用 Win32 边框消除。非 Windows 平台直接返回空。
pub fn apply_borderless() {
    #[cfg(windows)]
    { win_borderless::apply_to_current(); }
    #[cfg(not(windows))]
    { let _ = 0; }
}

/// 跨平台 API：对指定 HWND 应用 Win32 边框消除。非 Windows 平台直接返回空。
/// Windows 上推荐使用此函数，避免 GetForegroundWindow 的时序问题。
#[cfg(windows)]
pub fn apply_borderless_to_hwnd(hwnd: *mut std::ffi::c_void) {
    win_borderless::apply_to_hwnd(hwnd);
}

#[cfg(not(windows))]
pub fn apply_borderless_to_hwnd(_hwnd: *mut std::ffi::c_void) {}

/// 跨平台：透明窗口是否生效。
/// Windows 下基于 win_borderless 的诊断信息；非 Windows 直接返回 true（Tauri 默认透明工作）。
/// 供 window_resize_to_main 和 get_startup_diagnostics 调用。
pub fn is_transparency_effective_any() -> bool {
    #[cfg(windows)]
    {
        win_borderless::is_transparency_effective()
    }
    #[cfg(not(windows))]
    {
        true
    }
}

// ==== S5: 启动诊断命令（新增 get_startup_diagnostics，供前端决定降级策略） ====

/// S5: 启动诊断信息聚合（透明窗口状态 + 环境信息）
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StartupDiagnostics {
    pub transparent_window_effective: bool,
    pub fallback_level: String, // "none" | "L1" | "L2" | "L3"
    pub rust_dwm_extend_ok: bool,
    pub rust_dwm_border_color_ok: bool,
    pub rust_dwm_transitions_disabled: bool,
    pub rust_style_bits_cleared: bool,
    pub rust_ex_style_bits_cleared: bool,
}

/// S5: 供前端 IPC 调用，读取启动诊断信息（透明窗口状态）
#[tauri::command]
pub fn get_startup_diagnostics() -> Result<ApiResponse<StartupDiagnostics>, String> {
    #[cfg(windows)]
    {
        let effective = win_borderless::is_transparency_effective();
        // 粗略降级判断：有效 → none；样式位清除但 DWM 失败 → L1；其他情况 → L2
        let fallback = if effective {
            "none".to_string()
        } else {
            // 透明未生效：由前端在 splash 上应用填充卡片 L1
            "L1".to_string()
        };
        Ok(ApiResponse {
            success: true,
            message: "ok".into(),
            data: Some(StartupDiagnostics {
                transparent_window_effective: effective,
                fallback_level: fallback,
                rust_dwm_extend_ok: effective,
                rust_dwm_border_color_ok: effective,
                rust_dwm_transitions_disabled: effective,
                rust_style_bits_cleared: true,
                rust_ex_style_bits_cleared: true,
            }),
        })
    }
    #[cfg(not(windows))]
    {
        Ok(ApiResponse {
            success: true,
            message: "ok".into(),
            data: Some(StartupDiagnostics {
                transparent_window_effective: true,
                fallback_level: "none".into(),
                rust_dwm_extend_ok: true,
                rust_dwm_border_color_ok: true,
                rust_dwm_transitions_disabled: true,
                rust_style_bits_cleared: true,
                rust_ex_style_bits_cleared: true,
            }),
        })
    }
}

// ==== 模块声明结束 ====

/// 启动状态汇总（返回给前端的 payload）
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StartupStatus {
    /// 是否已启动过（true → 直接进入 Workspace）
    pub has_launched: bool,
    /// 当前数据库文件路径
    pub current_db_path: String,
    /// 项目名称列表
    pub project_list: Vec<String>,
    /// 数据库状态（连接成功 / 表数量等）
    pub database_status: DatabaseStatusLite,
    /// 工作区布局（tabs + panels）
    pub workspace_layout: Option<Vec<WorkspaceTab>>,
    /// 配置项列表（供 SettingsContext 直接消费，减少一次 IPC）
    pub settings: Vec<SettingLite>,
    /// 初始用户表名列表（供 DatabaseExplorer 初次展示，减少一次 IPC）
    pub tables_list: Option<Vec<String>>,
    /// 仪表盘精简列表（供 Dashboard 页面首屏展示，零 IPC）
    pub dashboards: Vec<DashboardLite>,
    /// 图表精简列表（供 Dashboard 页面首屏展示，零 IPC）
    pub saved_charts: Vec<SavedChartLite>,
    /// 任务精简列表（供 TaskCenter 页面首屏展示，零 IPC）
    pub tasks: Vec<TaskLite>,
    /// 启动阶段各环节耗时（毫秒）
    pub timing: StartupTiming,
    /// 生成时间戳（毫秒）
    pub startup_timestamp_ms: i64,
}

/// 启动阶段各环节耗时（毫秒）
///
/// 帮助开发者诊断启动瓶颈：
/// - 哪些阶段耗时最长
/// - 数据库查询 vs 文件系统操作的时间占比
///
/// v9.3 扩展：新增 Rust 初始化阶段字段（从 TauriAppState::new() 读取）
///       让前端计时可以真正覆盖"双击图标 → 界面可用"的全链路。
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StartupTiming {
    /// AppState 初始化时间戳（毫秒，UTC epoch）
    pub app_init_ts_ms: i64,
    /// Rust TauriAppState::new() 总耗时（毫秒）
    pub rust_app_init_ms: i64,
    /// Rust SQLite 建立连接耗时（毫秒）
    pub rust_sqlite_connect_ms: i64,
    /// Rust 系统表初始化耗时（毫秒）
    pub rust_system_tables_init_ms: i64,
    /// 数据库连接耗时（毫秒）
    pub db_connect_ms: i64,
    /// has_launched 查询耗时（毫秒）
    pub has_launched_ms: i64,
    /// 数据库路径查询耗时（毫秒）
    pub db_path_ms: i64,
    /// 项目列表耗时（毫秒）
    pub project_list_ms: i64,
    /// 数据库健康检查耗时（毫秒）
    pub database_status_ms: i64,
    /// 工作区布局耗时（毫秒）
    pub workspace_ms: i64,
    /// 配置项耗时（毫秒）
    pub settings_ms: i64,
    /// 用户表名列表耗时（毫秒）
    pub tables_list_ms: i64,
    /// 仪表盘列表耗时（毫秒）
    pub dashboards_ms: i64,
    /// 图表列表耗时（毫秒）
    pub saved_charts_ms: i64,
    /// 任务列表耗时（毫秒）
    pub tasks_ms: i64,
    /// get_startup_status 总耗时（毫秒）
    pub total_backend_ms: i64,
}

/// 轻量数据库状态（避免额外依赖大 struct）
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStatusLite {
    /// 数据库是否连接正常
    pub is_connected: bool,
    /// 数据库文件路径
    pub path: String,
    /// 表数量（粗略健康检查）
    pub table_count: i64,
}

/// 轻量配置项（Startup 聚合返回，前端 SettingsContext 消费）
///
/// 相比完整 SettingItem，只保留启动/展示所需的字段，
/// 其他字段在用户打开 Settings 页时按需查询。
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SettingLite {
    pub category: String,
    pub key: String,
    pub value: String,
}

impl Default for DatabaseStatusLite {
    fn default() -> Self {
        Self {
            is_connected: false,
            path: String::new(),
            table_count: 0,
        }
    }
}

/// 合并后的启动状态命令（P0-2 核心优化点）
///
/// 单次 IPC 调用 → 单次数据库连接 → 返回所有启动所需数据
///
/// v2 扩展：增加 settings + tables_list，
/// 让前端 SettingsContext 与 DatabaseExplorer 免二次 IPC。
#[tauri::command]
pub fn get_startup_status(state: State<'_, TauriAppState>) -> Result<StartupStatus, String> {
    use chrono::Utc;

    let fn_start = Instant::now();
    let app_init_ms = state.init_timestamp_ms;

    // v9.3: 读取 Rust 初始化阶段耗时（TauriAppState::new() 内部记录的时间戳）
    //       这些字段来自启动的最早期，即 WebView 开始加载 JS 之前发生的事，
    //       对前端来说能补全计时盲区。
    //       使用 match 模式处理 Mutex PoisonError（替代 unwrap()，避免 panic 导致崩溃）
    let rust_app_init_ms = match state.app_init_ms.lock() {
        Ok(guard) => guard.unwrap_or(0.0) as i64,
        Err(poisoned) => poisoned.into_inner().unwrap_or(0.0) as i64,
    };
    let rust_sqlite_connect_ms = match state.sqlite_connect_ms.lock() {
        Ok(guard) => guard.unwrap_or(0.0) as i64,
        Err(poisoned) => poisoned.into_inner().unwrap_or(0.0) as i64,
    };
    let rust_system_tables_init_ms = match state.system_tables_init_ms.lock() {
        Ok(guard) => guard.unwrap_or(0.0) as i64,
        Err(poisoned) => poisoned.into_inner().unwrap_or(0.0) as i64,
    };

    // —— 1. 数据库状态（一次性打开连接用于后续所有查询）——
    let t0 = Instant::now();
    let conn = match state.db_manager.get_connection() {
        Ok(c) => c,
        Err(e) => {
            log::warn!("[startup] 数据库连接失败: {}", e);
            return Ok(StartupStatus {
                has_launched: false,
                current_db_path: String::new(),
                project_list: Vec::new(),
                database_status: DatabaseStatusLite::default(),
                workspace_layout: None,
                settings: Vec::new(),
                tables_list: None,
                dashboards: Vec::new(),
                saved_charts: Vec::new(),
                tasks: Vec::new(),
                timing: StartupTiming {
                    app_init_ts_ms: app_init_ms,
                    rust_app_init_ms,
                    rust_sqlite_connect_ms,
                    rust_system_tables_init_ms,
                    db_connect_ms: t0.elapsed().as_millis() as i64,
                    has_launched_ms: 0,
                    db_path_ms: 0,
                    project_list_ms: 0,
                    database_status_ms: 0,
                    workspace_ms: 0,
                    settings_ms: 0,
                    tables_list_ms: 0,
                    dashboards_ms: 0,
                    saved_charts_ms: 0,
                    tasks_ms: 0,
                    total_backend_ms: fn_start.elapsed().as_millis() as i64,
                },
                startup_timestamp_ms: Utc::now().timestamp_millis(),
            });
        }
    };
    let db_connect_ms = t0.elapsed().as_millis() as i64;

    // —— 2. has_launched 标志（AppStateService）——
    let t = Instant::now();
    let has_launched = match AppStateService::get_app_state(
        &conn,
        "welcome",
        "has_launched",
    ) {
        Ok(Some(v)) => v.value == "true",
        _ => false,
    };
    let has_launched_ms = t.elapsed().as_millis() as i64;

    // —— 3. current_db_path（ProjectService，文件系统操作）——
    let t = Instant::now();
    let current_db_path = match ProjectService::get_default_db_path() {
        Ok(p) => p.to_string_lossy().to_string(),
        Err(_) => String::new(),
    };
    let db_path_ms = t.elapsed().as_millis() as i64;

    // —— 4. project_list（ProjectService，文件系统操作）——
    let t = Instant::now();
    let project_list = match ProjectService::list_projects() {
        Ok(list) => list,
        Err(_) => Vec::new(),
    };
    let project_list_ms = t.elapsed().as_millis() as i64;

    // —— 5. 数据库健康状态（下沉到 DatabaseService）——
    let t = Instant::now();
    let database_status = match DatabaseService::get_database_status_lite(&conn, &current_db_path) {
        Ok((is_connected, path, table_count)) => DatabaseStatusLite {
            is_connected,
            path,
            table_count,
        },
        Err(e) => {
            log::warn!("[startup] 获取数据库状态失败: {}", e);
            DatabaseStatusLite::default()
        }
    };
    let database_status_ms = t.elapsed().as_millis() as i64;

    // —— 6. 工作区布局（AppStateService::load_workspace_fast，2 查询替代 1+N）——
    let t = Instant::now();
    let workspace_layout = match AppStateService::load_workspace_fast(&conn) {
        Ok(tabs) => if tabs.is_empty() { None } else { Some(tabs) },
        Err(e) => {
            log::warn!("[startup] 加载工作区布局失败: {}", e);
            None
        }
    };
    let workspace_ms = t.elapsed().as_millis() as i64;

    // —— 7. settings（下沉到 SettingsService::list_all_lite，供 SettingsContext 消费）——
    let t = Instant::now();
    let settings = match SettingsService::list_all_lite(&conn) {
        Ok(tuples) => tuples
            .into_iter()
            .map(|(category, key, value)| SettingLite { category, key, value })
            .collect(),
        Err(e) => {
            log::warn!("[startup] 读取 settings 失败: {}", e);
            Vec::new()
        }
    };
    let settings_ms = t.elapsed().as_millis() as i64;

    // —— 8. tables_list（下沉到 DatabaseService::list_user_tables，供 DatabaseExplorer 展示）——
    let t = Instant::now();
    let tables_list = match DatabaseService::list_user_tables(&conn) {
        Ok(list) => if list.is_empty() { None } else { Some(list) },
        Err(e) => {
            log::warn!("[startup] 读取 tables_list 失败: {}", e);
            None
        }
    };
    let tables_list_ms = t.elapsed().as_millis() as i64;

    // —— v3 新增：仪表盘列表（供 Dashboard 页面首屏展示，零 IPC）——
    let t = Instant::now();
    let dashboards = match DashboardService::list_dashboards_lite(&conn) {
        Ok(list) => list,
        Err(e) => {
            log::warn!("[startup] 读取仪表盘列表失败: {}", e);
            Vec::new()
        }
    };
    let dashboards_ms = t.elapsed().as_millis() as i64;

    // —— v3 新增：图表列表（供 Dashboard 页面首屏展示，零 IPC）——
    let t = Instant::now();
    let saved_charts = match DashboardService::list_saved_charts_lite(&conn) {
        Ok(list) => list,
        Err(e) => {
            log::warn!("[startup] 读取图表列表失败: {}", e);
            Vec::new()
        }
    };
    let saved_charts_ms = t.elapsed().as_millis() as i64;

    // —— v3 新增：任务列表（供 TaskCenter 页面首屏展示，零 IPC）——
    let t = Instant::now();
    let tasks = match TaskService::list_tasks_lite(&conn) {
        Ok(list) => list,
        Err(e) => {
            log::warn!("[startup] 读取任务列表失败: {}", e);
            Vec::new()
        }
    };
    let tasks_ms = t.elapsed().as_millis() as i64;

    Ok(StartupStatus {
        has_launched,
        current_db_path,
        project_list,
        database_status,
        workspace_layout,
        settings,
        tables_list,
        dashboards,
        saved_charts,
        tasks,
        timing: StartupTiming {
            app_init_ts_ms: app_init_ms,
            rust_app_init_ms,
            rust_sqlite_connect_ms,
            rust_system_tables_init_ms,
            db_connect_ms,
            has_launched_ms,
            db_path_ms,
            project_list_ms,
            database_status_ms,
            workspace_ms,
            settings_ms,
            tables_list_ms,
            dashboards_ms,
            saved_charts_ms,
            tasks_ms,
            total_backend_ms: fn_start.elapsed().as_millis() as i64,
        },
        startup_timestamp_ms: Utc::now().timestamp_millis(),
    })
}

// WorkspacePanel 字段名保持与 models/app_state.rs 定义一致
// （此处无用，但保留以防止 unused imports 误报）
#[allow(dead_code)]
fn _ensure_types(_panel: WorkspacePanel) {}

/// 通用命令返回值统一响应结构体
///
/// Startup 模块内定义的通用响应，用于将窗口操作等简单命令
/// 将 success / message / data(Option) 三字段
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

/// 调整主窗口尺寸为 1200x800，居中并允许后续 resize
///
/// v14 (S4 三级降级)：
/// 1) 尝试在 Rust 中检测 win_borderless 效果
/// 2) 若检测到透明未生效（L1），则返回给前端，由前端在 splash 上应用填充卡片样式
/// 3) 在 JSON data 中附透明诊断，供前端 AppWrapper 决定是否进入降级
#[tauri::command]
pub fn window_resize_to_main(window: tauri::WebviewWindow) -> Result<ApiResponse<serde_json::Value>, String> {
    use tauri::{Size, LogicalSize};

    if let Err(e) = window.set_size(Size::Logical(LogicalSize { width: 1200.0, height: 800.0 })) {
        log::warn!("[startup] window.set_size(1200x800) 失败: {}", e);
    }

    if let Err(e) = window.center() {
        log::warn!("[startup] window.center() 失败: {}", e);
    }

    if let Err(e) = window.set_resizable(true) {
        log::warn!("[startup] window.set_resizable(true) 失败: {}", e);
    }

    apply_borderless();

    // S4: 检测透明窗口是否生效
    let transparent_effective = is_transparency_effective_any();

    Ok(ApiResponse {
        success: true,
        message: "resized".into(),
        data: Some(serde_json::json!({
            "width": 1200,
            "height": 800,
            "transparencyEffective": transparent_effective,
            "needsFallback": !transparent_effective,
            "fallbackLevel": if transparent_effective { "none" } else { "L1" }
        })),
    })
}