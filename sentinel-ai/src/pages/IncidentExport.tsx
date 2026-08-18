import { useState } from "react";
import { FileDown, Calendar, CheckCircle, AlertTriangle, Cpu, Network, Key, FileText } from "lucide-react";
import { exportIncidentBundleLive } from "../services/liveData";

export default function IncidentExport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exported, setExported] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const fromTs = dateFrom ? Math.floor(new Date(dateFrom).getTime() / 1000) : 0;
      const toTs = dateTo ? Math.floor(new Date(dateTo).getTime() / 1000) : Math.floor(Date.now() / 1000);

      const bundle = await exportIncidentBundleLive(fromTs, toTs);

      // Trigger browser download of the JSON bundle
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentinel-incident-bundle-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(true);
      setTimeout(() => setExported(false), 4000);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setExporting(false);
    }
  };

  const sections = [
    { icon: Cpu, label: "Process Tree", desc: "Active and historical process records from SQLite" },
    { icon: Network, label: "Network Flows", desc: "Flow metadata (protocol, IP, port, timestamps)" },
    { icon: Key, label: "Registry Events", desc: "Persistence-related key changes" },
    { icon: FileText, label: "File Events", desc: "Watched folder activity" },
    { icon: AlertTriangle, label: "Alerts & Responses", desc: "Detection engine outputs & containment actions" },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Incident Export</h2>
          <div className="page-header-sub">
            Export structured incident bundle per NIST SP 800-61 Rev. 2 lifecycle
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="card" style={{ maxWidth: 700 }}>
          <div className="card-header">
            <span className="card-title"><FileDown size={14} /> Export Configuration</span>
          </div>

          {/* Date range */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>From</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-tertiary)" }}>
                <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                <input
                  type="datetime-local"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ background: "none", border: "none", color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 13, outline: "none", flex: 1 }}
                />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>To</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-tertiary)" }}>
                <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                <input
                  type="datetime-local"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ background: "none", border: "none", color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 13, outline: "none", flex: 1 }}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Export Bundle Content
          </div>
          {sections.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--border-default)" }}>
              <div className="stat-icon cyan" style={{ width: 32, height: 32 }}>
                <s.icon size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.desc}</div>
              </div>
            </div>
          ))}

          {/* NIST lifecycle note */}
          <div style={{ marginTop: 20, background: "var(--accent-blue-dim)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: 12, color: "var(--accent-blue)" }}>
            Export is organized per NIST SP 800-61 Rev. 2: Detection & Analysis data first, then Containment/Response actions taken.
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 20, justifyContent: "center", padding: "12px" }}
            onClick={handleExport}
            disabled={exporting}
          >
            {exported ? (
              <><CheckCircle size={16} /> Incident Bundle Exported (JSON)!</>
            ) : (
              <><FileDown size={16} /> {exporting ? "Generating Bundle..." : "Export Incident Bundle (JSON)"}</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
