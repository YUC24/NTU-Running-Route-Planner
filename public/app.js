// ── userId ──
const userId = localStorage.getItem('userId') || (() => {
  const id = 'user_' + Math.random().toString(36).slice(2, 9);
  localStorage.setItem('userId', id);
  return id;
})();

// ── 狀態 ──
let map;
let selectedStart = null;
let selectedEnd = null;
let lastRouteResult = null;
let directionsRenderer = null;
let locationMarkers = {};
let eventMarkers = [];

// ── Google Maps 初始化（callback from script tag）──
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 25.0155, lng: 121.5340 },
    zoom: 15,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });

  directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#1d4ed8',
      strokeWeight: 5,
      strokeOpacity: 0.85
    }
  });

  loadLocations();
  loadEvents();
}

// ── 地點 Marker ──
async function loadLocations() {
  const res = await fetch('/api/locations');
  const locations = await res.json();

  locations.forEach(loc => {
    const marker = new google.maps.Marker({
      position: { lat: loc.lat, lng: loc.lng },
      map,
      title: loc.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#93c5fd',
        fillOpacity: 0.9,
        strokeColor: '#1d4ed8',
        strokeWeight: 2
      }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="font-size:13px;font-weight:600">${loc.name}</div>`
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
      selectLocation(loc, marker);
    });

    locationMarkers[loc.id] = { marker, loc };
  });
}

function resetMarkerStyle(id) {
  if (!locationMarkers[id]) return;
  locationMarkers[id].marker.setIcon({
    path: google.maps.SymbolPath.CIRCLE,
    scale: 9,
    fillColor: '#93c5fd',
    fillOpacity: 0.9,
    strokeColor: '#1d4ed8',
    strokeWeight: 2
  });
}

function selectLocation(loc, marker) {
  if (!selectedStart) {
    selectedStart = loc;
    marker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#86efac',
      fillOpacity: 0.9,
      strokeColor: '#15803d',
      strokeWeight: 2
    });
    document.getElementById('start-label').textContent = loc.name;

  } else if (!selectedEnd && loc.id !== selectedStart.id) {
    selectedEnd = loc;
    marker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#fca5a5',
      fillOpacity: 0.9,
      strokeColor: '#dc2626',
      strokeWeight: 2
    });
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
  if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  document.getElementById('start-label').textContent = '未選擇';
  document.getElementById('end-label').textContent = '未選擇';
  document.getElementById('route-info').textContent = '尚未規劃路線';
});

// ── 路線計算（Dijkstra 決定節點順序，Google Directions 畫真實步行路線）──
async function fetchRoute() {
  document.getElementById('route-info').textContent = '計算中...';

  try {
    // 1. 後端 Dijkstra 取得節點順序
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

    // 2. 用 Google Directions API 沿真實步行道路畫線
    //    中間節點作為 waypoints 傳入
    const directionsService = new google.maps.DirectionsService();

    const waypoints = data.path.slice(1, -1).map(node => ({
      location: new google.maps.LatLng(node.lat, node.lng),
      stopover: false
    }));

    const start = data.path[0];
    const end   = data.path[data.path.length - 1];

    directionsService.route({
      origin:      new google.maps.LatLng(start.lat, start.lng),
      destination: new google.maps.LatLng(end.lat, end.lng),
      waypoints,
      travelMode:  google.maps.TravelMode.WALKING,
      region: 'TW'
    }, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);

        // 從 Google 回傳的結果取得實際距離與時間
        const legs = result.routes[0].legs;
        const totalDistance = legs.reduce((sum, leg) => sum + leg.distance.value, 0);
        const totalDuration = legs.reduce((sum, leg) => sum + leg.duration.value, 0);
        const distanceKm = (totalDistance / 1000).toFixed(2);
        const minutes    = Math.round(totalDuration / 60);

        // 更新 lastRouteResult 為 Google 實際計算的數值
        lastRouteResult.distanceKm = parseFloat(distanceKm);
        lastRouteResult.minutes    = minutes;

        document.getElementById('route-info').textContent =
          `距離：${distanceKm} 公里 ／ 預估 ${minutes} 分鐘`;
      } else {
        document.getElementById('route-info').textContent = `路線計算失敗：${status}`;
      }
    });

  } catch {
    document.getElementById('route-info').textContent = '路線計算失敗，請再試一次';
  }
}

// ── 活動列表 ──
async function loadEvents() {
  const res = await fetch('/api/events');
  const events = await res.json();
  const container = document.getElementById('event-list');

  // 清除舊活動 marker
  eventMarkers.forEach(m => m.setMap(null));
  eventMarkers = [];

  if (events.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:#94a3b8">目前沒有活動</p>';
    return;
  }

  container.innerHTML = events.map(ev => {
    const isFull   = ev.participants.length >= ev.maxParticipants;
    const isJoined = ev.participants.includes(userId);
    const dateStr  = new Date(ev.dateTime).toLocaleString('zh-TW', {
      month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const badge = isJoined
      ? `<span class="badge badge-joined">已加入</span>`
      : isFull
        ? `<span class="badge badge-full">人數已滿</span>`
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
        <div class="meta">📍 ${ev.routeDistance
          ? ev.routeDistance.toFixed(2) + ' 公里・' + ev.routeMinutes + ' 分鐘'
          : '路線未設定'}</div>
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

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: ev.title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 11,
        fillColor: '#fdba74',
        fillOpacity: 0.9,
        strokeColor: '#ea580c',
        strokeWeight: 2
      }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="font-size:13px">
          <b>${ev.title}</b><br>
          ${new Date(ev.dateTime).toLocaleString('zh-TW')}<br>
          ${ev.participants.length}／${ev.maxParticipants} 人<br>
          ${ev.routeDistance
            ? ev.routeDistance.toFixed(2) + ' 公里・' + ev.routeMinutes + ' 分鐘'
            : ''}
        </div>`
    });

    marker.addListener('click', () => infoWindow.open(map, marker));
    eventMarkers.push(marker);
  });
}

// ── 加入活動 ──
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

// ── 退出活動 ──
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
  const title           = document.getElementById('event-title').value.trim();
  const dateTime        = document.getElementById('event-datetime').value;
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