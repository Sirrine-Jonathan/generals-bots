// Terrain Constants.
// Any tile with a nonnegative value is owned by the player corresponding to its value.
// For example, a tile with value 1 is owned by the player with playerIndex = 1.
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4; // Cities and Mountains show up as Obstacles in the fog of war.
const _TILE_OWNED = 1;
const _TILE_ENEMY = 2;
const _TILE_CITY = 3;

module.exports = class Bot {

  // Game data from game_start
  playerIndex;
  replay_id;
  chat_room;
  team_chat_room;
  usernames;
  teams;

  // Useful props updated on game update
  game_tick = 0;
  ticks_til_payday = 25;
  generals; // The indicies of generals we have vision of.
  cities = []; // The indicies of cities we have vision of.
  map = [];
  width = null;
  height = null;
  current_tile = null;
  last_move = null;
  general_tile = null;
  constructor(socket){
    this.socket = socket;
  }

  chat = (msg) => {
    this.socket.emit("chat_message", this.chat_room, msg);
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
    this.game_tick = Math.ceil(data.turn / 2);
    this.ticks_til_payday = 25 - this.game_tick % 25;

    // Patch the city and map diffs into our local variables.
    this.cities = this.patch(this.cities, data.cities_diff);
    this.map = this.patch(this.map, data.map_diff);

    // Update some other props
    this.generals = data.generals;
    this.width = this.map[0];
    this.height = this.map[1];
    this.size = this.width * this.height;
    this.armies = this.map.slice(2, this.size + 2);
    this.terrain = this.map.slice(this.size + 2, this.size + 2 + this.size);

    this.owned = this.terrain
      .map((tile, idx) => {
        if (tile === this.playerIndex){
          return idx;
        }
        return null
      })
      .filter(tile => tile !== null);
    
    if (this.terrain[this.last_move] === this.playerIndex){
      console.log('did set last move as current');
      this.current_tile = this.last_move;
    }

    if (data.turn === 1){
      this.chat('Good luck, everyone!');
      this.generalTile = this.generals[this.playerIndex];
      this.generalCoords = this.getCoords(this.generalTile);
      this.current_tile = this.owned[0];
      this.general_tile = this.owned[0];

      console.log({ 
        owned: this.owned,
        current: this.current_tile,
        options: this.getSurroundingTiles(this.current_tile),
        conditions: this.getSurroundingTerrain(this.current_tile),
      });
    }

    if (this.game_tick % 5 === 0){
    //   console.log(`tick ${this.game_tick}`);
    //   console.log({ terrain: this.terrain });
    //   console.log({ owned: this.owned, current: this.current_tile });
    }

    this.randomMove();
  }

  getRandomOwned = () => {
    const index_in_owned = Math.floor(Math.random() * this.owned.length);
    return this.owned[index_in_owned];
  }

  getSurroundingTiles = (index) => {
    return [
      this.getUp(index),
      this.getUpRight(index),
      this.getRight(index),
      this.getDownRight(index),
      this.getDown(index),
      this.getDownLeft(index),
      this.getLeft(index),
      this.getUpLeft(index)
    ]
  }

  getSurroundingTerrain = (index) => {
    return this.getSurroundingTiles(index).map(tile => this.terrain[tile]);
  }

  randomMove = (priority = [
    TILE_FOG, // Fog
    TILE_EMPTY, // Empty
    _TILE_OWNED,  // Self Owned
    _TILE_ENEMY,  // Enemy Owned
  ]) => {
    let tutorial = false;
    if (tutorial){
      while(true){
        let index = this.current_tile;
        if (index === null){
          index = this.getRandomOwned();
        }
        if (this.terrain[index] === this.playerIndex){
          
          var row = Math.floor(index / this.width);
          var col = index % this.width;
      
          var rand = Math.random();
          if (rand < 0.25 && col > 0) { // left
            console.log('left');
            this.left(index);
          } else if (rand < 0.5 && col < this.width - 1) { // right
            console.log('right');
            this.right(index);
          } else if (rand < 0.75 && row < this.height - 1) { // down
            console.log('down');
            this.down(index);
          } else if (row > 0) { //up
            console.log('up');
            this.up(index);
          } else {
            continue;
          }
          break;
        }
      }
    } else {
      let found_move = false;
      while(!found_move){
        let index = this.current_tile;
        if (index === null){
          index = this.getRandomOwned();
          console.log('got random index', index);
        }
        if (this.terrain[index] === this.playerIndex){
          let options = this.getSurroundingTerrain(index);
          for (let i = 0; i < priority.length; i++){
            if (options.includes(priority[i])){
              let option_index = options.indexOf(priority[i]);
              console.log('running option ' + option_index);
              this.optionsToMovesMap[option_index].forEach(move => {
                console.log('moving', move);
                found_move = true;
                move(index);
              })
              break;
            }
          }
          if (found_move){
            break;
          }
        } else {
          this.current_tile = null;
        }
      }
    }
  }

  // Getting surrounding tiles
  getLeft      = index => index - 1;
  getRight     = index => index + 1;
  getDown      = index => index + this.width;
  getUp        = index => index - this.width;
  getUpLeft    = index => this.getLeft(this.getUp(index));
  getUpRight   = index => this.getRight(this.getUp(index));
  getDownLeft  = index => this.getLeft(this.getDown(index));
  getDownRight = index => this.getRight(this.getDown(index));

  // Moving to surrounding tiles
  attack = (from, to) => {
    console.log('attack', [from, to]);
    this.socket.emit("attack", from, to);
    this.last_move = to;
    this.current_tile = null;
  }
  left = (index) => {
    this.attack(index, this.getLeft(index));
  }
  right = (index) => {
    this.attack(index, this.getRight(index));
  }
  down = (index) => {
    this.attack(index, this.getDown(index));
  }
  up = (index) => {
    this.attack(index, this.getUp(index))
  }

  // helper for translating options to moves
  optionsToMovesMap = [
    [this.up],
    [this.up, this.right],
    [this.right],
    [this.right, this.down],
    [this.down],
    [this.down, this.left],
    [this.left],
    [this.left, this.up],
  ]

  // get distance between two tiles
  distanceBetweenTiles = (a, b) => {
    return this.distanceBetweenCoords(this.getCoords(a), this.getCoords(b));
  }
  // get the distance between two points
  distanceBetweenCoords = (a, b) => {
    return Math.sqrt(Math.pow((a[1] - a[0]), 2) + Math.pow((b[1] - b[0]), 2));
  }
  // get x, y of tile 
  getCoords = (tile) => {
    return [tile % this.width + 1, this.height - (tile % this.height)];
  }
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
