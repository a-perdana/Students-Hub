'use strict';
const fs = require('node:fs');
const path = require('node:path');

function imageProductionPaths() {
  const root = path.resolve(__dirname, '../..');
  const sharedRoot = path.dirname(root);
  const sharedBank = path.join(sharedRoot, 'docs/practice-bank');
  const bankArg = process.argv.find(arg => arg.startsWith('--bank-root='));
  if (bankArg === '--bank-root=') throw new Error('--bank-root requires a directory.');
  const bankRoot = bankArg ? path.resolve(bankArg.slice(12)) : sharedBank;
  if (!fs.existsSync(path.join(bankRoot, 'items'))) {
    throw new Error('Question sources are external to Students Hub. Supply --bank-root=<directory containing items and reviews>.');
  }
  const inside = (directory, filename) => {
    const relative = path.relative(directory, filename);
    return relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
  };
  function assertOutput(filename) {
    if (!inside(root, filename) && !(bankRoot === sharedBank && inside(sharedRoot, filename))) {
      throw new Error('Report output must stay inside the Students Hub or shared workspace.');
    }
  }
  return { root, bankRoot, assertOutput };
}

module.exports = { imageProductionPaths };
