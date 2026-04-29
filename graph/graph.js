class Graph {
  constructor() {
    this.adjacencyList = {};
  }

  addNode(id) {
    if (!this.adjacencyList[id]) {
      this.adjacencyList[id] = [];
    }
  }

  addEdge(fromId, toId, distance) {
    this.adjacencyList[fromId].push({ node: toId, distance });
    this.adjacencyList[toId].push({ node: fromId, distance }); // 雙向
  }

  getNeighbors(id) {
    return this.adjacencyList[id] || [];
  }

  hasNode(id) {
    return !!this.adjacencyList[id];
  }
}

module.exports = Graph;