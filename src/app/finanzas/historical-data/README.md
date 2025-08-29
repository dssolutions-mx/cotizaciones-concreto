# Página de Datos Históricos

## Descripción
Esta página está diseñada específicamente para mostrar datos históricos de ventas sin las complejidades de filtros de fecha y otras funcionalidades que pueden causar problemas en la página principal de ventas.

## Características
- **Enfoque Único**: Solo muestra gráficos históricos de tendencias
- **Sin Filtros de Fecha**: Los datos históricos son independientes de filtros de fecha
- **Datos Completos**: Muestra todas las transacciones disponibles históricamente
- **Gráficos Interactivos**: Utiliza el componente SalesCharts optimizado para datos históricos
- **Soporte de IVA**: Toggle para mostrar datos con o sin IVA
- **Contexto de Planta**: Filtrado por planta seleccionada

## Componentes Utilizados
- `SalesCharts`: Componente principal para gráficos históricos
- `PlantContextDisplay`: Selector de planta
- Controles de IVA y estado

## Navegación
- Accesible desde el menú principal de Finanzas
- Ruta: `/finanzas/historical-data`
- Icono: TrendingUp (tendencia ascendente)

## Ventajas sobre la Página Principal
1. **Simplicidad**: Sin filtros complejos que puedan fallar
2. **Rendimiento**: Enfoque único en datos históricos
3. **Mantenibilidad**: Código más simple y fácil de mantener
4. **Confiabilidad**: Menos puntos de falla

## Uso Recomendado
- Para análisis de tendencias históricas
- Para reportes ejecutivos de ventas
- Para comparativas entre períodos
- Cuando se necesiten datos históricos completos sin filtros de fecha
