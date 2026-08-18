# Application Flow Diagrams — Sentinel AI

**Document Version:** 1.0  
**Project:** Sentinel AI (Desktop Security & Threat Detection Platform)  
**Target Architecture:** Tauri (Rust Core) + React + ONNX Runtime + ETW + Npcap  

---

## 1. Master System End-to-End Flow Diagram

The diagram below provides a holistic view of **Sentinel AI**, illustrating how hardware sensors, kernel tracing, passive capture, AI engine, database, and user interface interact across the lifecycle.

```mermaid
flowchart TD
    %% Subgraphs & Nodes Definition
    
    subgraph Data_Collection_Layer ["1. Data Collection & Sensor Layer"]
        ETW["Kernel ETW Provider\n(Process Start/Stop/Image-Load)"]
        NPCAP["Npcap Capture Engine\n(Packet Headers & Flow Metadata)"]
        DISCOVERY["Device Discovery Service\n(ARP / mDNS / SSDP Listening)"]
        REG_WATCH["Registry Monitor\n(Run / RunOnce / Services / Tasks)"]
        FS_WATCH["File System Watcher\n(Downloads / Temp / Startup / USB)"]
    end

    subgraph Processing_Inference_Layer ["2. Data Processing & Detection Engine"]
        FEAT_EXT["Feature Extraction Engine\n(Entropy, Signature, Path, Conn Rate)"]
        IOC_CACHE["Threat Intel Cache\n(SQLite Hash/IP/Domain Match)"]
        ONNX["ONNX ML Inference Engine\n(Random Forest / XGBoost Model)"]
        HEURISTICS["Rule-Based Heuristic Engine\n(MAC Randomization, Unsigned Binary)"]
        EVALUATOR{"Risk Evaluator\nRisk Score >= Threshold?"}
    end

    subgraph Storage_Logging_Layer ["3. Storage & Forensics Layer"]
        DB[(Local SQLite Database\nevents, alerts, timeline, devices)]
        AUDIT["Audit Log Generator\n(ATT&CK Technique Tagging)"]
    end

    subgraph UI_User_Action_Layer ["4. User Interface & Incident Response"]
        TAURI_IPC["Tauri IPC Bridge\n(Rust Core <-> React UI)"]
        DASHBOARD["React Desktop UI\n(Dashboard / Alerts / Timeline / Network / Devices)"]
        NOTIFICATION["System Toast / Notification"]
        USER_DECISION{"User Response Selection"}
        ACTION_PROC["Terminate Process\n(Win32 TerminateProcess API)"]
        ACTION_FW["Block IP / Device\n(Windows Firewall Rule via netsh/WFP)"]
        ACTION_ALLOW["Add to Allowlist\n(Suppress Future Alerts)"]
        ACTION_EXPORT["Export Incident Bundle\n(NIST SP 800-61 JSON/CSV)"]
    end

    %% Data Flow Connections
    ETW --> FEAT_EXT
    NPCAP --> FEAT_EXT
    DISCOVERY --> HEURISTICS
    REG_WATCH --> FEAT_EXT
    FS_WATCH --> FEAT_EXT

    FEAT_EXT --> IOC_CACHE
    FEAT_EXT --> ONNX
    IOC_CACHE --> EVALUATOR
    ONNX --> EVALUATOR
    HEURISTICS --> EVALUATOR

    EVALUATOR -- "No (Score < Threshold)" --> DB
    EVALUATOR -- "Yes (Score >= Threshold)" --> NOTIFICATION
    EVALUATOR -- "Yes (Score >= Threshold)" --> DB
    NOTIFICATION --> TAURI_IPC
    DB --> TAURI_IPC

    TAURI_IPC --> DASHBOARD
    DASHBOARD --> USER_DECISION

    USER_DECISION -- "Terminate Process" --> ACTION_PROC
    USER_DECISION -- "Block Network IP" --> ACTION_FW
    USER_DECISION -- "Trust / Allowlist" --> ACTION_ALLOW
    USER_DECISION -- "Export Forensics" --> ACTION_EXPORT

    ACTION_PROC --> AUDIT
    ACTION_FW --> AUDIT
    ACTION_ALLOW --> AUDIT
    ACTION_EXPORT --> AUDIT
    AUDIT --> DB
```

---

## 2. Component Detailed Flow Diagrams

### Flow 1: First-Run & Onboarding Initialization Flow

This sequence models the steps executed when Sentinel AI boots up for the first time or resumes monitoring.

```mermaid
flowchart TD
    START(["App Execution"]) --> ELEVATION{"Elevated Administrator Rights?"}
    
    ELEVATION -- "No" --> READ_ONLY["Display Elevation Warning Banner\n(Fallback to Read-Only Mode)"]
    ELEVATION -- "Yes" --> CONSENT["Present Consent & Scope Screen\n(Disclose Process & Network Monitoring Scope)"]
    
    CONSENT --> ACCEPTED{"User Accepted?"}
    ACCEPTED -- "No" --> TERMINATE(["Exit Application"])
    ACCEPTED -- "Yes" --> BASELINE["Run System Baseline Scan\n(Enumerate running processes, startup items, baseline ARP)"]
    
    BASELINE --> DB_INIT["Initialize SQLite Event Database"]
    DB_INIT --> MODEL_INIT["Load Bundle ONNX Model & Threat Intel Cache"]
    
    MODEL_INIT --> FEED_CHECK{"Threat Intel Feed Reachable?"}
    FEED_CHECK -- "Yes" --> FEED_UPDATE["Update Threat Intel Cache over TLS"]
    FEED_CHECK -- "No" --> FEED_STALE["Flag 'Feed Stale' Indicator in UI"]
    
    FEED_UPDATE --> MON_START["Start Background Monitoring Services"]
    FEED_STALE --> MON_START
    
    MON_START --> DASH_LAND(["Land on Main Dashboard UI"])
```

---

### Flow 2: Steady-State Monitoring & Threat Detection Pipeline

This sequence outlines how incoming system signals (ETW, Npcap, Registry, File System) are processed, evaluated by the AI model, and categorized into alerts or log entries.

```mermaid
flowchart TD
    subgraph Sensors ["Telemetry Generation"]
        S1["ETW Process Events"]
        S2["Npcap Packet Headers"]
        S3["Registry Changes"]
        S4["File Events"]
    end

    subgraph Feature_Processing ["Feature Extraction & Correlation"]
        F1["Extract Feature Vector:\n- Signed status\n- Path entropy & location\n- Outbound conn rate/sec\n- Registry write frequency"]
        F2["Correlate Socket to PID\n(GetExtendedTcpTable)"]
        F3["Lookup Hash / IP / Domain in IOC Cache"]
    end

    subgraph Inference ["AI Inference & Classification"]
        M1["Run ONNX Model Inference\n(Calculate Threat Score 0-100)"]
        M2{"IOC Match Found?"}
    end

    subgraph Evaluation ["Threshold Evaluation"]
        M2 -- "Yes" --> MAX_SCORE["Elevate Score to High/Critical"]
        M2 -- "No" --> MODEL_SCORE["Use Model Probability Score"]
        
        MAX_SCORE --> THRESHOLD{"Score >= Alert Threshold?"}
        MODEL_SCORE --> THRESHOLD
        
        THRESHOLD -- "No" --> LOG_EVENT["Persist Event to SQLite\n(Normal Telemetry Log)"]
        THRESHOLD -- "Yes" --> CREATE_ALERT["Create Alert Record\n(Assign MITRE ATT&CK Tag)"]
    end

    subgraph Alerting ["User Notification"]
        CREATE_ALERT --> NOTIFY["Dispatch Desktop Toast & UI Badge"]
    end

    S1 --> F1
    S2 --> F2 --> F1
    S3 --> F1
    S4 --> F3 --> F1

    F1 --> M1
    M1 --> M2
```

---

### Flow 3: Alert Triage & Incident Mitigation Workflow

This sequence details how a user interacts with an alert from notification to response enforcement and audit logging.

```mermaid
flowchart TD
    ALERT_IN(["New Alert Received"]) --> CLICK["User clicks Toast or Alert Badge"]
    CLICK --> DETAIL_VIEW["Open Alert Detail View"]
    
    DETAIL_VIEW --> DISPLAY_DETAILS["Display Threat Analysis:\n- Triggering Entity (PID / IP / File)\n- AI Explanation & Contributing Factors\n- Risk Score & ATT&CK Technique Tag"]
    
    DISPLAY_DETAILS --> USER_ACTION{"User Decision"}
    
    USER_ACTION -- "Terminate Process" --> PROC_CONFIRM{"Confirm Termination?"}
    PROC_CONFIRM -- "Yes" --> KILL_PROC["Execute TerminateProcess(PID)"]
    PROC_CONFIRM -- "No" --> DETAIL_VIEW

    USER_ACTION -- "Block IP / Device" --> FW_CONFIRM{"Confirm Firewall Rule?"}
    FW_CONFIRM -- "Yes" --> CREATE_FW["Add Windows Firewall Rule\n(Block remote IP via Netsh/WFP)"]
    FW_CONFIRM -- "No" --> DETAIL_VIEW

    USER_ACTION -- "Allowlist" --> ADD_ALLOW["Add Hash/Path to Local Allowlist"]
    USER_ACTION -- "Dismiss / Snooze" --> MARK_REVIEWED["Mark Alert as Reviewed / Snoozed"]

    KILL_PROC --> LOG_ACTION["Log Action to SQLite Audit Trail"]
    CREATE_FW --> LOG_ACTION
    ADD_ALLOW --> LOG_ACTION
    MARK_REVIEWED --> LOG_ACTION

    LOG_ACTION --> UPDATE_TIMELINE["Update Attack Timeline View"]
    UPDATE_TIMELINE --> DONE(["Triage Complete"])
```

---

### Flow 4: Connected Device Discovery & Defense Flow

This sequence models local network device scanning, ARP table monitoring, vendor identification, and heuristic risk scoring.

```mermaid
flowchart TD
    SCAN_TRIGGER(["60s Discovery Interval / Event Trigger"]) --> ENUM_SUBNET["Enumerate Local Subnet via ARP & Passive mDNS/SSDP"]
    ENUM_SUBNET --> GET_MAC["Extract MAC Address & IP"]
    
    GET_MAC --> OUI_LOOKUP["Query IEEE OUI Table for Vendor"]
    OUI_LOOKUP --> HEURISTICS{"Apply Device Heuristics"}
    
    HEURISTICS -- "Rapid MAC Changes detected" --> FLAG_RAND["Flag: MAC Randomization Detected"]
    HEURISTICS -- "Port Scan / Rapid Probe detected" --> FLAG_SCAN["Flag: Reconnaissance Activity"]
    HEURISTICS -- "Normal Behavior" --> FLAG_NORMAL["Status: Unclassified / Normal"]

    FLAG_RAND --> RISK_CHECK{"Risk Score High?"}
    FLAG_SCAN --> RISK_CHECK
    FLAG_NORMAL --> BASELINE_CHECK{"Present in Baseline?"}

    RISK_CHECK -- "Yes" --> ALERT_DEV["Flag 'Review Recommended' in Alerts"]
    RISK_CHECK -- "No" --> BASELINE_CHECK

    BASELINE_CHECK -- "No" --> LIST_DEV["Add to Device List as 'New Device'"]
    BASELINE_CHECK -- "Yes" --> UPDATE_SEEN["Update Last-Seen Timestamp"]

    ALERT_DEV --> USER_DEV_ACTION{"User Action on Device"}
    USER_DEV_ACTION -- "Mark Trusted" --> ADD_DEV_BASE["Add to Trusted Baseline Table"]
    USER_DEV_ACTION -- "Block Device" --> FW_DEV_BLOCK["Create Firewall Rule for Device IP"]
```

---

### Flow 5: Incident Forensics Export Flow (NIST SP 800-61 Alignment)

This sequence outlines the data compilation process when generating a forensic export bundle for digital forensics and incident response (DFIR).

```mermaid
flowchart TD
    USER_REQ(["User Selects Time Range / Incident"]) --> TRIGGER_EXPORT["Click 'Export Incident Bundle'"]
    TRIGGER_EXPORT --> FETCH_ALERT["Query SQLite for Target Alerts & Incidents"]
    
    FETCH_ALERT --> FETCH_TREE["Query Process Tree & Ancestry at Incident Timestamp"]
    FETCH_TREE --> FETCH_NET["Query Correlated Network Flows & Socket History"]
    FETCH_NET --> FETCH_REG_FILE["Query Registry Deltas & File Modifications"]
    FETCH_REG_FILE --> FETCH_AUDIT["Query Response Actions Taken (User / Auto)"]

    FETCH_AUDIT --> COMPOSE_BUNDLE["Assemble NIST SP 800-61 Rev. 2 Structured Bundle:\n1. Detection & Analysis Phase Data\n2. Containment & Mitigation Actions\n3. MITRE ATT&CK Mapping"]

    COMPOSE_BUNDLE --> GEN_FORMAT["Generate Export Files:\n- incident_report.json\n- process_tree.csv\n- network_flows.csv"]

    GEN_FORMAT --> WRITE_ZIP["Package & Save Local Zip Bundle"]
    WRITE_ZIP --> NOTIFY_EXPORT(["Surfaces Export Location to User"])
```

---

## 3. Data Flow Matrix Summary

| Data Flow Phase | Source Component | Processing Engine | Target Component / Output |
| :--- | :--- | :--- | :--- |
| **Process Monitoring** | Kernel ETW Provider (`Microsoft-Windows-Kernel-Process`) | Rust ETW Consumer & Feature Extractor | SQLite `processes` / `process_events` |
| **Network Correlation** | Npcap Driver & `GetExtendedTcpTable` | Flow Aggregator & Socket-to-PID Mapper | SQLite `network_flows` & Network UI |
| **Threat Classification** | Process & Network Feature Vectors | ONNX Runtime (`Random Forest / XGBoost`) | Risk Score (0-100) & AI Threat Explanation |
| **Device Discovery** | ARP Table & Passive mDNS Listening | IEEE OUI Lookup & Behavioral Heuristics | SQLite `devices` & Devices UI |
| **Incident Response** | UI User Action / Auto-Mitigation Engine | Win32 API (`TerminateProcess`) / Windows Firewall | Operating System Enforcement & Audit Log |
| **Forensic Audit** | SQLite Event Database | NIST SP 800-61 Package Builder | JSON / CSV Forensic Zip Bundle |

---
*End of Application Flow Diagram Document.*
