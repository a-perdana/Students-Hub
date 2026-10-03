'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function fixture() {
  const tmp = path.join(root, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const dir = fs.mkdtempSync(path.join(tmp, 'image-production-'));
  const bankRoot = path.join(dir, 'bank');
  const output = path.join(dir, 'queue.json');
  const files = new Map();
  for (const subject of ['mathematics', 'physics', 'chemistry', 'biology']) {
    const bank = 'g11-' + subject;
    const item = {
      id: 'fixture-' + subject, diagramNeeded: true, topicGroup: subject,
      stem: 'An item-specific ' + subject + ' question.',
      stemHtml: '<p>An item-specific question.</p>',
      options: ['Choice A', 'Choice B'], loCodes: ['fixture-objective'],
    };
    const source = path.join(bankRoot, 'items', bank, 'fixture.json');
    const verdicts = path.join(bankRoot, 'reviews', bank, 'verdicts.json');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.mkdirSync(path.dirname(verdicts), { recursive: true });
    fs.writeFileSync(source, JSON.stringify([item]));
    fs.writeFileSync(verdicts, JSON.stringify({ verdicts: { [item.id]: { verdict: 'pass' } } }));
    files.set(subject, source);
  }
  const args = ['--bank-root=' + bankRoot];
  const run = (name, extra = []) => execFileSync(process.execPath, [
    path.join(root, 'scripts/practice', name), ...args, ...extra,
  ], { cwd: dir, encoding: 'utf8' });
  const plan = () => { run('plan-image-production.js', ['--output=' + output]); return read(output); };
  const cleanup = () => {
    const resolved = fs.realpathSync(dir);
    assert.ok(resolved.startsWith(fs.realpathSync(root) + path.sep));
    fs.rmSync(resolved, { recursive: true });
  };
  return { dir, bankRoot, files, output, run, plan, cleanup };
}

test('production queue survives relocation and invalidates changed questions', () => {
  const f = fixture();
  try {
    const first = f.plan();
    assert.equal(first.summary.candidates, 4);
    assert.equal(new Set(first.firstBatch).size, 4);
    for (const job of first.jobs) {
      assert.equal(job.styleProfile, job.subject);
      assert.equal(job.questionReview, 'passed');
      assert.equal(job.styleVersion, 1);
      assert.ok(job.sourceFile.startsWith('items/'));
      assert.equal(path.isAbsolute(job.sourceFile), false);
    }
    const job = first.jobs.find(job => job.subject === 'physics');
    job.status = 'approved';
    job.prompt = 'An exact reviewed production prompt.';
    job.reviewNotes = ['Directions checked.'];
    fs.writeFileSync(f.output, JSON.stringify(first));
    const source = f.files.get('physics');
    const items = read(source);
    delete items[0].diagramNeeded;
    fs.writeFileSync(source, JSON.stringify(items));
    const second = f.plan();
    const retained = second.jobs.find(entry => entry.id === job.id);
    assert.equal(retained.status, 'approved');
    assert.equal(retained.prompt, job.prompt);
    assert.deepEqual(retained.reviewNotes, job.reviewNotes);
    assert.equal(second.summary.retainedRequests, 1);
    items[0].options[0] = 'A changed choice.';
    fs.writeFileSync(source, JSON.stringify(items));
    const third = f.plan();
    const reset = third.jobs.find(entry => entry.id === job.id);
    assert.equal(reset.status, 'brief-review');
    assert.equal(reset.prompt, null);
    assert.equal(reset.sourceChanged, true);
    assert.deepEqual(reset.reviewNotes, []);
    items[0].retired = 'Retired fixture.';
    fs.writeFileSync(source, JSON.stringify(items));
    assert.equal(f.plan().jobs.some(entry => entry.id === job.id), false);
  } finally { f.cleanup(); }
});

test('attachment audit checks the external bank and rejects retired metadata', () => {
  const f = fixture();
  try {
    const source = f.files.get('physics');
    const items = read(source);
    const asset = path.join(f.bankRoot, 'assets/fixture.png');
    fs.mkdirSync(path.dirname(asset), { recursive: true });
    fs.copyFileSync(path.join(root, 'docs/practice-bank/assets/g11-physics/g11-science-r3740-c.v1.png'), asset);
    items[0].diagramAsset = 'assets/fixture.png';
    items[0].diagramAlt = 'An accessible fixture image description.';
    fs.writeFileSync(source, JSON.stringify(items));
    const report = JSON.parse(f.run('audit-visuals.js', ['--strict', '--json']));
    assert.equal(report.counts.assets, 1);
    assert.equal(report.counts.invalid, 0);
    items[0].visual = { renderer: 'obsolete' };
    fs.writeFileSync(source, JSON.stringify(items));
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/practice/audit-visuals.js'),
      '--bank-root=' + f.bankRoot, '--strict', '--json'], { encoding: 'utf8', cwd: f.dir });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).counts.invalid, 1);
  } finally { f.cleanup(); }
});

test('missing sources and output paths outside the workspace fail without writing', () => {
  const f = fixture();
  try {
    const script = path.join(root, 'scripts/practice/plan-image-production.js');
    const missing = spawnSync(process.execPath, [script, '--bank-root=' + path.join(f.dir, 'missing')], { encoding: 'utf8' });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Supply --bank-root/);
    const unsafe = spawnSync(process.execPath, [script, '--bank-root=' + f.bankRoot,
      '--output=' + path.resolve(root, '../outside-image-test.json')], { encoding: 'utf8' });
    assert.notEqual(unsafe.status, 0);
    assert.match(unsafe.stderr, /Report output must stay inside/);
  } finally { f.cleanup(); }
});

test('committed production records have subject styles and no answer keys', () => {
  const styles = read(path.join(root, 'docs/practice-bank/IMAGE-STYLES.json'));
  const subjects = ['mathematics', 'physics', 'chemistry', 'biology'];
  assert.equal(new Set(subjects.map(subject => styles.subjects[subject].typography)).size, 4);
  const queue = read(path.join(root, 'docs/practice-bank/reviews/image-production-queue.json'));
  assert.ok(queue.jobs.length > 0);
  for (const job of queue.jobs) {
    assert.ok(styles.subjects[job.styleProfile]);
    assert.equal(Object.hasOwn(job, 'correctAnswer'), false);
    assert.equal(Object.hasOwn(job, 'distractorRationale'), false);
  }
  const asset = path.join(root, 'docs/practice-bank/assets/g11-physics/g11-science-r3740-c.v1.png');
  const png = fs.readFileSync(asset);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(fs.existsSync(asset.replace(/\.png$/, '.prompt.md')));
});
