# Changelog

All notable changes to this project are documented here. Releases follow [calendar versioning](docs/VERSIONING.md) (`YYYY.M.patch`, for example `2026.4.0` for the April 2026 line). Each GitHub **Release** and git **tag** `vYYYY.M.0` marks the repository state at the end of that calendar month (or the latest commit when documenting the current month).

## [Unreleased]

### Planned

- Continue curating monthly entries from conventional commits where possible.

### EMA / Centro de calidad

- Plantillas de verificación v2: fórmulas sin `eval`, reglas `pass_fail_rule`, layouts de sección (lista / grilla / serie de referencia), validación antes de publicar, cumple recalculado en API, vista previa de ficha y cabecera opcional. Ver `docs/EMA_PLANTILLAS_V2.md`.

---

## [2026.4.0] - 2026-04-23

**Tag:** `v2026.4.0` (month-to-date snapshot; April still in progress)

### Finanzas y reportes

- Hub de evidencia de concreto por orden: Excel, ZIP, PDF de texto, fechas locales y sincronización del worker de PDF.js.
- Exportación de remisiones completas, mano de obra y bombeo hacia reporte de clientes; bundles ZIP con conteos de preflight.
- Auditoría de órdenes/cotizaciones y APIs asociadas; descargas desde almacenamiento.
- Reporte semanal de cumplimiento (RR.HH. / finanzas) con APIs y selector de columnas arrastrable.
- Tendencias del dashboard de ventas acotadas al rango de fechas del reporte.
- Ajustes en revisadas (scroll, doble clic para inspección), chunks de `order_id` para evidencia, y lectura contable por planta en exportación de compras.

### Compras e inventario

- Reconciliación de flotilla: pestaña, APIs y exportación Excel.
- Exportación y métricas contables (L/m³/kg), join `po_item`, copia TSV; sincronización de precios en OC y planta en exportación ERP.
- Toneladas de OC de flotilla desde báscula (kg); realce de saldos en ficha de cliente y división del espacio de trabajo de compras.
- Flujo de evidencia en entradas: subida directa a Storage, tipos de archivo flexibles, reintentos en móvil y estados por archivo.
- Recalculo FIFO al eliminar entradas; edición de proveedor en revisión de precios; correcciones en creación de proveedor (RLS, UX) y modal de OC.

### Cumplimiento y calidad

- Disputas de hallazgos, plantillas EMA y UI de conjuntos/verificaciones.
- APIs de vista previa de disputas, incidentes y composición de correo.
- Parámetros de ruta EMA, trazabilidad y navegación a Validaciones.

### Cotizaciones y otros

- Validadores de crédito pueden crear y aprobar cotizaciones.
- Comentarios internos Arkik y reasignaciones; compliance diario.
- Administración de bombeo para dosificadores (remisiones propias); alcance de evidencia por rol.

---

## [2026.3.0] - 2026-03-31

### Compras e inventario

- Refactor amplio del módulo de compras: flujo documental homogéneo, alertas en órdenes de compra, cierres y snapshots, consumos por periodo y ajustes de inventario.
- Cambios profundos en inventario y enlace con materiales ERP (alertas, solicitudes).
- Precios en entradas de inventario y revisión de conciliación OC–entrada.

### Calidad y producción

- Módulo de trazabilidad de instrumentos EMA (NMX-EC-17025).
- Quality Hub: layout, dashboard y documentación de apoyo.
- Mejoras en visualización de muestreos y modelo de recetas desde Arkik.

### Operaciones y finanzas

- Producción y facturación multi-planta; página de resultado de acción en cotización.
- Pagos de clientes en finanzas alineados a política de validación; notificación de aprobación de cotización.
- Columna de planta en cotizaciones aprobadas y refinamiento de pestañas de aprobación.

### Plataforma

- Actualización de Node.js y npm; dependencias y parches de seguridad en lockfile.
- Documentación de revisión de seguridad e invitaciones portal BIT.

---

## [2026.2.0] - 2026-02-28

### Seguridad y plataforma

- Endurecimiento tras incidente de seguridad: capas adicionales y redirección de rutas no autorizadas.
- Sistema de anuncios de versión (release announcement) en aplicación.
- BotID y utilidades relacionadas.

### Módulos mayores

- Compras (procurement) e inventario: APIs y UI estabilizadas; documentación de panorama de base ERP.
- Productos adicionales y tareas de aprobación en dashboard.
- Listas de precios (implementación parcial) y mejoras en gobernanza de versiones de receta.

### Arkik y recetas

- Creación de receta desde Arkik (modal, servicio, derivación de materiales, parser de código).
- Correcciones de gobernanza y calculadora (unicidad, recuperación, detalle de materiales).

### Pedidos y finanzas

- Rediseño de UX de pedidos (pestañas, filtros, layout tipo glass).
- Mejoras en aprobaciones pendientes, exportación de saldos y análisis de tiempos de orden.
- Implementación FIFO de crédito en órdenes de compra.

---

## [2026.1.0] - 2026-01-31

- Optimización de carga de Arkik y remisiones (modo bulk, menos tormentas de triggers).
- Ajustes de gobernanza de versiones de receta y restricciones por cantidades bajas.
- Correcciones de unidad de negocio en calidad, planta por defecto y duplicados de materiales en Arkik.
- Notificaciones de validación de crédito (refactors en edge functions).
- Documentación de optimización RLS y análisis de rendimiento.

---

## [2025.12.0] - 2025-12-30

- Gobernanza de recetas y editor de cantidades de materiales; productos adicionales.
- Pagos de clientes y tablero de pagos diarios; pestaña de cotizaciones aprobadas y RBAC en cotizaciones.
- BotID y reglas de firewall en Vercel; matching de órdenes Arkik.
- Rendimiento de calculadora y guardado de recetas (menos saturación al servidor).
- Reporte semanal de remisiones para RR.HH.; métricas de consistencia en portal de clientes.

---

## [2025.11.0] - 2025-11-28

- Refactor de tarjetas y navegación de pedidos; UI tipo glass y sistema de colores.
- Refactor del cotizador y flujo de creación de pedidos para clientes externos.
- Traducciones y revisiones del portal de clientes y administración de usuarios.
- Correcciones de hidratación, gráficas de calidad y carga (loader, logo).

---

## [2025.10.0] - 2025-10-30

- Portal de calidad y dossier; estudios de caracterización con reporte PDF.
- Resumen de precios en entradas de inventario; reloj checador.
- Mejoras en portal de clientes (saldo, sitio de calidad) y en página de pedidos (estados de carga).
- Ajustes en detalle de pedido, matching de precios y APIs del dashboard.

---

## [2025.9.0] - 2025-09-30

- Página de aterrizaje; mejoras en ventas e históricos.
- Caracterización y ajustes en programación de órdenes.
- Análisis de recetas y actualizaciones del procesador Arkik.

---

## [2025.8.0] - 2025-08-30

- Carga de muestreos, adjuntos y ajustes continuos del procesador Arkik.
- Gráficas de ventas extendidas y correcciones en reportes y listados de pedidos.
- Mejoras en garantías, ensayos y flujo de archivos.

---

## [2025.7.0] - 2025-07-31

- Soporte multi-planta y cambios amplios en conciencia de planta.
- Carga de recetas y correcciones en listados de pedidos y zonas horarias.

---

## [2025.6.0] - 2025-06-30

- Edición de remisiones; exportación a Excel.
- Permisos para validador de crédito al dar de alta clientes.
- Correcciones en recetas y flujo de crédito.

---

## [2025.5.0] - 2025-05-30

- Reportes diarios y de agenda; pagos diarios.
- Mejoras en detalle de pedido, filtros y servicios de pedidos.
- Precio manual de bomba; integración con Google Maps.
- Roles nuevos y recetas enlazadas a partidas de pedido.

---

## [2025.4.0] - 2025-04-30

- Migración a Tailwind CSS v4 y ajustes de UI (OKLCH, componentes).
- Remisiones y navegación de pedidos; dashboard financiero.
- Endurecimiento de seguridad y despliegue (documentación de deployment).

---

## [2025.3.0] - 2025-03-12

- Cimientos del sistema de cotizaciones sobre Next.js y Supabase.
- Flujos de autenticación, invitaciones y recuperación de contraseña.
- Configuración de Vercel, script de build y compatibilidad con Next.

---

[Unreleased]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2026.4.0...HEAD
[2026.4.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2026.3.0...v2026.4.0
[2026.3.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2026.2.0...v2026.3.0
[2026.2.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2026.1.0...v2026.2.0
[2026.1.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.12.0...v2026.1.0
[2025.12.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.11.0...v2025.12.0
[2025.11.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.10.0...v2025.11.0
[2025.10.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.9.0...v2025.10.0
[2025.9.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.8.0...v2025.9.0
[2025.8.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.7.0...v2025.8.0
[2025.7.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.6.0...v2025.7.0
[2025.6.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.5.0...v2025.6.0
[2025.5.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.4.0...v2025.5.0
[2025.4.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/compare/v2025.3.0...v2025.4.0
[2025.3.0]: https://github.com/dssolutions-mx/cotizaciones-concreto/commits/v2025.3.0
