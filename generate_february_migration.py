"""
Backward-compatible entry point for February Plant 2 pumping migration.
Delegates to generate_plant2_pumping_migration.py with February defaults.

Run: python3 generate_february_migration.py
Requires: february_orders.json (from scripts/fetch-february-orders.ts)
"""
import sys

from generate_plant2_pumping_migration import main


if __name__ == '__main__':
    argv = sys.argv
    sys.argv = [
        'generate_plant2_pumping_migration.py',
        '--csv',
        'RELACION BOMBEO FEB.csv',
        '--orders-json',
        'february_orders.json',
        '--output-sql',
        'supabase/migrations/20260203_february_pumping_remisiones_p2.sql',
        '--title',
        'FEBRUARY 2026',
    ]
    try:
        main()
    finally:
        sys.argv = argv
