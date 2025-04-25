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

// Obtener nodos en formato GeoJSON (ideal para Leaflet)
router.get('/geojson', async (req, res) => {
  try {
    const { name, office, operator } = req.query;
    
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
    
    // Añadir LIMIT para evitar devolver demasiados datos
    query += ` LIMIT 1000`;
    
    const result = await db.query(query, params);
    
    // Convertir a formato GeoJSON
    const geoJSON = {
      type: 'FeatureCollection',
      features: result.rows.map(row => {
        return {
          type: 'Feature',
          geometry: row.geometry,
          properties: {
            osm_id: row.osm_id,
            name: row.name,
            office: row.office,
            operator: row.operator
          }
        };
      })
    };
    
    res.json(geoJSON);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener nodos en formato GeoJSON' });
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