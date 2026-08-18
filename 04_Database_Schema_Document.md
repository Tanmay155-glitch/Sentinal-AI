# Database Schema Document
## Sentinel AI — MVP (SQLite, local-first)

**Version:** 1.0

---

## 1. Design Notes
- SQLite is used as an embedded, single-file, zero-administration database appropriate for a local desktop agent, consistent with the TRD's technology choice.
- All timestamps stored as ISO-8601 UTC text or Unix epoch integers (pick one convention; epoch integer recommended for indexing performance).
- Foreign keys enforced via `PRAGMA foreign_keys = ON`.
- No table stores raw packet payloads or decrypted content — only metadata fields, per the Security Document's privacy-by-design requirement.

## 2. Entity List

| Table | Purpose |
|---|---|
| `processes` | Snapshot/lifecycle record of each observed process |
| `process_events` | Individual ETW-sourced events (start, stop, image load) |
| `network_flows` | Aggregated flow metadata from the capture service |
| `devices` | Local-network device inventory |
| `device_sightings` | Time-series of when/how a device was observed |
| `registry_events` | Persistence-relevant registry key changes |
| `file_events` | Watched-folder file create/modify/execute events |
| `usb_events` | USB insertion + scan results |
| `threat_intel_indicators` | Cached IOCs from external feeds |
| `alerts` | Detection Engine outputs that crossed the alert threshold |
| `responses` | Actions taken (by user or automated) in reaction to an alert |
| `timeline_events` | Denormalized, queryable event stream powering the Attack Timeline UI |
| `settings` | User-configurable app settings |
| `allowlist` | User-approved exceptions (process hash, IP, device MAC) |

## 3. Schema (DDL)

```sql
-- Processes: current and historical process records
CREATE TABLE processes (
    process_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    pid             INTEGER NOT NULL,
    parent_pid      INTEGER,
    image_path      TEXT,
    command_line    TEXT,
    sha256_hash     TEXT,
    is_signed       INTEGER NOT NULL DEFAULT 0,   -- 0/1 boolean
    signer_name     TEXT,
    first_seen_ts   INTEGER NOT NULL,
    last_seen_ts    INTEGER NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_processes_pid ON processes(pid);
CREATE INDEX idx_processes_hash ON processes(sha256_hash);

-- Raw-ish ETW-sourced lifecycle events
CREATE TABLE process_events (
    event_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id      INTEGER NOT NULL REFERENCES processes(process_id),
    event_type      TEXT NOT NULL CHECK (event_type IN ('start','stop','image_load')),
    cpu_percent     REAL,
    ram_mb          REAL,
    event_ts        INTEGER NOT NULL
);
CREATE INDEX idx_process_events_process ON process_events(process_id);
CREATE INDEX idx_process_events_ts ON process_events(event_ts);

-- Aggregated network flow metadata (no payload storage)
CREATE TABLE network_flows (
    flow_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id      INTEGER REFERENCES processes(process_id),   -- nullable if unattributed
    src_ip          TEXT NOT NULL,
    dst_ip          TEXT NOT NULL,
    src_port        INTEGER,
    dst_port        INTEGER,
    protocol        TEXT NOT NULL,          -- TCP/UDP/DNS/HTTP/HTTPS/etc.
    sni_hostname    TEXT,                   -- from TLS ClientHello, if present
    dns_query_name  TEXT,
    bytes_sent      INTEGER DEFAULT 0,
    bytes_received  INTEGER DEFAULT 0,
    started_ts      INTEGER NOT NULL,
    last_updated_ts INTEGER NOT NULL,
    threat_intel_match INTEGER DEFAULT 0    -- FK-like flag, see threat_intel_indicators
);
CREATE INDEX idx_flows_dst_ip ON network_flows(dst_ip);
CREATE INDEX idx_flows_process ON network_flows(process_id);

-- Local network device inventory
CREATE TABLE devices (
    device_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address     TEXT NOT NULL,
    vendor          TEXT,                   -- from IEEE OUI lookup
    device_name     TEXT,                   -- from mDNS/SSDP if available
    first_ip        TEXT,
    current_ip      TEXT,
    first_seen_ts   INTEGER NOT NULL,
    last_seen_ts    INTEGER NOT NULL,
    trust_status    TEXT NOT NULL DEFAULT 'unclassified'
                    CHECK (trust_status IN ('unclassified','trusted','flagged','blocked')),
    mac_randomization_suspected INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX idx_devices_mac ON devices(mac_address);

CREATE TABLE device_sightings (
    sighting_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id       INTEGER NOT NULL REFERENCES devices(device_id),
    ip_at_sighting  TEXT,
    method          TEXT NOT NULL CHECK (method IN ('arp','mdns','ssdp','active_scan')),
    sighting_ts     INTEGER NOT NULL
);
CREATE INDEX idx_sightings_device ON device_sightings(device_id);

-- Registry persistence monitoring
CREATE TABLE registry_events (
    reg_event_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    hive_key_path   TEXT NOT NULL,          -- e.g., HKCU\...\Run
    value_name      TEXT,
    old_value       TEXT,
    new_value       TEXT,
    change_type     TEXT NOT NULL CHECK (change_type IN ('created','modified','deleted')),
    process_id      INTEGER REFERENCES processes(process_id),  -- writer, if known
    event_ts        INTEGER NOT NULL
);
CREATE INDEX idx_registry_ts ON registry_events(event_ts);

-- Watched-folder file events
CREATE TABLE file_events (
    file_event_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path       TEXT NOT NULL,
    sha256_hash     TEXT,
    event_type      TEXT NOT NULL CHECK (event_type IN ('created','modified','deleted','executed','renamed')),
    process_id      INTEGER REFERENCES processes(process_id),
    event_ts        INTEGER NOT NULL
);
CREATE INDEX idx_file_events_ts ON file_events(event_ts);

-- USB device insertion + scan outcome
CREATE TABLE usb_events (
    usb_event_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    device_serial   TEXT,
    device_desc     TEXT,
    scan_result     TEXT NOT NULL CHECK (scan_result IN ('clean','suspicious_quarantined','blocked')),
    files_scanned   INTEGER DEFAULT 0,
    findings_json    TEXT,                  -- structured details of any flagged files
    event_ts        INTEGER NOT NULL
);

-- Cached external threat-intel indicators
CREATE TABLE threat_intel_indicators (
    indicator_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    indicator_type  TEXT NOT NULL CHECK (indicator_type IN ('sha256','ip','domain','url')),
    indicator_value TEXT NOT NULL,
    source_feed     TEXT NOT NULL,          -- named source, e.g. 'abuse.ch URLhaus'
    first_imported_ts INTEGER NOT NULL,
    last_confirmed_ts INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_ioc_value ON threat_intel_indicators(indicator_type, indicator_value);

-- Alerts produced by the Detection Engine
CREATE TABLE alerts (
    alert_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type     TEXT NOT NULL CHECK (source_type IN ('process','network','device','registry','file','usb')),
    source_ref_id   INTEGER NOT NULL,       -- points into the relevant source table
    risk_score      REAL NOT NULL,          -- 0-100, from model output
    category_label  TEXT,                   -- e.g., 'Ransomware-like', 'PUA', 'Unknown-suspicious'
    attck_technique TEXT,                   -- e.g., 'T1547' (MITRE ATT&CK tag)
    explanation_json TEXT,                  -- structured contributing factors for UI display
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','reviewed','dismissed','actioned')),
    created_ts      INTEGER NOT NULL
);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created ON alerts(created_ts);

-- Responses taken against alerts
CREATE TABLE responses (
    response_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id        INTEGER NOT NULL REFERENCES alerts(alert_id),
    action_type     TEXT NOT NULL CHECK (action_type IN ('terminate_process','block_ip','block_device','allowlist','dismiss')),
    actor           TEXT NOT NULL CHECK (actor IN ('user','auto')),
    outcome         TEXT,                   -- success/failure detail
    action_ts       INTEGER NOT NULL
);

-- Denormalized timeline for fast UI queries
CREATE TABLE timeline_events (
    timeline_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    event_ts        INTEGER NOT NULL,
    event_category  TEXT NOT NULL,          -- 'process','network','device','registry','file','usb','alert','response'
    summary_text    TEXT NOT NULL,
    related_alert_id INTEGER REFERENCES alerts(alert_id)
);
CREATE INDEX idx_timeline_ts ON timeline_events(event_ts);

-- App settings (single-row or key/value)
CREATE TABLE settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- User-approved exceptions
CREATE TABLE allowlist (
    allowlist_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('process_hash','ip','device_mac')),
    entity_value    TEXT NOT NULL,
    reason          TEXT,
    added_ts        INTEGER NOT NULL
);
```

## 4. Relationships Summary

- `processes` 1—N `process_events`, `network_flows`, `registry_events`, `file_events`
- `devices` 1—N `device_sightings`
- `alerts` 1—N `responses`
- `alerts.source_ref_id` is a polymorphic reference resolved via `source_type` (documented pattern; SQLite has no native polymorphic FK, so referential integrity for this field is enforced in the application layer, not the schema).

## 5. Retention & Privacy Notes
- `network_flows` intentionally has no payload/body column — only headers/metadata, per TRD FR-3.3 and the Security Document.
- A scheduled job purges rows in `process_events`, `network_flows`, `device_sightings`, `registry_events`, `file_events` older than the configured retention window (NFR-2 in the TRD), while `alerts` and `responses` are retained longer by default since they are lower-volume and higher forensic value.
