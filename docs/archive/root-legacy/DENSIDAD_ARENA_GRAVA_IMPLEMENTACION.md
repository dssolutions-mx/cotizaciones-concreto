# Implementación de Formulario de Densidad Diferenciado para Arena y Grava

## Fecha de Implementación
20 de Octubre de 2025

## Resumen
Se ha ajustado el formulario de densidad en la página de caracterización de materiales para diferenciar entre el método para **Arena** (NMX-C-165-ONNCCE-2020) y **Grava** (NMX-C-164-ONNCCE-2014).

## Cambios Realizados

### 1. Estructura de Datos (`DensidadResultados`)

Se modificó la interfaz para incluir campos específicos para cada tipo de material:

#### Campos para ARENA (NMX-C-165-ONNCCE-2020)
- `masa_muestra_sss` (S): Masa de la muestra saturada y superficie seca (g)
- `masa_picnometro_agua` (B): Masa del picnómetro con agua (g)
- `masa_picnometro_muestra_agua` (C): Masa del picnómetro con la muestra y agua (g)
- `porcentaje_absorcion` (%Abs): Porcentaje de absorción

#### Campos para GRAVA (NMX-C-164)
- `peso_muestra_seca_horno` (Ms): Peso seco al horno
- `peso_muestra_sss` (Msss): Peso saturado SSS
- `peso_muestra_sumergida` (Ma): Peso sumergido en agua
- `volumen_desplazado`: Volumen calculado

#### Campos Comunes
- `densidad_relativa_sss`: Masa específica S.S.S / Densidad relativa SSS
- `densidad_relativa_seca`: Masa específica seca / Densidad relativa seca
- `absorcion`: Porcentaje de absorción
- `densidad_aparente`: Solo para grava
- `temperatura_agua`: Temperatura del ensayo
- `metodo_ensayo`: Método aplicado
- `observaciones`: Observaciones del ensayo

### 2. Fórmulas Implementadas

#### Para ARENA (según imagen NMX-C-165-ONNCCE-2020)

**Masa específica S.S.S:**
```
Messs = S / (B + S - C)
```

**Masa específica (seca):**
```
Mes = Messs / (1 + (%Abs/100))
```

Donde:
- **S** = Masa de la muestra sat. y sup. Seco (g) = 678.0 (ejemplo)
- **B** = Masa del picnómetro con agua (g) = 1,550.0 (ejemplo)
- **C** = Masa del picnómetro con la muestra y agua (g) = 1,972.0 (ejemplo)
- **%Abs** = % Absorción = 1.01 (ejemplo)

Resultados esperados (del ejemplo de la imagen):
- Messs = 2.65 g/cm³
- Mes = 2.61 g/cm³

#### Para GRAVA (método tradicional)

**Volumen desplazado:**
```
Vol = Msss - Ma
```

**Densidad relativa SSS:**
```
Dr SSS = Msss / Vol
```

**Densidad relativa seca:**
```
Dr seca = Ms / Vol
```

**Densidad aparente:**
```
Da = Ms / (Ms - Ma)
```

**Absorción:**
```
Abs = [(Msss - Ms) / Ms] × 100
```

### 3. Interfaz de Usuario

El formulario ahora muestra automáticamente:

#### Para ARENA:
- 4 campos de entrada: S, B, C, %Abs
- Cálculo intermedio visible: (B + S - C)
- Resultados destacados:
  - Masa Específica S.S.S (principal - verde)
  - Masa Específica Seca (secundario - azul)
  - Porcentaje de Absorción

#### Para GRAVA:
- 3 campos de entrada: Ms, Msss, Ma
- Volumen desplazado calculado y visible
- Resultados destacados:
  - Densidad Relativa SSS
  - Densidad Relativa Seca
  - Densidad Aparente
  - Absorción

### 4. Validaciones

#### Para ARENA:
- S, B, C y %Abs deben ser > 0
- Se valida que (B + S - C) > 0

#### Para GRAVA:
- Ms, Msss, Ma deben ser > 0
- Msss debe ser >= Ms
- Ma debe ser < Msss
- Vol = (Msss - Ma) debe ser > 0

### 5. Detección Automática

El sistema detecta automáticamente el tipo de material basándose en:
- Si `tipo_material` contiene "arena" o "fino" → Usa método para ARENA
- De lo contrario → Usa método para GRAVA

## Archivos Modificados

- `src/components/quality/caracterizacion/forms/DensidadForm.tsx`

## Compatibilidad con Datos Existentes

El formulario es compatible con registros antiguos gracias a la migración automática de datos en el estado inicial. Los campos opcionales permiten que ambos métodos coexistan en la base de datos.

## Ejemplo de Uso - Arena

### Datos de Entrada (según imagen):
- S = 678.0 g
- B = 1,550.0 g  
- C = 1,972.0 g
- %Abs = 1.01 %

### Cálculos:
1. B + S - C = 1,550.0 + 678.0 - 1,972.0 = 256.0 g
2. Messs = 678.0 / 256.0 = 2.65 g/cm³
3. Mes = 2.65 / (1 + 1.01/100) = 2.65 / 1.0101 = 2.62 g/cm³ ≈ 2.61 g/cm³

## Pruebas Recomendadas

1. ✅ Crear un estudio de caracterización con material tipo "Arena"
2. ✅ Completar el formulario de densidad con los datos del ejemplo
3. ✅ Verificar que los cálculos coincidan con los valores esperados
4. ✅ Crear un estudio con material tipo "Grava" 
5. ✅ Verificar que el formulario muestre los campos correctos para grava
6. ✅ Verificar que los datos se guarden correctamente en la base de datos

## Próximos Pasos

- [ ] Actualizar el componente PDF (EstudioPDF) para mostrar los campos correctos según el tipo de material
- [ ] Verificar que los reportes muestren los resultados apropiados
- [ ] Crear documentación de usuario para el nuevo formulario

## Referencias

- NMX-C-165-ONNCCE-2020: Método de ensayo para arena
- NMX-C-164-ONNCCE-2014: Método de ensayo para grava
- Imagen proporcionada con ejemplo de cálculo para arena

