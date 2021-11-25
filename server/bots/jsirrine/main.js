/* eslint-disable no-continue */
/* eslint-disable no-unused-vars */
/* eslint-disable no-plusplus */
const io = require("socket.io-client");
const { readFileSync } = require('fs');
//require("dotenv").config();

const base = "https://bot.generals.io";
const socket = io(base);
const path = require('path');

function basename(pathName) {
  return path.basename(path.resolve(pathName));
}

socket.on("disconnect", () => {
  console.error("Disconnected from server.");
  process.exit(1);
});

socket.on("connect", () => {
  console.log("Connected to server");
  let raw_data = readFileSync(__dirname + '/bot.json', { encoding: 'utf8' })
  let data = JSON.parse(raw_data);
  console.log(data);
  const userId = data.BOT_ID;
  const username = data.BOT_USER_NAME;

  let gameType = 'CUSTOM';
  if (process.argv.length >= 3){
    gameType = process.argv[2];
  }
  switch (gameType.toUpperCase()) {
    case "CUSTOM":
      let customGameId = basename('.') + '_quickplay'
      if (process.argv.length > 3){
        customGameId = process.argv[3];
      }
      socket.emit("join_private", customGameId, userId);
      socket.emit("set_force_start", customGameId, true);
      console.log(`Joined custom game at http://bot.generals.io/games/${encodeURIComponent(customGameId)}`);
      break;
    case "1V1":
      socket.emit("join_1v1", userId);
      console.log("Joined 1v1");
      break;
    case "2v2":
      socket.emit("join_team", "team_name", userId);
      console.log("Joined 2v2");
      break;
    default:
      socket.emit("play", userId);
      console.log("Joined FFA");
  }

  socket.on("chat_message", (chatRoom, data) => {
    if (data.text === `Hi, ${username}`) {
      socket.emit("chat_message", chatRoom, `Stay out of my way, ${data.username}`);
    }
    if (data.text === `Join, ${username}`) {
      socket.emit("set_force_start", customGameId, true);
    }
  });
});

socket.on("error_set_username", (error) => {
  if (error) {
    console.error(error);
  }
});

// Terrain Constants.
// Any tile with a nonnegative value is owned by the player corresponding to its value.
// For example, a tile with value 1 is owned by the player with playerIndex = 1.
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4; // Cities and Mountains show up as Obstacles in the fog of war.

// Game data.
let playerIndex;
let generals; // The indicies of generals we have vision of.
let cities = []; // The indicies of cities we have vision of.
let map = [];

/* Returns a new array created by patching the diff into the old array.
 * The diff formatted with alternating matching and mismatching segments:
 * <Number of matching elements>
 * <Number of mismatching elements>
 * <The mismatching elements>
 * ... repeated until the end of diff.
 * Example 1: patching a diff of [1, 1, 3] onto [0, 0] yields [0, 3].
 * Example 2: patching a diff of [0, 1, 2, 1] onto [0, 0] yields [2, 0].
 */
function patch(old, diff) {
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

socket.on("game_start", (data) => {
  // Get ready to start playing the game.
  playerIndex = data.playerIndex;
  const replayUrl = `http://bot.generals.io/replays/${encodeURIComponent(data.replay_id)}`;
  console.log(`Game starting! The replay will be available after the game at ${replayUrl}`);
});

socket.on("game_update", (data) => {
  // Patch the city and map diffs into our local variables.
  cities = patch(cities, data.cities_diff);
  map = patch(map, data.map_diff);
  generals = data.generals;

  // The first two terms in |map| are the dimensions.
  const width = map[0];
  const height = map[1];
  const size = width * height;

  // The next |size| terms are army values.
  // armies[0] is the top-left corner of the map.
  const armies = map.slice(2, size + 2);

  // The last |size| terms are terrain values.
  // terrain[0] is the top-left corner of the map.
  const terrain = map.slice(size + 2, size + 2 + size);

  // Make a random move.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Pick a random tile.
    const index = Math.floor(Math.random() * size);

    // If we own this tile, make a random move starting from it.
    if (terrain[index] === playerIndex) {
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
      if (cities.indexOf(endIndex) >= 0) {
        continue;
      }

      socket.emit("attack", index, endIndex);
      break;
    }
  }
});

function leaveGame() {
  console.log(`${process.env.BOT_USER_NAME} left the game`);
  socket.emit("leave_game");
}

socket.on("game_lost", () => {
  console.log(`${process.env.BOT_USER_NAME} lost!`);
  leaveGame();
});

socket.on("game_won", () => {
  console.log(`${process.env.BOT_USER_NAME} won!`);
  leaveGame();
});
