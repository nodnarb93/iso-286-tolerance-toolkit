/**
 * Main application controller.
 */

import { PART_TYPES, createPart, createPlugValveExample, getInterfaces } from './models.js';
import { computeLimits, interfaceClearance, COMMON_FITS, formatMm, formatUm } from './iso286.js';
import { renderAssembly, getMaxOd, getLength } from './viz.js';
import { WiggleController } from './wiggle.js';
import { exportAssembly, importAssembly, decodeAssemblyFromUrl } from './io.js';

const state = {
  assembly: { name: 'Untitled assembly', parts: [] },
  selectedPartId: null,
  showToleranceBands: false,
  planView: false,
  vizScale: 1,
};

const wiggle = new WiggleController();

const els = {
  partsList: document.getElementById('parts-list'),
  partsEmpty: document.getElementById('parts-empty'),
  vizSvg: document.getElementById('viz-svg'),
  detailForm: document.getElementById('detail-form'),
  detailEmpty: document.getElementById('detail-empty'),
  detailTitle: document.getElementById('detail-title'),
  toggleBands: document.getElementById('toggle-tolerance-bands'),
  togglePlan: document.getElementById('toggle-plan-view'),
  btnWiggle: document.getElementById('btn-wiggle'),
  wiggleMode: document.getElementById('wiggle-mode'),
  wiggleStatus: document.getElementById('wiggle-status'),
  measureTooltip: document.getElementById('measure-tooltip'),
  partModal: document.getElementById('part-modal'),
  partModalForm: document.getElementById('part-modal-form'),
  newPartType: document.getElementById('new-part-type'),
  newPartName: document.getElementById('new-part-name'),
  newPartConstraint: document.getElementById('new-part-constraint'),
  newPartDims: document.getElementById('new-part-dims'),
  newPartFits: document.getElementById('new-part-fits'),
  typeDescription: document.getElementById('type-description'),
};

function init() {
  populatePartTypeSelect();
  bindEvents();

  const fromUrl = decodeAssemblyFromUrl();
  if (fromUrl) {
    state.assembly = fromUrl;
  } else {
    loadExample();
  }

  refresh();
}

function bindEvents() {
  document.getElementById('btn-add-part').addEventListener('click', openPartModal);
  document.getElementById('btn-load-example').addEventListener('click', loadExample);
  document.getElementById('btn-export').addEventListener('click', () => exportAssembly(state.assembly));
  document.getElementById('btn-import').addEventListener('change', handleImport);

  document.getElementById('modal-close').addEventListener('click', closePartModal);
  document.getElementById('modal-cancel').addEventListener('click', closePartModal);
  els.partModalForm.addEventListener('submit', handleAddPart);

  els.newPartType.addEventListener('change', updateModalFields);
  els.toggleBands.addEventListener('change', () => {
    state.showToleranceBands = els.toggleBands.checked;
    refreshViz();
  });
  els.togglePlan.addEventListener('change', () => {
    state.planView = els.togglePlan.checked;
    refreshViz();
  });

  els.btnWiggle.addEventListener('click', toggleWiggle);
  els.wiggleMode.addEventListener('change', () => {
    wiggle.setMode(els.wiggleMode.value);
    if (wiggle.active) {
      wiggle.start(state.assembly, state.vizScale);
      refreshViz();
    }
  });

  els.newPartType.dispatchEvent(new Event('change'));

  wiggle.attach(els.vizSvg, state.assembly, () => state.vizScale, (offset) => {
    wiggle.offsetX = offset;
    els.wiggleStatus.textContent = wiggle.getStatusText(state.assembly, state.vizScale);
    refreshViz();
  });

  document.addEventListener('click', () => hideTooltip());
}

function populatePartTypeSelect() {
  els.newPartType.innerHTML = Object.entries(PART_TYPES)
    .map(([key, def]) => `<option value="${key}">${def.label}</option>`)
    .join('');
}

function updateModalFields() {
  const type = els.newPartType.value;
  const def = PART_TYPES[type];
  els.typeDescription.textContent = def.description;
  els.newPartConstraint.value = def.defaultConstraint;

  els.newPartDims.innerHTML = def.dims.map(d => `
    <label>${d.label}
      <input type="number" name="dim_${d.key}" value="${d.default}" step="${d.step}" min="0.1" required>
    </label>
  `).join('');

  els.newPartFits.innerHTML = def.fits.map(f => `
    <label>${f.label}
      <input type="text" name="fit_${f.key}" value="${f.default}" pattern="[A-Za-z][0-9]{1,2}" required list="fit-codes">
    </label>
  `).join('');

  if (!document.getElementById('fit-codes')) {
    const dl = document.createElement('datalist');
    dl.id = 'fit-codes';
    dl.innerHTML = COMMON_FITS.map(f => `<option value="${f}">`).join('');
    document.body.appendChild(dl);
  }
}

function openPartModal() {
  els.newPartName.value = '';
  els.newPartType.dispatchEvent(new Event('change'));
  els.partModal.showModal();
}

function closePartModal() {
  els.partModal.close();
}

function handleAddPart(e) {
  e.preventDefault();
  const type = els.newPartType.value;
  const def = PART_TYPES[type];
  const fd = new FormData(els.partModalForm);

  const dims = {};
  def.dims.forEach(d => { dims[d.key] = parseFloat(fd.get(`dim_${d.key}`)); });

  const fits = {};
  def.fits.forEach(f => { fits[f.key] = fd.get(`fit_${f.key}`); });

  const part = createPart(type, {
    name: els.newPartName.value || def.label,
    constraint: els.newPartConstraint.value,
    dims,
    fits,
    zOffset: suggestZOffset(),
  });

  state.assembly.parts.push(part);
  state.selectedPartId = part.id;
  closePartModal();
  refresh();
}

function suggestZOffset() {
  const parts = state.assembly.parts;
  if (!parts.length) return 0;
  const last = parts[parts.length - 1];
  return (last.zOffset || 0) + getLength(last) * 0.1;
}

function loadExample() {
  state.assembly = createPlugValveExample();
  state.selectedPartId = state.assembly.parts[0]?.id ?? null;
  wiggle.stop();
  els.btnWiggle.classList.remove('active');
  els.vizSvg.classList.remove('wiggle-active');
  refresh();
}

async function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    state.assembly = await importAssembly(file);
    state.selectedPartId = state.assembly.parts[0]?.id ?? null;
    refresh();
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  }
  e.target.value = '';
}

function refresh() {
  renderPartsList();
  renderDetailPanel();
  refreshViz();
}

function renderPartsList() {
  const parts = state.assembly.parts;
  els.partsEmpty.classList.toggle('hidden', parts.length > 0);
  els.partsList.innerHTML = '';

  parts.forEach((part, idx) => {
    const def = PART_TYPES[part.type];
    const li = document.createElement('li');
    li.className = `part-item${part.id === state.selectedPartId ? ' selected' : ''}`;
    li.innerHTML = `
      <span class="part-item-name">${escapeHtml(part.name)}</span>
      <span class="part-item-meta">${def.label} · ${part.constraint}</span>
      <span class="part-item-actions">
        <button type="button" class="btn-icon move-up" title="Move up" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="btn-icon move-down" title="Move down" ${idx === parts.length - 1 ? 'disabled' : ''}>▼</button>
        <button type="button" class="btn-icon delete-part" title="Remove">✕</button>
      </span>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon')) return;
      state.selectedPartId = part.id;
      refresh();
    });

    li.querySelector('.move-up')?.addEventListener('click', () => movePart(idx, -1));
    li.querySelector('.move-down')?.addEventListener('click', () => movePart(idx, 1));
    li.querySelector('.delete-part')?.addEventListener('click', () => deletePart(part.id));

    els.partsList.appendChild(li);
  });
}

function movePart(idx, dir) {
  const parts = state.assembly.parts;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= parts.length) return;
  [parts[idx], parts[newIdx]] = [parts[newIdx], parts[idx]];
  refresh();
}

function deletePart(id) {
  state.assembly.parts = state.assembly.parts.filter(p => p.id !== id);
  if (state.selectedPartId === id) state.selectedPartId = state.assembly.parts[0]?.id ?? null;
  refresh();
}

function renderDetailPanel() {
  const part = state.assembly.parts.find(p => p.id === state.selectedPartId);
  if (!part) {
    els.detailForm.classList.add('hidden');
    els.detailEmpty.classList.remove('hidden');
    els.detailTitle.textContent = 'Part details';
    return;
  }

  els.detailEmpty.classList.add('hidden');
  els.detailForm.classList.remove('hidden');
  els.detailTitle.textContent = part.name;

  const def = PART_TYPES[part.type];

  let html = `
    <label>Part name
      <input type="text" id="detail-name" value="${escapeAttr(part.name)}">
    </label>
    <label>Constraint
      <select id="detail-constraint">
        <option value="fixed" ${part.constraint === 'fixed' ? 'selected' : ''}>Fixed / pinned</option>
        <option value="floating" ${part.constraint === 'floating' ? 'selected' : ''}>Floating</option>
      </select>
    </label>
    <label>Axial offset (mm)
      <input type="number" id="detail-zoffset" value="${part.zOffset || 0}" step="0.5">
    </label>
  `;

  html += '<fieldset class="form-section"><legend>Dimensions (mm)</legend><div class="form-grid">';
  def.dims.forEach(d => {
    html += `<label>${d.label}
      <input type="number" data-dim="${d.key}" value="${part.dims[d.key]}" step="${d.step}" min="0.1">
    </label>`;
  });
  html += '</div></fieldset>';

  html += '<fieldset class="form-section"><legend>ISO 286 fits</legend><div class="form-grid">';
  def.fits.forEach(f => {
    const limits = computeLimits(getNominalForFit(part, f.target), part.fits[f.key]);
    html += `<div class="fit-row">
      <label>${f.label}
        <input type="text" data-fit="${f.key}" value="${part.fits[f.key]}" list="fit-codes">
      </label>
      <span class="fit-preview" data-fit-preview="${f.key}">
        ${limits.error ? limits.error : `${formatMm(limits.min)} – ${formatMm(limits.max)}`}
      </span>
    </div>`;
  });
  html += '</div></fieldset>';

  html += renderInterfaceSummaries(part);

  els.detailForm.innerHTML = html;
  bindDetailEvents(part);
}

function getNominalForFit(part, target) {
  if (target === 'bore') return part.dims.bore;
  if (target === 'od') return part.dims.od;
  if (target === 'id') return part.dims.id;
  return 0;
}

function renderInterfaceSummaries(part) {
  const interfaces = getInterfaces(state.assembly);
  const related = interfaces.filter(i => i.holePart === part.id || i.shaftPart === part.id);
  if (!related.length) return '';

  return `<fieldset class="form-section"><legend>Mating interfaces</legend>
    ${related.map(iface => {
      const holeLimits = computeLimits(iface.holeNominal, iface.holeFit);
      const shaftLimits = computeLimits(iface.shaftNominal, iface.shaftFit);
      const c = interfaceClearance(holeLimits, shaftLimits, 'nominal');
      const cls = c.type === 'interference' ? 'interference' : 'clearance';
      const role = iface.holePart === part.id ? 'Hole' : 'Shaft';
      return `<div class="interface-summary ${cls}">
        <strong>${role}</strong> with ${iface.holePart === part.id ? iface.shaftPart : iface.holePart}<br>
        Clearance: ${formatMm(c.minClearance)} – ${formatMm(c.maxClearance)}<br>
        Radial: ${formatUm(c.radialMinClearance)} – ${formatUm(c.radialMaxClearance)}
      </div>`;
    }).join('')}
  </fieldset>`;
}

function bindDetailEvents(part) {
  const def = PART_TYPES[part.type];

  document.getElementById('detail-name')?.addEventListener('input', (e) => {
    part.name = e.target.value;
    renderPartsList();
    els.detailTitle.textContent = part.name;
    refreshViz();
  });

  document.getElementById('detail-constraint')?.addEventListener('change', (e) => {
    part.constraint = e.target.value;
    renderPartsList();
    refreshViz();
  });

  document.getElementById('detail-zoffset')?.addEventListener('input', (e) => {
    part.zOffset = parseFloat(e.target.value) || 0;
    refreshViz();
  });

  els.detailForm.querySelectorAll('[data-dim]').forEach(input => {
    input.addEventListener('input', () => {
      part.dims[input.dataset.dim] = parseFloat(input.value);
      updateFitPreviews(part, def);
      refreshViz();
    });
  });

  els.detailForm.querySelectorAll('[data-fit]').forEach(input => {
    input.addEventListener('input', () => {
      part.fits[input.dataset.fit] = input.value;
      updateFitPreviews(part, def);
      refreshViz();
    });
  });
}

function updateFitPreviews(part, def) {
  def.fits.forEach(f => {
    const el = els.detailForm.querySelector(`[data-fit-preview="${f.key}"]`);
    if (!el) return;
    const limits = computeLimits(getNominalForFit(part, f.target), part.fits[f.key]);
    el.textContent = limits.error ? limits.error : `${formatMm(limits.min)} – ${formatMm(limits.max)}`;
  });
}

function computeVizScale() {
  const parts = state.assembly.parts;
  if (!parts.length) return 1;
  const maxOd = Math.max(...parts.map(p => getMaxOd(p)));
  const totalLength = Math.max(...parts.map(p => (p.zOffset || 0) + getLength(p)));
  const W = 800, H = 500;
  return Math.min((W - 120) / (maxOd * 2.2), (H - 80) / totalLength);
}

function refreshViz() {
  state.vizScale = computeVizScale();

  const scenario = wiggle.active ? wiggle.mode : 'nominal';

  renderAssembly(els.vizSvg, state.assembly, {
    selectedPartId: state.selectedPartId,
    showToleranceBands: state.showToleranceBands,
    planView: state.planView,
    wiggleOffsetX: wiggle.active ? wiggle.offsetX : 0,
    toleranceScenario: scenario === 'worst' ? 'worst' : scenario === 'best' ? 'best' : 'nominal',
    onPartClick: (id) => {
      state.selectedPartId = id;
      refresh();
    },
    onMeasureClick: ({ x, y, label, detail }) => {
      showTooltip(x, y, label, detail);
    },
  });

  if (wiggle.active) {
    els.wiggleStatus.textContent = wiggle.getStatusText(state.assembly, state.vizScale);
  }
}

function toggleWiggle() {
  if (wiggle.active) {
    wiggle.stop();
    els.btnWiggle.classList.remove('active');
    els.btnWiggle.textContent = 'Wiggle test';
    els.vizSvg.classList.remove('wiggle-active');
    els.wiggleStatus.textContent = '';
  } else {
    wiggle.setMode(els.wiggleMode.value);
    const max = wiggle.start(state.assembly, state.vizScale);
    els.btnWiggle.classList.add('active');
    els.btnWiggle.textContent = 'End wiggle test';
    els.vizSvg.classList.add('wiggle-active');
    if (max <= 0) {
      els.wiggleStatus.textContent = 'No lateral clearance — interference or zero gap';
    } else {
      els.wiggleStatus.textContent = wiggle.getStatusText(state.assembly, state.vizScale);
    }
  }
  refreshViz();
}

function showTooltip(clientX, clientY, label, detail) {
  const rect = els.vizSvg.getBoundingClientRect();
  els.measureTooltip.innerHTML = `<strong>${escapeHtml(label)}</strong><br>${escapeHtml(detail).replace(/\n/g, '<br>')}`;
  els.measureTooltip.classList.remove('hidden');
  els.measureTooltip.style.left = `${clientX - rect.left + 12}px`;
  els.measureTooltip.style.top = `${clientY - rect.top + 12}px`;
}

function hideTooltip() {
  els.measureTooltip.classList.add('hidden');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

init();
