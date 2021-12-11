/*
	Only run this file once
*/
const io = require("socket.io-client");
const { readFileSync } = require('fs');

const base = "https://bot.generals.io";
const socket = io(base);

socket.on("connect", () => {
	let raw_data = readFileSync(__dirname + '/bot.json', { encoding: 'utf8' })
    let data = JSON.parse(raw_data);
	console.log(data);
	socket.emit("set_username", data.BOT_ID, data.BOT_USER_NAME);
	setTimeout(() => process.exit(0), 5000);
});

socket.on("error_set_username", (error) => {
	if (error) {
		console.error(error);
	}
});