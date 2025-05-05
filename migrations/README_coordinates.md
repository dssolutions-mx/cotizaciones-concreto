# Agregar coordenadas geográficas a los sitios de construcción

Este archivo proporciona instrucciones sobre cómo aplicar la migración para agregar coordenadas geográficas (latitud y longitud) a la tabla de sitios de construcción.

## Cambios realizados

1. Creación de columnas para latitud y longitud en la base de datos
2. Implementación de un selector de mapa utilizando Google Maps
3. Actualización de los formularios de creación de obras para permitir seleccionar ubicaciones en el mapa
4. Visualización de las ubicaciones en un mapa para las obras que tienen coordenadas
5. Funcionalidad de búsqueda de lugares y edición manual de coordenadas

## Aplicando la migración SQL

Para aplicar la migración SQL y agregar las columnas de coordenadas a la tabla:

### Usando el Editor SQL de Supabase

1. Inicia sesión en el panel de Supabase
2. Ve a la sección SQL del menú lateral
3. Crea un nuevo script
4. Copia y pega el siguiente código SQL:

```sql
-- Add coordinate columns to construction_sites table
ALTER TABLE construction_sites ADD COLUMN latitude FLOAT;
ALTER TABLE construction_sites ADD COLUMN longitude FLOAT;

-- Add a comment to the columns for documentation
COMMENT ON COLUMN construction_sites.latitude IS 'The geographic latitude coordinate of the construction site.';
COMMENT ON COLUMN construction_sites.longitude IS 'The geographic longitude coordinate of the construction site.';
```

5. Ejecuta el script

### Usando CLI de Supabase (Alternativa)

Si has configurado el CLI de Supabase, puedes aplicar la migración con:

```bash
supabase db push migrations/add_coordinates_to_construction_sites.sql
```

## Configuración de Google Maps API

Para que los mapas funcionen correctamente, es necesario configurar la API de Google Maps:

1. Obtén una clave de API de Google Maps en la [Consola de Google Cloud](https://console.cloud.google.com/)
2. Habilita las APIs de Maps JavaScript y Places API
3. Añade la clave a tu archivo `.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_clave_de_api_aqui
```

## Después de aplicar la migración

Una vez aplicada la migración, la aplicación permitirá:

1. Seleccionar coordenadas de un mapa al crear nuevas obras
2. Ver ubicaciones en un mapa para las obras existentes que tengan coordenadas
3. Mostrar información de coordenadas en la tabla de obras
4. Buscar lugares directamente desde el campo de búsqueda en el mapa
5. Editar manualmente las coordenadas usando los campos de latitud y longitud

## Nuevas Características

- **Campos de coordenadas editables**: Ahora puedes ver y editar las coordenadas directamente en campos de texto.
- **Búsqueda de lugares**: Utiliza el cuadro de búsqueda para encontrar rápidamente direcciones o lugares.
- **Vista de mapa mejorada**: Interfaz de mapa más detallada con controles de zoom y vista satélite.

## Solución de problemas

Si experimentas algún problema con los mapas:

1. Asegúrate de que la clave de API está configurada correctamente y tiene los permisos necesarios
2. Verifica que las APIs de Maps JavaScript y Places API estén habilitadas
3. Comprueba que la restricción de dominio de la clave API permita acceder desde tu dominio

# Solución para la advertencia de Marker deprecado

Si estás viendo esta advertencia en la consola:

```
As of February 21st, 2024, google.maps.Marker is deprecated. Please use google.maps.marker.AdvancedMarkerElement instead.
```

Esto es un aviso de Google de que el componente `Marker` está obsoleto pero aún funciona. Hemos implementado una solución que:

1. Mantiene la funcionalidad actual usando el componente `Marker` estándar
2. Está preparada para actualizarse a `AdvancedMarkerElement` cuando sea apropiado

Esta advertencia no afecta el funcionamiento de los mapas y se resolverá en una actualización futura cuando actualicemos la versión de `@react-google-maps/api`.

## Solución temporal para marcadores que no aparecen

Si los marcadores no aparecen al abrir el diálogo "Ver en Mapa", intenta estas soluciones:

1. Recarga la página completa para limpiar la caché
2. Cierra y vuelve a abrir el diálogo
3. Verifica en la consola del navegador si hay errores específicos

## Recomendaciones generales

Para un mejor rendimiento con los mapas:

1. Asegúrate de que las coordenadas estén en el formato correcto (números con decimales)
2. Permite que el mapa se cargue completamente antes de interactuar con él
3. Si utilizas el mapa en un diálogo o modal, espera a que el diálogo esté completamente abierto antes de mostrar el mapa

# Solución al problema de carga múltiple de Google Maps API

Si estás experimentando el siguiente error:

```
Error: google api is already presented
```

Hemos realizado las siguientes mejoras:

1. Implementado un componente wrapper (`GoogleMapWrapper`) que carga la API de Google Maps una sola vez usando `useJsApiLoader`.
2. Mejorado la interfaz del mapa con:
   - Mayor altura para mejor visualización
   - Barra de búsqueda más visible con fondo blanco y borde
   - Diseño mejorado con bordes redondeados y sombras
3. Los campos de edición manual de coordenadas ahora están en la parte superior
4. Corrección de problemas con mapas en diálogos que se abren dinámicamente

## Aplicando la solución

1. Asegúrate de tener el archivo `.env.local` configurado con tu clave de API de Google Maps:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_clave_de_api_aqui
   ```

2. Utiliza siempre el componente `GoogleMapWrapper` alrededor de cada instancia de `GoogleMapSelector`:
   ```jsx
   <GoogleMapWrapper>
     <GoogleMapSelector 
       initialPosition={{ lat: 19.4326, lng: -99.1332 }}
       onSelectLocation={handleLocationSelect}
       height="400px"
     />
   </GoogleMapWrapper>
   ```

3. Para mapas en diálogos o modales, asegúrate de que el contenido del diálogo solo se renderice cuando el diálogo esté abierto:
   ```jsx
   <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
     <DialogContent>
       {showMapDialog && (
         <GoogleMapWrapper>
           <GoogleMapSelector 
             initialPosition={position}
             onSelectLocation={handleMapSelection}
           />
         </GoogleMapWrapper>
       )}
     </DialogContent>
   </Dialog>
   ```

## Cambios adicionales

Estos cambios también incluyen:

1. Una interfaz de usuario mejorada para el buscador de ubicaciones
2. Mayor altura predeterminada del mapa (500px) para mejor visualización
3. Campos de coordenadas más intuitivos en la parte superior
4. Bordes y sombras para mejor estética visual
5. Mejor manejo de mapas en diálogos y modales
6. Uso de `useJsApiLoader` para evitar carga múltiple del script de Google Maps 