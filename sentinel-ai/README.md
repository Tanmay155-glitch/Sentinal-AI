# Sentinel AI — Intelligent Endpoint Threat Detection and Response System

<p align="center">
  <strong>A portfolio-grade Endpoint Detection and Response (EDR) tool</strong><br>
  Built with Tauri + React + Rust + ONNX Runtime
</p>

---

## 📋 Overview

Sentinel AI is a desktop endpoint security application combining real-time process monitoring, AI-assisted malware classification, network traffic inspection, and local-network device discovery into a single console. It is positioned as a learning/portfolio-grade EDR tool for cybersecurity students and researchers.

### Key Capabilities

| Module | Description |
|--------|------------|
| **Process Monitor** | Live process enumeration with CPU/RAM, signature verification, risk scoring |
| **AI Detection Engine** | ML-based malware classification using ONNX Runtime (Random Forest/XGBoost) |
| **Network Analyzer** | Flow-level metadata capture (no decryption) with process-to-socket correlation |
| **Device Scanner** | Local subnet discovery via ARP/mDNS with MAC randomization detection |
| **Alert & Triage** | MITRE ATT&CK-tagged alerts with explainable AI verdicts |
| **Attack Timeline** | Chronological event feed across all monitoring sources |
| **Incident Export** | NIST SP 800-61 Rev.2 structured forensic bundles |
| **Registry/File/USB** | Persistence monitoring, file watching, USB scan-on-insert |

## 🏗️ Architecture

```
Desktop UI (Tauri + React + TypeScript)
           │
           │  IPC (Tauri Commands)
           │
    ┌──────┴───────┐
    │  Rust Core   │
    │  Services    │
    ├──────────────┤
    │ Process Mon  │ ← ETW / sysinfo
    │ Network Cap  │ ← Npcap / libpcap
    │ Device Disc  │ ← ARP / mDNS
    │ Detection    │ ← ONNX Runtime
    ├──────────────┤
    │   SQLite     │ ← Local event store
    └──────────────┘
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **Rust** ≥ 1.70
- **Npcap** (for network capture features)
- **Windows 10/11 x64**

### Installation

```bash
cd sentinel-ai
npm install
```

### Development (Frontend only)

```bash
npm run dev
```

### Development (Full Tauri app)

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## 📁 Project Structure

```
sentinel-ai/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   │   └── Sidebar.tsx     # Navigation sidebar
│   ├── pages/              # Page components (8 screens)
│   │   ├── Dashboard.tsx       # Security overview
│   │   ├── ProcessMonitor.tsx  # Process table with risk
│   │   ├── NetworkMonitor.tsx  # Network flow analysis
│   │   ├── Devices.tsx         # Device inventory
│   │   ├── Alerts.tsx          # Alert triage
│   │   ├── Timeline.tsx        # Event timeline
│   │   ├── IncidentExport.tsx  # Forensic export
│   │   └── Settings.tsx        # Configuration
│   ├── services/           # Data services
│   │   └── mockData.ts     # Simulated telemetry data
│   ├── styles/
│   │   └── global.css      # Design system
│   ├── App.tsx             # Router + layout
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri commands + app setup
│   │   ├── database.rs     # SQLite schema (14 tables)
│   │   └── monitor.rs      # System monitoring service
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── ml/                     # ML training pipeline
│   └── train_model.py      # Model training script
└── docs/                   # Project documentation
    ├── 01_PRD.md
    ├── 02_TRD.md
    ├── 03_App_Flow.md
    ├── 04_Database_Schema.md
    ├── 05_UI_UX_Design.md
    ├── 06_Implementation_Plan.md
    └── 07_Security.md
```

## 🔒 Security & Privacy

- **No traffic decryption** — only metadata (5-tuple, SNI, DNS queries)
- **No visibility into other devices' apps** — technically impossible against encrypted traffic
- **Data minimization** — no packet payload storage
- **User consent** — explicit disclosure on first launch
- **Not a replacement** for OS antivirus

## 📊 Standards Alignment

- **MITRE ATT&CK** — Alert tagging with technique IDs
- **NIST SP 800-61 Rev. 2** — Incident export lifecycle structure
- **STIX** — Threat intel indicator format compatibility

## ⚠️ Disclaimer

Sentinel AI is a student/portfolio-grade tool. It should not be relied upon as sole protection for sensitive or production systems.

## 📄 License

MIT
