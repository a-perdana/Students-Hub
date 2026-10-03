'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');

test('practice displays attached images without a generated-diagram fallback', () => {
  const html = fs.readFileSync(path.join(root, 'practice-run.html'), 'utf8');
  assert.doesNotMatch(html, /StudentHubQuestionVisuals|question-visuals\.js|visualFor\(/);
  assert.match(html, /it\.diagramUrl \|\| it\.diagramStoragePath/);
  assert.match(html, /resolveDiagramUrl/);
  assert.equal(fs.existsSync(path.join(root, 'partials/question-visuals.js')), false);
});

test('an incremental build does not retain the retired renderer', () => {
  const filename = path.join(root, 'dist/partials/question-visuals.js');
  assert.equal(fs.existsSync(filename), false, 'Run npm run build before this check.');
});
