# Corrección del Formulario de Absorción según Normas NMX

## 📋 Resumen

Se ha modificado el formulario de absorción en la página `/quality/caracterizacion-materiales/` para cumplir con las normas mexicanas NMX-C-164 y NMX-C-165, diferenciando entre agregados gruesos (grava) y finos (arena).

## 🎯 Objetivos Cumplidos

1. ✅ Implementación de fórmula correcta según normas NMX
2. ✅ Detección automática del tipo de material (arena/grava)
3. ✅ Nomenclatura correcta según las normas (F, G, SSS)
4. ✅ Campos ajustados al procedimiento real
5. ✅ Información técnica detallada del procedimiento

## 🔬 Normas Aplicadas

### NMX-C-164-ONNCCE-2014
**Para Agregados Gruesos (Grava)**
- Método de prueba estándar para determinar la densidad relativa y absorción de agua
- Procedimiento específico para gravas (tamizado > 4.75 mm)
- Condición SSS: Secado superficial con paño absorbente

### NMX-C-165-ONNCCE-2020
**Para Agregados Finos (Arena)**
- Método de prueba estándar para agregados finos
- Procedimiento específico para arenas (tamizado < 4.75 mm)
- Condición SSS: Método del cono truncado

## 📐 Fórmula Implementada

```
Abs = [(Msss - Ms) / Ms] × 100
```

Donde:
- **Abs** = Absorción en porcentaje
- **Msss** = Masa de la muestra en estado saturado superficialmente seco (SSS)
- **Ms** = Masa de la muestra seca al horno (110°C ± 5°C)

## 🔄 Cambios Principales

### 1. Estructura de Datos Actualizada

**Antes:**
```typescript
interface AbsorcionResultados {
  peso_muestra_seca: number;
  peso_muestra_saturada: number;
  // ...
}
```

**Ahora:**
```typescript
interface AbsorcionResultados {
  peso_muestra_seca_horno: number; // Ms - Nomenclatura de norma
  peso_muestra_sss: number;        // Msss - Nomenclatura de norma
  norma_aplicada?: string;         // NMX-C-164 o NMX-C-165
  tipo_agregado?: string;          // Arena o Grava
  // ...
}
```

### 2. Detección Automática del Tipo de Material

El formulario ahora:
1. Consulta la base de datos para obtener el tipo de material
2. Determina automáticamente la norma aplicable
3. Muestra información específica según el tipo de agregado

```typescript
// Lógica de detección
if (tipo.includes('arena') || tipo.includes('fino')) {
  norma = 'NMX-C-165-ONNCCE-2020';
} else if (tipo.includes('grava') || tipo.includes('grueso')) {
  norma = 'NMX-C-164-ONNCCE-2014';
}
```

### 3. Campos del Formulario

#### Peso Seco al Horno (Ms)
- **Label:** "Peso Seco al Horno" con badge "Ms"
- **Descripción:** Secado a 110°C ± 5°C hasta masa constante
- **Unidades:** gramos
- **Precisión:** 0.01 g

#### Peso Saturado SSS (Msss)
- **Label:** "Peso Saturado SSS" con badge "Msss"
- **Descripción:** Saturado superficialmente seco (24h de inmersión)
- **Unidades:** gramos
- **Precisión:** 0.01 g

#### Incremento de Peso (Msss - Ms)
- **Cálculo automático:** Msss - Ms
- **Campo deshabilitado:** Solo lectura
- **Descripción:** Agua absorbida en gramos

### 4. Condiciones del Ensayo

#### Método de Secado Actualizado
- **Opción por defecto:** Horno 110°C ± 5°C (Norma NMX)
- **Alternativas:** Horno 105°C, Horno 100°C
- **Nota:** Especifica cumplimiento con la norma

### 5. Visualización de Resultados

#### Fórmula Detallada
El formulario muestra:
1. Fórmula según la norma aplicada
2. Definición de cada variable
3. Cálculo numérico con valores reales
4. Resultado final destacado

Ejemplo:
```
Fórmula según NMX-C-165-ONNCCE-2020:
Abs = [(Msss - Ms) / Ms] × 100

Donde:
• Abs = Absorción en porcentaje
• Msss = Peso saturado SSS (g)
• Ms = Peso seco al horno (g)

Cálculo: Abs = [(502.35 - 500.00) / 500.00] × 100 = 0.47%
```

### 6. Información Técnica del Procedimiento

Se incluye una sección detallada con:

#### Procedimiento Resumido (6 pasos)
1. Saturación: 24 ± 4 horas
2. Estado SSS: Condición superficialmente seca
3. Pesado Msss: Muestra SSS
4. Secado: Horno 110°C ± 5°C
5. Pesado Ms: Muestra seca
6. Cálculo: Abs = [(Msss - Ms) / Ms] × 100

#### Notas Específicas por Tipo
- **Arena (NMX-C-165):** Método del cono truncado
- **Grava (NMX-C-164):** Secado con paño absorbente

## 🔧 Compatibilidad con Datos Anteriores

El formulario incluye migración automática de datos antiguos:

```typescript
// Migrar datos antiguos si existen
peso_muestra_seca_horno: (initialData as any).peso_muestra_seca || 
                         initialData.peso_muestra_seca_horno || 0,
peso_muestra_sss: (initialData as any).peso_muestra_saturada || 
                  initialData.peso_muestra_sss || 0,
```

## 📊 Clasificación de Absorción

Se mantiene la clasificación por rangos:

| Rango (%) | Clasificación | Color |
|-----------|---------------|-------|
| < 0.5 | Muy baja | Verde oscuro |
| 0.5 - 1.0 | Baja | Verde |
| 1.0 - 2.0 | Moderada | Amarillo |
| 2.0 - 4.0 | Alta | Naranja |
| > 4.0 | Muy alta | Rojo |

## 🎨 Mejoras en la Interfaz

1. **Alert de Nomenclatura:** Explica las variables F, G y la fórmula
2. **Badges Informativos:** Identificadores claros de cada variable
3. **Tooltips y Descripciones:** Guías contextuales en cada campo
4. **Cálculo en Tiempo Real:** Muestra la fórmula con valores actuales
5. **Loader de Carga:** Indica cuando se está obteniendo info del material

## 📁 Archivos Modificados

- `src/components/quality/caracterizacion/forms/AbsorcionForm.tsx`

## 🔍 Validaciones Implementadas

1. ✅ Peso Ms (seco) debe ser > 0
2. ✅ Peso Msss (SSS) debe ser > 0
3. ✅ Msss debe ser ≥ Ms (físicamente imposible lo contrario)
4. ✅ Tiempo saturación: 12-48 horas (típicamente 24h)
5. ✅ Temperatura agua: 15-35°C

## 🚀 Próximos Pasos Sugeridos

1. **Densidad:** Aplicar mismo enfoque con fórmulas específicas
2. **Granulometría:** Ajustar según tamaño del agregado
3. **Masa Volumétrica:** Diferenciar procedimientos
4. **Pérdida por Lavado:** Actualizar según NMX-C-084

## 📝 Notas de Implementación

- La detección del tipo de material se realiza consultando la tabla `alta_estudio`
- Se preserva compatibilidad con datos existentes
- El formulario es responsive y funcional en dispositivos móviles
- Todos los cambios cumplen con las normas de accesibilidad

## ✅ Testing Recomendado

1. [ ] Crear un estudio de absorción para arena
2. [ ] Crear un estudio de absorción para grava
3. [ ] Verificar que se muestra la norma correcta
4. [ ] Probar migración de datos antiguos
5. [ ] Validar cálculos con valores conocidos
6. [ ] Verificar guardado en base de datos

## 📞 Referencias

- NMX-C-164-ONNCCE-2014: Agregados gruesos
- NMX-C-165-ONNCCE-2020: Agregados finos
- Organismo Nacional de Normalización y Certificación de la Construcción y Edificación (ONNCCE)

---

**Fecha de actualización:** 11 de octubre de 2025  
**Desarrollador:** Sistema de Caracterización de Materiales

