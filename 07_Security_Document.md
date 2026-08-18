# Security Document
## Sentinel AI — MVP

**Version:** 1.0

---

## 1. Purpose
This document covers the security posture of Sentinel AI itself (since it is a privileged, security-relevant application), the legal/ethical boundaries of its monitoring functions, and how it aligns with recognized standards rather than ad-hoc practices.

## 2. Threat Model for the Application Itself

Because Sentinel AI runs with local administrator privileges, subscribes to kernel ETW providers, captures network packets, and can terminate processes / modify firewall rules, **the application itself is a high-value target**. If compromised, an attacker could gain a privileged foothold and disable the very protections the tool provides.

| Asset | Threat | Mitigation |
|---|---|---|
| The Sentinel AI process itself | Being terminated/tampered with by malware to blind the user | Basic self-protection (e.g., restart-on-crash watchdog); note that true anti-tamper (protected-process status) requires Microsoft code-signing/PPL enrollment and is out of MVP scope — must be disclosed, not silently assumed |
| Local SQLite event store | Tampering to hide evidence of compromise | File permissions restricted to admin/service account; consider write-once/append-friendly patterns for the `timeline_events` table |
| ONNX model file | Model-replacement or adversarial poisoning if updates aren't verified | Ship models with a checksum/signature verified at load time; do not auto-download models from unauthenticated sources |
| Threat-intel feed connections | Feed poisoning or MITM if fetched over plain HTTP | TRD NFR-6 mandates TLS to a fixed allow-list of feed hosts |
| Firewall-rule creation capability | Abuse to create a denial-of-service against arbitrary hosts, or self-DoS via a bad rule | Require user confirmation for every block (App Flow §4); log every rule with actor and reason; provide an "undo/remove rule" control |
| Elevated privileges generally | Privilege misuse if any component has a memory-safety bug | Use Rust for privileged services specifically to reduce memory-safety CVE classes (buffer overflows, use-after-free) common in C/C++ security agents |

## 3. Privacy and Legal Boundaries

This is the most important section given the source concept's original scope, and it should be read alongside PRD §3.2.

- **No content inspection / no decryption of user traffic.** The Network Capture Service (TRD §4.3) is scoped to metadata only (5-tuple, byte counts, DNS names, TLS SNI). This avoids the legal and ethical issues of intercepting communications content, and matches what is achievable without a TLS-terminating proxy or endpoint agent on the other side.
- **No monitoring of devices the user does not own or administer**, beyond passive discovery of what's visible on the local broadcast domain (ARP/mDNS/SSDP) — which is standard, non-intrusive local network behavior also used by tools like nmap's ARP scan and standard OS network discovery features. Active port-scanning of other devices should be treated as a configurable, off-by-default feature with an explicit warning, since scanning devices you do not own or have permission to test may violate acceptable-use policies or law depending on jurisdiction and network ownership — this is a case-by-case legal question, not one this document can resolve for the user, and the team should seek institutional/legal guidance before enabling active scanning beyond a personal lab network.
- **No claim of visibility into other devices' installed applications or on-device activity.** As established in the PRD and TRD, this is not technically achievable from the network vantage point against modern encrypted traffic without controlling that device, and the product must not claim otherwise.
- **Data minimization:** only fields needed for detection/triage are stored (Database Schema Document §5); no packet payload retention.
- **User consent and transparency:** the onboarding flow (App Flow §2) requires explicit disclosure and consent before monitoring begins, and Settings exposes exactly which feeds/data sources are active.

## 4. Alignment with Recognized Standards

Rather than inventing bespoke terminology, Sentinel AI's alert and incident-handling model is aligned to existing, widely adopted frameworks:

- **MITRE ATT&CK** — a public, MITRE-maintained knowledge base of adversary tactics and techniques, each with a stable ID (e.g., T1566 for Phishing), used industry-wide to give analysts a shared vocabulary; it is also referenced in CISA best-practice guidance on ATT&CK mapping. Sentinel AI tags alerts with ATT&CK technique IDs (TRD FR-7.1) instead of inventing its own threat taxonomy from scratch.
- **NIST SP 800-61 Rev. 2, "Computer Security Incident Handling Guide"** — defines the incident-response lifecycle (Preparation; Detection & Analysis; Containment, Eradication & Recovery; Post-Incident Activity) used broadly across the industry and referenced by CISA/US-CERT-adjacent guidance. Sentinel AI's Incident Export (App Flow §7) is structured to map onto this lifecycle so its output is usable within an existing IR process rather than a proprietary format.
- **STIX-style indicator structuring** — where feasible, cached threat-intel indicators are stored in a way compatible with the type/value model used by STIX (Structured Threat Information Expression), a widely referenced format for describing indicators of compromise in NIST and community threat-intel-sharing guidance, even if the MVP does not implement full STIX/TAXII protocol support.

## 5. Secure Development Practices

- Dependency scanning for the Rust (`cargo audit`) and Python (`pip-audit`/`safety`) toolchains before each release.
- No hardcoded credentials or API keys in source; feed URLs are configuration, not embedded secrets, and any feed requiring an API key must be stored via OS-level credential storage (e.g., Windows Credential Manager), not plaintext config.
- Principle of least privilege internally: only the specific service needing elevated access (e.g., firewall-rule component) should hold that capability; UI process should not itself need to run with the same privilege where avoidable.
- All destructive actions require explicit user confirmation by default (echoing TRD NFR-3), reducing the blast radius of a UI bug or a spoofed alert triggering an unwanted termination/block.

## 6. Testing and Validation Boundaries

- Any malware-behavior testing must occur in an isolated, disposable virtual machine with no bridged access to production networks or the internet beyond what's required, consistent with standard malware-analysis lab hygiene.
- Where a "known bad" test artifact is needed to validate the detection pipeline without handling live malware, use the industry-standard **EICAR test file** — a file recognized by antivirus engines as a test signature, containing no actual malicious code — rather than real malware samples, for safe, repeatable pipeline testing.
- Do not download or possess real malware samples outside of a properly isolated, access-controlled research environment, and only if the team's institution/coursework explicitly supports and supervises such handling.

## 7. Disclosure to End Users

The application must ship with a plain-language disclosure covering:
1. What is monitored (processes, local network metadata, local devices, registry, files, USB).
2. What is explicitly **not** done (no traffic decryption, no visibility into other devices' apps, no replacement of OS antivirus, no data leaves the device except threat-intel feed lookups over TLS to disclosed hosts).
3. That it is a student/portfolio-grade tool, not a certified commercial security product, and should not be relied upon as sole protection for sensitive/production systems.

## 8. Open Items Requiring Further Review Before Any Expansion Beyond MVP

- Kernel-mode driver development (for deeper anti-tamper or full API-call interception) requires driver-signing enrollment and substantially more rigorous security review than user-mode ETW consumption.
- Any move toward active scanning of other devices, blocking at Layer 2 across a managed network, or multi-host/enterprise deployment requires separate legal and policy review (acceptable use, applicable computer-misuse and wiretap-style statutes vary by jurisdiction) before implementation — this document intentionally does not attempt to give legal advice and recommends consulting the institution's legal/compliance resources.
