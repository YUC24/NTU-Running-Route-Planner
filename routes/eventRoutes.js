const express = require('express');
const fs = require('fs');
const path = require('path');
const writeLock = require('../middleware/writeLock');
const router = express.Router();

const DATA_PATH = path.join(__dirname, '../data/events.json');

function readEvents() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}
function writeEvents(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// 取得所有活動（含路線距離/時間資訊）
router.get('/', (req, res) => {
  const { events } = readEvents();
  res.json(events);
});

// 建立活動
router.post('/', writeLock, (req, res) => {
  const { title, startLocation, routeId, routeDistance, routeMinutes, dateTime, maxParticipants, createdBy } = req.body;
  const data = readEvents();
  const newEvent = {
    id: 'e' + Date.now(),
    title,
    startLocation,
    routeId,
    routeDistance,   // 公里，從 Dijkstra 結果帶入
    routeMinutes,    // 預估分鐘
    dateTime,
    maxParticipants: Number(maxParticipants),
    participants: [createdBy],
    createdBy
  };
  data.events.push(newEvent);
  writeEvents(data);
  res.status(201).json(newEvent);
});

// 加入活動
router.post('/:id/join', writeLock, (req, res) => {
  const { userId } = req.body;
  const data = readEvents();
  const event = data.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: '活動不存在' });
  if (event.participants.includes(userId)) return res.status(400).json({ error: '已加入此活動' });
  if (event.participants.length >= event.maxParticipants) return res.status(400).json({ error: '活動人數已滿' });
  event.participants.push(userId);
  writeEvents(data);
  res.json(event);
});

// 退出活動
router.post('/:id/leave', writeLock, (req, res) => {
  const { userId } = req.body;
  const data = readEvents();
  const event = data.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: '活動不存在' });
  if (event.createdBy === userId) return res.status(400).json({ error: '建立者不能退出活動' });
  event.participants = event.participants.filter(p => p !== userId);
  writeEvents(data);
  res.json(event);
});

module.exports = router;