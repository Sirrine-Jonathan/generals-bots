var events = require('events');
const { runInThisContext } = require('vm');
const Objective = require('./objective.js');

// Terrain Constants.
// Any tile with a nonnegative value is owned by the player corresponding to its value.
// For example, a tile with value 1 is owned by the player with playerIndex = 1.
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4; // Cities and Mountains show up as Obstacles in the fog of war.
const TILE_NAMES = {
  [TILE_EMPTY]: "EMPTY TILE",
  [TILE_MOUNTAIN]: "MOUNTAIN TILE",
  [TILE_FOG]: "FOG TILE",
  [TILE_FOG_OBSTACLE]: "FOG OBSTACLE TILE"
}

// Objective types
const GENERAL_OBJECTIVE = "GENERAL";
const CITY_OBJECTIVE = "CITY";
const POSITION_OBJECTIVE = "POSITION";

module.exports = class Bot {

  /*
    Configure the bots behaviour
  */

  // The latest game tick that the bot will pull armies off it's general tile
  PULL_FROM_GENERAL_MAX = 50;

  // The earliest game tick that the bot will start to attack cities
  ATTACK_CITIES_MIN = 100;

  // The latest game tick that the bot will continue to attack cities
  ATTACK_CITIES_MAX = 2000;

  // whether or not to attack enemy generals
  ATTACK_GENERALS = true;

  // whether or not to attack cities
  ATTACK_CITIES = true;

  // The most we'll look into a path before considering it too long to continue searching
  PATH_LENGTH_LIMIT = 10;

  // The lowest we'll allow the general tile to get before resupplying armies to the general tile
  // Resupplies will only happen after the PULL_FROM_GENERAL_MAX tick is surpassed
  LOWEST_GENERALS = 200;

  // The closest we'll let an enemy get to our general before we start sending home reinforcements
  CLOSENESS_LIMIT = 50;

  // Game data from game_start
  // https://dev.generals.io/api#game_start
  playerIndex = null;
  replay_id;
  chat_room;
  team_chat_room;
  usernames;
  teams;

  // Useful data gathered from the info give on game update
  game_tick = 0;
  ticks_til_payday = 25;

  generals = [];  // The indicies of generals we have vision of.
  cities = [];    // The indicies of cities we have vision of.

  width = null;   // map width
  height = null;  // map height
  map = [];       // large array continue all map information
  terrain = [];   // obstacle or enemy player information of map
  owned = [];     // all the owned tiles
  enemies = [];   // all tiles owned by enemies
  perimeter = []; // all the tiles on the perimeter of the bots territory

  current_tile = null;
  current_coors = null;
  general_tile = null;
  general_coords = null;

  last_move = null;
  last_type_taken = null;
  objective_queue = [];
  history = [];

  // initialize the socket for emiting bot events
  constructor(socket){

    if (socket){
      this.socket = socket;
    } else {
      this.socket = new events.EventEmitter();
    }
  }

  // chat helper
  chat = (msg) => {
    this.socket.emit("chat_message", this.chat_room, msg);
  }

  // getter for the socket or event emitter
  getSocket = () => {
    return this.socket;
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
    console.log('===========================');
    console.log(`GAME TICK ${data.turn / 2}`);

    // set the bots index
    if (this.playerIndex === null){
      this.playerIndex = data.playerIndex;
    }
    // game timing
    this.game_tick = Math.ceil(data.turn / 2);
    this.ticks_til_payday = 25 - this.game_tick % 25;

    // update map variables
    this.map = this.patch(this.map, data.map_diff);
    this.width = this.map[0];
    this.height = this.map[1];
    this.size = this.width * this.height;
    this.armies = this.map.slice(2, this.size + 2);
    this.terrain = this.map.slice(this.size + 2, this.size + 2 + this.size);

    // all the enemy tiles
    this.enemies = this.terrain
      .map((tile, idx) => {
        if (this.isEnemy(tile)){
          return idx;
        }
        return null;
      })
      .filter(tile => tile !== null);

    // all the tiles we own
    this.owned = this.terrain
      .map((tile, idx) => {
        if (tile === this.playerIndex){
          return idx;
        }
        return null
      })
      .filter(tile => tile !== null);

    // of the tiles we own, only the ones on the perimeter
    this.perimeter = this.owned
      .filter(tile => this.isPerimeter(tile));

    // of the perimter tiles, only the ones that border an enemy
    this.frontline = this.perimeter
      .filter(tile => this.isFrontline(tile));
    console.log('frontline length', this.frontline.length);
    console.log('frontline', this.frontline);

    // do things at first turn
    if (data.turn === 1){
      this.chat('Good luck, everyone!');

      // set general info
      this.general_tile = data.generals[this.playerIndex];
      this.general_coords = this.getCoords(this.general_tile);

      // initialize current tile info
      this.current_tile = this.general_tile;
      this.current_coords = this.getCoords(this.current_tile);

      // why not dump a starting report
      console.log({
        general: this.general_tile,
        owned: this.owned,
        current: `${this.current_tile}, (${this.current_coords.x}, ${this.current_coords.y})`,
        dimensions: `${this.width} x ${this.height}`,
        options: this.getSurroundingTiles(this.current_tile),
        outer_options: this.getSurroundingTiles(this.current_tile, 2),
        conditions: this.getSurroundingTerrain(this.current_tile),
      });
    }

    // Check if visible generals array has changed
    if (
      JSON.stringify(this.generals) !== JSON.stringify(data.generals) &&
      this.game_tick !== 0 &&
      this.ATTACK_GENERALS
    ){

      // log things
      console.log({ generals: data.generals });

      // filter out bot itself
      let generals = data.generals.filter(general => general !== -1 && general !== this.general_tile);

      // if others are still visible...
      if (generals.length > 0){

        // find the closest general
        let closest = this.getClosest(this.current_tile ?? this.getBestSourceTile(), generals);
        console.log({ closest });

        // set objective, clear queue to take this as highest priority
        if (this.objective_queue.length > 0 && this.objective_queue[0].type !== GENERAL_OBJECTIVE){
          this.objective_queue = [];
          this.objective_queue.push(new Objective(GENERAL_OBJECTIVE, closest));
        }
      }
    }

    // update internal generals prop after checking for differences
    this.generals = data.generals;

    // Check if visible cities array has changed
    let cities = this.patch(this.cities, data.cities_diff);
    if (
      JSON.stringify(cities) !== JSON.stringify(this.cities) &&
      this.game_tick >= this.ATTACK_CITIES_MIN &&
      this.ATTACK_CITIES
    ){

      // filter out owned cities (owned by any player)
      let unowned_cities = cities.filter(city => city !== TILE_EMPTY);

      // log things
      console.log({ all_cities: cities, all_unowned_cities: unowned_cities });


      // Only focus on new visible cities before a specified game tick
      if (
        this.game_tick < this.ATTACK_CITIES_MAX &&
        unowned_cities.length > 0 &&
        this.armiesAtTile(this.general_tile) > this.LOWEST_GENERALS // enough armies at general to be attacking cities
      ){

        // find the closest city
        let closest = this.getClosest(this.current_tile ?? this.getBestSourceTile(), unowned_cities);
        console.log({ closest });

        this.objective_queue.push(new Objective(CITY_OBJECTIVE, closest));
      }
    }
    this.cities = cities;

    if (this.isFullyStretched()){
      console.log('skipping move since we are fully stretched');
      return;
    }

    if (data.turn > 1){
      this.doNextMove(data);
    }
  }

  isFullyStretched = () => {
    if (this.game_tick < this.PULL_FROM_GENERAL_MAX){
      return this.owned.map(tile => this.armies[tile]).every(amount => amount === 1);
    } else {
      return this.owned
        .map(tile => {
          if (this.isGeneral(tile)) {
            return 1;
          } else {
            return this.armies[tile]
          }
        })
        .every(amount => amount === 1);
    }
  }

  doNextMove = (data) => {
    // find the next objective
    let objective;
    while (objective === undefined && this.objective_queue.length > 0){

      // optimistically pull the next one from the queue
      let next_objective = this.objective_queue[0];

      // if queue is not empty or null, we've found our current objective
      if (next_objective.queue === null || next_objective.queue.length > 0){

        // if this objective has not yet been started
        // let's do some things
        if (!next_objective.started){

          // if it's a general objective, let's chat about it
          if (next_objective.type ===  GENERAL_OBJECTIVE){
            let general_index = this.generals.indexOf(next_objective.target);
            let username = this.usernames[general_index];
            this.chat(`Targeting ${username}'s general`);
          }

          // set the 'started' flag to true, so we don't repeat this stuff
          next_objective.started = true;
        }

        // set the objective so we can exit our while loop
        objective = next_objective;

      // The next queue in line is empty and we need to handle that now.
      } else {

        let completed_objective = this.objective_queue.shift()
        console.log('Processed Objective', completed_objective);

        // consider renewing objective immediately
        if (
          completed_objective.complete && // this is a flag that gets set to true during the queue's last step
          (
            completed_objective.type === GENERAL_OBJECTIVE ||
            completed_objective.type === CITY_OBJECTIVE ||
            (completed_objective.type === POSITION_OBJECTIVE && this.isEnemy(completed_objective.target))
          )
        ){

          // only renew the objective if the target is not now owned
          // this is part of why this logic needs to happen on the tick after the last queue's move
          if (!this.isOwned(completed_objective.target)) {
            console.log('renewing objective', completed_objective);
            this.objective_queue.push(new Objective(completed_objective.type, completed_objective.target, null, true));
          }
        }

        // set current to random if completed task was position task and target was general,
        // so we don't move all armies off the general immediately after reinforcing it
        if (
          completed_objective.type === POSITION_OBJECTIVE &&
          completed_objective.target === this.general_tile
        ) {
          let best = this.getBestSourceTile(false);
          console.log(`set current_tile to best not general source tile ${best}`);
          this.current_tile = best;
        }

        // Do something once the objective queue has been emptied
        if (this.objective_queue.length <= 0){
          // ... do thing ...
          console.log("OBJECTIVE QUEUE IS EMPTY");
        }
      }
    }

    // if general is below threshold, push a position objective to
    // start of queue, make sure we don't add it twice though.
    if (
      (
        // general armies have fallen below threshold
        this.armiesAtTile(this.general_tile) <= this.LOWEST_GENERALS &&

        // don't start reinforcements until we are done pulling from general as source
        // as commonly done in the early game
        this.game_tick >= this.PULL_FROM_GENERAL_MAX &&

        // only start reinforcing if either queue objective queue is empty or
        // the current objective's target is the general (meaning reinforcements are already underway)
        (this.objective_queue.length <= 0 || this.objective_queue[0].target !== this.general_tile)
      ) ||
      (
        // there are enemies within our comfort zone
        this.isEnemyClose()
      )
    ){
      console.log('Reinforcing general');
      let best = this.getBestSourceTile(false); // false, so we don't include the general as a source
      let armies = this.armiesAtTile(best);
      if (armies >= 2){
        this.current_tile = best;
        this.objective_queue.push(new Objective(POSITION_OBJECTIVE, this.general_tile))
      } else {
        console.log('not enough armies in other places to send reinforcements');
      }
    }

    // if there's no objective, let's resort to doing a random move,
    if (!objective){
      console.log(`Random move at tick ${data.turn / 2}`);
      this.randomMove(data);

    // otherwise, let's begin processing the next move in the current objective's queue
    } else {

      // executed next step and returned the updated objective
      let updated_objective = this.executeObjectiveStep(objective);

      // if it's complete (meaning the target tile was reaching, but not necessarily owned)
      if (updated_objective.complete){

        let completed_objective = this.objective_queue[0];
        console.log('OBJECTIVE COMPLETE', completed_objective);

        // logs for debugging recognizing if the completed target is also owned
        console.log('owned', this.owned);
        console.log('current', this.current_tile);
        console.log('tarrain at target', this.terrain[completed_objective.target]);
        console.log('target is playerIndex in terrain', this.terrain[completed_objective.target] === this.playerIndex);
        console.log('target is owned', this.isOwned(completed_objective.target));

        // more debug logs for cities
        if (completed_objective.type === CITY_OBJECTIVE){
          console.log('city obj finished, terrain is', this.terrain[completed_objective.target]);
          console.log('cities are', this.cities);
          console.log('armies at target city', this.armies[completed_objective.target]);
        }

        // chat tile capture for position objectives
        if (
          this.isOwned(completed_objective.target) &&
          completed_objective.type !== POSITION_OBJECTIVE
        ){
          this.chat(`Captured ${completed_objective.type}`);
        }

      // if the objective is not complete, but the queue is empty,
      // then a clear path must not have been found, or
      // the objective was interrupted by a takeover
      } else if (updated_objective.queue.length <= 0) {

        // in this case, we'll resort to a random move
        console.log(`Random move at tick ${data.turn / 2}`);
        this.randomMove(data);
      }
    }
  }

  // takes a queue and returns the updated queue,
  // this function will handle executing the move and refreshing the queue
  // if the queue needs to be continued from a better source.
  executeObjectiveStep = (objective) => {
    const LOG_OBJECTIVE_STEP = true;
    if (LOG_OBJECTIVE_STEP){
      console.log('Running next step on objective', objective);
    }

    // return objective if queue is empty
    if (objective.queue !== null && objective.queue.length <= 0) {
      if (LOG_OBJECTIVE_STEP){
        console.log('Objective has empty queue');
      }
      return objective;
    }

    if ((
        this.current_tile === undefined ||
        this.current_tile === null ||
        this.armiesAtTile(this.current_tile) <= 1
      ) && objective.queue !== null && objective.queue.length >= 2
    ) {
      this.current_tile = objective.getNextMove();
    }

    if (
      objective.queue === null ||
      this.armiesAtTile(this.current_tile) <= 1
    ) {
      if (LOG_OBJECTIVE_STEP){
        console.log('refreshing/initializing queue');
        if (objective.queue === null){
          console.log('because queue is null');
        }
        if (this.armiesAtTile(this.current_tile) <= 1){
          console.log(`because the current tile ${this.current_tile} has too few armies ${this.armiesAtTile(this.current_tile)}`)
        }
      }
      let best_source = this.getBestSourceTile(this.game_tick < this.PULL_FROM_GENERAL_MAX);
      if (LOG_OBJECTIVE_STEP){
        let c = this.getCoords(best_source);
        console.log(`using best source tile ${best_source} (${c.x}, ${c.y})`);
        if (objective.queue === null){
          console.log('objective queue found null, needs refreshing');
        } else if (!this.current_tile){
          console.log('current tile not found, objective queue needs refreshing');
        } else {
          console.log(`current tile ${this.current_tile}, armies = ${this.armiesAtTile(this.current_tile)}`);
          console.log('no armies at current tile, queue needs refreshing');
        }
      }
      objective.queue = this.getPathDepthFirst(best_source, objective.target);
      this.current_tile = best_source;
    }

    // check if we can just continue on the current queue
    if (this.armiesAtTile(this.current_tile) > 1){
      if (LOG_OBJECTIVE_STEP){
        console.log(`current tile ${this.current_tile} is set and has armies`);
      }
      let next_tile = objective.queue.shift();
      if (LOG_OBJECTIVE_STEP){
        console.log('next tile', next_tile);
      }
      if (next_tile === this.current_tile){
        next_tile = objective.queue.shift();
        if (LOG_OBJECTIVE_STEP){
          console.log('next tile is current, get next tile', next_tile);
          console.log('next tile', next_tile);
        }
      }

      if (next_tile === objective.target){
        console.log('Marking objective as complete, processing completion on next tick');
        objective.complete = true;
      }
      this.attack(this.current_tile, next_tile);
    } else {

    }
    return objective;
  }

  compound = (fn, level, ...rest) => {
    const LOG_COMPOUND = false;
    if (LOG_COMPOUND){
      console.log(`compound function ${fn}`);
    }
    let res = fn(...rest);
    if (LOG_COMPOUND){
      console.log(`compound level 1: ${res}`);
    }
    if (level > 1){
      for (let i = 2; i <= level; i++){
        res = fn(res);
        if (LOG_COMPOUND){
          console.log(`compound level ${i}: ${res}`);
        }
      }
    }
    return res;
  }

  getSurroundingTiles = (index, level = 1) => {
    return [
      this.compound(this.getUp, level, index),
      this.compound(this.getUpRight, level, index),
      this.compound(this.getRight, level, index),
      this.compound(this.getDownRight, level, index),
      this.compound(this.getDown, level, index),
      this.compound(this.getDownLeft, level, index),
      this.compound(this.getLeft, level, index),
      this.compound(this.getUpLeft, level, index)
    ]
  }

  getSurroundingTilesSimple = (index, level = 1) => {
    return [
      this.compound(this.getUp, level, index),
      this.compound(this.getRight, level, index),
      this.compound(this.getDown, level, index),
      this.compound(this.getLeft, level, index)
    ]
  }

  getSurroundingTerrain = (index, level = 1) => {
    return this.getSurroundingTiles(index, level).map(tile => this.terrain[tile]);
  }

  getSurroundingTerrainSimple = (index, level = 1) => {
    return this.getSurroundingTilesSimple(index, level).map(tile => this.terrain[tile]);
  }

  randomMove = (data, priority = [
    this.isEnemy,  // Enemy Owned
    this.isEmpty, // Empty
    this.isOwned,  // Self Owned
  ]) => {

    const LOG_RANDOM_MOVE = true;

    // start trying to determine the next move
    let found_move = false;
    let set_queue_abandon_loop = false;
    let found_move_attempt = 0;
    while(!found_move && !set_queue_abandon_loop){
      if (LOG_RANDOM_MOVE){
        console.log(`finding next move, attempt #${++found_move_attempt}`);
      }
      let from_index = null;

      // just use best frontline all the time
      from_index = this.getBestFrontline(this.game_tick < this.PULL_FROM_GENERAL_MAX, false);

      /*
        If from_index is neither frontline, nor perimeter (best source),
        but there are perimeters, just without armies, then let's bring our armies to the front
      */
      if (
        !this.isPerimeter(from_index) &&
        !this.isFrontline(from_index) &&
        this.perimeter.length > 0 &&
        this.game_tick > 1
      ){
        console.log('tick', this.game_tick);
        console.log('next random starting is not perimeter, and there are perimeters that must be low on armies');

        // schedule objective to go towards perimeter
        let best_source = this.getBestSourceTile(this.game_tick < this.PULL_FROM_GENERAL_MAX);
        let closest_perimeter = this.getClosestPerimeter(best_source);

        // check if it really is a perimeter, because getRandomPerimeter falls back to
        // returning a random owned tile
        if (this.isPerimeter(closest_perimeter)){
          // if it is a perimeter, let's add the objective
          console.log(`Heading towards perimeter ${closest_perimeter}`);
          set_queue_abandon_loop = true;
          let queue = this.getPathDepthFirst(best_source, closest_perimeter);
          this.objective_queue.push(new Objective(POSITION_OBJECTIVE, closest_perimeter, queue, false));

          // TODO maybe start the first move so we don't miss a tick?
          this.doNextMove(data);
          break;
        }

        // otherwise we continue with our from_index set by the 'getBestFrontline' call
      }

      console.log(`Finding random move from tile ${from_index}`);
      if (
        // we need to own it to move from here,
        (this.terrain[from_index] === this.playerIndex) &&
        // and it needs armies
        this.armies[from_index] > 1
      ){
        let options = this.getSurroundingTilesSimple(from_index);
        console.log('options are', options);
        console.log('option terrain is', this.getSurroundingTerrainSimple(from_index));
        for (let i = 0; i < priority.length; i++){

          // map the options to array indicating
          // whether the options is usable or not,
          // while preserving the index of the option
          let can_use = options.map(op => priority[i](op) && (!this.isCity(op) || this.game_tick >= this.ATTACK_CITIES_MIN));
          if (LOG_RANDOM_MOVE){
            console.log(`can_use of ${priority[i].name}`, can_use);
          }

          // let's not enter the loop below if there are no usable options
          // this should never be true because of the if we are in,
          // but just in case.
          if (
            can_use.length <= 0 ||
            can_use.filter(op => Boolean(op)).length <= 0
          ) {
            if (LOG_RANDOM_MOVE){
              console.log('no usable option');
            }
            continue;
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
                const MOVE_MAP = [
                  'up',
                  'right',
                  'down',
                  'left',
                ];
                console.log(`moving ${MOVE_MAP[option_index]} to ${options[option_index]}`);
              }
            }
          }

          // translate option index to an actual move
          const optionsToMovesMap = [ this.up, this.right, this.down, this.left ];
          let next_move = optionsToMovesMap[option_index];
          if (LOG_RANDOM_MOVE){
            console.log('next move', next_move);
          }
          found_move = true;

          // get type of index we are taking
          let taking_type = this.terrain[options[option_index]];
          console.log({ taking_type, last_type_taken: this.last_type_taken });
          if (
            taking_type !== this.last_type_taken &&
            taking_type >= 0 &&
            taking_type !== this.playerIndex
          ){
            this.chat(`Attacking ${this.usernames[taking_type]}`);
          }
          // set last type taken
          this.last_type_taken = taking_type;

          if (
            taking_type >= 0 &&
            taking_type !== this.playerIndex &&
            this.armies[from_index] <= 2
          ){
            console.log(`Targeting player ${this.usernames[taking_type]}`);
            if (this.armiesAtTile(this.general_tile) > this.LOWEST_GENERALS){
              this.objective_queue.unshift(new Objective(POSITION_OBJECTIVE, options[option_index], null, true));
            } else {
              this.objective_queue.push(new Objective(POSITION_OBJECTIVE, options[option_index], null, true));
            }
          }

          next_move(from_index);
          break; // break from for loop
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
        if (LOG_RANDOM_MOVE){
          console.log('setting current tile to null');
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
    console.log(`attacking ${to}, from ${from}`);
    this.socket.emit("attack", from, to);
    this.history = [...this.history, to];
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

  // check if file is frontline tile
  isFrontline = (tile) => {
    return this.getSurroundingTerrainSimple(tile)
        .some(inner_tile => this.isEnemy(inner_tile));
  }

  // check if tile is a perimeter tile
  isPerimeter = (tile) => {
    // first check we actually own it,
    if (this.terrain[tile] === this.playerIndex){
      // get surrounding tiles
      let surrounding = this.getSurroundingTilesSimple(tile);
      // filter out all tiles that would not make it a perimeter tile
      // this will filter out vertical warps too
      let venture_tiles = surrounding.map(tile => this.isVentureTile(tile));

      // if tile is on right edge
      if (tile + 1 % (this.width) === 0){
        // set right tile to false
        venture_tiles[1] = false;
      }

      // if tile is on left edge
      if (tile === 0 || tile % this.width === 0){
        // set left tile to false
        venture_tiles[3] = false;
      }

      venture_tiles = venture_tiles.filter(tile => Boolean(tile));
      let tiles = surrounding.filter((tile, idx) => {
        return venture_tiles[idx];
      })

      console.log(`venture tiles for ${tile}: ${tiles}`);
      console.log(`is ${tile} perimter? ${venture_tiles.length > 0}`);
      return venture_tiles.length > 0;
    }
    return false;
  }

  isVentureTile = (tile) => {
    let terrain = this.terrain[tile];
    return (
      terrain !== undefined &&
      terrain !== this.playerIndex &&
      terrain !== TILE_MOUNTAIN &&
      terrain !== TILE_FOG_OBSTACLE && // exclude cities as venturing
      this.isInBounds(tile) &&
      (!this.isCity(tile) || this.game_tick >= this.ATTACK_CITIES_MIN)
    );
  }

  isInBounds = (tile) => {
    let {x, y} = this.getCoords(tile);
    return (x >= 0 || x <= this.width || y >= 0 || y <= this.height);
  }

  // helper for checking if tile is the general tile
  isGeneral = (tile) => tile === this.general_tile;

  // helper for checking if a tile is a city
  isCity = (tile) => this.cities.includes(tile);

  // helper to see if we own a tile
  isOwned = (tile) => this.owned.includes(tile);

  // helper to see if tile is empty
  isEmpty = (tile) => this.terrain[tile] === TILE_EMPTY;

  // helpert to see if tile is owned by an enemy
  isEnemy = (tile) => {
    return this.terrain[tile] !== this.playerIndex && this.terrain[tile] >= 0
  };

  // returns true or false if an enemy owns a tile within our comfort threshold
  isEnemyClose = () => {
    return this.enemies
      .map(tile => this.distanceBetweenTiles(this.general_tile, tile))
      .some(distance => distance >= this.CLOSENESS_LIMIT);
  }

  // helper for getting the number of armies at a tile
  armiesAtTile = (tile) => this.armies[tile];

  // any tile we own
  getRandomOwned = () => {
    const index_in_owned = Math.floor(Math.random() * this.owned.length);
    return this.owned[index_in_owned];
  }

  // get the tile that will be the best source of armies
  // fallback to best perimeter
  // fallback to random owned
  getBestSourceTile = (includeGeneral = false, desperate_fallback = false) => {
    const LOG_BEST_SOURCE = true;
    let most_armies = 0;
    let best_tile = null;
    if (LOG_BEST_SOURCE){
      console.log('finding best source, looping through all owned: ', this.owned);
    }
    this.owned.forEach((tile) => {
      if (LOG_BEST_SOURCE){
        console.log('checking tile: ', tile);
      }
      let armies_at_tile = this.armies[tile];
      if (
        (best_tile === null || armies_at_tile > most_armies) &&
        (includeGeneral || !this.isGeneral(tile))
      ){
        if (LOG_BEST_SOURCE){
          console.log(`found better tile than ${best_tile}, ${tile}`);
        }
        best_tile = tile;
        most_armies = armies_at_tile;
      }
    })

    if (best_tile === null){
      if (desperate_fallback){
        best_tile = this.getRandomOwned();
        if (LOG_BEST_SOURCE){
          console.log(`No good source, returning random owned tile`);
        }
      } else {
        best_tile = this.getBestPerimeter(includeGeneral, true);
        if (LOG_BEST_SOURCE){
          console.log(`No good source, returning random perimeter tile`);
        }
      }
    }

    if (LOG_BEST_SOURCE){
      console.log(`returning best tile ${best_tile} with ${this.armies[best_tile]} armies`);
    }
    return best_tile;
  }

  // fallback to best perimeter
  // fallback to best source
  // fallback to random owned
  getBestFrontline = (includeGeneral = false) => {
    if (this.frontline.length > 0){
      let most_armies = 1;
      let best_tile = null;
      console.log('finding best frontline, looping through all frontline: ', this.frontline);
      this.frontline.forEach(tile => {
        let armies_at_tile = this.armiesAtTile(tile);
        console.log(`armies at frontline ${tile}, ${armies_at_tile}`);
        if (best_tile === null || armies_at_tile > most_armies){
          console.log(`found better tile frontline tile than ${best_tile}, ${tile}`);
          best_tile = tile;
          most_armies = armies_at_tile;
        }
      })

      if (best_tile === null){
        console.log('no front line with sufficient armies, getting best perimeter');
        best_tile = this.getBestPerimeter(includeGeneral);
      }

      return best_tile;
    } else {
      console.log('no frontline, getting best perimeter');
      return this.getBestPerimeter(includeGeneral, false, true);
    }
  }

  // gets periter with most armies
  getRandomPerimeter = () => {
    if (this.perimeter.length <= 0){
      return this.getRandomOwned();
    }
    const index = Math.floor(Math.random() * this.perimeter.length);
    return this.perimeter[index];
  }

  getClosestPerimeter = (start) => {
    console.log("Getting closest perimeter");
    if (this.perimeter.length <= 0){
      console.log('no perimeters, getting random owned');
      return this.getRandomOwned();
    }
    let distances = this.perimeter.map(tile => this.distanceBetweenTiles(start, tile));
    console.log('perimeters', this.perimeter);
    console.log(`distances from ${start}`, distances);
    let shortest = this.width * this.height;
    let index = null;
    distances.forEach((distance, idx) => {
      if (distance < shortest || index === null){
        index = idx;
        shortest = distance;
        console.log(`current closest perimeter to ${start}: ${this.perimeter[index]} at ${shortest} distance`);
      }
    })
    if (index === null){
      console.log(`Couldn't find shortest, returning random owned`);
      return this.getRandomOwned();
    }
    return this.perimeter[index];
  }

  // fallback to best source
  // fallback to random owned
  getBestPerimeter = (includeGeneral = false, desperate_fallback = false, skip_fallback = false) => {
    const LOG_BEST_PERIMETER = true;
    if (this.perimeter.length > 0){
      let most_armies = 1;
      let best_tile = null;
      if (LOG_BEST_PERIMETER){
        console.log('finding best perimeter, looping through all perimeter: ', this.perimeter);
      }
      this.perimeter.forEach((tile) => {
        let armies_at_tile = this.armies[tile];
        if (LOG_BEST_PERIMETER){
          console.log(`armies at perimeter ${tile}, ${armies_at_tile}`);
        }
        if (
          (best_tile === null || armies_at_tile > most_armies) &&
          (includeGeneral || !this.isGeneral(tile))
        ){
          if (LOG_BEST_PERIMETER){
            console.log(`found better tile than ${best_tile}, ${tile}`);
          }
          if (this.isGeneral(tile)){
            console.log(`best tile ${tile} is general`);
          }
          best_tile = tile;
          most_armies = armies_at_tile;
        }
      })

      if (skip_fallback){
        if (this.armiesAtTile(best_tile) <= 1){
          return null;
        }
      }

      if (best_tile === null || this.armiesAtTile(best_tile) <= 1){
        if (desperate_fallback){
          console.log('no tile on perimeter with sufficient armies, returning random owned tile');
          best_tile = this.getRandomOwned();
        } else {
          console.log('no tile on perimeter with sufficient armies, finding best inland source');
          best_tile = this.getBestSourceTile(includeGeneral, true);
        }
      }

      return best_tile;
    } else {
      if (skip_fallback){
        return null;
      }

      if (desperate_fallback){
        console.log('no perimeter, returning random owned tile');
        return this.getRandomOwned();
      } else {
        console.log('no permiter, getting best source tile');
        return this.getBestSourceTile(includeGeneral);
      }
    }
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
    return Math.sqrt(Math.pow((a.x - b.x), 2) + Math.pow((a.y - b.y), 2));
  }

  // get x, y of tile
  getCoords = (tile) => {
    var y = Math.floor(tile / this.width);
		var x = tile % this.width;
    return { x, y };
  }

  // get tile of x, y
  getTileAtCoords = (x, y) => {
    return y * this.width + x;
  }

  /*
    Depth First Search for finding Paths
  */
  getPathDepthFirst = (start, finish, targetData) => {
    let path = [];
    let visited = [];
    let paths = [];
    const addPathDepthFirst = (p) => {
      console.log(`found new path ${JSON.stringify(p)}`);
      paths = [...paths, p];
    }
    this.addPathDepthFirstStep(start, finish, path, visited, addPathDepthFirst);
    console.log(`found ${paths.length} paths`);
    let lengths = paths.map(path => path.length);
    console.log(`lengths ${JSON.stringify(lengths)}`);
    let shortest_length = Math.min(...lengths);
    console.log(`shortest_length = ${shortest_length}`);
    let index_of_shortest = lengths.indexOf(shortest_length);
    console.log(`index_of_shortest = ${index_of_shortest}`);
    let shortest_path = paths[index_of_shortest];
    console.log(`shortest_path = ${JSON.stringify(shortest_path)}`);
    let path_terrains = shortest_path?.map(tile => this.terrain[tile]);
    console.log(`shortest_path terrains ${path_terrains}`);

    return shortest_path ?? [];
  }

  addPathDepthFirstStep = (next, finish, path, visited, addPathDepthFirst, targetData) => {
    const LOG_ADD_PATH_STEP = false;

    if (path.length > this.PATH_LENGTH_LIMIT){
      if (LOG_ADD_PATH_STEP){
        console.log('Stopped searching path due to length limit');
      }
      return;
    }

    if (next === finish){
      path = [...path, next];
      visited = [...visited, next];
      addPathDepthFirst(path);
      return;
    }

    // coords
    let {x, y} = this.getCoords(next);

    // check visited
    if (visited.includes(next)){
      if (LOG_ADD_PATH_STEP) {
        console.log(`already visited ${next}, (${x},${y})`);
      }
      return;
    }

    // check bounds
    if (x < 0 || x > this.width || y < 0 || y > this.height){
      if (LOG_ADD_PATH_STEP) {
        console.log(`${next} tile out of bounds (${x} < 0 || ${x} > ${this.width} || ${y} < 0 || ${y} > ${this.height})`);
      }
      return;
    }

    if (this.terrain[next] === TILE_MOUNTAIN){
      if (LOG_ADD_PATH_STEP) {
        console.log(`${next} is ${this.terrain[next]}`);
      }
      return;
    }

    // check terrain
    if (
      this.terrain[next] !== TILE_EMPTY &&
      this.terrain[next] !== TILE_FOG &&
      this.terrain[next] < 0 &&
      (this.isCity(next) && !this.isCity(finish)) // don't include cities in path, unless a city is the target
    ){
      if (LOG_ADD_PATH_STEP) {
        console.log(`${next} non traversable terrain ${this.terrain[next]}`);
      }
      return;
    }

    // passes all checks
    path = [...path, next];
    visited = [...visited, next];
    let borders = this.getSurroundingTilesSimple(next);
    borders.forEach(tile => this.addPathDepthFirstStep(tile, finish, path, visited, addPathDepthFirst));
  }


  // TODO: farm armies
}
