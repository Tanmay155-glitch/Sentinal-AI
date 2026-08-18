# Technical Requirements Document (TRD)
## Sentinel AI — MVP

**Version:** 1.0

---

## 1. Scope

This document specifies the technical requirements to build the MVP defined in the PRD. All API and library references below are cited against their official documentation to avoid unverifiable claims.

## 2. System Overview / High-Level Architecture

```
                    +----------------------------+
                    |   Desktop UI (Tauri+React)  |
                    +--------------+---------------+
                                   |  IPC (Tauri commands / local REST)
        +--------------------------+--------------------------+
        |                          |                           |
+---------------+       +-------------------+       +--------------------+
| Process/Reg/  |       | Network Capture   |       | Local Device       |
| File Monitor  |       | Service           |       | Discovery Service  |
| (ETW consumer)|       | (Npcap / libpcap) |       | (ARP / mDNS)       |
+-------+-------+       +---------+---------+       +---------+----------+
        |                         |                            |
        +------------+------------+------------+---------------+
                      |                         |
             +--------v---------+     +---------v----------+
             | Detection Engine |     | Threat Intel Cache  |
             | (rules + ML      |     | (local DB of IOCs   |
             |  inference)      |     |  from public feeds) |
             +--------+---------+     +---------+-----------+
                      |                          |
                      +------------+-------------+
                                   |
                          +--------v---------+
                          | SQLite event/log |
                          | store            |
                          +--------+---------+
                                   |
                          +--------v---------+
                          | Alert & Response |
                          | (terminate proc, |
                          |  firewall rule)  |
                          +------------------+
```

## 3. Technology Stack and Justification

| Layer | Choice | Rationale / Source |
|---|---|---|
| Desktop shell + UI | Tauri (Rust core) + React | Lighter resource footprint than Electron for a monitoring agent that must itself stay low-overhead; React for component-driven dashboard UI |
| Core monitoring services | Rust | Memory-safety and performance for long-running, privileged background services |
| ML training | Python, scikit-learn / XGBoost / PyTorch | Standard, well-documented ML ecosystem |
| ML inference in the Rust agent | ONNX Runtime | Allows Python-trained models (scikit-learn/XGBoost/PyTorch) to be exported to ONNX format and run from Rust/C++ without embedding a Python interpreter in the shipped agent |
| Local storage | SQLite | Embedded, zero-admin database suitable for a single-host desktop agent; matches the source concept's own recommendation |
| Process/kernel telemetry | Event Tracing for Windows (ETW) | Microsoft's built-in, documented, low-overhead tracing framework for both user-mode and kernel-mode events; can be dynamically enabled/disabled without reboot. Security tools commonly consume the `Microsoft-Windows-Kernel-Process` provider for process start/stop/image-load events. (Source: Microsoft Learn, "About Event Tracing"; "Event Tracing for Windows is simplified") |
| Packet capture | Npcap | The Nmap Project's actively maintained Windows packet capture/injection library, successor to the discontinued WinPcap; implements the portable libpcap API via an NDIS 6 Lightweight Filter driver, and supports an "Admin-only" restricted mode. (Source: npcap.com; nmap/npcap GitHub) |
| Threat intel format | STIX/TAXII-compatible ingestion where feasible | STIX (Structured Threat Information Expression) is a widely used format for describing indicators of compromise, referenced in NIST guidance on cyber threat intelligence sharing |
| Registry/persistence monitoring | Windows Registry APIs / ETW registry provider | Native Windows APIs for reading Run/RunOnce/Services/Scheduled Task keys |

**Note on the original tech-stack options:** the source concept also listed Electron, C# WPF, Go, and C++ as viable alternatives. These remain valid alternate choices; Tauri+Rust is selected here specifically for lower background resource usage, which matters for an always-on monitoring agent, but the team should re-validate this choice against its own skill set before committing.

## 4. Functional Requirements by Module

### 4.1 Process Monitoring Service
- FR-1.1: Subscribe to the `Microsoft-Windows-Kernel-Process` ETW provider for process start, process stop, and image-load events. (Confirmed feasible per Microsoft Learn and independent technical write-ups on ETW-based security tooling.)
- FR-1.2: For each active process, query PID, parent PID, image path, command line, and Authenticode signature status via standard Win32/WMI APIs.
- FR-1.3: Poll CPU/RAM usage via Performance Counters or `NtQuerySystemInformation`-class APIs at a configurable interval (default 2s) to bound overhead.
- FR-1.4: Flag processes with an unsigned or invalid digital signature launched from user-writable paths (Downloads, Temp, AppData) as elevated-scrutiny candidates for the detection engine, not as automatic verdicts.

### 4.2 Detection Engine (AI Malware Classification)
- FR-2.1: Extract a documented, fixed feature vector per process (e.g., signed/unsigned, path reputation, entropy of on-disk image, count of registry writes/sec, count of outbound connections/sec, presence in local threat-intel cache).
- FR-2.2: Run inference via ONNX Runtime against a model trained and versioned offline; every shipped model must have a model card recording training dataset, date, and measured precision/recall.
- FR-2.3: Output a **risk score (0–100)** and a **category label** drawn from a fixed taxonomy (e.g., Trojan, Ransomware-like, PUA, Unknown-suspicious), never an invented named malware family unless matched against a real threat-intel signature.
- FR-2.4: All confidence values displayed in the UI must originate from the model's actual output probability, not a hardcoded/mock value.

### 4.3 Network Capture Service
- FR-3.1: Use Npcap in **Admin-only mode** to capture packet headers on active adapters.
- FR-3.2: Parse and summarize by flow: 5-tuple (src IP, dst IP, src port, dst port, protocol), byte/packet counters, and (where unencrypted) DNS query names.
- FR-3.3: For TLS traffic, extract only metadata available without decryption (e.g., SNI hostname from the ClientHello, JA3/JA3S-style fingerprint) — do not attempt to decrypt user traffic (see Security Document, §Privacy).
- FR-3.4: Correlate flows to the owning local process using OS-provided socket-to-PID tables (e.g., `GetExtendedTcpTable`/`GetExtendedUdpTable` on Windows) to populate the "Application Network Monitor" view for the local host only.

### 4.4 Device Discovery Service
- FR-4.1: Enumerate devices on the local subnet via ARP table inspection and active ARP requests, plus mDNS/SSDP broadcast listening for device names.
- FR-4.2: Record MAC address, vendor (via OUI lookup against the public IEEE OUI registry), observed IP, and first/last-seen timestamps.
- FR-4.3: Flag devices whose MAC address changes repeatedly (consistent with MAC randomization) or that appear only briefly and scan multiple ports, as "unusual device behavior" — labeled as a heuristic flag, not a confirmed verdict.
- FR-4.4: Explicitly do **not** attempt to enumerate applications running on other devices; this is out of scope per PRD §3.2 and technically unreliable without an agent on that device.

### 4.5 Response Actions
- FR-5.1: Allow user-confirmed process termination via `TerminateProcess`/equivalent, logged with actor (user vs. auto-response, if enabled) and timestamp.
- FR-5.2: Allow user-confirmed creation of a local Windows Firewall rule blocking a given remote IP (via the Windows Filtering Platform / `netsh advfirewall` equivalent API).
- FR-5.3: Any **automatic** (non-user-confirmed) response action must be behind an explicit opt-in setting, disabled by default, given the risk of false-positive service disruption.

### 4.6 Threat Intelligence Cache
- FR-6.1: Periodically download and cache indicator lists from named, publicly documented open feeds (e.g., abuse.ch URLhaus/MalwareBazaar, or another explicitly named source the team selects and cites) — never fabricate a feed name.
- FR-6.2: Match observed file hashes, destination IPs, and domains against the cache; log a match as a threat-intel hit with source feed attribution.

### 4.7 Logging, Timeline, and Basic Forensics
- FR-7.1: Persist all events (process, network, registry, file, device, alert, response) to the local SQLite store with a common timestamp and, where applicable, a MITRE ATT&CK tactic/technique tag (e.g., T1547 for a registry Run-key persistence event) to give alerts a standard vocabulary. MITRE ATT&CK is a public, MITRE-maintained knowledge base of adversary tactics and techniques used widely across the security industry, including by CISA. (Source: MITRE ATT&CK / Wikipedia; Palo Alto Networks Cyberpedia)
- FR-7.2: Provide an export function producing a timestamped incident bundle (process tree, network history, registry diffs, alerts) as the basic "digital forensics" deliverable, structured loosely on the NIST SP 800-61 Rev. 2 incident-handling lifecycle (Preparation; Detection & Analysis; Containment, Eradication & Recovery; Post-Incident Activity). (Source: NIST SP 800-61 Rev. 2, "Computer Security Incident Handling Guide")

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Background CPU overhead of monitoring services < 5% on a typical 4-core consumer laptop under idle-to-light load |
| NFR-2 | Local event database growth bounded via retention policy (e.g., 30/90-day rolling window, configurable) |
| NFR-3 | All privileged operations (process termination, firewall changes) require the app to run elevated and require an in-app confirmation dialog |
| NFR-4 | The application must not disable, and must clearly disclose that it does not replace, the OS's built-in real-time antivirus protection |
| NFR-5 | Model inference must complete in under 200ms per process evaluation to remain usable in near-real-time |
| NFR-6 | All outbound calls (threat-intel feed refresh) must be over TLS to a fixed, documented allow-list of feed hostnames |

## 6. Known Technical Constraints (carried over from source concept, verified)

- Full API-call interception and advanced anti-tamper protection genuinely require either kernel-mode drivers or Microsoft's restricted **ETW Threat-Intelligence provider**, which is documented as inaccessible to normal user-mode processes without Protected Process Light (PPL) status — i.e., without being a Microsoft-signed security product. (Source: Hackers Terminal, "Event Tracing for Windows (ETW): The Ultimate Guide for SOC Analysts") This is why FR-2 in the MVP relies on user-mode-visible signals rather than claiming full kernel-level API interception.
- Packet capture and any traffic blocking require administrative privileges; Npcap itself documents an admin-only restricted mode specifically to reduce the attack surface of granting raw packet access. (Source: npcap.com)
- Identifying another network device's specific running applications is not achievable from network vantage point alone against modern encrypted traffic, confirmed by the source concept's own "Challenges" section and consistent with general network-security practice; this constraint is carried into FR-4.4 as an explicit non-goal.
