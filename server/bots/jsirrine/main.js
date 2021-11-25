/* eslint-disable no-continue */
/* eslint-disable no-unused-vars */
/* eslint-disable no-plusplus */
const io = require("socket.io-client");
const Bot = require('./bot.js');
const { readFileSync } = require('fs');

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

  // get bot infor from bot.json
  let raw_data = readFileSync(__dirname + '/bot.json', { encoding: 'utf8' })
  let data = JSON.parse(raw_data);
  const userId = data.BOT_ID;
  const username = data.BOT_USER_NAME;

  // connect to game
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
    let uname = username.split('[Bot] ')[1];
    console.log(data.text);
    if (
      // TODO: refactor to use regex, for simplicity
      (data.text === `Hi, ${username}` || data.text === `Hi, ${uname}`) ||
      (data.text === `hi, ${username}` || data.text === `hi, ${uname}`) ||
      (data.text === `Hi ${username}`  || data.text === `Hi ${uname}`)  ||
      (data.text === `hi ${username}`  || data.text === `hi ${uname}`)  ||
      (data.text === `HI ${username}`  || data.text === `HI ${uname}`)  ||
      (data.text === `HI, ${username}` || data.text === `HI, ${uname}`)
    ){
      socket.emit("chat_message", chatRoom, `Stay out of my way, ${data.username}`);
    }
    if (data.text === `JOIN ${username}` || data.text === `JOIN ${uname}`) {
      socket.emit("set_force_start", customGameId, true);
    }
    if (data.text === `LEAVE ${username}` || data.text === `LEAVE ${uname}`) {
      socket.emit('cancel');
      process.exit(0);
    }
  });

  socket.on("error_set_username", (error) => {
    if (error) {
      console.error(error);
    }
  });
  
  socket.on("game_lost", () => {
    console.log(`${username} lost!`);
    leaveGame();
  });
  
  socket.on("game_won", () => {
    console.log(`${username} won!`);
    leaveGame();
  });
  
  function leaveGame() {
    console.log(`${username} left the game`);
    socket.emit("leave_game");
  }

  const bot = new Bot(socket);
  
  socket.on("game_start", (data) => {
    Object.keys(data).forEach(key => {
      bot[key] = data[key];
    })
    const replayUrl = `http://bot.generals.io/replays/${encodeURIComponent(data.replay_id)}`;
    console.log(`Game starting! The replay will be available after the game at ${replayUrl}`);
  });
  
  socket.on("game_update", bot.update);
});