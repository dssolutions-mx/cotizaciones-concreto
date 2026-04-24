#!/usr/bin/env python3
"""
EMA inventory CSV → schedule audit (dry-run by default).

Conservative matching: strong matches need serial OR (name + location + service type)
with corroboration; code-only matches are flagged for manual review.

When the inventario uses legacy codes ``DC-P01-02-01`` and the DB uses ``DC-02-01``,
``score_match`` also awards a **legacy_code** tier (exact mapped codigo + matching
``tipo_servicio``). Use ``--emit-legacy-inventory-sql`` to print a VALUES-based
``UPDATE`` for Supabase after you review the CSV.

Usage:
  python3 scripts/ema/audit_inventory_csv_schedule.py \\
    --csv "/path/to/DCEMA-...-INVENTARIO-VCM (1).csv" \\
    --instruments-json ./tmp/instruments.json \\
    [--mapping-json ./scripts/ema/code_mapping.example.json] \\
    [--apply-strong]   # only if you implement DB apply separately; default is dry-run

Export instruments JSON from Supabase (PostgREST), e.g.:
  select json_agg(t) from (
    select i.id, i.codigo, i.nombre, i.numero_serie, i.ubicacion_dentro_planta,
           i.fecha_proximo_evento, i.estado, i.plant_id,
           ch.codigo_conjunto, ch.nombre_conjunto, ch.categoria, ch.tipo_servicio
    from instrumentos i
    join conjuntos_herramientas ch on ch.id = i.conjunto_id
  ) t;
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable, Optional


def norm_text(s: str | None) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s


def norm_serial(s: str | None) -> str:
    if not s:
        return ""
    t = str(s).strip().upper()
    if t in ("", "N/A", "NA", "S/N", "SN", "-"):
        return ""
    if len(t) > 2 and t.endswith(".0") and re.fullmatch(r"[\d.]+", t):
        t = t[:-2]
    return t


def legacy_dc_codigo_to_db(csv_codigo: str | None) -> str:
    """Map inventario VCM codes like DC-P01-02-01 to DB codes DC-02-01."""
    if not csv_codigo:
        return ""
    c = csv_codigo.strip()
    m = re.match(r"^DC-P\d+-(.+)$", c, re.I)
    if m:
        return "DC-" + m.group(1)
    return c


def norm_code_hint(code: str | None) -> str:
    """Weak legacy hint: strip P01-style middle segment."""
    if not code:
        return ""
    c = norm_text(code).replace(" ", "")
    c = re.sub(r"-p\d+-", "-", c, flags=re.I)
    return c


def parse_service(cell: str | None) -> str:
    t = norm_text(cell or "")
    if "calib" in t:
        return "calibracion"
    if "verif" in t:
        return "verificacion"
    return "ninguno"


def parse_date_ymd(cell: str | None) -> Optional[str]:
    if not cell or not str(cell).strip():
        return None
    s = str(cell).strip().split("T")[0].split(",")[0].strip()
    up = s.upper()
    if up in ("N/A", "PENDIENTE", "-", ""):
        return None
    # m/d/yy (VCM inventario export)
    m_short = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2})$", s)
    if m_short:
        mo, d, y = int(m_short.group(1)), int(m_short.group(2)), int(m_short.group(3))
        y += 2000
        return f"{y:04d}-{mo:02d}-{d:02d}"
    # Slash + 4-digit year: if first group > 12, treat as d/m/y; else m/d/y (US)
    m_long = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m_long:
        a, b, y = int(m_long.group(1)), int(m_long.group(2)), int(m_long.group(3))
        if a > 12:
            d, mo = a, b
        elif b > 12:
            mo, d = a, b
        else:
            mo, d = a, b
        return f"{y:04d}-{mo:02d}-{d:02d}"
    # yyyy-mm-dd
    m_iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if m_iso:
        return s[:10]
    return None


@dataclass
class CsvRow:
    raw: dict[str, str]
    codigo_csv: str
    nombre: str
    descripcion: str
    ubicacion: str
    serial: str
    servicio: str
    fecha_vigente: Optional[str]
    proxima: Optional[str]


def read_csv(path: Path) -> list[CsvRow]:
    rows: list[CsvRow] = []
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f)
        fieldmap = {norm_text(k): k for k in reader.fieldnames or []}

        def col(*names: str) -> Optional[str]:
            for n in names:
                nk = norm_text(n)
                if nk in fieldmap:
                    return fieldmap[nk]
            return None

        c_codigo = col("codigo", "código", "clave")
        c_nombre = col("nombre")
        c_desc = col("descripcion", "descripción", "modelo")
        c_ubi = col("ubicacion", "ubicación", "planta", "ubicacion dentro de planta")
        c_serial = col("no. de serie", "no de serie", "numero de serie", "número de serie", "serie")
        c_serv = col("verificacion/calibracion", "verificación/calibración", "verificacion calibracion")
        c_fvig = col("fecha vigente verificación/calibración", "fecha vigente")
        c_prox = col("próxima verificación/calibración", "proxima verificación/calibración", "proxima")

        for raw in reader:
            def get(key: Optional[str]) -> str:
                if not key:
                    return ""
                return (raw.get(key) or "").strip()

            codigo = get(c_codigo)
            nombre = get(c_nombre)
            descripcion = get(c_desc)
            ubicacion = get(c_ubi)
            serial = get(c_serial)
            servicio = parse_service(get(c_serv))
            fv = parse_date_ymd(get(c_fvig))
            px = parse_date_ymd(get(c_prox))
            rows.append(
                CsvRow(
                    raw={k: v for k, v in raw.items()},
                    codigo_csv=codigo,
                    nombre=nombre,
                    descripcion=descripcion,
                    ubicacion=ubicacion,
                    serial=norm_serial(serial) and get(c_serial).strip() or "",
                    servicio=servicio,
                    fecha_vigente=fv,
                    proxima=px,
                )
            )
    return rows


@dataclass
class DbInstrument:
    id: str
    codigo: str
    nombre: str
    numero_serie: Optional[str]
    ubicacion_dentro_planta: Optional[str]
    fecha_proximo_evento: Optional[str]
    estado: str
    plant_id: str
    codigo_conjunto: str
    nombre_conjunto: str
    categoria: str
    tipo_servicio: Optional[str]


def load_db_instruments(path: Path) -> list[DbInstrument]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "instruments" in data:
        data = data["instruments"]
    out: list[DbInstrument] = []
    for row in data:
        out.append(
            DbInstrument(
                id=str(row["id"]),
                codigo=str(row.get("codigo") or ""),
                nombre=str(row.get("nombre") or ""),
                numero_serie=row.get("numero_serie"),
                ubicacion_dentro_planta=row.get("ubicacion_dentro_planta"),
                fecha_proximo_evento=row.get("fecha_proximo_evento"),
                estado=str(row.get("estado") or ""),
                plant_id=str(row.get("plant_id") or ""),
                codigo_conjunto=str(row.get("codigo_conjunto") or ""),
                nombre_conjunto=str(row.get("nombre_conjunto") or ""),
                categoria=str(row.get("categoria") or ""),
                tipo_servicio=row.get("tipo_servicio"),
            )
        )
    return out


def load_mapping(path: Path) -> dict[str, str]:
    """Explicit CSV code → DB instrument id (approved overrides)."""
    j = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(j, list):
        return {str(x["csv_code"]): str(x["instrumento_id"]) for x in j if "csv_code" in x and "instrumento_id" in x}
    return {str(k): str(v) for k, v in j.get("mappings", j).items()}


def score_match(csv_row: CsvRow, db: DbInstrument, mapping_id: Optional[str]) -> tuple[str, int, dict[str, Any]]:
    details: dict[str, Any] = {}
    if mapping_id and db.id == mapping_id:
        return "mapping", 1000, {"via": "explicit_mapping"}

    ldb = legacy_dc_codigo_to_db(csv_row.codigo_csv)
    if ldb and norm_text(ldb).replace(" ", "") == norm_text(db.codigo).replace(" ", ""):
        if csv_row.servicio != "ninguno" and (db.tipo_servicio or "ninguno") == csv_row.servicio:
            return "legacy_code", 480, {"mapped_codigo": ldb}

    s_csv = norm_serial(csv_row.serial)
    s_db = norm_serial(db.numero_serie)
    code_only = norm_code_hint(csv_row.codigo_csv) == norm_code_hint(db.codigo) and norm_code_hint(csv_row.codigo_csv)

    if s_csv and s_db and s_csv == s_db:
        if csv_row.servicio != "ninguno" and (db.tipo_servicio or "ninguno") == csv_row.servicio:
            return "strong", 500, {"serial": s_csv, "servicio": csv_row.servicio}
        return "medium", 350, {"serial": s_csv, "servicio_mismatch": (db.tipo_servicio, csv_row.servicio)}

    n_csv = norm_text(csv_row.nombre)
    n_db = norm_text(db.nombre)
    u_csv = norm_text(csv_row.ubicacion)
    u_db = norm_text(db.ubicacion_dentro_planta or "")
    name_match = n_csv and n_db and (n_csv in n_db or n_db in n_csv or n_csv == n_db)
    loc_match = u_csv and u_db and (u_csv in u_db or u_db in u_csv or u_csv == u_db)
    serv_match = csv_row.servicio != "ninguno" and (db.tipo_servicio or "ninguno") == csv_row.servicio

    if name_match and loc_match and serv_match:
        return "strong", 400, {"name": csv_row.nombre, "ubicacion": csv_row.ubicacion}

    d_csv = norm_text(csv_row.descripcion)
    d_db = norm_text(db.nombre + " " + (db.categoria or ""))
    if d_csv and len(d_csv) > 4 and d_csv in d_db and serv_match and loc_match:
        return "medium", 280, {"descripcion": csv_row.descripcion}

    if code_only:
        return "code_only", 50, {"csv_code": csv_row.codigo_csv, "db_codigo": db.codigo}

    return "none", 0, {}


def build_legacy_inventory_updates(csv_rows: Iterable[CsvRow]) -> list[tuple[str, str, str]]:
    """Deduped (db_codigo, tipo_servicio, fecha_ymd) from CSV for DC-P… → DC-… inventory."""
    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str, str]] = []
    for cr in csv_rows:
        if cr.servicio == "ninguno" or not cr.proxima:
            continue
        db_codigo = legacy_dc_codigo_to_db(cr.codigo_csv)
        if not re.match(r"^DC-", db_codigo, re.I):
            continue
        key = (db_codigo, cr.servicio)
        if key in seen:
            continue
        seen.add(key)
        out.append((db_codigo, cr.servicio, cr.proxima))
    return out


def emit_legacy_inventory_sql(rows: list[tuple[str, str, str]]) -> str:
    parts: list[str] = []
    for c, s, d in rows:
        esc = c.replace("'", "''")
        parts.append(f"    ('{esc}','{s}','{d}'::date)")
    vals = ",\n".join(parts)
    return (
        "UPDATE instrumentos AS i\n"
        "SET fecha_proximo_evento = v.fecha,\n"
        "    updated_at = now()\n"
        "FROM (\n  VALUES\n"
        f"{vals}\n"
        ") AS v(codigo, tipo_servicio, fecha),\n"
        "conjuntos_herramientas AS ch\n"
        "WHERE i.conjunto_id = ch.id\n"
        "  AND ch.tipo_servicio::text = v.tipo_servicio\n"
        "  AND i.codigo = v.codigo\n"
        "  AND i.estado <> 'inactivo';\n"
    )


def best_matches(csv_row: CsvRow, db_rows: Iterable[DbInstrument], mapping: dict[str, str]) -> list[tuple[DbInstrument, str, int, dict]]:
    mid = mapping.get(csv_row.codigo_csv) or mapping.get(norm_code_hint(csv_row.codigo_csv))
    ranked: list[tuple[DbInstrument, str, int, dict]] = []
    for db in db_rows:
        tier, sc, det = score_match(csv_row, db, mid)
        if sc > 0:
            ranked.append((db, tier, sc, det))
    ranked.sort(key=lambda x: -x[2])
    return ranked


def main() -> int:
    ap = argparse.ArgumentParser(description="EMA CSV schedule audit / dry-run matcher")
    ap.add_argument("--csv", required=True, type=Path)
    ap.add_argument("--instruments-json", type=Path, help="DB instruments JSON export")
    ap.add_argument("--mapping-json", type=Path, help="Optional explicit code→instrumento_id map")
    ap.add_argument("--out-json", type=Path, help="Write full report JSON")
    ap.add_argument(
        "--emit-legacy-inventory-sql",
        action="store_true",
        help="Print UPDATE … FROM VALUES for DC-P…→DC-… + próxima fecha (no DB JSON needed); review before running in SQL",
    )
    args = ap.parse_args()

    if args.emit_legacy_inventory_sql:
        csv_rows = read_csv(args.csv)
        legacy_rows = build_legacy_inventory_updates(csv_rows)
        sys.stdout.write(emit_legacy_inventory_sql(legacy_rows))
        print(
            f"-- legacy inventory pairs: {len(legacy_rows)} (deduped by codigo+tipo_servicio); "
            "then run SELECT ema_refresh_compliance_and_programa(NULL::uuid);",
            file=sys.stderr,
        )
        return 0

    if not args.instruments_json:
        ap.error("--instruments-json is required unless --emit-legacy-inventory-sql is set")

    csv_rows = read_csv(args.csv)
    db_rows: list[DbInstrument] = []
    if args.instruments_json:
        db_rows = load_db_instruments(args.instruments_json)
    mapping: dict[str, str] = {}
    if args.mapping_json:
        mapping = load_mapping(args.mapping_json)

    report: dict[str, Any] = {
        "csv_path": str(args.csv),
        "csv_row_count": len(csv_rows),
        "db_instrument_count": len(db_rows),
        "strong": [],
        "ambiguous": [],
        "code_only": [],
        "unmatched_csv": [],
        "proposed_updates": [],
    }

    used_db_ids: set[str] = set()

    for cr in csv_rows:
        if cr.servicio == "ninguno" and not cr.proxima and not cr.fecha_vigente:
            continue

        matches = best_matches(cr, db_rows, mapping)
        top = matches[:3]

        if not top or top[0][2] == 0:
            report["unmatched_csv"].append(asdict(cr))
            continue

        best, tier, sc, det = top[0]
        second_sc = top[1][2] if len(top) > 1 else 0

        if tier == "code_only":
            report["code_only"].append(
                {"csv": cr.codigo_csv, "candidates": [{"id": m[0].id, "codigo": m[0].codigo, "detail": m[3]} for m in top[:5]]}
            )
            continue

        if tier in ("strong", "mapping", "legacy_code") and second_sc > 0 and second_sc >= sc * 0.85 and top[1][0].id != best.id:
            report["ambiguous"].append(
                {
                    "csv_row": cr.codigo_csv,
                    "serial": cr.serial,
                    "nombre": cr.nombre,
                    "top": [{"id": m[0].id, "codigo": m[0].codigo, "tier": m[1], "score": m[2]} for m in top[:3]],
                }
            )
            continue

        if tier in ("strong", "mapping", "legacy_code"):
            if best.id in used_db_ids and mapping.get(cr.codigo_csv) != best.id:
                report["ambiguous"].append(
                    {"csv_row": cr.codigo_csv, "reason": "db_row_already_matched_elsewhere", "match_id": best.id}
                )
                continue
            used_db_ids.add(best.id)
            if cr.proxima and cr.proxima != (best.fecha_proximo_evento or ""):
                report["proposed_updates"].append(
                    {
                        "instrumento_id": best.id,
                        "db_codigo": best.codigo,
                        "from_fecha_proximo_evento": best.fecha_proximo_evento,
                        "to_fecha_proximo_evento": cr.proxima,
                        "csv_codigo": cr.codigo_csv,
                        "tier": tier,
                        "detail": det,
                    }
                )
            report["strong"].append(
                {"csv_codigo": cr.codigo_csv, "instrumento_id": best.id, "db_codigo": best.codigo, "tier": tier, "score": sc}
            )
        else:
            report["ambiguous"].append(
                {
                    "csv_row": cr.codigo_csv,
                    "reason": "weak_medium_only",
                    "best": {"id": best.id, "codigo": best.codigo, "tier": tier, "score": sc, "detail": det},
                }
            )

    print(json.dumps({k: v for k, v in report.items() if k != "strong"}, indent=2, ensure_ascii=False))
    print(f"\nSummary: strong_matches={len(report['strong'])} ambiguous={len(report['ambiguous'])} "
          f"code_only={len(report['code_only'])} unmatched_csv={len(report['unmatched_csv'])} "
          f"proposed_date_updates={len(report['proposed_updates'])}")

    if args.out_json:
        args.out_json.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote {args.out_json}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
