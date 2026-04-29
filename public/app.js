// ── userId ──
const userId = localStorage.getItem('userId') || (() => {
  const id = 'user_' + Math.random().toString(36).slice(2, 9);
  localStorage.setItem('userId', id);
  return id;
})();

// ── 地圖初始化 ──
const map = L.map('map').setView([25.0155, 121.5340], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ── 狀態 ──
let selectedStart = null;
let selectedEnd = null;
let routePolyline = null;
let lastRouteResult = null;
let locationMarkers = {};

// ── 地點 Marker ──
async function loadLocations() {
  const res = await fetch('/api/locations');
  const locations = await res.json();

  locations.forEach(loc => {
    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: 9,
      color: '#1d4ed8',
      fillColor: '#93c5fd',
      fillOpacity: 0.9,
      weight: 2
    }).addTo(map).bindTooltip(loc.name, { permanent: false });

    marker.on('click', () => selectLocation(loc, marker));
    locationMarkers[loc.id] = { marker, loc };
  });
}

function resetMarkerStyle(id) {
  if (!locationMarkers[id]) return;
  locationMarkers[id].marker.setStyle({
    color: '#1d4ed8', fillColor: '#93c5fd'
  });
}

function selectLocation(loc, marker) {
  if (!selectedStart) {
    selectedStart = loc;
    marker.setStyle({ color: '#15803d', fillColor: '#86efac' });
    document.getElementById('start-label').textContent = loc.name;
  } else if (!selectedEnd && loc.id !== selectedStart.id) {
    selectedEnd = loc;
    marker.setStyle({ color: '#dc2626', fillColor: '#fca5a5' });
    document.getElementById('end-label').textContent = loc.name;
    fetchRoute();
  }
}

// ── 重新選擇 ──
document.getElementById('reset-btn').addEventListener('click', () => {
  if (selectedStart) resetMarkerStyle(selectedStart.id);
  if (selectedEnd)   resetMarkerStyle(selectedEnd.id);
  selectedStart = null;
  selectedEnd = null;
  lastRouteResult = null;
  if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }
  document.getElementById('start-label').textContent = '未選擇';
  document.getElementById('end-label').textContent = '未選擇';
  document.getElementById('route-info').textContent = '尚未規劃路線';
});

// ── 路線計算 ──
async function fetchRoute() {
  document.getElementById('route-info').textContent = '計算中...';
  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startId: selectedStart.id, endId: selectedEnd.id })
    });
    const data = await res.json();

    if (data.error) {
      document.getElementById('route-info').textContent = data.error;
      return;
    }

    lastRouteResult = data;
    if (routePolyline) map.removeLayer(routePolyline);
    const latlngs = data.path.map(n => [n.lat, n.lng]);
    routePolyline = L.polyline(latlngs, { color: '#1d4ed8', weight: 5, opacity: 0.8 }).addTo(map);
    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    document.getElementById('route-info').textContent =
      `距離：${data.distanceKm} 公里 ／ 預估 ${data.minutes} 分鐘`;
  } catch {
    document.getElementById('route-info').textContent = '路線計算失敗';
  }
}

// ── 活動列表 ──
async function loadEvents() {
  const res = await fetch('/api/events');
  const events = await res.json();
  const container = document.getElementById('event-list');

  if (events.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:#94a3b8">目前沒有活動</p>';
    return;
  }

  container.innerHTML = events.map(ev => {
    const isFull   = ev.participants.length >= ev.maxParticipants;
    const isJoined = ev.participants.includes(userId);
    const dateStr  = new Date(ev.dateTime).toLocaleString('zh-TW', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const badge = isJoined ? `<span class="badge badge-joined">已加入</span>`
                : isFull   ? `<span class="badge badge-full">人數已滿</span>`
                           : `<span class="badge badge-open">招募中</span>`;

    const actionBtn = isJoined
      ? `<button class="btn-leave" onclick="leaveEvent('${ev.id}')">退出</button>`
      : isFull
        ? `<button class="btn-disabled" disabled>已滿</button>`
        : `<button class="btn-join" onclick="joinEvent('${ev.id}')">加入</button>`;

    return `
      <div class="event-card">
        <h3>${ev.title}</h3>
        <div class="meta">📅 ${dateStr}</div>
        <div class="meta">👥 ${ev.participants.length} / ${ev.maxParticipants} 人</div>
        <div class="meta">📍 ${ev.routeDistance ? ev.routeDistance.toFixed(2) + ' 公里・' + ev.routeMinutes + ' 分鐘' : '路線未設定'}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
          ${badge}
          <div class="event-actions" style="width:auto;margin:0">${actionBtn}</div>
        </div>
      </div>`;
  }).join('');

  // 橘色活動 Marker
  events.forEach(ev => {
    if (!ev.startLocationCoords) return;
    const { lat, lng } = ev.startLocationCoords;
    L.circleMarker([lat, lng], {
      radius: 11, color: '#ea580c', fillColor: '#fdba74', fillOpacity: 0.9, weight: 2
    }).addTo(map).bindPopup(`
      <b>${ev.title}</b><br>
      ${new Date(ev.dateTime).toLocaleString('zh-TW')}<br>
      ${ev.participants.length}／${ev.maxParticipants} 人<br>
      ${ev.routeDistance ? ev.routeDistance.toFixed(2) + ' 公里・' + ev.routeMinutes + ' 分鐘' : ''}
    `);
  });
}

// ── 加入 / 退出 ──
async function joinEvent(eventId) {
  const res = await fetch(`/api/events/${eventId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  await loadEvents();
}

async function leaveEvent(eventId) {
  const res = await fetch(`/api/events/${eventId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  await loadEvents();
}

// ── 建立活動 ──
document.getElementById('create-event-btn').addEventListener('click', async () => {
  if (!lastRouteResult || !selectedStart) {
    alert('請先在地圖上規劃路線'); return;
  }
  const title          = document.getElementById('event-title').value.trim();
  const dateTime       = document.getElementById('event-datetime').value;
  const maxParticipants = document.getElementById('event-max').value;

  if (!title || !dateTime || !maxParticipants) {
    alert('請填寫所有活動欄位'); return;
  }

  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title, dateTime, maxParticipants, createdBy: userId,
      startLocation: selectedStart.id,
      startLocationCoords: { lat: selectedStart.lat, lng: selectedStart.lng },
      routeId: lastRouteResult.routeId,
      routeDistance: lastRouteResult.distanceKm,
      routeMinutes: lastRouteResult.minutes
    })
  });

  const data = await res.json();
  if (data.error) { alert(data.error); return; }

  document.getElementById('event-title').value = '';
  document.getElementById('event-datetime').value = '';
  document.getElementById('event-max').value = '';
  alert('活動建立成功！');
  await loadEvents();
});

// ── 初始化 ──
loadLocations();
loadEvents();