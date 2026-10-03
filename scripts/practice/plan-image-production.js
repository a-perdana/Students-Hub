#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { imageProductionPaths } = require('./image-production-paths.cjs');
const { root, bankRoot, assertOutput } = imageProductionPaths();
const itemsRoot = path.join(bankRoot, 'items');
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const output = path.resolve(root, outputArg ? outputArg.slice(9) : 'docs/practice-bank/reviews/image-production-queue.json');
assertOutput(output);
const canonicalQueue = path.join(root, 'docs/practice-bank/reviews/image-production-queue.json');
const previousPath = fs.existsSync(output) ? output : canonicalQueue;
const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, 'utf8')) : {};
const previousJobs = new Map((previous.jobs || []).map(job => [job.id, job]));
const styles = JSON.parse(fs.readFileSync(path.join(root, 'docs/practice-bank/IMAGE-STYLES.json'), 'utf8'));
const statuses = new Set(['brief-review', 'ready-to-generate', 'generated', 'content-review', 'approved', 'published', 'skipped']);
const jobs = [];
const banks = [];
const summary = { sourceItems: 0, attachedAssets: 0, retainedRequests: 0, declaredMissing: 0, untriaged: 0, candidates: 0, questionReviewPassed: 0, questionReviewPending: 0 };

for (const bank of fs.readdirSync(itemsRoot).sort()) {
  const dir = path.join(itemsRoot, bank);
  if (!fs.statSync(dir).isDirectory()) continue;
  const verdictPath = path.join(bankRoot, 'reviews', bank, 'verdicts.json');
  const verdicts = fs.existsSync(verdictPath) ? JSON.parse(fs.readFileSync(verdictPath, 'utf8')).verdicts || {} : {};
  const counts = { bank, sourceItems: 0, attachedAssets: 0, candidates: 0, untriaged: 0 };
  for (const filename of fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    for (const item of JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))) {
      if (item.retired) continue;
      summary.sourceItems++;
      counts.sourceItems++;
      if (item.diagramAsset || item.diagramStoragePath || item.diagramUrl) {
        summary.attachedAssets++;
        counts.attachedAssets++;
        continue;
      }
      const old = previousJobs.get(item.id);
      if (!old && item.diagramNeeded !== true) {
        summary.untriaged++;
        counts.untriaged++;
        continue;
      }
      summary[item.diagramNeeded === true ? 'declaredMissing' : 'retainedRequests']++;
      counts.candidates++;
      const priority = old && Number.isInteger(old.priority) && old.priority >= 1 && old.priority <= 3 ? old.priority : 3;
      const questionReview = verdicts[item.id] && verdicts[item.id].verdict === 'pass' ? 'passed' : 'pending';
      summary[questionReview === 'passed' ? 'questionReviewPassed' : 'questionReviewPending']++;
      const hash = crypto.createHash('sha256').update(JSON.stringify({
        stem: item.stem, stemHtml: item.stemHtml, options: item.options, loCodes: item.loCodes,
      })).digest('hex');
      const unchanged = old && old.sourceHash === hash;
      const subject = item.topicGroup === 'biology' || item.topicGroup === 'chemistry' || item.topicGroup === 'physics'
        ? item.topicGroup : bank.endsWith('mathematics') ? 'mathematics' : 'science';
      jobs.push({
        id: item.id, bank, subject, grade: Number(bank.slice(1, 3)), priority,
        reason: item.diagramNeeded === true ? 'Question author requested an image' : 'Existing image-production request',
        questionReview,
        styleProfile: subject in styles.subjects ? subject : 'science',
        styleVersion: styles.version,
        status: unchanged && statuses.has(old.status) ? old.status : 'brief-review',
        sourceHash: hash,
        sourceChanged: !!old && !unchanged,
        sourceFile: path.relative(bankRoot, path.join(dir, filename)).replace(/\\/g, '/'),
        stem: item.stem, options: item.options, learningObjectives: item.loCodes,
        authorBrief: item.diagramBrief || null,
        proposedAsset: `assets/${bank}/${item.id}.v1.png`,
        prompt: unchanged && old.prompt ? old.prompt : null,
        reviewNotes: unchanged && old.reviewNotes ? old.reviewNotes : [],
      });
    }
  }
  banks.push(counts);
}

jobs.sort((a, b) => a.priority - b.priority || a.grade - b.grade || a.id.localeCompare(b.id));
summary.candidates = jobs.length;

// A small cross-subject batch calibrates the shared visual style before scaling.
const subjects = ['mathematics', 'physics', 'biology', 'chemistry'];
const groups = new Map(subjects.map(subject => [subject, jobs.filter(job =>
  job.subject === subject && job.questionReview === 'passed' && job.status === 'brief-review')]));
const firstBatch = [];
while (firstBatch.length < 10 && subjects.some(subject => groups.get(subject).length)) {
  for (const subject of subjects) {
    const job = groups.get(subject).shift();
    if (job) firstBatch.push(job.id);
    if (firstBatch.length === 10) break;
  }
}

const report = {
  scope: 'External authored question bank supplied via --bank-root; source records are not a live Firestore inventory.',
  summary, banks, firstBatch,
  workflow: {
    statuses: Array.from(statuses),
    production: 'One built-in image-generation call per reviewed item-specific prompt. No automatic runtime drawing.',
    review: 'Check exact values, angles, connections, arrows, labels, answer leakage and mobile readability before approval.',
    publishing: 'Require a passing question review and matching live stem; publish one approved asset using --only=<id> --diagram-only --apply.',
    resume: 'Reruns preserve requests, status, prompt and notes when the source hash matches. Changed questions return to brief-review.',
    styleGuide: 'docs/practice-bank/IMAGE-PRODUCTION-FORMAT.md',
  },
  jobs,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary));
console.log('First brief-review batch: ' + firstBatch.join(', '));
console.log('Queue: ' + path.relative(root, output).replace(/\\/g, '/'));
