const express = require('express');
const fs = require('fs');
const path = require('path');
const { dijkstra } = require('../graph/dijkstra');
const router = express.Router();

const LOC_PATH = path.join(__dirname, '../data/locations.json');

// 假設跑步速度 6 分鐘／公里
const PACE_MIN_PER_KM = 6;

router.post('/', (req, res) => {
  const { startId, endId } = req.body;
  if (!startId || !endId) {
    return res.status(400).json({ error: '請提供起點與終點 ID' });
  }
  if (startId === endId) {
    return res.status(400).json({ error: '起點與終點不能相同' });
  }

  const result = dijkstra(startId, endId);
  if (!result) {
    return res.status(404).json({ error: '找不到可用路線' });
  }

  const locations = JSON.parse(fs.readFileSync(LOC_PATH, 'utf-8'));
  const locMap = {};
  locations.forEach(l => { locMap[l.id] = l; });

  const path = result.pathIds.map(id => ({
    id,
    name: locMap[id].name,
    lat: locMap[id].lat,
    lng: locMap[id].lng
  }));

  const distanceKm = result.distance / 1000;
  const minutes = Math.round(distanceKm * PACE_MIN_PER_KM);

  res.json({
    routeId: `${startId}_${endId}`,
    path,
    distance: result.distance,   // 公尺
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    minutes
  });
});

module.exports = router;