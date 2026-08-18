use serde::{Deserialize, Serialize};
use sysinfo::{System, Networks};
use std::sync::Arc;
use crate::detector::{OnnxDetector, ProcessFeatures, compute_path_reputation, compute_file_entropy, check_is_signed};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub exe_path: String,
    pub cpu_usage: f32,
    pub memory_mb: f64,
    pub status: String,
    pub is_signed: bool,
    pub risk_score: f64,
    pub category: String,
    pub start_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_usage_percent: f32,
    pub uptime_seconds: u64,
    pub total_processes: usize,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
}

pub struct SystemMonitor {
    sys: System,
    networks: Networks,
}

impl SystemMonitor {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        let networks = Networks::new_with_refreshed_list();
        SystemMonitor { sys, networks }
    }

    pub fn refresh(&mut self) {
        self.sys.refresh_all();
        self.networks.refresh();
    }

    pub fn get_system_stats(&self) -> SystemStats {
        let cpu_usage = self.sys.global_cpu_info().cpu_usage();
        let mem_total = self.sys.total_memory();
        let mem_used = self.sys.used_memory();
        let mut net_rx: u64 = 0;
        let mut net_tx: u64 = 0;
        for (_name, data) in &self.networks {
            net_rx += data.received();
            net_tx += data.transmitted();
        }
        SystemStats {
            cpu_usage,
            memory_total_mb: mem_total / (1024 * 1024),
            memory_used_mb: mem_used / (1024 * 1024),
            memory_usage_percent: (mem_used as f32 / mem_total as f32) * 100.0,
            uptime_seconds: System::uptime(),
            total_processes: self.sys.processes().len(),
            network_rx_bytes: net_rx,
            network_tx_bytes: net_tx,
        }
    }

    /// Get all running processes with ONNX-based risk scoring.
    /// If `detector` is None, falls back to simple heuristic scoring.
    pub fn get_processes(&self, detector: Option<&Arc<OnnxDetector>>) -> Vec<ProcessInfo> {
        let mut procs: Vec<ProcessInfo> = self.sys.processes().iter().map(|(pid, p)| {
            let exe = p.exe()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default();
            
            // Build feature vector for ONNX model
            let is_signed_val = check_is_signed(&exe);
            let path_rep = compute_path_reputation(&exe);
            let entropy = compute_file_entropy(&exe);
            let cpu = p.cpu_usage();
            let mem_mb = p.memory() as f64 / (1024.0 * 1024.0);
            
            let features = ProcessFeatures {
                is_signed: is_signed_val,
                path_reputation: path_rep,
                entropy,
                registry_writes_sec: 0.0,   // TODO: requires ETW tracing (admin)
                outbound_conn_sec: 0.0,      // TODO: requires per-process conn tracking
                file_writes_sec: 0.0,        // TODO: requires ReadDirectoryChanges watcher
                cpu_usage: cpu,
                memory_mb: mem_mb as f32,
                threat_intel_match: 0.0,     // TODO: requires threat-intel feed ingest
                has_autorun: 0.0,            // TODO: requires Registry Run key scan
            };
            
            let (risk_score, category) = if let Some(det) = detector {
                det.score_process(&features)
            } else {
                // Fallback heuristic when ONNX model is not available
                let suspicious_path = exe.to_lowercase().contains("temp")
                    || exe.to_lowercase().contains("downloads")
                    || exe.to_lowercase().contains("appdata");
                let mut risk: f64 = 0.0;
                if suspicious_path { risk += 25.0; }
                if cpu > 80.0 { risk += 15.0; }
                if p.memory() > 500 * 1024 * 1024 { risk += 10.0; }
                if exe.is_empty() { risk += 20.0; }
                let cat = if risk >= 70.0 { "High Risk" }
                    else if risk >= 40.0 { "Suspicious" }
                    else if risk >= 20.0 { "Monitor" }
                    else { "Normal" };
                (risk, cat.to_string())
            };

            ProcessInfo {
                pid: pid.as_u32(),
                parent_pid: p.parent().map(|pp| pp.as_u32()),
                name: p.name().to_string(),
                exe_path: exe,
                cpu_usage: cpu,
                memory_mb: mem_mb,
                status: format!("{:?}", p.status()),
                is_signed: is_signed_val > 0.5,
                risk_score,
                category,
                start_time: p.start_time(),
            }
        }).collect();
        procs.sort_by(|a, b| b.risk_score.partial_cmp(&a.risk_score).unwrap_or(std::cmp::Ordering::Equal));
        procs
    }
}
