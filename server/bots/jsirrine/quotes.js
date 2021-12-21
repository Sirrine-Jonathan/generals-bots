const quotes = [
  "Good luck out there!",
  "Watch out!",
  "Here I come!"
]

function getRandomQuote() {
  let index = Math.floor(Math.random() * quotes.length);
  return quotes[index];
}

module.exports = {
  quotes,
  getRandomQuote
}