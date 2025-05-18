-- Crear tabla para países del mundo
CREATE TABLE IF NOT EXISTS world_countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    name_es VARCHAR(100),  -- Nombre en español si está disponible
    iso_a2 CHAR(2),       -- Código ISO de 2 letras
    iso_a3 CHAR(3),       -- Código ISO de 3 letras
    geom geometry(MultiPolygon, 4326)
);

-- Crear índice espacial para búsquedas geográficas eficientes
CREATE INDEX IF NOT EXISTS world_countries_geom_idx 
ON world_countries USING GIST (geom);

-- Crear índices para búsquedas por nombre
CREATE INDEX IF NOT EXISTS world_countries_name_idx 
ON world_countries (name);

CREATE INDEX IF NOT EXISTS world_countries_name_es_idx 
ON world_countries (name_es);

-- Crear función para determinar el país de un punto
CREATE OR REPLACE FUNCTION get_country_for_point(point_geom geometry)
RETURNS TABLE (
    country_name VARCHAR,
    country_name_es VARCHAR,
    iso_a2 CHAR(2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wc.name,
        wc.name_es,
        wc.iso_a2
    FROM world_countries wc
    WHERE ST_Contains(wc.geom, ST_Transform(point_geom, 4326))
    LIMIT 1;
END;
$$ LANGUAGE plpgsql; 