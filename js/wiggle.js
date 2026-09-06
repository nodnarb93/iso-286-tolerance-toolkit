/**
 * Wiggle test: lateral offset simulation at tolerance extremes.
 */

import { computeLimits, interfaceClearance, formatMm } from './iso286.js';
import { getInterfaces, PART_TYPES } from './models.js';

export class WiggleController {
  constructor() {
    this.active = false;
    this.offsetX = 0; // pixels
    this.mode = 'worst';
    this.maxOffsetPx = 0;
    this.dragging = false;
    this.startX = 0;
    this.startOffset = 0;
  }

  computeMaxLateralOffset(assembly, scale) {
    const interfaces = getInterfaces(assembly);
    if (!interfaces.length) return 0;

    // Use the tightest radial clearance across all interfaces
    let minRadialClearance = Infinity;

    for (const iface of interfaces) {
      const holeLimits = computeLimits(iface.holeNominal, iface.holeFit);
      const shaftLimits = computeLimits(iface.shaftNominal, iface.shaftFit);
      const scenario = this.mode === 'worst' ? 'worst' : 'best';
      const c = interfaceClearance(holeLimits, shaftLimits, scenario);
      const radial = this.mode === 'worst' ? c.radialMaxClearance : c.radialMinClearance;
      minRadialClearance = Math.min(minRadialClearance, radial);
    }

    if (!Number.isFinite(minRadialClearance) || minRadialClearance <= 0) return 0;
    return minRadialClearance * scale;
  }

  start(assembly, scale) {
    this.active = true;
    this.offsetX = 0;
    this.maxOffsetPx = this.computeMaxLateralOffset(assembly, scale);
    return this.maxOffsetPx;
  }

  stop() {
    this.active = false;
    this.offsetX = 0;
    this.dragging = false;
  }

  setMode(mode) {
    this.mode = mode;
  }

  attach(svgEl, assembly, getScale, onUpdate) {
    const onPointerDown = (e) => {
      if (!this.active) return;
      this.dragging = true;
      this.startX = e.clientX;
      this.startOffset = this.offsetX;
      svgEl.classList.add('wiggle-dragging');
      svgEl.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.startX;
      let next = this.startOffset + dx;
      next = Math.max(-this.maxOffsetPx, Math.min(this.maxOffsetPx, next));
      this.offsetX = next;
      onUpdate?.(this.offsetX);
    };

    const onPointerUp = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      svgEl.classList.remove('wiggle-dragging');
      try { svgEl.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    };

    svgEl.addEventListener('pointerdown', onPointerDown);
    svgEl.addEventListener('pointermove', onPointerMove);
    svgEl.addEventListener('pointerup', onPointerUp);
    svgEl.addEventListener('pointerleave', onPointerUp);

    return () => {
      svgEl.removeEventListener('pointerdown', onPointerDown);
      svgEl.removeEventListener('pointermove', onPointerMove);
      svgEl.removeEventListener('pointerup', onPointerUp);
      svgEl.removeEventListener('pointerleave', onPointerUp);
    };
  }

  getStatusText(assembly, scale) {
    if (!this.active) return '';
    const offsetMm = Math.abs(this.offsetX) / scale;
    const maxMm = this.maxOffsetPx / scale;
    const pct = maxMm > 0 ? ((offsetMm / maxMm) * 100).toFixed(0) : 0;
    return `${this.mode === 'worst' ? 'Worst' : 'Best'} case · offset ${formatMm(offsetMm)} / ${formatMm(maxMm)} (${pct}%)`;
  }
}

export function analyzeContactAtOffset(assembly, offsetMm) {
  const interfaces = getInterfaces(assembly);
  const results = [];

  for (const iface of interfaces) {
    const holeLimits = computeLimits(iface.holeNominal, iface.holeFit);
    const shaftLimits = computeLimits(iface.shaftNominal, iface.shaftFit);
    const c = interfaceClearance(holeLimits, shaftLimits, 'worst');

    const radialMax = c.radialMaxClearance;
    const contactSide = offsetMm >= radialMax ? 'contact' : 'free';
    const oppositeGap = radialMax - Math.abs(offsetMm);

    results.push({
      interface: `${iface.holePart} ↔ ${iface.shaftPart}`,
      radialMaxClearance: radialMax,
      lateralOffset: offsetMm,
      oppositeRadialGap: oppositeGap,
      contactSide,
    });
  }

  return results;
}
