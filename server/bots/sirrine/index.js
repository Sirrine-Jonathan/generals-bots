const path = require('path');

function basename(pathName) {
  return path.basename(path.resolve(pathName));
}
console.log(basename('.'));
console.log(process.argv.length);
console.log(process.argv[2]);