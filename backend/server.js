const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pointRoutes = require('./routes/sites');  // Renombra el archivo o cambia este import

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/point', pointRoutes);  // Cambiamos a /api/point

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de nodos OSM funcionando');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});