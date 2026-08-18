import { Brain, BarChart3, CheckCircle, Target, Sparkles, Layers } from "lucide-react";

export default function ModelInfo() {
  const modelMetrics = {
    model_type: "Random Forest Classifier",
    training_samples: 4000,
    test_samples: 1000,
    overall_accuracy: "87.0%",
    weighted_f1: "0.8536",
    classes: ["Normal", "PUA", "Ransomware-like", "Trojan", "Unknown-suspicious"],
  };

  const featureImportances = [
    { name: "cpu_usage", importance: 0.2029, desc: "Process CPU consumption level" },
    { name: "entropy", importance: 0.1912, desc: "Shannon entropy of binary executable" },
    { name: "path_reputation", importance: 0.1615, desc: "Directory trust level (System32 vs Temp)" },
    { name: "file_writes_sec", importance: 0.1317, desc: "File modification frequency" },
    { name: "registry_writes_sec", importance: 0.1228, desc: "Registry key modification rate" },
    { name: "memory_mb", importance: 0.0602, desc: "RAM usage in Megabytes" },
    { name: "has_autorun", importance: 0.0485, desc: "Startup registry run key persistence" },
    { name: "outbound_conn_sec", importance: 0.0460, desc: "Network outbound connections rate" },
    { name: "threat_intel_match", importance: 0.0233, desc: "IOC hash match against threat-intel feeds" },
    { name: "is_signed", importance: 0.0120, desc: "Authenticode digital signature verification" },
  ];

  // Confusion matrix counts from ml/train_model.py
  const confusionMatrix = [
    { class: "Normal", normal: 600, pua: 0, ransomware: 0, trojan: 0, unknown: 0 },
    { class: "PUA", normal: 0, pua: 104, ransomware: 2, trojan: 7, unknown: 8 },
    { class: "Ransomware-like", normal: 0, pua: 10, ransomware: 59, trojan: 7, unknown: 0 },
    { class: "Trojan", normal: 0, pua: 13, ransomware: 3, trojan: 107, unknown: 1 },
    { class: "Unknown-suspicious", normal: 0, pua: 67, ransomware: 1, trojan: 8, unknown: 3 },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>ML Engine & Model Card</h2>
          <div className="page-header-sub">
            ONNX Random Forest Classifier evaluation metrics, feature importances, and confusion matrix
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Row */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Model Architecture</span>
              <div className="stat-icon cyan"><Brain size={16} /></div>
            </div>
            <div className="kpi-value" style={{ fontSize: 18 }}>{modelMetrics.model_type}</div>
            <div className="kpi-sub">ONNX Runtime v2.0</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Test Accuracy</span>
              <div className="stat-icon green"><CheckCircle size={16} /></div>
            </div>
            <div className="kpi-value">{modelMetrics.overall_accuracy}</div>
            <div className="kpi-sub">Weighted F1: {modelMetrics.weighted_f1}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Dataset Split</span>
              <div className="stat-icon blue"><Layers size={16} /></div>
            </div>
            <div className="kpi-value">{modelMetrics.training_samples} / {modelMetrics.test_samples}</div>
            <div className="kpi-sub">Train / Test Samples</div>
          </div>
        </div>

        {/* Feature Importance & Confusion Matrix Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
          {/* Feature Importances */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><BarChart3 size={14} /> Feature Importances</span>
            </div>
            {featureImportances.map((f, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{f.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                    {(f.importance * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--bg-tertiary)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${f.importance * 400}%`,
                      background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))",
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Confusion Matrix */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Target size={14} /> Confusion Matrix (Test Set)</span>
            </div>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Actual \ Pred</th>
                  <th>Normal</th>
                  <th>PUA</th>
                  <th>Ransom</th>
                  <th>Trojan</th>
                  <th>Susp.</th>
                </tr>
              </thead>
              <tbody>
                {confusionMatrix.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{row.class}</td>
                    <td style={{ background: row.normal > 0 ? "rgba(16,185,129,0.15)" : "none", color: row.normal > 0 ? "var(--severity-low)" : "var(--text-muted)" }}>{row.normal}</td>
                    <td style={{ background: row.pua > 0 ? "rgba(245,158,11,0.15)" : "none", color: row.pua > 0 ? "var(--severity-medium)" : "var(--text-muted)" }}>{row.pua}</td>
                    <td style={{ background: row.ransomware > 0 ? "rgba(239,68,68,0.15)" : "none", color: row.ransomware > 0 ? "var(--severity-critical)" : "var(--text-muted)" }}>{row.ransomware}</td>
                    <td style={{ background: row.trojan > 0 ? "rgba(239,68,68,0.15)" : "none", color: row.trojan > 0 ? "var(--severity-critical)" : "var(--text-muted)" }}>{row.trojan}</td>
                    <td style={{ background: row.unknown > 0 ? "rgba(245,158,11,0.15)" : "none", color: row.unknown > 0 ? "var(--severity-medium)" : "var(--text-muted)" }}>{row.unknown}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20, background: "var(--bg-tertiary)", padding: 14, borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <Sparkles size={14} style={{ color: "var(--accent-cyan)", marginRight: 6, verticalAlign: -2 }} />
              <strong>Explainable AI Verdicts:</strong> Every process evaluated by the backend includes a feature attribution breakdown (SHAP-style) highlighting top risk contributors (e.g. high entropy, suspicious directory path, elevated CPU consumption).
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
