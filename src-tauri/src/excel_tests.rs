use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use tempfile::tempdir;

#[test]
fn test_get_excel_sheets_file_not_found() {
    let result = crate::get_excel_sheets_impl("/nonexistent/path/to/file.xlsx");
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("文件不存在"));
}

#[test]
fn test_get_excel_sheets_file_too_large() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let file_path = temp_dir.path().join("large_file.xlsx");
    
    let mut file = File::create(&file_path).expect("创建文件失败");
    let large_content = vec![0u8; 60 * 1024 * 1024];
    file.write_all(&large_content).expect("写入文件失败");
    
    let result = crate::get_excel_sheets_impl(file_path.to_str().unwrap());
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("文件大小超过限制"));
}

#[test]
fn test_get_excel_sheets_invalid_format() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let file_path = temp_dir.path().join("test.txt");
    
    let mut file = File::create(&file_path).expect("创建文件失败");
    writeln!(file, "这不是Excel文件").expect("写入文件失败");
    
    let result = crate::get_excel_sheets_impl(file_path.to_str().unwrap());
    assert!(result.is_err());
}

#[test]
fn test_load_excel_sheet_file_not_found() {
    let result = crate::load_excel_sheet_impl(
        "/nonexistent/path/to/file.xlsx",
        "Sheet1"
    );
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("文件不存在"));
}

#[test]
fn test_load_excel_sheet_file_too_large() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let file_path = temp_dir.path().join("large_file.xlsx");
    
    let mut file = File::create(&file_path).expect("创建文件失败");
    let large_content = vec![0u8; 60 * 1024 * 1024];
    file.write_all(&large_content).expect("写入文件失败");
    
    let result = crate::load_excel_sheet_impl(
        file_path.to_str().unwrap(),
        "Sheet1"
    );
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("文件大小超过限制"));
}

#[test]
fn test_load_excel_sheet_invalid_format() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let file_path = temp_dir.path().join("test.txt");
    
    let mut file = File::create(&file_path).expect("创建文件失败");
    writeln!(file, "这不是Excel文件").expect("写入文件失败");
    
    let result = crate::load_excel_sheet_impl(
        file_path.to_str().unwrap(),
        "Sheet1"
    );
    assert!(result.is_err());
}

fn create_minimal_xlsx(path: &PathBuf) {
    use calamine::{Range, DataType};
    
    let mut range = Range::new();
    range.push(vec![DataType::String("Column1".to_string()), DataType::String("Column2".to_string())]);
    range.push(vec![DataType::String("Value1".to_string()), DataType::String("Value2".to_string())]);
    
    let mut workbook = calamine::Xlsx::<calamine::openpyxl::ZipArchive>::new();
    workbook.insert_sheet("Sheet1", range).unwrap();
    
    let file = File::create(path).expect("创建xlsx文件失败");
    let mut writer = std::io::BufWriter::new(file);
    workbook.write(&mut writer).expect("写入xlsx文件失败");
}

#[test]
fn test_get_excel_sheets_normal_file() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let file_path = temp_dir.path().join("test_normal.xlsx");
    
    create_minimal_xlsx(&file_path);
    
    let result = crate::get_excel_sheets_impl(file_path.to_str().unwrap());
    assert!(result.is_ok());
    
    let excel_preview = result.unwrap();
    assert!(!excel_preview.sheets.is_empty());
    assert_eq!(excel_preview.sheets[0].name, "Sheet1");
    assert!(excel_preview.active_sheet_preview.is_some());
}

#[test]
fn test_load_excel_sheet_normal() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let file_path = temp_dir.path().join("test_load.xlsx");
    
    create_minimal_xlsx(&file_path);
    
    let result = crate::load_excel_sheet_impl(
        file_path.to_str().unwrap(),
        "Sheet1"
    );
    assert!(result.is_ok());
    
    let csv_preview = result.unwrap();
    assert!(!csv_preview.headers.is_empty());
    assert_eq!(csv_preview.headers[0], "Column1");
}

#[test]
fn test_load_excel_sheet_sheet_not_found() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let file_path = temp_dir.path().join("test_sheet_not_found.xlsx");
    
    create_minimal_xlsx(&file_path);
    
    let result = crate::load_excel_sheet_impl(
        file_path.to_str().unwrap(),
        "不存在的Sheet"
    );
    assert!(result.is_err());
    assert!(result.err().unwrap().contains("无法读取Sheet"));
}