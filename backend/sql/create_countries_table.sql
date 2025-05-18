-- Crear tabla para los países
CREATE TABLE IF NOT EXISTS countries_polygons (
    gid SERIAL PRIMARY KEY,
    country_name VARCHAR(100),
    country_code VARCHAR(2),
    geom geometry(MultiPolygon, 4326)
);

-- Crear índice espacial
CREATE INDEX IF NOT EXISTS countries_polygons_geom_idx 
ON countries_polygons USING GIST (geom);

-- Crear índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS countries_polygons_name_idx 
ON countries_polygons (country_name); 