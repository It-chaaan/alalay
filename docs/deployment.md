# Deployment workflow

This repository deliberately contains validation and reusable backend artifacts,
not provider-specific deployment credentials or automatic production deployment.

## Ownership placeholders

| System          | Release owner must maintain                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Vercel frontend | Project linkage, preview/production `VITE_*` values, preview policy, and production approval                                   |
| Backend host    | Container registry/runtime or Node runtime, server-only variables, HTTPS termination, health checks, logs, and rollback target |
| Supabase        | Project access, backups, migration history, Auth redirect URLs, and migration approval                                         |
| Scheduler       | One durable trigger for each documented job, the scheduler secret, alerting, and execution records                             |
| EAS             | Preview/production public values, Android signing ownership, artifact review, and distribution                                 |

## Render backend settings

Use a **Web Service** with the **Native Runtime / Node** runtime. Render commands
are relative to the configured root directory, so set **Root Directory** to
`backend`, **Build Command** to `npm ci --include=dev && npm run build`, and
**Start Command** to `npm start`. Set the health-check path to `/health` and pin
Node to `24.19.0`. Do not set `PORT`; Render injects it and the server binds to
it automatically.

Set `NODE_ENV=production`, `HTTPS_ENABLED=true`,
`HTTPS_TERMINATE_LOCALLY=false`, `NOTIFICATION_SCHEDULER_ENABLED=true`, and
`IN_PROCESS_SCHEDULERS_ENABLED=false`. Add values for `APP_URL`, `CORS_ORIGIN`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`INCOME_SCHEDULER_SECRET` in Render's environment/secret settings. Add Gemini
and Resend variables only if those features are enabled. Do not commit or upload
an env file.

Native Runtime is recommended over Docker for Render because `backend` can be
the service root and all commands are self-contained. The Dockerfile remains a
portable alternative, but it must be built with the repository root as its
context and `backend/Dockerfile` as its Dockerfile path; setting `backend` as
both Docker root and context would make its `COPY backend/...` instructions fail.

The root `render.yaml` is a safe Blueprint for creating a new service named
`alalay-backend`. It does not update an existing Render service until an operator
explicitly syncs it. Existing services should be corrected in the dashboard with
the settings above.

## Staging and production procedure

1. Merge only a reviewed pull request whose quality, database, and secret-scan
   checks have passed. Production approval must be a protected environment action
   in the chosen hosting platform or a future provider-neutral release workflow.
2. Build the frontend and backend from the exact release commit. For backend
   container releases, use `docker build -f backend/Dockerfile -t alalay-backend .`.
3. Before any remote schema change, review `supabase migration list` and
   `supabase db diff --linked`, confirm the migration order/checksums, and verify
   a tested, recoverable backup. Do not run `supabase db push` until these checks
   and production approval are complete.
4. Apply approved migrations before backend code that depends on them. If the
   release fails, stop further rollout; restore from the verified backup or use a
   reviewed forward-fix migration. Do not delete or rewrite migration history.
5. Deploy the frontend with only public `VITE_*` values. Deploy backend compiled
   output or the container with server-only values supplied by the hosting secret
   store. Confirm HTTPS, `APP_URL`, allowed `CORS_ORIGIN` values, and `GET /health`.
6. Build and review the EAS preview/production artifact using its matching EAS
   environment. Never place server-only values in `EXPO_PUBLIC_*` variables.
7. After application and database health checks pass, verify exactly one durable
   scheduler can call income, billing, and notification jobs with the configured
   private header. Check job logs and idempotent outcomes.

## Future automation

A future workflow-dispatch deployment job may be added only after the release
owner defines the backend host, GitHub environment names, approval rules, rollback
mechanism, and required secret names. It must not infer a hosting provider or
connect to the hosted Supabase project from CI.
