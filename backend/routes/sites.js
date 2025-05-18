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
      SELECT 
        osm_id, 
        name,
        jsonb_build_object(
          'type', 'Point',
          'coordinates', array[
            ST_X(ST_Transform(way, 4326)), 
            ST_Y(ST_Transform(way, 4326))
          ]
        ) as geometry
      FROM planet_osm_point
      WHERE name ILIKE $1
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
    console.error(err);
    res.status(500).json({ error: 'Error al filtrar nodos' });
  }
});

// Obtener nodos en formato GeoJSON (ideal para Leaflet)
router.get('/geojson', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 1000);

    const query = `
      SELECT 
        osm_id, 
        name,
        jsonb_build_object(
          'type', 'Point',
          'coordinates', array[
            ST_X(ST_Transform(way, 4326)), 
            ST_Y(ST_Transform(way, 4326))
          ]
        ) as geometry
      FROM planet_osm_point
      LIMIT $1;
    `;
    
    const result = await db.query(query, [limit]);
    
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
          name: row.name
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

module.exports = router;