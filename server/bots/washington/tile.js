module.exports = class Tile {
  constructor(index, type) {
    this.index = index;
    this.type = type;
    this.armies = null;
    this.visited = false;
  }

  setArmies = (armies) => {
    this.armies = armies;
  }

  setVisited = (visited) => {
    this.visited = visited;
  }
}