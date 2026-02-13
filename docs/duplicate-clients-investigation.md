# Duplicate Clients Investigation (Stage 1)

**Date:** 2026-02-13  
**Project:** cotizador (pkjqznogflgbnwzkzmpg)

## Executive Summary – Extended Analysis

Extended fuzzy matching revealed **6 duplicate groups** with **~$95.7M orders** and **~$119M payments**. A consolidated merge migration must run **before** the Stage 1 approval migration.

| Check | Result |
|-------|--------|
| **client_code duplicates** (case-insensitive) | None – unique index will succeed |
| **business_name duplicates** (exact match) | 3 groups |
| **Fuzzy duplicates** (plural, suffixes, case) | +3 critical groups |
| **Null/empty client_code** | 7 clients (1 is IMPULSORA duplicate – DELETE) |

---

## CRITICAL FINANCIAL EXPOSURE

| Group | Orders Value | Payments Received | Status |
|-------|--------------|-------------------|--------|
| AGP Group | $2,789,390.50 | $2,510,123.77 | CRITICAL |
| CISMA Group | $2,276,550.00 | $4,250,000.00 | CRITICAL |
| IMPULSORA Group | $90,631,557.13 | $112,175,509.19 | HIGHEST PRIORITY |
| Juan Aguirre | $5,170.00 | $0 | Medium |
| Sergio Ramirez | $44,094.00 | $44,094.00 | Medium |
| Karla Cuellar | $0 | $0 | Safe |
| **TOTAL** | **$95,746,761.63** | **$118,979,726.96** | **EXTREME RISK** |

---

## 1. Groups D–F (Fuzzy Matching – Critical)

### Group D: AGP CONTRATISTA vs AGP CONTRATISTAS (plural)

| Client Code | Business Name | Client ID | Orders | Payments | Keep/Merge |
|-------------|---------------|-----------|--------|----------|------------|
| 001 | AGP CONTRATISTA | 23bef5eb-965a-4fe3-ab14-3f02862f8a47 | 0 | 1 ($694,608) | **MERGE INTO** |
| ACO140322KK6 | AGP CONTRATISTAS | 55f22ae7-b1fa-44a8-8057-b2aa0668a336 | 16 ($2.09M) | 8 ($1.82M) | **KEEP** |

**Critical:** AGP CONTRATISTA has a $694,608 payment with NO orders. Transfer payment and balance adjustments, then delete duplicate.

### Group E: CISMA vs INGENIERIA EN CONSTRUCCION CISMA

| Client Code | Business Name | Client ID | Orders | Payments | Quotes | Keep/Merge |
|-------------|---------------|-----------|--------|----------|--------|------------|
| CISMA0101 | CISMA | b8c2e4a4-58d4-450a-a30a-d43f8ee1989e | 0 | 0 | 3 | **MERGE INTO** |
| ING | INGENIERIA EN CONSTRUCCION CISMA | b7992162-0b61-4271-9ef2-2b8c6c2c292e | 52 ($2.28M) | 26 ($4.25M) | 25 | **KEEP** |

**Action:** No need to recover quotes (no orders). DELETE 3 quotes + construction_sites, UPDATE 2 client_balance_adjustments to point to INGENIERIA, then delete CISMA duplicate.

### Group F: IMPULSORA TLAXCALTECA (S.A. suffix + case)

| Client Code | Business Name | Client ID | Orders | Payments | Sites | Keep/Merge |
|-------------|---------------|-----------|--------|----------|-------|------------|
| ITI651002LG8 | IMPULSORA TLAXCALTECA DE INDUSTRIAS | (main) | 783 ($90.6M) | 30 ($112M) | 7 | **KEEP** |
| (null) | Impulsora Tlaxcalteca de Industrias S.A. | cbe398ca-3855-41f8-a44a-260ab1ac3a3e | 0 | 0 | 0 | **DELETE** |

**Highest priority:** Empty duplicate. Safe to delete. Do NOT assign LEGACY- client_code – delete instead.

---

## 2. Groups A–C (Exact business_name match)

### Group A: JUAN AGUIRRE

| id | client_code | orders | sites | quotes | Decision |
|----|-------------|--------|-------|--------|----------|
| 17aeddfe-8c60-4848-8b33-d268cd9e35b9 | FSDFDSFSFD | 0 | 3 | 10 | **DELETE** (testing only; no recovery) |
| f68e2b79-4267-43e1-834d-e162ae89ecdc | AUSJ020427UM6 | 2 | 1 | 6 | KEEP |

### Group B: KARLA JAQUELIN CUELLAR RICO

| id | client_code | orders | sites | quotes | Decision |
|----|-------------|--------|-------|--------|----------|
| f77a0fc7-592e-485c-8093-72dbca085eb5 | CURK97040128 | 0 | 0 | 0 | MERGE/DELETE |
| c1d5a67b-d797-4f73-b9a9-4731048ee578 | CURK970401289 | 0 | 0 | 0 | KEEP |

### Group C: SERGIO RAMIREZ

| id | client_code | orders | sites | quotes | Decision |
|----|-------------|--------|-------|--------|----------|
| 80312af1-f4db-4140-84a6-0a49e0b2fece | XAXX010101020 | 1 | 1 | 3 | KEEP |
| 7456417b-6c0d-4a8b-9e71-314ba3b55793 | SER | 0 | 0 | 0 | DELETE |

### Group G: VALUAR (typo: BUSSINESS vs BUSINESS) – NEW from fuzzy match

| id | client_code | orders | payments | quotes | Decision |
|----|-------------|--------|----------|--------|----------|
| 2f173eb8-1629-4653-991e-26aa6e914cd3 | VAL | 2 | $18,687.60 | 6 | **KEEP** |
| f9374a76-d6b4-44c9-a36a-b34da7fc4b54 | 01 | 0 | $26,993.20 | 0 | **MERGE INTO** |

**Action:** Transfer client_payments to VAL. Balance already transferred via client_balance_adjustments (TRANSFER CREDIT 26,993.20). Update payment rows + adjustment source_client_id, then delete 01.

---

## 3. Null/Empty client_code (after merge cleanup)

After deleting IMPULSORA duplicate: **6 remaining** with null/empty client_code. Migration backfill: `LEGACY-{id_prefix}`.

| id | business_name | Action |
|----|---------------|--------|
| cbe398ca-3855-41f8-a44a-260ab1ac3a3e | Impulsora Tlaxcalteca... | **DELETE** (duplicate) |
| e7fed6dc-... | VIADUCTO TIJUANA- ASIGNACION 2 | Backfill LEGACY- |
| 66714029-... | NAVE ALAMAR | Backfill LEGACY- |
| cc03bbbc-... | VIADUCTO ELEVADO MATADERO | Backfill LEGACY- |
| b7135b5d-... | PISTA TECNOSPAN | Backfill LEGACY- |
| 6ea4a32c-... | SEDENA | Backfill LEGACY- |
| 403ede15-... | pepe | Backfill LEGACY- |

---

## 4. Migration Order (Production-Grade)

1. **Duplicate cleanup migration** (run first)
   - Backup affected rows (clients, client_payments, client_balance_adjustments, quotes, construction_sites, orders)
   - Transfer relationships per group (AGP, CISMA, Juan Aguirre, Karla, Sergio)
   - Delete IMPULSORA duplicate (no transfers)
   - Delete other merge targets after transfer
   - Validate integrity after each step
   - Provide rollback SQL

2. **Stage 1 client approval migration** (run after)
   - Add approval_status, approved_by, approved_at
   - Backfill null/empty client_code (6 remaining)
   - Create unique index on LOWER(TRIM(client_code))

---

## 5. Payments vs Balance Adjustments – Check Before Merge

Before merging duplicates, verify whether payments were already transferred via **client_balance_adjustments** (TRANSFER type). The balance may be correct while **client_payments** still points to the duplicate.

**Important:** Many times duplicates had payments that were **transferred via `client_balance_adjustments`** (TRANSFER type) to the correct client. The **balance** is correct, but the **raw `client_payments` row** may still point to the duplicate.

### AGP – Payment record NOT updated; balance was transferred

| Table | Status |
|-------|--------|
| client_payments | 1 row: $694,608 still on AGP CONTRATISTA (001) – **UPDATE client_id to AGP CONTRATISTAS** |
| client_balance_adjustments | 1 row: TRANSFER CREDIT 694608 from 001 → ACO140322KK6 (already documented) |

**Action:** UPDATE `client_payments` SET client_id = AGP CONTRATISTAS where client_id = AGP CONTRATISTA. The adjustment already moved the balance; the payment row should point to the correct client for consistency.

### CISMA – No payments on duplicate; adjustments reference both

| Table | Status |
|-------|--------|
| client_payments | 0 on CISMA duplicate; all on INGENIERIA |
| client_balance_adjustments | 2 rows reference CISMA (dup): |
| | – 53817c29: YARED→CISMA 66,862 – **UPDATE target_client_id to INGENIERIA** |
| | – ee6c43a5: CISMA→INGENIERIA 66,862 – **UPDATE source_client_id to INGENIERIA** (or keep for audit) |

**Action:** Update `client_balance_adjustments` so source/target no longer reference CISMA (dup). Point them to INGENIERIA.

### Others

- **Juan Aguirre, Karla, Sergio:** No payments on the duplicate records that need transfer. Adjustments either have target null or point to the KEEP client.
- **IMPULSORA:** Duplicate has 0 payments. Safe delete.

---

## 6. Consolidated Migration Script Requirements

The production migration script should:

- [ ] Backup all affected data (clients, payments, balance_adjustments, quotes, construction_sites, orders)
- [ ] **client_payments:** UPDATE client_id for AGP ($694K) to AGP CONTRATISTAS
- [ ] **client_balance_adjustments:** UPDATE source_client_id/target_client_id for any row pointing to a duplicate (AGP, CISMA) so they point to the KEEP client
- [ ] DELETE quotes + construction_sites for CISMA (no orders; no recovery) and Juan Aguirre (testing)
- [ ] (No transfer of quotes/sites for these groups)
- [ ] Transfer order references if any (FK updates)
- [ ] Delete duplicate client records
- [ ] Validate row counts and balances
- [ ] Provide rollback SQL for audit
- [ ] Log all actions

### Per-Group Summary

| Group | client_payments | client_balance_adjustments | quotes | construction_sites |
|-------|-----------------|---------------------------|--------|-------------------|
| AGP   | UPDATE 1 row → AGP CONTRATISTAS | UPDATE 1 row: source_client_id → AGP CONTRATISTAS | 0 | 0 |
| CISMA | 0 on dup | **UPDATE 2 rows** → point to INGENIERIA (balances must remain correct) | **DELETE** 3 (no orders; no need to recover) | CASCADE |
| IMPULSORA | 0 | 0 | 0 | 0 |
| Juan A | 0 on dup | 0 referencing dup | **DELETE** 10 (testing client) | CASCADE |
| Karla | 0 | 0 | 0 | 0 |
| Sergio | 0 on dup | 0 | 0 | 0 |
| VALUAR | **UPDATE** 2 rows → VAL | UPDATE 1 row: source_client_id → VAL | 0 | 0 |

### Simplified Decisions

- **Juan Aguirre (FSDFD):** Testing only. Delete quotes + sites first, then delete client.
- **CISMA:** No orders on duplicate. No need to recover quotes – delete them. **Critical:** UPDATE balance adjustments to point to INGENIERIA so financial balances remain correct.
