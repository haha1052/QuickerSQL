//! 图表相关 Tauri 命令

use crate::services::chart_service::{ChartConfig, ChartData, ChartService, ChartType, EChartsConfig};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;

/// 获取图表数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartDataRequest {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// 图表配置请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartConfigRequest {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub chart_type: Option<String>,
    pub x_axis_column: Option<String>,
    pub y_axis_columns: Option<Vec<String>>,
}

/// 获取推荐的图表类型
#[tauri::command]
pub fn get_recommended_chart_types(
    request: ChartDataRequest,
) -> Vec<String> {
    let recommendations = ChartService::recommend_chart_type(&request.columns, &request.rows);
    recommendations.iter().map(|t| match t {
        ChartType::Bar => "bar",
        ChartType::Line => "line",
        ChartType::Pie => "pie",
        ChartType::StackedBar => "stackedBar",
        ChartType::Area => "area",
        ChartType::Scatter => "scatter",
        ChartType::HorizontalBar => "horizontalBar",
        ChartType::Doughnut => "doughnut",
        ChartType::DualAxis => "dualAxis",
        ChartType::Radar => "radar",
        ChartType::Funnel => "funnel",
        ChartType::Gauge => "gauge",
    }.to_string()).collect()
}

/// 生成图表配置
#[tauri::command]
pub fn generate_chart_config(
    request: ChartConfigRequest,
) -> Result<EChartsConfig, String> {
    if request.columns.is_empty() || request.rows.is_empty() {
        return Err("数据为空".to_string());
    }

    // 如果没有指定配置，使用智能推荐
    if request.chart_type.is_none() {
        let (_, echarts_config) = ChartService::quick_generate(
            request.columns,
            request.rows,
        )?;
        return Ok(echarts_config);
    }

    // 使用指定配置
    let chart_type = match request.chart_type.as_deref() {
        Some("bar") => ChartType::Bar,
        Some("line") => ChartType::Line,
        Some("pie") => ChartType::Pie,
        Some("stackedBar") => ChartType::StackedBar,
        Some("area") => ChartType::Area,
        Some("scatter") => ChartType::Scatter,
        Some("horizontalBar") => ChartType::HorizontalBar,
        Some("doughnut") => ChartType::Doughnut,
        Some("dualAxis") => ChartType::DualAxis,
        Some("radar") => ChartType::Radar,
        Some("funnel") => ChartType::Funnel,
        Some("gauge") => ChartType::Gauge,
        _ => ChartType::Bar,
    };

    // 找到X轴和Y轴列
    let x_axis_column = request.x_axis_column.unwrap_or_else(|| {
        request.columns.first().cloned().unwrap_or_default()
    });

    let y_axis_columns = request.y_axis_columns.unwrap_or_else(|| {
        request.columns.iter().skip(1).cloned().collect()
    });

    let config = ChartConfig {
        chart_type,
        x_axis_column,
        y_axis_columns,
        title: None,
        x_axis_name: None,
        y_axis_name: None,
        show_legend: true,
        show_datazoom: request.rows.len() > 20,
    };

    let chart_data = ChartData {
        columns: request.columns,
        rows: request.rows,
    };

    ChartService::to_echarts_config(&chart_data, &config)
}

/// 保存图片到文件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveImageRequest {
    pub file_path: String,
    pub base64_data: String,
}

/// 保存图片
#[tauri::command]
pub fn save_chart_image(request: SaveImageRequest) -> Result<(), String> {
    // 移除 base64 数据前缀
    let base64_content = request.base64_data.split_once(',').map(|x| x.1).unwrap_or(&request.base64_data);
    
    // 解码 base64（使用 Engine API，替代 deprecated `base64::decode`）
    use base64::Engine as _;
    let binary_data = base64::engine::general_purpose::STANDARD.decode(base64_content)
        .map_err(|e| {
            log::error!("[save_chart_image] 解码 base64 失败: error={}", e);
            "图片数据解析失败，请重新生成图表".to_string()
        })?;
    
    // 写入文件
    let mut file = File::create(&request.file_path)
        .map_err(|e| {
            log::error!("[save_chart_image] 创建文件失败: error={}", e);
            "文件创建失败，请检查路径权限".to_string()
        })?;
    
    file.write_all(&binary_data)
        .map_err(|e| {
            log::error!("[save_chart_image] 写入文件失败: error={}", e);
            "文件写入失败，请检查磁盘空间或文件权限".to_string()
        })?;
    
    log::info!("图片已保存到: {}", request.file_path);
    Ok(())
}
