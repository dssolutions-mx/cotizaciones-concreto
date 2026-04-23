"""
EMA Phase 2 — One-shot seed for the 6 verification templates from the lab Excel.
Generates: supabase/migrations/20260424130000_ema_seed_verification_templates.sql

Run: python3 scripts/ema/import_verification_templates.py
"""

import json
import uuid

# ── Deterministic UUID helper ─────────────────────────────────────────────────
NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # uuid.NAMESPACE_URL
def uid(key: str) -> str:
    return str(uuid.uuid5(NS, f"ema-seed-v1:{key}"))

# ── Conjunto IDs from production DB ──────────────────────────────────────────
CONJUNTO_IDS = {
    "flexometro":      "e4ce2f98-a6b2-4a5d-9a4f-8dcdab355070",  # 14 Flexómetro
    "balanza":         "60b07b47-5cc2-434e-87ce-1aeb07ee053e",  # 02 Balanza
    "molde_cubico":    "30c3d51c-565f-4eca-a64f-008e03a00367",  # 44 Molde cúbico
    "basculas":        uid("conjunto-basculas-piso"),            # NEW — created in seed
    "revenimiento":    "e5f13fe4-7206-4b3f-9c0b-b6c8b4119e45",  # 13 Equipo de revenimiento
    "recipiente_pv":   "74708b5e-34ab-4a78-b0ed-32dfb8ab5843",  # 35 Recipiente PV
}

# ─────────────────────────────────────────────────────────────────────────────
# Template definitions
# ─────────────────────────────────────────────────────────────────────────────

def medicion(punto, valor_esperado=None, tolerancia=None, tolerancia_tipo="absoluta",
             tolerancia_min=None, tolerancia_max=None, unidad=None,
             observacion_prompt=None, requerido=True):
    return dict(tipo="medicion", punto=punto, valor_esperado=valor_esperado,
                tolerancia=tolerancia, tolerancia_tipo=tolerancia_tipo,
                tolerancia_min=tolerancia_min, tolerancia_max=tolerancia_max,
                unidad=unidad, formula=None, observacion_prompt=observacion_prompt,
                requerido=requerido)

def booleano(punto, observacion_prompt=None, requerido=True):
    return dict(tipo="booleano", punto=punto, valor_esperado=None, tolerancia=None,
                tolerancia_tipo="absoluta", tolerancia_min=None, tolerancia_max=None,
                unidad=None, formula=None, observacion_prompt=observacion_prompt,
                requerido=requerido)

def numero(punto, unidad=None, observacion_prompt=None, requerido=True):
    return dict(tipo="numero", punto=punto, valor_esperado=None, tolerancia=None,
                tolerancia_tipo="absoluta", tolerancia_min=None, tolerancia_max=None,
                unidad=unidad, formula=None, observacion_prompt=observacion_prompt,
                requerido=requerido)

def calculado(punto, formula, unidad=None, observacion_prompt=None, requerido=True):
    return dict(tipo="calculado", punto=punto, valor_esperado=None, tolerancia=None,
                tolerancia_tipo="absoluta", tolerancia_min=None, tolerancia_max=None,
                unidad=unidad, formula=formula, observacion_prompt=observacion_prompt,
                requerido=requerido)

def referencia_equipo(punto="Equipo patrón utilizado", requerido=True):
    return dict(tipo="referencia_equipo", punto=punto, valor_esperado=None,
                tolerancia=None, tolerancia_tipo="absoluta", tolerancia_min=None,
                tolerancia_max=None, unidad=None, formula=None,
                observacion_prompt="Indicar código, número de serie y fecha de calibración vigente",
                requerido=requerido)

def texto(punto="Observaciones generales", requerido=False):
    return dict(tipo="texto", punto=punto, valor_esperado=None, tolerancia=None,
                tolerancia_tipo="absoluta", tolerancia_min=None, tolerancia_max=None,
                unidad=None, formula=None, observacion_prompt=None, requerido=requerido)

def section(titulo, items, orden=1, repetible=False, repeticiones_default=1,
            descripcion=None, evidencia_config=None):
    return dict(titulo=titulo, orden=orden, descripcion=descripcion,
                repetible=repetible, repeticiones_default=repeticiones_default,
                evidencia_config=evidencia_config or {},
                items=items)

LENGTHS_MM = [50, 55, 100, 105, 120, 125, 140, 145, 160, 165, 180, 185, 200, 205, 220]
BALANZA_GR = [0.1, 1, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
BASCULA_KG = [0.1, 0.5, 1, 10, 15, 20, 25, 30]

TEMPLATES = [
    # ── 1. Flexómetros ────────────────────────────────────────────────────────
    dict(
        id=uid("template-flexometros"),
        conjunto_key="flexometro",
        codigo="DC-LC-6.4-01",
        nombre="Verificación de flexómetros",
        norma_referencia=None,
        descripcion="Ficha de verificación de flexómetros del laboratorio de concreto. "
                    "Se verifican 15 longitudes de referencia mediante comparación con patrón.",
        sections=[
            section(
                titulo="Verificación de longitudes",
                orden=1,
                repetible=False,
                descripcion="Comparación de las lecturas del flexómetro contra longitudes patrón.",
                evidencia_config={"min_photos": 1, "labels": ["Foto del instrumento con patrón"]},
                items=[
                    medicion(f"{v} mm", valor_esperado=v, tolerancia=1,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Registrar lectura observada en el flexómetro")
                    for v in LENGTHS_MM
                ],
            ),
            section(
                titulo="Equipos utilizados para la verificación",
                orden=2,
                items=[referencia_equipo("Patrón de longitud calibrado (escuadra/regla patrón)")],
            ),
            section(
                titulo="Observaciones",
                orden=3,
                items=[texto()],
            ),
        ],
    ),

    # ── 2. Balanzas gramería ──────────────────────────────────────────────────
    dict(
        id=uid("template-balanzas"),
        conjunto_key="balanza",
        codigo="DC-LC-6.4-02",
        nombre="Verificación de balanzas (gramería)",
        norma_referencia=None,
        descripcion="Ficha de verificación para balanzas de gramería del laboratorio de concreto. "
                    "Se verifican 14 cargas de referencia (0.1 g – 1 000 g) por instrumento.",
        sections=[
            section(
                titulo="Verificación de cargas",
                orden=1,
                repetible=False,
                descripcion="Comparación de lecturas de la balanza contra masas patrón certificadas.",
                evidencia_config={"min_photos": 1, "labels": ["Foto de la balanza con pesas patrón"]},
                items=[
                    medicion(f"{v} gr", valor_esperado=v, tolerancia=None,
                             unidad="gr",
                             observacion_prompt="Registrar lectura mostrada por la balanza")
                    for v in BALANZA_GR
                ],
            ),
            section(titulo="Equipos utilizados para la verificación", orden=2,
                    items=[referencia_equipo("Juego de pesas patrón certificadas")]),
            section(titulo="Observaciones", orden=3, items=[texto()]),
        ],
    ),

    # ── 3. Moldes cúbicos 10×10 cm ───────────────────────────────────────────
    dict(
        id=uid("template-moldes-cubicos"),
        conjunto_key="molde_cubico",
        codigo="DC-LC-6.4-03",
        nombre="Verificación de moldes cúbicos 10×10 cm",
        norma_referencia="NMX-C-159-ONNCCE-2016",
        descripcion="Ficha de verificación para moldes de cubos de 10×10 cm según "
                    "NMX-C-159-ONNCCE-2016. Se verifican dimensiones y planicidad de las paredes.",
        sections=[
            section(
                titulo="Verificación dimensional del molde",
                orden=1,
                repetible=False,
                descripcion="Verificación de longitud de las paredes y planicidad según NMX-C-159.",
                evidencia_config={"min_photos": 1, "labels": ["Foto del molde con instrumento de medición"]},
                items=[
                    medicion("Longitud de las paredes", valor_esperado=100, tolerancia=1,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Medir cada pared; registrar el valor mayor desviación. Estándar: 10 cm ± 0.1 cm"),
                    medicion("Planicidad de las paredes", valor_esperado=0, tolerancia=0.05,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Usar calibrador de lainas. Estándar: desviación ≤ 0.05 mm"),
                    booleano("¿El molde cumple con los requisitos dimensionales?",
                             observacion_prompt="Indicar si el molde cumple todos los requisitos de NMX-C-159"),
                ],
            ),
            section(
                titulo="Fecha de calibración oficial",
                orden=2,
                items=[
                    texto("Fecha de última calibración oficial"),
                    texto("Fecha de próxima calibración oficial"),
                ],
            ),
            section(titulo="Equipos utilizados para la verificación", orden=3,
                    items=[referencia_equipo("Vernier / calibrador patrón"),
                           referencia_equipo("Juego de lainas patrón")]),
            section(titulo="Observaciones", orden=4, items=[texto()]),
        ],
    ),

    # ── 4. Básculas de piso ───────────────────────────────────────────────────
    dict(
        id=uid("template-basculas"),
        conjunto_key="basculas",
        codigo="DC-LC-6.4-04",
        nombre="Verificación de básculas de piso",
        norma_referencia=None,
        descripcion="Ficha de verificación para básculas de piso del laboratorio de concreto. "
                    "Se verifican 8 cargas de referencia (0.1 kg – 30 kg) por instrumento.",
        sections=[
            section(
                titulo="Verificación de cargas",
                orden=1,
                repetible=False,
                descripcion="Comparación de lecturas de la báscula contra masas patrón certificadas.",
                evidencia_config={"min_photos": 1, "labels": ["Foto de la báscula con pesas patrón"]},
                items=[
                    medicion(f"{v} kg", valor_esperado=v, tolerancia=None,
                             unidad="kg",
                             observacion_prompt="Registrar lectura mostrada por la báscula")
                    for v in BASCULA_KG
                ],
            ),
            section(titulo="Equipos utilizados para la verificación", orden=2,
                    items=[referencia_equipo("Juego de pesas patrón certificadas (clase kg)")]),
            section(titulo="Observaciones", orden=3, items=[texto()]),
        ],
    ),

    # ── 5. Equipo cono de revenimiento ────────────────────────────────────────
    dict(
        id=uid("template-cono-revenimiento"),
        conjunto_key="revenimiento",
        codigo="DC-LC-6.4-05",
        nombre="Verificación del equipo de cono de revenimiento",
        norma_referencia="NMX-C-159-ONNCCE-2016",
        descripcion="Ficha de verificación para el conjunto de equipo de revenimiento: "
                    "varillas de compactación (30 y 60 cm), enrasadores, mazo de goma y cono. "
                    "Según NMX-C-159-ONNCCE-2016.",
        sections=[
            section(
                titulo="Varillas de compactación 30 cm",
                orden=1,
                repetible=True,
                repeticiones_default=3,
                descripcion="Verificación dimensional de varillas de compactación Ø10 mm × 300 mm.",
                evidencia_config={"min_photos": 0},
                items=[
                    medicion("Diámetro de la varilla", valor_esperado=10, tolerancia=1,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Estándar: 10 mm ± 1 mm"),
                    medicion("Longitud de la varilla", valor_esperado=300, tolerancia=15,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Estándar: 300 mm ± 15 mm"),
                    booleano("¿Cumple la varilla?"),
                ],
            ),
            section(
                titulo="Varillas de compactación 60 cm",
                orden=2,
                repetible=True,
                repeticiones_default=3,
                descripcion="Verificación dimensional de varillas de compactación Ø16 mm × 600 mm.",
                evidencia_config={"min_photos": 0},
                items=[
                    medicion("Diámetro de la varilla", valor_esperado=16, tolerancia=1.5,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Estándar: 16 mm ± 1.5 mm"),
                    medicion("Longitud de la varilla", valor_esperado=600, tolerancia=30,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Estándar: 600 mm ± 30 mm"),
                    booleano("¿Cumple la varilla?"),
                ],
            ),
            section(
                titulo="Enrasador",
                orden=3,
                repetible=True,
                repeticiones_default=2,
                descripcion="Verificación del enrasador: longitud mínima 200 mm.",
                items=[
                    medicion("Longitud del enrasador", valor_esperado=None,
                             tolerancia_tipo="rango", tolerancia_min=200,
                             tolerancia_max=None, unidad="mm",
                             observacion_prompt="Estándar: largo mínimo 200 mm"),
                    booleano("¿Cumple el enrasador?"),
                ],
            ),
            section(
                titulo="Mazo de goma",
                orden=4,
                repetible=True,
                repeticiones_default=2,
                descripcion="Verificación del mazo de goma: peso 600 g ± 200 g.",
                items=[
                    medicion("Peso del mazo", valor_esperado=600, tolerancia=200,
                             tolerancia_tipo="absoluta", unidad="gr",
                             observacion_prompt="Estándar: 600 gr ± 200 gr"),
                    booleano("¿Cumple el mazo?"),
                ],
            ),
            section(
                titulo="Cono de revenimiento",
                orden=5,
                repetible=True,
                repeticiones_default=2,
                descripcion="Verificación dimensional del cono: altura 30 cm, Ø sup 100 mm ± 3 mm, Ø inf 200 mm ± 3 mm.",
                evidencia_config={"min_photos": 1, "labels": ["Foto del cono con mediciones"]},
                items=[
                    medicion("Altura del cono", valor_esperado=300, tolerancia=3,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Estándar: 300 mm (NMX-C-159)"),
                    medicion("Diámetro menor (base superior)", valor_esperado=100, tolerancia=3,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Estándar: 100 mm ± 3 mm"),
                    medicion("Diámetro mayor (base inferior)", valor_esperado=200, tolerancia=3,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Estándar: 200 mm ± 3 mm"),
                    booleano("¿Cumple el cono?"),
                ],
            ),
            section(titulo="Equipos utilizados para la verificación", orden=6,
                    items=[referencia_equipo("Flexómetro / vernier patrón"),
                           referencia_equipo("Balanza patrón (para mazo)")]),
            section(titulo="Observaciones", orden=7, items=[texto()]),
        ],
    ),

    # ── 6. Olla masa unitaria (Recipiente PV) ────────────────────────────────
    dict(
        id=uid("template-olla-masa-unitaria"),
        conjunto_key="recipiente_pv",
        codigo="DC-LC-6.4-06",
        nombre="Verificación del recipiente para masa unitaria (PV)",
        norma_referencia="NMX-C-162-ONNCCE-2014",
        descripcion="Ficha de verificación para recipiente de determinación de masa unitaria "
                    "y placa enrasadora. Según NMX-C-162-ONNCCE-2014.",
        sections=[
            section(
                titulo="Verificación del recipiente",
                orden=1,
                repetible=False,
                descripcion="Verificación dimensional y de planicidad del borde superior del recipiente PV.",
                evidencia_config={"min_photos": 1, "labels": ["Foto del recipiente con mediciones"]},
                items=[
                    medicion("Diámetro d1", unidad="mm",
                             observacion_prompt="Medir diámetro interior en posición 1"),
                    medicion("Diámetro d2", unidad="mm",
                             observacion_prompt="Medir diámetro interior en posición 2 (perpendicular a d1)"),
                    medicion("Altura h1", unidad="mm",
                             observacion_prompt="Medir altura interior en posición 1"),
                    medicion("Altura h2", unidad="mm",
                             observacion_prompt="Medir altura interior en posición 2"),
                    medicion("Altura h3", unidad="mm",
                             observacion_prompt="Medir altura interior en posición 3"),
                    medicion("Planicidad del borde superior", valor_esperado=0, tolerancia=0.5,
                             tolerancia_tipo="absoluta", unidad="mm",
                             observacion_prompt="Estándar: no mayor a 0.5 mm"),
                    numero("Tara del recipiente (kg)", unidad="kg"),
                    numero("Factor del recipiente (1/m³)", unidad="1/m³"),
                    numero("Capacidad real del recipiente (l)", unidad="l"),
                    numero("Capacidad requerida — Vol. Nom ± 5% (l)", unidad="l"),
                    booleano("¿El recipiente cumple?"),
                ],
            ),
            section(
                titulo="Verificación de la placa enrasadora",
                orden=2,
                repetible=False,
                descripcion="Verificación dimensional de la placa enrasadora según NMX-C-162.",
                items=[
                    medicion("Longitud l1", unidad="mm", observacion_prompt="Medir longitud en posición 1"),
                    medicion("Longitud l2", unidad="mm", observacion_prompt="Medir longitud en posición 2"),
                    medicion("Longitud l3", unidad="mm", observacion_prompt="Medir longitud en posición 3"),
                    medicion("Longitud l4", unidad="mm", observacion_prompt="Medir longitud en posición 4"),
                    medicion("Espesor e1", unidad="mm", observacion_prompt="Medir espesor en posición 1 (mín. 6 mm si acero)"),
                    medicion("Espesor e2", unidad="mm", observacion_prompt="Medir espesor en posición 2"),
                    medicion("Espesor e3", unidad="mm", observacion_prompt="Medir espesor en posición 3"),
                    medicion("Espesor e4", unidad="mm", observacion_prompt="Medir espesor en posición 4"),
                    booleano("Planicidad (C / NC)", observacion_prompt="C = cumple, NC = no cumple"),
                    booleano("Cantos rectos y lisos (C / NC)",
                             observacion_prompt="Tolerancia ± 2 mm. C = cumple, NC = no cumple"),
                    booleano("¿La placa enrasadora cumple?"),
                ],
            ),
            section(
                titulo="Determinación del factor y volumen del recipiente",
                orden=3,
                descripcion="Cálculo del factor de calibración y volumen real según NMX-C-162.",
                items=[
                    numero("Masa del recipiente / tara (kg)", unidad="kg"),
                    numero("Masa de la placa (kg)", unidad="kg"),
                    numero("Masa del recipiente con agua y placa (kg)", unidad="kg"),
                    calculado("Masa del agua (kg)", unidad="kg",
                              formula="masa_recipiente_agua_placa - masa_recipiente - masa_placa",
                              observacion_prompt="Calculado automáticamente"),
                    numero("Temperatura del agua (°C)", unidad="°C"),
                    numero("Masa volumétrica del agua (kg/ml)", unidad="kg/ml"),
                    calculado("Factor (1/m³)", unidad="1/m³",
                              formula="1 / (masa_agua / masa_volumetrica_agua)",
                              observacion_prompt="Calculado automáticamente"),
                    calculado("Volumen real (l)", unidad="l",
                              formula="(masa_agua / masa_volumetrica_agua) * 1000",
                              observacion_prompt="Calculado automáticamente"),
                ],
            ),
            section(titulo="Equipos utilizados para la verificación", orden=4,
                    items=[referencia_equipo("Balanza patrón / báscula patrón"),
                           referencia_equipo("Vernier / calibrador patrón")]),
            section(titulo="Observaciones", orden=5, items=[texto()]),
        ],
    ),
]

# ─────────────────────────────────────────────────────────────────────────────
# SQL generator
# ─────────────────────────────────────────────────────────────────────────────

def sq(v):
    """Escape string for SQL single-quote."""
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def sqn(v):
    """Numeric or NULL."""
    if v is None:
        return "NULL"
    return str(v)

def sqb(v):
    """Boolean or NULL."""
    if v is None:
        return "NULL"
    return "true" if v else "false"

def sqj(v):
    """JSONB value."""
    return sq(json.dumps(v, ensure_ascii=False))


def build_snapshot(t, sections_with_ids):
    """Build the full JSONB snapshot for a template version."""
    return {
        "template": {
            "id": t["id"],
            "codigo": t["codigo"],
            "nombre": t["nombre"],
            "norma_referencia": t["norma_referencia"],
            "descripcion": t["descripcion"],
        },
        "sections": [
            {
                "id": s["_id"],
                "orden": s["orden"],
                "titulo": s["titulo"],
                "descripcion": s.get("descripcion"),
                "repetible": s["repetible"],
                "repeticiones_default": s["repeticiones_default"],
                "evidencia_config": s["evidencia_config"],
                "items": [
                    {
                        "id": item["_id"],
                        "orden": item["_orden"],
                        "tipo": item["tipo"],
                        "punto": item["punto"],
                        "valor_esperado": item["valor_esperado"],
                        "tolerancia": item["tolerancia"],
                        "tolerancia_tipo": item["tolerancia_tipo"],
                        "tolerancia_min": item["tolerancia_min"],
                        "tolerancia_max": item["tolerancia_max"],
                        "unidad": item["unidad"],
                        "formula": item["formula"],
                        "requerido": item["requerido"],
                        "observacion_prompt": item["observacion_prompt"],
                    }
                    for item in s["_items"]
                ],
            }
            for s in sections_with_ids
        ],
    }


def generate_sql() -> str:
    lines = [
        "-- =====================================================================",
        "-- EMA Phase 2: Seed — 6 verification templates from lab Excel",
        "-- Deterministic UUIDs; idempotent via ON CONFLICT DO NOTHING.",
        "-- =====================================================================",
        "",
        "BEGIN;",
        "",
        "-- 0. Create 'Báscula de piso' conjunto (código 03, not yet in prod) ----",
        f"INSERT INTO conjuntos_herramientas (id, nombre_conjunto, categoria, codigo_conjunto, tipo_servicio, is_active)",
        f"VALUES (",
        f"  {sq(CONJUNTO_IDS['basculas'])},",
        f"  'Báscula de piso',",
        f"  'Báscula de piso',",
        f"  '03',",
        f"  'calibracion_externa',",
        f"  true",
        f")",
        f"ON CONFLICT (id) DO NOTHING;",
        "",
    ]

    for t in TEMPLATES:
        t_id = t["id"]
        conjunto_id = CONJUNTO_IDS[t["conjunto_key"]]
        v_id = uid(f"version-1-{t['codigo']}")

        # Assign IDs to sections and items
        sections_with_ids = []
        for s in t["sections"]:
            s_id = uid(f"section-{t['codigo']}-{s['orden']}")
            items_with_ids = []
            for idx, item in enumerate(s["items"], start=1):
                item_id = uid(f"item-{t['codigo']}-{s['orden']}-{idx}")
                items_with_ids.append({**item, "_id": item_id, "_orden": idx})
            sections_with_ids.append({**s, "_id": s_id, "_items": items_with_ids})

        snapshot = build_snapshot(t, sections_with_ids)

        lines += [
            f"-- ── {t['codigo']} — {t['nombre']} ────────────────────────────",
            "",
            "-- template header",
            f"INSERT INTO verificacion_templates",
            f"  (id, conjunto_id, codigo, nombre, norma_referencia, descripcion, estado)",
            f"VALUES (",
            f"  {sq(t_id)},",
            f"  {sq(conjunto_id)},",
            f"  {sq(t['codigo'])},",
            f"  {sq(t['nombre'])},",
            f"  {sq(t['norma_referencia'])},",
            f"  {sq(t['descripcion'])},",
            f"  'publicado'",
            f")",
            f"ON CONFLICT (id) DO NOTHING;",
            "",
        ]

        # Sections
        for s in sections_with_ids:
            lines += [
                f"INSERT INTO verificacion_template_sections",
                f"  (id, template_id, orden, titulo, descripcion, repetible, repeticiones_default, evidencia_config)",
                f"VALUES (",
                f"  {sq(s['_id'])},",
                f"  {sq(t_id)},",
                f"  {sqn(s['orden'])},",
                f"  {sq(s['titulo'])},",
                f"  {sq(s.get('descripcion'))},",
                f"  {sqb(s['repetible'])},",
                f"  {sqn(s['repeticiones_default'])},",
                f"  {sqj(s['evidencia_config'])}",
                f")",
                f"ON CONFLICT (id) DO NOTHING;",
                "",
            ]
            # Items
            for item in s["_items"]:
                lines += [
                    f"INSERT INTO verificacion_template_items",
                    f"  (id, section_id, orden, tipo, punto, valor_esperado, tolerancia,",
                    f"   tolerancia_tipo, tolerancia_min, tolerancia_max, unidad,",
                    f"   formula, requerido, observacion_prompt)",
                    f"VALUES (",
                    f"  {sq(item['_id'])},",
                    f"  {sq(s['_id'])},",
                    f"  {sqn(item['_orden'])},",
                    f"  {sq(item['tipo'])},",
                    f"  {sq(item['punto'])},",
                    f"  {sqn(item['valor_esperado'])},",
                    f"  {sqn(item['tolerancia'])},",
                    f"  {sq(item['tolerancia_tipo'])},",
                    f"  {sqn(item['tolerancia_min'])},",
                    f"  {sqn(item['tolerancia_max'])},",
                    f"  {sq(item['unidad'])},",
                    f"  {sq(item['formula'])},",
                    f"  {sqb(item['requerido'])},",
                    f"  {sq(item['observacion_prompt'])}",
                    f")",
                    f"ON CONFLICT (id) DO NOTHING;",
                    "",
                ]

        # Version snapshot
        lines += [
            "-- version snapshot (v1)",
            f"INSERT INTO verificacion_template_versions",
            f"  (id, template_id, version_number, snapshot)",
            f"VALUES (",
            f"  {sq(v_id)},",
            f"  {sq(t_id)},",
            f"  1,",
            f"  {sqj(snapshot)}",
            f")",
            f"ON CONFLICT (id) DO NOTHING;",
            "",
            "-- point active_version_id",
            f"UPDATE verificacion_templates",
            f"  SET active_version_id = {sq(v_id)}",
            f"  WHERE id = {sq(t_id)};",
            "",
        ]

    lines += ["COMMIT;", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    import os
    out = os.path.join(
        os.path.dirname(__file__),
        "../../supabase/migrations/20260424130000_ema_seed_verification_templates.sql",
    )
    sql = generate_sql()
    with open(out, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"Written: {out}")
    print(f"Lines: {sql.count(chr(10))}")
