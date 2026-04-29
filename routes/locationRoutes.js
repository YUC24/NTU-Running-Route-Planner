const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_PATH = path.join(__dirname, '../data/locations.json');

router.get('/', (req, res) => {
  const locations = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  res.json(locations);
});

module.exports = router;