# UI/UX Design Document
## Sentinel AI — MVP

**Version:** 1.0

---

## 1. Design Principles
1. **Clarity over drama.** Security tools are used under stress; avoid alarming color/animation for low-severity items. Reserve red/critical styling for genuinely high-confidence, high-impact alerts.
2. **Explainability first.** Every AI verdict must be paired with the "why" (contributing factors), never a bare score.
3. **Reversible by default.** Destructive actions (terminate, block) always require a confirmation step and are logged/undoable where technically possible (e.g., firewall rule removal).
4. **Honesty about limits.** The UI should never imply capabilities the system doesn't have (e.g., must not claim visibility into another device's running apps — see PRD non-goals).

## 2. Information Architecture

```
Dashboard (Home)
 ├─ Process Monitor
 │   └─ Process Detail (drill-down)
 ├─ Network Monitor
 │   └─ Flow Detail
 ├─ Devices
 │   └─ Device Detail
 ├─ Alerts
 │   └─ Alert Detail / Triage
 ├─ Timeline
 ├─ Incident Export
 └─ Settings
     ├─ Sensitivity / Auto-response
     ├─ Threat-Intel Feeds
     └─ Retention
```

## 3. Screen Specifications

### 3.1 Security Dashboard (Home)
**Purpose:** At-a-glance system state.
**Key elements:**
- Top status strip: CPU %, RAM %, open Alerts count, Devices count, Active Connections count, Blocked count (mirrors the source concept's dashboard module).
- Overall Risk indicator (Low/Medium/High/Critical) computed as a rollup of open alert severities — not a separate opaque score.
- "Recent Alerts" list (last 5), each row: severity icon, short description, timestamp, one-click "View."
- "Feed status" chip showing threat-intel last-updated time (ties to App Flow §9 degraded-mode handling).

### 3.2 Process Monitor
- Sortable/filterable table: Process Name, PID, CPU%, RAM, Signature status icon, Risk badge.
- Row click → **Process Detail** drawer: full path, parent chain (mini tree view), hash, network connections owned by this process, registry writes attributed to it, and the AI explanation panel if it has ever been scored.
- Inline action buttons on high-risk rows: "Terminate," "Investigate," "Allowlist."

### 3.3 Network Monitor
- Live flow table: Source, Destination, Protocol, Port, Data volume, Duration, Owning process (if known).
- Visual sparkline of total throughput over the last N minutes.
- Filter chips: "Unknown destinations only," "Threat-intel matches only."
- Explicit UI label clarifying that only metadata (not decrypted content) is shown, to set correct user expectations per Security Document.

### 3.4 Devices
- Card/list view per device: name (if resolvable), vendor (from OUI), IP, MAC, trust status badge, first/last seen.
- "Review Recommended" devices surfaced at top with the specific heuristic reason shown (e.g., "MAC address changed 4 times in 10 minutes").
- Device Detail drawer: sighting history graph, action buttons ("Mark Trusted," "Block").
- A permanent info tooltip on this screen states plainly: "Sentinel AI shows device identity and connection metadata on your network. It cannot see which apps are running on other devices." This directly reflects the documented technical constraint.

### 3.5 Alerts / Triage
- Kanban-style or list view: Open / Reviewed / Actioned / Dismissed.
- Alert Detail: mirrors the "AI Threat Explanation" concept from the source material — Category, Risk score with a visual meter (not just a raw number), "Why flagged" bullet list generated from actual model feature attributions, MITRE ATT&CK technique chip (e.g., "T1547 – Boot or Logon Autostart Execution") linking out to the public ATT&CK reference for that technique, Recommended Action buttons.

### 3.6 Timeline
- Vertical chronological feed (matches the "Attack Timeline" concept), filterable by category (process/network/registry/device/usb/alert/response), each entry expandable to full detail, consistent with the underlying `timeline_events` table.

### 3.7 Incident Export
- Simple wizard: pick a time range or a specific alert → preview of what will be included (counts per category) → Export button → file saved locally, with a confirmation showing the file path.

### 3.8 Settings
- Sensitivity slider mapped to the underlying alert-score threshold (documented in tooltip, not a vague "1-10" scale with no meaning).
- Auto-response toggle, off by default, with a warning explaining the risk of automated termination/blocking causing disruption to legitimate software (per TRD NFR-3).
- Threat-intel feed list, each row showing source name + URL + last refresh, add/remove controls.
- Retention window control.

## 4. Visual/Interaction Guidelines
- Use a restrained palette: neutral base (dark or light theme), with severity color-coding reserved (green=normal/low, amber=medium, red=high/critical) — avoid using red for routine informational events, to prevent alert fatigue.
- Numeric confidence values always shown with their basis on hover/tooltip (e.g., "87% — based on: unsigned binary, high file-write rate, matched 1 threat-intel indicator").
- No dark-pattern styling on destructive actions (e.g., "Block" should not be visually de-emphasized to trick users into clicking it accidentally, nor over-emphasized to encourage rash blocking).
- Accessibility: maintain WCAG-AA contrast ratios for status colors; do not rely on color alone to convey severity (pair with icon/text label).

## 5. Empty/Onboarding States
- First-run Dashboard before baseline completes: show a progress indicator ("Building baseline… analyzing 142 processes") rather than an empty/broken-looking screen.
- Zero-alert state: reassuring but not falsely absolute copy, e.g., "No alerts detected in the current session," not "Your system is 100% safe."
