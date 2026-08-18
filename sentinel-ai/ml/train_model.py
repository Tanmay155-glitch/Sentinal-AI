"""
Sentinel AI — ML Model Training Pipeline
=========================================
Trains a malware/benign classifier using static and behavioral features.
Exports the trained model to ONNX format for Rust-side inference.

Dataset: Must be a labeled CSV with columns defined in FEATURE_COLUMNS.
The team should use a named, public benchmark (e.g., EMBER, CICMalDroid,
or a documented custom sample set) and record all details in the model card.

Usage:
    python train_model.py --dataset data/features.csv --output models/detector.onnx

Requirements:
    pip install scikit-learn xgboost pandas numpy skl2onnx onnxruntime shap
"""

import argparse
import json
import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    precision_recall_fscore_support,
    confusion_matrix,
)
from sklearn.preprocessing import LabelEncoder

# Attempt optional imports
try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    HAS_ONNX_EXPORT = True
except ImportError:
    HAS_ONNX_EXPORT = False


# --- Feature Schema (per TRD FR-2.1) ---
FEATURE_COLUMNS = [
    "is_signed",           # 0/1: Authenticode signature present
    "path_reputation",     # 0-1: system dir = 1.0, user-writable = 0.0
    "entropy",             # Shannon entropy of on-disk image (0-8)
    "registry_writes_sec", # Count of registry writes per second
    "outbound_conn_sec",   # Count of outbound connections per second
    "file_writes_sec",     # Count of file writes per second
    "cpu_usage",           # Current CPU % used by process
    "memory_mb",           # Memory footprint in MB
    "threat_intel_match",  # 0/1: hash/IP matched in threat-intel cache
    "has_autorun",         # 0/1: associated with autorun/startup entry
]

LABEL_COLUMN = "category"  # e.g., Normal, Trojan, Ransomware-like, PUA


def generate_synthetic_dataset(n_samples: int = 5000) -> pd.DataFrame:
    """Generate a synthetic dataset for demonstration/testing purposes.
    
    WARNING: This is for pipeline validation only. A real deployment must
    use a named, public benchmark dataset (see model card requirements).
    """
    np.random.seed(42)
    
    categories = ["Normal", "Trojan", "Ransomware-like", "PUA", "Unknown-suspicious"]
    weights = [0.60, 0.12, 0.08, 0.12, 0.08]  # Imbalanced, realistic
    
    labels = np.random.choice(categories, size=n_samples, p=weights)
    
    data = {}
    for i, label in enumerate(labels):
        is_malicious = label != "Normal"
        data.setdefault("is_signed", []).append(
            np.random.choice([0, 1], p=[0.8, 0.2] if is_malicious else [0.1, 0.9])
        )
        data.setdefault("path_reputation", []).append(
            np.random.uniform(0.0, 0.4) if is_malicious else np.random.uniform(0.6, 1.0)
        )
        data.setdefault("entropy", []).append(
            np.random.uniform(5.5, 7.9) if is_malicious else np.random.uniform(2.0, 5.5)
        )
        data.setdefault("registry_writes_sec", []).append(
            np.random.exponential(3.0) if label == "Trojan" else np.random.exponential(0.3)
        )
        data.setdefault("outbound_conn_sec", []).append(
            np.random.exponential(5.0) if is_malicious else np.random.exponential(0.5)
        )
        data.setdefault("file_writes_sec", []).append(
            np.random.exponential(10.0) if label == "Ransomware-like" else np.random.exponential(0.5)
        )
        data.setdefault("cpu_usage", []).append(
            np.random.uniform(30, 95) if is_malicious else np.random.uniform(0, 30)
        )
        data.setdefault("memory_mb", []).append(
            np.random.uniform(100, 800) if is_malicious else np.random.uniform(5, 300)
        )
        data.setdefault("threat_intel_match", []).append(
            np.random.choice([0, 1], p=[0.3, 0.7] if is_malicious else [0.98, 0.02])
        )
        data.setdefault("has_autorun", []).append(
            np.random.choice([0, 1], p=[0.4, 0.6] if label in ["Trojan", "Ransomware-like"] else [0.95, 0.05])
        )
    
    df = pd.DataFrame(data)
    df[LABEL_COLUMN] = labels
    return df


def train_model(df: pd.DataFrame, model_type: str = "random_forest"):
    """Train and evaluate a classifier."""
    
    X = df[FEATURE_COLUMNS].values.astype(np.float32)
    le = LabelEncoder()
    y = le.fit_transform(df[LABEL_COLUMN])
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\n{'='*60}")
    print(f"  Training {model_type} classifier")
    print(f"  Train: {len(X_train)} | Test: {len(X_test)}")
    print(f"  Classes: {list(le.classes_)}")
    print(f"{'='*60}\n")
    
    if model_type == "xgboost" and HAS_XGB:
        model = xgb.XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            use_label_encoder=False, eval_metric="mlogloss", random_state=42
        )
    else:
        model = RandomForestClassifier(
            n_estimators=200, max_depth=12, random_state=42, n_jobs=-1
        )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    # Evaluation metrics
    report = classification_report(y_test, y_pred, target_names=le.classes_)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, average="weighted"
    )
    cm = confusion_matrix(y_test, y_pred)
    
    print("Classification Report:")
    print(report)
    print(f"Weighted F1: {f1:.4f}")
    print(f"Confusion Matrix:\n{cm}")
    
    # Feature importances
    importances = model.feature_importances_
    feat_imp = sorted(zip(FEATURE_COLUMNS, importances), key=lambda x: -x[1])
    print("\nFeature Importances:")
    for feat, imp in feat_imp:
        bar = "#" * int(imp * 50)
        print(f"  {feat:25s} {imp:.4f} {bar}")
    
    return model, le, {
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "feature_importances": {k: float(v) for k, v in feat_imp},
        "classes": list(le.classes_),
        "confusion_matrix": cm.tolist(),
    }


def export_onnx(model, output_path: str):
    """Export sklearn model to ONNX format."""
    if not HAS_ONNX_EXPORT:
        print("WARNING: skl2onnx not installed. Skipping ONNX export.")
        return False
    
    initial_type = [("float_input", FloatTensorType([None, len(FEATURE_COLUMNS)]))]
    onnx_model = convert_sklearn(model, initial_types=initial_type)
    
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    
    print(f"\nONNX model exported to: {output_path}")
    return True


def generate_model_card(metrics: dict, dataset_name: str, output_path: str):
    """Generate a model card per TRD FR-2.2 requirements."""
    card = {
        "model_name": "Sentinel AI Process Classifier",
        "version": "1.0.0",
        "training_date": datetime.now().isoformat(),
        "dataset": {
            "name": dataset_name,
            "description": "Labeled process feature dataset",
            "split": "80/20 stratified train/test",
        },
        "metrics": {
            "precision_weighted": metrics["precision"],
            "recall_weighted": metrics["recall"],
            "f1_weighted": metrics["f1"],
        },
        "feature_importances": metrics["feature_importances"],
        "classes": metrics["classes"],
        "limitations": [
            "Trained on synthetic/limited data — not validated against real-world malware at scale",
            "Model should be retrained with production-quality labeled datasets before deployment",
            "Confidence scores are model output probabilities, not absolute certainty",
        ],
        "ethical_considerations": [
            "False positives may disrupt legitimate software — auto-response is off by default",
            "Model is a complementary tool, not a replacement for certified AV solutions",
        ],
    }
    
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(card, f, indent=2)
    
    print(f"Model card saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Sentinel AI Model Training")
    parser.add_argument("--dataset", type=str, default=None, help="Path to labeled CSV")
    parser.add_argument("--output", type=str, default="src-tauri/models/detector.onnx", help="ONNX output path")
    parser.add_argument("--model-type", choices=["random_forest", "xgboost"], default="random_forest")
    parser.add_argument("--synthetic", action="store_true", help="Use synthetic data for testing")
    args = parser.parse_args()
    
    if args.dataset and os.path.exists(args.dataset):
        print(f"Loading dataset from: {args.dataset}")
        df = pd.read_csv(args.dataset)
    else:
        if not args.synthetic:
            print("No dataset provided. Use --synthetic for demo, or --dataset <path>")
            print("WARNING: Using synthetic data. This is for pipeline validation only.")
        df = generate_synthetic_dataset()
    
    model, le, metrics = train_model(df, args.model_type)
    export_onnx(model, args.output)
    generate_model_card(
        metrics,
        dataset_name=args.dataset or "synthetic_demo",
        output_path=args.output.replace(".onnx", "_model_card.json")
    )
    
    print("\n[OK] Training pipeline complete!")


if __name__ == "__main__":
    main()
