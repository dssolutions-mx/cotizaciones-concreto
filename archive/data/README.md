# Archived data files

CSV and JSON files in this directory are **not** used by the Next.js runtime. They support **one-off migrations**, **data dumps**, or **local scripts** (for example the `generate_*_migration.py` helpers at the repo root).

When fetch scripts write new snapshots, they save here (for example `march_orders.json`, `february_orders.json`) so the repository root stays clean.

Do not commit secrets or production customer data; prefer redacted samples.
