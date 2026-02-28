# DC Concretos – Price List System: Deep-Dive Technical Documentation

**File:** MATRIX Y LISTA DE PRECIOS ENERO. OFICIAL. .xlsx
**Company:** DC Concretos Silao, Guanajuato, México
**Period:** January 2026 (updated February 9, 2026)
**Analyst prepared:** February 26, 2026

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [The Three-Layer Pricing Model](#2-the-three-layer-pricing-model)
3. [Layer 1 — Engineering / Recipe Matrix](#3-layer-1--engineering--recipe-matrix)
4. [Layer 2 — Executive Price Lists](#4-layer-2--executive-price-lists)
5. [Layer 3 — Market Segmentation Lists](#5-layer-3--market-segmentation-lists)
6. [Supporting Reference Sheets](#6-supporting-reference-sheets)
7. [Product Taxonomy & Coding System](#7-product-taxonomy--coding-system)
8. [Price Table: Complete Reference](#8-price-table-complete-reference)
9. [Additional Services & Surcharges](#9-additional-services--surcharges)
10. [Margin & Cost Analysis](#10-margin--cost-analysis)
11. [Approval Governance & the Quote Flow](#11-approval-governance--the-quote-flow)
12. [Key Design Parameters & Material Inputs](#12-key-design-parameters--material-inputs)
13. [Cement Supplier Benchmarking](#13-cement-supplier-benchmarking)
14. [System Limitations & Observations](#14-system-limitations--observations)

---

## 1. System Overview & Architecture

The workbook is the operational pricing engine for DC Concretos, a ready-mix concrete producer operating from **Planta 1, Silao, Guanajuato**. Its delivery radius is defined as up to **40 km from the plant** as the standard coverage zone, with graduated distance surcharges for 41–140 km.

The workbook contains **13 worksheets** organized into three functional layers and two reference/benchmark sections:

| # | Sheet Name | Role | Layer |
|---|-----------|------|-------|
| 1 | LISTA PRECIOS (UNITARIOS) | Official executive-set unit price list | Layer 2 |
| 2 | LISTA PRECIOS (EFECTIVO) | Cash-payment customer price list | Layer 3 |
| 3 | LISTA PRECIOS (EMPLEADOS) | Employee price list | Layer 3 |
| 4 | AC | Aggregate & cement performance benchmarks | Reference |
| 5 | CONSUMOS CEMENTO | Cement consumption comparison by grade | Reference |
| 6 | FC28 DIAS HOLCIM | Mix design matrix, F'c concrete, 28-day, Holcim cement | Layer 1 |
| 7 | FC14 DIAS HOLCIM | Mix design matrix, F'c concrete, 14-day, Holcim cement | Layer 1 |
| 8 | FC7 DIAS HOLCIM | Mix design matrix, F'c concrete, 7-day, Holcim cement | Layer 1 |
| 9 | FC3 DIAS HOLCIM | Mix design matrix, F'c concrete, 3-day, Holcim cement | Layer 1 |
| 10 | MR28 DIAS HOLCIM | Mix design matrix, MR concrete, 28-day, Holcim cement | Layer 1 |
| 11 | MR14 DIAS HOLCIM | Mix design matrix, MR concrete, 14-day, Holcim cement | Layer 1 |
| 12 | MR7 DIAS HOLCIM | Mix design matrix, MR concrete, 7-day, Holcim cement | Layer 1 |
| 13 | MR3 DIAS HOLCIM | Mix design matrix, MR concrete, 3-day, Holcim cement | Layer 1 |

The workbook is labeled **MATRIX 1.0** and was last updated **February 9, 2026**.

---

## 2. The Three-Layer Pricing Model

The system implements a deliberately structured three-layer hierarchy. Each layer builds on the one below it, with different actors controlling each level.

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — SALES QUOTE                                               │
│  Actor: Sales agent                                                  │
│  Tool:  LISTA PRECIOS (EFECTIVO) or (EMPLEADOS)                     │
│  Rule:  Quote ≥ List Price → self-approved                          │
│         Quote < List Price → REQUIRES EXECUTIVE APPROVAL            │
├──────────────────────────────────────────────────────────────────────┤
│  LAYER 2 — EXECUTIVE LIST PRICE                                      │
│  Actor: Executive / management                                       │
│  Tool:  LISTA PRECIOS (UNITARIOS)                                   │
│  Logic: Recipe cost from Layer 1 + target gross margin              │
│  Result: Official selling price per SKU per m³                      │
├──────────────────────────────────────────────────────────────────────┤
│  LAYER 1 — RECIPE / MIX DESIGN MATRIX                               │
│  Actor: Engineering / plant management                               │
│  Tool:  FC and MR matrix sheets (8 sheets)                          │
│  Logic: Material quantities × material unit costs + operating cost  │
│  Result: Recipe cost per m³ for every concrete specification        │
└──────────────────────────────────────────────────────────────────────┘
```

**The governance intent is clear:** the recipe matrix anchors costs in physical reality (kilograms of cement, liters of aggregate, dosages of admixtures). The executive layer adds a deliberate margin and publishes a list price. Sales agents must use those list prices as their floor; going below requires approval. This prevents margin erosion without eliminating commercial flexibility.

---

## 3. Layer 1 — Engineering / Recipe Matrix

### 3.1 What the Matrix Sheets Are

There are **8 matrix sheets**, divided by two concrete specification families and four curing age guarantees:

- **F'c family (FC):** Compressive strength concrete (used for structural elements, slabs, columns, foundations). Strength measured in kg/cm².
- **MR family (MR):** Modulus of Rupture concrete (used for road pavements and industrial floors). Strength measured in kg/cm².
- **Ages:** 28-day (standard), 14-day (accelerated), 7-day (fast), 3-day (very fast / emergency).

All 8 matrix sheets share the same architecture — they are versions of the same calculation engine parameterized for different cement dosage curves.

### 3.2 Matrix Sheet Architecture

Each matrix sheet is labeled **MATRIX 1.0** and is structured in two main areas:

**Area A — Material Inputs (left side, rows 4–28):** All raw material properties and unit costs that feed the recipes. These are the "assumption inputs" that, when updated, cascade to recalculate every product's cost.

**Area B — Product Design Rows (columns K–BH/BN, rows 13 onwards):** One row per concrete product specification. Each row contains the full mix design calculation and resulting unit cost.

### 3.3 Material Input Parameters (per the FC28 sheet)

These values are hardcoded inputs (editable by engineering). Any change here flows automatically to all recipe costs.

| Material | Unit Cost | Property |
|----------|-----------|----------|
| Cemento HOLCIM | $3.20 /kg | Density: 3.1 g/cm³ |
| Agua (pozo) | $0.02 /L | — |
| Grava 20mm AGREMEX & AGRESA | $0.24698 /L | Density: 2.67 g/cm³, Absorption: 1.0% |
| Grava 40mm AGREMEX | $0.22684 /L (MR only) | Density: 2.70 g/cm³, Absorption: 1.4% |
| Arena Triturada AGRESA | $0.23532 /L | Density: 2.63 g/cm³, Absorption: 3.1% |
| Arena Mina Montoya | $0.33920 /L | Density: 2.22 g/cm³, Absorption: 8.7% |
| Aditivo Línea Mapei | $17.702 /L | Density: 1.1 g/cm³, dose: 0.8% by cement weight |
| Aditivo PCE Mapei | $72.345 /L | Density: 1.1 g/cm³, dose: 0.2% by cement weight |
| **Costo de Operación** | **$450 /m³** | Transport + Variable + Fixed costs @ 2,000 m³/month volume |

The operating cost of **$450 per m³** is especially notable — it is a fully loaded overhead rate covering plant operations, truck transport, and fixed costs, calibrated at a volume assumption of 2,000 m³ per month. This rate will change if volumes deviate significantly from that assumption.

### 3.4 Sand Blend Ratios

Two sand sources are blended to optimize workability and cost. The blend ratios differ by placement method:

| Placement Method | Basaltic Sand % | Volcanic Sand % |
|-----------------|-----------------|-----------------|
| Tiro Directo (TD) | 80% | 20% |
| Bombeado (Pump) | 70% | 30% |

For MR (pavement) concrete, the TD blend uses 75% basaltic / 25% volcanic, and the pump blend 70% / 30%.

### 3.5 The Mix Design Calculation Engine

Each product row runs a full absolute volume method mix design. The columns computed for every product are:

1. **f'c** — Specified compressive (or flexural) strength in kg/cm²
2. **Edad** — Curing age at which f'c must be achieved (3, 7, 14, or 28 days)
3. **Colocación** — Placement method: D (Directo/Direct) or B (Bombeado/Pump)
4. **T.M.A.** — Maximum aggregate size (20mm for FC, 20mm + 40mm for MR)
5. **REV** — Slump/revenimiento in cm (8, 10, 12, 14, or 18 cm)
6. **f'cr** — Required design strength (f'c + safety margin, calculated from cement type deviation; the deviation factor is −0.084 for standard designs)
7. **A/C** — Water-to-cement ratio (derived from strength-age curve regression)
8. **Agua** — Water content in liters per m³ (ranges 195–215 L/m³ for FC; 195–210 L/m³ for MR)
9. **Cemento** — Cement content in kg/m³ (ranges 155–355 kg/m³ for FC; 285–380+ kg/m³ for MR)
10. **Aire** — Air content in liters per m³ (10–15 L)
11. **Vol Mortero** — Mortar volume (cement + water + sand fraction)
12. **Volumes of each aggregate component** in liters per m³
13. **Weights of each aggregate** in kg per m³
14. **Aditivo Total, Línea, PCE** — Admixture volumes in liters per m³
15. **Masa Unitaria** — Unit weight of the fresh concrete in kg/m³ (typically 2,230–2,315 kg/m³ for FC; 2,280–2,330 kg/m³ for MR)
16. **VENTA** — The selling price (executive list price pulled from Layer 2)
17. **Costo** — The total recipe cost in MXN per m³

### 3.6 Recipe Cost Calculation

The recipe cost for a given product is computed as:

```
Recipe Cost ($/m³) = [Cement kg × $3.20] + [Grava L × $0.24698] + [Arena Triturada L × $0.23532]
                   + [Arena Montoya L × $0.33920] + [Agua L × $0.02]
                   + [Aditivo Línea L × $17.702] + [Aditivo PCE L × $72.345]
                   + Operating Cost ($450)
```

Example — f'c 100 kg/cm², 28 days, REV 10, Tiro Directo (product `100282010D`):

| Component | Quantity | Unit Cost | Cost |
|-----------|---------|-----------|------|
| Cemento HOLCIM | 155 kg | $3.20/kg | $496.00 |
| Grava 20mm | 320.2 L | $0.24698/L | $79.09 |
| Arena Triturada | 319.4 L | $0.23532/L | $75.16 |
| Arena Montoya | 94.6 L | $0.33920/L | $32.07 |
| Agua | 200 L | $0.02/L | $4.00 |
| Aditivo Línea | 1.24 L | $17.702/L | $21.95 |
| Aditivo PCE | 0 L | $72.345/L | $0.00 |
| Operating Cost | 1 m³ | $450/m³ | $450.00 |
| **Total Recipe Cost** | | | **≈ $1,439.58** |
| **Executive List Price (UNITARIOS)** | | | **$1,695.00** |
| **Implied Gross Margin** | | | **$255.42 = 15.1%** |

### 3.7 Strength-Age Regression Curves

The matrix uses empirical strength-age regression curves for each cement supplier. For HOLCIM cement, the strength at any curing age is modeled using a logarithmic function:

```
f'c(t) = a × ln(t) + b
```

Where `a` and `b` are regression coefficients fitted to cylinder test data at 3, 7, 14, and 28 days. The AC reference sheet stores these coefficients per cement supplier.

The concrete design requires an **accelerated strength multiplier** (factor) relative to 28-day performance. For HOLCIM at earlier ages, the matrix uses correction factors derived from this curve to calculate the higher cement content required to achieve the same effective strength at 3, 7, or 14 days versus the full 28-day cure.

### 3.8 Product Validation Section

At the bottom of each FC matrix sheet (rows 38–47) there is a **Revisión de Productos Base** (Base Product Review) section. This takes three representative real-world samples (e.g., measured in-plant cylinder tests) and back-calculates the A/C ratio and strength trajectory, comparing them against the design parameters. This is a quality control mechanism to validate that actual production matches the design.

### 3.9 MR Matrix Specifics

The MR sheets follow the same engine but with important differences for pavement concrete:

- **Two aggregate sizes are used together:** Grava 20mm (40% of total coarse aggregate volume) and Grava 40mm (60% of total coarse aggregate volume). The larger aggregate increases stiffness and flexural strength.
- **Air content is lower:** 10 L/m³ rather than 15 L/m³, since flexural-strength concrete requires a denser matrix.
- **Mortar volume is tighter:** ~580 L/m³ versus 680–700 L/m³ for FC concrete (drier, stiffer mixes).
- **Cement contents are higher:** MR 36 at 28 days requires ~285 kg/m³ cement vs. 155 kg/m³ for F'c 100, reflecting the much higher structural demand.
- **MR target strengths:** 36, 38, 40, 42, 45, and 48 kg/cm² (these correspond roughly to road design categories T2–T5 in Mexican highway design standards).
- **The MR design ID system is different** (e.g., `036284008D` = MR 36 kg/cm², 28 days, 40mm aggregate, REV 8, Direct).

---

## 4. Layer 2 — Executive Price Lists

### 4.1 LISTA DE PRECIOS UNITARIOS 2026

This is the core pricing document. It is the output of management's pricing decision — recipe costs from the matrix are reviewed, and a selling price is set for each SKU. The title explicitly reads **"LISTA DE PRECIOS UNITARIOS 2026."**

**Scope:** Delivery within 40 km of Planta DC Concretos, Silao, Gto. Prices exclude 16% IVA (VAT).

The sheet is structured as a matrix with two independent product families side by side:

**Left side — F'c Compressive Strength Concrete:**

| Column | Header | Description |
|--------|--------|-------------|
| B | Edad Días | Curing age (3, 7, 14, or 28 days) |
| C | Resistencia f'c | Strength in kg/cm² |
| D | Tiro Directo REV 10 | Direct dump, 10 cm slump |
| E | Tiro Directo REV 14 | Direct dump, 14 cm slump |
| F | Bombeable REV 14 | Pump, 14 cm slump |
| G | Bombeable REV 18 | Pump, 18 cm slump |

**Right side — MR Modulus of Rupture Concrete:**

| Column | Header | Description |
|--------|--------|-------------|
| I | Edad Días | Curing age |
| J | Resistencia MR | Flexural strength in kg/cm² |
| K | Tiro Directo REV 8 | Direct dump, 8 cm slump |
| L | Tiro Directo REV 10 or 12 | Direct dump, 10–12 cm slump |
| M | Bombeable REV 14 | Pump, 14 cm slump |

### 4.2 F'c Price Matrix (MXN per m³, excluding IVA)

**28-Day Curing:**

| f'c (kg/cm²) | TD REV 10 | TD REV 14 | Bomb REV 14 | Bomb REV 18 |
|-------------|-----------|-----------|-------------|-------------|
| 100 | $1,695 | $1,730 | $1,740 | $1,835 |
| 150 | $1,835 | $1,850 | $1,870 | $1,885 |
| 200 | $1,940 | $1,975 | $1,995 | $2,010 |
| 250 | $2,045 | $2,060 | $2,095 | $2,110 |
| 300 | $2,150 | $2,185 | $2,200 | $2,235 |
| 350 | $2,260 | $2,270 | $2,310 | $2,375 |

**14-Day Curing (accelerated cure premium):**

| f'c (kg/cm²) | TD REV 10 | TD REV 14 | Bomb REV 14 | Bomb REV 18 |
|-------------|-----------|-----------|-------------|-------------|
| 100 | $1,785 | $1,800 | $1,820 | $1,835 |
| 150 | $1,930 | $1,945 | $1,980 | $1,995 |
| 200 | $2,050 | $2,080 | $2,100 | $2,115 |
| 250 | $2,170 | $2,185 | $2,220 | $2,235 |
| 300 | $2,275 | $2,310 | $2,380 | $2,390 |
| 350 | $2,420 | $2,450 | $2,490 | $2,520 |

**7-Day Curing (fast cure premium):**

| f'c (kg/cm²) | TD REV 10 | TD REV 14 | Bomb REV 14 | Bomb REV 18 |
|-------------|-----------|-----------|-------------|-------------|
| 100 | $1,840 | $1,855 | $1,870 | $1,885 |
| 150 | $1,985 | $2,015 | $2,030 | $2,045 |
| 200 | $2,105 | $2,120 | $2,150 | $2,165 |
| 250 | $2,205 | $2,220 | $2,250 | $2,265 |
| 300 | $2,310 | $2,360 | $2,390 | $2,425 |
| 350 | $2,440 | $2,470 | $2,500 | $2,530 |

**3-Day Curing (emergency/ultra-fast premium):**

| f'c (kg/cm²) | TD REV 10 | TD REV 14 | Bomb REV 14 | Bomb REV 18 |
|-------------|-----------|-----------|-------------|-------------|
| 100 | $1,950 | $1,965 | $1,985 | $1,995 |
| 150 | $2,090 | $2,125 | $2,145 | $2,160 |
| 200 | $2,215 | $2,225 | $2,265 | $2,295 |
| 250 | $2,310 | $2,360 | $2,395 | $2,430 |
| 300 | $2,455 | $2,490 | $2,525 | $2,540 |
| 350 | $2,550 | $2,580 | $2,615 | $2,650 |

### 4.3 MR Price Matrix (MXN per m³, excluding IVA)

**28-Day Curing:**

| MR (kg/cm²) | TD REV 8 | TD REV 10/12 | Bomb REV 14 |
|------------|---------|-------------|------------|
| 36 | $2,195 | $2,230 | $2,240 |
| 38 | $2,225 | $2,265 | $2,270 |
| 40 | $2,255 | $2,265 | $2,300 |
| 42 | $2,265 | $2,295 | $2,325 |
| 45 | $2,335 | $2,440 | $2,450 |
| 48 | $2,460 | $2,495 | $2,530 |

**14-Day Curing:**

| MR (kg/cm²) | TD REV 8 | TD REV 10/12 | Bomb REV 14 |
|------------|---------|-------------|------------|
| 36 | $2,325 | $2,360 | $2,390 |
| 38 | $2,355 | $2,385 | $2,490 |
| 40 | $2,510 | $2,525 | $2,560 |
| 42 | $2,480 | $2,495 | $2,530 |
| 45 | $2,540 | $2,570 | $2,605 |
| 48 | $2,615 | $2,645 | $2,680 |

**7-Day Curing:**

| MR (kg/cm²) | TD REV 8 | TD REV 10/12 | Bomb REV 14 |
|------------|---------|-------------|------------|
| 36 | $2,510 | $2,545 | $2,560 |
| 38 | $2,520 | $2,555 | $2,590 |
| 40 | $2,550 | $2,585 | $2,615 |
| 42 | $2,575 | $2,610 | $2,645 |
| 45 | $2,650 | $2,685 | $2,720 |
| 48 | $2,730 | $2,765 | $2,795 |

**3-Day Curing:**

| MR (kg/cm²) | TD REV 8 | TD REV 10/12 | Bomb REV 14 |
|------------|---------|-------------|------------|
| 36 | $2,745 | $2,780 | $2,815 |
| 38 | $2,770 | $2,805 | $2,840 |
| 40 | $2,800 | $2,855 | $2,885 |
| 42 | $2,805 | $2,860 | $2,890 |
| 45 | $2,880 | $2,935 | $2,965 |
| 48 | $2,920 | $2,975 | $3,005 |

### 4.4 Fluid Fill Concrete (Relleno Fluido)

A separate product category for flowable fill (used for trench backfill, void filling). Age: 28 days, REV 18 (very fluid, self-leveling):

| Product | Price (MXN/m³) |
|---------|---------------|
| f'c 15 kg/cm² | $1,885 |
| f'c 35 kg/cm² | $1,975 |

---

## 5. Layer 3 — Market Segmentation Lists

The same product grid exists in two additional variants, each with a percentage adjustment factor embedded in cell B1 of the sheet.

### 5.1 LISTA PRECIOS (EFECTIVO) — Cash Payment List

- **Adjustment factor (B1):** 0.10 (+10%)
- **All prices:** approximately 10% above the UNITARIOS list
- **Footer note:** *"PRECIOS SOLO APLICAN CON PAGO EN EFECTIVO"* (prices only apply with cash payment)
- **Interpretation:** Cash-paying customers are charged a premium, likely reflecting the operating cost of cash logistics, possible fiscal considerations, or a segmentation of spot buyers vs. credit account customers.
- **Hidden parameters in P2/P3:** Values of 70 and 8.75 — likely used as reference exchange rates or internal margin benchmarks.

Example — f'c 100, 28 days, TD REV 10:
- Unitarios: $1,695 → Efectivo: $1,865 (×1.100 = $1,864.5, rounded to $1,865)

### 5.2 LISTA PRECIOS (EMPLEADOS) — Employee Price List

- **Adjustment factor (B1):** 0.02 (+2%)
- **All prices:** approximately 2% above the UNITARIOS list
- **Footer note:** *"PRECIOS SOLO APLICAN CON PAGO EN EFECTIVO"* (also requires cash payment)
- **Interpretation:** Employees receive access to concrete at near-cost pricing (only 2% markup over the base), likely as a company benefit. The 2% above unitarios is a nominal handling/admin charge.

Example — f'c 100, 28 days, TD REV 10:
- Unitarios: $1,695 → Empleados: $1,730 (×1.020 = $1,728.9, rounded to $1,730)

### 5.3 Price Tier Comparison — f'c 100 kg/cm², 28 days, TD REV 10

| Tier | Price (MXN/m³) | vs. Base | vs. Recipe Cost |
|------|---------------|---------|----------------|
| Recipe cost (matrix) | ~$1,440 | — | — |
| UNITARIOS (standard credit) | $1,695 | +17.7% | +$255 |
| EMPLEADOS (employee) | $1,730 | +2.1% vs. unitarios | +$290 |
| EFECTIVO (cash) | $1,865 | +10.1% vs. unitarios | +$425 |

---

## 6. Supporting Reference Sheets

### 6.1 Sheet AC — Aggregate & Cement Performance Data

This sheet is the empirical backbone of the recipe engine. It contains laboratory cylinder test results and regression parameters for **five cement suppliers:**

| Supplier | Origin |
|---------|--------|
| CEMEX Huichapan | Hidalgo (Bajío primary supplier) |
| HOLCIM Tecomán | Colima (Bajío primary supplier) |
| CRUZ AZUL Tepezalá | Aguascalientes |
| MOCTEZUMA Cerritos | San Luis Potosí (SLP region supply) |
| CEMEX Tamuín | San Luis Potosí (SLP region supply) |

For each supplier and A/C ratio combination, the sheet records measured f'c values at 3, 7, 14, and 28 days, plus the regression coefficients `a` and `b` for the strength-time curve.

**HOLCIM strength data (kg/cm²) by A/C ratio:**

| A/C Ratio | Cement (kg/m³) | 3 days | 7 days | 14 days | 28 days |
|-----------|---------------|--------|--------|---------|---------|
| 1.053 (190 kg) | 190 | 73.5 | 92.5 | 112.3 | 126.85 |
| 0.833 (240 kg) | 240 | 128.0 | 149.5 | 150.0 | 180.9 |
| 0.690 (290 kg) | 290 | 222.5 | 225.6 | 237.4 | 268.0 |
| 0.588 (340 kg) | 340 | 240.0 | 287.0 | 302.0 | 329.65 |

The AC sheet also stores sand and aggregate supply data including fleet/transport pricing for the Montoya and AGRESA sand sources.

### 6.2 Sheet CONSUMOS CEMENTO — Cement Consumption Benchmarking

This sheet performs a cost comparison between two active cement suppliers (HOLCIM and CEMEX) across all product grades.

**Cement unit prices benchmarked:**
- HOLCIM: $2.90/kg (comparison price; note the matrix uses $3.20/kg as the current price)
- CEMEX: $3.08/kg
- CEMEX alternate contract: $2.95/kg

The sheet calculates and compares:
1. **Kg of cement required per m³** for each F'c / MR grade (both HOLCIM and CEMEX mix designs, since the companies have different strength curves requiring different dosages)
2. **Total cement cost per m³** = (kg of cement) × (unit price)
3. **Cost difference** between using HOLCIM vs. CEMEX

**Sample comparison — f'c 100, 28 days:**

| Item | HOLCIM | CEMEX |
|------|--------|-------|
| Cement required (kg/m³) | 155 | 165 |
| Price/kg | $2.90 | $3.08 |
| Cement cost/m³ | $449.50 | $508.20 |
| **Cost difference** | | **+$58.70 in favor of HOLCIM** |

The difference grows significantly at higher strengths. At f'c 350 kg/cm²: HOLCIM cement costs ~$971.50/m³ vs. CEMEX $1,108.80/m³ — a $137.30/m³ differential. This explains why the active matrices exclusively use HOLCIM cement.

---

## 7. Product Taxonomy & Coding System

The matrix uses a structured internal product code to uniquely identify each concrete specification. The code can be decoded as follows:

### 7.1 F'c Product Code Format

```
[Strength][Age][Aggregate][Slump][Placement]
```

Example: `100282010D`

| Segment | Value | Meaning |
|---------|-------|---------|
| 100 | 100 | f'c = 100 kg/cm² |
| 28 | 28 | 28-day curing age |
| 20 | 20 | 20mm maximum aggregate size |
| 10 | 10 | Revenimiento (slump) = 10 cm |
| D | D | Direct (Tiro Directo) placement |

Another example: `350282018B`

| Segment | Value | Meaning |
|---------|-------|---------|
| 350 | 350 | f'c = 350 kg/cm² |
| 28 | 28 | 28-day curing |
| 20 | 20 | 20mm aggregate |
| 18 | 18 | REV 18 cm slump |
| B | B | Bombeado (pump) placement |

### 7.2 MR Product Code Format

```
[MR Strength][Age][Aggregate][Slump][Placement]
```

Example: `036284008D`

| Segment | Value | Meaning |
|---------|-------|---------|
| 036 | 36 | MR = 36 kg/cm² |
| 28 | 28 | 28-day curing |
| 40 | 40 | 40mm maximum aggregate size |
| 08 | 8 | REV 8 cm slump |
| D | D | Direct placement |

### 7.3 Placement Type Definitions

| Code | Spanish | Description |
|------|---------|-------------|
| D | Tiro Directo | Concrete discharged directly from truck chute; no pump required |
| B | Bombeado | Concrete pumped through boom arm or stationary pump to the pour location |

### 7.4 Slump / Revenimiento Specifications

| Slump Code | Target Slump | Typical Application |
|-----------|-------------|---------------------|
| REV 8 | 8 cm | Pavement, industrial slabs (MR products only) |
| REV 10 | 10 cm | Structural elements, direct placement |
| REV 12 | 12 cm | General construction, moderate pump runs |
| REV 14 | 14 cm | Long pump runs, congested reinforcement |
| REV 18 | 18 cm | Highly fluid; self-compacting, fluid fill |

---

## 8. Price Table: Complete Reference

### 8.1 Price Progression by Curing Age (f'c TD REV 10)

The table below shows how the price escalates for each strength grade as curing age decreases (from 28-day to 3-day). The premium reflects higher cement content and scheduling complexity.

| f'c (kg/cm²) | 28-day | 14-day | 7-day | 3-day | 3-day vs. 28-day premium |
|-------------|--------|--------|-------|-------|--------------------------|
| 100 | $1,695 | $1,785 | $1,840 | $1,950 | +$255 (+15.0%) |
| 150 | $1,835 | $1,930 | $1,985 | $2,090 | +$255 (+13.9%) |
| 200 | $1,940 | $2,050 | $2,105 | $2,215 | +$275 (+14.2%) |
| 250 | $2,045 | $2,170 | $2,205 | $2,310 | +$265 (+13.0%) |
| 300 | $2,150 | $2,275 | $2,310 | $2,455 | +$305 (+14.2%) |
| 350 | $2,260 | $2,420 | $2,440 | $2,550 | +$290 (+12.8%) |

### 8.2 Pump vs. Tiro Directo Premium (28-day, REV 14 vs. REV 10)

| f'c (kg/cm²) | TD REV 10 | Bomb REV 14 | Pump Premium |
|-------------|-----------|-------------|-------------|
| 100 | $1,695 | $1,740 | +$45 (+2.7%) |
| 150 | $1,835 | $1,870 | +$35 (+1.9%) |
| 200 | $1,940 | $1,995 | +$55 (+2.8%) |
| 250 | $2,045 | $2,095 | +$50 (+2.4%) |
| 300 | $2,150 | $2,200 | +$50 (+2.3%) |
| 350 | $2,260 | $2,310 | +$50 (+2.2%) |

Note: The pump premium in the material cost is primarily a higher cement content (needed for pumpability and to compensate for the wetter mix). The pumping service itself is charged separately as an added service.

---

## 9. Additional Services & Surcharges

All three price lists carry an identical additional services section. Prices vary by tier (unitarios, efectivo, empleados). The table below shows all three tiers.

### 9.1 Pumping Services

| Service | Unit | Unitarios | Efectivo | Empleados |
|---------|------|-----------|---------|-----------|
| Servicio de bombeo – Bomba pluma | m³ | $290 | $320 | $295 |
| Servicio de bombeo – Bomba estacionaria | m³ | $360 | $395 | $365 |
| Mínimo bomba pluma (12 m³) | m³ vacío | $300 | $330 | $305 |
| Mínimo bomba estacionaria (12 m³) | m³ vacío | $370 | $405 | $375 |

### 9.2 Delivery & Scheduling Fees

| Service | Unit | Unitarios | Efectivo | Empleados |
|---------|------|-----------|---------|-----------|
| Servicio mínimo entrega (5 m³) | m³ vacío | $500 | $550 | $510 |
| Apertura de planta (Domingo/Festivo) | día/planta | $30,000 | $33,000 | $30,600 |
| Servicio nocturno de colado | Por evento | $15,000 | $16,500 | $15,300 |
| Servicio nocturno de bombeo | Por evento | $10,000 | $11,000 | $10,200 |
| Cancelación el mismo día | Por evento | $1,000 | $1,100 | $1,020 |
| Concreto devuelto a planta | Por unidad | $6,000 | $6,600 | $6,120 |

### 9.3 Operational Penalties & Supplies

| Service | Unit | Unitarios | Efectivo | Empleados |
|---------|------|-----------|---------|-----------|
| Lubricante tubería de bombeo 50ml | Por unidad | $400 | $440 | $410 |
| No asignación de zona de lavado | Por evento | $4,000 | $4,400 | $4,080 |
| Salida en falso de la bomba | Por evento | $4,000 | $4,400 | $4,080 |
| Visita de laboratorio y muestreo en obra | Por servicio | $2,500 | $2,750 | $2,550 |

### 9.4 Concrete Additives (Ad-Ons to Concrete Price)

These are charged in addition to the base concrete price per m³:

| Additive | Unitarios | Efectivo | Empleados |
|---------|-----------|---------|-----------|
| Impermeabilizante integral en polvo al 1% | $100 | $110 | $100 |
| Impermeabilizante integral en polvo al 2% | $180 | $200 | $185 |
| Fibra de polipropileno (600 g/m³) | $150 | $165 | $155 |
| Fibra sintética estructural (3 kg/m³) | $600 | $660 | $610 |

### 9.5 Distance Surcharges (Applicable beyond the standard 40 km radius)

| Distance Band | Unitarios | Efectivo | Empleados |
|--------------|-----------|---------|-----------|
| 41–60 km | +$100/m³ | +$110/m³ | +$100/m³ |
| 61–80 km | +$200/m³ | +$220/m³ | +$205/m³ |
| 81–100 km | +$300/m³ | +$330/m³ | +$305/m³ |
| 101–120 km | +$400/m³ | +$440/m³ | +$410/m³ |
| 121–140 km | +$500/m³ | +$550/m³ | +$510/m³ |

Note: The distance surcharges scale by $100/m³ per 20 km band. This implies a transport cost of approximately $5/m³/km for incremental distance beyond the base radius.

---

## 10. Margin & Cost Analysis

### 10.1 Gross Margin by Product Grade (28-day F'c, UNITARIOS list)

Margins are calculable directly from the matrix by comparing the VENTA (list price) column to the recipe cost column for each product. The pattern across the 28-day F'c grades is:

| f'c (kg/cm²) | Recipe Cost (avg) | List Price (avg TD) | Gross Margin |
|-------------|------------------|---------------------|-------------|
| 100 | ~$1,440–$1,480 | $1,695–$1,740 | **~15.1%** |
| 150 | ~$1,579–$1,621 | $1,835–$1,885 | **~13.9–14.0%** |
| 200 | ~$1,689–$1,747 | $1,940–$2,010 | **~12.9–13.1%** |
| 250 | ~$1,798–$1,857 | $2,045–$2,110 | **~12.0–12.1%** |
| 300 | ~$1,893–$1,965 | $2,150–$2,235 | **~11.9–12.1%** |
| 350 | ~$1,987–$2,091 | $2,260–$2,375 | **~12.0–12.1%** |

This is consistent with a deliberate strategy: **highest margins on low-grade commodity concrete** (f'c 100 at 15%), **converging to a floor of ~12%** on mid-to-high strength grades. The margin compression from f'c 100 to f'c 350 is driven by the rising cement cost (155 kg/m³ → 355 kg/m³), which the price list only partially passes through to the customer.

The column labeled **MOP** in the matrix is a reference field used by engineering, not a live-calculated margin display.

### 10.2 Cost Structure Breakdown (Approximate)

Based on the f'c 100, 28-day, TD REV 10 example ($1,695 list, ~$1,440 recipe cost):

| Cost Component | Amount (MXN) | % of Recipe Cost |
|---------------|-------------|-----------------|
| Cement | $496 | 34.4% |
| Aggregates (grava + arenas) | $186 | 12.9% |
| Additives | $22 | 1.5% |
| Water | $4 | 0.3% |
| Operating cost ($450 flat) | $450 | 31.3% |
| **Subtotal (recipe cost)** | **$1,440** | **100%** |
| Margin (above cost) | $255 | — |
| **Selling price (UNITARIOS)** | **$1,695** | **+17.7%** |

At f'c 350, 28-day, the cement cost rises to ~$1,136/m³ (355 kg × $3.20), making cement alone roughly 55–60% of the recipe cost at high strength grades.

### 10.3 Operating Cost Sensitivity

The $450/m³ operating cost is parameterized against a **2,000 m³/month volume assumption.** This means:

- If monthly volume drops to 1,500 m³, the operating cost per m³ rises (fixed costs spread over fewer units), reducing margins.
- If volume rises above 2,000 m³, the fixed component is diluted and margins improve.
- This operating cost includes plant fixed costs, truck depreciation/maintenance, driver labor, and variable production costs.

### 10.4 Early-Age Pricing and Cement Content Premium

The accelerated curing products (3, 7, 14-day) require substantially more cement to achieve the same 28-day design strength at an earlier age, because the matrix must compensate for the lower maturity of the concrete. This is reflected directly in the price:

| Age | Cement for f'c 200 (approx.) | Price (TD REV 10) |
|----|------------------------------|-------------------|
| 28 days | ~235 kg/m³ | $1,940 |
| 14 days | ~285 kg/m³ | $2,050 |
| 7 days | ~300 kg/m³ | $2,105 |
| 3 days | ~315 kg/m³ | $2,215 |

Each 50 kg/m³ increase in cement content adds approximately $160 in material cost ($3.20 × 50). The price premium from 28-day to 3-day is $275, which closely tracks the additional cement cost.

---

## 11. Approval Governance & the Quote Flow

### 11.1 The Three-Actor Flow

```
[Engineering] → Updates material costs in Matrix Sheets
                 ↓
[Executive]   → Reviews recipe costs; sets list prices in LISTA UNITARIOS
                 ↓
[Sales Agent] → Creates customer quote from LISTA (Efectivo or Unitarios)
                 ↓
              ┌─ Quote ≥ List Price? ──→ AUTO-APPROVED, order proceeds
              │
              └─ Quote < List Price? ──→ REQUIRES EXECUTIVE APPROVAL before order
```

### 11.2 The Middle Layer's Strategic Role

The LISTA UNITARIOS serves as the critical middle layer in this chain. Its role is dual:

**Commercial floor:** It is the minimum price below which a sales agent cannot go without approval. This prevents salespeople from giving away margin under competitive pressure without management awareness.

**Customer price reference:** The EFECTIVO and EMPLEADOS lists are derived from UNITARIOS, meaning executives only need to maintain one master document (UNITARIOS) and the other lists auto-calculate from the adjustment factors (0.10 and 0.02).

### 11.3 The Approval Trigger

The phrase "if it goes under [the list price], it needs approval" implies a discount authorization workflow. In the current Excel-based system, this is enforced procedurally (the sales agent must physically get a signature or digital approval before submitting an order below list). In a more mature system, this would be a hard lock in an ERP or CRM that routes sub-list quotes to a manager for approval.

### 11.4 Pricing Update Cadence

The workbook indicates monthly pricing cycles: it is titled "ENERO" (January) and is dated as updated February 9, 2026. This suggests:
- Mix design matrices are updated monthly or when material prices change.
- The price lists are regenerated each month based on updated recipe costs.
- The "OCTUBRE 2025" and "SEPTIEMBRE 2025" headers on the FC and MR sheets respectively indicate those mix designs were last validated at those dates and have remained stable since.

---

## 12. Key Design Parameters & Material Inputs

### 12.1 Absolute Volume Method

The mix design engine uses the **absolute volume method**, a standard engineering approach where the sum of all component volumes (cement, water, aggregates, admixtures, air) must equal 1,000 liters (1 m³):

```
V_cement + V_water + V_air + V_aggregate + V_admixture = 1,000 L
```

The matrix verifies this balance in the "COMPRO" (comprobación/verification) column, which should equal 1,000 ± 1 L for a valid design. Reviewing the data, all product rows show COMPRO values within 997–1,002 L, confirming the designs are balanced.

### 12.2 Air Content Assumptions

| Concrete Type | Air Content (L/m³) |
|--------------|-------------------|
| F'c standard (non-air-entrained) | 15 L/m³ |
| MR pavement (low air) | 10–15 L/m³ |

Air is not entrained via a specific admixture in these designs — it is the naturally entrapped air. The low values (1.0–1.5%) are typical of vibrated ready-mix concrete for structural applications.

### 12.3 Design Strength Safety Factor

The matrix computes the **required design strength f'cr** from the specified strength f'c using a statistical approach:

```
f'cr = f'c / (1 + deviation_factor)
```

For the standard HOLCIM designs, the deviation coefficient used is **−0.084**, meaning:

```
f'cr = f'c / (1 - 0.084) = f'c × 1.0917
```

So a specified f'c 200 kg/cm² requires a mix designed to achieve f'cr 218.3 kg/cm² on average. This safety margin accounts for normal batch-to-batch variability.

### 12.4 Water Demand Rules

Water demand in the mix designs increases with slump:

| Slump (REV) | Approximate Water (L/m³) for f'c 200, 28-day |
|------------|----------------------------------------------|
| REV 10 | 200 L |
| REV 14 | 205 L |
| REV 18 | 210–215 L |

The admixture system (Aditivo Línea MAPEI + Aditivo PCE MAPEI) is used to achieve higher slumps without increasing water content, thereby maintaining the A/C ratio and not degrading strength.

---

## 13. Cement Supplier Benchmarking

### 13.1 Strength Performance Comparison

The AC sheet shows that **HOLCIM Tecomán consistently delivers the highest early-age strength** among the three local suppliers tested at 290 kg/m³ dosage:

| Supplier | f'c at 3 days (290 kg) | f'c at 7 days | f'c at 14 days | f'c at 28 days |
|---------|----------------------|---------------|----------------|----------------|
| HOLCIM Tecomán | 222.5 | 225.6 | 237.4 | 268.0 |
| CEMEX Huichapan | 169.5 | 195.5 | 214.0 | 248.4 |
| CRUZ AZUL Tepezalá | 183.0 | 206.8 | 228.1 | 236.0 |

HOLCIM is 31% stronger than CEMEX at 3 days for the same dosage. This is why the active matrices use HOLCIM — higher early strength means lower cement content required to meet the specification, partially offsetting HOLCIM's higher unit price.

### 13.2 Cost-Effectiveness at f'c 200, 28-day

| Supplier | Cement needed (kg/m³) | Price/kg | Cement cost/m³ |
|---------|----------------------|---------|----------------|
| HOLCIM | 235 | $2.90 | $681.50 |
| CEMEX | 255 | $3.08 | $785.40 |

HOLCIM is $103.90/m³ cheaper for f'c 200 at 28 days, even before factoring in the HOLCIM premium price. The current matrix uses $3.20/kg for HOLCIM (up from the $2.90 comparison benchmark), suggesting the market price has risen since the AC benchmarking was last updated.

---

## 14. System Limitations & Observations

### 14.1 Single Cement Supplier Dependency

All 8 active matrix sheets are parameterized exclusively for **HOLCIM Tecomán** cement. While the AC sheet benchmarks three other suppliers, there are no active FC or MR matrices for CEMEX or Cruz Azul. If HOLCIM supply is interrupted, the company has no ready-to-deploy alternative recipe set.

**Recommendation:** Maintain parallel matrix sheets for at least one backup supplier (CEMEX), using the consumption data already in the CONSUMOS CEMENTO sheet.

### 14.2 No Dynamic Cost Feed

Material unit costs in the matrices are **manually hardcoded inputs.** There is no link to a live commodity price feed or purchase order system. If cement prices change (e.g., HOLCIM raises from $3.20 to $3.35/kg), the matrices must be manually updated. A price change left unupdated for one month on a 2,000 m³ production volume could represent a margin erosion of:

```
2,000 m³ × 250 kg cement/m³ × $0.15/kg = $75,000 MXN per month
```

### 14.3 Operating Cost Rate is Volume-Dependent

The $450/m³ operating cost is calibrated to 2,000 m³/month. If actual volumes deviate materially from this assumption, the pricing may be either:
- **Too low** (at volumes below 2,000 m³) — fixed costs not fully recovered
- **Too high** (at volumes above 2,000 m³) — unnecessarily over-pricing the product

### 14.4 MOP Values Show Margin Compression at High Strength

The MOP column in the matrices shows that margins are lower for higher-strength products. This may reflect competitive market pricing pressures on high-strength concrete (a more specialized segment with fewer buyers but also fewer suppliers). Monitoring the margin trend as cement costs evolve is important.

### 14.5 No Escalation Clause or Validity Date on the Lists

The published price lists carry no stated validity period beyond "2026." In an inflationary environment (Mexico's construction materials sector has seen significant input cost increases), the lack of an explicit validity window and escalation mechanism means the company is exposed to cost increases without a clear trigger to reprice.

### 14.6 Distance Surcharge Granularity

The surcharge bands jump by $100/m³ per 20 km. At the boundary (e.g., exactly 40 km vs. 41 km), there is an abrupt $100/m³ step change. This is a potential source of commercial friction and negotiation. A linear per-km rate would be smoother but harder to communicate to customers.

### 14.7 The EFECTIVO Pricing Logic

It is somewhat unconventional for a **cash payment to be priced higher** (+10%) than a credit customer list. More typically, cash payment earns a discount. Possible explanations include: the "efectivo" price is a public walk-in/spot rate (no contract, no volume commitment), and credit customers are presumed to be higher-volume contracted accounts who earn better pricing. Alternatively, the 10% premium may cover transaction costs or reflect a different customer acquisition channel. This distinction should be explicitly documented for sales team clarity.

---

*Document prepared from direct analysis of the workbook MATRIX Y LISTA DE PRECIOS ENERO. OFICIAL. .xlsx — February 26, 2026. All prices in MXN, excluding 16% IVA.*
