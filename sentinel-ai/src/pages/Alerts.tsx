import { useState, useEffect } from "react";
import { AlertTriangle, XCircle, ShieldCheck, ExternalLink, ChevronRight } from "lucide-react";
import { getAlertsLive } from "../services/liveData";
import type { AlertInfo } from "../services/liveData";

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertInfo[]>([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<AlertInfo | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadAlerts = async () => {
    setAlerts(await getAlertsLive());
  };

  useEffect(() => {
    loadAlerts();
    const iv = setInterval(loadAlerts, 5000);
    return () => clearInterval(iv);
  }, []);

  const handleTerminateProcess = async () => {
    if (!selected) return;
    try {
      if ((window as any).__TAURI__) {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<string>("terminate_process", { pid: 0, alertId: selected.alert_id });
        setActionMessage(res);
      } else {
        setActionMessage(`[Simulated] Terminated process ${selected.source_name}`);
      }
      loadAlerts();
    } catch (e: any) {
      setActionMessage(`Error terminating process: ${e?.toString() || e}`);
    }
  };

  const handleAllowlist = async () => {
    if (!selected) return;
    try {
      if ((window as any).__TAURI__) {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<string>("add_allowlist_entry", {
          entityType: selected.source_type,
          entityValue: selected.source_name,
          reason: "User manual allowlist from Alerts triage",
        });
        setActionMessage(res);
      } else {
        setActionMessage(`[Simulated] Added ${selected.source_name} to Allowlist`);
      }
      loadAlerts();
    } catch (e: any) {
      setActionMessage(`Error adding to allowlist: ${e?.toString() || e}`);
    }
  };

  const counts = {
    all: alerts.length,
    open: alerts.filter(a => a.status === "open").length,
    reviewed: alerts.filter(a => a.status === "reviewed").length,
    actioned: alerts.filter(a => a.status === "actioned").length,
    dismissed: alerts.filter(a => a.status === "dismissed").length,
  };

  const filtered = alerts.filter(a => filter === "all" || a.status === filter);
  const sev = (r: number) => r >= 80 ? "critical" : r >= 60 ? "high" : r >= 40 ? "medium" : "low";

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Alerts & Triage</h2>
          <div className="page-header-sub">Detection engine outputs with MITRE ATT&CK tagging</div>
        </div>
      </div>
      <div className="page-body">
        {actionMessage && (
          <div style={{ background: "var(--accent-blue-dim)", border: "1px solid rgba(59,130,246,0.2)", padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--accent-blue)", marginBottom: 14 }}>
            {actionMessage}
          </div>
        )}

        <div className="filter-bar">
          {(["all","open","reviewed","actioned","dismissed"] as const).map(f => (
            <button key={f} className={`filter-chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <div className="card" style={{ flex: 1, overflow: "auto", maxHeight: "calc(100vh - 230px)" }}>
            {filtered.map(a => (
              <div
                key={a.alert_id}
                onClick={() => { setSelected(a); setActionMessage(null); }}
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border-default)",
                  cursor: "pointer",
                  background: selected?.alert_id === a.alert_id ? "var(--bg-card-hover)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "background 0.15s",
                }}
              >
                <div className={`stat-icon ${sev(a.risk_score) === "critical" || sev(a.risk_score) === "high" ? "red" : "amber"}`} style={{ width: 36, height: 36, flexShrink: 0 }}>
                  <AlertTriangle size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{a.source_name}</span>
                    <span className={`badge-pill badge-${sev(a.risk_score)}`} style={{ fontSize: 10 }}>{a.risk_score.toFixed(0)}</span>
                    {a.attck_technique && <span className="badge-pill badge-purple" style={{ fontSize: 10 }}>{a.attck_technique}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    {a.category_label} · {a.source_type} · {new Date(a.created_ts * 1000).toLocaleString()}
                  </div>
                </div>
                <span className={`badge-pill badge-${a.status === "open" ? "high" : "info"}`} style={{ fontSize: 10 }}>{a.status}</span>
                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
              </div>
            ))}
          </div>

          {/* Alert Detail Panel */}
          {selected && (
            <div className="card animate-in" style={{ width: 380, flexShrink: 0, overflow: "auto", maxHeight: "calc(100vh - 230px)" }}>
              <div className="card-header">
                <span className="card-title">Alert Detail</span>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                  <XCircle size={16} />
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{selected.source_name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{selected.category_label} · {selected.source_type}</div>
              </div>

              {/* Risk Score Meter */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Risk Score</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, height: 8, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${selected.risk_score}%`, height: "100%", borderRadius: 4, background: `var(--severity-${sev(selected.risk_score)})`, transition: "width 0.5s" }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: `var(--severity-${sev(selected.risk_score)})` }}>
                    {selected.risk_score.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* MITRE ATT&CK */}
              {selected.attck_technique && (
                <div style={{ background: "var(--accent-purple-dim)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>MITRE ATT&CK</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent-purple)" }}>{selected.attck_technique}</span>
                    <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{selected.attck_name}</span>
                    <ExternalLink size={12} style={{ color: "var(--accent-purple)", cursor: "pointer" }} />
                  </div>
                </div>
              )}

              {/* Why Flagged */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Why Flagged (Explainable AI)</div>
                {selected.explanation.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: 12, color: "var(--text-secondary)", alignItems: "start" }}>
                    <AlertTriangle size={12} style={{ color: "var(--severity-medium)", flexShrink: 0, marginTop: 2 }} />
                    {e}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Response Automation</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="btn btn-danger" style={{ justifyContent: "center" }} onClick={handleTerminateProcess}>
                    <XCircle size={14} /> Terminate Process (taskkill)
                  </button>
                  <button className="btn btn-secondary" style={{ justifyContent: "center" }} onClick={handleAllowlist}>
                    <ShieldCheck size={14} /> Add to Allowlist
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
