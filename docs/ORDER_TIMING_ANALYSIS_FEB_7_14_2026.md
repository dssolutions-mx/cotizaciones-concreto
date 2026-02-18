# Análisis de tiempos: P001 — Órdenes con remisiones sin crédito o crédito después de carga

**Planta:** P001 (León Planta 1)  
**Rango:** `delivery_date` 7–14 de febrero 2026  
**Remisiones:** Solo tipo CONCRETO  
**Excluidas:** Órdenes cuyo número empieza con `P001`  
**Filtro:** Tienen remisiones Y (crédito pendiente O crédito validado después de la primera carga)  
**Hora:** Hora Centro México (America/Mexico_City, UTC-6)

---

## Resumen

| Órdenes filtradas | Con crédito pendiente | Con crédito validado después de carga |
|-------------------|------------------------|--------------------------------------|
| 17                | 15                     | 2                                     |

---

## Detalle (horas en hora local)

| Orden | Entrega | Cliente | Crédito | Orden creada (local) | Crédito validado (local) | 1ª remisión | Hora carga | Vol (m³) | Remis. |
|-------|---------|---------|---------|----------------------|--------------------------|-------------|------------|----------|--------|
| ORD-20260209-7226 | 2026-02-09 | GRUPO VOSCANMAR | pending | 2026-02-09 09:06 | — | 26118 | 11:52:30 | 8.00 | 1 |
| ORD-20260209-1975 | 2026-02-10 | EDUARDO T BIENESTAR | pending | 2026-02-09 16:12 | — | 26130 | 07:06:27 | 8.00 | 5 |
| ORD-20260209-4195 | 2026-02-10 | GRUPO VOSCANMAR | pending | 2026-02-09 16:21 | — | 26142 | 11:19:48 | 7.00 | 2 |
| ORD-20260209-9815 | 2026-02-10 | YARED ABRAHAM CISNEROS TERAN | approved | 2026-02-09 16:29 | 2026-02-09 16:33 | 26112 | 09:24:50 | 7.00 | 8 |
| ORD-20260209-3445 | 2026-02-10 | ISRAEL RAZO | pending | 2026-02-09 17:24 | — | 26146 | 12:55:53 | 3.00 | 1 |
| ORD-20260209-6902 | 2026-02-11 | GRUPO VOSCANMAR | pending | 2026-02-09 16:21 | — | 26176 | 12:34:16 | 7.00 | 2 |
| ORD-20260210-6740 | 2026-02-11 | LUIS DEMETRIO PEREZ CUELLAR | pending | 2026-02-10 16:47 | — | 26172 | 11:20:52 | 7.00 | 1 |
| ORD-20260209-7841 | 2026-02-12 | GRUPO VOSCANMAR | pending | 2026-02-09 16:22 | — | 26188 | 10:08:55 | 7.00 | 2 |
| ORD-20260211-2606 | 2026-02-12 | FRANCISCO ARREDONDO | pending | 2026-02-11 15:27 | — | 26186 | 09:03:30 | 4.00 | 1 |
| ORD-20260211-8351 | 2026-02-13 | EDUARDO T BIENESTAR | pending | 2026-02-11 10:12 | — | 26200 | 05:53:19 | 8.00 | 5 |
| ORD-20260211-4568 | 2026-02-13 | ADRIANA MONTEBELLO | pending | 2026-02-11 15:38 | — | 26206 | 07:42:20 | 5.50 | 2 |
| ORD-20260212-9831 | 2026-02-13 | ADRIANA MONTEBELLO | pending | 2026-02-12 09:16 | — | 26213 | 11:48:13 | 6.00 | 1 |
| ORD-20260213-4009 | 2026-02-14 | Manavil | pending | 2026-02-13 16:21 | — | 26223 | 03:20:21 | 7.00 | 6 |
| ORD-20260213-4290 | 2026-02-14 | EDUARDO T BIENESTAR | pending | 2026-02-13 16:34 | — | 26229 | 06:40:50 | 8.00 | 5 |
| ORD-20260214-9951 | 2026-02-14 | DRILLER CIMENTACIONES | pending | 2026-02-13 19:15 | — | 26237 | 10:37:38 | 5.00 | 2 |
| ORD-20260214-9110 | 2026-02-14 | INGENIERIA EN CONSTRUCCION CISMA | approved | 2026-02-13 19:17 | 2026-02-14 08:35 | 26234 | 08:21:35 | 8.50 | 2 |
| ORD-20260214-8802 | 2026-02-14 | CONSTRUCTORA ATLADAKOR | pending | 2026-02-13 19:18 | — | 26240 | 13:15:24 | 8.00 | 3 |

---

## Órdenes con crédito validado después de la primera carga

| Orden | Cliente | 1ª carga (local) | Crédito validado (local) |
|-------|---------|------------------|--------------------------|
| ORD-20260209-9815 | YARED ABRAHAM CISNEROS TERAN | 2026-02-09 09:24:50 | 2026-02-09 16:33 |
| ORD-20260214-9110 | INGENIERIA EN CONSTRUCCION CISMA | 2026-02-14 08:21:35 | 2026-02-14 08:35 |

*En ambas, el crédito se validó después de haber cargado la primera remisión.*
