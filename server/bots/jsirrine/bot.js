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
<<<<<<< HEAD
const TILE_NAMES = {
  [TILE_EMPTY]: "EMPTY TILE",
  [TILE_MOUNTAIN]: "MOUNTAIN TILE",
  [TILE_FOG]: "FOG TILE",
  [TILE_FOG_OBSTACLE]: "FOG OBSTACLE TILE"
}
const MOVE_MAP = [
  'up',
  'right',
  'down',
  'left',
];
=======
>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c

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
<<<<<<< HEAD
  generals = []; // The indicies of generals we have vision of.
  cities = []; // The indicies of cities we have vision of.
  map = [];
  owned = [];
  perimeter = [];
=======
  generals; // The indicies of generals we have vision of.
  cities = []; // The indicies of cities we have vision of.
  map = [];
>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c
  width = null;
  height = null;
  current_tile = null;
  last_move = null;
  general_tile = null;
<<<<<<< HEAD
  general_coords = null;
  move_queue = [];

=======
>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c
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
<<<<<<< HEAD
    console.log('===========================');
    console.log(`GAME TICK ${data.turn / 2}`);

    // update game timing
=======
>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c
    this.game_tick = Math.ceil(data.turn / 2);
    this.ticks_til_payday = 25 - this.game_tick % 25;

    // Patch the city and map diffs into our local variables.
    this.cities = this.patch(this.cities, data.cities_diff);
    this.map = this.patch(this.map, data.map_diff);
<<<<<<< HEAD


    this.width = this.map[0];
    this.height = this.map[1];
    this.size = this.width * this.height;
    this.armies = this.map.slice(2, this.size + 2);
    this.terrain = this.map.slice(this.size + 2, this.size + 2 + this.size);
=======

    // Update some other props
    this.generals = data.generals;
    this.width = this.map[0];
    this.height = this.map[1];
    this.size = this.width * this.height;
    this.armies = this.map.slice(2, this.size + 2);
    this.terrain = this.map.slice(this.size + 2, this.size + 2 + this.size);

>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c
    this.owned = this.terrain
      .map((tile, idx) => {
        if (tile === this.playerIndex){
          return idx;
        }
        return null
      })
      .filter(tile => tile !== null);
<<<<<<< HEAD
    this.perimeter = this.owned
      .filter(tile => this.isPerimeter(tile));

    if (data.turn === 1){
      //this.chat('Good luck, everyone!');
      this.general_tile = data.generals[this.playerIndex];
      this.general_coords = this.getCoords(this.general_tile);
      this.current_tile = this.general_tile;
      let current_coords = this.getCoords(this.current_tile);
      console.log({
        general: this.general_tile,
        owned: this.owned,
        current: `${this.current_tile}, (${current_coords.x}, ${current_coords.y})`,
        options: this.getSurroundingTiles(this.current_tile),
        conditions: this.getSurroundingTerrain(this.current_tile),
      });
    }

    if (data.turn % 2 === 0){
      if (this.current_tile){
        let tile_coords = this.getCoords(this.current_tile);
        console.log(`current tile: ${this.current_tile} (${tile_coords.x}, ${tile_coords.y})`);
      } else {
        console.log('current tile: unknown');
      }
    } else {
      // in between moves, lets log some useful stuff
      console.log('cities', this.cities);
    }
    // Update some other props
    if (JSON.stringify(this.generals) !== JSON.stringify(data.generals) && this.game_tick !== 0){
      console.log({ generals: data.generals })
    }
    this.generals = data.generals;

    if (data.turn % 2 === 0){
      if (this.move_queue.length > 0){
        let next_move = this.move_queue.shift();
        console.log('moving', next_move);
        next_move(this.current_tile);
      } else {
        this.randomMove();
      }
    }
  }

  getRandomOwned = () => {
    const index_in_owned = Math.floor(Math.random() * this.owned.length);
    return this.owned[index_in_owned];
  }

  getRandomPerimeter = () => {
    const index_in_owned = Math.floor(Math.random() * this.owned.length);
    return this.perimeter[index_in_owned];
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

  getSurroundingTilesSimple = (index) => {
    return [
      this.getUp(index),
      this.getRight(index),
      this.getDown(index),
      this.getLeft(index)
    ]
  }

  getSurroundingTerrain = (index) => {
    return this.getSurroundingTiles(index).map(tile => this.terrain[tile]);
  }

  getSurroundingTerrainSimple = (index) => {
    return this.getSurroundingTilesSimple(index).map(tile => this.terrain[tile]);
  }

  randomMove = (priority = [
    TILE_EMPTY, // Empty
    _TILE_OWNED,  // Self Owned
    _TILE_ENEMY,  // Enemy Owned
  ]) => {

    // start trying to determine the next move
    let found_move = false;
    let found_move_attempt = 1;
    while(!found_move){
      console.log('finding next move, attempt #' + found_move_attempt);

      // by default, use the current_tile,
      // so we continue where we left off last move
      let from_index = this.current_tile;
      if (from_index === null){
        // if it's null, let's just grab a random new tile,
        // it should be one that we own,
        // preferably one on the border of our territory
        from_index = this.getRandomPerimeter();
        console.log('starting from random index', from_index);
      } else {
        console.log('continuing from current', this.current_tile);
      }

      if (
        // we need to own it to move from here,
        (this.terrain[from_index] === this.playerIndex) &&
        // and it needs armies
        this.armies[from_index] > 1
      ){
        let options = this.getSurroundingTerrainSimple(from_index);
        for (let i = 0; i < priority.length; i++){
          console.log('Looking for ' + TILE_NAMES[priority[i]]);
          if (options.includes(priority[i])){
            console.log('Found tile matching priority: ' + TILE_NAMES[priority[i]]);

            // map the options to array indicating
            // whether the options is usable or not,
            // while preserving the index of the option
            let can_use = options.map(op => op === priority[i]);
            console.log('can_use', can_use);

            // let's not enter the loop below if there are no usable options
            // this should never be true because of the if we are in,
            // but just in case.
            if (
              can_use.length <= 0 ||
              can_use.filter(op => op).length <= 0
            ) {
              console.log('no usable option');
              break;
            }

            // get a random usable option from the options list
            let option_index;
            let found_option_index = false;
            let usable_attempt = 0;
            while (!found_option_index) {
              console.log(`Random usable move, attempt #${++usable_attempt}`);

              // get random option index
              let index = Math.floor(Math.random() * options.length);
              console.log(`checking ${can_use[index]} at index: ${index}`);
              
              // check if the option at that index is usable
              if (can_use[index]){

                // if so, let's set our option_index and leave the loop
                option_index = index;
                found_option_index = true;
                console.log(`moving ${MOVE_MAP[option_index]} to ${TILE_NAMES[options[option_index]]} ${options[option_index]}`);
              }
            }

            // loop over the moves that match moving to this option
            console.log('queuing up moves');
            this.move_queue = this.move_queue.concat(this.optionsToMovesMap[option_index]);
            let next_move = this.move_queue.shift();
            console.log('moving', next_move);
            found_move = true;
            next_move(from_index);
            break; // break from for loop
          }
        }

        // quit while loop
        if (found_move){
          break; // break from while loop
        }
      } else {
        if (!(this.terrain[from_index] === this.playerIndex)){
          console.log('given starting tile not owned');
        } else {
          console.log('not enough armies on given tile');
        }
        this.current_tile = null;
=======
    
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
>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c
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
<<<<<<< HEAD
    this.current_tile = to;
=======
    this.last_move = to;
    this.current_tile = null;
>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c
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
<<<<<<< HEAD
    [this.right],
    [this.down],
    [this.left],
  ]

  // check if tile is a perimeter tile
  isPerimeter = (tile) => {
    // first check we actually own it,
    if (this.terrain[tile] === this.playerIndex){
      // then check that it at least is not surrounding entirely by tiles we own
      let surrounding = this.getSurroundingTerrain(tile);
      let filtered = surrounding.filter(tile => tile !== this.playerIndex);
      return filtered.length > 0;
    }
    return false;
  }

=======
    [this.up, this.right],
    [this.right],
    [this.right, this.down],
    [this.down],
    [this.down, this.left],
    [this.left],
    [this.left, this.up],
  ]

>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c
  // get distance between two tiles
  distanceBetweenTiles = (a, b) => {
    return this.distanceBetweenCoords(this.getCoords(a), this.getCoords(b));
  }
  // get the distance between two points
  distanceBetweenCoords = (a, b) => {
<<<<<<< HEAD
    return Math.sqrt(Math.pow((a.y - a.x), 2) + Math.pow((b.y - b.x), 2));
  }
  // get x, y of tile 
  getCoords = (tile) => {
    var y = Math.floor(tile / this.width);
		var x = tile % this.width;
    return { x, y };
  }
  getTileAtCoords = (x, y) => {
    return y * this.width + x;
  }

  // find shortest valid path
  getPath = (start, finish) => {

    // each point from which we should explore paths
    let q = this
      .getSurroundingTilesSimple(start)
      .map(tile => this.getCoords(tile));

    // the coords of our target tile
    let end = this.getCoords(finish);
    
    // a virtual model of our map
    let m = [];

    // the current path
    let path = [];

    let found_path = false;
    
    // loop over queue to explore all path options
    while (q.length !== 0){

      // get the next point (first point will be our start prop)
      let {x, y} = q.shift();
      
      // if outside the map bounds
      if (x < 0 || x >= this.height || y < 0 || y >= this.width)
        continue;
        
      // if we can't travel there,
      // for now just checking that it's empty,
      // TODO: allow moving to owned tiles (check army amount for enemy tiles),
      // TODO: allow crossing cities if owned
      if (
        (this.terrain[x][y] !== TILE_EMPTY)
      )
        continue;

      // check our virual map to see if it's already been visited
      if (m[x][y] === 0)
        continue;
  
      // if in the BFS algorithm process there was a
      // vertex x=(i,j) such that M[i][j] is 2 stop and
      // return true
      if (x === end.x && y === end.y){
        found_path = true;
        continue;
      }
        
      // marking as wall upon successful visitation
      m[x][y] = 0;
      path.push(this.getTileAtCoords(x, y));

      // pushing to queue all directions to explore
      let tile = his.getTileAtCoords(x, y);
      q.concat(this
        .getSurroundingTilesSimple(tile)
        .map(tile => this.getCoords(tile))
      )

      // push good tile to 
      path.push(tile);
    }

    if (found_path){
      return path;
    }

    return [];
  }

=======
    return Math.sqrt(Math.pow((a[1] - a[0]), 2) + Math.pow((b[1] - b[0]), 2));
  }
  // get x, y of tile 
  getCoords = (tile) => {
    return [tile % this.width + 1, this.height - (tile % this.height)];
  }
>>>>>>> 38892e524a2c9c1f72657e66684c4378489d8f0c
  // find closest two tiles of set
  // get set of owned tiles
  // get set of enemey tiles

  // farm armies,
  // take city
  // find general
  // take general
  // defend geneneral

  // get moves to go from one point to the next

  // at start, find city + farm + add armies to general
  // if someone is in site, attack their armies
}
