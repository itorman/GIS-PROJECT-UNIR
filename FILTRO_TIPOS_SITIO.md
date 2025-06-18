# Filtro por Tipo de Sitio - Implementación

## Descripción

Se ha implementado un sistema de filtrado que permite recuperar elementos de la base de datos OSM según su tipo de sitio:
- **Sitios Arqueológicos**: `historic=archaeological_site` o `tags->'archaeological_site'`
- **Sitios Paleontológicos**: `tags->'geological' = 'palaeontological_site'`

## Backend

### Parámetro de Consulta

La API `/api/point/geojson` acepta un parámetro `type` con los siguientes valores:

- `archaeo`: Solo sitios arqueológicos
- `palaeo`: Solo sitios paleontológicos
- Sin especificar: Ambos tipos de sitios

### Implementación SQL

#### Condiciones WHERE

```sql
-- Para sitios arqueológicos (type=archaeo)
AND (p.historic = 'archaeological_site' OR p.tags ? 'archaeological_site')

-- Para sitios paleontológicos (type=palaeo)
AND (p.tags ? 'geological' AND p.tags->'geological' = 'palaeontological_site')

-- Para ambos tipos (sin parámetro type)
AND ((p.historic = 'archaeological_site' OR p.tags ? 'archaeological_site') 
     OR (p.tags ? 'geological' AND p.tags->'geological' = 'palaeontological_site'))
```

#### Campo site_type

Se añade un campo calculado `site_type` que identifica el tipo de sitio:

```sql
CASE 
  WHEN historic = 'archaeological_site' OR tags ? 'archaeological_site' THEN 'archaeological'
  WHEN tags ? 'geological' AND tags->'geological' = 'palaeontological_site' THEN 'palaeontological'
  ELSE 'unknown'
END as site_type
```

### Campos Añadidos

- `palaeontological_site`: Valor de `tags->'geological'`
- `site_type`: Tipo de sitio ('archaeological', 'palaeontological', 'unknown')

## Frontend

### Interfaz de Usuario

Se han añadido dos checkboxes en la sección de filtros:

1. **Sitios Arqueológicos**: Filtra elementos con `historic=archaeological_site`
2. **Sitios Paleontológicos**: Filtra elementos con `geological=palaeontological_site`

### Funcionalidad

- **Ambos marcados**: Muestra todos los tipos de sitios
- **Solo arqueológico**: Filtra solo sitios arqueológicos
- **Solo paleontológico**: Filtra solo sitios paleontológicos
- **Ninguno marcado**: Muestra todos los tipos de sitios

### Event Listeners

Los checkboxes tienen event listeners que recargan automáticamente los datos cuando cambian:

```javascript
document.getElementById('show-archaeological').addEventListener('change', function() {
  if (allFeaturesData) {
    loadGeoJSON();
  }
});

document.getElementById('show-palaeontological').addEventListener('change', function() {
  if (allFeaturesData) {
    loadGeoJSON();
  }
});
```

### Información Mostrada

#### Popup del Mapa
Muestra el tipo de sitio:
- **Arqueológico**: Para sitios arqueológicos
- **Paleontológico**: Para sitios paleontológicos
- **Desconocido**: Para otros tipos

#### Panel de Información
Muestra información específica según el tipo:
- **Sitios Arqueológicos**: Muestra `archaeological_site` y `historic_civilization`
- **Sitios Paleontológicos**: Muestra `palaeontological_site`

### Leyenda Actualizada

La leyenda del mapa incluye información sobre los tipos de sitio:
- Sitios Arqueológicos (historic=archaeological_site)
- Sitios Paleontológicos (geological=palaeontological_site)

## Ejemplos de Uso

### API Calls

```bash
# Solo sitios arqueológicos
curl "http://localhost:3000/api/point/geojson?country=Spain&type=archaeo"

# Solo sitios paleontológicos
curl "http://localhost:3000/api/point/geojson?country=Spain&type=palaeo"

# Ambos tipos
curl "http://localhost:3000/api/point/geojson?country=Spain"
```

### Respuesta JSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "osm_id": "123456",
        "name": "Ejemplo",
        "site_type": "archaeological",
        "archaeological_site": "archaeological_site",
        "palaeontological_site": "",
        "historic_civilization": "roman"
      }
    }
  ]
}
```

## Consideraciones Técnicas

1. **Base de Datos**: Los datos paleontológicos están almacenados en la columna `tags` como `geological=palaeontological_site`
2. **Rendimiento**: El filtro se aplica a nivel de base de datos para optimizar el rendimiento
3. **Compatibilidad**: Mantiene compatibilidad con el código existente
4. **Escalabilidad**: El filtro funciona para puntos, líneas y polígonos 