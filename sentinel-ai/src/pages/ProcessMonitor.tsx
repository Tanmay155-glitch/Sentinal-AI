import { useState, useEffect } from "react";
import { Search, Cpu, ShieldAlert, ShieldCheck, XCircle, Radio } from "lucide-react";
import { getProcessesLive, isLiveMode } from "../services/liveData";
import type { ProcessInfo } from "../services/liveData";

export default function ProcessMonitor() {
  const [procs, setProcs] = useState<ProcessInfo[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<ProcessInfo | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const p = await getProcessesLive();
      setProcs(p);
      setLive(isLiveMode());
    };
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, []);

  const filtered = procs.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "suspicious" && p.risk_score < 40) return false;
    if (filter === "unsigned" && p.is_signed) return false;
    return true;
  });

  const riskColor = (r: number) =>
    r >= 70 ? "critical" : r >= 40 ? "high" : r >= 20 ? "medium" : "low";

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Process Monitor</h2>
          <div className="page-header-sub">
            {live ? "Live system process enumeration with risk assessment" : "Simulated process data — launch via Tauri for live"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`badge-pill ${live ? "badge-low" : "badge-medium"}`} style={{ fontSize: 10 }}>
            <Radio size={10} /> {live ? "LIVE" : "MOCK"}
          </span>
          <div className="search-box">
            <Search size={14} />
            <input placeholder="Search processes..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="filter-bar">
          {[
            { id: "all", label: "All Processes" },
            { id: "suspicious", label: "Suspicious Only" },
            { id: "unsigned", label: "Unsigned Only" },
          ].map(f => (
            <button key={f.id} className={`filter-chip ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {filtered.length} processes
          </span>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <div className="card" style={{ flex: 1, overflow: "auto", maxHeight: "calc(100vh - 220px)" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Process</th>
                  <th>PID</th>
                  <th>CPU%</th>
                  <th>RAM (MB)</th>
                  <th>Signed</th>
                  <th>Risk</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.pid} onClick={() => setSelected(p)} style={{ background: selected?.pid === p.pid ? "var(--bg-card-hover)" : undefined }}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                      <Cpu size={14} style={{ color: "var(--text-muted)" }} /> {p.name}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{p.pid}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{p.cpu_usage.toFixed(1)}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{p.memory_mb.toFixed(0)}</td>
                    <td>
                      {p.is_signed
                        ? <ShieldCheck size={16} style={{ color: "var(--severity-low)" }} />
                        : <ShieldAlert size={16} style={{ color: "var(--severity-medium)" }} />}
                    </td>
                    <td>
                      <div className="risk-meter" style={{ minWidth: 100 }}>
                        <div className="risk-bar">
                          <div className={`risk-bar-fill ${riskColor(p.risk_score)}`} style={{ width: `${p.risk_score}%` }} />
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 28 }}>{p.risk_score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td><span className={`badge-pill badge-${riskColor(p.risk_score)}`}>{p.category}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="card animate-in" style={{ width: 340, flexShrink: 0 }}>
              <div className="card-header">
                <span className="card-title">Process Detail</span>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                  <XCircle size={16} />
                </button>
              </div>
              <div style={{ fontSize: 13 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{selected.exe_path}</div>
                </div>
                {[
                  ["PID", selected.pid],
                  ["Parent PID", selected.parent_pid ?? "N/A"],
                  ["CPU Usage", `${selected.cpu_usage.toFixed(1)}%`],
                  ["Memory", `${selected.memory_mb.toFixed(1)} MB`],
                  ["Signed", selected.is_signed ? "Yes ✓" : "No ✗"],
                  ["Category", selected.category],
                  ["Risk Score", selected.risk_score.toFixed(1)],
                ].map(([label, val]) => (
                  <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
                    <span style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{String(val)}</span>
                  </div>
                ))}
                {selected.risk_score >= 40 && (
                  <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                    <button className="btn btn-danger" style={{ flex: 1 }}>
                      <XCircle size={14} /> Terminate
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1 }}>Allowlist</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
