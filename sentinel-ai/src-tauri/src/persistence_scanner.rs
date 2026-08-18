use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistenceItem {
    pub name: String,
    pub location_type: String, // "Registry Run Key", "Startup Folder", "Windows Service"
    pub path_or_command: String,
    pub risk_score: f64,
    pub is_suspicious: bool,
    pub explanation: String,
}

/// Enumerate active persistence mechanisms on Windows
pub fn scan_persistence_mechanisms() -> Vec<PersistenceItem> {
    let mut items = Vec::new();

    // 1. Scan Registry Run Keys via reg query
    let run_keys = [
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\Run",
    ];

    for key in run_keys {
        if let Ok(output) = Command::new("reg").args(["query", key]).output() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with("HKEY_") {
                    continue;
                }
                let parts: Vec<&str> = line.split("    ").filter(|s| !s.is_empty()).collect();
                if parts.len() >= 3 {
                    let name = parts[0].trim().to_string();
                    let val = parts[2].trim().to_string();
                    let is_susp = val.to_lowercase().contains("temp")
                        || val.to_lowercase().contains("downloads")
                        || val.to_lowercase().contains("appdata")
                        || val.to_lowercase().contains("powershell")
                        || val.to_lowercase().contains("cmd.exe /c");
                    let risk = if is_susp { 75.0 } else { 15.0 };

                    items.push(PersistenceItem {
                        name,
                        location_type: "Registry Run Key".to_string(),
                        path_or_command: val.clone(),
                        risk_score: risk,
                        is_suspicious: is_susp,
                        explanation: if is_susp {
                            "Autorun binary resides in user-writable/temp directory or invokes script interpreter".to_string()
                        } else {
                            "Standard startup registry entry".to_string()
                        },
                    });
                }
            }
        }
    }

    // 2. Scan User Startup Folder
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let startup_dir = std::path::Path::new(&appdata)
            .join(r"Microsoft\Windows\Start Menu\Programs\Startup");
        if let Ok(entries) = std::fs::read_dir(startup_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let path_str = path.to_string_lossy().to_string();
                let is_susp = path_str.to_lowercase().ends_with(".exe") || name.ends_with(".vbs") || name.ends_with(".bat") || name.ends_with(".ps1");
                items.push(PersistenceItem {
                    name,
                    location_type: "Startup Folder".to_string(),
                    path_or_command: path_str,
                    risk_score: if is_susp { 70.0 } else { 20.0 },
                    is_suspicious: is_susp,
                    explanation: "File placed in Windows Startup directory".to_string(),
                });
            }
        }
    }

    items.sort_by(|a, b| b.risk_score.partial_cmp(&a.risk_score).unwrap_or(std::cmp::Ordering::Equal));
    items
}
