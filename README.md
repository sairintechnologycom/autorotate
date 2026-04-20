# EnvScan — Vercel Secret Rotation Utility (April 2026)

[![Vercel Security](https://img.shields.io/badge/Security-Vercel%20Breach%202026-orange)](https://vercel.com/security)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**EnvScan** is a priority security tool designed to identify and rotate exposed environment variables in Vercel projects following the April 2026 breach. It performs 100% client-side analysis to ensure your tokens remain on your machine.

---

## 🛡️ Why EnvScan?

The April 2026 Vercel incident compromised the encryption layer for environment variables. **Even secrets marked as "Sensitive" must be rotated.** 

EnvScan automates the discovery of these secrets across your entire Vercel account and provides context-aware rotation runbooks to help you secure your production infrastructure in minutes.

---

## 🔥 Key Features

- **Deep Scanning**: Identifies 30+ secret patterns (AWS, Stripe, GitHub, OpenAI, Supabase, etc.).
- **Actionable Runbooks**: Provides step-by-step checklists and console deep-links for rotation.
- **Privacy First**: 100% Client-Side. Your Vercel token and environment variables never leave your browser/CLI.
- **Dual Mode**: Choose between a high-fidelity Web Dashboard or a developer-friendly CLI.
- **Reporting**: Export findings to GitHub-flavored Markdown checklists or raw JSON.

---

## 🚀 CLI Mode — Quick Start

The fastest way to scan your account and generate a remediation checklist.

### 1. Prerequisites
- **Vercel Access Token**: [Create a read-only token](https://vercel.com/account/tokens).
- **Node.js**: Version 22+.

### 2. Run the Scan
From the root of this repository:

```bash
# Install dependencies
pnpm install

# Run the scan and save a checklist
npm run envscan -- --token <YOUR_TOKEN> --out ROTATION_CHECKLIST.md
```

### 3. CLI Options
- `--token`: Your Vercel access token (or interactive prompt).
- `--team`: (Optional) Filter by Vercel Team ID.
- `--out`: Path to save the Markdown rotation report.
- `--json`: Output as raw JSON risk data.

---

## 🌐 Web Dashboard

A premium, glassmorphism-inspired interface for interactive risk analysis.

```bash
cd packages/web
npm run dev
```
Open `http://localhost:5173` to start the visual audit.

---

## 📦 Monorepo Structure

- `packages/scanner-core`: The regex engine and risk classifier.
- `packages/adapter-vercel`: Vercel REST API integration layer.
- `packages/cli`: Terminal interface and Markdown generator.
- `packages/web`: React + Tailwind + Framer Motion dashboard.

---

## 🗝️ Common Search Terms
`Vercel Security`, `Secret Rotation`, `Environment Variable Exposure`, `Vercel Breach 2026`, `AWS Key Rotation`, `Supabase JWT Rotation`, `Security Audit Tool`.

---

## 📜 License
EnvScan is open-source software licensed under the [MIT License](LICENSE).
