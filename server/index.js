const express = require("express");
const PORT = process.env.PORT || 3001;
const app = express();
app.get('/api', (req, res) => {
  res.json({ message: "Hello from server!" });
})
app.post('/quickplay', (req, res) => {
  res.json(req);
})
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
})