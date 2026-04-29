const express = require('express');
const cors = require('cors');
const path = require('path');

const locationRoutes = require('./routes/locationRoutes');
const routeRoutes = require('./routes/routeRoutes');
const eventRoutes = require('./routes/eventRoutes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/locations', locationRoutes);
app.use('/api/route', routeRoutes);
app.use('/api/events', eventRoutes);

app.listen(PORT, () => {
  console.log(`伺服器啟動：http://localhost:${PORT}`);
});