const express = require("express");
const { spawn } = require("child_process");
const { readdirSync, readFileSync, statSync } = require('fs');
const path = require('path');
const PORT = (process.argv.length >= 3 && process.argv[2]) || process.env.PORT || 3001;
const app = express();

app.use(express.static(path.resolve(__dirname, '../client/build')));

app.get('/init', (req, res) => {
  const bots = readdirSync(__dirname + '/bots', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name );
  const payload = bots.map(bot => {
    let raw_data = readFileSync(__dirname + '/bots/' + bot + '/bot.json', { encoding: 'utf8' })
    let data = JSON.parse(raw_data);
    let stats = statSync(__dirname + '/bots');
    return {
      username: data.BOT_USER_NAME,
      dir: bot,
      last_updated: stats.mtime,
      version: data.BOT_VERSION
    };
  })
  res.json(payload);
})

app.get('/quickplay/:bot_id', (req, res) => {
  spawn(`cd ./server/bots/${req.params.bot_id} && yarn install && yarn start custom`, {
    stdio: 'inherit',
    shell: true
  });
  const customGameId = req.params.bot_id + '_quickplay';
  res.json({
    url: `http://bot.generals.io/games/${encodeURIComponent(customGameId)}`
  });
})

app.get('/invite/:bot_id/:game_id', (req, res) => {
  spawn(`cd ./server/bots/${req.params.bot_id} && npm run start custom ${req.params.game_id}`, {
    stdio: 'inherit',
    shell: true
  });
  res.json({
    url: `http://bot.generals.io/games/${encodeURIComponent(req.params.game_id)}`
  });
})

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
})