const PptxGenJS = require("pptxgenjs");
const path = require("path");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";
pptx.title = "Sentinel AI — Executive Industry Presentation";
pptx.author = "Tanmay Gawali, Divij Kulkarni, Soham Wadale, Ananya Kaushik";
pptx.company = "Final Year Capstone Project";

// Color Palette Constants
const COLOR_BG_LIGHT = "F8FAFC";
const COLOR_NAVY_DARK = "0F172A";
const COLOR_BLUE_PRIMARY = "0284C7";
const COLOR_BLUE_ACCENT = "2563EB";
const COLOR_PURPLE_ACCENT = "7C3AED";
const COLOR_GREEN_ACCENT = "059669";
const COLOR_TEXT_MAIN = "1E293B";
const COLOR_TEXT_MUTED = "64748B";
const COLOR_CARD_BG = "FFFFFF";
const COLOR_CARD_BORDER = "E2E8F0";

// Helper to create slide header (Widescreen 10.0" x 5.625" Canvas)
function addSlideHeader(slide, title, subtitle, speakerPillText) {
  // Title
  slide.addText(title, {
    x: 0.5,
    y: 0.35,
    w: 6.6,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: COLOR_NAVY_DARK,
    fontFace: "Arial"
  });
  
  // Subtitle
  slide.addText(subtitle, {
    x: 0.5,
    y: 0.75,
    w: 6.6,
    h: 0.25,
    fontSize: 10.5,
    color: COLOR_BLUE_PRIMARY,
    fontFace: "Arial"
  });

  // Speaker Badge Pill (Fits inside 10.0" width)
  if (speakerPillText) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 7.3,
      y: 0.35,
      w: 2.2,
      h: 0.4,
      fill: { color: "F1F5F9" },
      line: { color: COLOR_PURPLE_ACCENT, width: 1 },
      rectRadius: 0.2
    });
    slide.addText(`🎙️ ${speakerPillText}`, {
      x: 7.3,
      y: 0.35,
      w: 2.2,
      h: 0.4,
      fontSize: 9,
      bold: true,
      color: COLOR_PURPLE_ACCENT,
      align: "center",
      fontFace: "Arial"
    });
  }

  // Divider Line across 9.0" usable width
  slide.addShape(pptx.shapes.LINE, {
    x: 0.5,
    y: 1.05,
    w: 9.0,
    h: 0,
    line: { color: COLOR_CARD_BORDER, width: 1 }
  });
}

// Helper to add a content card container with proper line wrapping
function addCard(slide, x, y, w, h, title, bullets, borderColor = COLOR_CARD_BORDER) {
  // Card Container
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { color: COLOR_CARD_BG },
    line: { color: borderColor, width: 1.5 },
    rectRadius: 0.1
  });

  // Card Header Bar Accent
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: x,
    y: y,
    w: w,
    h: 0.38,
    fill: { color: "F8FAFC" },
    line: { color: borderColor, width: 1 }
  });

  // Card Title
  slide.addText(title, {
    x: x + 0.15,
    y: y + 0.04,
    w: w - 0.3,
    h: 0.3,
    fontSize: 11.5,
    bold: true,
    color: COLOR_BLUE_PRIMARY,
    fontFace: "Arial"
  });

  // Bullets formatting
  if (bullets && bullets.length > 0) {
    const textObjects = bullets.flatMap((item) => [
      { text: item.bold ? `${item.bold}: ` : "", options: { bold: true, color: COLOR_NAVY_DARK, fontSize: 9.5, fontFace: "Arial" } },
      { text: `${item.text}\n`, options: { bold: false, color: COLOR_TEXT_MAIN, fontSize: 9.5, fontFace: "Arial" } }
    ]);

    slide.addText(textObjects, {
      x: x + 0.15,
      y: y + 0.42,
      w: w - 0.3,
      h: h - 0.48,
      valign: "top",
      bullet: { type: "bullet", code: "25B8" },
      paraSpaceBefore: 3
    });
  }
}

// SLIDE 1: Title Slide (Centered & Fits 10.0" Canvas)
const slide1 = pptx.addSlide();
slide1.background = { color: COLOR_NAVY_DARK };

slide1.addText("CAPSTONE PROJECT & INDUSTRY EVALUATION", {
  x: 0.5, y: 0.5, w: 9.0, h: 0.35,
  fontSize: 11, bold: true, color: COLOR_BLUE_PRIMARY, align: "center", fontFace: "Arial"
});

slide1.addText("SENTINEL AI", {
  x: 0.5, y: 0.95, w: 9.0, h: 0.75,
  fontSize: 36, bold: true, color: "FFFFFF", align: "center", fontFace: "Arial"
});

slide1.addText("Intelligent Endpoint Threat Detection and Response (EDR) Platform", {
  x: 0.5, y: 1.7, w: 9.0, h: 0.4,
  fontSize: 14, color: "CBD5E1", align: "center", fontFace: "Arial"
});

slide1.addText("Tauri v2  |  Rust  |  React 18  |  TypeScript  |  ONNX Runtime ML  |  SQLite  |  MITRE ATT&CK", {
  x: 0.5, y: 2.15, w: 9.0, h: 0.35,
  fontSize: 9.5, bold: true, color: COLOR_BLUE_PRIMARY, align: "center", fontFace: "Arial"
});

// Presenter Cards on Title Slide (4 Cards Perfectly Spaced)
const teamMembers = [
  { name: "Tanmay Gawali", role: "Team Lead & AI Architect" },
  { name: "Divij Kulkarni", role: "Rust Core & Systems Engineer" },
  { name: "Soham Wadale", role: "Network Telemetry Engineer" },
  { name: "Ananya Kaushik", role: "Frontend & Compliance Lead" }
];

teamMembers.forEach((m, idx) => {
  const cardX = 0.5 + idx * 2.3; // 4 cards: 0.5, 2.8, 5.1, 7.4 (Width 2.1 each)
  slide1.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: cardX, y: 2.85, w: 2.1, h: 2.2,
    fill: { color: "1E293B" }, line: { color: "334155", width: 1 }, rectRadius: 0.1
  });

  // User Icon Badge
  slide1.addText("👤", {
    x: cardX, y: 3.1, w: 2.1, h: 0.4,
    fontSize: 20, align: "center"
  });

  slide1.addText(m.name, {
    x: cardX, y: 3.65, w: 2.1, h: 0.35,
    fontSize: 11, bold: true, color: "FFFFFF", align: "center", fontFace: "Arial"
  });
  slide1.addText(m.role, {
    x: cardX, y: 4.05, w: 2.1, h: 0.7,
    fontSize: 9, color: "94A3B8", align: "center", fontFace: "Arial"
  });
});

slide1.addNotes("Tanmay Gawali: Good morning respected evaluators and guests. I am Tanmay Gawali, Lead Architect of Sentinel AI. Today, along with my teammates Divij Kulkarni, Soham Wadale, and Ananya Kaushik, we present Sentinel AI—an intelligent, low-overhead Endpoint Detection and Response platform engineered for local desktop protection.");


// SLIDE 2: Problem Statement & Context
const slide2 = pptx.addSlide();
slide2.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide2, "The Endpoint Security Challenge", "Limitations of Legacy Signature Antivirus & Heavy Cloud EDRs", "Tanmay Gawali");

addCard(slide2, 0.5, 1.2, 4.35, 4.0, "⚠️ Current Industry Vulnerabilities", [
  { bold: "Stealth Fileless Malware", text: "PowerShell scripts and living-off-the-land binaries bypass traditional static antivirus signatures." },
  { bold: "High Cloud Latency", text: "Streaming raw host telemetry to cloud SIEM servers causes network overhead and delays threat response." },
  { bold: "Privacy & Compliance Risks", text: "Transmitting full packet payloads across external networks risks GDPR/HIPAA compliance violations." },
  { bold: "Heavy Resource Overhead", text: "Commercial EDR agents frequently consume 15-25% CPU, degrading host device performance." }
]);

addCard(slide2, 5.15, 1.2, 4.35, 4.0, "🎯 The Sentinel AI Solution", [
  { bold: "100% On-Device Protection", text: "Local machine learning inference (ONNX Runtime) with zero cloud server dependency." },
  { bold: "Sub-Millisecond Probing", text: "Native Rust background service leveraging low-overhead Event Tracing for Windows (ETW)." },
  { bold: "Metadata-Only Inspection", text: "5-tuple network flow correlation without intrusive TLS packet payload decryption." },
  { bold: "Automated Incident Export", text: "Generates standardized NIST SP 800-61 Rev. 2 forensic packages for security operations." }
], COLOR_BLUE_PRIMARY);

slide2.addNotes("Tanmay Gawali: Modern fileless malware and ransomware render static antivirus obsolete, while commercial cloud EDRs introduce bandwidth latency and privacy concerns. Sentinel AI solves this gap by performing 100% of threat classification locally on the device using native Rust probing and an embedded ONNX AI model.");


// SLIDE 3: Team Ownership Matrix
const slide3 = pptx.addSlide();
slide3.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide3, "Team Role Allocation & Technical Ownership", "Structured Division of Responsibilities Across Architecture, Core & Compliance", "Tanmay Gawali");

const owners = [
  {
    name: "Tanmay Gawali (Team Lead)",
    title: "AI Engine Architect",
    bullets: [
      { bold: "Technical Scope", text: "ONNX ML Model Training, 15-Vector Feature Extraction, AI Explainability." },
      { bold: "Presentation Focus", text: "Project Vision, Problem Statement, ML Detection Engine & Q&A Lead." }
    ]
  },
  {
    name: "Divij Kulkarni",
    title: "Rust Core & Systems Engineer",
    bullets: [
      { bold: "Technical Scope", text: "Tauri v2 IPC Architecture, ETW Process Monitoring, Win32 System Probing, SQLite DDL." },
      { bold: "Presentation Focus", text: "Tech Stack Justification, Real-Time Process Monitor, Benchmarks." }
    ]
  },
  {
    name: "Soham Wadale",
    title: "Network & Subnet Engineer",
    bullets: [
      { bold: "Technical Scope", text: "5-Tuple Socket Tracking, Npcap Flow Engine, ARP/mDNS Device Scanner, Registry Watcher." },
      { bold: "Presentation Focus", text: "Network Flow Tracking, Subnet Device Scanner, Persistence Monitor." }
    ]
  },
  {
    name: "Ananya Kaushik",
    title: "Frontend Architect & Compliance Lead",
    bullets: [
      { bold: "Technical Scope", text: "Glassmorphic React Console, MITRE ATT&CK Matrix, NIST SP 800-61 Rev. 2 Exporter." },
      { bold: "Presentation Focus", text: "MITRE Alert Triage, NIST Forensic Exporter, UI Console Demonstration." }
    ]
  }
];

owners.forEach((o, idx) => {
  const col = idx % 2;
  const row = Math.floor(idx / 2);
  const cx = 0.5 + col * 4.65;
  const cy = 1.2 + row * 2.05;
  addCard(slide3, cx, cy, 4.35, 1.9, `${o.name} — ${o.title}`, o.bullets);
});

slide3.addNotes("Tanmay Gawali: Here is our technical ownership breakdown. As Team Lead, I designed the overall architecture and AI engine. Divij built the native Rust system probing service. Soham developed the network socket tracker and subnet scanner. Ananya engineered our React UI, MITRE triage matrix, and NIST exporter.");


// SLIDE 4: System Architecture (3 Columns Fits Perfectly)
const slide4 = pptx.addSlide();
slide4.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide4, "High-Level System Architecture", "Low-Overhead Native Rust Core with Embedded ONNX Inference", "Divij Kulkarni");

addCard(slide4, 0.5, 1.2, 2.8, 4.0, "⚛️ Desktop Shell & UI", [
  { bold: "Tauri v2 + React 18", text: "Component-driven responsive interface using native system webview." },
  { bold: "Low Memory Footprint", text: "Consumes ~42 MB idle RAM vs. 200MB+ for Chromium/Electron apps." },
  { bold: "TypeScript IPC", text: "Asynchronous, type-safe command invocation to native Rust backend threads." }
]);

addCard(slide4, 3.6, 1.2, 2.8, 4.0, "🦀 Native Rust Core Engine", [
  { bold: "ETW Telemetry Probing", text: "Subscribes to Microsoft-Windows-Kernel-Process provider for process lifecycle events." },
  { bold: "Win32 System Hooks", text: "Direct query of process trees, SHA-256 binary hashes, and digital signatures." },
  { bold: "Embedded SQLite DB", text: "Zero-admin local storage managing 14 normalized telemetry tables." }
], COLOR_BLUE_PRIMARY);

addCard(slide4, 6.7, 1.2, 2.8, 4.0, "🧠 Machine Learning & Storage", [
  { bold: "Embedded ONNX Engine", text: "Evaluates Python-trained Random Forest/XGBoost models via ONNX C++ Runtime." },
  { bold: "Zero Cloud Dependencies", text: "Inference runs completely offline without sending telemetry over external networks." },
  { bold: "Threat Intel Cache", text: "Local cache of public IOC hash lists (abuse.ch, URLhaus)." }
]);

slide4.addNotes("Divij Kulkarni: Hello everyone, I am Divij Kulkarni. We chose Tauri v2 and Rust for our backend infrastructure because an security monitoring agent must itself be lightweight. By leveraging native Win32 APIs and Event Tracing for Windows, Rust probes system events in real time while using 70% less RAM than Electron.");


// SLIDE 5: Module 1 Process Monitor
const slide5 = pptx.addSlide();
slide5.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide5, "Module 1: Real-Time Process & Behavior Engine", "Continuous Host Telemetry & Heuristic Integrity Probing", "Divij Kulkarni");

addCard(slide5, 0.5, 1.2, 4.35, 4.0, "⚡ Continuous Telemetry Collection", [
  { bold: "Process Tree Enumeration", text: "Tracks active processes, parent-child PID relationships, and thread counts." },
  { bold: "Resource Profiling", text: "Monitors CPU usage ratios and RAM memory footprint at 2-second intervals." },
  { bold: "SHA-256 Image Hashing", text: "Automated cryptographic hashing of binary images upon execution." },
  { bold: "Digital Signature Audit", text: "Queries Authenticode signatures to identify unsigned or self-signed binaries." }
]);

addCard(slide5, 5.15, 1.2, 4.35, 4.0, "🛡️ Behavioral Heuristic Rules", [
  { bold: "Unquoted Service Paths", text: "Flags service paths vulnerable to binary hijacking and privilege escalation." },
  { bold: "Temp Directory Execution", text: "Scrutinizes executables launched from AppData\\Local\\Temp or Downloads." },
  { bold: "Command Line Flags", text: "Detects obfuscated PowerShell parameters (-enc, -nop, -w hidden)." },
  { bold: "Parent-Child Anomalies", text: "Flags irregular spawns (e.g. cmd.exe or powershell.exe spawned by excel.exe)." }
], COLOR_BLUE_PRIMARY);

slide5.addNotes("Divij Kulkarni: Module 1 continuously monitors all active host processes. Using ETW and Win32 calls, it audits digital signatures, computes SHA-256 hashes, and checks behavioral rules—such as detecting command prompts spawned by Office applications—all under 1.5% CPU overhead.");


// SLIDE 6: Module 2 ONNX AI Detection Engine
const slide6 = pptx.addSlide();
slide6.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide6, "Module 2: Embedded ONNX AI Threat Classifier", "Local Inference for Zero-Day Behavior Classification", "Tanmay Gawali");

addCard(slide6, 0.5, 1.2, 4.35, 4.0, "🤖 Model Training & Architecture", [
  { bold: "Supervised Ensemble", text: "Random Forest and XGBoost classifiers trained on 15+ behavioral feature vectors." },
  { bold: "ONNX Compilation", text: "Model exported to Open Neural Network Exchange format for native C++ execution." },
  { bold: "15 Feature Vectors", text: "Includes CPU/RAM growth rate, parent-child ratio, outbound socket count, and digital signature status." },
  { bold: "Zero Cloud Latency", text: "Runs inference locally inside the Rust binary without embedding Python interpreters." }
]);

addCard(slide6, 5.15, 1.2, 4.35, 4.0, "📈 Empirical Performance & Explainability", [
  { bold: "98.4% Accuracy", text: "Evaluated against public EMBER malware benchmark datasets and benign baselines." },
  { bold: "< 2.4 ms Latency", text: "Sub-millisecond inference speed ensures process threat classification happens in near-real-time." },
  { bold: "Explainable Risk Scoring", text: "Outputs a 0–100 risk score and lists feature importance weights for every alert." },
  { bold: "Fixed Taxonomy", text: "Classifies threats into Trojan, Ransomware-like, PUA, or Suspicious categories." }
], COLOR_PURPLE_ACCENT);

slide6.addNotes("Tanmay Gawali: I engineered the AI Detection Engine. Rather than relying on static signatures, we trained an ensemble Random Forest model on 15 process feature vectors. Exported to ONNX format, our Rust backend runs inference locally in under 2.4 milliseconds with 98.4% accuracy, providing explainable feature breakdowns per verdict.");


// SLIDE 7: Module 3 Network Monitor & Subnet Scanner
const slide7 = pptx.addSlide();
slide7.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide7, "Module 3: Network Flow Monitor & Subnet Scanner", "5-Tuple Socket Correlation & Local Subnet Device Discovery", "Soham Wadale");

addCard(slide7, 0.5, 1.2, 4.35, 4.0, "🌐 Network Flow Correlation", [
  { bold: "5-Tuple Flow Tracking", text: "Captures Source IP/Port, Destination IP/Port, and Protocol statistics." },
  { bold: "Process-to-Socket Mapping", text: "Correlates active network sockets directly to local PIDs via GetExtendedTcpTable." },
  { bold: "Privacy Guarantee", text: "Zero TLS payload decryption; inspects SNI server names and flow metadata only." },
  { bold: "Local Firewall Blocking", text: "Allows instant creation of Windows Filtering Platform (WFP) blocking rules for malicious IPs." }
]);

addCard(slide7, 5.15, 1.2, 4.35, 4.0, "📡 Subnet Device Discovery", [
  { bold: "Dual Probing Protocol", text: "Uses ARP sweeps and mDNS/SSDP broadcast listening to discover active subnet hosts." },
  { bold: "Device Fingerprinting", text: "Resolves local hostnames, IP histories, and IEEE OUI MAC vendor tags." },
  { bold: "MAC Spoof Detection", text: "Identifies MAC address randomization and suspicious MAC duplication." },
  { bold: "Port Scan Heuristics", text: "Flags newly connected devices attempting rapid sequential port probes." }
], COLOR_BLUE_PRIMARY);

slide7.addNotes("Soham Wadale: Hello, I am Soham Wadale. I developed the Network Telemetry and Subnet Scanner modules. Sentinel AI correlates active TCP/UDP sockets directly to local process PIDs while maintaining privacy by inspecting metadata only. Furthermore, our device scanner uses ARP and mDNS to detect rogue devices and MAC spoofing instantly.");


// SLIDE 8: Module 4 Registry & Persistence Inspector
const slide8 = pptx.addSlide();
slide8.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide8, "Module 4: Windows Registry & Persistence Inspector", "Defending Against System Startup & Boot Autostart Hijacking", "Soham Wadale");

addCard(slide8, 0.5, 1.2, 4.35, 4.0, "🔑 Windows Registry Inspection", [
  { bold: "Run & RunOnce Keys", text: "Scans HKCU and HKLM Software\\Microsoft\\Windows\\CurrentVersion\\Run keys." },
  { bold: "Windows Services", text: "Monitors creation and modification of background system service configurations." },
  { bold: "Scheduled Tasks", text: "Audits Windows Task Scheduler entries for obfuscated executable launch flags." }
]);

addCard(slide8, 5.15, 1.2, 4.35, 4.0, "📁 Startup Folder & MITRE Mapping", [
  { bold: "Startup Folder Watching", text: "Tracks added shortcut (.lnk) files and scripts in user autostart directories." },
  { bold: "Binary Integrity Check", text: "Computes SHA-256 checksums of autostart binaries to detect unauthorized tampering." },
  { bold: "MITRE ATT&CK T1547", text: "Tags all persistence modifications with official MITRE technique ID T1547." }
], COLOR_BLUE_PRIMARY);

slide8.addNotes("Soham Wadale: Over 80% of persistent malware attempts autostart registration to survive system reboots. Our Persistence Module watches Windows Registry Run keys, startup folders, and scheduled tasks, computing SHA-256 hashes and tagging autostart modifications with MITRE technique T1547.");


// SLIDE 9: Module 5 Alert Triage & NIST Incident Exporter
const slide9 = pptx.addSlide();
slide9.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide9, "Module 5: Alert Triage & Incident Compliance", "MITRE ATT&CK Mapping & NIST SP 800-61 Rev. 2 Exporter", "Ananya Kaushik");

addCard(slide9, 0.5, 1.2, 4.35, 4.0, "🏷️ MITRE ATT&CK Alert Matrix", [
  { bold: "Automated Technique Tagging", text: "Tags alerts with standard MITRE IDs (T1059 Command Line, T1055 Process Injection)." },
  { bold: "Severity Classification", text: "Categorizes threats into Critical, High, Medium, and Informational tiers." },
  { bold: "Chronological Timeline", text: "Displays a unified attack timeline linking process, network, and registry events." }
]);

addCard(slide9, 5.15, 1.2, 4.35, 4.0, "📄 NIST SP 800-61 Rev. 2 Exporter", [
  { bold: "Standardized Forensic Bundles", text: "Exports structured JSON and Markdown incident packages for SOC analysts." },
  { bold: "Lifecycle Alignment", text: "Follows NIST phases: Preparation → Detection & Analysis → Containment → Post-Incident." },
  { bold: "Actionable Remediation", text: "Includes full hash chains, network sockets, AI confidence scores, and containment steps." }
], COLOR_GREEN_ACCENT);

slide9.addNotes("Ananya Kaushik: Greetings evaluators, I am Ananya Kaushik. I led the UI Architecture and Compliance Integration. Sentinel AI maps all alerts directly to the MITRE ATT&CK matrix. For incident response, our console generates standardized NIST SP 800-61 Rev. 2 forensic packages with full telemetry and remediation steps.");


// SLIDE 10: UI/UX Architecture & Console
const slide10 = pptx.addSlide();
slide10.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide10, "UI / UX Architecture & Dashboard Console", "Modern Glassmorphic Interface Built for Security Operations", "Ananya Kaushik");

const uiCards = [
  { title: "📊 Executive Dashboard", text: "Real-time threat status gauge, active process metrics, network flow volume, and high-level risk overview." },
  { title: "⚡ Process Table", text: "Dynamic sorting, search filtering, binary hash inspection modal, and instant process termination controls." },
  { title: "🔥 MITRE Heatmap", text: "Interactive grid matrix visualizing detected ATT&CK techniques across active system events." },
  { title: "📁 Incident Exporter", text: "One-click generation of NIST SP 800-61 forensic report bundles with custom time filters." }
];

uiCards.forEach((c, idx) => {
  const col = idx % 2;
  const row = Math.floor(idx / 2);
  const cx = 0.5 + col * 4.65;
  const cy = 1.2 + row * 2.05;
  addCard(slide10, cx, cy, 4.35, 1.9, c.title, [{ bold: "Functionality", text: c.text }]);
});

slide10.addNotes("Ananya Kaushik: We designed our UI to give security analysts immediate visual clarity. Built in React 18 with modern dark-mode styling, the console features an Executive Overview, interactive Process Table, visual MITRE Heatmap grid, and an instant Incident Export manager.");


// SLIDE 11: Performance Benchmarks
const slide11 = pptx.addSlide();
slide11.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide11, "Performance Benchmarks & Security Safeguards", "Empirical Measurement of Agent Resource Usage & Operating Controls", "Divij Kulkarni");

addCard(slide11, 0.5, 1.2, 2.8, 4.0, "⚡ CPU & RAM Overhead", [
  { bold: "< 1.8% CPU Usage", text: "Measured under steady-state monitoring (Target was < 5%)." },
  { bold: "~42 MB RAM Footprint", text: "70% lower memory usage than Electron-based monitoring agents." },
  { bold: "Sub-Second Startup", text: "Cold application launch in under 250 milliseconds." }
]);

addCard(slide11, 3.6, 1.2, 2.8, 4.0, "⏱️ Inference & Latency", [
  { bold: "< 2.4 ms ML Inference", text: "Local ONNX C++ Runtime inference time per evaluation." },
  { bold: "12 ms Cycle Enumeration", text: "Full host process tree query duration." },
  { bold: "1.1 s Subnet ARP Sweep", text: "Local subnet device discovery duration." }
], COLOR_BLUE_PRIMARY);

addCard(slide11, 6.7, 1.2, 2.8, 4.0, "🔒 Operational Safety", [
  { bold: "Elevated Privileges", text: "Runs in Administrator mode for ETW and WFP firewall management." },
  { bold: "User Confirmation", text: "Process termination & IP blocking require explicit user confirmation." },
  { bold: "OS Coexistence", text: "Acts as a complementary monitoring layer; does not disable Windows Defender." }
]);

slide11.addNotes("Divij Kulkarni: Empirical testing confirms Sentinel AI consumes only 42 MB of RAM and 1.8% CPU overhead. Local ONNX inference evaluates processes in 2.4 milliseconds. All privileged actions like process termination require explicit user confirmation, ensuring operational safety.");


// SLIDE 12: Future Roadmap
const slide12 = pptx.addSlide();
slide12.background = { color: COLOR_BG_LIGHT };
addSlideHeader(slide12, "Product Roadmap & Future Scope", "Transitioning from Endpoint MVP to Enterprise EDR Framework", "Soham Wadale");

addCard(slide12, 0.5, 1.2, 4.35, 4.0, "🚀 Phase 1: Near-Term Enhancements", [
  { bold: "Cross-Platform Support", text: "Porting kernel telemetry probes to Linux via eBPF and macOS via Endpoint Security API." },
  { bold: "Automated Quarantine", text: "Optional auto-isolation of network interfaces upon critical ransomware alerts." },
  { bold: "YARA Rule Scanning", text: "Live scanning of process memory buffers against custom YARA threat rules." }
]);

addCard(slide12, 5.15, 1.2, 4.35, 4.0, "🌐 Phase 2: Enterprise Infrastructure", [
  { bold: "Centralized Fleet Management", text: "Multi-agent management server console for enterprise workstation fleets." },
  { bold: "SIEM Connector Integration", text: "Native Syslog/CEF export to Splunk, Elastic, and Microsoft Sentinel." },
  { bold: "Continuous ML Updating", text: "Federated on-device model updating with feedback loops." }
], COLOR_BLUE_PRIMARY);

slide12.addNotes("Soham Wadale: Looking ahead, our post-MVP roadmap includes expanding cross-platform support via Linux eBPF, implementing automated process isolation, YARA memory scanning, and building SIEM export connectors for Splunk and Microsoft Sentinel.");


// SLIDE 13: Conclusion & Q&A
const slide13 = pptx.addSlide();
slide13.background = { color: COLOR_NAVY_DARK };

slide13.addText("PROJECT COMPLETION & EVALUATION", {
  x: 0.5, y: 0.6, w: 9.0, h: 0.35,
  fontSize: 11, bold: true, color: COLOR_GREEN_ACCENT, align: "center", fontFace: "Arial"
});

slide13.addText("Thank You!", {
  x: 0.5, y: 1.05, w: 9.0, h: 0.75,
  fontSize: 40, bold: true, color: "FFFFFF", align: "center", fontFace: "Arial"
});

slide13.addText("Sentinel AI — Intelligent Endpoint Threat Detection & Response System", {
  x: 0.5, y: 1.85, w: 9.0, h: 0.4,
  fontSize: 14, color: "CBD5E1", align: "center", fontFace: "Arial"
});

// GitHub Repo Box
slide13.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 1.0, y: 2.65, w: 8.0, h: 1.3,
  fill: { color: "1E293B" }, line: { color: COLOR_BLUE_PRIMARY, width: 1.5 }, rectRadius: 0.1
});

slide13.addText("📁 Official Project GitHub Repository:", {
  x: 1.0, y: 2.85, w: 8.0, h: 0.3,
  fontSize: 12, color: "94A3B8", align: "center", fontFace: "Arial"
});

slide13.addText("https://github.com/Tanmay155-glitch/Sentinal-AI.git", {
  x: 1.0, y: 3.25, w: 8.0, h: 0.4,
  fontSize: 14, bold: true, color: COLOR_BLUE_PRIMARY, align: "center", fontFace: "Arial"
});

// Presenter Names
slide13.addText("Presenters: Tanmay Gawali (Lead)  |  Divij Kulkarni  |  Soham Wadale  |  Ananya Kaushik", {
  x: 0.5, y: 4.3, w: 9.0, h: 0.4,
  fontSize: 11, color: "CBD5E1", align: "center", fontFace: "Arial"
});

slide13.addNotes("All Team Members: Thank you for your time and evaluation. We are proud of what we have accomplished with Sentinel AI and welcome your questions, feedback, and technical discussion!");

// Save PPTX File
const outputPath = path.join(__dirname, "..", "Sentinel_AI_Final_Presentation.pptx");
pptx.writeFile({ fileName: outputPath }).then(fileName => {
  console.log("SUCCESS: Perfectly aligned PPTX Presentation created at " + fileName);
}).catch(err => {
  console.error("ERROR generating PPTX:", err);
});
