use rusqlite::{Connection, Result, params};
use std::sync::Mutex;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

use crate::monitor::ProcessInfo;
use crate::network_scanner::DiscoveredDevice;

/// Struct for stored alert records returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAlert {
    pub alert_id: i64,
    pub source_type: String,
    pub source_ref_id: i64,
    pub source_name: String,
    pub risk_score: f64,
    pub category_label: String,
    pub attck_technique: Option<String>,
    pub explanation: Vec<String>,
    pub status: String,
    pub created_ts: i64,
}

/// Struct for stored timeline events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTimelineEvent {
    pub timeline_id: i64,
    pub event_ts: i64,
    pub event_category: String,
    pub summary_text: String,
    pub related_alert_id: Option<i64>,
}

/// Struct for stored devices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredDevice {
    pub device_id: i64,
    pub mac_address: String,
    pub vendor: Option<String>,
    pub device_name: Option<String>,
    pub current_ip: Option<String>,
    pub first_seen_ts: i64,
    pub last_seen_ts: i64,
    pub trust_status: String,
    pub mac_randomization_suspected: bool,
}

/// Incident export bundle structure (NIST SP 800-61 Rev 2 format)
#[derive(Debug, Serialize, Deserialize)]
pub struct IncidentBundle {
    pub export_timestamp: i64,
    pub date_from: String,
    pub date_to: String,
    pub schema_version: String,
    pub nist_framework: String,
    pub summary: IncidentSummary,
    pub processes: Vec<ProcessExportRecord>,
    pub network_flows: Vec<FlowExportRecord>,
    pub alerts: Vec<StoredAlert>,
    pub timeline_events: Vec<StoredTimelineEvent>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncidentSummary {
    pub process_count: usize,
    pub flow_count: usize,
    pub alert_count: usize,
    pub timeline_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessExportRecord {
    pub pid: u32,
    pub image_path: Option<String>,
    pub is_signed: bool,
    pub first_seen_ts: i64,
    pub last_seen_ts: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FlowExportRecord {
    pub src_ip: String,
    pub dst_ip: String,
    pub src_port: Option<u16>,
    pub dst_port: Option<u16>,
    pub protocol: String,
    pub started_ts: i64,
}

/// Database manager for Sentinel AI's local SQLite event store.
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Initialize the database at the given path, creating all tables if they don't exist.
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;
        
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.create_tables()?;
        db.insert_default_settings()?;
        Ok(db)
    }

    /// Create all 14 tables per the Database Schema Document
    fn create_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute_batch("
            -- Processes: current and historical process records
            CREATE TABLE IF NOT EXISTS processes (
                process_id      INTEGER PRIMARY KEY AUTOINCREMENT,
                pid             INTEGER NOT NULL,
                parent_pid      INTEGER,
                image_path      TEXT,
                command_line    TEXT,
                sha256_hash     TEXT,
                is_signed       INTEGER NOT NULL DEFAULT 0,
                signer_name     TEXT,
                first_seen_ts   INTEGER NOT NULL,
                last_seen_ts    INTEGER NOT NULL,
                is_active       INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_processes_pid ON processes(pid);
            CREATE INDEX IF NOT EXISTS idx_processes_hash ON processes(sha256_hash);

            -- Raw ETW-sourced lifecycle events
            CREATE TABLE IF NOT EXISTS process_events (
                event_id        INTEGER PRIMARY KEY AUTOINCREMENT,
                process_id      INTEGER NOT NULL REFERENCES processes(process_id),
                event_type      TEXT NOT NULL CHECK (event_type IN ('start','stop','image_load')),
                cpu_percent     REAL,
                ram_mb          REAL,
                event_ts        INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_process_events_process ON process_events(process_id);
            CREATE INDEX IF NOT EXISTS idx_process_events_ts ON process_events(event_ts);

            -- Aggregated network flow metadata
            CREATE TABLE IF NOT EXISTS network_flows (
                flow_id         INTEGER PRIMARY KEY AUTOINCREMENT,
                process_id      INTEGER REFERENCES processes(process_id),
                src_ip          TEXT NOT NULL,
                dst_ip          TEXT NOT NULL,
                src_port        INTEGER,
                dst_port        INTEGER,
                protocol        TEXT NOT NULL,
                sni_hostname    TEXT,
                dns_query_name  TEXT,
                bytes_sent      INTEGER DEFAULT 0,
                bytes_received  INTEGER DEFAULT 0,
                started_ts      INTEGER NOT NULL,
                last_updated_ts INTEGER NOT NULL,
                threat_intel_match INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_flows_dst_ip ON network_flows(dst_ip);
            CREATE INDEX IF NOT EXISTS idx_flows_process ON network_flows(process_id);

            -- Local network device inventory
            CREATE TABLE IF NOT EXISTS devices (
                device_id       INTEGER PRIMARY KEY AUTOINCREMENT,
                mac_address     TEXT NOT NULL,
                vendor          TEXT,
                device_name     TEXT,
                first_ip        TEXT,
                current_ip      TEXT,
                first_seen_ts   INTEGER NOT NULL,
                last_seen_ts    INTEGER NOT NULL,
                trust_status    TEXT NOT NULL DEFAULT 'unclassified'
                                CHECK (trust_status IN ('unclassified','trusted','flagged','blocked')),
                mac_randomization_suspected INTEGER DEFAULT 0
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_mac ON devices(mac_address);

            CREATE TABLE IF NOT EXISTS device_sightings (
                sighting_id     INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id       INTEGER NOT NULL REFERENCES devices(device_id),
                ip_at_sighting  TEXT,
                method          TEXT NOT NULL CHECK (method IN ('arp','mdns','ssdp','active_scan')),
                sighting_ts     INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sightings_device ON device_sightings(device_id);

            -- Registry persistence monitoring
            CREATE TABLE IF NOT EXISTS registry_events (
                reg_event_id    INTEGER PRIMARY KEY AUTOINCREMENT,
                hive_key_path   TEXT NOT NULL,
                value_name      TEXT,
                old_value       TEXT,
                new_value       TEXT,
                change_type     TEXT NOT NULL CHECK (change_type IN ('created','modified','deleted')),
                process_id      INTEGER REFERENCES processes(process_id),
                event_ts        INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_registry_ts ON registry_events(event_ts);

            -- Watched-folder file events
            CREATE TABLE IF NOT EXISTS file_events (
                file_event_id   INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path       TEXT NOT NULL,
                sha256_hash     TEXT,
                event_type      TEXT NOT NULL CHECK (event_type IN ('created','modified','deleted','executed','renamed')),
                process_id      INTEGER REFERENCES processes(process_id),
                event_ts        INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_file_events_ts ON file_events(event_ts);

            -- USB device insertion + scan outcome
            CREATE TABLE IF NOT EXISTS usb_events (
                usb_event_id    INTEGER PRIMARY KEY AUTOINCREMENT,
                device_serial   TEXT,
                device_desc     TEXT,
                scan_result     TEXT NOT NULL CHECK (scan_result IN ('clean','suspicious_quarantined','blocked')),
                files_scanned   INTEGER DEFAULT 0,
                findings_json   TEXT,
                event_ts        INTEGER NOT NULL
            );

            -- Cached external threat-intel indicators
            CREATE TABLE IF NOT EXISTS threat_intel_indicators (
                indicator_id    INTEGER PRIMARY KEY AUTOINCREMENT,
                indicator_type  TEXT NOT NULL CHECK (indicator_type IN ('sha256','ip','domain','url')),
                indicator_value TEXT NOT NULL,
                source_feed     TEXT NOT NULL,
                first_imported_ts INTEGER NOT NULL,
                last_confirmed_ts INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_ioc_value ON threat_intel_indicators(indicator_type, indicator_value);

            -- Alerts produced by the Detection Engine
            CREATE TABLE IF NOT EXISTS alerts (
                alert_id        INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type     TEXT NOT NULL CHECK (source_type IN ('process','network','device','registry','file','usb')),
                source_ref_id   INTEGER NOT NULL,
                risk_score      REAL NOT NULL,
                category_label  TEXT,
                attck_technique TEXT,
                explanation_json TEXT,
                status          TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','reviewed','dismissed','actioned')),
                created_ts      INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
            CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_ts);

            -- Responses taken against alerts
            CREATE TABLE IF NOT EXISTS responses (
                response_id     INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id        INTEGER NOT NULL REFERENCES alerts(alert_id),
                action_type     TEXT NOT NULL CHECK (action_type IN ('terminate_process','block_ip','block_device','allowlist','dismiss')),
                actor           TEXT NOT NULL CHECK (actor IN ('user','auto')),
                outcome         TEXT,
                action_ts       INTEGER NOT NULL
            );

            -- Denormalized timeline for fast UI queries
            CREATE TABLE IF NOT EXISTS timeline_events (
                timeline_id     INTEGER PRIMARY KEY AUTOINCREMENT,
                event_ts        INTEGER NOT NULL,
                event_category  TEXT NOT NULL,
                summary_text    TEXT NOT NULL,
                related_alert_id INTEGER REFERENCES alerts(alert_id)
            );
            CREATE INDEX IF NOT EXISTS idx_timeline_ts ON timeline_events(event_ts);

            -- App settings (key/value)
            CREATE TABLE IF NOT EXISTS settings (
                key             TEXT PRIMARY KEY,
                value           TEXT NOT NULL
            );

            -- User-approved exceptions
            CREATE TABLE IF NOT EXISTS allowlist (
                allowlist_id    INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type     TEXT NOT NULL CHECK (entity_type IN ('process_hash','ip','device_mac')),
                entity_value    TEXT NOT NULL,
                reason          TEXT,
                added_ts        INTEGER NOT NULL
            );
        ")?;
        
        Ok(())
    }

    /// Insert default settings if they don't exist
    fn insert_default_settings(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let defaults = vec![
            ("detection_threshold", "65"),
            ("auto_response_enabled", "false"),
            ("retention_days", "30"),
            ("scan_interval_seconds", "2"),
            ("device_scan_interval_seconds", "60"),
        ];

        for (key, value) in defaults {
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?;
        }
        Ok(())
    }

    /// Save refreshed processes & process events & generate alerts/timeline if high risk
    pub fn persist_processes(&self, procs: &[ProcessInfo], threshold: f64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

        for p in procs {
            // Find existing process by pid
            let mut stmt = conn.prepare("SELECT process_id FROM processes WHERE pid = ?1 AND is_active = 1")?;
            let mut rows = stmt.query(params![p.pid])?;
            
            let display_path = if p.exe_path.is_empty() { &p.name } else { &p.exe_path };
            let proc_id: i64 = if let Some(row) = rows.next()? {
                let id: i64 = row.get(0)?;
                conn.execute(
                    "UPDATE processes SET last_seen_ts = ?1, image_path = ?2, is_signed = ?3 WHERE process_id = ?4",
                    params![now, display_path, if p.is_signed { 1 } else { 0 }, id],
                )?;
                id
            } else {
                conn.execute(
                    "INSERT INTO processes (pid, parent_pid, image_path, is_signed, first_seen_ts, last_seen_ts, is_active)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
                    params![p.pid, p.parent_pid, display_path, if p.is_signed { 1 } else { 0 }, now, now],
                )?;
                conn.last_insert_rowid()
            };

            // Log event sample
            conn.execute(
                "INSERT INTO process_events (process_id, event_type, cpu_percent, ram_mb, event_ts)
                 VALUES (?1, 'start', ?2, ?3, ?4)",
                params![proc_id, p.cpu_usage, p.memory_mb, now],
            )?;

            // Generate Alert if risk_score >= threshold
            if p.risk_score >= threshold {
                let mut alert_stmt = conn.prepare(
                    "SELECT alert_id FROM alerts WHERE source_type = 'process' AND source_ref_id = ?1 AND status = 'open'"
                )?;
                let exists = alert_stmt.exists(params![proc_id])?;
                if !exists {
                    let expl_json = serde_json::to_string(&vec![
                        format!("Binary path: {}", if p.exe_path.is_empty() { "Unknown" } else { &p.exe_path }),
                        format!("Scored category: {}", p.category),
                        format!("CPU: {:.1}%, Memory: {:.0} MB", p.cpu_usage, p.memory_mb),
                    ]).unwrap_or_default();

                    let technique = match p.category.as_str() {
                        "Trojan" => Some("T1059".to_string()),
                        "Ransomware-like" => Some("T1486".to_string()),
                        "PUA" => Some("T1547".to_string()),
                        _ => Some("T1082".to_string()),
                    };

                    conn.execute(
                        "INSERT INTO alerts (source_type, source_ref_id, risk_score, category_label, attck_technique, explanation_json, status, created_ts)
                         VALUES ('process', ?1, ?2, ?3, ?4, ?5, 'open', ?6)",
                        params![proc_id, p.risk_score, p.category, technique, expl_json, now],
                    )?;
                    let alert_id = conn.last_insert_rowid();

                    conn.execute(
                        "INSERT INTO timeline_events (event_ts, event_category, summary_text, related_alert_id)
                         VALUES (?1, 'alert', ?2, ?3)",
                        params![now, format!("Alert: Process {} (PID {}) flagged as {} (Score: {:.0})", p.name, p.pid, p.category, p.risk_score), alert_id],
                    )?;
                }
            }
        }

        Ok(())
    }

    /// Save discovered network devices to database
    pub fn persist_devices(&self, devices: &[DiscoveredDevice]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

        for d in devices {
            let mut stmt = conn.prepare("SELECT device_id FROM devices WHERE mac_address = ?1")?;
            let mut rows = stmt.query(params![d.mac_address])?;

            let device_id: i64 = if let Some(row) = rows.next()? {
                let id: i64 = row.get(0)?;
                conn.execute(
                    "UPDATE devices SET current_ip = ?1, vendor = ?2, device_name = ?3, last_seen_ts = ?4 WHERE device_id = ?5",
                    params![d.ip_address, d.vendor, d.hostname, now, id],
                )?;
                id
            } else {
                let trust = if d.is_gateway || d.is_self { "trusted" } else { "unclassified" };
                conn.execute(
                    "INSERT INTO devices (mac_address, vendor, device_name, first_ip, current_ip, first_seen_ts, last_seen_ts, trust_status)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![d.mac_address, d.vendor, d.hostname, d.ip_address, d.ip_address, now, now, trust],
                )?;
                let id = conn.last_insert_rowid();

                // Log timeline event for new device
                conn.execute(
                    "INSERT INTO timeline_events (event_ts, event_category, summary_text)
                     VALUES (?1, 'device', ?2)",
                    params![now, format!("New device detected on network: {} ({}) - Vendor: {}", d.ip_address, d.mac_address, d.vendor)],
                )?;
                id
            };

            // Log sighting
            conn.execute(
                "INSERT INTO device_sightings (device_id, ip_at_sighting, method, sighting_ts)
                 VALUES (?1, ?2, 'arp', ?3)",
                params![device_id, d.ip_address, now],
            )?;
        }

        Ok(())
    }

    /// Retrieve alert history from SQLite database
    pub fn get_alert_history(&self) -> Result<Vec<StoredAlert>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT a.alert_id, a.source_type, a.source_ref_id, COALESCE(p.image_path, 'Process #' || a.source_ref_id),
                    a.risk_score, a.category_label, a.attck_technique, a.explanation_json, a.status, a.created_ts
             FROM alerts a
             LEFT JOIN processes p ON a.source_type = 'process' AND a.source_ref_id = p.process_id
             ORDER BY a.created_ts DESC LIMIT 100"
        )?;

        let rows = stmt.query_map([], |row| {
            let expl_raw: String = row.get(7).unwrap_or_default();
            let expl: Vec<String> = serde_json::from_str(&expl_raw).unwrap_or_else(|_| vec![expl_raw]);
            Ok(StoredAlert {
                alert_id: row.get(0)?,
                source_type: row.get(1)?,
                source_ref_id: row.get(2)?,
                source_name: row.get(3)?,
                risk_score: row.get(4)?,
                category_label: row.get(5).unwrap_or_else(|_| "Suspicious".to_string()),
                attck_technique: row.get(6)?,
                explanation: expl,
                status: row.get(8)?,
                created_ts: row.get(9)?,
            })
        })?;

        let mut alerts = Vec::new();
        for r in rows {
            alerts.push(r?);
        }
        Ok(alerts)
    }

    /// Retrieve timeline history from SQLite database
    pub fn get_timeline_history(&self) -> Result<Vec<StoredTimelineEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT timeline_id, event_ts, event_category, summary_text, related_alert_id
             FROM timeline_events
             ORDER BY event_ts DESC LIMIT 100"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(StoredTimelineEvent {
                timeline_id: row.get(0)?,
                event_ts: row.get(1)?,
                event_category: row.get(2)?,
                summary_text: row.get(3)?,
                related_alert_id: row.get(4)?,
            })
        })?;

        let mut events = Vec::new();
        for r in rows {
            events.push(r?);
        }
        Ok(events)
    }

    /// Retrieve device history from SQLite database
    pub fn get_device_history(&self) -> Result<Vec<StoredDevice>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT device_id, mac_address, vendor, device_name, current_ip, first_seen_ts, last_seen_ts, trust_status, mac_randomization_suspected
             FROM devices
             ORDER BY last_seen_ts DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            let rand_susp: i32 = row.get(8).unwrap_or(0);
            Ok(StoredDevice {
                device_id: row.get(0)?,
                mac_address: row.get(1)?,
                vendor: row.get(2)?,
                device_name: row.get(3)?,
                current_ip: row.get(4)?,
                first_seen_ts: row.get(5)?,
                last_seen_ts: row.get(6)?,
                trust_status: row.get(7)?,
                mac_randomization_suspected: rand_susp == 1,
            })
        })?;

        let mut devices = Vec::new();
        for r in rows {
            devices.push(r?);
        }
        Ok(devices)
    }

    /// Build incident export per NIST SP 800-61 Rev 2
    pub fn export_incident_bundle(&self, from_ts: i64, to_ts: i64) -> Result<IncidentBundle> {
        let conn = self.conn.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

        // Query processes
        let mut proc_stmt = conn.prepare(
            "SELECT pid, image_path, is_signed, first_seen_ts, last_seen_ts
             FROM processes WHERE last_seen_ts >= ?1 AND first_seen_ts <= ?2"
        )?;
        let proc_rows = proc_stmt.query_map(params![from_ts, to_ts], |row| {
            let is_s: i32 = row.get(2)?;
            Ok(ProcessExportRecord {
                pid: row.get(0)?,
                image_path: row.get(1)?,
                is_signed: is_s == 1,
                first_seen_ts: row.get(3)?,
                last_seen_ts: row.get(4)?,
            })
        })?;
        let mut processes = Vec::new();
        for p in proc_rows { processes.push(p?); }

        // Query network flows
        let mut flow_stmt = conn.prepare(
            "SELECT src_ip, dst_ip, src_port, dst_port, protocol, started_ts
             FROM network_flows WHERE started_ts >= ?1 AND started_ts <= ?2"
        )?;
        let flow_rows = flow_stmt.query_map(params![from_ts, to_ts], |row| {
            Ok(FlowExportRecord {
                src_ip: row.get(0)?,
                dst_ip: row.get(1)?,
                src_port: row.get(2)?,
                dst_port: row.get(3)?,
                protocol: row.get(4)?,
                started_ts: row.get(5)?,
            })
        })?;
        let mut network_flows = Vec::new();
        for f in flow_rows { network_flows.push(f?); }

        // Query alerts
        let mut alert_stmt = conn.prepare(
            "SELECT a.alert_id, a.source_type, a.source_ref_id, COALESCE(p.image_path, 'Process #' || a.source_ref_id),
                    a.risk_score, a.category_label, a.attck_technique, a.explanation_json, a.status, a.created_ts
             FROM alerts a
             LEFT JOIN processes p ON a.source_type = 'process' AND a.source_ref_id = p.process_id
             WHERE a.created_ts >= ?1 AND a.created_ts <= ?2"
        )?;
        let alert_rows = alert_stmt.query_map(params![from_ts, to_ts], |row| {
            let expl_raw: String = row.get(7).unwrap_or_default();
            let expl: Vec<String> = serde_json::from_str(&expl_raw).unwrap_or_else(|_| vec![expl_raw]);
            Ok(StoredAlert {
                alert_id: row.get(0)?,
                source_type: row.get(1)?,
                source_ref_id: row.get(2)?,
                source_name: row.get(3)?,
                risk_score: row.get(4)?,
                category_label: row.get(5).unwrap_or_else(|_| "Suspicious".to_string()),
                attck_technique: row.get(6)?,
                explanation: expl,
                status: row.get(8)?,
                created_ts: row.get(9)?,
            })
        })?;
        let mut alerts = Vec::new();
        for a in alert_rows { alerts.push(a?); }

        // Query timeline
        let mut time_stmt = conn.prepare(
            "SELECT timeline_id, event_ts, event_category, summary_text, related_alert_id
             FROM timeline_events WHERE event_ts >= ?1 AND event_ts <= ?2"
        )?;
        let time_rows = time_stmt.query_map(params![from_ts, to_ts], |row| {
            Ok(StoredTimelineEvent {
                timeline_id: row.get(0)?,
                event_ts: row.get(1)?,
                event_category: row.get(2)?,
                summary_text: row.get(3)?,
                related_alert_id: row.get(4)?,
            })
        })?;
        let mut timeline_events = Vec::new();
        for t in time_rows { timeline_events.push(t?); }

        let summary = IncidentSummary {
            process_count: processes.len(),
            flow_count: network_flows.len(),
            alert_count: alerts.len(),
            timeline_count: timeline_events.len(),
        };

        Ok(IncidentBundle {
            export_timestamp: now,
            date_from: from_ts.to_string(),
            date_to: to_ts.to_string(),
            schema_version: "1.0.0".to_string(),
            nist_framework: "NIST SP 800-61 Rev. 2".to_string(),
            summary,
            processes,
            network_flows,
            alerts,
            timeline_events,
        })
    }
}
