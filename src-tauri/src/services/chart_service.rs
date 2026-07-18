//! 图表可视化服务
//! 负责将SQL查询结果转换为ECharts图表配置

use serde::{Deserialize, Serialize};

/// 图表类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChartType {
    Bar,           // 柱状图
    Line,          // 折线图
    Pie,           // 饼图
    StackedBar,    // 堆叠柱状图
    Area,          // 面积图
    Scatter,       // 散点图
    HorizontalBar, // 条形图
    Doughnut,      // 环形图
    DualAxis,      // 双轴图
    Radar,         // 雷达图
    Funnel,        // 漏斗图
    Gauge,         // 仪表盘
}

/// 数据列类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ColumnType {
    Numeric,       // 数值型
    Category,      // 类别型
    DateTime,      // 日期时间型
    Unknown,        // 未知
}

/// 图表配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartConfig {
    pub chart_type: ChartType,
    pub x_axis_column: String,
    pub y_axis_columns: Vec<String>,
    pub title: Option<String>,
    pub x_axis_name: Option<String>,
    pub y_axis_name: Option<String>,
    pub show_legend: bool,
    pub show_datazoom: bool,
}

/// 图表数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartData {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// ECharts配置响应
/// 注意：字段名通过 #[serde(rename)] 映射为 ECharts 所需的 camelCase，
/// 保证序列化后的 JSON 可直接传给 echarts.setOption()，无需前端再做字段名转换。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsConfig {
    pub title: EChartsTitle,
    pub tooltip: EChartsTooltip,
    pub legend: EChartsLegend,
    #[serde(rename = "xAxis")]
    pub x_axis: Vec<EChartsAxis>,
    #[serde(rename = "yAxis")]
    pub y_axis: Vec<EChartsAxis>,
    pub series: Vec<EChartsSeries>,
    #[serde(rename = "dataZoom")]
    pub data_zoom: Option<Vec<EChartsDataZoom>>,
    pub radar: Option<EChartsRadar>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsTitle {
    pub text: Option<String>,
    pub left: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsTooltip {
    pub trigger: String,
    #[serde(rename = "axisPointer")]
    pub axis_pointer: EChartsAxisPointer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsAxisPointer {
    #[serde(rename = "type")]
    pub pointer_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsLegend {
    pub data: Vec<String>,
    pub top: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EChartsAxis {
    #[serde(rename = "type")]
    pub axis_type: Option<String>,
    pub data: Option<Vec<String>>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EChartsSeries {
    pub name: String,
    #[serde(rename = "type")]
    pub series_type: String,
    pub data: serde_json::Value,
    pub stack: Option<String>,
    #[serde(rename = "areaStyle")]
    pub area_style: Option<serde_json::Value>,
    pub radius: Option<Vec<String>>,
    #[serde(rename = "yAxisIndex")]
    pub y_axis_index: Option<i32>,
    #[serde(rename = "itemStyle")]
    pub item_style: Option<serde_json::Value>,
    #[serde(rename = "axisLine")]
    pub axis_line: Option<serde_json::Value>,
    #[serde(rename = "pointer")]
    pub pointer: Option<serde_json::Value>,
    #[serde(rename = "detail")]
    pub detail: Option<serde_json::Value>,
    pub value: Option<f64>,
    #[serde(rename = "splitLine")]
    pub split_line: Option<serde_json::Value>,
    #[serde(rename = "axisTick")]
    pub axis_tick: Option<serde_json::Value>,
    #[serde(rename = "axisLabel")]
    pub axis_label: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsDataZoom {
    #[serde(rename = "type")]
    pub zoom_type: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsRadar {
    pub indicator: Vec<EChartsRadarIndicator>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsRadarIndicator {
    pub name: String,
    pub max: f64,
}

/// 图表服务
pub struct ChartService;

impl ChartService {
    /// 检测列的数据类型
    pub fn detect_column_type(values: &[String]) -> ColumnType {
        if values.is_empty() {
            return ColumnType::Unknown;
        }

        let mut numeric_count = 0;
        let mut date_count = 0;

        for value in values.iter().take(100) {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                continue;
            }

            // 检查是否为数值
            if trimmed.parse::<f64>().is_ok() {
                numeric_count += 1;
                continue;
            }

            // 检查是否为日期时间
            if Self::is_datetime(trimmed) {
                date_count += 1;
            }
        }

        let sample_size = values.len().min(100) as f64;
        let numeric_ratio = numeric_count as f64 / sample_size;
        let date_ratio = date_count as f64 / sample_size;

        if numeric_ratio > 0.8 {
            ColumnType::Numeric
        } else if date_ratio > 0.5 {
            ColumnType::DateTime
        } else {
            ColumnType::Category
        }
    }

    /// 判断是否为日期时间字符串
    fn is_datetime(s: &str) -> bool {
        // 常见日期格式检测
        let s = s.trim();

        // 检查是否为数值
        if s.parse::<f64>().is_ok() {
            return false;
        }

        // 常见日期格式检查
        let date_patterns = [
            // 2024-01-01, 2024-01-01 12:00:00
            s.contains('-') && (s.len() == 10 || s.len() >= 19),
            // 2024/01/01
            s.contains('/') && s.len() == 10,
            // 12:00:00 或 12:00
            s.matches(':').count() >= 2,
            // 中文日期格式
            s.contains('年') && s.contains('月'),
        ];

        // 如果至少有2个匹配，则认为是日期时间
        date_patterns.iter().filter(|&&x| x).count() >= 2
    }

    // ========= ECharts 配置构造辅助（P2-4 重构提取） =========

    /// 在数据列中查找指定列的下标，找不到则返回带 "找不到{label}列: {name}" 的错误
    fn find_col_idx(columns: &[String], name: &str, label: &str) -> Result<usize, String> {
        columns
            .iter()
            .position(|c| c == name)
            .ok_or_else(|| format!("找不到{}列: {}", label, name))
    }

    /// 收集所有 y 轴列在 data.columns 中的下标（找不到的列被跳过，保持顺序）
    fn find_y_axis_indices(columns: &[String], y_axis_columns: &[String]) -> Vec<usize> {
        y_axis_columns
            .iter()
            .filter_map(|col| columns.iter().position(|c| c == col))
            .collect()
    }

    /// 从数据列中提取并解析为 f64 的数值序列
    fn collect_numeric_series(data: &ChartData, col_idx: usize) -> Vec<f64> {
        data.rows
            .iter()
            .filter_map(|row| {
                row.get(col_idx).and_then(|v| v.trim().parse::<f64>().ok())
            })
            .collect()
    }

    /// 构造雷达图 indicators：从每行提取指标名，并扫描该行所有数值列求最大值（×1.2 作为 max）
    fn build_radar_indicators(
        data: &ChartData,
        indicator_col_idx: usize,
        value_indices: &[usize],
    ) -> Vec<EChartsRadarIndicator> {
        data.rows
            .iter()
            .filter_map(|row| {
                let name = row.get(indicator_col_idx).cloned()?;
                let mut max_val = 0.0f64;
                for &v_idx in value_indices {
                    if let Some(v) = row.get(v_idx).and_then(|v| v.trim().parse::<f64>().ok()) {
                        if v > max_val {
                            max_val = v;
                        }
                    }
                }
                let max = if max_val > 0.0 { max_val * 1.2 } else { 100.0 };
                Some(EChartsRadarIndicator { name, max })
            })
            .collect()
    }

    /// 构造 EChartsTitle（统一 left="center"）
    fn make_title(text: Option<String>) -> EChartsTitle {
        EChartsTitle {
            text,
            left: "center".to_string(),
        }
    }

    /// 构造带 shadow axisPointer 的 EChartsTooltip
    fn make_axis_shadow_tooltip(trigger: &str) -> EChartsTooltip {
        EChartsTooltip {
            trigger: trigger.to_string(),
            axis_pointer: EChartsAxisPointer {
                pointer_type: "shadow".to_string(),
            },
        }
    }

    /// 构造 EChartsLegend（统一 top="30"）
    fn make_legend(data: Vec<String>) -> EChartsLegend {
        EChartsLegend {
            data,
            top: "30".to_string(),
        }
    }

    /// 仅在启用 dataZoom 且行数 > 20 时构造 dataZoom 配置（含 inside + slider 两个组件）
    fn build_data_zoom_if_needed(
        show_datazoom: bool,
        row_count: usize,
    ) -> Option<Vec<EChartsDataZoom>> {
        if show_datazoom && row_count > 20 {
            Some(vec![
                EChartsDataZoom {
                    zoom_type: "inside".to_string(),
                    start: 0.0,
                    end: 100.0,
                },
                EChartsDataZoom {
                    zoom_type: "slider".to_string(),
                    start: 0.0,
                    end: 100.0,
                },
            ])
        } else {
            None
        }
    }

    /// 智能推荐图表类型
    pub fn recommend_chart_type(columns: &[String], rows: &[Vec<String>]) -> Vec<ChartType> {
        if columns.is_empty() || rows.is_empty() {
            return vec![ChartType::Bar];
        }

        let mut numeric_columns: Vec<usize> = Vec::new();
        let mut category_columns: Vec<usize> = Vec::new();

        // 分析每列的数据类型
        for (i, _col) in columns.iter().enumerate() {
            let values: Vec<String> = rows.iter()
                .filter_map(|row| row.get(i).cloned())
                .collect();

            let col_type = Self::detect_column_type(&values);

            match col_type {
                ColumnType::Numeric => numeric_columns.push(i),
                ColumnType::Category => category_columns.push(i),
                _ => {}
            }
        }

        // 根据数据特征推荐图表
        let mut recommendations = Vec::new();

        if !category_columns.is_empty() && !numeric_columns.is_empty() {
            // 类别 + 数值 -> 推荐柱状图、饼图
            recommendations.push(ChartType::Bar);
            recommendations.push(ChartType::HorizontalBar);
            recommendations.push(ChartType::Pie);
            recommendations.push(ChartType::Doughnut);
            recommendations.push(ChartType::StackedBar);
            recommendations.push(ChartType::Line);
        }

        if numeric_columns.len() >= 2 {
            // 多个数值列 -> 推荐散点图、双轴图
            recommendations.push(ChartType::Scatter);
            if !category_columns.is_empty() {
                recommendations.push(ChartType::DualAxis);
            }
        }

        // 如果有日期列 -> 推荐折线图
        let has_datetime = columns.iter().enumerate().any(|(i, _)| {
            let values: Vec<String> = rows.iter()
                .filter_map(|row| row.get(i).cloned())
                .collect();
            Self::detect_column_type(&values) == ColumnType::DateTime
        });

        if has_datetime {
            recommendations.push(ChartType::Line);
            recommendations.push(ChartType::Area);
        }

        // 雷达图：有一个类别列 + 多个数值列（>=3个指标效果好）
        if !category_columns.is_empty() && numeric_columns.len() >= 2 {
            recommendations.push(ChartType::Radar);
        }

        // 漏斗图：有一个类别列 + 一个数值列
        if !category_columns.is_empty() && !numeric_columns.is_empty() {
            recommendations.push(ChartType::Funnel);
        }

        // 仪表盘：至少有一个数值列
        if !numeric_columns.is_empty() {
            recommendations.push(ChartType::Gauge);
        }

        // 默认推荐
        if recommendations.is_empty() {
            recommendations.push(ChartType::Bar);
        }

        recommendations
    }

    /// 将查询数据转换为ECharts配置
    pub fn to_echarts_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        if data.columns.is_empty() || data.rows.is_empty() {
            return Err("数据为空".to_string());
        }

        match config.chart_type {
            ChartType::Radar => Self::generate_radar_config(data, config),
            ChartType::Funnel => Self::generate_funnel_config(data, config),
            ChartType::Gauge => Self::generate_gauge_config(data, config),
            ChartType::Doughnut => Self::generate_doughnut_config(data, config),
            ChartType::Pie => Self::generate_pie_config(data, config),
            ChartType::DualAxis => Self::generate_dual_axis_config(data, config),
            ChartType::HorizontalBar => Self::generate_horizontal_bar_config(data, config),
            _ => Self::generate_standard_config(data, config),
        }
    }

    fn generate_standard_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        let x_axis_idx = Self::find_col_idx(&data.columns, &config.x_axis_column, "X轴")?;
        let y_axis_indices = Self::find_y_axis_indices(&data.columns, &config.y_axis_columns);
        if y_axis_indices.is_empty() {
            return Err("找不到Y轴列".to_string());
        }

        let x_axis_data: Vec<String> = data.rows.iter()
            .filter_map(|row| row.get(x_axis_idx).cloned())
            .collect();

        let series_type = match config.chart_type {
            ChartType::Bar => "bar",
            ChartType::Line => "line",
            ChartType::Pie => "pie",
            ChartType::StackedBar => "bar",
            ChartType::Area => "line",
            ChartType::Scatter => "scatter",
            _ => "bar",
        };

        let mut series_list: Vec<EChartsSeries> = Vec::new();
        for (idx, y_col) in config.y_axis_columns.iter().enumerate() {
            if let Some(y_idx) = y_axis_indices.get(idx).copied() {
                let series_data = Self::collect_numeric_series(data, y_idx);
                let mut series = EChartsSeries {
                    name: y_col.clone(),
                    series_type: series_type.to_string(),
                    data: serde_json::to_value(&series_data).map_err(|e| e.to_string())?,
                    ..Default::default()
                };
                if config.chart_type == ChartType::StackedBar {
                    series.stack = Some("total".to_string());
                }
                if config.chart_type == ChartType::Area {
                    series.area_style = Some(serde_json::json!({}));
                }
                series_list.push(series);
            }
        }

        let is_scatter = config.chart_type == ChartType::Scatter;
        Ok(EChartsConfig {
            title: Self::make_title(config.title.clone()),
            tooltip: Self::make_axis_shadow_tooltip(if is_scatter { "item" } else { "axis" }),
            legend: Self::make_legend(config.y_axis_columns.clone()),
            x_axis: vec![EChartsAxis {
                axis_type: Some(if is_scatter { "value" } else { "category" }.to_string()),
                data: if is_scatter { None } else { Some(x_axis_data) },
                name: config.x_axis_name.clone(),
            }],
            y_axis: vec![EChartsAxis {
                axis_type: Some("value".to_string()),
                name: config.y_axis_name.clone(),
                ..Default::default()
            }],
            series: series_list,
            data_zoom: Self::build_data_zoom_if_needed(config.show_datazoom, data.rows.len()),
            radar: None,
        })
    }

    fn generate_horizontal_bar_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        // 注意：水平条形图的 "X 轴列" 实际是数值轴（横向），"Y 轴列" 是类别轴（纵向）
        // 为保持与配置语义一致，沿用原错误信息文案
        let y_axis_idx = Self::find_col_idx(&data.columns, &config.x_axis_column, "Y轴")?;
        let x_axis_indices = Self::find_y_axis_indices(&data.columns, &config.y_axis_columns);
        if x_axis_indices.is_empty() {
            return Err("找不到X轴列".to_string());
        }

        let y_axis_data: Vec<String> = data.rows.iter()
            .filter_map(|row| row.get(y_axis_idx).cloned())
            .collect();

        let mut series_list: Vec<EChartsSeries> = Vec::new();
        for (idx, y_col) in config.y_axis_columns.iter().enumerate() {
            if let Some(x_idx) = x_axis_indices.get(idx).copied() {
                let series_data = Self::collect_numeric_series(data, x_idx);
                let series = EChartsSeries {
                    name: y_col.clone(),
                    series_type: "bar".to_string(),
                    data: serde_json::to_value(&series_data).map_err(|e| e.to_string())?,
                    ..Default::default()
                };
                series_list.push(series);
            }
        }

        Ok(EChartsConfig {
            title: Self::make_title(config.title.clone()),
            tooltip: Self::make_axis_shadow_tooltip("axis"),
            legend: Self::make_legend(config.y_axis_columns.clone()),
            x_axis: vec![EChartsAxis {
                axis_type: Some("value".to_string()),
                name: config.y_axis_name.clone(),
                ..Default::default()
            }],
            y_axis: vec![EChartsAxis {
                axis_type: Some("category".to_string()),
                data: Some(y_axis_data),
                name: config.x_axis_name.clone(),
            }],
            series: series_list,
            data_zoom: Self::build_data_zoom_if_needed(config.show_datazoom, data.rows.len()),
            radar: None,
        })
    }

    fn generate_pie_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        let name_idx = data.columns.iter()
            .position(|c| c == &config.x_axis_column)
            .ok_or_else(|| format!("找不到名称列: {}", config.x_axis_column))?;

        let value_indices: Vec<usize> = config.y_axis_columns.iter()
            .filter_map(|col| data.columns.iter().position(|c| c == col))
            .collect();

        if value_indices.is_empty() {
            return Err("找不到数值列".to_string());
        }

        let first_value_idx = value_indices.first().copied()
            .ok_or_else(|| "没有数值列".to_string())?;

        let pie_data: Vec<serde_json::Value> = data.rows.iter()
            .filter_map(|row| {
                let name = row.get(name_idx).cloned()?;
                let value = row.get(first_value_idx)
                    .and_then(|v| v.trim().parse::<f64>().ok())?;
                Some(serde_json::json!({
                    "name": name,
                    "value": value
                }))
            })
            .collect();

        let series = EChartsSeries {
            name: config.y_axis_columns.first().cloned().unwrap_or_default(),
            series_type: "pie".to_string(),
            data: serde_json::to_value(&pie_data).map_err(|e| e.to_string())?,
            stack: None,
            area_style: None,
            radius: Some(vec!["0%".to_string(), "70%".to_string()]),
            y_axis_index: None,
            item_style: None,
            axis_line: None,
            pointer: None,
            detail: None,
            value: None,
            split_line: None,
            axis_tick: None,
            axis_label: None,
        };

        let echarts_config = EChartsConfig {
            title: EChartsTitle {
                text: config.title.clone(),
                left: "center".to_string(),
            },
            tooltip: EChartsTooltip {
                trigger: "item".to_string(),
                axis_pointer: EChartsAxisPointer {
                    pointer_type: "shadow".to_string(),
                },
            },
            legend: EChartsLegend {
                data: config.y_axis_columns.clone(),
                top: "30".to_string(),
            },
            x_axis: vec![],
            y_axis: vec![],
            series: vec![series],
            data_zoom: None,
            radar: None,
        };

        Ok(echarts_config)
    }

    fn generate_doughnut_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        let mut pie_config = Self::generate_pie_config(data, config)?;
        if let Some(series) = pie_config.series.first_mut() {
            series.radius = Some(vec!["40%".to_string(), "70%".to_string()]);
        }
        Ok(pie_config)
    }

    fn generate_dual_axis_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        let x_axis_idx = Self::find_col_idx(&data.columns, &config.x_axis_column, "X轴")?;
        let y_axis_indices = Self::find_y_axis_indices(&data.columns, &config.y_axis_columns);
        if y_axis_indices.len() < 2 {
            return Err("双轴图需要至少2个数值列".to_string());
        }

        let x_axis_data: Vec<String> = data.rows.iter()
            .filter_map(|row| row.get(x_axis_idx).cloned())
            .collect();

        let mut series_list: Vec<EChartsSeries> = Vec::new();
        for (idx, y_col) in config.y_axis_columns.iter().enumerate() {
            if let Some(y_idx) = y_axis_indices.get(idx).copied() {
                let series_data = Self::collect_numeric_series(data, y_idx);
                let is_first = idx == 0;
                let series = EChartsSeries {
                    name: y_col.clone(),
                    series_type: if is_first { "bar" } else { "line" }.to_string(),
                    data: serde_json::to_value(&series_data).map_err(|e| e.to_string())?,
                    y_axis_index: Some(if is_first { 0 } else { 1 }),
                    ..Default::default()
                };
                series_list.push(series);
            }
        }

        Ok(EChartsConfig {
            title: Self::make_title(config.title.clone()),
            tooltip: Self::make_axis_shadow_tooltip("axis"),
            legend: Self::make_legend(config.y_axis_columns.clone()),
            x_axis: vec![EChartsAxis {
                axis_type: Some("category".to_string()),
                data: Some(x_axis_data),
                name: config.x_axis_name.clone(),
            }],
            y_axis: vec![
                EChartsAxis {
                    axis_type: Some("value".to_string()),
                    name: config.y_axis_columns.first().cloned(),
                    ..Default::default()
                },
                EChartsAxis {
                    axis_type: Some("value".to_string()),
                    name: config.y_axis_columns.get(1).cloned(),
                    ..Default::default()
                },
            ],
            series: series_list,
            data_zoom: Self::build_data_zoom_if_needed(config.show_datazoom, data.rows.len()),
            radar: None,
        })
    }

    fn generate_radar_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        let indicator_col_idx = Self::find_col_idx(&data.columns, &config.x_axis_column, "指标名")?;
        let value_indices = Self::find_y_axis_indices(&data.columns, &config.y_axis_columns);
        if value_indices.is_empty() {
            return Err("找不到数值列".to_string());
        }

        let indicators = Self::build_radar_indicators(data, indicator_col_idx, &value_indices);

        let mut series_list: Vec<EChartsSeries> = Vec::new();
        for (idx, y_col) in config.y_axis_columns.iter().enumerate() {
            if let Some(col_idx) = value_indices.get(idx).copied() {
                let series_values = Self::collect_numeric_series(data, col_idx);
                let series = EChartsSeries {
                    name: y_col.clone(),
                    series_type: "radar".to_string(),
                    data: serde_json::to_value(&[serde_json::json!({
                        "value": series_values,
                        "name": y_col
                    })]).map_err(|e| e.to_string())?,
                    ..Default::default()
                };
                series_list.push(series);
            }
        }

        Ok(EChartsConfig {
            title: Self::make_title(config.title.clone()),
            tooltip: Self::make_axis_shadow_tooltip("item"),
            legend: Self::make_legend(config.y_axis_columns.clone()),
            x_axis: vec![],
            y_axis: vec![],
            series: series_list,
            data_zoom: None,
            radar: Some(EChartsRadar { indicator: indicators }),
        })
    }

    fn generate_funnel_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        let name_idx = data.columns.iter()
            .position(|c| c == &config.x_axis_column)
            .ok_or_else(|| format!("找不到阶段列: {}", config.x_axis_column))?;

        let value_indices: Vec<usize> = config.y_axis_columns.iter()
            .filter_map(|col| data.columns.iter().position(|c| c == col))
            .collect();

        let first_value_idx = value_indices.first().copied()
            .ok_or_else(|| "找不到数值列".to_string())?;

        let funnel_data: Vec<serde_json::Value> = data.rows.iter()
            .filter_map(|row| {
                let name = row.get(name_idx).cloned()?;
                let value = row.get(first_value_idx)
                    .and_then(|v| v.trim().parse::<f64>().ok())?;
                Some(serde_json::json!({
                    "name": name,
                    "value": value
                }))
            })
            .collect();

        let series = EChartsSeries {
            name: config.y_axis_columns.first().cloned().unwrap_or_default(),
            series_type: "funnel".to_string(),
            data: serde_json::to_value(&funnel_data).map_err(|e| e.to_string())?,
            stack: None,
            area_style: None,
            radius: None,
            y_axis_index: None,
            item_style: Some(serde_json::json!({
                "borderColor": "#fff",
                "borderWidth": 2
            })),
            axis_line: None,
            pointer: None,
            detail: None,
            value: None,
            split_line: None,
            axis_tick: None,
            axis_label: None,
        };

        let legend_names: Vec<String> = data.rows.iter()
            .filter_map(|row| row.get(name_idx).cloned())
            .collect();

        let echarts_config = EChartsConfig {
            title: EChartsTitle {
                text: config.title.clone(),
                left: "center".to_string(),
            },
            tooltip: EChartsTooltip {
                trigger: "item".to_string(),
                axis_pointer: EChartsAxisPointer {
                    pointer_type: "shadow".to_string(),
                },
            },
            legend: EChartsLegend {
                data: legend_names,
                top: "30".to_string(),
            },
            x_axis: vec![],
            y_axis: vec![],
            series: vec![series],
            data_zoom: None,
            radar: None,
        };

        Ok(echarts_config)
    }

    /// 构造仪表盘的 EChartsSeries（含 6 项静态 JSON 样式：axis_line / pointer / detail /
    /// split_line / axis_tick / axis_label）
    ///
    /// 提取自 `generate_gauge_config`（P2-4 重构：原内联块占 55 行，
    /// 提取后主函数由 95 行降至 ~22 行）。
    fn build_gauge_series(name: String, value: f64) -> EChartsSeries {
        EChartsSeries {
            name,
            series_type: "gauge".to_string(),
            data: serde_json::Value::Array(vec![]),
            axis_line: Some(serde_json::json!({
                "lineStyle": {
                    "width": 30,
                    "color": [
                        [0.3, "#67e8f9"],
                        [0.7, "#fbbf24"],
                        [1.0, "#ef4444"]
                    ]
                }
            })),
            pointer: Some(serde_json::json!({
                "itemStyle": { "color": "auto" }
            })),
            detail: Some(serde_json::json!({
                "valueAnimation": true,
                "formatter": "{value}",
                "color": "inherit",
                "fontSize": 30,
                "offsetCenter": [0, "60%"]
            })),
            value: Some(value),
            split_line: Some(serde_json::json!({
                "distance": -30,
                "length": 8,
                "lineStyle": { "color": "#fff", "width": 2 }
            })),
            axis_tick: Some(serde_json::json!({
                "distance": -30,
                "length": 4,
                "lineStyle": { "color": "#fff", "width": 1 }
            })),
            axis_label: Some(serde_json::json!({
                "distance": -20,
                "color": "#fff",
                "fontSize": 12
            })),
            ..Default::default()
        }
    }

    fn generate_gauge_config(
        data: &ChartData,
        config: &ChartConfig,
    ) -> Result<EChartsConfig, String> {
        let value_indices = Self::find_y_axis_indices(&data.columns, &config.y_axis_columns);
        let first_value_idx = value_indices.first().copied()
            .ok_or_else(|| "找不到数值列".to_string())?;

        let first_value = data.rows.first()
            .and_then(|row| row.get(first_value_idx))
            .and_then(|v| v.trim().parse::<f64>().ok())
            .ok_or_else(|| "无法读取仪表盘数值".to_string())?;

        let series_name = config.y_axis_columns.first().cloned().unwrap_or_default();
        let series = Self::build_gauge_series(series_name, first_value);

        Ok(EChartsConfig {
            title: Self::make_title(config.title.clone()),
            tooltip: Self::make_axis_shadow_tooltip("item"),
            legend: Self::make_legend(vec![]),
            x_axis: vec![],
            y_axis: vec![],
            series: vec![series],
            data_zoom: None,
            radar: None,
        })
    }

    /// 快速生成图表配置（智能推荐）
    pub fn quick_generate(
        columns: Vec<String>,
        rows: Vec<Vec<String>>,
    ) -> Result<(ChartConfig, EChartsConfig), String> {
        if columns.is_empty() || rows.is_empty() {
            return Err("数据为空".to_string());
        }

        // 检测每列的类型
        let column_types: Vec<ColumnType> = (0..columns.len())
            .map(|i| {
                let values: Vec<String> = rows.iter()
                    .filter_map(|row| row.get(i).cloned())
                    .collect();
                Self::detect_column_type(&values)
            })
            .collect();

        // 找X轴（优先类别列）和Y轴（优先数值列）
        let x_axis_column = column_types.iter()
            .enumerate()
            .find(|(_, t)| **t == ColumnType::Category || **t == ColumnType::DateTime)
            .or_else(|| column_types.iter().enumerate().find(|(_, t)| **t != ColumnType::Numeric))
            .map(|(i, _)| columns[i].clone())
            .unwrap_or_else(|| columns[0].clone());

        let y_axis_columns: Vec<String> = column_types.iter()
            .enumerate()
            .filter(|(_, t)| **t == ColumnType::Numeric)
            .map(|(i, _)| columns[i].clone())
            .collect();

        if y_axis_columns.is_empty() {
            return Err("没有数值列用于图表".to_string());
        }

        // 智能推荐图表类型
        let recommendations = Self::recommend_chart_type(&columns, &rows);
        let chart_type = recommendations.first().cloned().unwrap_or(ChartType::Bar);

        // 构建配置
        let config = ChartConfig {
            chart_type: chart_type.clone(),
            x_axis_column: x_axis_column.clone(),
            y_axis_columns: y_axis_columns.clone(),
            title: None,
            x_axis_name: Some(x_axis_column.clone()),
            y_axis_name: Some("数值".to_string()),
            show_legend: y_axis_columns.len() > 1,
            show_datazoom: rows.len() > 20,
        };

        let chart_data = ChartData { columns, rows };
        let echarts_config = Self::to_echarts_config(&chart_data, &config)?;

        Ok((config, echarts_config))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_numeric_column() {
        let values = vec![
            "100".to_string(),
            "200".to_string(),
            "300".to_string(),
            "400".to_string(),
        ];
        assert_eq!(ChartService::detect_column_type(&values), ColumnType::Numeric);
    }

    #[test]
    fn test_detect_category_column() {
        let values = vec![
            "北京".to_string(),
            "上海".to_string(),
            "广州".to_string(),
            "深圳".to_string(),
        ];
        assert_eq!(ChartService::detect_column_type(&values), ColumnType::Category);
    }

    #[test]
    fn test_quick_generate() {
        let columns = vec![
            "城市".to_string(),
            "销量".to_string(),
            "利润".to_string(),
        ];
        let rows = vec![
            vec!["北京".to_string(), "100".to_string(), "30".to_string()],
            vec!["上海".to_string(), "200".to_string(), "60".to_string()],
            vec!["广州".to_string(), "150".to_string(), "45".to_string()],
        ];

        let result = ChartService::quick_generate(columns, rows);
        assert!(result.is_ok());
    }

    #[test]
    fn test_horizontal_bar_chart() {
        let columns = vec![
            "城市".to_string(),
            "销量".to_string(),
        ];
        let rows = vec![
            vec!["北京".to_string(), "100".to_string()],
            vec!["上海".to_string(), "200".to_string()],
            vec!["广州".to_string(), "150".to_string()],
        ];

        let config = ChartConfig {
            chart_type: ChartType::HorizontalBar,
            x_axis_column: "城市".to_string(),
            y_axis_columns: vec!["销量".to_string()],
            title: None,
            x_axis_name: None,
            y_axis_name: None,
            show_legend: false,
            show_datazoom: false,
        };

        let data = ChartData { columns, rows };
        let result = ChartService::to_echarts_config(&data, &config);
        assert!(result.is_ok());

        let echarts = result.unwrap();
        assert_eq!(echarts.y_axis.len(), 1);
        assert_eq!(echarts.y_axis[0].axis_type.as_deref(), Some("category"));
        assert_eq!(echarts.x_axis.len(), 1);
        assert_eq!(echarts.x_axis[0].axis_type.as_deref(), Some("value"));
        assert_eq!(echarts.series.len(), 1);
        assert_eq!(echarts.series[0].series_type, "bar");
    }

    #[test]
    fn test_doughnut_chart() {
        let columns = vec![
            "品类".to_string(),
            "销售额".to_string(),
        ];
        let rows = vec![
            vec!["电子产品".to_string(), "1000".to_string()],
            vec!["服装".to_string(), "500".to_string()],
            vec!["食品".to_string(), "300".to_string()],
        ];

        let config = ChartConfig {
            chart_type: ChartType::Doughnut,
            x_axis_column: "品类".to_string(),
            y_axis_columns: vec!["销售额".to_string()],
            title: None,
            x_axis_name: None,
            y_axis_name: None,
            show_legend: true,
            show_datazoom: false,
        };

        let data = ChartData { columns, rows };
        let result = ChartService::to_echarts_config(&data, &config);
        assert!(result.is_ok());

        let echarts = result.unwrap();
        assert_eq!(echarts.series.len(), 1);
        assert_eq!(echarts.series[0].series_type, "pie");
        assert!(echarts.series[0].radius.is_some());
        let radius = echarts.series[0].radius.as_ref().unwrap();
        assert_eq!(radius.len(), 2);
        assert_eq!(radius[0], "40%");
        assert_eq!(radius[1], "70%");
    }

    #[test]
    fn test_dual_axis_chart() {
        let columns = vec![
            "月份".to_string(),
            "销量".to_string(),
            "利润".to_string(),
        ];
        let rows = vec![
            vec!["1月".to_string(), "100".to_string(), "30".to_string()],
            vec!["2月".to_string(), "200".to_string(), "60".to_string()],
            vec!["3月".to_string(), "150".to_string(), "45".to_string()],
        ];

        let config = ChartConfig {
            chart_type: ChartType::DualAxis,
            x_axis_column: "月份".to_string(),
            y_axis_columns: vec!["销量".to_string(), "利润".to_string()],
            title: None,
            x_axis_name: None,
            y_axis_name: None,
            show_legend: true,
            show_datazoom: false,
        };

        let data = ChartData { columns, rows };
        let result = ChartService::to_echarts_config(&data, &config);
        assert!(result.is_ok());

        let echarts = result.unwrap();
        assert_eq!(echarts.y_axis.len(), 2);
        assert_eq!(echarts.series.len(), 2);
        assert_eq!(echarts.series[0].series_type, "bar");
        assert_eq!(echarts.series[1].series_type, "line");
        assert_eq!(echarts.series[0].y_axis_index, Some(0));
        assert_eq!(echarts.series[1].y_axis_index, Some(1));
    }

    #[test]
    fn test_radar_chart() {
        let columns = vec![
            "指标".to_string(),
            "产品A".to_string(),
            "产品B".to_string(),
        ];
        let rows = vec![
            vec!["销售".to_string(), "80".to_string(), "90".to_string()],
            vec!["管理".to_string(), "70".to_string(), "85".to_string()],
            vec!["技术".to_string(), "90".to_string(), "75".to_string()],
            vec!["服务".to_string(), "85".to_string(), "80".to_string()],
        ];

        let config = ChartConfig {
            chart_type: ChartType::Radar,
            x_axis_column: "指标".to_string(),
            y_axis_columns: vec!["产品A".to_string(), "产品B".to_string()],
            title: None,
            x_axis_name: None,
            y_axis_name: None,
            show_legend: true,
            show_datazoom: false,
        };

        let data = ChartData { columns, rows };
        let result = ChartService::to_echarts_config(&data, &config);
        assert!(result.is_ok());

        let echarts = result.unwrap();
        assert!(echarts.radar.is_some());
        let radar = echarts.radar.unwrap();
        assert_eq!(radar.indicator.len(), 4);
        assert_eq!(echarts.series.len(), 2);
        assert_eq!(echarts.series[0].series_type, "radar");
    }

    #[test]
    fn test_funnel_chart() {
        let columns = vec![
            "阶段".to_string(),
            "人数".to_string(),
        ];
        let rows = vec![
            vec!["访问".to_string(), "1000".to_string()],
            vec!["咨询".to_string(), "500".to_string()],
            vec!["订单".to_string(), "200".to_string()],
            vec!["成交".to_string(), "100".to_string()],
        ];

        let config = ChartConfig {
            chart_type: ChartType::Funnel,
            x_axis_column: "阶段".to_string(),
            y_axis_columns: vec!["人数".to_string()],
            title: None,
            x_axis_name: None,
            y_axis_name: None,
            show_legend: true,
            show_datazoom: false,
        };

        let data = ChartData { columns, rows };
        let result = ChartService::to_echarts_config(&data, &config);
        assert!(result.is_ok());

        let echarts = result.unwrap();
        assert_eq!(echarts.series.len(), 1);
        assert_eq!(echarts.series[0].series_type, "funnel");
    }

    #[test]
    fn test_gauge_chart() {
        let columns = vec![
            "完成率".to_string(),
        ];
        let rows = vec![
            vec!["75.5".to_string()],
        ];

        let config = ChartConfig {
            chart_type: ChartType::Gauge,
            x_axis_column: "完成率".to_string(),
            y_axis_columns: vec!["完成率".to_string()],
            title: None,
            x_axis_name: None,
            y_axis_name: None,
            show_legend: false,
            show_datazoom: false,
        };

        let data = ChartData { columns, rows };
        let result = ChartService::to_echarts_config(&data, &config);
        assert!(result.is_ok());

        let echarts = result.unwrap();
        assert_eq!(echarts.series.len(), 1);
        assert_eq!(echarts.series[0].series_type, "gauge");
        assert_eq!(echarts.series[0].value, Some(75.5));
        assert!(echarts.series[0].axis_line.is_some());
    }

    #[test]
    fn test_recommend_includes_new_charts() {
        let columns = vec![
            "类别".to_string(),
            "数值1".to_string(),
            "数值2".to_string(),
            "数值3".to_string(),
        ];
        let rows = vec![
            vec!["A".to_string(), "10".to_string(), "20".to_string(), "30".to_string()],
            vec!["B".to_string(), "15".to_string(), "25".to_string(), "35".to_string()],
            vec!["C".to_string(), "12".to_string(), "22".to_string(), "32".to_string()],
        ];

        let recommendations = ChartService::recommend_chart_type(&columns, &rows);
        assert!(recommendations.contains(&ChartType::HorizontalBar));
        assert!(recommendations.contains(&ChartType::Doughnut));
        assert!(recommendations.contains(&ChartType::DualAxis));
        assert!(recommendations.contains(&ChartType::Radar));
        assert!(recommendations.contains(&ChartType::Funnel));
        assert!(recommendations.contains(&ChartType::Gauge));
    }

    #[test]
    fn test_dual_axis_needs_two_numeric_columns() {
        let columns = vec![
            "类别".to_string(),
            "数值1".to_string(),
        ];
        let rows = vec![
            vec!["A".to_string(), "10".to_string()],
            vec!["B".to_string(), "15".to_string()],
        ];

        let config = ChartConfig {
            chart_type: ChartType::DualAxis,
            x_axis_column: "类别".to_string(),
            y_axis_columns: vec!["数值1".to_string()],
            title: None,
            x_axis_name: None,
            y_axis_name: None,
            show_legend: false,
            show_datazoom: false,
        };

        let data = ChartData { columns, rows };
        let result = ChartService::to_echarts_config(&data, &config);
        assert!(result.is_err());
    }
}
