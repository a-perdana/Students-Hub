#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { imageProductionPaths } = require('./image-production-paths.cjs');
const { root, bankRoot, assertOutput } = imageProductionPaths();
const entries = [];
const counts = { items: 0, assets: 0, requested: 0, untriaged: 0, invalid: 0 };
const itemsDir = path.join(bankRoot, 'items');

for (const bank of fs.readdirSync(itemsDir).sort()) {
  const dir = path.join(itemsDir, bank);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const filename of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    for (const item of JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))) {
      if (item.retired) continue;
      counts.items++;
      const issues = [];
      const attached = !!(item.diagramAsset || item.diagramStoragePath || item.diagramUrl);
      const status = attached ? 'assets' : item.diagramNeeded === true ? 'requested' : 'untriaged';
      counts[status]++;
      if (Object.hasOwn(item, 'visual')) issues.push('Retired visual metadata must be removed.');
      if (item.diagramAsset) {
        const asset = path.resolve(bankRoot, item.diagramAsset);
        if (!asset.startsWith(bankRoot + path.sep)) issues.push('Asset path escapes the question bank.');
        else if (!fs.existsSync(asset) || !fs.statSync(asset).isFile()) issues.push('Local image file is missing.');
      }
      if (attached && (typeof item.diagramAlt !== 'string' || item.diagramAlt.trim().length < 10)) issues.push('Image needs meaningful alt text.');
      if (issues.length) counts.invalid++;
      if (status !== 'untriaged' || issues.length) entries.push({
        id: item.id, bank, file: path.relative(bankRoot, path.join(dir, filename)).replace(/\\/g, '/'),
        status, asset: item.diagramAsset || item.diagramStoragePath || item.diagramUrl || null, issues,
      });
    }
  }
}

const report = { scope: 'Local image attachments only; no diagram inference or scientific approval.', counts, entries };
const output = process.argv.find(arg => arg.startsWith('--output='));
if (output) {
  const destination = path.resolve(root, output.slice('--output='.length));
  assertOutput(destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
}
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(JSON.stringify(counts));
  for (const entry of entries.filter(e => e.issues.length)) console.log(`${entry.id}: ${entry.issues.join(' ')}`);
  console.log('File checks do not replace scientific and visual review.');
}
if (process.argv.includes('--strict') && counts.invalid) process.exitCode = 1;
