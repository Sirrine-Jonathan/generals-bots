// Terrain Constants.
// Any tile with a nonnegative value is owned by the player corresponding to its value.
// For example, a tile with value 1 is owned by the player with playerIndex = 1.
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4; // Cities and Mountains show up as Obstacles in the fog of war.

module.exports = class Bot {

  // Game data from game_start
  playerIndex;
  replay_id;
  chat_room;
  team_chat_room;
  usernames;
  teams;

  // Useful props updated on game update
  gameTick = 0;
  ticksTilPayday = 25;

  generals; // The indicies of generals we have vision of.
  cities = []; // The indicies of cities we have vision of.
  map = [];
  constructor(socket){
    this.socket = socket;
  }
  /* Returns a new array created by patching the diff into the old array.
  * The diff formatted with alternating matching and mismatching segments:
  * Example 1: patching a diff of [1, 1, 3] onto [0, 0] yields [0, 3].
  * Example 2: patching a diff of [0, 1, 2, 1] onto [0, 0] yields [2, 0].
  * 
  * First element of diff is how many are matching.
  * Patch will copy that number of elements to out.
  * Next element in diff is how many are differnt.
  * If num different is x, then the next x elements will be the changes.
  * Patch will copy the next x number of elements of diff to out.
  * Next elements will be how many are matching, and will follow the above pattern
  */
  patch(old, diff){
    const out = [];
    let i = 0;
    while (i < diff.length) {
      if (diff[i]) { // matching
        Array.prototype.push.apply(out, old.slice(out.length, out.length + diff[i]));
      }
      i++;
      if (i < diff.length && diff[i]) { // mismatching
        Array.prototype.push.apply(out, diff.slice(i + 1, i + 1 + diff[i]));
        i += diff[i];
      }
      i++;
    }
    return out;
  }

  update = (data) => {
    this.gameTick = Math.floor(data.turn / 2);
    this.ticksTilPayday = 25 - this.gameTick % 25;

    // Patch the city and map diffs into our local variables.
    this.cities = this.patch(this.cities, data.cities_diff);
    this.map = this.patch(this.map, data.map_diff);
    this.generals = data.generals;

    // The first two terms in |map| are the dimensions.
    const width = this.map[0];
    const height = this.map[1];
    const size = width * height;

    // The next |size| terms are army values.
    // armies[0] is the top-left corner of the map.
    const armies = this.map.slice(2, size + 2);

    // The last |size| terms are terrain values.
    // terrain[0] is the top-left corner of the map.
    const terrain = this.map.slice(size + 2, size + 2 + size);


    // Make a random move.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Pick a random tile.
      const index = Math.floor(Math.random() * size);

      // If we own this tile, make a random move starting from it.
      if (terrain[index] === this.playerIndex) {
        const row = Math.floor(index / width);
        const col = index % width;
        let endIndex = index;

        const rand = Math.random();
        if (rand < 0.25 && col > 0) { // left
          endIndex--;
        } else if (rand < 0.5 && col < width - 1) { // right
          endIndex++;
        } else if (rand < 0.75 && row < height - 1) { // down
          endIndex += width;
        } else if (row > 0) { // up
          endIndex -= width;
        } else {
          continue;
        }

        // Would we be attacking a city? Don't attack cities.
        if (this.cities.indexOf(endIndex) >= 0) {
          continue;
        }

        this.socket.emit("attack", index, endIndex);
        break;
      }
    }
  }

  // get distance between two tiles
  // get x, y of tile
  // find closest two tiles of set
  // get set of owned tiles
  // get set of enemey tiles

  // farm armies,
  // take city
  // find general
  // take general
  // defend geneneral


  // at start, find city + farm + add armies to general
  // if someone is in site, attack their armies
}
