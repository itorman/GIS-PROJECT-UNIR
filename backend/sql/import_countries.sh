#!/bin/bash

# Database connection parameters
DB_NAME="OSM"
DB_USER="postgres"
DB_PORT="5433"
DB_PASSWORD="Pichurri1972"
SHAPEFILE="/Users/aitor/Library/CloudStorage/OneDrive-UNIR/Estudios/MASTER/TFE/CODIGO/Projecto/arqueologia/data/natural_earth/ne_10m_admin_0_countries"

# Export password to avoid prompt
export PGPASSWORD="$DB_PASSWORD"

# Drop existing table if it exists
psql -d "$DB_NAME" -U "$DB_USER" -p "$DB_PORT" -c "DROP TABLE IF EXISTS world_countries;"

# Use ogr2ogr to import the shapefile directly into PostgreSQL
ogr2ogr -f "PostgreSQL" \
    PG:"dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD port=$DB_PORT" \
    "$SHAPEFILE.shp" \
    -nln world_countries \
    -lco GEOMETRY_NAME=geom \
    -lco FID=id \
    -nlt MULTIPOLYGON \
    -s_srs EPSG:4326 \
    -t_srs EPSG:4326 \
    -select "name,name_long,iso_a2,iso_a3" \
    --config PG_USE_COPY YES

# Create spatial index
psql -d "$DB_NAME" -U "$DB_USER" -p "$DB_PORT" -c "
CREATE INDEX IF NOT EXISTS world_countries_geom_idx ON world_countries USING GIST (geom);
"

# Add Spanish name column and update common names
psql -d "$DB_NAME" -U "$DB_USER" -p "$DB_PORT" -c "
ALTER TABLE world_countries ADD COLUMN IF NOT EXISTS name_es VARCHAR(100);
UPDATE world_countries SET name_es = COALESCE(name_long, name);

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
);"

# Show count of imported countries
psql -d "$DB_NAME" -U "$DB_USER" -p "$DB_PORT" -c "SELECT COUNT(*) FROM world_countries;"

# Unset password
unset PGPASSWORD

echo "Country data import completed!"