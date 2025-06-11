const express = require('express');
const router = express.Router();
const db = require('../db');

// Ruta para filtrar nodos por name
router.get('/filtrar', async (req, res) => {
  try {
    const { name } = req.query;
    
    // Validación de parámetros
    if (!name) {
      return res.status(400).json({ error: 'Debe proporcionar un nombre para la búsqueda.' });
    }
    
    // Base de la consulta
    let query = `
      WITH point_countries AS (
        SELECT p.*, 
               COALESCE(p.tags->'addr:country', p.tags->'country') as tagged_country,
               c.country_name,
               c.country_name_es,
               c.iso_a2
        FROM planet_osm_point p
        CROSS JOIN LATERAL get_country_for_point(p.way) c
        WHERE p.name ILIKE $1
      )
      SELECT 
        osm_id, 
        name,
        COALESCE(tags->'archaeological_site', '') as archaeological_site,
        COALESCE(tags->'historic:civilization', '') as historic_civilization,
        COALESCE(tags->'website', '') as website,
        COALESCE(tags->'url', '') as url,
        COALESCE(tags->'wikidata', '') as wikidata,
        COALESCE(tags->'wikipedia', '') as wikipedia,
        COALESCE(tagged_country, country_name) as country,
        country_name_es as country_es,
        iso_a2 as country_code,
        jsonb_build_object(
          'type', 'Point',
          'coordinates', array[
            ST_X(ST_Transform(way, 4326)), 
            ST_Y(ST_Transform(way, 4326))
          ]
        ) as geometry
      FROM point_countries
    `;
    
    const result = await db.query(query, [`%${name}%`]);
    
    // Validación de coordenadas
    const validatedRows = result.rows.map(row => {
      let coords = row.geometry.coordinates;
      
      // Validación básica para asegurar coordenadas en rangos razonables
      if (coords[1] < -85 || coords[1] > 85) {
        console.warn(`Coordenada inválida detectada: ${JSON.stringify(coords)} para osm_id ${row.osm_id}`);
      }
      return row;
    });
    
    console.log(`Endpoint /filtrar generó ${validatedRows.length} registros con filtro: name=${name}`);
    
    res.json(validatedRows);
  } catch (err) {
    console.error('Error en /filtrar:', err);
    res.status(500).json({ error: 'Error al filtrar nodos', details: err.message });
  }
});

// Obtener nodos en formato GeoJSON (ideal para Leaflet)
router.get('/geojson', async (req, res) => {
  try {
    const requestedLimit = parseInt(req.query.limit) || 10;
    const unlimitedCountry = req.query.unlimited === 'true';
    const country = req.query.country;

    // Determinar si se debe aplicar un límite
    let useLimit = true;
    let limit = Math.min(Math.max(requestedLimit, 1), 10000);
    
    // Si se solicita "sin límite" y hay un país seleccionado, eliminamos el límite
    if (unlimitedCountry && country) {
      useLimit = false;
      limit = 100000; // Un valor muy alto para efectivamente no tener límite
    }
    
    // Dividir el límite entre puntos, líneas y polígonos
    const pointLimit = Math.ceil(limit / 3);
    const lineLimit = Math.ceil(limit / 3);
    const polygonLimit = Math.ceil(limit / 3);
    
    const features = [];

    // Debug: Verificar si hay polígonos arqueológicos
    let debugData = {};
    try {
      const debugQuery = `
        SELECT COUNT(*) as total 
        FROM planet_osm_polygon 
        WHERE historic = 'archaeological_site' OR tags ? 'archaeological_site'
      `;
      const debugResult = await db.query(debugQuery);
      debugData.polygon_count = parseInt(debugResult.rows[0].total);
      console.log(`Verificación de polígonos: ${debugData.polygon_count} encontrados`);
      
      // Si hay polígonos, obtener un ejemplo
      if (debugData.polygon_count > 0) {
        const sampleQuery = `
          SELECT 
            osm_id, 
            name,
            historic,
            tags
          FROM planet_osm_polygon 
          WHERE historic = 'archaeological_site' OR tags ? 'archaeological_site'
          LIMIT 1
        `;
        const sampleResult = await db.query(sampleQuery);
        debugData.sample_polygon = sampleResult.rows[0];
        console.log(`Ejemplo de polígono:`, sampleResult.rows[0]);
      }
      
      // Verificar si hay líneas arqueológicas
      const lineDebugQuery = `
        SELECT COUNT(*) as total 
        FROM planet_osm_line 
        WHERE historic = 'archaeological_site' OR tags ? 'archaeological_site'
      `;
      const lineDebugResult = await db.query(lineDebugQuery);
      debugData.line_count = parseInt(lineDebugResult.rows[0].total);
      console.log(`Verificación de líneas: ${debugData.line_count} encontrados`);
      
      // Si hay líneas, obtener un ejemplo
      if (debugData.line_count > 0) {
        const lineSampleQuery = `
          SELECT 
            osm_id, 
            name,
            historic,
            tags
          FROM planet_osm_line 
          WHERE historic = 'archaeological_site' OR tags ? 'archaeological_site'
          LIMIT 1
        `;
        const lineSampleResult = await db.query(lineSampleQuery);
        debugData.sample_line = lineSampleResult.rows[0];
        console.log(`Ejemplo de línea:`, lineSampleResult.rows[0]);
      }
    } catch (error) {
      console.error('Error en debug de elementos:', error);
    }

    // Query for points
    let pointQuery = `
      WITH point_countries AS (
        SELECT p.*, 
               wc.name as country_name,
               wc.name_es as country_name_es,
               wc.iso_a2
        FROM planet_osm_point p
        LEFT JOIN world_countries wc ON ST_Intersects(wc.geom, ST_Transform(p.way, 4326))
        WHERE p.way IS NOT NULL
        AND (p.historic = 'archaeological_site' OR p.tags ? 'archaeological_site')
    `;

    const queryParams = [];
    
    if (country) {
      queryParams.push(country);
      pointQuery += ` AND (
        wc.name = $1 OR
        wc.name_es = $1 OR
        wc.iso_a2 = $1
      )`;
    }

    pointQuery += `) 
      SELECT 
        osm_id, 
        name,
        'point' as geometry_type,
        COALESCE(tags->'archaeological_site', historic) as archaeological_site,
        COALESCE(tags->'historic:civilization', '') as historic_civilization,
        COALESCE(tags->'website', '') as website,
        COALESCE(tags->'url', '') as url,
        COALESCE(tags->'wikidata', '') as wikidata,
        COALESCE(tags->'wikipedia', '') as wikipedia,
        country_name as country,
        country_name_es as country_es,
        iso_a2 as country_code,
        jsonb_build_object(
          'type', 'Point',
          'coordinates', array[
            ST_X(ST_Transform(way, 4326)), 
            ST_Y(ST_Transform(way, 4326))
          ]
        ) as geometry
      FROM point_countries
    `;
    
    const pointParams = [...queryParams];
    if (useLimit) {
      pointQuery += ` LIMIT $${pointParams.length + 1}`;
      pointParams.push(pointLimit);
    }
    
    const pointResult = await db.query(pointQuery, pointParams);
    
    // Query for lines
    let lineQuery = `
      WITH line_countries AS (
        SELECT p.*, 
               wc.name as country_name,
               wc.name_es as country_name_es,
               wc.iso_a2
        FROM planet_osm_line p
        LEFT JOIN world_countries wc ON ST_Intersects(wc.geom, ST_Transform(p.way, 4326))
        WHERE p.way IS NOT NULL
        AND (p.historic = 'archaeological_site' OR p.tags ? 'archaeological_site')
    `;

    const lineParams = [];
    if (country) {
      lineParams.push(country);
      lineQuery += ` AND (
        wc.name = $1 OR
        wc.name_es = $1 OR
        wc.iso_a2 = $1
      )`;
    }

    lineQuery += `) 
      SELECT 
        osm_id, 
        name,
        'line' as geometry_type,
        COALESCE(tags->'archaeological_site', historic) as archaeological_site,
        COALESCE(tags->'historic:civilization', '') as historic_civilization,
        COALESCE(tags->'website', '') as website,
        COALESCE(tags->'url', '') as url,
        COALESCE(tags->'wikidata', '') as wikidata,
        COALESCE(tags->'wikipedia', '') as wikipedia,
        country_name as country,
        country_name_es as country_es,
        iso_a2 as country_code,
        ST_AsGeoJSON(ST_Transform(way, 4326)) as geometry
      FROM line_countries
    `;
    
    if (useLimit) {
      lineQuery += ` LIMIT $${lineParams.length + 1}`;
      lineParams.push(lineLimit);
    }
    
    const lineResult = await db.query(lineQuery, lineParams);
    
    // Query for polygons
    let polygonQuery = `
      WITH polygon_countries AS (
        SELECT p.*, 
               wc.name as country_name,
               wc.name_es as country_name_es,
               wc.iso_a2
        FROM planet_osm_polygon p
        LEFT JOIN world_countries wc ON ST_Intersects(wc.geom, ST_Transform(p.way, 4326))
        WHERE p.way IS NOT NULL
        AND (p.historic = 'archaeological_site' OR p.tags ? 'archaeological_site')
    `;

    const polygonParams = [];
    if (country) {
      polygonParams.push(country);
      polygonQuery += ` AND (
        wc.name = $1 OR
        wc.name_es = $1 OR
        wc.iso_a2 = $1
      )`;
    }

    polygonQuery += `) 
      SELECT 
        osm_id, 
        name,
        'polygon' as geometry_type,
        COALESCE(tags->'archaeological_site', historic) as archaeological_site,
        COALESCE(tags->'historic:civilization', '') as historic_civilization,
        COALESCE(tags->'website', '') as website,
        COALESCE(tags->'url', '') as url,
        COALESCE(tags->'wikidata', '') as wikidata,
        COALESCE(tags->'wikipedia', '') as wikipedia,
        country_name as country,
        country_name_es as country_es,
        iso_a2 as country_code,
        ST_AsGeoJSON(ST_Transform(way, 4326)) as geometry
      FROM polygon_countries
    `;
    
    if (useLimit) {
      polygonQuery += ` LIMIT $${polygonParams.length + 1}`;
      polygonParams.push(polygonLimit);
    }
    
    const polygonResult = await db.query(polygonQuery, polygonParams);
    
    console.log(`Found ${polygonResult.rows.length} polygons`);
    if (polygonResult.rows.length > 0) {
      console.log('Sample polygon row:', JSON.stringify(polygonResult.rows[0]).substring(0, 200) + '...');
    }
    
    // Process point results
    pointResult.rows.forEach(row => {
      let coords = row.geometry.coordinates;
      
      // Validación básica para asegurar coordenadas en rangos razonables
      if (coords[1] < -85 || coords[1] > 85) {
        console.warn(`Coordenada inválida detectada: ${JSON.stringify(coords)} para osm_id ${row.osm_id}`);
        return;
      }
      
      features.push({
        type: 'Feature',
        geometry: row.geometry,
        properties: {
          osm_id: row.osm_id,
          name: row.name || '',
          archaeological_site: row.archaeological_site || '',
          historic_civilization: row.historic_civilization || '',
          website: row.website || '',
          url: row.url || '',
          wikidata: row.wikidata || '',
          wikipedia: row.wikipedia || '',
          country: row.country || '',
          country_es: row.country_es || '',
          country_code: row.country_code || '',
          geometry_type: row.geometry_type
        }
      });
    });
    
    // Process line results
    lineResult.rows.forEach(row => {
      // Parse the geometry string into an object
      let geom;
      try {
        geom = JSON.parse(row.geometry);
        
        // Log the first line for debugging
        if (lineResult.rows.indexOf(row) === 0) {
          console.log('First line geometry:', JSON.stringify(geom).substring(0, 200) + '...');
        }
        
        features.push({
          type: 'Feature',
          geometry: geom,
          properties: {
            osm_id: row.osm_id,
            name: row.name || '',
            archaeological_site: row.archaeological_site || '',
            historic_civilization: row.historic_civilization || '',
            website: row.website || '',
            url: row.url || '',
            wikidata: row.wikidata || '',
            wikipedia: row.wikipedia || '',
            country: row.country || '',
            country_es: row.country_es || '',
            country_code: row.country_code || '',
            geometry_type: row.geometry_type
          }
        });
      } catch (error) {
        console.error('Error parsing line geometry:', error, 'Raw geometry:', row.geometry);
      }
    });
    
    // Process polygon results
    polygonResult.rows.forEach(row => {
      // Parse the geometry string into an object
      let geom;
      try {
        geom = JSON.parse(row.geometry);
        
        // Log the first polygon for debugging
        if (polygonResult.rows.indexOf(row) === 0) {
          console.log('First polygon geometry:', JSON.stringify(geom).substring(0, 200) + '...');
        }
        
        features.push({
          type: 'Feature',
          geometry: geom,
          properties: {
            osm_id: row.osm_id,
            name: row.name || '',
            archaeological_site: row.archaeological_site || '',
            historic_civilization: row.historic_civilization || '',
            website: row.website || '',
            url: row.url || '',
            wikidata: row.wikidata || '',
            wikipedia: row.wikipedia || '',
            country: row.country || '',
            country_es: row.country_es || '',
            country_code: row.country_code || '',
            geometry_type: row.geometry_type
          }
        });
      } catch (error) {
        console.error('Error parsing polygon geometry:', error, 'Raw geometry:', row.geometry);
      }
    });
    
    console.log(`Consulta ejecutada. Número de resultados: ${features.length} (${pointResult.rows.length} puntos, ${lineResult.rows.length} líneas, ${polygonResult.rows.length} polígonos)`);
    
    res.json({
      type: 'FeatureCollection',
      features,
      debug: {
        debug_data: debugData,
        point_count: pointResult.rows.length,
        line_count: lineResult.rows.length,
        polygon_count: polygonResult.rows.length
      }
    });
  } catch (error) {
    console.error('Error en /geojson:', error);
    res.status(500).json({ 
      error: 'Error al obtener los datos GeoJSON', 
      details: error.message,
      stack: error.stack 
    });
  }
});

// Obtener lista de países disponibles
router.get('/countries', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT 
        name as name_en,
        COALESCE(name_es, name) as name_es,
        iso_a2 as code
      FROM world_countries
      WHERE name IS NOT NULL AND name != ''
      ORDER BY name_es;
    `;

    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener la lista de países:', error);
    res.status(500).json({ 
      error: 'Error al obtener la lista de países', 
      details: error.message 
    });
  }
});

// Endpoint de debug para verificar polígonos
router.get('/debug-polygons', async (req, res) => {
  try {
    // Verificar si hay polígonos arqueológicos en la base de datos
    const query = `
      SELECT COUNT(*) as total 
      FROM planet_osm_polygon 
      WHERE historic = 'archaeological_site' OR tags ? 'archaeological_site'
    `;
    
    const result = await db.query(query);
    const totalPolygons = parseInt(result.rows[0].total);
    
    // Si hay polígonos, obtener algunos ejemplos
    let examples = [];
    if (totalPolygons > 0) {
      const examplesQuery = `
        SELECT 
          osm_id, 
          name,
          historic,
          tags->'archaeological_site' as archaeological_site_tag,
          ST_AsText(ST_Transform(way, 4326)) as wkt_geometry
        FROM planet_osm_polygon 
        WHERE historic = 'archaeological_site' OR tags ? 'archaeological_site'
        LIMIT 3
      `;
      
      const examplesResult = await db.query(examplesQuery);
      examples = examplesResult.rows;
    }
    
    res.json({
      totalPolygons,
      examples,
      message: totalPolygons > 0 
        ? `Found ${totalPolygons} archaeological polygons` 
        : 'No archaeological polygons found in the database'
    });
  } catch (error) {
    console.error('Error debugging polygons:', error);
    res.status(500).json({ 
      error: 'Error debugging polygons', 
      details: error.message 
    });
  }
});

module.exports = router;