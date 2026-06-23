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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsAxis {
    #[serde(rename = "type")]
    pub axis_type: Option<String>,
    pub data: Option<Vec<String>>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsSeries {
    pub name: String,
    #[serde(rename = "type")]
    pub series_type: String,
    pub data: Vec<f64>,
    pub stack: Option<String>,
    #[serde(rename = "areaStyle")]
    pub area_style: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EChartsDataZoom {
    #[serde(rename = "type")]
    pub zoom_type: String,
    pub start: f64,
    pub end: f64,
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
            recommendations.push(ChartType::Pie);
            recommendations.push(ChartType::StackedBar);
            recommendations.push(ChartType::Line);
        }

        if numeric_columns.len() >= 2 {
            // 多个数值列 -> 推荐散点图
            recommendations.push(ChartType::Scatter);
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

        // 找到X轴和Y轴列的索引
        let x_axis_idx = data.columns.iter()
            .position(|c| c == &config.x_axis_column)
            .ok_or_else(|| format!("找不到X轴列: {}", config.x_axis_column))?;

        let y_axis_indices: Vec<usize> = config.y_axis_columns.iter()
            .filter_map(|col| data.columns.iter().position(|c| c == col))
            .collect();

        if y_axis_indices.is_empty() {
            return Err("找不到Y轴列".to_string());
        }

        // 获取X轴数据
        let x_axis_data: Vec<String> = data.rows.iter()
            .filter_map(|row| row.get(x_axis_idx).cloned())
            .collect();

        // 生成series数据
        let mut series_list: Vec<EChartsSeries> = Vec::new();

        for (idx, y_col) in config.y_axis_columns.iter().enumerate() {
            let y_axis_idx = y_axis_indices.get(idx).copied();

            if let Some(y_idx) = y_axis_idx {
                let series_data: Vec<f64> = data.rows.iter()
                    .filter_map(|row| {
                        row.get(y_idx)
                            .and_then(|v| v.trim().parse::<f64>().ok())
                    })
                    .collect();

                let mut series = EChartsSeries {
                    name: y_col.clone(),
                    series_type: match config.chart_type {
                        ChartType::Bar => "bar",
                        ChartType::Line => "line",
                        ChartType::Pie => "pie",
                        ChartType::StackedBar => "bar",
                        ChartType::Area => "line",
                        ChartType::Scatter => "scatter",
                    }.to_string(),
                    data: series_data,
                    stack: None,
                    area_style: None,
                };

                // 设置堆叠
                if config.chart_type == ChartType::StackedBar {
                    series.stack = Some("total".to_string());
                }

                // 设置面积
                if config.chart_type == ChartType::Area {
                    series.area_style = Some(serde_json::json!({}));
                }

                series_list.push(series);
            }
        }

        // 生成ECharts配置
        let echarts_config = EChartsConfig {
            title: EChartsTitle {
                text: config.title.clone(),
                left: "center".to_string(),
            },
            tooltip: EChartsTooltip {
                trigger: if config.chart_type == ChartType::Scatter {
                    "item".to_string()
                } else {
                    "axis".to_string()
                },
                axis_pointer: EChartsAxisPointer {
                    pointer_type: "shadow".to_string(),
                },
            },
            legend: EChartsLegend {
                data: config.y_axis_columns.clone(),
                top: "30".to_string(),
            },
            x_axis: vec![EChartsAxis {
                axis_type: Some(match config.chart_type {
                    ChartType::Scatter => "value",
                    _ => "category",
                }.to_string()),
                data: if config.chart_type == ChartType::Scatter {
                    None
                } else {
                    Some(x_axis_data)
                },
                name: config.x_axis_name.clone(),
            }],
            y_axis: vec![EChartsAxis {
                axis_type: Some(match config.chart_type {
                    ChartType::Scatter => "value",
                    _ => "value",
                }.to_string()),
                data: None,
                name: config.y_axis_name.clone(),
            }],
            series: series_list,
            data_zoom: if config.show_datazoom && data.rows.len() > 20 {
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
            },
        };

        Ok(echarts_config)
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
}
