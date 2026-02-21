# Contenido de anuncios in-app — Novedades de la versión

## 1. Audiencias finales (consolidadas)

| Rol | Prioridad | Foco del mensaje |
|-----|-----------|------------------|
| `EXECUTIVE` | Alta | Procurement ERP (PO/Entradas, inventario, lotes) + Dashboard aprobaciones |
| `PLANT_MANAGER` | Alta | Procurement operativo + Dashboard aprobaciones |
| `ADMIN_OPERATIONS` | Media | Procurement operativo (PO/Entradas) |
| `SALES_AGENT` | Alta | Navegación comercial centralizada |
| `EXTERNAL_SALES_AGENT` | Alta | Navegación comercial centralizada |
| Resto (`QUALITY_TEAM`, `CREDIT_VALIDATOR`, `DOSIFICADOR`, `ADMINISTRATIVE`, `EXTERNAL_CLIENT`) | Baja | Anuncio global resumido |

**Nota:** No existe rol `finanzas/cxp` ni `BU_MANAGER` en la instancia actual; omitidos.

---

## 2. Bloques y variantes por rol

### Bloque A — Rediseño visual y navegación

**Global (todos):**
- Nueva coherencia visual en dashboard, finanzas y sidebar.
- Menú más limpio, menos ruido y navegación más clara.
- Mejoras de accesibilidad (reducida transparencia y animación cuando se prefiere).

**Énfasis comercial (`SALES_AGENT`, `EXTERNAL_SALES_AGENT`):**
- Navegación comercial más centralizada para clientes, cotizaciones y seguimiento.
- Menos fricción para llegar a las tareas clave del día.

---

### Bloque B — Procurement (PO + Entradas)

**Estratégico (`EXECUTIVE`):**
- Evolución de procurement con enfoque estándar ERP corporativo.
- Mayor confiabilidad de datos de PO y Entradas para reporteo ejecutivo y decisiones.
- Mejor trazabilidad del flujo procurement (compras → registros → validaciones), con más control de inventario y lotes.

**Operativo (`PLANT_MANAGER`, `ADMIN_OPERATIONS`):**
- Mejoras en órdenes de compra, entradas y créditos aplicados a PO.
- Fortalecimiento del cálculo de materia prima y asignación por lotes.
- Flujo más robusto para operación diaria y control.

---

### Bloque C — Productos adicionales

**Para roles que cotizan/operan pedidos:**
- Configuración más flexible de productos adicionales.
- Mejor claridad desde cotización hasta pedido sobre cómo se aplican.
- Mejor consistencia para exportes y reportes derivados del flujo.
- Cambio de proceso clave para comercial: productos adicionales como switch operativo más simple y controlado.

---

### Bloque D — Dashboard de aprobaciones

**Principal (`EXECUTIVE`, `PLANT_MANAGER`):**
- Dashboard orientado a tareas pendientes de aprobación.
- Acceso más rápido a procesos clave de revisión y decisión.
- Menor tiempo para identificar qué está pendiente y actuar.

---

## 3. Paquete de copy

### Versión corta (10–15 segundos)

**Titular:** Novedades de la versión

**Bullets:**
1. Rediseño visual y navegación más clara.
2. Procurement: mejoras en PO y Entradas.
3. Productos adicionales: nuevo switch del proceso comercial, más flexible y claro.
4. Dashboard de aprobaciones para acciones rápidas.

---

### Versión estándar (modal)

**Titular:** Novedades de la versión

**Subtítulo:** Un paso adelante en operación, control y experiencia comercial.

**Bloques:**
1. **Rediseño visual y navegación:** Nueva coherencia en dashboard, finanzas y menú. Navegación más clara y menú más limpio. Mejoras de accesibilidad cuando prefieres menos animación.
2. **Procurement (PO + Entradas):** Mejoras en órdenes de compra, entradas y créditos aplicados a PO. Mayor trazabilidad y control operativo.
3. **Productos adicionales:** Configuración más flexible. Claridad desde cotización hasta pedido.
4. **Dashboard de aprobaciones:** Tareas pendientes en un solo lugar. Acceso más rápido a revisiones y decisiones.

**CTAs:** `Ver novedades` (principal) | `Entendido` (secundario)

---

### Versión por rol

**Ejecutivo (`EXECUTIVE`):**
- Foco: Procurement ERP + aprobaciones.
- Destacar: lenguaje de alto nivel (ERP, procurement, inventario, lotes), datos más confiables para reporteo y trazabilidad end-to-end.

**Comercial (`SALES_AGENT`, `EXTERNAL_SALES_AGENT`):**
- Foco: Navegación centralizada + clientes/cotizaciones + productos adicionales.
- Destacar: productos adicionales como cambio de proceso (switch), menú más limpio y menos fricción en tareas del día.

**Operación (`PLANT_MANAGER`, `ADMIN_OPERATIONS`):**
- Foco: PO/Entradas + control operativo.
- Destacar: materia prima, lotes, flujo robusto, dashboard de aprobaciones (solo PLANT_MANAGER).

---

## 4. Validación de claims

| Claim | Verificación |
|-------|--------------|
| Coherencia visual dashboard/finanzas/sidebar | Confirmado: layout, Finanzas hub, sidebar |
| Menú más limpio | Confirmado: estructura de navegación |
| Mejoras accesibilidad | Confirmado: `prefers-reduced-motion`, `prefers-reduced-transparency` en globals |
| Procurement Workspace, PO, CXP | Confirmado: rutas `/finanzas/procurement`, `/finanzas/po`, `/finanzas/cxp` |
| Productos adicionales flexibles | Confirmado: `AdditionalProductsSelector`, billing types, flujo cotización→pedido |
| Dashboard aprobaciones | Confirmado: `ApprovalTasksSection` para EXECUTIVE, PLANT_MANAGER |
