const Graph = require('./graph');
const fs = require('fs');
const path = require('path');

function buildGraph() {
  const locations = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../data/locations.json'), 'utf-8'
  ));
  const routes = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../data/routes.json'), 'utf-8'
  ));

  const graph = new Graph();
  locations.forEach(loc => graph.addNode(loc.id));
  routes.forEach(r => graph.addEdge(r.from, r.to, r.distance));
  return graph;
}

// 簡易 Min-Priority Queue
class MinPQ {
  constructor() { this.heap = []; }

  push(item) {
    this.heap.push(item);
    this.heap.sort((a, b) => a.priority - b.priority);
  }

  pop() { return this.heap.shift(); }
  isEmpty() { return this.heap.length === 0; }
}

function dijkstra(startId, endId) {
  const graph = buildGraph();

  if (!graph.hasNode(startId) || !graph.hasNode(endId)) {
    return null;
  }

  const distances = {};
  const previous = {};
  const pq = new MinPQ();

  // 初始化所有節點距離為無限大
  Object.keys(graph.adjacencyList).forEach(id => {
    distances[id] = Infinity;
    previous[id] = null;
  });
  distances[startId] = 0;
  pq.push({ node: startId, priority: 0 });

  while (!pq.isEmpty()) {
    const { node: current } = pq.pop();

    if (current === endId) break;

    graph.getNeighbors(current).forEach(({ node: neighbor, distance }) => {
      const newDist = distances[current] + distance;
      if (newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        previous[neighbor] = current;
        pq.push({ node: neighbor, priority: newDist });
      }
    });
  }

  // 無法到達
  if (distances[endId] === Infinity) return null;

  // 回溯路徑
  const pathIds = [];
  let current = endId;
  while (current) {
    pathIds.unshift(current);
    current = previous[current];
  }

  return {
    pathIds,
    distance: distances[endId] // 單位：公尺
  };
}

module.exports = { dijkstra };