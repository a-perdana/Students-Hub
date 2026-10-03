(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STYLE_ID = 'sh-question-visuals-style';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .q-visual {
        margin: 18px 0 22px;
        border: 1px solid rgba(108, 92, 231, .20);
        background:
          radial-gradient(circle at 18% 0%, rgba(124, 58, 237, .08), transparent 34%),
          linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        border-radius: 16px;
        padding: 14px;
        box-shadow:
          0 18px 38px -30px rgba(15, 23, 42, .55),
          inset 0 1px 0 rgba(255, 255, 255, .84);
        position: relative;
        overflow: hidden;
      }
      .q-visual svg {
        display: block;
        width: 100%;
        height: auto;
        max-height: 270px;
      }
      .q-visual-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 9px;
        color: #4338ca;
        font-size: .74rem;
        font-weight: 800;
        letter-spacing: .07em;
        text-transform: uppercase;
        background: rgba(238, 242, 255, .92);
        border: 1px solid rgba(129, 140, 248, .24);
        border-radius: 999px;
        padding: 5px 9px;
      }
      .q-visual-title::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: linear-gradient(135deg, #6c5ce7, #06b6d4);
        box-shadow: 0 0 0 3px rgba(108, 92, 231, .12);
      }
      .q-visual[data-family="science"] {
        border-color: rgba(20, 184, 166, .24);
        background:
          radial-gradient(circle at 18% 0%, rgba(20, 184, 166, .09), transparent 34%),
          linear-gradient(180deg, #ffffff 0%, #f5fffc 100%);
      }
      .q-visual[data-family="science"] .q-visual-title {
        color: #0f766e;
        background: rgba(240, 253, 250, .94);
        border-color: rgba(20, 184, 166, .24);
      }
      .q-visual[data-family="science"] .q-visual-title::before {
        background: linear-gradient(135deg, #14b8a6, #22c55e);
        box-shadow: 0 0 0 3px rgba(20, 184, 166, .13);
      }
      .q-visual-caption {
        margin: 9px 2px 0;
        color: var(--ink-3, #64748b);
        font-size: .82rem;
        line-height: 1.45;
      }
      @media (max-width: 540px) {
        .q-visual { padding: 10px; }
        .q-visual svg { max-height: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function escText(value) {
    return String(value == null ? '' : value);
  }

  function svgEl(name, attrs, children) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value != null) el.setAttribute(key, String(value));
    });
    (children || []).forEach(child => {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    });
    return el;
  }

  function text(x, y, value, attrs) {
    return svgEl('text', Object.assign({
      x, y,
      fill: '#1e293b',
      'font-family': 'DM Sans, Arial, sans-serif',
      'font-size': 14,
      'font-weight': 700,
      'text-anchor': 'middle',
      'paint-order': 'stroke',
      stroke: '#ffffff',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }, attrs || {}), [escText(value)]);
  }

  function line(x1, y1, x2, y2, attrs) {
    return svgEl('line', Object.assign({
      x1, y1, x2, y2,
      stroke: '#334155',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    }, attrs || {}));
  }

  function rect(x, y, width, height, attrs) {
    const boxAttrs = Object.assign({}, attrs || {});
    if (Number(width) >= 500 && Number(height) >= 180 && boxAttrs.fill === '#fbfdff') {
      boxAttrs.fill = 'url(#qv-panel)';
      boxAttrs.stroke = '#dbeafe';
      boxAttrs.filter = 'url(#qv-panel-shadow)';
    }
    return svgEl('rect', Object.assign({
      x, y, width, height,
      rx: 10,
      fill: '#ffffff',
      stroke: '#c4b5fd',
      'stroke-width': 2,
    }, boxAttrs));
  }

  function polygon(points, attrs) {
    return svgEl('polygon', Object.assign({
      points,
      fill: '#eef2ff',
      stroke: '#6c5ce7',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }, attrs || {}));
  }

  function circle(cx, cy, r, attrs) {
    return svgEl('circle', Object.assign({
      cx, cy, r,
      fill: '#ffffff',
      stroke: '#6c5ce7',
      'stroke-width': 2,
    }, attrs || {}));
  }

  function makeSvg(viewBox, children) {
    const [, , width = '560', height = '260'] = String(viewBox).split(/\s+/);
    const defs = svgEl('defs', {}, [
      svgEl('linearGradient', { id: 'qv-canvas', x1: '0', y1: '0', x2: '1', y2: '1' }, [
        svgEl('stop', { offset: '0%', 'stop-color': '#ffffff' }),
        svgEl('stop', { offset: '55%', 'stop-color': '#f8fbff' }),
        svgEl('stop', { offset: '100%', 'stop-color': '#eef7ff' }),
      ]),
      svgEl('linearGradient', { id: 'qv-panel', x1: '0', y1: '0', x2: '1', y2: '1' }, [
        svgEl('stop', { offset: '0%', 'stop-color': '#ffffff' }),
        svgEl('stop', { offset: '100%', 'stop-color': '#f8fbff' }),
      ]),
      svgEl('filter', { id: 'qv-panel-shadow', x: '-10%', y: '-12%', width: '120%', height: '128%' }, [
        svgEl('feDropShadow', {
          dx: '0',
          dy: '10',
          stdDeviation: '10',
          'flood-color': '#0f172a',
          'flood-opacity': '.10',
        }),
      ]),
      svgEl('pattern', { id: 'qv-grid', width: '24', height: '24', patternUnits: 'userSpaceOnUse' }, [
        svgEl('path', {
          d: 'M 24 0 L 0 0 0 24',
          fill: 'none',
          stroke: '#e2e8f0',
          'stroke-width': '.7',
          opacity: '.55',
        }),
      ]),
      svgEl('marker', { id: 'qv-arrow-slate', markerWidth: '9', markerHeight: '9', refX: '7', refY: '4.5', orient: 'auto' }, [
        polygon('0,0 9,4.5 0,9', { fill: '#334155', stroke: 'none' }),
      ]),
    ]);
    const canvas = svgEl('rect', { x: 0, y: 0, width, height, rx: 22, fill: 'url(#qv-canvas)' });
    const grid = svgEl('rect', { x: 0, y: 0, width, height, rx: 22, fill: 'url(#qv-grid)', opacity: '.42' });
    return svgEl('svg', {
      viewBox,
      role: 'img',
      'aria-hidden': 'true',
      focusable: 'false',
    }, [defs, canvas, grid, ...children]);
  }

  function solidFactCards(spec) {
    const stats = spec.stats || {};
    const faces = Array.isArray(spec.faces) ? spec.faces : [];
    const children = [
      rect(16, 16, 528, 238, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 43, spec.heading || 'Solid shape clues', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
    ];

    [
      ['faces', stats.faces],
      ['edges', stats.edges],
      ['vertices', stats.vertices],
    ].filter(([, value]) => value != null).forEach(([label, value], index) => {
      const x = 55 + index * 96;
      children.push(rect(x, 66, 78, 70, { fill: '#ffffff', stroke: '#c7d2fe', rx: 14 }));
      children.push(text(x + 39, 96, value, { fill: '#312e81', 'font-size': 26, 'font-weight': 900 }));
      children.push(text(x + 39, 120, label, { fill: '#64748b', 'font-size': 12, 'font-weight': 800 }));
    });

    faces.forEach((face, index) => {
      const x = 330 + (index % 3) * 62;
      const y = 68 + Math.floor(index / 3) * 76;
      if (face.shape === 'triangle') {
        children.push(polygon(`${x + 30},${y + 4} ${x + 4},${y + 52} ${x + 56},${y + 52}`, {
          fill: '#e0f2fe',
          stroke: '#0891b2',
          'stroke-width': 2.5,
        }));
      } else {
        children.push(rect(x + 2, y + 11, 56, 42, {
          fill: '#fef3c7',
          stroke: '#d97706',
          'stroke-width': 2.5,
          rx: 6,
        }));
      }
      children.push(text(x + 30, y + 70, face.label || face.shape, {
        fill: '#475569',
        'font-size': 11,
        'font-weight': 800,
      }));
    });

    children.push(line(302, 74, 302, 218, { stroke: '#e2e8f0', 'stroke-width': 2 }));
    children.push(text(421, 205, spec.note || 'Count all the clues together.', {
      fill: '#475569',
      'font-size': 13,
      'font-weight': 700,
    }));
    return makeSvg('0 0 560 270', children);
  }

  function coneOnCylinder(spec) {
    const children = [
      rect(20, 18, 520, 244, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Build the solid, then imagine the front view', {
        fill: '#4338ca',
        'font-size': 15,
        'font-weight': 800,
      }),
      svgEl('ellipse', { cx: 280, cy: 148, rx: 76, ry: 18, fill: '#dbeafe', stroke: '#2563eb', 'stroke-width': 3 }),
      rect(204, 148, 152, 72, { fill: '#bfdbfe', stroke: '#2563eb', 'stroke-width': 3, rx: 4 }),
      svgEl('ellipse', { cx: 280, cy: 220, rx: 76, ry: 18, fill: '#eff6ff', stroke: '#2563eb', 'stroke-width': 3 }),
      polygon('280,58 204,148 356,148', { fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 3 }),
      svgEl('ellipse', { cx: 280, cy: 148, rx: 76, ry: 18, fill: 'none', stroke: '#d97706', 'stroke-width': 3 }),
      text(132, 106, 'cone', { fill: '#92400e', 'font-size': 13 }),
      line(166, 109, 220, 116, { stroke: '#d97706', 'stroke-width': 2 }),
      text(122, 199, 'cylinder', { fill: '#1d4ed8', 'font-size': 13 }),
      line(172, 194, 216, 183, { stroke: '#2563eb', 'stroke-width': 2 }),
      text(421, 92, 'front view', { fill: '#475569', 'font-size': 12, 'font-weight': 800 }),
      line(420, 110, 420, 219, { stroke: '#94a3b8', 'stroke-width': 2, 'stroke-dasharray': '5 6' }),
      polygon('455,112 418,155 492,155', { fill: '#fff7ed', stroke: '#f97316', 'stroke-width': 2.5 }),
      rect(423, 155, 64, 62, { fill: '#eff6ff', stroke: '#2563eb', 'stroke-width': 2.5, rx: 3 }),
    ];
    return makeSvg('0 0 560 280', children);
  }

  function squareTableRow(spec) {
    const counts = Array.isArray(spec.counts) && spec.counts.length ? spec.counts : [1, 2, 3];
    const children = [
      rect(18, 18, 524, 236, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Tables joined in a row', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
    ];
    counts.forEach((count, rowIndex) => {
      const y = 72 + rowIndex * 52;
      children.push(text(78, y + 26, `${count} table${count === 1 ? '' : 's'}`, {
        fill: '#475569',
        'font-size': 13,
        'text-anchor': 'end',
      }));
      for (let i = 0; i < count; i++) {
        children.push(rect(104 + i * 44, y, 40, 34, {
          rx: 4,
          fill: '#ede9fe',
          stroke: '#7c3aed',
          'stroke-width': 2,
        }));
      }
      const seats = count * 2 + 2;
      for (let i = 0; i < seats; i++) {
        const x = 113 + Math.min(i, count - 1) * 44 + (i >= count ? 24 : 0);
        const cy = i < count ? y - 8 : y + 43;
        children.push(circle(x, cy, 4, { fill: '#14b8a6', stroke: 'none' }));
      }
      children.push(text(404, y + 24, `${seats} seats`, { fill: '#0f766e', 'font-size': 14 }));
    });
    return makeSvg('0 0 560 270', children);
  }

  function stickSquarePattern(spec) {
    const counts = Array.isArray(spec.counts) && spec.counts.length ? spec.counts : [1, 2, 3];
    const children = [
      rect(18, 18, 524, 236, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Stick pattern', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
    ];
    counts.forEach((count, rowIndex) => {
      const y = 76 + rowIndex * 54;
      const startX = 116;
      children.push(text(78, y + 18, `Pattern ${count}`, { fill: '#475569', 'font-size': 13, 'text-anchor': 'end' }));
      for (let i = 0; i < count; i++) {
        const x = startX + i * 34;
        children.push(line(x, y, x + 34, y, { stroke: '#7c3aed', 'stroke-width': 4 }));
        children.push(line(x, y + 34, x + 34, y + 34, { stroke: '#7c3aed', 'stroke-width': 4 }));
        if (i === 0) children.push(line(x, y, x, y + 34, { stroke: '#7c3aed', 'stroke-width': 4 }));
        children.push(line(x + 34, y, x + 34, y + 34, { stroke: '#7c3aed', 'stroke-width': 4 }));
      }
      children.push(text(418, y + 23, `${3 * count + 1} sticks`, { fill: '#0f766e', 'font-size': 14 }));
    });
    return makeSvg('0 0 560 270', children);
  }

  function functionMachine(spec) {
    const steps = Array.isArray(spec.steps) && spec.steps.length ? spec.steps : ['x 2', '+ 8'];
    const output = spec.output || '?';
    const children = [
      rect(18, 18, 524, 182, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Function machine', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      text(70, 119, 'input', { fill: '#64748b', 'font-size': 13 }),
      line(100, 114, 142, 114, { stroke: '#94a3b8', 'stroke-width': 3 }),
    ];
    let x = 152;
    steps.forEach((step, index) => {
      children.push(rect(x, 86, 86, 56, { fill: '#ede9fe', stroke: '#7c3aed', 'stroke-width': 2.5, rx: 10 }));
      children.push(text(x + 43, 121, step, { fill: '#312e81', 'font-size': 19, 'font-weight': 900 }));
      children.push(line(x + 90, 114, x + 132, 114, { stroke: '#94a3b8', 'stroke-width': 3 }));
      x += 138;
      if (index === steps.length - 1) {
        children.push(rect(x, 86, 86, 56, { fill: '#dcfce7', stroke: '#16a34a', 'stroke-width': 2.5, rx: 10 }));
        children.push(text(x + 43, 121, output, { fill: '#166534', 'font-size': 19, 'font-weight': 900 }));
      }
    });
    return makeSvg('0 0 560 220', children);
  }

  function parallelLines(spec) {
    const angle = spec.angle || '?';
    const target = spec.target || '?';
    const children = [
      rect(18, 18, 524, 202, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Parallel lines with a transversal', {
        fill: '#4338ca',
        'font-size': 16,
        'font-weight': 800,
      }),
      line(82, 86, 478, 86, { stroke: '#334155', 'stroke-width': 4 }),
      line(82, 160, 478, 160, { stroke: '#334155', 'stroke-width': 4 }),
      line(215, 198, 340, 60, { stroke: '#7c3aed', 'stroke-width': 4 }),
      svgEl('path', {
        d: 'M 304 86 A 34 34 0 0 1 284 111',
        fill: 'none',
        stroke: '#f97316',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }),
      svgEl('path', {
        d: 'M 237 160 A 34 34 0 0 1 258 135',
        fill: 'none',
        stroke: '#06b6d4',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }),
      text(333, 79, `${angle}`, { fill: '#ea580c', 'font-size': 18, 'font-weight': 900 }),
      text(215, 154, `${target}`, { fill: '#0891b2', 'font-size': 18, 'font-weight': 900 }),
      text(124, 76, 'parallel', { fill: '#64748b', 'font-size': 12, 'font-weight': 800 }),
      text(124, 151, 'parallel', { fill: '#64748b', 'font-size': 12, 'font-weight': 800 }),
    ];
    return makeSvg('0 0 560 240', children);
  }

  function circleDiameter(spec) {
    const diameter = spec.diameter || '?';
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Circle diameter', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      circle(280, 135, 72, { fill: '#eff6ff', stroke: '#2563eb', 'stroke-width': 4 }),
      line(208, 135, 352, 135, { stroke: '#ef4444', 'stroke-width': 4 }),
      circle(208, 135, 4, { fill: '#ef4444', stroke: 'none' }),
      circle(352, 135, 4, { fill: '#ef4444', stroke: 'none' }),
      text(280, 122, `diameter = ${diameter}`, { fill: '#b91c1c', 'font-size': 16, 'font-weight': 900 }),
      text(280, 220, spec.note || 'Circumference uses the diameter: C = pi x d', {
        fill: '#475569',
        'font-size': 13,
        'font-weight': 700,
      }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function triangularPrismDimensions(spec) {
    const children = [
      rect(18, 18, 524, 246, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Triangular prism dimensions', {
        fill: '#4338ca',
        'font-size': 16,
        'font-weight': 800,
      }),
      polygon('152,166 222,86 222,206', { fill: '#e0f2fe', stroke: '#0891b2', 'stroke-width': 3 }),
      polygon('312,136 382,56 382,176', { fill: '#dbeafe', stroke: '#2563eb', 'stroke-width': 3 }),
      polygon('152,166 312,136 382,56 222,86', { fill: '#ede9fe', stroke: '#7c3aed', 'stroke-width': 3 }),
      polygon('222,206 382,176 382,56 222,86', { fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 3 }),
      polygon('152,166 312,136 382,176 222,206', { fill: '#dcfce7', stroke: '#16a34a', 'stroke-width': 3 }),
      line(222, 86, 222, 206, { stroke: '#0f766e', 'stroke-width': 3 }),
      line(152, 166, 222, 206, { stroke: '#0f766e', 'stroke-width': 3 }),
      line(152, 166, 222, 86, { stroke: '#0f766e', 'stroke-width': 3 }),
      text(182, 196, spec.sideA || '6 cm', { fill: '#0f766e', 'font-size': 13 }),
      text(236, 149, spec.sideB || '8 cm', { fill: '#0f766e', 'font-size': 13, 'text-anchor': 'start' }),
      text(173, 118, spec.sideC || '10 cm', { fill: '#0f766e', 'font-size': 13 }),
      text(298, 228, spec.length || '15 cm', { fill: '#7c2d12', 'font-size': 14, 'font-weight': 900 }),
      line(232, 226, 366, 198, { stroke: '#7c2d12', 'stroke-width': 2.5 }),
    ];
    return makeSvg('0 0 560 285', children);
  }

  function coordinatePlane(spec) {
    const xMin = Number(spec.xMin ?? -5);
    const xMax = Number(spec.xMax ?? 5);
    const yMin = Number(spec.yMin ?? -5);
    const yMax = Number(spec.yMax ?? 5);
    const left = 72, top = 34, width = 416, height = 206;
    const sx = x => left + ((Number(x) - xMin) / (xMax - xMin)) * width;
    const sy = y => top + height - ((Number(y) - yMin) / (yMax - yMin)) * height;
    const pts = Array.isArray(spec.points) ? spec.points : [];
    const pointByLabel = new Map(pts.map(p => [p.label, p]));
    const children = [
      rect(18, 18, 524, 246, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 43, spec.heading || 'Coordinate diagram', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      rect(left, top, width, height, { fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 2, rx: 4 }),
    ];

    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
      children.push(line(sx(x), top, sx(x), top + height, {
        stroke: x === 0 ? '#64748b' : '#e2e8f0',
        'stroke-width': x === 0 ? 2.5 : 1,
      }));
      if (x !== 0) children.push(text(sx(x), top + height + 17, x, { fill: '#94a3b8', 'font-size': 10, 'font-weight': 700 }));
    }
    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
      children.push(line(left, sy(y), left + width, sy(y), {
        stroke: y === 0 ? '#64748b' : '#e2e8f0',
        'stroke-width': y === 0 ? 2.5 : 1,
      }));
      if (y !== 0) children.push(text(left - 16, sy(y) + 4, y, { fill: '#94a3b8', 'font-size': 10, 'font-weight': 700 }));
    }

    (spec.polygons || []).forEach(poly => {
      const points = (poly.points || []).map(p => {
        const point = typeof p === 'string' ? pointByLabel.get(p) : p;
        return point ? `${sx(point.x)},${sy(point.y)}` : '';
      }).filter(Boolean).join(' ');
      if (points) children.push(polygon(points, {
        fill: poly.fill || 'rgba(124, 58, 237, .12)',
        stroke: poly.stroke || '#7c3aed',
        'stroke-width': 3,
      }));
    });

    (spec.segments || []).forEach(seg => {
      const a = typeof seg[0] === 'string' ? pointByLabel.get(seg[0]) : seg[0];
      const b = typeof seg[1] === 'string' ? pointByLabel.get(seg[1]) : seg[1];
      if (a && b) children.push(line(sx(a.x), sy(a.y), sx(b.x), sy(b.y), {
        stroke: seg.stroke || '#7c3aed',
        'stroke-width': 3,
      }));
    });

    pts.forEach(p => {
      children.push(circle(sx(p.x), sy(p.y), 5, { fill: p.fill || '#ef4444', stroke: '#ffffff', 'stroke-width': 2 }));
      children.push(text(sx(p.x) + 15, sy(p.y) - 10, p.label || '', {
        fill: '#1e293b',
        'font-size': 13,
        'font-weight': 900,
        'text-anchor': 'start',
      }));
    });
    return makeSvg('0 0 560 285', children);
  }

  function rightTriangle(spec) {
    const rawAngle = spec.angle || '';
    const isRightAngle = /^\s*90\s*(deg|degrees|\u00b0)?\s*$/i.test(rawAngle);
    const acuteAngle = isRightAngle ? '' : rawAngle;
    const rightAngleLabel = spec.rightAngleLabel || (isRightAngle ? '90\u00b0' : '');
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Right-angled triangle', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      polygon('150,190 430,190 430,72', { fill: '#eff6ff', stroke: '#2563eb', 'stroke-width': 4 }),
      line(410, 190, 410, 170, { stroke: '#0f766e', 'stroke-width': 3 }),
      line(410, 170, 430, 170, { stroke: '#0f766e', 'stroke-width': 3 }),
      text(290, 213, spec.base || '', { fill: '#334155', 'font-size': 14, 'font-weight': 900 }),
      text(453, 134, spec.height || '', { fill: '#334155', 'font-size': 14, 'font-weight': 900, 'text-anchor': 'start' }),
      text(284, 125, spec.hypotenuse || '', { fill: '#334155', 'font-size': 14, 'font-weight': 900 }),
    ];
    if (rightAngleLabel) {
      children.push(text(397, 160, rightAngleLabel, {
        fill: '#0f766e',
        'font-size': 13,
        'font-weight': 900,
        'text-anchor': 'end',
      }));
    }
    if (acuteAngle) {
      children.push(svgEl('path', {
        d: 'M 205 190 A 55 55 0 0 1 225 150',
        fill: 'none',
        stroke: '#f97316',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }));
      children.push(text(226, 176, acuteAngle.replace(/\s*(deg|degrees)\b/i, '\u00b0'), {
        fill: '#ea580c',
        'font-size': 14,
        'font-weight': 900,
      }));
    }
    return makeSvg('0 0 560 260', children);
  }

  function bearingDiagram(spec) {
    const bearing = spec.bearing || '?';
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Bearing diagram', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      circle(190, 152, 5, { fill: '#ef4444', stroke: 'none' }),
      text(190, 173, spec.from || 'A', { fill: '#b91c1c', 'font-size': 14, 'font-weight': 900 }),
      line(190, 152, 190, 72, { stroke: '#64748b', 'stroke-width': 3 }),
      polygon('190,62 182,78 198,78', { fill: '#64748b', stroke: 'none' }),
      text(190, 58, 'N', { fill: '#475569', 'font-size': 14, 'font-weight': 900 }),
      line(190, 152, 346, 108, { stroke: '#7c3aed', 'stroke-width': 4 }),
      circle(346, 108, 5, { fill: '#7c3aed', stroke: 'none' }),
      text(356, 101, spec.to || 'B', { fill: '#4c1d95', 'font-size': 14, 'font-weight': 900, 'text-anchor': 'start' }),
      svgEl('path', {
        d: 'M 190 106 A 48 48 0 0 1 237 139',
        fill: 'none',
        stroke: '#f97316',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }),
      text(246, 112, bearing, { fill: '#ea580c', 'font-size': 16, 'font-weight': 900 }),
      text(370, 208, spec.note || 'Bearings are measured clockwise from north.', {
        fill: '#475569',
        'font-size': 13,
        'font-weight': 700,
      }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function trapeziumArea(spec) {
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Trapezium', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      polygon('155,184 405,184 350,82 205,82', { fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 4 }),
      line(205, 82, 350, 82, { stroke: '#92400e', 'stroke-width': 4 }),
      line(155, 184, 405, 184, { stroke: '#92400e', 'stroke-width': 4 }),
      line(350, 82, 350, 184, { stroke: '#0891b2', 'stroke-width': 3, 'stroke-dasharray': '7 6' }),
      text(278, 73, spec.topBase || '', { fill: '#92400e', 'font-size': 14, 'font-weight': 900 }),
      text(280, 211, spec.bottomBase || '', { fill: '#92400e', 'font-size': 14, 'font-weight': 900 }),
      text(371, 137, spec.height || '', { fill: '#0e7490', 'font-size': 14, 'font-weight': 900, 'text-anchor': 'start' }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function cylinderDimensions(spec) {
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Cylinder dimensions', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      svgEl('ellipse', { cx: 280, cy: 92, rx: 84, ry: 22, fill: '#dbeafe', stroke: '#2563eb', 'stroke-width': 4 }),
      rect(196, 92, 168, 106, { fill: '#bfdbfe', stroke: '#2563eb', 'stroke-width': 4, rx: 3 }),
      svgEl('ellipse', { cx: 280, cy: 198, rx: 84, ry: 22, fill: '#eff6ff', stroke: '#2563eb', 'stroke-width': 4 }),
      line(196, 92, 364, 92, { stroke: '#ef4444', 'stroke-width': 3 }),
      text(280, 82, spec.diameter || '', { fill: '#b91c1c', 'font-size': 14, 'font-weight': 900 }),
      line(386, 92, 386, 198, { stroke: '#0f766e', 'stroke-width': 3 }),
      text(402, 151, spec.height || '', { fill: '#0f766e', 'font-size': 14, 'font-weight': 900, 'text-anchor': 'start' }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function sectorCircle(spec) {
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Circle sector', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      svgEl('path', {
        d: 'M 280 162 L 280 72 A 90 90 0 0 1 358 207 Z',
        fill: '#fef3c7',
        stroke: '#d97706',
        'stroke-width': 4,
        'stroke-linejoin': 'round',
      }),
      circle(280, 162, 5, { fill: '#92400e', stroke: 'none' }),
      line(280, 162, 280, 72, { stroke: '#92400e', 'stroke-width': 3 }),
      line(280, 162, 358, 207, { stroke: '#92400e', 'stroke-width': 3 }),
      text(270, 112, spec.radius || '', { fill: '#92400e', 'font-size': 14, 'font-weight': 900, 'text-anchor': 'end' }),
      text(322, 151, spec.angle || '', { fill: '#ea580c', 'font-size': 16, 'font-weight': 900 }),
      text(350, 218, spec.note || '', { fill: '#475569', 'font-size': 13, 'font-weight': 700 }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function rayMirror(spec) {
    const incidence = spec.incidence || '?';
    const reflection = spec.reflection || '?';
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Reflection diagram', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      line(120, 178, 440, 178, { stroke: '#334155', 'stroke-width': 5 }),
      text(448, 183, 'mirror', { fill: '#475569', 'font-size': 13, 'font-weight': 800, 'text-anchor': 'start' }),
      line(280, 178, 280, 62, { stroke: '#94a3b8', 'stroke-width': 3, 'stroke-dasharray': '6 6' }),
      text(280, 58, 'normal', { fill: '#64748b', 'font-size': 12, 'font-weight': 800 }),
      line(160, 78, 280, 178, { stroke: '#7c3aed', 'stroke-width': 4 }),
      polygon('280,178 255,166 267,151', { fill: '#7c3aed', stroke: 'none' }),
      line(280, 178, 400, 78, { stroke: '#0891b2', 'stroke-width': 4 }),
      polygon('400,78 374,89 387,104', { fill: '#0891b2', stroke: 'none' }),
      text(172, 70, 'incident ray', { fill: '#4c1d95', 'font-size': 12, 'font-weight': 800 }),
      text(403, 70, 'reflected ray', { fill: '#0e7490', 'font-size': 12, 'font-weight': 800 }),
      svgEl('path', { d: 'M 280 136 A 42 42 0 0 0 248 151', fill: 'none', stroke: '#f97316', 'stroke-width': 3 }),
      svgEl('path', { d: 'M 280 136 A 42 42 0 0 1 312 151', fill: 'none', stroke: '#f97316', 'stroke-width': 3 }),
      text(244, 132, incidence, { fill: '#ea580c', 'font-size': 13, 'font-weight': 900 }),
      text(316, 132, reflection, { fill: '#ea580c', 'font-size': 13, 'font-weight': 900 }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function vectorComponents(spec) {
    const h = spec.horizontal || 'east';
    const v = spec.vertical || 'north';
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Perpendicular vectors', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      circle(178, 174, 5, { fill: '#334155', stroke: 'none' }),
      line(178, 174, 376, 174, { stroke: '#2563eb', 'stroke-width': 5 }),
      polygon('386,174 366,163 366,185', { fill: '#2563eb', stroke: 'none' }),
      line(178, 174, 178, 82, { stroke: '#16a34a', 'stroke-width': 5 }),
      polygon('178,72 167,92 189,92', { fill: '#16a34a', stroke: 'none' }),
      line(178, 174, 376, 82, { stroke: '#f97316', 'stroke-width': 4, 'stroke-dasharray': '8 6' }),
      polygon('384,78 360,78 370,99', { fill: '#f97316', stroke: 'none' }),
      text(282, 198, h, { fill: '#1d4ed8', 'font-size': 14, 'font-weight': 900 }),
      text(145, 126, v, { fill: '#15803d', 'font-size': 14, 'font-weight': 900, 'text-anchor': 'end' }),
      text(330, 108, spec.resultant || 'resultant', { fill: '#ea580c', 'font-size': 14, 'font-weight': 900 }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function chromatographyPaper(spec) {
    const children = [
      rect(18, 18, 524, 242, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Paper chromatography', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      rect(218, 66, 124, 162, { fill: '#fff7ed', stroke: '#fb923c', 'stroke-width': 3, rx: 3 }),
      line(218, 190, 342, 190, { stroke: '#64748b', 'stroke-width': 3 }),
      text(360, 195, 'start line', { fill: '#475569', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'start' }),
      line(218, 100, 342, 100, { stroke: '#0ea5e9', 'stroke-width': 3, 'stroke-dasharray': '6 5' }),
      text(360, 105, 'solvent front', { fill: '#0284c7', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'start' }),
      circle(280, 152, 8, { fill: '#7c3aed', stroke: '#4c1d95', 'stroke-width': 2 }),
      line(280, 190, 280, 152, { stroke: '#7c3aed', 'stroke-width': 2, 'stroke-dasharray': '5 5' }),
      line(292, 190, 292, 100, { stroke: '#0ea5e9', 'stroke-width': 2, 'stroke-dasharray': '5 5' }),
      text(245, 174, spec.spotDistance || 'spot', { fill: '#6d28d9', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'end' }),
      text(307, 147, spec.solventDistance || 'solvent', { fill: '#0369a1', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'start' }),
    ];
    return makeSvg('0 0 560 280', children);
  }

  function cellDiagram(spec) {
    const type = spec.cellType || 'plant';
    const isPlant = type === 'plant';
    const isBacteria = type === 'bacterial';
    const children = [
      rect(18, 18, 524, 242, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Cell diagram', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
    ];

    if (isBacteria) {
      children.push(svgEl('ellipse', { cx: 280, cy: 146, rx: 138, ry: 66, fill: '#dcfce7', stroke: '#16a34a', 'stroke-width': 5 }));
      children.push(svgEl('ellipse', { cx: 280, cy: 146, rx: 116, ry: 47, fill: '#f0fdf4', stroke: '#86efac', 'stroke-width': 3 }));
      children.push(svgEl('path', { d: 'M 235 143 C 260 118, 298 174, 328 135', fill: 'none', stroke: '#7c3aed', 'stroke-width': 5, 'stroke-linecap': 'round' }));
      for (let i = 0; i < 18; i++) children.push(circle(180 + (i % 9) * 22, 124 + Math.floor(i / 9) * 40, 3, { fill: '#0f766e', stroke: 'none' }));
      children.push(text(280, 233, 'no nucleus - genetic material is free in the cytoplasm', { fill: '#475569', 'font-size': 13, 'font-weight': 700 }));
    } else {
      const outline = isPlant
        ? rect(142, 72, 276, 138, { fill: '#dcfce7', stroke: '#16a34a', 'stroke-width': 5, rx: 12 })
        : svgEl('ellipse', { cx: 280, cy: 146, rx: 142, ry: 72, fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 5 });
      children.push(outline);
      if (isPlant) children.push(rect(160, 88, 240, 106, { fill: '#f0fdf4', stroke: '#86efac', 'stroke-width': 3, rx: 10 }));
      children.push(circle(254, 142, 22, { fill: '#ddd6fe', stroke: '#7c3aed', 'stroke-width': 3 }));
      children.push(text(254, 147, 'N', { fill: '#4c1d95', 'font-size': 15, 'font-weight': 900 }));
      children.push(svgEl('ellipse', { cx: 330, cy: 158, rx: 23, ry: 11, fill: '#fecaca', stroke: '#ef4444', 'stroke-width': 2.5 }));
      children.push(svgEl('ellipse', { cx: 204, cy: 160, rx: 23, ry: 11, fill: '#fecaca', stroke: '#ef4444', 'stroke-width': 2.5 }));
      if (isPlant) {
        children.push(rect(286, 110, 78, 44, { fill: '#bbf7d0', stroke: '#22c55e', 'stroke-width': 2.5, rx: 9 }));
        children.push(svgEl('ellipse', { cx: 190, cy: 114, rx: 14, ry: 9, fill: '#22c55e', stroke: '#15803d', 'stroke-width': 2 }));
        children.push(svgEl('ellipse', { cx: 372, cy: 176, rx: 14, ry: 9, fill: '#22c55e', stroke: '#15803d', 'stroke-width': 2 }));
        children.push(text(368, 104, 'large vacuole', { fill: '#15803d', 'font-size': 12, 'font-weight': 800 }));
        children.push(text(394, 176, 'chloroplast', { fill: '#15803d', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'start' }));
      }
      children.push(text(254, 86, 'nucleus', { fill: '#4c1d95', 'font-size': 12, 'font-weight': 800 }));
      children.push(text(192, 202, 'mitochondria', { fill: '#b91c1c', 'font-size': 12, 'font-weight': 800 }));
      children.push(text(121, 151, isPlant ? 'cell wall' : 'cell membrane', { fill: '#475569', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'end' }));
    }
    return makeSvg('0 0 560 280', children);
  }

  function virusDiagram(spec) {
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Virus structure', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      circle(280, 138, 58, { fill: '#ede9fe', stroke: '#7c3aed', 'stroke-width': 5 }),
      svgEl('path', { d: 'M 246 137 C 260 113, 297 165, 316 131', fill: 'none', stroke: '#ef4444', 'stroke-width': 5, 'stroke-linecap': 'round' }),
      text(280, 222, 'genetic material inside a protein coat', { fill: '#475569', 'font-size': 13, 'font-weight': 700 }),
    ];
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      const x1 = 280 + Math.cos(a) * 60;
      const y1 = 138 + Math.sin(a) * 60;
      const x2 = 280 + Math.cos(a) * 78;
      const y2 = 138 + Math.sin(a) * 78;
      children.push(line(x1, y1, x2, y2, { stroke: '#7c3aed', 'stroke-width': 3 }));
      children.push(circle(x2, y2, 5, { fill: '#c4b5fd', stroke: '#7c3aed', 'stroke-width': 2 }));
    }
    return makeSvg('0 0 560 260', children);
  }

  function particleModel(spec) {
    const mode = spec.mode || 'gas';
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Particle model', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      rect(126, 72, 308, 128, { fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 3, rx: 10 }),
    ];
    const positions = mode === 'solid'
      ? Array.from({ length: 24 }, (_, i) => [160 + (i % 6) * 46, 98 + Math.floor(i / 6) * 28])
      : mode === 'liquid'
        ? [[166,162],[198,142],[230,168],[260,146],[293,166],[323,143],[354,166],[388,149],[182,180],[220,130],[316,184],[360,122]]
        : [[164,96],[398,96],[254,114],[340,128],[196,178],[300,180],[416,170],[226,142]];
    positions.forEach(([x, y], i) => {
      children.push(circle(x, y, 10, { fill: i % 2 ? '#bfdbfe' : '#ddd6fe', stroke: i % 2 ? '#2563eb' : '#7c3aed', 'stroke-width': 2 }));
    });
    children.push(text(280, 225, spec.note || `${mode} particles`, { fill: '#475569', 'font-size': 13, 'font-weight': 700 }));
    return makeSvg('0 0 560 260', children);
  }

  function gasSyringeApparatus(spec) {
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Collecting gas', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      rect(134, 148, 118, 58, { fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 3, rx: 14 }),
      rect(164, 112, 56, 42, { fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 3, rx: 7 }),
      line(220, 132, 318, 132, { stroke: '#64748b', 'stroke-width': 5 }),
      rect(318, 104, 152, 56, { fill: '#eff6ff', stroke: '#2563eb', 'stroke-width': 3, rx: 8 }),
      line(352, 104, 352, 160, { stroke: '#93c5fd', 'stroke-width': 2 }),
      line(386, 104, 386, 160, { stroke: '#93c5fd', 'stroke-width': 2 }),
      line(420, 104, 420, 160, { stroke: '#93c5fd', 'stroke-width': 2 }),
      text(190, 222, 'reaction mixture', { fill: '#92400e', 'font-size': 13, 'font-weight': 800 }),
      text(394, 91, 'gas syringe', { fill: '#1d4ed8', 'font-size': 13, 'font-weight': 800 }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function titrationSetup(spec) {
    const children = [
      rect(18, 18, 524, 242, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Titration setup', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      line(230, 62, 230, 204, { stroke: '#334155', 'stroke-width': 5 }),
      line(196, 204, 264, 204, { stroke: '#334155', 'stroke-width': 5 }),
      rect(292, 60, 28, 126, { fill: '#eff6ff', stroke: '#2563eb', 'stroke-width': 3, rx: 5 }),
      line(306, 186, 306, 211, { stroke: '#2563eb', 'stroke-width': 3 }),
      circle(306, 221, 4, { fill: '#2563eb', stroke: 'none' }),
      polygon('250,222 362,222 336,164 276,164', { fill: '#fef3c7', stroke: '#d97706', 'stroke-width': 3 }),
      text(336, 91, 'burette', { fill: '#1d4ed8', 'font-size': 13, 'font-weight': 800, 'text-anchor': 'start' }),
      text(306, 246, 'conical flask + indicator', { fill: '#92400e', 'font-size': 13, 'font-weight': 800 }),
    ];
    return makeSvg('0 0 560 280', children);
  }

  function circuitDiagram(spec) {
    const type = spec.circuitType || 'series';
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Circuit diagram', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      line(126, 96, 126, 192, { stroke: '#334155', 'stroke-width': 4 }),
      line(126, 96, 434, 96, { stroke: '#334155', 'stroke-width': 4 }),
      line(434, 96, 434, 192, { stroke: '#334155', 'stroke-width': 4 }),
      line(126, 192, 434, 192, { stroke: '#334155', 'stroke-width': 4 }),
      line(126, 132, 106, 132, { stroke: '#334155', 'stroke-width': 4 }),
      line(106, 116, 106, 148, { stroke: '#334155', 'stroke-width': 4 }),
      line(94, 124, 94, 140, { stroke: '#334155', 'stroke-width': 4 }),
      circle(256, 96, 24, { fill: '#ffffff', stroke: '#7c3aed', 'stroke-width': 3 }),
      line(241, 81, 271, 111, { stroke: '#7c3aed', 'stroke-width': 3 }),
      line(271, 81, 241, 111, { stroke: '#7c3aed', 'stroke-width': 3 }),
      text(256, 70, 'lamp', { fill: '#4c1d95', 'font-size': 12, 'font-weight': 800 }),
    ];
    if (type === 'parallel') {
      line(186, 132, 374, 132, { stroke: '#334155', 'stroke-width': 4 });
      circle(256, 132, 22, { fill: '#ffffff', stroke: '#0891b2', 'stroke-width': 3 });
      line(243, 119, 269, 145, { stroke: '#0891b2', 'stroke-width': 3 });
      line(269, 119, 243, 145, { stroke: '#0891b2', 'stroke-width': 3 });
      text(334, 132, 'branch', { fill: '#0e7490', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'start' });
    }
    if (spec.showAmmeter) {
      circle(370, 192, 22, { fill: '#ffffff', stroke: '#ef4444', 'stroke-width': 3 });
      text(370, 198, 'A', { fill: '#b91c1c', 'font-size': 17, 'font-weight': 900 });
    }
    return makeSvg('0 0 560 260', children);
  }

  function loadedVoltmeterDivider(spec) {
    const supply = spec.supply || '12 V';
    const seriesA = spec.seriesA || '10 k\u03a9';
    const seriesB = spec.seriesB || '10 k\u03a9';
    const meter = spec.meter || '10 k\u03a9';
    const children = [
      rect(18, 18, 524, 262, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Loaded potential divider', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      line(100, 92, 100, 220, { stroke: '#334155', 'stroke-width': 4 }),
      line(100, 92, 164, 92, { stroke: '#334155', 'stroke-width': 4 }),
      line(234, 92, 304, 92, { stroke: '#334155', 'stroke-width': 4 }),
      line(374, 92, 460, 92, { stroke: '#334155', 'stroke-width': 4 }),
      line(460, 92, 460, 220, { stroke: '#334155', 'stroke-width': 4 }),
      line(100, 220, 460, 220, { stroke: '#334155', 'stroke-width': 4 }),
      line(142, 126, 142, 156, { stroke: '#334155', 'stroke-width': 4 }),
      line(160, 114, 160, 168, { stroke: '#334155', 'stroke-width': 4 }),
      text(132, 185, supply, { fill: '#334155', 'font-size': 13, 'font-weight': 900 }),
      rect(164, 72, 70, 40, { fill: '#eef2ff', stroke: '#4f46e5', 'stroke-width': 3, rx: 7 }),
      text(199, 96, 'R1', { fill: '#312e81', 'font-size': 13, 'font-weight': 900 }),
      text(199, 123, seriesA, { fill: '#475569', 'font-size': 12, 'font-weight': 900 }),
      rect(304, 72, 70, 40, { fill: '#ecfeff', stroke: '#0891b2', 'stroke-width': 3, rx: 7 }),
      text(339, 96, 'R2', { fill: '#0e7490', 'font-size': 13, 'font-weight': 900 }),
      text(339, 123, seriesB, { fill: '#475569', 'font-size': 12, 'font-weight': 900 }),
      circle(339, 170, 25, { fill: '#ffffff', stroke: '#ef4444', 'stroke-width': 3 }),
      text(339, 176, 'V', { fill: '#b91c1c', 'font-size': 18, 'font-weight': 900 }),
      text(339, 209, meter, { fill: '#b91c1c', 'font-size': 12, 'font-weight': 900 }),
      line(304, 92, 304, 170, { stroke: '#0891b2', 'stroke-width': 3 }),
      line(374, 92, 374, 170, { stroke: '#0891b2', 'stroke-width': 3 }),
      line(304, 170, 314, 170, { stroke: '#0891b2', 'stroke-width': 3 }),
      line(364, 170, 374, 170, { stroke: '#0891b2', 'stroke-width': 3 }),
      text(339, 246, spec.note || 'The voltmeter is in parallel with R2, so it loads the divider.', {
        fill: '#475569',
        'font-size': 12,
        'font-weight': 800,
      }),
    ];
    return makeSvg('0 0 560 300', children);
  }

  function waveDiagram(spec) {
    const amplitude = spec.amplitude || 'amplitude';
    const wavelength = spec.wavelength || 'wavelength';
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Wave diagram', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      line(90, 145, 470, 145, { stroke: '#94a3b8', 'stroke-width': 2 }),
      svgEl('path', {
        d: 'M 90 145 C 125 75, 160 75, 195 145 S 265 215, 300 145 S 370 75, 405 145 S 455 200, 470 170',
        fill: 'none',
        stroke: '#2563eb',
        'stroke-width': 5,
        'stroke-linecap': 'round',
      }),
      line(125, 145, 125, 82, { stroke: '#ef4444', 'stroke-width': 3, 'stroke-dasharray': '5 5' }),
      text(118, 109, amplitude, { fill: '#b91c1c', 'font-size': 12, 'font-weight': 900, 'text-anchor': 'end' }),
      line(125, 220, 405, 220, { stroke: '#0f766e', 'stroke-width': 3 }),
      polygon('125,220 140,213 140,227', { fill: '#0f766e', stroke: 'none' }),
      polygon('405,220 390,213 390,227', { fill: '#0f766e', stroke: 'none' }),
      text(265, 238, wavelength, { fill: '#0f766e', 'font-size': 12, 'font-weight': 900 }),
    ];
    return makeSvg('0 0 560 260', children);
  }

  function barMagnetField(spec) {
    const children = [
      rect(18, 18, 524, 222, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Magnetic field', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      rect(180, 118, 200, 44, { fill: '#ffffff', stroke: '#334155', 'stroke-width': 3, rx: 4 }),
      rect(180, 118, 100, 44, { fill: '#fecaca', stroke: 'none', rx: 4 }),
      rect(280, 118, 100, 44, { fill: '#bfdbfe', stroke: 'none', rx: 4 }),
      text(230, 145, 'N', { fill: '#991b1b', 'font-size': 18, 'font-weight': 900 }),
      text(330, 145, 'S', { fill: '#1d4ed8', 'font-size': 18, 'font-weight': 900 }),
    ];
    ['M 180 118 C 100 78, 100 202, 180 162', 'M 380 118 C 460 78, 460 202, 380 162', 'M 190 104 C 240 62, 320 62, 370 104', 'M 190 176 C 240 218, 320 218, 370 176'].forEach(d => {
      children.push(svgEl('path', { d, fill: 'none', stroke: '#7c3aed', 'stroke-width': 3, 'stroke-linecap': 'round' }));
    });
    return makeSvg('0 0 560 260', children);
  }

  function lineGraph(spec) {
    const xLabel = spec.xLabel || 'x';
    const yLabel = spec.yLabel || 'y';
    const trend = spec.trend || 'increase';
    const children = [
      rect(18, 18, 524, 242, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Graph sketch', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      line(105, 210, 455, 210, { stroke: '#334155', 'stroke-width': 4 }),
      line(105, 210, 105, 72, { stroke: '#334155', 'stroke-width': 4 }),
      polygon('455,210 437,201 437,219', { fill: '#334155', stroke: 'none' }),
      polygon('105,72 96,90 114,90', { fill: '#334155', stroke: 'none' }),
      text(280, 246, xLabel, { fill: '#475569', 'font-size': 13, 'font-weight': 800 }),
      text(66, 136, yLabel, { fill: '#475569', 'font-size': 13, 'font-weight': 800, transform: 'rotate(-90 66 136)' }),
    ];
    const path = trend === 'decrease'
      ? 'M 126 92 C 190 112, 260 145, 430 195'
      : trend === 'curve-level'
        ? 'M 126 194 C 182 130, 248 94, 330 88 S 408 88, 430 88'
        : trend === 'decay'
          ? 'M 126 88 C 170 115, 206 144, 258 166 S 358 195, 430 202'
          : 'M 126 190 C 190 164, 256 132, 430 88';
    children.push(svgEl('path', {
      d: path,
      fill: 'none',
      stroke: '#7c3aed',
      'stroke-width': 5,
      'stroke-linecap': 'round',
    }));
    return makeSvg('0 0 560 280', children);
  }

  function atomStructure(spec) {
    const electrons = Array.isArray(spec.shells) ? spec.shells : [2, 8, 1];
    const children = [
      rect(18, 18, 524, 242, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Atom structure', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      circle(280, 150, 28, { fill: '#fecaca', stroke: '#ef4444', 'stroke-width': 4 }),
      text(280, 156, spec.nucleus || 'nucleus', { fill: '#991b1b', 'font-size': 12, 'font-weight': 900 }),
    ];
    electrons.forEach((count, shellIndex) => {
      const r = 54 + shellIndex * 34;
      children.push(circle(280, 150, r, { fill: 'none', stroke: '#94a3b8', 'stroke-width': 2 }));
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count - Math.PI / 2;
        children.push(circle(280 + Math.cos(a) * r, 150 + Math.sin(a) * r, 5, { fill: '#2563eb', stroke: '#ffffff', 'stroke-width': 1.5 }));
      }
    });
    children.push(text(280, 246, spec.note || 'electrons are arranged in shells', { fill: '#475569', 'font-size': 13, 'font-weight': 700 }));
    return makeSvg('0 0 560 280', children);
  }

  function collisionBalls(spec) {
    const before = spec.before || {};
    const after = spec.after || {};
    const x = spec.x || {};
    const y = spec.y || {};
    const children = [
      rect(18, 18, 524, 262, { fill: '#fbfdff', stroke: '#dbe4ff', rx: 18 }),
      text(280, 44, spec.heading || 'Head-on collision model', { fill: '#4338ca', 'font-size': 16, 'font-weight': 800 }),
      rect(54, 68, 452, 72, { fill: '#ffffff', stroke: '#dbeafe', 'stroke-width': 2, rx: 14 }),
      rect(54, 170, 452, 72, { fill: '#ffffff', stroke: '#e0e7ff', 'stroke-width': 2, rx: 14 }),
      text(92, 91, 'before', { fill: '#475569', 'font-size': 12, 'font-weight': 900, 'text-anchor': 'start' }),
      text(92, 193, 'after', { fill: '#475569', 'font-size': 12, 'font-weight': 900, 'text-anchor': 'start' }),
      line(112, 124, 462, 124, { stroke: '#cbd5e1', 'stroke-width': 3, 'stroke-linecap': 'round' }),
      line(112, 226, 462, 226, { stroke: '#cbd5e1', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    ];

    function ball(cx, cy, label, mass, fill, stroke) {
      children.push(circle(cx, cy, 24, { fill, stroke, 'stroke-width': 3 }));
      children.push(text(cx, cy + 5, label, { fill: '#0f172a', 'font-size': 16, 'font-weight': 900 }));
      if (mass) children.push(text(cx, cy + 39, mass, { fill: '#475569', 'font-size': 11, 'font-weight': 800 }));
    }

    function arrow(x1, y1, x2, y2, color, label, labelOffset) {
      const right = x2 >= x1;
      children.push(line(x1, y1, x2, y2, { stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round' }));
      children.push(polygon(right
        ? `${x2},${y2} ${x2 - 14},${y2 - 8} ${x2 - 14},${y2 + 8}`
        : `${x2},${y2} ${x2 + 14},${y2 - 8} ${x2 + 14},${y2 + 8}`, {
        fill: color,
        stroke: 'none',
      }));
      if (label) {
        children.push(text((x1 + x2) / 2, y1 + (labelOffset || -13), label, {
          fill: color,
          'font-size': 12,
          'font-weight': 900,
        }));
      }
    }

    ball(178, 124, x.label || 'X', x.mass || before.xMass || '', '#dbeafe', '#2563eb');
    ball(358, 124, y.label || 'Y', y.mass || before.yMass || '', '#fef3c7', '#d97706');
    arrow(210, 104, 302, 104, '#2563eb', before.xVelocity || '', -12);
    children.push(text(358, 91, before.yVelocity || 'stationary', {
      fill: '#92400e',
      'font-size': 12,
      'font-weight': 900,
    }));
    children.push(svgEl('path', {
      d: 'M 254 128 C 270 110, 288 110, 304 128',
      fill: 'none',
      stroke: '#94a3b8',
      'stroke-width': 2,
      'stroke-dasharray': '5 5',
      'stroke-linecap': 'round',
    }));

    ball(202, 226, x.label || 'X', x.mass || after.xMass || '', '#dbeafe', '#2563eb');
    ball(358, 226, y.label || 'Y', y.mass || after.yMass || '', '#fef3c7', '#d97706');
    arrow(174, 204, 118, 204, '#ef4444', after.xVelocity || '', -12);
    arrow(390, 204, 466, 204, '#0f766e', after.yVelocity || 'v?', -12);
    children.push(text(280, 264, spec.note || 'Take right as positive; use momentum before = momentum after.', {
      fill: '#475569',
      'font-size': 12,
      'font-weight': 800,
    }));
    return makeSvg('0 0 560 300', children);
  }

  const RENDERERS = {
    'solid-fact-cards': solidFactCards,
    'cone-on-cylinder': coneOnCylinder,
    'square-table-row': squareTableRow,
    'stick-square-pattern': stickSquarePattern,
    'function-machine': functionMachine,
    'parallel-lines': parallelLines,
    'circle-diameter': circleDiameter,
    'triangular-prism-dimensions': triangularPrismDimensions,
    'coordinate-plane': coordinatePlane,
    'right-triangle': rightTriangle,
    'bearing-diagram': bearingDiagram,
    'trapezium-area': trapeziumArea,
    'cylinder-dimensions': cylinderDimensions,
    'sector-circle': sectorCircle,
    'ray-mirror': rayMirror,
    'vector-components': vectorComponents,
    'chromatography-paper': chromatographyPaper,
    'cell-diagram': cellDiagram,
    'virus-diagram': virusDiagram,
    'particle-model': particleModel,
    'gas-syringe-apparatus': gasSyringeApparatus,
    'titration-setup': titrationSetup,
    'circuit-diagram': circuitDiagram,
    'loaded-voltmeter-divider': loadedVoltmeterDivider,
    'wave-diagram': waveDiagram,
    'bar-magnet-field': barMagnetField,
    'line-graph': lineGraph,
    'atom-structure': atomStructure,
    'collision-balls': collisionBalls,
  };

  const SCIENCE_RENDERERS = new Set([
    'ray-mirror',
    'vector-components',
    'chromatography-paper',
    'cell-diagram',
    'virus-diagram',
    'particle-model',
    'gas-syringe-apparatus',
    'titration-setup',
    'circuit-diagram',
    'loaded-voltmeter-divider',
    'wave-diagram',
    'bar-magnet-field',
    'line-graph',
    'atom-structure',
    'collision-balls',
  ]);

  function itemText(item) {
    if (!item) return '';
    return [
      item.stem,
      item.stemHtml,
      item.chapter,
      item.topic,
      item.topicGroup,
    ].filter(Boolean).join(' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\\\(|\\\)|\$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function inferVisual(item) {
    const raw = itemText(item);
    if (!raw) return null;
    const lower = raw.toLowerCase();

    const shorterSides = lower.match(/two shorter sides(?: of length)?\s+(\d+(?:\.\d+)?)\s*(cm|m|mm|km)?\s+and\s+(\d+(?:\.\d+)?)\s*(cm|m|mm|km)?/);
    if (lower.includes('right-angled triangle') && lower.includes('hypotenuse') && shorterSides) {
      const a = Number(shorterSides[1]);
      const b = Number(shorterSides[3]);
      const unit = shorterSides[2] || shorterSides[4] || '';
      const base = Math.max(a, b);
      const height = Math.min(a, b);
      const suffix = unit ? ` ${unit}` : '';
      return {
        kind: 'programmatic',
        renderer: 'right-triangle',
        title: 'Right triangle model',
        heading: 'Identify the hypotenuse',
        base: `${base}${suffix}`,
        height: `${height}${suffix}`,
        hypotenuse: 'h',
        rightAngleLabel: '90\u00b0',
        caption: 'The hypotenuse is the side opposite the right angle.',
        alt: `Right-angled triangle with shorter sides ${height}${suffix} and ${base}${suffix}; hypotenuse labelled h.`,
      };
    }

    const solidStats = lower.match(/(\d+)\s+faces?,\s*(\d+)\s+edges?\s+and\s+(\d+)\s+vertices?/);
    if (solidStats && lower.includes('triangles') && lower.includes('rectangles')) {
      return {
        kind: 'programmatic',
        renderer: 'solid-fact-cards',
        title: 'Shape clues',
        heading: 'Match the solid to its clues',
        stats: {
          faces: Number(solidStats[1]),
          edges: Number(solidStats[2]),
          vertices: Number(solidStats[3]),
        },
        faces: [
          { shape: 'triangle', label: 'triangle' },
          { shape: 'triangle', label: 'triangle' },
          { shape: 'rectangle', label: 'rectangle' },
          { shape: 'rectangle', label: 'rectangle' },
          { shape: 'rectangle', label: 'rectangle' },
        ],
        note: 'Use the face shapes together with the counts.',
        alt: 'Solid shape clue cards showing faces, edges, vertices, two triangular faces, and three rectangular faces.',
      };
    }

    if (lower.includes('chromatography')) {
      return {
        kind: 'programmatic',
        renderer: 'chromatography-paper',
        title: 'Chromatography setup',
        alt: 'Paper chromatography diagram with solvent level, start line, and separated spots.',
      };
    }

    if (lower.includes('burette') || lower.includes('titration')) {
      return {
        kind: 'programmatic',
        renderer: 'titration-setup',
        title: 'Titration apparatus',
        alt: 'Titration setup with burette, conical flask, and indicator.',
      };
    }

    const twoSeriesResistors = raw.match(/Two\s+(\d+(?:\.\d+)?)\s*k(?:\u03a9|ohm|ohms)\s+resistors are connected in series to a\s+(\d+(?:\.\d+)?)\s*V\s+supply/i);
    const loadedVoltmeter = raw.match(/voltmeter of resistance\s+(\d+(?:\.\d+)?)\s*k(?:\u03a9|ohm|ohms)\s+is connected across one of the resistors/i);
    if (twoSeriesResistors && loadedVoltmeter) {
      return {
        kind: 'programmatic',
        renderer: 'loaded-voltmeter-divider',
        title: 'Loaded voltmeter divider',
        heading: 'Voltmeter loading one resistor',
        supply: `${twoSeriesResistors[2]} V`,
        seriesA: `${twoSeriesResistors[1]} k\u03a9`,
        seriesB: `${twoSeriesResistors[1]} k\u03a9`,
        meter: `${loadedVoltmeter[1]} k\u03a9`,
        note: 'The voltmeter is in parallel with one 10 k\u03a9 resistor, changing the divider ratio.',
        alt: 'Circuit with two series resistors and a non-ideal voltmeter connected in parallel across one resistor.',
      };
    }

    if (lower.includes('circuit') || lower.includes('ammeter') || lower.includes('voltmeter')) {
      return {
        kind: 'programmatic',
        renderer: 'circuit-diagram',
        title: 'Circuit model',
        alt: 'Simple circuit diagram with cell, lamp, and measuring instrument.',
      };
    }

    if (lower.includes('wave') && (lower.includes('wavelength') || lower.includes('amplitude') || lower.includes('frequency'))) {
      return {
        kind: 'programmatic',
        renderer: 'wave-diagram',
        title: 'Wave diagram',
        alt: 'Wave diagram with amplitude and wavelength marked.',
      };
    }

    if (lower.includes('bar magnet') || lower.includes('magnetic field')) {
      return {
        kind: 'programmatic',
        renderer: 'bar-magnet-field',
        title: 'Magnetic field',
        alt: 'Bar magnet with field lines from north to south.',
      };
    }

    if (lower.includes('atom') && (lower.includes('electron') || lower.includes('shell') || lower.includes('nucleus'))) {
      return {
        kind: 'programmatic',
        renderer: 'atom-structure',
        title: 'Atom structure',
        alt: 'Atom structure diagram showing nucleus and electron shells.',
      };
    }

    const collisionMatch = raw.match(/Ball\s+([A-Z])\s+has a mass of\s+(\d+(?:\.\d+)?)\s*kg\s+and moves(?: to the \w+)? at\s+(\d+(?:\.\d+)?)\s*m\s*s(?:\u207b\u00b9|\^-?1|-1)?/i);
    const stationaryMatch = raw.match(/stationary ball\s+([A-Z])\s+of mass\s+(\d+(?:\.\d+)?)\s*kg/i);
    const backMatch = raw.match(/After the collision,\s*([A-Z])\s+moves back[^.]*?at\s+(\d+(?:\.\d+)?)\s*m\s*s(?:\u207b\u00b9|\^-?1|-1)?/i);
    if ((lower.includes('collision') || lower.includes('collides')) && collisionMatch && stationaryMatch) {
      const xLabel = collisionMatch[1].toUpperCase();
      const yLabel = stationaryMatch[1].toUpperCase();
      const backLabel = backMatch ? backMatch[1].toUpperCase() : xLabel;
      return {
        kind: 'programmatic',
        renderer: 'collision-balls',
        title: 'Collision model',
        heading: 'Before and after the collision',
        x: { label: xLabel, mass: `${collisionMatch[2]} kg` },
        y: { label: yLabel, mass: `${stationaryMatch[2]} kg` },
        before: {
          xVelocity: `${collisionMatch[3]} m s^-1`,
          yVelocity: 'stationary',
        },
        after: {
          xVelocity: `${backLabel}: ${backMatch ? backMatch[2] : '?'} m s^-1 back`,
          yVelocity: `${yLabel}: v?`,
        },
        note: 'Momentum is conserved; compare kinetic energy to classify the collision.',
        alt: `Before and after model of a head-on collision between ball ${xLabel} and stationary ball ${yLabel}.`,
      };
    }

    return null;
  }

  function visualFor(item) {
    if (!item) return null;
    return item.visual || inferVisual(item);
  }

  function render(spec) {
    if (!spec || spec.kind !== 'programmatic') return null;
    const renderer = RENDERERS[spec.renderer];
    if (!renderer) return null;
    ensureStyles();

    const figure = document.createElement('figure');
    figure.className = 'q-visual';
    figure.dataset.family = SCIENCE_RENDERERS.has(spec.renderer) ? 'science' : 'math';
    figure.dataset.renderer = spec.renderer;
    if (spec.alt) figure.setAttribute('aria-label', spec.alt);

    if (spec.title) {
      const title = document.createElement('figcaption');
      title.className = 'q-visual-title';
      title.textContent = spec.title;
      figure.appendChild(title);
    }

    figure.appendChild(renderer(spec));

    if (spec.caption) {
      const caption = document.createElement('div');
      caption.className = 'q-visual-caption';
      caption.textContent = spec.caption;
      figure.appendChild(caption);
    }
    return figure;
  }

  window.StudentHubQuestionVisuals = { render, inferVisual, visualFor };
})();
