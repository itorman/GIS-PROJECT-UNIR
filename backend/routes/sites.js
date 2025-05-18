const express = require('express');
const router = express.Router();
const db = require('../db');

// Ruta para obtener todos los nodos
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        osm_id, 
        name, 
        office, 
        operator,
        ST_AsGeoJSON(way)::json as geometry
      FROM planet_osm_point
      LIMIT 500
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener nodos' });
  }
});

// Ruta para filtrar nodos por name, office y operator
router.get('/filtrar', async (req, res) => {
  try {
    const { name, office, operator } = req.query;
    
    // Validación de parámetros
    if (!name && !office && !operator) {
      return res.status(400).json({ error: 'Debe proporcionar al menos un parámetro de búsqueda (name, office, operator).' });
    }
    
    let query = `
      SELECT 
        osm_id, 
        name, 
        office, 
        operator,
        ST_AsGeoJSON(way)::json as geometry
      FROM planet_osm_point
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (name) {
      query += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${name}%`);
      paramIndex++;
    }
    
    if (office) {
      query += ` AND office ILIKE $${paramIndex}`;
      params.push(`%${office}%`);
      paramIndex++;
    }
    
    if (operator) {
      query += ` AND operator ILIKE $${paramIndex}`;
      params.push(`%${operator}%`);
      paramIndex++;
    }
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al filtrar nodos' });
  }
});

// Obtener nodos en formato GeoJSON (ideal para Leaflet) VERSIÓN CORREGIDA CON CLAUDE 
router.get('/geojson', async (req, res) => {
  try {
    // Usamos la consulta que ya verificamos que funciona en PostgreSQL
    const query = `
      SELECT 
        osm_id, 
        name, 
        office, 
        operator,
        jsonb_build_object(
          'type', 'Point',
          'coordinates', array[
            ST_X(ST_Transform(way, 4326)), 
            ST_Y(ST_Transform(way, 4326))
          ]
        ) as geometry
      FROM planet_osm_point
      LIMIT 1000;
    `;
    
    const result = await db.query(query);
    
    // Validación de coordenadas (para evitar problemas con valores extremos)
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
          name: row.name,
          office: row.office,
          operator: row.operator
        }
      };
    });
    
    // Depuración
    console.log(`Generado ${features.length} features`);
    if (features.length > 0) {
      console.log(`Primera feature: ${JSON.stringify(features[0], null, 2)}`);
    }
    
    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error('Error al obtener los datos GeoJSON:', error);
    res.status(500).send('Error al obtener los datos GeoJSON');
  }
});
// Obtener valores únicos para los filtros
router.get('/office-values', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT office 
      FROM planet_osm_point 
      WHERE office IS NOT NULL 
      ORDER BY office
    `);
    res.json(result.rows.map(row => row.office));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener valores de office' });
  }
});

router.get('/operator-values', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT operator 
      FROM planet_osm_point 
      WHERE operator IS NOT NULL 
      ORDER BY operator
    `);
    res.json(result.rows.map(row => row.operator));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener valores de operator' });
  }
});

module.exports = router;