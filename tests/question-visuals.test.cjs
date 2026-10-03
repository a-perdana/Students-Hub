'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

class Element {
  constructor(name) { this.name = name; this.attrs = {}; this.children = []; this.dataset = {}; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  appendChild(child) { this.children.push(child); return child; }
}
const document = {
  getElementById: () => null, head: new Element('head'),
  createElement: name => new Element(name),
  createElementNS: (_, name) => new Element(name),
  createTextNode: value => String(value),
};
const context = { window: {}, document };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../partials/question-visuals.js'), 'utf8'), context);
const api = context.window.StudentHubQuestionVisuals;
const emItem = {
  stem: 'In free space, a radio wave has a frequency of 2.0 \u00d7 10\u2078 Hz and a gamma ray has a frequency of 6.0 \u00d7 10\u00b2\u2070 Hz. Which row gives the ratio (speed of gamma ray) / (speed of radio wave) and the ratio (wavelength of gamma ray) / (wavelength of radio wave)?',
};
function find(node, predicate) {
  if (!node || typeof node === 'string') return [];
  return (predicate(node) ? [node] : []).concat(node.children.flatMap(child => find(child, predicate)));
}
function textContent(node) {
  return typeof node === 'string' ? node : (node.textContent || '') + node.children.map(textContent).join('');
}

test('EM question uses the two frequencies given, without displaying calculated answers', () => {
  const spec = api.visualFor(emItem);
  assert.equal(spec.renderer, 'em-wave-comparison');
  assert.equal(spec.radioFrequency.coefficient, '2.0');
  assert.equal(spec.gammaFrequency.exponent, 20);
  const figure = api.render(spec);
  assert.match(textContent(figure), /Radio wave/);
  assert.match(textContent(figure), /Gamma ray/);
  assert.match(textContent(figure), /not drawn to scale/);
  assert.doesNotMatch(textContent(figure), /amplitude|3\.3|3\.0.*10/);
});
test('stale explicit wave metadata is repaired from the current stem', () => {
  assert.equal(api.visualFor({ ...emItem, visual: { kind: 'programmatic', renderer: 'wave-diagram' } }).renderer, 'em-wave-comparison');
});
test('HTML-only stems preserve scientific exponents', () => {
  const stemHtml = emItem.stem.replace('10\u2078', '10<sup>8</sup>').replace('10\u00b2\u2070', '10<sup>20</sup>');
  assert.equal(api.visualFor({ stemHtml: '<p>' + stemHtml + '</p>' }).gammaFrequency.exponent, 20);
});
test('explicit comparison with different frequencies is blocked', () => {
  const spec = api.visualFor(emItem);
  const item = { ...emItem, visual: { ...spec, radioFrequency: { coefficient: '9.0', exponent: 8 } } };
  assert.equal(api.visualFor(item), null);
  assert.ok(api.inspectVisual(item).issues.length);
});
test('malformed comparison cannot throw during render', () => {
  assert.equal(api.render({ kind: 'programmatic', renderer: 'em-wave-comparison' }), null);
});
test('chapter metadata cannot trigger a scientific drawing', () => {
  assert.equal(api.visualFor({ stem: 'Calculate the ratio of these two values.', chapter: 'Waves frequency atom electron circuit' }), null);
});
test('topic keywords cannot invent components or an element', () => {
  for (const stem of ['Find the reading on this voltmeter.', 'An atom loses an electron.', 'Sound waves have a frequency of 200 Hz.', 'Describe a magnetic field.', 'Calculate the titration concentration.', 'Chromatography separates this mixture.']) {
    assert.equal(api.visualFor({ stem }), null, stem);
  }
});
test('longitudinal waves cannot receive an explicit spatial transverse sketch', () => {
  assert.equal(api.visualFor({ stem: 'Sound is a longitudinal wave.', visual: { kind: 'programmatic', renderer: 'wave-diagram' } }), null);
});
test('wave geometry places amplitude at a crest and wavelength crest to crest', () => {
  const figure = api.render({ kind: 'programmatic', renderer: 'wave-diagram' });
  const wave = find(figure, node => node.attrs['data-measure'] === 'wave')[0];
  const points = new Map(wave.attrs.points.split(' ').map(pair => pair.split(',').map(Number)));
  const amplitude = find(figure, node => node.attrs['data-measure'] === 'amplitude')[0].children[0].attrs;
  assert.equal(Number(amplitude.x1), 140);
  assert.equal(Number(amplitude.y1), 145);
  assert.equal(Number(amplitude.y2), points.get(140));
  const wavelength = find(figure, node => node.attrs['data-measure'] === 'wavelength')[0].children[0].attrs;
  assert.equal(points.get(Number(wavelength.x1)), points.get(Number(wavelength.x2)));
  assert.equal(Number(wavelength.x2) - Number(wavelength.x1), 200);
  assert.equal(points.get(140), 95);
});
test('sound P and Q have equal periods and different amplitudes', () => {
  const item = { stem: 'Sound P and sound Q have the same frequency. The waveform of sound P has a larger amplitude than the waveform of sound Q. Which statement is correct?', visual: { kind: 'programmatic', renderer: 'wave-diagram' } };
  const spec = api.visualFor(item);
  assert.equal(spec.renderer, 'wave-comparison');
  const waves = find(api.render(spec), n => n.attrs['data-measure'] === 'wave');
  const points = waves.map(w => w.attrs.points.split(' ').map(p => p.split(',').map(Number)));
  assert.equal(points[0][45][1], 65);
  assert.equal(points[1][45][1], 208);
  assert.equal(points[0][225][1], 65);
  assert.equal(points[1][225][1], 208);
});
test('disabled, retired and authored asset items never get a second diagram', () => {
  for (const extras of [{ visual: false }, { retired: 'Retired duplicate' }, { diagramAsset: 'assets/item.svg' }, { diagramStoragePath: 'practice-diagrams/physics/item.svg' }, { diagramUrl: 'https://example.com/item.svg' }]) {
    assert.equal(api.visualFor({ ...emItem, ...extras }), null);
  }
});
test('known broken templates are blocked even if Firestore includes them', () => {
  for (const renderer of ['circuit-diagram', 'bar-magnet-field', 'titration-setup', 'parallel-lines', 'bearing-diagram', 'sector-circle']) {
    const visual = { kind: 'programmatic', renderer };
    assert.equal(api.render(visual), null);
    assert.equal(api.visualFor({ stem: 'Legacy question.', visual }), null);
  }
});
test('other explicit contradictions are quarantined', () => {
  for (const item of [
    { stem: 'Plant cells have no chloroplasts.', visual: { kind: 'programmatic', renderer: 'cell-diagram', cellType: 'plant' } },
    { stem: 'Model a reaction between carbon and oxygen.', visual: { kind: 'programmatic', renderer: 'particle-model' } },
    { stem: 'A has coordinates (1, 0, 2).', visual: { kind: 'programmatic', renderer: 'coordinate-plane' } },
    { stem: 'Find the displacement-time graph.', visual: { kind: 'programmatic', renderer: 'line-graph' } },
  ]) assert.equal(api.visualFor(item), null);
});
test('collision inference requires both verified directions, not guessed rebound', () => {
  const initial = 'Ball X has a mass of 0.20 kg and moves at 4.0 m s\u207b\u00b9 along a straight line. It hits a stationary ball Y of mass 0.30 kg head-on. ';
  assert.equal(api.visualFor({ stem: initial + 'After the collision the balls stick together.' }), null);
  assert.equal(api.visualFor({ stem: initial + 'After the collision, X moves back along the line at 0.80 m s\u207b\u00b9, and Y moves forwards along the same line.' }).renderer, 'collision-balls');
});
test('Pythagoras remains supported from exact stem dimensions', () => {
  const spec = api.visualFor({ stem: 'A right-angled triangle has two shorter sides of length 7 cm and 10 cm. Find the length of the hypotenuse.' });
  assert.equal(spec.renderer, 'right-triangle');
  assert.equal(spec.base, '10 cm');
  assert.equal(spec.height, '7 cm');
});
test('triangle fallback refuses mixed units and solid fallback refuses different face counts', () => {
  assert.equal(api.visualFor({ stem: 'A right-angled triangle has two shorter sides of length 7 cm and 10 m. Find the hypotenuse.' }), null);
  assert.equal(api.visualFor({ stem: 'A 3D shape has 7 faces, 15 edges and 10 vertices. Two of its faces are triangles. The other three faces are rectangles.' }), null);
});
test('loaded divider source is connected in the wire, not floating beside it', () => {
  const figure = api.render({ kind: 'programmatic', renderer: 'loaded-voltmeter-divider' });
  const lines = find(figure, n => n.name === 'line').map(n => n.attrs);
  assert.ok(lines.some(l => l.x1 === '100' && l.y1 === '92' && l.x2 === '100' && l.y2 === '136'));
  assert.ok(lines.some(l => l.x1 === '84' && l.y1 === '136' && l.x2 === '116' && l.y2 === '136'));
  assert.ok(lines.some(l => l.x1 === '92' && l.y1 === '154' && l.x2 === '108' && l.y2 === '154'));
  assert.ok(lines.some(l => l.x1 === '100' && l.y1 === '154' && l.x2 === '100' && l.y2 === '220'));
  assert.ok(!lines.some(l => l.x1 === '100' && l.y1 === '92' && l.x2 === '100' && l.y2 === '220'));
});
