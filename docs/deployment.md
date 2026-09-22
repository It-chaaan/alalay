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
