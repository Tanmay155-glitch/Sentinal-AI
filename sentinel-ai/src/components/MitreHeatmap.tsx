import { ShieldAlert } from "lucide-react";

interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  alertCount: number;
  riskScore: number;
}

const TECHNIQUES: MitreTechnique[] = [
  { id: "T1547", name: "Boot/Logon Autostart", tactic: "Persistence", alertCount: 4, riskScore: 75 },
  { id: "T1059", name: "Command & Scripting Interpreter", tactic: "Execution", alertCount: 8, riskScore: 85 },
  { id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact", alertCount: 2, riskScore: 95 },
  { id: "T1071", name: "Application Layer Protocol C2", tactic: "Command & Control", alertCount: 5, riskScore: 80 },
  { id: "T1055", name: "Process Injection", tactic: "Defense Evasion", alertCount: 3, riskScore: 90 },
  { id: "T1003", name: "OS Credential Dumping", tactic: "Credential Access", alertCount: 1, riskScore: 88 },
  { id: "T1082", name: "System Information Discovery", tactic: "Discovery", alertCount: 12, riskScore: 35 },
  { id: "T1021", name: "Remote Services / Lateral", tactic: "Lateral Movement", alertCount: 2, riskScore: 65 },
];

export default function MitreHeatmap() {
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <span className="card-title">
          <ShieldAlert size={14} /> MITRE ATT&CK® Threat Matrix Heatmap
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 10 }}>
        {TECHNIQUES.map((tech) => {
          const isHigh = tech.riskScore >= 80;
          const isMed = tech.riskScore >= 50;
          const bg = isHigh
            ? "rgba(239, 68, 68, 0.15)"
            : isMed
            ? "rgba(245, 158, 11, 0.15)"
            : "rgba(16, 185, 129, 0.15)";
          const border = isHigh
            ? "1px solid rgba(239, 68, 68, 0.3)"
            : isMed
            ? "1px solid rgba(245, 158, 11, 0.3)"
            : "1px solid rgba(16, 185, 129, 0.3)";
          const badgeColor = isHigh ? "red" : isMed ? "yellow" : "green";

          return (
            <div
              key={tech.id}
              style={{
                background: bg,
                border,
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", marginBottom: 4 }}>
                  {tech.tactic}
                </div>
                <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)", marginBottom: 4 }}>
                  {tech.id}: {tech.name}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span className={`badge ${badgeColor}`} style={{ fontSize: 10 }}>
                  Risk {tech.riskScore}
                </span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                  {tech.alertCount} alert{tech.alertCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
