// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod database;
mod detector;
mod monitor;
mod network_scanner;
mod persistence_scanner;

use database::{Database, StoredAlert, StoredTimelineEvent, StoredDevice, IncidentBundle};
use detector::{OnnxDetector, try_load_detector};
use monitor::{SystemMonitor, ProcessInfo, SystemStats};
use network_scanner::{DiscoveredDevice, HostNetworkInfo};
use persistence_scanner::{scan_persistence_mechanisms, PersistenceItem};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::process::Command;
use std::time::Duration;
use tauri::State;

/// Application state managed by Tauri
pub struct AppState {
    pub db: Arc<Database>,
    pub monitor: Mutex<SystemMonitor>,
    pub detector: Option<Arc<OnnxDetector>>,
}

#[derive(Serialize, Deserialize)]
pub struct DashboardData {
    pub stats: SystemStats,
    pub alert_count: u32,
    pub device_count: u32,
    pub blocked_count: u32,
    pub risk_level: String,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkScanResult {
    pub host: HostNetworkInfo,
    pub devices: Vec<DiscoveredDevice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveNetFlow {
    pub protocol: String,
    pub src_ip: String,
    pub src_port: u16,
    pub dst_ip: String,
    pub dst_port: u16,
    pub state: String,
    pub process_name: Option<String>,
    pub pid: u32,
}

#[tauri::command]
fn get_system_stats(state: State<AppState>) -> Result<SystemStats, String> {
    let mut mon = state.monitor.lock().map_err(|e| e.to_string())?;
    mon.refresh();
    Ok(mon.get_system_stats())
}

#[tauri::command]
fn get_processes(state: State<AppState>) -> Result<Vec<ProcessInfo>, String> {
    let mut mon = state.monitor.lock().map_err(|e| e.to_string())?;
    mon.refresh();
    let procs = mon.get_processes(state.detector.as_ref());
    
    let threshold: f64 = state.db.conn.lock()
        .map_err(|e| e.to_string())?
        .query_row("SELECT value FROM settings WHERE key = 'detection_threshold'", [], |r| r.get::<_, String>(0))
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(65.0);

    let _ = state.db.persist_processes(&procs, threshold);
    Ok(procs)
}

#[tauri::command]
fn get_dashboard_data(state: State<AppState>) -> Result<DashboardData, String> {
    let mut mon = state.monitor.lock().map_err(|e| e.to_string())?;
    mon.refresh();
    let stats = mon.get_system_stats();
    
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let alert_count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM alerts WHERE status = 'open'", [],
        |row| row.get(0)
    ).unwrap_or(0);
    let device_count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM devices", [],
        |row| row.get(0)
    ).unwrap_or(0);
    let blocked_count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM responses WHERE action_type IN ('block_ip','block_device','terminate_process')", [],
        |row| row.get(0)
    ).unwrap_or(0);

    let risk_level = if alert_count > 10 { "Critical" }
        else if alert_count > 5 { "High" }
        else if alert_count > 0 { "Medium" }
        else { "Low" };

    Ok(DashboardData {
        stats,
        alert_count,
        device_count,
        blocked_count,
        risk_level: risk_level.to_string(),
    })
}

#[tauri::command]
fn scan_network(state: State<AppState>) -> Result<NetworkScanResult, String> {
    let (host, devices) = network_scanner::discover_devices()?;
    let _ = state.db.persist_devices(&devices);
    Ok(NetworkScanResult { host, devices })
}

#[tauri::command]
fn get_live_connections() -> Result<Vec<LiveNetFlow>, String> {
    let output = Command::new("netstat")
        .args(["-ano"])
        .output()
        .map_err(|e| format!("Failed to run netstat: {}", e))?;
    
    let text = String::from_utf8_lossy(&output.stdout);
    let mut flows: Vec<LiveNetFlow> = Vec::new();
    
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Active") || line.starts_with("Proto") {
            continue;
        }
        
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 {
            continue;
        }
        
        let proto = parts[0].to_uppercase();
        if proto != "TCP" && proto != "UDP" {
            continue;
        }
        
        let (src_ip, src_port) = parse_address(parts[1]);
        let (dst_ip, dst_port) = parse_address(parts[2]);
        
        if dst_ip == "0.0.0.0" || dst_ip == "*" || src_ip == "127.0.0.1" {
            continue;
        }
        
        let state = if proto == "TCP" && parts.len() >= 4 {
            parts[3].to_string()
        } else {
            "STATELESS".to_string()
        };
        
        if state == "LISTENING" || state == "TIME_WAIT" || state == "CLOSE_WAIT" {
            continue;
        }
        
        let pid_str = if proto == "TCP" && parts.len() >= 5 {
            parts[4]
        } else if proto == "UDP" && parts.len() >= 4 {
            parts[3]
        } else {
            "0"
        };
        let pid: u32 = pid_str.parse().unwrap_or(0);
        
        flows.push(LiveNetFlow {
            protocol: proto,
            src_ip,
            src_port,
            dst_ip,
            dst_port,
            state,
            process_name: None,
            pid,
        });
    }
    
    flows.truncate(100);
    Ok(flows)
}

fn parse_address(addr: &str) -> (String, u16) {
    if let Some(pos) = addr.rfind(':') {
        let ip = addr[..pos].trim_matches('[').trim_matches(']').to_string();
        let port: u16 = addr[pos + 1..].parse().unwrap_or(0);
        (ip, port)
    } else {
        (addr.to_string(), 0)
    }
}

// ─── RESPONSE AUTOMATION COMMANDS ──────────────────────────────────────────────

#[tauri::command]
fn terminate_process(state: State<AppState>, pid: u32, alert_id: Option<i64>) -> Result<String, String> {
    let output = Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to execute taskkill: {e}"))?;

    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    
    let outcome = if output.status.success() {
        format!("Successfully terminated process (PID {})", pid)
    } else {
        format!("Taskkill output: {}", String::from_utf8_lossy(&output.stderr))
    };

    if let Some(aid) = alert_id {
        let _ = conn.execute(
            "INSERT INTO responses (alert_id, action_type, actor, outcome, action_ts) VALUES (?1, 'terminate_process', 'user', ?2, ?3)",
            rusqlite::params![aid, outcome, now],
        );
        let _ = conn.execute("UPDATE alerts SET status = 'actioned' WHERE alert_id = ?1", rusqlite::params![aid]);
    }

    Ok(outcome)
}

#[tauri::command]
fn block_ip(state: State<AppState>, ip: String, alert_id: Option<i64>) -> Result<String, String> {
    let rule_name = format!("Sentinel_Block_{}", ip.replace(".", "_"));
    let output = Command::new("netsh")
        .args(["advfirewall", "firewall", "add", "rule", &format!("name={}", rule_name), "dir=out", "action=block", &format!("remoteip={}", ip)])
        .output()
        .map_err(|e| format!("Failed to add firewall rule: {e}"))?;

    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;

    let outcome = if output.status.success() {
        format!("Windows Firewall block rule added for IP {}", ip)
    } else {
        format!("Netsh error: {}", String::from_utf8_lossy(&output.stderr))
    };

    if let Some(aid) = alert_id {
        let _ = conn.execute(
            "INSERT INTO responses (alert_id, action_type, actor, outcome, action_ts) VALUES (?1, 'block_ip', 'user', ?2, ?3)",
            rusqlite::params![aid, outcome, now],
        );
        let _ = conn.execute("UPDATE alerts SET status = 'actioned' WHERE alert_id = ?1", rusqlite::params![aid]);
    }

    Ok(outcome)
}

#[tauri::command]
fn add_allowlist_entry(state: State<AppState>, entity_type: String, entity_value: String, reason: String) -> Result<String, String> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO allowlist (entity_type, entity_value, reason, added_ts) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![entity_type, entity_value, reason, now],
    ).map_err(|e| e.to_string())?;

    Ok(format!("Added {} ({}) to allowlist", entity_value, entity_type))
}

#[tauri::command]
fn scan_persistence() -> Result<Vec<PersistenceItem>, String> {
    Ok(scan_persistence_mechanisms())
}

#[tauri::command]
fn get_setting(state: State<AppState>, key: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [&key], |row| row.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)", 
        rusqlite::params![key, value])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_alert_history(state: State<AppState>) -> Result<Vec<StoredAlert>, String> {
    state.db.get_alert_history().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_timeline_history(state: State<AppState>) -> Result<Vec<StoredTimelineEvent>, String> {
    state.db.get_timeline_history().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_device_history(state: State<AppState>) -> Result<Vec<StoredDevice>, String> {
    state.db.get_device_history().map_err(|e| e.to_string())
}

#[tauri::command]
fn export_incident_bundle(state: State<AppState>, from_ts: i64, to_ts: i64) -> Result<IncidentBundle, String> {
    state.db.export_incident_bundle(from_ts, to_ts).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs_next::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("sentinel-ai")
        .join("sentinel.db");
    
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let db = Arc::new(Database::new(db_path).expect("Failed to initialize database"));
    
    let model_path = std::env::current_dir()
        .unwrap_or_default()
        .join("models")
        .join("detector.onnx");
    let detector = try_load_detector(&model_path);

    let monitor = Mutex::new(SystemMonitor::new());

    let state = AppState {
        db: db.clone(),
        monitor,
        detector: detector.clone(),
    };

    let db_bg = db.clone();
    let detector_bg = detector.clone();
    tauri::async_runtime::spawn(async move {
        let mut bg_monitor = SystemMonitor::new();
        loop {
            tokio::time::sleep(Duration::from_secs(3)).await;
            bg_monitor.refresh();
            let procs = bg_monitor.get_processes(detector_bg.as_ref());
            let threshold: f64 = db_bg.conn.lock()
                .ok()
                .and_then(|c| c.query_row("SELECT value FROM settings WHERE key = 'detection_threshold'", [], |r| r.get::<_, String>(0)).ok())
                .and_then(|v| v.parse().ok())
                .unwrap_or(65.0);
            let _ = db_bg.persist_processes(&procs, threshold);
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            get_processes,
            get_dashboard_data,
            scan_network,
            get_live_connections,
            terminate_process,
            block_ip,
            add_allowlist_entry,
            scan_persistence,
            get_setting,
            update_setting,
            get_alert_history,
            get_timeline_history,
            get_device_history,
            export_incident_bundle,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
