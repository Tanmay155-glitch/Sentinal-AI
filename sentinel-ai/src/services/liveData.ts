/**
 * Live Data Service for Sentinel AI
 * 
 * When running inside Tauri (desktop app): calls real Rust backend commands
 * for live system stats, process enumeration, network scanning, and SQLite event persistence.
 * 
 * When running in browser dev mode (npm run dev): falls back to mock data.
 */

// Re-export types from mockData so pages don't need to change their type imports
export type { ProcessInfo, SystemStats, NetworkFlow, AlertInfo, TimelineEvent } from "./mockData";
import type { ProcessInfo, SystemStats, NetworkFlow, AlertInfo, TimelineEvent } from "./mockData";
import * as mock from "./mockData";

// ────────────────────────────────────────────
// Tauri detection & invocation helpers
// ────────────────────────────────────────────
function isTauri(): boolean {
  return !!(window as any).__TAURI__;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ────────────────────────────────────────────
// CPU history ring buffer (kept in-memory)
// ────────────────────────────────────────────
let _cpuHistory: number[] = [];
const CPU_HISTORY_SIZE = 60;

function pushCpuSample(cpu: number) {
  _cpuHistory.push(cpu);
  if (_cpuHistory.length > CPU_HISTORY_SIZE) _cpuHistory.shift();
}

// ────────────────────────────────────────────
// Live network connection tracking via netstat
// ────────────────────────────────────────────
interface LiveNetFlow {
  protocol: string;
  src_ip: string;
  src_port: number;
  dst_ip: string;
  dst_port: number;
  state: string;
  process_name: string | null;
  pid: number;
}

async function getLiveNetConnections(): Promise<LiveNetFlow[]> {
  if (!isTauri()) return [];
  try {
    return await tauriInvoke<LiveNetFlow[]>("get_live_connections");
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────
// PUBLIC API — System Stats (LIVE)
// ────────────────────────────────────────────
export async function getSystemStatsLive(): Promise<SystemStats> {
  if (isTauri()) {
    try {
      const stats = await tauriInvoke<SystemStats>("get_system_stats");
      pushCpuSample(stats.cpu_usage);
      return stats;
    } catch (e) {
      console.warn("Tauri get_system_stats failed, using mock:", e);
    }
  }
  const stats = mock.getSystemStats();
  pushCpuSample(stats.cpu_usage);
  return stats;
}

export function getCpuHistoryLive(): number[] {
  if (_cpuHistory.length < 2) {
    _cpuHistory = mock.getCpuHistory();
  }
  return [..._cpuHistory];
}

// ────────────────────────────────────────────
// PUBLIC API — Processes (LIVE)
// ────────────────────────────────────────────
export async function getProcessesLive(): Promise<ProcessInfo[]> {
  if (isTauri()) {
    try {
      return await tauriInvoke<ProcessInfo[]>("get_processes");
    } catch (e) {
      console.warn("Tauri get_processes failed, using mock:", e);
    }
  }
  return mock.getProcesses();
}

// ────────────────────────────────────────────
// PUBLIC API — Network Flows (LIVE)
// ────────────────────────────────────────────
let _liveFlowCache: NetworkFlow[] | null = null;
let _liveFlowCacheTs = 0;

export async function getNetworkFlowsLive(): Promise<NetworkFlow[]> {
  if (isTauri()) {
    const now = Date.now();
    if (!_liveFlowCache || now - _liveFlowCacheTs > 3000) {
      try {
        const raw = await getLiveNetConnections();
        if (raw.length > 0) {
          const nowSec = Math.floor(now / 1000);
          _liveFlowCache = raw.map((f, i) => ({
            flow_id: i + 1,
            src_ip: f.src_ip,
            dst_ip: f.dst_ip,
            src_port: f.src_port,
            dst_port: f.dst_port,
            protocol: f.protocol,
            sni_hostname: null,
            bytes_sent: 0,
            bytes_received: 0,
            process_name: f.process_name,
            started_ts: nowSec,
            threat_intel_match: false,
          }));
          _liveFlowCacheTs = now;
          return _liveFlowCache;
        }
      } catch (e) {
        console.warn("Live network flow fetch failed:", e);
      }
    }
    if (_liveFlowCache) return _liveFlowCache;
  }
  return mock.getNetworkFlows();
}

// ────────────────────────────────────────────
// PUBLIC API — Alerts (Queries SQLite Database)
// ────────────────────────────────────────────
export async function getAlertsLive(): Promise<AlertInfo[]> {
  if (isTauri()) {
    try {
      interface StoredAlert {
        alert_id: number;
        source_type: string;
        source_ref_id: number;
        source_name: string;
        risk_score: number;
        category_label: string;
        attck_technique: string | null;
        explanation: string[];
        status: "open" | "reviewed" | "dismissed" | "actioned";
        created_ts: number;
      }
      const raw = await tauriInvoke<StoredAlert[]>("get_alert_history");
      if (raw && raw.length > 0) {
        return raw.map(a => ({
          alert_id: a.alert_id,
          source_type: a.source_type,
          source_name: a.source_name,
          risk_score: a.risk_score,
          category_label: a.category_label,
          attck_technique: a.attck_technique || "T1082",
          attck_name: a.attck_technique || "System Information Discovery",
          explanation: a.explanation,
          status: a.status,
          created_ts: a.created_ts,
        }));
      }
    } catch (e) {
      console.warn("Tauri get_alert_history failed, falling back to process scanning:", e);
    }
  }
  return mock.getAlerts();
}

// ────────────────────────────────────────────
// PUBLIC API — Timeline (Queries SQLite Database)
// ────────────────────────────────────────────
export async function getTimelineLive(): Promise<TimelineEvent[]> {
  if (isTauri()) {
    try {
      interface StoredTimelineEvent {
        timeline_id: number;
        event_ts: number;
        event_category: string;
        summary_text: string;
        related_alert_id: number | null;
      }
      const raw = await tauriInvoke<StoredTimelineEvent[]>("get_timeline_history");
      if (raw && raw.length > 0) {
        return raw.map(e => ({
          timeline_id: e.timeline_id,
          event_ts: e.event_ts,
          event_category: e.event_category as any,
          summary_text: e.summary_text,
          related_alert_id: e.related_alert_id,
        }));
      }
    } catch (e) {
      console.warn("Tauri get_timeline_history failed:", e);
    }
  }
  return mock.getTimeline();
}

// ────────────────────────────────────────────
// PUBLIC API — Settings & Incident Export
// ────────────────────────────────────────────
export async function getSettingLive(key: string): Promise<string> {
  if (isTauri()) {
    return tauriInvoke<string>("get_setting", { key });
  }
  return "default";
}

export async function updateSettingLive(key: string, value: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("update_setting", { key, value });
  }
}

export async function exportIncidentBundleLive(fromTs: number, toTs: number): Promise<any> {
  if (isTauri()) {
    return tauriInvoke("export_incident_bundle", { fromTs, toTs });
  }
  return {
    export_timestamp: Math.floor(Date.now() / 1000),
    date_from: new Date(fromTs * 1000).toISOString(),
    date_to: new Date(toTs * 1000).toISOString(),
    schema_version: "1.0.0",
    nist_framework: "NIST SP 800-61 Rev. 2",
    summary: { process_count: 5, flow_count: 12, alert_count: 2, timeline_count: 15 },
    processes: [],
    network_flows: [],
    alerts: [],
    timeline_events: [],
  };
}

export function isLiveMode(): boolean {
  return isTauri();
}
