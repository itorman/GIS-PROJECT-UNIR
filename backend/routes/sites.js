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
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 10000);
    const country = req.query.country;

    let query = `
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
      query += ` AND (
        wc.name = $1 OR
        wc.name_es = $1 OR
        wc.iso_a2 = $1
      )`;
    }

    query += `) 
      SELECT 
        osm_id, 
        name,
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
      LIMIT $${queryParams.length + 1}
    `;
    
    queryParams.push(limit);
    
    console.log('Ejecutando consulta con limit:', limit, 'y país:', country);
    const result = await db.query(query, queryParams);
    console.log(`Consulta ejecutada. Número de resultados: ${result.rows.length}`);
    
    // Validación de coordenadas
    const features = result.rows.map(row => {
      let coords = row.geometry.coordinates;
      
      // Validación básica para asegurar coordenadas en rangos razonables
      if (coords[1] < -85 || coords[1] > 85) {
        console.warn(`Coordenada inválida detectada: ${JSON.stringify(coords)} para osm_id ${row.osm_id}`);
      }
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coords
        },
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
          country_code: row.country_code || ''
        }
      };
    });
    
    res.json({
      type: 'FeatureCollection',
      features
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

module.exports = router;