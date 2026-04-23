# Archived data files

CSV and JSON files in this directory are **not** used by the Next.js runtime. They support **one-off migrations**, **data dumps**, or **local scripts** (for example under `scripts/migrations/`).

When fetch scripts write new snapshots, they save here (for example `march_orders.json`, `february_orders.json`) so the repository root stays clean.

Do not commit secrets or production customer data; prefer redacted samples.
