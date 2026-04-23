"""
Backward-compatible entry point for February Plant 2 pumping migration.
Delegates to generate_plant2_pumping_migration.py with February defaults.

Run from repo root: python3 generate_february_migration.py
Requires: archive/data/february_orders.json (from scripts/fetch-february-orders.ts)
"""
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent
_DATA = _REPO_ROOT / 'archive' / 'data'

if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from generate_plant2_pumping_migration import main


if __name__ == '__main__':
    argv = sys.argv
    sys.argv = [
        'generate_plant2_pumping_migration.py',
        '--csv',
        str(_DATA / 'RELACION BOMBEO FEB.csv'),
        '--orders-json',
        str(_DATA / 'february_orders.json'),
        '--output-sql',
        str(_REPO_ROOT / 'supabase/migrations/20260203_february_pumping_remisiones_p2.sql'),
        '--title',
        'FEBRUARY 2026',
    ]
    try:
        main()
    finally:
        sys.argv = argv
