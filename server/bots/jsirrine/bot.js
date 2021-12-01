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

const GENERAL_OBJECTIVE = "GENERAL";
const CITY_OBJECTIVE = "CITY";
const POSITION_OBJECTIVE = "POSITION";

const Objective = function(queue, type, target){
  this.queue = queue;
  this.type = type;
  this.target = target
}

module.exports = class Bot {

  // BOT CONFIG
  PULL_FROM_GENERAL_MAX = 50;
  ATTACK_CITIES_MAX = 100;

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
  generals = []; // The indicies of generals we have vision of.
  cities = []; // The indicies of cities we have vision of.
  map = [];
  owned = [];
  perimeter = [];
  width = null;
  height = null;
  current_tile = null;
  current_coors = null;
  last_move = null;
  general_tile = null;
  general_coords = null;
  move_queue = [];
  objective_queue = [];

  // temp debug props
  queue_move = false;

  constructor(socket){
    this.socket = socket;
  }

  // chat helper
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

  // runs twice every game tick
  update = (data) => {
    // console.log('===========================');
    // console.log(`GAME TICK ${data.turn / 2}`);

    // game timing
    this.game_tick = Math.ceil(data.turn / 2);
    this.ticks_til_payday = 25 - this.game_tick % 25;

    this.map = this.patch(this.map, data.map_diff);
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
    this.perimeter = this.owned
      .filter(tile => this.isPerimeter(tile));

    // do things at first turn
    if (data.turn === 1){
      this.chat('Good luck, everyone!');
      this.general_tile = data.generals[this.playerIndex];
      this.general_coords = this.getCoords(this.general_tile);
      this.current_tile = this.general_tile;
      this.current_coords = this.getCoords(this.current_tile);
      console.log({
        general: this.general_tile,
        owned: this.owned,
        current: `${this.current_tile}, (${this.current_coords.x}, ${this.current_coords.y})`,
        options: this.getSurroundingTiles(this.current_tile),
        conditions: this.getSurroundingTerrain(this.current_tile),
      });
    }

    // Check if visible generals are updated
    if (JSON.stringify(this.generals) !== JSON.stringify(data.generals) && this.game_tick !== 0){

      // log things
      console.log(`GAME TICK ${data.turn / 2}`);
      console.log({ generals: data.generals });

      // filter out bot itself
      let generals = data.generals.filter(general => general !== -1 && general !== this.general_tile);

      // if others are still visible...
      if (generals.length > 0){

        // find the closest general
        let closest = this.getClosest(this.current_tile || this.getRandomOwned(), generals);
        console.log({ closest });

        // get the path to the closest generals
        let path_to_general = this.getPath(this.current_tile || this.getRandomOwned(), closest);
        console.log({ path_to_general });

        // set objective, clear queue to take this as highest priority
        if (this.objective_queue.length > 0 && this.objective_queue[0].type !== GENERAL_OBJECTIVE){
          this.objective_queue = [];
          this.objective_queue.push(new Objective(path_to_general, GENERAL_OBJECTIVE, closest));
        }
      }
    }
    // update internal generals prop after checking for differences
    this.generals = data.generals;

    // Check if visible cities has changed
    let cities = this.patch(this.cities, data.cities_diff);
    if (JSON.stringify(cities) !== JSON.stringify(this.cities) && this.game_tick !== 0){

      // filter out owned cities
      let unowned_cities = cities.filter(city => city !== TILE_EMPTY);

      // log things
      console.log(`GAME TICK ${data.turn / 2}`);
      console.log({ all_cities: cities, all_unowned_cities: unowned_cities });



      // Only focus on new visible cities before a specified game tick
      if (this.game_tick < this.ATTACK_CITIES_MAX && unowned_cities.length > 0){

        // find the closest city
        let closest = this.getClosest(this.current_tile || this.getRandomOwned(), unowned_cities);
        console.log({ closest });

        // get the path to the closest city
        let path_to_city = this.getPath(this.current_tile || this.getRandomOwned(), closest);
        console.log({ path_to_city });

        this.objective_queue.push(new Objective(path_to_city, CITY_OBJECTIVE, closest));
      }
    }
    this.cities = cities;


    // Do things on each tick (not half tick)
    if (data.turn % 2 === 0){

      // find the next objective
      let objective;
      while (objective === undefined && this.objective_queue.length > 0){
        let next_objective = this.objective_queue[0];
        if (next_objective.queue.length > 0){
          objective = next_objective;
        } else {
          let completed_objective = this.objective_queue.shift()
          console.log('OBJECTIVE COMPLETE', completed_objective);
        }
      }

      // if there's no objective, let's resort to doing a random move,
      if (!objective){
        console.log(`Random move at tick ${data.turn / 2}`);
        this.randomMove();
      } else {
        let updated_objective = this.executeObjectiveStep(objective);
        if (updated_objective.queue.length <= 0){
          let completed_objective = this.objective_queue.shift()
          console.log('OBJECTIVE COMPLETE', completed_objective);
        }
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

  // takes a queue and returns the updated queue,
  // this function will handle executing the move and refreshing the queue
  // if the queue needs to be continued from a better source.
  executeObjectiveStep = (objective) => {
    if (objective.queue.length <= 0) return objective;
    if (this.current_tile && this.armiesAtTile(this.current_tile) > 1){
      // continue with the queue move
      let next_move = objective.queue[0];
      next_move(this.current_tile);
    } else {
      let best_source = this.getBestSourceTile();
      objective.queue = this.getPath(best_source, objective.target)
    }
    return objective;
  }

  randomMove = (priority = [
    TILE_EMPTY, // Empty
    _TILE_OWNED,  // Self Owned
    _TILE_ENEMY,  // Enemy Owned
  ]) => {

    const LOG_RANDOM_MOVE = false;

    // start trying to determine the next move
    let found_move = false;
    let found_move_attempt = 1;
    while(!found_move){
      if (LOG_RANDOM_MOVE){
        console.log('finding next move, attempt #' + found_move_attempt);
      }
      // by default, use the current_tile,
      // so we continue where we left off last move
      let from_index = this.current_tile;
      if (from_index === null){
        // if it's null, let's just grab a random new tile,
        // it should be one that we own,
        // preferably one on the border of our territory
        from_index = this.getRandomPerimeter();
        if (LOG_RANDOM_MOVE){
          console.log('starting from random index', from_index);
        }
      } else if (LOG_RANDOM_MOVE) {
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
          if (LOG_RANDOM_MOVE){
            console.log('Looking for ' + TILE_NAMES[priority[i]]);
          }
          if (options.includes(priority[i])){
            if (LOG_RANDOM_MOVE){
              console.log('Found tile matching priority: ' + TILE_NAMES[priority[i]]);
            }
            // map the options to array indicating
            // whether the options is usable or not,
            // while preserving the index of the option
            let can_use = options.map(op => op === priority[i]);
            if (LOG_RANDOM_MOVE){
              console.log('can_use', can_use);
            }

            // let's not enter the loop below if there are no usable options
            // this should never be true because of the if we are in,
            // but just in case.
            if (
              can_use.length <= 0 ||
              can_use.filter(op => op).length <= 0
            ) {
              if (LOG_RANDOM_MOVE){
                console.log('no usable option');
              }
              break;
            }

            // get a random usable option from the options list
            let option_index;
            let found_option_index = false;
            let usable_attempt = 0;
            while (!found_option_index) {
              if (LOG_RANDOM_MOVE){
                console.log(`Random usable move, attempt #${++usable_attempt}`);
              }

              // get random option index
              let index = Math.floor(Math.random() * options.length);
              if (LOG_RANDOM_MOVE){
                console.log(`checking ${can_use[index]} at index: ${index}`);
              }

              // check if the option at that index is usable
              if (can_use[index]){

                // if so, let's set our option_index and leave the loop
                option_index = index;
                found_option_index = true;
                if (LOG_RANDOM_MOVE){
                  console.log(`moving ${MOVE_MAP[option_index]} to ${TILE_NAMES[options[option_index]]} ${options[option_index]}`);
                }
              }
            }

            // loop over the moves that match moving to this option
            if (LOG_RANDOM_MOVE){
              console.log('queuing up moves');
            }
            this.move_queue = this.move_queue.concat(this.optionsToMovesMap[option_index]);
            let next_move = this.move_queue.shift();
            if (LOG_RANDOM_MOVE){
              console.log('moving', next_move);
            }
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
          if (LOG_RANDOM_MOVE){
            console.log('given starting tile not owned');
          }
        } else {
          if (LOG_RANDOM_MOVE){
            console.log('not enough armies on given tile');
          }
        }
        this.current_tile = null;
      }
    }
  }

  // Getting   surrounding tiles
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
    if (this.queue_move){
      console.log('attack', [from, to]);
    }
    this.socket.emit("attack", from, to);
    this.current_tile = to;
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

  // helper for checking if tile is the general tile
  isGeneral = (tile) => tile === this.general_tile;

  // helper to see if we own a tile
  isOwned = (tile) => this.owned.indexOf(tile);

  // helper for getting the number of armies at a tile
  armiesAtTile = (tile) => this.armies[tile];

  // get the tile that will be the best source of armies
  getBestSourceTile = (includeGeneral = false) => {
    let most_armies = 0;
    let best_tile = null;
    this.owned.forEach((tile) => {
      let armies_at_tile = this.armies[tile];
      if (
        (best_tile === null || armies_at_tile > most_armies) &&
        (includeGeneral || !this.isGeneral(tile))
      ){
        best_tile = tile;
        most_armies = armies_at_tile;
      }
    })
    return best_tile;
  }

  getClosest = (current_tile, tile_list) => {
    let lowest_index = 0;
    let lowest_qty = null;
    tile_list
      .map(tile => this.distanceBetweenTiles(current_tile, tile))
      .forEach((qty, idx) => {
        if (lowest_qty === null || qty < lowest_qty){
          lowest_index = idx;
          lowest_qty = qty;
        }
      });
    return tile_list[lowest_index];
  }

  // get distance between two tiles
  distanceBetweenTiles = (a, b) => {
    return this.distanceBetweenCoords(this.getCoords(a), this.getCoords(b));
  }

  // get the distance between two points
  distanceBetweenCoords = (a, b) => {
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
    const LOG_GET_PATH = true;

    if (LOG_GET_PATH){
      let start_coords = this.getCoords(start);
      console.log('coords of start', start_coords);
    }

    // the coords of our target tile
    let end = this.getCoords(finish);

    if (LOG_GET_PATH){
      console.log('coords of target', end);
    }

    // each point from which we should explore paths
    let q = this
      .getSurroundingTilesSimple(start)
      .map(tile => this.getCoords(tile));

    if (LOG_GET_PATH){
      console.log('starting queue', q);
    }

    // a virtual model of our map
    let used = [];

    // the current path
    let path = [];

    let found_path = false;

    // loop over queue to explore all path options
    let loop_count = 0;
    while (q.length !== 0){
      if (LOG_GET_PATH){
        console.log('LOOP COUNT: ', ++loop_count);
      }

      // get the next point (first point will be our start prop)
      let {x, y} = q.shift();

      if (LOG_GET_PATH){
        console.log('checking tile at ', {x, y});
      }

      // patch

      // if the current tile is the end tile
      // mark path has found and exit loop
      if (x === end.x && y === end.y){
        if (LOG_GET_PATH){
          console.log('tile is the target tile');
        }
        found_path = true;
        path.push(this.getTileAtCoords(x, y));
        break;
      } else {
        if (LOG_GET_PATH){
          console.log('tile is not yet target');
          console.log('cur', {x,y});
          console.log('end', end);
        }
      }

      // if outside the map bounds
      if (x < 0 || x >= this.height || y < 0 || y >= this.width){
        if (LOG_GET_PATH){
          console.log('tile is out of bounds');
        }
        continue;
      }

      // check if we can't travel there,
      // cant cont. if not empty tile, or if it's not owned by a player
      // TODO: allow moving to owned tiles (check army amount for enemy tiles),
      // TODO: allow crossing cities if owned
      if (
        (this.terrain[x][y] !== TILE_EMPTY) &&
        (this.terrain[x][y] < 0) // will need to add check for sufficient armies
      ){
        if (LOG_GET_PATH){
          if (this.terrain[x][y] !== TILE_EMPTY){
            console.log('tile is not empty');
          }
        }
        continue;
      }

      // check our virtual map to see if it's already been visited
      if (used[this.getTileAtCoords(x, y)]){
        if (LOG_GET_PATH){
          console.log('tile has already been visited');
        }
        continue;
      }

      // record tile as visited in our virtual map
      used[this.getTileAtCoords(x, y)] = true;

      // pushing to queue all directions to explore
      let tile = this.getTileAtCoords(x, y);
      q = q.concat(this
        .getSurroundingTilesSimple(tile)
        .map(tile => this.getCoords(tile))
      )

      if (LOG_GET_PATH){
        console.log('queue at end of loop iteration', q);
      }

      // push the tile at coords to the path array we want to return
      path.push(tile);

      if (LOG_GET_PATH){
        console.log('path at end of loop iteration', path);
      }
    }

    if (found_path){
      return path;
    }

    return [];
  }

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
