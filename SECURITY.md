# Security Policy — EnvScan

## Our Commitment to Privacy

EnvScan was built following the April 2026 Vercel incident with a "Local-Only" architecture. We believe that a tool designed to fix a security breach should never introduce a new risk.

### 1. No External Transmission
EnvScan executes entirely on your hardware. 
- **In CLI mode**: The application runs as a Node.js process. It communicates only with `api.vercel.com`.
- **In Web mode**: The application runs in your browser. All API calls are made directly from your browser to Vercel's endpoints. 

**No tokens, environment variables, or scan results are ever sent to a third-party server.**

### 2. Reporting a Vulnerability
If you discover a security vulnerability within EnvScan, please do not open a public Issue. Instead, email us at [security@sairintechnology.com](mailto:security@sairintechnology.com). We will acknowledge your report within 24 hours and keep you updated on our progress toward a fix.

### 3. Verification
We encourage security researchers to verify these claims by:
- Inspecting the network tab in the Web Dashboard.
- Auditing the `packages/adapter-vercel` and `packages/scanner-core` source code.
- Running the tool behind a local proxy (like Burp or Charles) to monitor outgoing traffic.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| v0.1.x  | ✅ YES             |
| < v0.1  | ❌ NO              |
