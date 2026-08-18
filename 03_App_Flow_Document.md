# Application Flow Document
## Sentinel AI — MVP

**Version:** 1.0

---

## 1. Purpose
Describes user-facing and system-internal flows: onboarding, steady-state monitoring, alert handling, and response actions.

## 2. First-Run / Onboarding Flow

1. **Install & Elevate** — Installer requests administrator rights (required for ETW subscription, Npcap driver, and firewall APIs; see TRD §6).
2. **Consent & Scope Screen** — App discloses in plain language what it monitors (processes, local network metadata, local devices) and explicitly states it does **not** decrypt user traffic or inspect other devices' applications (ties to PRD §3.2 non-goals). User must accept before monitoring starts.
3. **Baseline Scan** — On first launch, app enumerates current processes, startup items, and local network devices to build an initial baseline (reduces false "new item" alerts later).
4. **Model/Feed Initialization** — App loads the bundled ONNX detection model and attempts to refresh the threat-intel cache from the configured feed(s); if offline, proceeds with the last cached copy and shows a "feed stale" indicator.
5. **Dashboard Landing** — User lands on the main Security Dashboard (see UI/UX doc).

## 3. Steady-State Monitoring Flow (System-Internal)

```
[ETW Provider] --process/image events--> [Process Monitor Service]
[Npcap capture] --packet/flow data----> [Network Capture Service]
[ARP/mDNS]      --device sightings----> [Device Discovery Service]
[Registry hooks] --key change events--> [Registry Monitor]
[FS watcher]     --new file events----> [File Monitor]
        |               |                 |             |
        +-------+-------+--------+--------+-------------+
                |
        [Detection Engine: rules + ONNX model inference]
                |
        risk score + category + ATT&CK tag
                |
        +-------+--------+
        |                |
  score < threshold   score >= threshold
        |                |
   [Log only]       [Create Alert record] --> [Dashboard badge + notification]
```

## 4. Alert Triage Flow (User-Facing)

1. User sees a new alert badge on the Dashboard or a system notification.
2. User opens **Alert Detail** view showing:
   - What triggered it (process / network flow / device / registry / USB)
   - AI Threat Explanation panel: category, contributing factors (e.g., "unsigned binary," "rapid file-write rate," "matched threat-intel hash"), and the model's risk score
   - Suggested action(s), e.g., "Terminate process," "Block IP," "Ignore/allowlist"
3. User selects an action:
   - **Terminate Process** → confirmation dialog → `TerminateProcess` call → outcome logged → timeline updated
   - **Block IP/Device** → confirmation dialog → Windows Firewall rule created → outcome logged
   - **Allowlist** → item added to local allowlist table → future identical signals suppressed at Detection Engine stage (not silently deleted from history)
   - **Dismiss/Snooze** → alert marked reviewed, remains in log for forensics export
4. Every action writes an entry to the Attack Timeline with actor = user, timestamp, and prior alert reference.

## 5. Connected Device Flow

1. Device Discovery Service periodically (e.g., every 60s) refreshes the ARP table and passive mDNS listener results.
2. New device detected → OUI vendor lookup → entry added to Device list with status "Unclassified."
3. Heuristics (MAC randomization pattern, port-scan-like behavior, absence from baseline) run against the entry.
4. If heuristic thresholds trip → device flagged "Review Recommended" → appears in Alerts.
5. User can mark a device "Trusted" (added to baseline) or take a Block action (creates a firewall rule scoped to that device's current IP, with a note that MAC-level blocking depends on router capability and is out of MVP scope per PRD).

## 6. USB Insertion Flow

1. OS raises device-arrival event for a new mass-storage device.
2. App scans newly-written files against: (a) local hash blocklist from the threat-intel cache, (b) same static/behavioral feature classifier used for processes, (c) autorun-file heuristic (presence of `autorun.inf` referencing an executable).
3. Result surfaced as a toast + entry in Timeline: "Clean," "Suspicious — quarantined pending review," or "Blocked."

## 7. Incident Export (Digital Forensics) Flow

1. User selects a time range or a specific alert on the Timeline and clicks "Export Incident Bundle."
2. App assembles: process tree at time of incident, related network flows, registry deltas, file events, and all alert/response records into a structured local export (e.g., JSON + CSV bundle).
3. Export is organized to mirror the NIST SP 800-61 Rev. 2 incident-handling phases (Detection & Analysis data first, then Containment/Response actions taken) so it can drop into an existing incident-response workflow rather than inventing a new report format.

## 8. Settings & Feed Management Flow

1. User can view/edit: monitoring sensitivity (detection threshold), auto-response toggle (off by default per TRD NFR-3-adjacent control), retention window, and the list of active threat-intel feeds (each shown with source name/URL for transparency).
2. Any feed added must be a URL the user explicitly enters or a source selected from a small, pre-vetted, named list shipped with the app — the app must not silently add undisclosed data sources.

## 9. Error / Degraded-Mode Flows

| Condition | Behavior |
|---|---|
| Npcap driver not installed | Network module shows "Inactive — install Npcap" with a guided link; process/registry/file monitoring continue unaffected |
| App not running elevated | Blocking banner explaining ETW/firewall features require admin rights; read-only dashboard still available where possible |
| Threat-intel feed unreachable | Dashboard shows "Feed last updated: [date]" instead of failing silently |
| ONNX model fails to load | Falls back to rule-based heuristics only, with a visible "AI detection offline" indicator — never silently disables detection without telling the user |
