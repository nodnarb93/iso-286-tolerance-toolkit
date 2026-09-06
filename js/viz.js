/**
 * SVG visualization: cross-section and plan views with tolerance bands.
 */

import { computeLimits, formatMm } from './iso286.js';
import { PART_TYPES } from './models.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderAssembly(svgEl, assembly, options = {}) {
  const {
    selectedPartId = null,
    showToleranceBands = false,
    planView = false,
    wiggleOffsetX = 0,
    toleranceScenario = 'nominal',
    onPartClick = null,
    onMeasureClick = null,
  } = options;

  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const vb = svgEl.viewBox.baseVal;
  const W = vb.width || 800;
  const H = vb.height || 500;
  const cx = W / 2;
  const cy = H / 2;

  const defs = el('defs');
  defs.appendChild(gradientDef('partGrad', '#2a3544', '#1a2332'));
  svgEl.appendChild(defs);

  if (planView) {
    renderPlanView(svgEl, assembly, { cx, cy, W, H, selectedPartId, showToleranceBands, toleranceScenario, wiggleOffsetX, onPartClick });
  } else {
    renderSectionView(svgEl, assembly, { cx, cy, W, H, selectedPartId, showToleranceBands, toleranceScenario, wiggleOffsetX, onPartClick, onMeasureClick });
  }
}

function renderSectionView(svgEl, assembly, ctx) {
  const { cx, cy, W, H, selectedPartId, showToleranceBands, toleranceScenario, wiggleOffsetX, onPartClick, onMeasureClick } = ctx;
  const parts = assembly.parts;
  if (!parts.length) {
    svgEl.appendChild(textEl(cx, cy, 'Add parts to see cross-section', { anchor: 'middle', fill: '#8b9cb3' }));
    return;
  }

  const maxOd = Math.max(...parts.map(p => getMaxOd(p)));
  const totalLength = Math.max(...parts.map(p => (p.zOffset || 0) + getLength(p)));
  const scale = Math.min((W - 120) / (maxOd * 2.2), (H - 80) / totalLength);
  const baseY = cy - (totalLength * scale) / 2;

  // Centerline
  svgEl.appendChild(lineEl(cx - W / 2 + 40, cy, cx + W / 2 - 40, cy, 'centerline'));

  const floatingOffset = wiggleOffsetX;

  parts.forEach(part => {
    const def = PART_TYPES[part.type];
    const isFixed = part.constraint === 'fixed';
    const offsetX = isFixed ? 0 : floatingOffset;
    const x = cx + offsetX;
    const y = baseY + (part.zOffset || 0) * scale;
    const len = getLength(part) * scale;
    const selected = part.id === selectedPartId;

    const g = el('g');
    g.dataset.partId = part.id;

    if (part.type === 'housing_bore') {
      drawHousingBore(g, part, x, y, len, scale, def.color, selected, showToleranceBands, toleranceScenario);
    } else if (def.hasFlange) {
      drawFlangedPart(g, part, def, x, y, len, scale, selected, showToleranceBands, toleranceScenario);
    } else if (part.type === 'shaft_solid') {
      drawSolidShaft(g, part, x, y, len, scale, def.color, selected, showToleranceBands, toleranceScenario);
    } else {
      drawGenericPart(g, part, def, x, y, len, scale, selected, showToleranceBands, toleranceScenario);
    }

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      onPartClick?.(part.id);
    });

    if (selected) {
      g.querySelectorAll('.part-shape').forEach(s => s.classList.add('selected'));
    }

    svgEl.appendChild(g);
  });

  // Wiggle contact markers
  if (floatingOffset !== 0) {
    drawWiggleAnnotations(svgEl, assembly, { cx, baseY, scale, wiggleOffsetX, onMeasureClick });
  }

  // Scale bar
  drawScaleBar(svgEl, scale, W - 100, H - 30);
}

function drawHousingBore(g, part, x, y, len, scale, color, selected, showBands, scenario) {
  const r = (part.dims.bore / 2) * scale;
  const wall = 12;

  // Outer wall hint (dashed — no OD specified)
  const outer = rectEl(x - r - wall, y, r * 2 + wall * 2, len, {
    fill: 'rgba(74,111,165,0.15)',
    stroke: color,
    strokeDasharray: '6 4',
    class: 'part-shape',
  });
  g.appendChild(outer);

  // Bore opening (cutaway)
  const bore = rectEl(x - r, y, r * 2, len, {
    fill: '#0a0e14',
    stroke: color,
    class: 'part-shape',
  });
  g.appendChild(bore);

  // Left half fill to show material
  const mat = rectEl(x, y, r + wall, len, {
    fill: color,
    fillOpacity: 0.35,
    stroke: 'none',
    class: 'part-shape',
  });
  g.appendChild(mat);

  if (showBands) {
    const limits = computeLimits(part.dims.bore, part.fits.boreFit);
    drawBoreToleranceBands(g, x, y, len, scale, limits, scenario);
  }

  g.appendChild(textEl(x + r + wall + 8, y + len / 2, part.name, { fill: '#8b9cb3', size: 11 }));
}

function drawSolidShaft(g, part, x, y, len, scale, color, selected, showBands, scenario) {
  const r = (part.dims.od / 2) * scale;
  const shaft = rectEl(x - r, y, r * 2, len, {
    fill: color,
    fillOpacity: 0.55,
    stroke: color,
    class: 'part-shape',
  });
  g.appendChild(shaft);

  if (showBands) {
    const limits = computeLimits(part.dims.od, part.fits.odFit);
    drawShaftToleranceBands(g, x, y, len, scale, limits, scenario);
  }
}

function drawGenericPart(g, part, def, x, y, len, scale, selected, showBands, scenario) {
  const rOd = (part.dims.od / 2) * scale;
  const rId = part.dims.id ? (part.dims.id / 2) * scale : 0;

  const outer = rectEl(x - rOd, y, rOd * 2, len, {
    fill: def.color,
    fillOpacity: 0.55,
    stroke: def.color,
    class: 'part-shape',
  });
  g.appendChild(outer);

  if (rId > 0) {
    const inner = rectEl(x - rId, y, rId * 2, len, {
      fill: '#0a0e14',
      stroke: def.color,
      strokeDasharray: '4 2',
      class: 'part-shape',
    });
    g.appendChild(inner);
  }

  if (showBands) {
    if (part.fits.odFit) {
      drawShaftToleranceBands(g, x, y, len, scale, computeLimits(part.dims.od, part.fits.odFit), scenario);
    }
    if (part.fits.idFit && part.dims.id) {
      drawBoreToleranceBands(g, x, y, len, scale, computeLimits(part.dims.id, part.fits.idFit), scenario);
    }
  }
}

function drawFlangedPart(g, part, def, x, y, len, scale, selected, showBands, scenario) {
  const rOd = (part.dims.od / 2) * scale;
  const rId = (part.dims.id / 2) * scale;
  const rFlange = (part.dims.flangeOd / 2) * scale;
  const flangeLen = part.dims.flangeThickness * scale;

  // Flange at top
  const flange = rectEl(x - rFlange, y, rFlange * 2, flangeLen, {
    fill: def.color,
    fillOpacity: 0.7,
    stroke: def.color,
    class: 'part-shape',
  });
  g.appendChild(flange);

  const body = rectEl(x - rOd, y + flangeLen, rOd * 2, len - flangeLen, {
    fill: def.color,
    fillOpacity: 0.55,
    stroke: def.color,
    class: 'part-shape',
  });
  g.appendChild(body);

  const inner = rectEl(x - rId, y, rId * 2, len, {
    fill: '#0a0e14',
    stroke: def.color,
    strokeDasharray: '4 2',
    class: 'part-shape',
  });
  g.appendChild(inner);

  if (showBands) {
    drawShaftToleranceBands(g, x, y + flangeLen, len - flangeLen, scale, computeLimits(part.dims.od, part.fits.odFit), scenario);
    drawBoreToleranceBands(g, x, y, len, scale, computeLimits(part.dims.id, part.fits.idFit), scenario);
  }
}

function drawBoreToleranceBands(g, x, y, len, scale, limits, scenario) {
  const rNom = (limits.nominal / 2) * scale;
  const rMin = scenario === 'worst' ? (limits.max / 2) * scale : scenario === 'best' ? (limits.min / 2) * scale : rNom;
  const rMax = scenario === 'worst' ? (limits.max / 2) * scale : scenario === 'best' ? (limits.min / 2) * scale : (limits.max / 2) * scale;

  if (scenario === 'nominal') {
    const band = rectEl(x - (limits.max / 2) * scale, y - 2, limits.max * scale / 2 * 2, len + 4, {
      class: 'tolerance-band hole',
    });
    // Show band as annulus edges — left and right dashed lines
    g.appendChild(lineEl(x - (limits.min / 2) * scale, y, x - (limits.min / 2) * scale, y + len, 'tolerance-band hole'));
    g.appendChild(lineEl(x + (limits.min / 2) * scale, y, x + (limits.min / 2) * scale, y + len, 'tolerance-band hole'));
    g.appendChild(lineEl(x - (limits.max / 2) * scale, y, x - (limits.max / 2) * scale, y + len, 'tolerance-band hole'));
    g.appendChild(lineEl(x + (limits.max / 2) * scale, y, x + (limits.max / 2) * scale, y + len, 'tolerance-band hole'));
  } else {
    g.appendChild(lineEl(x - rMin, y, x - rMin, y + len, 'tolerance-band hole'));
    g.appendChild(lineEl(x + rMin, y, x + rMin, y + len, 'tolerance-band hole'));
  }
}

function drawShaftToleranceBands(g, x, y, len, scale, limits, scenario) {
  const radii = scenario === 'worst'
    ? [(limits.min / 2) * scale, (limits.max / 2) * scale]
    : scenario === 'best'
      ? [(limits.min / 2) * scale, (limits.max / 2) * scale]
      : [(limits.min / 2) * scale, (limits.max / 2) * scale];

  radii.forEach(r => {
    g.appendChild(lineEl(x - r, y - 2, x - r, y + len + 2, 'tolerance-band shaft'));
    g.appendChild(lineEl(x + r, y - 2, x + r, y + len + 2, 'tolerance-band shaft'));
  });
}

function renderPlanView(svgEl, assembly, ctx) {
  const { cx, cy, selectedPartId, showToleranceBands, wiggleOffsetX, onPartClick } = ctx;
  const parts = assembly.parts;
  if (!parts.length) return;

  const maxR = Math.max(...parts.map(p => getMaxOd(p) / 2));
  const scale = Math.min(180 / maxR, 180 / maxR);

  svgEl.appendChild(circleEl(cx, cy, maxR * scale + 30, { class: 'centerline', fill: 'none' }));

  [...parts].reverse().forEach(part => {
    const def = PART_TYPES[part.type];
    const offsetX = part.constraint === 'fixed' ? 0 : wiggleOffsetX;
    const x = cx + offsetX;
    const y = cy;
    const g = el('g');
    g.dataset.partId = part.id;

    if (part.type === 'housing_bore') {
      g.appendChild(circleEl(x, y, (part.dims.bore / 2) * scale, {
        fill: 'none', stroke: def.color, strokeWidth: 2, class: 'part-shape',
      }));
    } else {
      if (def.hasFlange && part.dims.flangeOd) {
        g.appendChild(circleEl(x, y, (part.dims.flangeOd / 2) * scale, {
          fill: def.color, fillOpacity: 0.25, stroke: def.color, class: 'part-shape',
        }));
      }
      if (part.dims.od) {
        g.appendChild(circleEl(x, y, (part.dims.od / 2) * scale, {
          fill: def.color, fillOpacity: 0.5, stroke: def.color, class: 'part-shape',
        }));
      }
      if (part.dims.id) {
        g.appendChild(circleEl(x, y, (part.dims.id / 2) * scale, {
          fill: '#0a0e14', stroke: def.color, strokeDasharray: '4 2', class: 'part-shape',
        }));
      }
    }

    if (part.id === selectedPartId) {
      g.querySelectorAll('.part-shape').forEach(s => s.classList.add('selected'));
    }

    g.addEventListener('click', (e) => { e.stopPropagation(); onPartClick?.(part.id); });
    svgEl.appendChild(g);
  });
}

function drawWiggleAnnotations(svgEl, assembly, ctx) {
  const { cx, baseY, scale, wiggleOffsetX, onMeasureClick } = ctx;
  const fixed = assembly.parts.find(p => p.constraint === 'fixed');
  const floating = assembly.parts.filter(p => p.constraint === 'floating');
  if (!fixed || !floating.length) return;

  const boreR = (fixed.dims.bore / 2) * scale;
  const innermost = floating[floating.length - 1];
  const shaftLimits = computeLimits(innermost.dims.od, innermost.fits.odFit);
  const holeLimits = computeLimits(fixed.dims.bore, fixed.fits.boreFit);

  const shaftR = (shaftLimits.max / 2) * scale; // worst case largest shaft... actually for lateral wiggle use radial clearance
  const holeR = (holeLimits.min / 2) * scale;

  const contactX = cx + wiggleOffsetX + (wiggleOffsetX > 0 ? shaftR : -shaftR);
  const wallX = cx + (wiggleOffsetX > 0 ? -holeR : holeR);

  const y = baseY + 20;
  const marker = circleEl(contactX, y, 5, { class: 'contact-marker' });
  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    const gap = Math.abs(wallX - contactX) - Math.abs(wiggleOffsetX);
    onMeasureClick?.({
      x: e.clientX,
      y: e.clientY,
      label: 'Contact point',
      detail: `Lateral offset: ${formatMm(Math.abs(wiggleOffsetX) / scale)}\nRadial gap (opposite side): ${formatMm((holeR - shaftR - Math.abs(wiggleOffsetX)) / scale)}`,
    });
  });
  svgEl.appendChild(marker);

  const gapText = textEl(cx, baseY - 10, `Offset: ${formatMm(Math.abs(wiggleOffsetX) / scale)}`, {
    anchor: 'middle', fill: '#f59e0b', size: 11, class: 'gap-label',
  });
  svgEl.appendChild(gapText);
}

function drawScaleBar(svgEl, scale, x, y) {
  const barLen = 10 * scale;
  const g = el('g');
  g.appendChild(lineEl(x, y, x + barLen, y, { stroke: '#8b9cb3', strokeWidth: 2 }));
  g.appendChild(lineEl(x, y - 4, x, y + 4, { stroke: '#8b9cb3' }));
  g.appendChild(lineEl(x + barLen, y - 4, x + barLen, y + 4, { stroke: '#8b9cb3' }));
  g.appendChild(textEl(x + barLen / 2, y + 14, '10 mm', { anchor: 'middle', fill: '#8b9cb3', size: 10 }));
  svgEl.appendChild(g);
}

function getMaxOd(part) {
  const d = PART_TYPES[part.type];
  if (part.type === 'housing_bore') return part.dims.bore + 20;
  if (d.hasFlange) return Math.max(part.dims.flangeOd || 0, part.dims.od || 0);
  return part.dims.od || part.dims.bore || 10;
}

function getLength(part) {
  return part.dims.length || 10;
}

function el(name, attrs = {}) {
  const e = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

function rectEl(x, y, w, h, attrs = {}) {
  const { class: cls, ...rest } = attrs;
  const r = el('rect', { x, y, width: w, height: h, ...rest });
  if (cls) r.setAttribute('class', cls);
  return r;
}

function lineEl(x1, y1, x2, y2, clsOrAttrs) {
  const attrs = typeof clsOrAttrs === 'string' ? { class: clsOrAttrs } : clsOrAttrs;
  return el('line', { x1, y1, x2, y2, ...attrs });
}

function circleEl(cx, cy, r, attrs = {}) {
  return el('circle', { cx, cy, r, ...attrs });
}

function textEl(x, y, content, opts = {}) {
  const t = el('text', {
    x, y,
    'text-anchor': opts.anchor || 'start',
    fill: opts.fill || '#e6edf3',
    'font-size': opts.size || 12,
  });
  if (opts.class) t.setAttribute('class', opts.class);
  t.textContent = content;
  return t;
}

function gradientDef(id, c1, c2) {
  const g = el('linearGradient', { id, x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
  g.appendChild(el('stop', { offset: '0%', 'stop-color': c1 }));
  g.appendChild(el('stop', { offset: '100%', 'stop-color': c2 }));
  return g;
}

export { getMaxOd, getLength };
