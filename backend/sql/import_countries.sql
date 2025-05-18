-- First, ensure we have the PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop the final table if it exists
DROP TABLE IF EXISTS world_countries;

-- Create the world_countries table first
CREATE TABLE world_countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    name_es VARCHAR(100),
    iso_a2 VARCHAR(2),
    iso_a3 VARCHAR(3),
    geom geometry(MultiPolygon, 4326)
);

-- Create indices for the final table
CREATE INDEX world_countries_geom_idx ON world_countries USING GIST (geom);
CREATE INDEX world_countries_name_idx ON world_countries (name);
CREATE INDEX world_countries_name_es_idx ON world_countries (name_es);

-- The temp_countries table will be created by shp2pgsql
-- We'll insert directly from it after it's created

-- After shp2pgsql runs, insert the data
INSERT INTO world_countries (name, name_es, iso_a2, iso_a3, geom)
SELECT 
    COALESCE(name_long, name, admin, sovereignt) as name,
    COALESCE(name_long, name, admin, sovereignt) as name_es,
    NULLIF(TRIM(iso_a2), '') as iso_a2,
    NULLIF(TRIM(iso_a3), '') as iso_a3,
    geom
FROM temp_countries
WHERE geom IS NOT NULL;

-- Update Spanish names for common countries
UPDATE world_countries SET name_es = CASE name
    WHEN 'Spain' THEN 'España'
    WHEN 'France' THEN 'Francia'
    WHEN 'Germany' THEN 'Alemania'
    WHEN 'Italy' THEN 'Italia'
    WHEN 'Portugal' THEN 'Portugal'
    WHEN 'United Kingdom' THEN 'Reino Unido'
    WHEN 'United States of America' THEN 'Estados Unidos'
    WHEN 'Mexico' THEN 'México'
    WHEN 'Brazil' THEN 'Brasil'
    WHEN 'Argentina' THEN 'Argentina'
    WHEN 'China' THEN 'China'
    WHEN 'Japan' THEN 'Japón'
    WHEN 'Russia' THEN 'Rusia'
    WHEN 'India' THEN 'India'
    WHEN 'Greece' THEN 'Grecia'
    WHEN 'Turkey' THEN 'Turquía'
    WHEN 'Egypt' THEN 'Egipto'
    WHEN 'Morocco' THEN 'Marruecos'
    WHEN 'Tunisia' THEN 'Túnez'
    WHEN 'Algeria' THEN 'Argelia'
    ELSE name_es
END
WHERE name IN (
    'Spain', 'France', 'Germany', 'Italy', 'Portugal', 'United Kingdom',
    'United States of America', 'Mexico', 'Brazil', 'Argentina', 'China',
    'Japan', 'Russia', 'India', 'Greece', 'Turkey', 'Egypt', 'Morocco',
    'Tunisia', 'Algeria'
);