# Alalay

> Your financial companion. AI-powered bill management and budgeting, built for Filipinos.

![Build](https://img.shields.io/badge/build-TODO-lightgrey)
![Version](https://img.shields.io/badge/version-0.0.0-lightgrey)
![License](https://img.shields.io/badge/license-TBD-lightgrey)

## What Is Alalay?

Alalay is a Filipino-first personal finance app for tracking bills, subscriptions, expenses, and savings goals with a calm AI companion experience. The current workspace contains a Vite React web frontend and a small TypeScript Node backend; Supabase, Gemini, and mobile support are planned but not implemented yet.

## Features

- Landing page for the Alalay web experience
- Brand navigation, hero CTA, feature sections, and footer
- Backend health endpoint at `/health`
- TODO: bill tracking with recurring schedules and reminders
- TODO: subscription management and usage audits
- TODO: expense tracking with OCR receipt scanning
- TODO: savings goals with monthly target calculation
- TODO: AI financial assistant powered by Gemini 2.5 Flash
- TODO: offline-first mobile experience

## Tech Stack

| Area | Current | Planned / TODO |
| --- | --- | --- |
| Web | React 19, TypeScript, Vite, Tailwind CSS | Router, data fetching, forms, charts as needed |
| Backend | Node.js HTTP server, TypeScript, `tsx` | Supabase Edge Functions |
| Data | None yet | Supabase Postgres, Auth, Storage, RLS |
| AI | None yet | Gemini 2.5 Flash |
| Mobile | None yet | React Native, Expo, NativeWind, Expo Router, SQLite |

## Project Structure

```text
backend/   TypeScript Node server with /health
frontend/  Vite React web app
```

See [AGENT.md](./AGENT.md) for the full agent-facing structure map and planned monorepo layout.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup

Install and run each app from its folder:

```bash
cd frontend
npm install
npm run dev
```

```bash
cd backend
npm install
npm run dev
```

The frontend defaults to Vite's local dev URL, usually `http://localhost:5173`. The backend defaults to `http://localhost:3000`.

To run the backend over HTTPS, set these environment variables before starting it:

```bash
HTTPS_ENABLED=true
HTTPS_CERT_PATH=./certs/server-cert.pem
HTTPS_KEY_PATH=./certs/server-key.pem
```

When HTTPS is enabled, the backend will listen with a TLS certificate instead of plain HTTP. For local development, `supabase/config.toml` can also enable self-signed TLS for Supabase's API endpoints if you provide the certificate paths.

## Environment Variables

| Variable | Required? | Used By | Description |
| --- | --- | --- | --- |
| `PORT` | No | Backend | Server port. Defaults to `3000`. |
| `SUPABASE_URL` | TODO | Planned | Supabase project URL. |
| `SUPABASE_ANON_KEY` | TODO | Planned | Public Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | TODO | Planned | Server-only Supabase key. Never expose in client code. |
| `GEMINI_API_KEY` | TODO | Planned | Google AI Studio API key for Gemini. |

## Documentation

- [AGENT.md](./AGENT.md) - rules for AI coding agents working in this repo
- [SKILL.md](./SKILL.md) - Philippine biller and finance formatting reference
- `docs/database-schema.md` - TODO
- `docs/api-contracts.md` - TODO
- `docs/design-system.md` - TODO

## Roadmap

- v1.0: web app foundation, manual finance tracking, bill reminders, OCR-assisted expense capture
- v1.1: Gmail bill detection, improved Filipino language support, Cebuano exploration
- v1.2: family plan and shared household insights
- v2.0: Open Finance Philippines bank sync when viable

## Contributing

This project follows conventional commits. See [AGENT.md](./AGENT.md) for AI agent contribution rules.

## License

TBD. The backend package currently declares `ISC`; confirm the project-level license before publishing.
