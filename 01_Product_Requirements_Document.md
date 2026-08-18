# Product Requirements Document (PRD)
## Sentinel AI — Intelligent Endpoint Threat Detection and Response System

**Version:** 1.0 (MVP Scope)
**Document owner:** [Project Lead]
**Status:** Draft for review

---

## 1. Purpose and Background

Sentinel AI is a desktop endpoint security application that combines real-time process monitoring, AI-assisted malware classification, network traffic inspection, and local-network device discovery into a single console. It is positioned as a learning/portfolio-grade Endpoint Detection and Response (EDR) tool, not a commercial replacement for mature products such as Microsoft Defender for Endpoint, CrowdStrike Falcon, or SentinelOne Singularity, which are built by large, dedicated engineering teams and certified against independent testing labs (e.g., AV-TEST, AV-Comparatives, SE Labs).

This PRD defines a **Minimum Viable Product (MVP)** carved out of the full 14-module vision described in the source concept, because the full vision requires kernel-driver development, large labeled malware datasets, and enterprise network infrastructure access that are out of scope for a single team/final-year project.

## 2. Problem Statement

Traditional signature-based antivirus struggles against:
- Fileless malware and living-off-the-land techniques
- Zero-day and polymorphic malware without known signatures
- Ransomware that encrypts data faster than a human analyst can react
- Rogue/unauthorized devices joining a home or small-office network

Sentinel AI addresses a **subset** of these problems for a single Windows endpoint and its local network segment.

## 3. Goals and Non-Goals

### 3.1 MVP Goals
1. Continuously enumerate running processes and their key attributes (PID, parent, CPU/RAM, file path, digital signature status).
2. Classify process behavior using a supervised ML model trained on a public malware/benign feature dataset, producing a risk score and category label.
3. Capture and summarize local network traffic (protocol, source/destination, volume) using a standard packet-capture driver.
4. Discover devices on the local network segment (via ARP/mDNS/network scan) and flag devices with anomalous identifiers (e.g., randomized MAC addresses).
5. Allow the user to terminate a flagged process, and to create a local firewall rule blocking a flagged IP/device.
6. Maintain a local event log (process starts, alerts, blocks) for post-incident review, structured loosely on MITRE ATT&CK tactic/technique tagging so alerts have a standard vocabulary.
7. Present all of the above in a single-machine desktop dashboard.

### 3.2 Explicit Non-Goals (MVP)
- **No kernel-mode driver development.** The MVP uses user-mode ETW consumption and existing capture drivers (Npcap) rather than writing a custom minifilter/kernel driver. Kernel driver work (self-signed, WHQL-signed, anti-tamper) is listed as a post-MVP/Future phase.
- **No claim of identifying which application another device on the network is using.** As the source concept itself correctly notes, this is not feasible against encrypted traffic without controlling that device or the network infrastructure (managed switch/router, enterprise agent, or TLS-terminating proxy). The MVP only reports IP/MAC/protocol/port-level metadata for other devices, not per-app activity.
- No cross-platform (Linux/macOS) support in MVP — Windows only, because the richest telemetry source (ETW, Windows Defender APIs, WMI) is Windows-specific.
- No cloud-hosted multi-tenant SaaS backend in MVP — single-machine, local-first.
- No claim of "replacing antivirus" — MVP is explicitly a **complementary monitoring and alerting layer**, and should not disable or replace the OS's built-in real-time protection during development/testing.
- No dark-web monitoring, browser exploit prevention, or ransomware file rollback in MVP (Future Features backlog).

## 4. Target Users

| Persona | Need |
|---|---|
| Final-year CS/Cybersecurity student | A demonstrable, defensible capstone project showing applied AI + systems security |
| Home-lab / small-office power user | Visibility into what's running and what's talking on the network |
| Security learner / SOC-analyst-in-training | A sandbox to practice triage, using MITRE ATT&CK-aligned alert data |

## 5. MVP Feature List (mapped to original 14 modules)

| # | Original Module | MVP Treatment |
|---|---|---|
| 1 | Real-Time Process Monitoring | **In scope** — process list, CPU/RAM, signature check, parent/child tree |
| 2 | AI Malware Detection | **In scope, scoped down** — static/behavioral feature classifier (not full API-call-sequence deep learning in MVP) |
| 3 | Network Packet Analyzer | **In scope, scoped down** — flow/metadata level (protocol, IP, port, byte count), not full deep packet inspection of encrypted payloads |
| 4 | Connected Device Scanner | **In scope** — local subnet discovery via ARP/mDNS |
| 5 | Device Blocking | **In scope, partial** — local Windows Firewall rule creation for a given IP; true Layer-2 MAC blocking is router-dependent and out of MVP |
| 6 | Application Network Monitor | **Partial** — maps local process → destination IP/port using per-process socket ownership (available via OS APIs); does not identify remote device's internal app usage |
| 7 | File Monitoring | **In scope** — watch Downloads/Desktop/Startup for new executables/scripts |
| 8 | Registry Monitoring | **In scope** — watch Run/RunOnce/Services/Scheduled Tasks keys for persistence changes |
| 9 | USB Security | **In scope, basic** — detect new USB mass-storage device, scan new files against known-hash/heuristic checks |
| 10 | AI Threat Explanation | **In scope** — template-driven human-readable explanation generated from the classifier's feature attributions, not a general-purpose LLM claim of ground truth |
| 11 | Threat Intelligence | **In scope, basic** — local cache of public indicator feeds (e.g., abuse.ch, open phishing/malware-hash lists) checked against observed hashes/IPs/domains |
| 12 | Security Dashboard | **In scope** |
| 13 | Attack Timeline | **In scope** — chronological event view per host |
| 14 | Digital Forensics | **In scope, basic** — structured local log export (process tree, network history, registry deltas, alerts) for offline review, aligned with the incident-handling lifecycle in **NIST SP 800-61 Rev. 2** (Preparation → Detection & Analysis → Containment/Eradication/Recovery → Post-Incident Activity) |

## 6. Success Metrics (MVP)

Because this is a defensive security research tool and not a certified product, success is measured against **internal, disclosed test sets**, not marketing claims:

- Detection performance (precision/recall/F1) reported against a **named, public benchmark dataset** (e.g., EMBER, CICMalDroid, or a documented custom sample set), never an unqualified single "accuracy %" figure.
- False-positive rate on a benign-software baseline (e.g., a fixed list of common signed applications).
- Process-monitor CPU/RAM overhead on the host, target < 5% steady-state CPU.
- Mean time from malicious process start to alert shown in dashboard.

## 7. Assumptions and Constraints

- Runs with local administrator privileges (required for ETW kernel providers, Npcap, and firewall rule management).
- Windows 10/11 x64 target OS for MVP.
- Model training happens offline on labeled data; the shipped desktop app performs **inference only**.
- Any statistic quoted in demos or the UI (e.g., a confidence percentage) must be traceable to an actual evaluation run recorded in the project's model card, not an illustrative placeholder.

## 8. Out-of-Scope Risk Note

Several capabilities in the original concept (full API-call interception, kernel rootkit detection, cross-device app fingerprinting) require capabilities equivalent to commercial EDR kernel sensors. These are documented in the companion **Technical Requirements Document** and **Security Document** as Phase 2+ items requiring additional review (code signing, driver certification, legal review of network monitoring scope) before implementation.
