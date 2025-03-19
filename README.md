# GIS-PROJECT-UNIR
Final project for a Master degree at UNIR (Universidad Internacional de La Rioja) focused on GIS and Big Data tecnologies

# Arquitectura general para proyecto académico de mapa de yacimientos arqueológicos y paleontológicos. Arquitectura para un desarrollo sin tecnologías Big Data

Para un proyecto académico con un presupuesto limitado (máximo 100 euros) y basado en tecnologías open source.

## Arquitectura del sistema

```
+-------------------+     +-------------------+     +-------------------+
| EXTRACCIÓN DATOS  |     |  BASE DE DATOS    |     |  APLICACIÓN WEB   |
|                   |     |                   |     |                   |
| - Overpass API    | --> |  SQLite/SpatiaLite| --> | - HTML/CSS/JS    |
|             |     | --> |  GeoJSON Files    |     | - Leaflet         |
+-------------------+     +-------------------+     +-------------------+
```

## Componentes

### 1. Extracción de datos

- **Herramienta principal**: Overpass API/Turbo (gratuito)
- **Enfoque**: Extraer sólo datos de yacimientos arqueológicos y paleontológicos mediante consultas específicas, sin necesidad de procesar los 144 GB completos.

### 2. Almacenamiento
- **Opción simple**: Archivos GeoJSON estáticos
  - Ventaja: Sin necesidad de servidor de base de datos
  - Limitación: Menos eficiente para búsquedas complejas
- **Opción recomendada**: SQLite con extensión SpatiaLite
  - Ventaja: Base de datos completa sin necesidad de servidor
  - Ideal para proyectos académicos locales

### 3. Backend minimalista
- **Opción 1**: Sin backend (cargar directamente GeoJSON)
  - Para proyectos muy pequeños (< 1000 yacimientos)
- **Opción 2**: Backend ligero con Python (Flask)
  - Alojamiento: PythonAnywhere (tiene plan gratuito)
  - Alternativa: GitHub Pages + GitHub Actions para preprocesamiento

### 4. Frontend
- **Framework**: HTML/CSS/JavaScript vanilla
- **Biblioteca de mapas**: Leaflet (open source)
- **Hospedaje**: GitHub Pages (gratuito) o Netlify (plan gratuito)

## Flujo de desarrollo

1. **Extracción inicial**:
   - Utiliza Overpass Turbo para obtener todos los yacimientos con consultas como:
     ```
     [out:json];
     (
       node["historic"="archaeological_site"];
       way["historic"="archaeological_site"];
       relation["historic"="archaeological_site"];
       node["site_type"="paleontological_site"];
       way["site_type"="paleontological_site"];
     );
     out body;
     >;
     out skel qt;
     ```

2. **Procesamiento y limpieza**:
   - Script Python para:
     - Convertir datos OSM a GeoJSON normalizado
     - Añadir/corregir propiedades
     - Clasificar por tipo (arqueológico/paleontológico)
     - Almacenar en SQLite/SpatiaLite o como archivos GeoJSON

3. **Desarrollo web**:
   - Implementar interfaz similar al código leaflet.html
   - Opciones de filtrado por tipo, época, etc.
   - Popups informativos al hacer clic en los yacimientos

## Costes estimados (manteniendo bajo presupuesto)

| Componente | Opción | Coste |
|------------|--------|-------|
| Extracción de datos | Overpass API (servicio público) | €0 |
| Base de datos | SQLite/SpatiaLite (local) | €0 |
| Desarrollo | Herramientas locales (VS Code, QGIS) | €0 |
| Hospedaje frontend | GitHub Pages / Netlify | €0 |
| Hospedaje backend (opcional) | PythonAnywhere (tier Beginner) | ~€5/mes |
| Dominio personalizado (opcional) | Proveedor económico (.xyz, .tech) | ~€10/año |

**Total máximo estimado**: ~€70/año (con todas las opciones)
**Opción mínima viable**: €0 (utilizando solo servicios gratuitos)

## Ventajas de esta arquitectura para proyecto académico

1. **Simplicidad**: Enfoque straightforward sin componentes innecesarios
2. **Coste mínimo**: Utiliza principalmente servicios gratuitos
3. **Open source**: Todas las tecnologías propuestas son de código abierto
4. **Educativo**: Cubre el proceso completo de extracción, procesamiento y visualización
5. **Ampliable**: Puede expandirse si el proyecto crece posteriormente


# Arquitectura general para proyecto académico de mapa de yacimientos arqueológicos y paleontológicos. Arquitectura para un desarrollo CON tecnologías Big Data

## Visión general de la arquitectura

```
+-------------------+     +-------------------+     +-------------------+     +-------------------+     +-------------------+
|  EXTRACCIÓN       |     | ALMACENAMIENTO    |     | PROCESAMIENTO     |     | BASES DE DATOS    |     | VISUALIZACIÓN     |
|  DATOS            |     | DISTRIBUIDO       |     | DISTRIBUIDO       |     | ESPECIALIZADAS    |     | FRONTEND          |
|                   |     |                   |     |                   |     |                   |     |                   |
| - Overpass API    | --> | - HDFS           | --> | - Apache Spark    | --> | - PostgreSQL/     | --> | - Leaflet         |
| - OSM Planet XML  |     |                   |     |                   |     |   PostGIS         |     | - HTML/CSS/JS     |
| - Osmium Tool     |     |                   |     |                   |     | - Hive/Impala     |     |                   |
+-------------------+     +-------------------+     +-------------------+     +-------------------+     +-------------------+
```

## Componentes detallados

### 1. Extracción de datos
- **Fuente principal**: OSM Planet XML (~144 GB)
- **Herramientas**: 
  - Overpass API para extracción específica
  - Osmium Tool para preprocesamiento inicial
  - Scripts personalizados para carga en HDFS

### 2. Almacenamiento distribuido
- **HDFS (Hadoop Distributed File System)**:
  - Distribución: Apache Hadoop (versión 3.x)
  - Configuración: Clúster mínimo con 1 NameNode y 2 DataNodes
  - Formato de datos: Parquet (columnar, eficiente para consultas analíticas)
  - Particionamiento: Por región geográfica y tipo de yacimiento

### 3. Procesamiento distribuido
- **Apache Spark**:
  - Core para procesamiento general
  - Spark SQL para consultas estructuradas
  - GeoSpark o Sedona para procesamiento geoespacial
  - Tareas:
    - Limpieza y normalización de datos
    - Extracción de yacimientos arqueológicos/paleontológicos
    - Enriquecimiento con metadatos adicionales
    - Análisis espacial (proximidad, clustering)

### 4. Bases de datos especializadas
- **Base de datos geoespacial**:
  - **PostgreSQL con PostGIS**:
    - Almacenamiento optimizado para datos espaciales
    - Índices espaciales para consultas eficientes
    - Soporte completo para operaciones geoespaciales

- **Capa de consulta analítica**:
  - **Apache Hive**:
    - Consultas SQL sobre datos en HDFS
    - Tablas particionadas por región y tipo
    - Integración con Spark para procesamiento
  - **Apache Impala** (alternativa):
    - Consultas de baja latencia
    - Mejor rendimiento para consultas interactivas

### 5. Capa de API y servicio
- **API REST geoespacial**:
  - Framework: Flask con GeoAlchemy
  - Endpoints principales:
    - `/api/sites` (con filtros por tipo, época, región)
    - `/api/stats` (estadísticas agregadas)
  - Formatos de respuesta: GeoJSON, TopoJSON

### 6. Frontend de visualización
- **Mapa interactivo**:
  - Biblioteca: Leaflet
  - Capas base: OpenStreetMap, CartoDB, Stamen
  - Controles de filtrado dinámico
  - Popups informativos
  - Clustering para manejo de grandes volúmenes

## Flujo de trabajo

1. **Ingesta inicial**:
   - Descarga de OSM Planet XML
   - Preprocesamiento con Osmium para reducir tamaño
   - Carga en HDFS (formato Parquet)

2. **Procesamiento con Spark**:
   ```python
   from pyspark.sql import SparkSession
   from pyspark.sql.functions import *
   
   spark = SparkSession.builder \
       .appName("OSM Archaeological Sites") \
       .config("spark.jars.packages", "org.apache.sedona:sedona-python-adapter-3.0_2.12:1.0.0") \
       .getOrCreate()
   
   osm_data = spark.read.parquet("hdfs:///data/osm/planet")
   
   archaeological_sites = osm_data.filter(
       (col("tags.historic") == "archaeological_site") | 
       (col("tags.site_type") == "paleontological_site")
   )
   
   processed_sites = archaeological_sites \
       .withColumn("site_type", when(col("tags.site_type") == "paleontological_site", "paleontological").otherwise("archaeological")) \
       .withColumn("period", col("tags.period")) \
       .withColumn("geometry", st_geomFromWKT(col("wkt")))
   
   processed_sites.write.saveAsTable("archaeological_sites")
   ```

3. **Carga en bases de datos especializadas**:
   - Exportar resultados de Spark a PostgreSQL/PostGIS
   - Crear tablas e índices espaciales en PostGIS
   - Configurar vistas en Hive para consultas analíticas

4. **Despliegue de API**:
   - Implementación en Flask con endpoints RESTful

5. **Implementación de frontend**:
   - Página HTML con mapa Leaflet
   - Conexión con API mediante AJAX
   - Controles de filtrado y visualización

## Ventajas de esta arquitectura

1. **Escalabilidad**: Preparada para manejar el volumen completo de datos OSM
2. **Procesamiento distribuido**: Capacidad para análisis espacial avanzado
3. **Consultas especializadas**: Integración con PostGIS y Hive para diferentes necesidades
4. **Open source y flexible**: Puede adaptarse a diferentes entornos y cargas de trabajo

