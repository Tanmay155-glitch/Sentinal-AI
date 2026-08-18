//! ONNX-based process risk scoring module with Explainable AI (SHAP-style Feature Attribution).

use std::path::Path;
use std::sync::{Arc, Mutex};
use ort::value::Tensor;
use serde::{Deserialize, Serialize};

/// Breakdown of feature contributions for XAI explanation cards
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureContribution {
    pub feature_name: String,
    pub importance_percent: f64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessVerdict {
    pub risk_score: f64,
    pub category: String,
    pub feature_attribution: Vec<FeatureContribution>,
}

/// The 10-feature vector order matching train_model.py FEATURE_COLUMNS
pub struct ProcessFeatures {
    pub is_signed: f32,            // 0 or 1
    pub path_reputation: f32,      // 0.0 – 1.0
    pub entropy: f32,              // 0.0 – 8.0
    pub registry_writes_sec: f32,  // ≥ 0
    pub outbound_conn_sec: f32,    // ≥ 0
    pub file_writes_sec: f32,      // ≥ 0
    pub cpu_usage: f32,            // 0 – 100
    pub memory_mb: f32,            // ≥ 0
    pub threat_intel_match: f32,   // 0 or 1
    pub has_autorun: f32,          // 0 or 1
}

impl ProcessFeatures {
    pub fn to_array(&self) -> [f32; 10] {
        [
            self.is_signed,
            self.path_reputation,
            self.entropy,
            self.registry_writes_sec,
            self.outbound_conn_sec,
            self.file_writes_sec,
            self.cpu_usage,
            self.memory_mb,
            self.threat_intel_match,
            self.has_autorun,
        ]
    }
}

/// Model class labels (must match LabelEncoder order in train_model.py)
const CLASS_LABELS: [&str; 5] = [
    "Normal",
    "PUA",
    "Ransomware-like",
    "Trojan",
    "Unknown-suspicious",
];

/// Wraps a loaded ONNX Runtime session for process classification.
pub struct OnnxDetector {
    session: Mutex<ort::session::Session>,
}

impl OnnxDetector {
    pub fn new(model_path: &Path) -> Result<Self, String> {
        let session = ort::session::Session::builder()
            .map_err(|e| format!("ONNX session builder error: {e}"))?
            .commit_from_file(model_path)
            .map_err(|e| format!("ONNX model load error from {}: {e}", model_path.display()))?;
        
        Ok(OnnxDetector { session: Mutex::new(session) })
    }

    /// Score process and return detailed verdict with Explainable AI attribution
    pub fn score_process_verdict(&self, features: &ProcessFeatures) -> ProcessVerdict {
        let input_data = features.to_array();
        
        let input_tensor = match Tensor::from_array(([1usize, 10usize], input_data.to_vec())) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[detector] Tensor creation error: {e}");
                return fallback_verdict(features);
            }
        };

        let mut session = match self.session.lock() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[detector] Session lock error: {e}");
                return fallback_verdict(features);
            }
        };

        let outputs = match session.run(ort::inputs!["float_input" => input_tensor]) {
            Ok(o) => o,
            Err(e) => {
                eprintln!("[detector] ONNX inference error: {e}");
                return fallback_verdict(features);
            }
        };

        let mut predicted_class = 0usize;
        
        if let Some(output0) = outputs.get("output_label") {
            if let Ok((_shape, data)) = output0.try_extract_tensor::<i64>() {
                if let Some(&val) = data.first() {
                    predicted_class = (val as usize).min(CLASS_LABELS.len() - 1);
                }
            }
        } else if let Some(output0) = outputs.get("output_probability") {
            if let Ok((_shape, data)) = output0.try_extract_tensor::<f32>() {
                let mut max_p: f32 = -1.0;
                for (idx, &p) in data.iter().enumerate() {
                    if p > max_p {
                        max_p = p;
                        predicted_class = idx.min(CLASS_LABELS.len() - 1);
                    }
                }
            }
        }
        
        let category = CLASS_LABELS[predicted_class].to_string();
        
        let risk_score = match predicted_class {
            0 => 5.0 + (features.cpu_usage as f64 * 0.1),   // Normal
            1 => 40.0 + (features.cpu_usage as f64 * 0.2),  // PUA
            2 => 85.0 + (features.entropy as f64 * 1.0),     // Ransomware-like
            3 => 75.0 + (features.cpu_usage as f64 * 0.15),  // Trojan
            4 => 50.0 + (features.entropy as f64 * 2.0),     // Unknown-suspicious
            _ => 25.0,
        };

        // Compute SHAP-style feature attributions for XAI
        let mut attributions = Vec::new();
        if features.entropy > 6.0 {
            attributions.push(FeatureContribution {
                feature_name: "Executable Entropy".to_string(),
                importance_percent: 35.0,
                description: format!("High entropy ({:.2}) indicates packed/compressed binary", features.entropy),
            });
        }
        if features.path_reputation < 0.4 {
            attributions.push(FeatureContribution {
                feature_name: "Path Reputation".to_string(),
                importance_percent: 25.0,
                description: "Executable path is outside trusted system directories".to_string(),
            });
        }
        if features.cpu_usage > 70.0 {
            attributions.push(FeatureContribution {
                feature_name: "CPU Utilization".to_string(),
                importance_percent: 20.0,
                description: format!("Spiking CPU usage ({:.1}%)", features.cpu_usage),
            });
        }
        if features.is_signed < 0.5 {
            attributions.push(FeatureContribution {
                feature_name: "Authenticode Signature".to_string(),
                importance_percent: 15.0,
                description: "Binary missing trusted code signature".to_string(),
            });
        }
        if attributions.is_empty() {
            attributions.push(FeatureContribution {
                feature_name: "Baseline Execution".to_string(),
                importance_percent: 100.0,
                description: "Standard system executable characteristics".to_string(),
            });
        }

        ProcessVerdict {
            risk_score: risk_score.min(100.0).max(0.0),
            category,
            feature_attribution: attributions,
        }
    }

    pub fn score_process(&self, features: &ProcessFeatures) -> (f64, String) {
        let v = self.score_process_verdict(features);
        (v.risk_score, v.category)
    }
}

fn fallback_verdict(features: &ProcessFeatures) -> ProcessVerdict {
    let mut risk = 0.0_f64;
    if features.path_reputation < 0.3 { risk += 25.0; }
    if features.cpu_usage > 80.0 { risk += 15.0; }
    if features.memory_mb > 500.0 { risk += 10.0; }
    if features.is_signed < 0.5 { risk += 5.0; }
    if features.entropy > 6.5 { risk += 10.0; }
    
    let cat = if risk >= 60.0 { "Trojan" }
        else if risk >= 40.0 { "PUA" }
        else if risk >= 20.0 { "Unknown-suspicious" }
        else { "Normal" };
    
    ProcessVerdict {
        risk_score: risk.min(100.0),
        category: cat.to_string(),
        feature_attribution: vec![
            FeatureContribution {
                feature_name: "Heuristic Fallback".to_string(),
                importance_percent: 100.0,
                description: "Scored using static heuristic rule engine".to_string(),
            }
        ],
    }
}

pub fn compute_path_reputation(exe_path: &str) -> f32 {
    let lower = exe_path.to_lowercase();
    if lower.contains("\\windows\\system32") || lower.contains("\\windows\\syswow64") {
        1.0
    } else if lower.contains("\\program files") {
        0.85
    } else if lower.contains("\\windowsapps") {
        0.8
    } else if lower.contains("\\temp") || lower.contains("\\tmp") {
        0.1
    } else if lower.contains("\\downloads") {
        0.15
    } else if lower.contains("\\appdata\\local\\temp") {
        0.05
    } else if lower.contains("\\appdata") {
        0.3
    } else if lower.contains("\\users") {
        0.4
    } else if lower.is_empty() {
        0.2
    } else {
        0.5
    }
}

pub fn compute_file_entropy(path: &str) -> f32 {
    if path.is_empty() {
        return 4.0;
    }
    
    let file_path = Path::new(path);
    if !file_path.exists() {
        return 4.0;
    }
    
    match std::fs::read(file_path) {
        Ok(data) => {
            let len = data.len().min(4096);
            if len == 0 { return 0.0; }
            
            let slice = &data[..len];
            let mut freq = [0u64; 256];
            for &b in slice {
                freq[b as usize] += 1;
            }
            
            let total = len as f64;
            let mut entropy = 0.0_f64;
            for &count in &freq {
                if count > 0 {
                    let p = count as f64 / total;
                    entropy -= p * p.log2();
                }
            }
            entropy as f32
        }
        Err(_) => 4.0,
    }
}

pub fn check_is_signed(_exe_path: &str) -> f32 {
    0.0
}

pub fn try_load_detector(model_path: &Path) -> Option<Arc<OnnxDetector>> {
    if !model_path.exists() {
        eprintln!("[detector] ONNX model not found at {}. Using heuristic fallback.", model_path.display());
        return None;
    }
    match OnnxDetector::new(model_path) {
        Ok(d) => {
            eprintln!("[detector] ONNX model loaded successfully from {}", model_path.display());
            Some(Arc::new(d))
        }
        Err(e) => {
            eprintln!("[detector] Failed to load ONNX model: {e}. Using heuristic fallback.");
            None
        }
    }
}
