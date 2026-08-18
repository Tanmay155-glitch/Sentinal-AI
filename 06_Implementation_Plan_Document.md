# Implementation Plan Document
## Sentinel AI — MVP

**Version:** 1.0

---

## 1. Phased Delivery Approach

Given the honest difficulty assessment of the original concept (kernel-level telemetry, AI modeling, network programming, and UX all in one project), the plan below sequences work so that each phase produces something demoable and testable, rather than attempting all 14 modules simultaneously.

### Phase 0 — Foundations (Weeks 1–2)
- Set up repo structure, CI, coding standards.
- Stand up Tauri + React shell with a static mock Dashboard.
- Define SQLite schema (per Database Schema Document) and wire up the data layer.
- Establish the ONNX Runtime inference harness with a placeholder model, so the pipeline exists before the real model is trained.

**Exit criteria:** App launches, shows an empty dashboard, and writes/reads a test record to SQLite.

### Phase 1 — Process Monitoring (Weeks 3–5)
- Implement ETW consumer for `Microsoft-Windows-Kernel-Process` (start/stop/image-load).
- Populate `processes` / `process_events` tables.
- Build Process Monitor UI screen against live data.
- Implement signature verification and path-reputation heuristics (rule-based, pre-ML).

**Exit criteria:** Live process list in UI matches Task Manager's process count within a small tolerance; unsigned/user-path executables are flagged by a rule, not yet by ML.

### Phase 2 — Detection Engine v1 (Weeks 6–8)
- Curate/label a feature dataset (public malware/benign dataset — must be named and cited in the model card, e.g., a documented open dataset the team selects).
- Train baseline models (Random Forest / XGBoost) offline in Python; evaluate precision/recall/F1 on a held-out split.
- Export best model to ONNX; wire into the Rust inference harness from Phase 0.
- Implement the `alerts` pipeline and Alert Detail UI with real explanations (feature attributions, e.g., via SHAP or model feature importances — not invented text).

**Exit criteria:** Model card published with dataset name, split methodology, and measured metrics; live alerts appear in UI backed by real inference, not mocked scores.

### Phase 3 — Network & Device Modules (Weeks 9–12)
- Integrate Npcap for flow capture; implement flow parsing and process-to-socket correlation.
- Build Network Monitor UI.
- Implement ARP/mDNS device discovery and the `devices`/`device_sightings` tables.
- Build Devices UI including the MAC-randomization heuristic.
- Implement local firewall-rule creation for the Block action.

**Exit criteria:** Network flows and local devices visible and updating live; a manual test (e.g., connecting a second test device or generating known-bad traffic in a lab VM) produces a correct flag.

### Phase 4 — Registry, File, USB Monitoring (Weeks 13–14)
- Registry watcher for Run/RunOnce/Services/Scheduled Tasks.
- Folder watcher for Downloads/Desktop/Startup.
- USB insertion handling and file-scan-on-insert.

**Exit criteria:** A test persistence technique (e.g., adding a benign test entry to a Run key in a lab VM) is detected and logged with correct ATT&CK tagging.

### Phase 5 — Threat Intelligence, Timeline, Export (Weeks 15–16)
- Integrate named public IOC feed(s); implement local cache and matching.
- Build Timeline UI from `timeline_events`.
- Build Incident Export wizard producing the structured bundle described in the App Flow Document.

**Exit criteria:** A known-bad test hash/IP from the chosen feed is correctly matched and surfaced; export produces a complete, openable bundle.

### Phase 6 — Hardening, Testing, Documentation (Weeks 17–18)
- Overhead/performance testing against NFR-1 (< 5% steady-state CPU).
- False-positive testing against a fixed benign-software baseline list.
- Security review pass (see Security Document) — privilege boundaries, input validation on firewall rule creation, safe handling of the elevated process.
- Finalize README, model card, and user-facing "what this does / doesn't do" disclosure (mirrors PRD non-goals).

**Exit criteria:** All NFRs from the TRD verified with recorded measurements; security review checklist signed off.

## 2. Team Roles (suggested, adaptable to team size)

| Role | Responsibility |
|---|---|
| Systems/Rust engineer | ETW consumer, Npcap integration, firewall/process control, SQLite layer |
| ML engineer | Dataset curation, model training/evaluation, ONNX export, model card |
| Frontend engineer | Tauri+React UI screens per UI/UX doc |
| QA / Security reviewer | Test plan execution, security review checklist, false-positive baseline testing |

*(A solo student can run these sequentially; a small team can parallelize Phases 1–4 by module.)*

## 3. Test Strategy Summary

- **Unit tests:** per-module logic (feature extraction, ARP parsing, rule evaluation).
- **Integration tests:** end-to-end event flow from ETW/Npcap capture through to alert creation, run in a disposable lab VM (never on a production machine, given the elevated privileges and firewall changes involved).
- **Model evaluation:** held-out test set metrics recorded per TRD FR-2.2, re-run on every model version change.
- **Manual red-team-style validation:** in an isolated VM/lab network only, using known benign test artifacts (e.g., EICAR test file for AV pipeline validation — a standard, industry-recognized non-malicious test string, not real malware) to confirm the pipeline reacts as expected without needing live malware samples.

## 4. Dependencies and Risks

| Risk | Mitigation |
|---|---|
| ETW kernel provider access requires admin/PPL nuances | Validate early in Phase 1 spike before committing later phases to this architecture |
| Public malware datasets may be imbalanced or outdated | Document dataset limitations explicitly in the model card; avoid overstating generalization |
| Npcap licensing for any commercial redistribution | Review the Npcap license terms (free for personal/eval and limited commercial use per npcap.com) before any go-to-market use beyond academic/portfolio purposes |
| False positives disrupting legitimate software | Auto-response off by default (TRD NFR-3); benign-baseline regression testing each release |
| Scope creep back toward the full 14-module vision | PRD explicitly gates Future Features behind a separate phase-2 proposal requiring its own review |
