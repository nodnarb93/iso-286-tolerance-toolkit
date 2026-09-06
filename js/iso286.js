/**
 * ISO 286 tolerance lookup (simplified tables for 1–120 mm range).
 * Returns deviations in mm relative to nominal.
 */

/** IT grade tolerance values (µm) by diameter step midpoint — ISO 286-1 Table 1 */
const IT_TABLE = [
  { over: 0, upTo: 3, grades: { 5: 4, 6: 6, 7: 10, 8: 14, 9: 25, 10: 40, 11: 60 } },
  { over: 3, upTo: 6, grades: { 5: 5, 6: 8, 7: 12, 8: 18, 9: 30, 10: 48, 11: 75 } },
  { over: 6, upTo: 10, grades: { 5: 6, 6: 9, 7: 15, 8: 22, 9: 36, 10: 58, 11: 90 } },
  { over: 10, upTo: 18, grades: { 5: 8, 6: 11, 7: 18, 8: 27, 9: 43, 10: 70, 11: 110 } },
  { over: 18, upTo: 30, grades: { 5: 9, 6: 13, 7: 21, 8: 33, 9: 52, 10: 84, 11: 130 } },
  { over: 30, upTo: 50, grades: { 5: 11, 6: 16, 7: 25, 8: 39, 9: 62, 10: 100, 11: 160 } },
  { over: 50, upTo: 80, grades: { 5: 13, 6: 19, 7: 30, 8: 46, 9: 74, 10: 120, 11: 190 } },
  { over: 80, upTo: 120, grades: { 5: 15, 6: 22, 7: 35, 8: 54, 9: 87, 10: 140, 11: 220 } },
];

/** Fundamental deviation upper (ES/es) and lower (EI/ei) in µm — selected common fits */
const FUNDAMENTAL = {
  // Holes (uppercase)
  H: (d) => ({ es: itGrade(d, 0)?.value ?? 0, ei: 0, kind: 'hole' }),
  G: (d) => {
    const delta = d <= 24 ? 8 + Math.round(d * 0.3) : 17;
    return { es: delta, ei: delta - itPlaceholder(d), kind: 'hole' };
  },
  // Shafts (lowercase) — es/ei from ISO 286-2 approximations
  h: () => ({ es: 0, ei: null, kind: 'shaft' }),
  g: (d) => {
    const upper = d <= 24 ? -(2 + Math.round(d * 0.15)) : -7;
    return { es: upper, ei: null, kind: 'shaft' };
  },
  f: (d) => {
    const upper = d <= 24 ? -(4 + Math.round(d * 0.25)) : -13;
    return { es: upper, ei: null, kind: 'shaft' };
  },
  e: (d) => {
    const upper = d <= 24 ? -(7 + Math.round(d * 0.35)) : -24;
    return { es: upper, ei: null, kind: 'shaft' };
  },
  k: (d) => {
    const lower = d <= 24 ? 1 + Math.round(d * 0.05) : 2;
    return { es: null, ei: lower, kind: 'shaft' };
  },
  n: (d) => {
    const lower = d <= 24 ? 4 + Math.round(d * 0.1) : 8;
    return { es: null, ei: lower, kind: 'shaft' };
  },
  p: (d) => {
    const lower = d <= 24 ? 6 + Math.round(d * 0.15) : 15;
    return { es: null, ei: lower, kind: 'shaft' };
  },
};

function itPlaceholder(d) {
  const row = IT_TABLE.find(r => d > r.over && d <= r.upTo);
  return row?.grades[7] ?? 25;
}

function itGrade(nominal, grade) {
  const row = IT_TABLE.find(r => nominal > r.over && nominal <= r.upTo);
  if (!row || !row.grades[grade]) return null;
  return { value: row.grades[grade], unit: 'µm' };
}

/**
 * Parse fit string like "H7", "g6", "h11"
 */
export function parseFit(fitStr) {
  if (!fitStr || typeof fitStr !== 'string') return null;
  const m = fitStr.trim().match(/^([A-Za-z])(\d{1,2})$/);
  if (!m) return null;
  return { letter: m[1], grade: parseInt(m[2], 10) };
}

/**
 * Compute ISO 286 limits for a feature.
 * @returns {{ nominal, fit, max, min, upperDev, lowerDev, tolerance, kind }}
 */
export function computeLimits(nominal, fitStr) {
  const parsed = parseFit(fitStr);
  if (!parsed) {
    return {
      nominal,
      fit: fitStr,
      max: nominal,
      min: nominal,
      upperDev: 0,
      lowerDev: 0,
      tolerance: 0,
      kind: 'unknown',
      error: 'Invalid fit code',
    };
  }

  const { letter, grade } = parsed;
  const isHole = letter === letter.toUpperCase();
  const it = itGrade(nominal, grade);
  if (!it) {
    return { nominal, fit: fitStr, error: `IT${grade} not in table for ${nominal} mm` };
  }

  const itMm = it.value / 1000;
  const fundKey = isHole ? letter.toUpperCase() : letter.toLowerCase();
  const fundFn = FUNDAMENTAL[fundKey];

  if (!fundFn) {
    // Fallback: H/h style
    if (isHole) {
      return {
        nominal,
        fit: fitStr,
        max: nominal + itMm,
        min: nominal,
        upperDev: itMm,
        lowerDev: 0,
        tolerance: itMm,
        kind: 'hole',
      };
    }
    return {
      nominal,
      fit: fitStr,
      max: nominal,
      min: nominal - itMm,
      upperDev: 0,
      lowerDev: -itMm,
      tolerance: itMm,
      kind: 'shaft',
    };
  }

  const fund = fundFn(nominal);

  if (isHole) {
    const ei = (fund.ei ?? 0) / 1000;
    const es = fund.es != null ? fund.es / 1000 : ei + itMm;
    return {
      nominal,
      fit: fitStr,
      max: nominal + es,
      min: nominal + ei,
      upperDev: es,
      lowerDev: ei,
      tolerance: es - ei,
      kind: 'hole',
    };
  }

  // Shaft
  if (fund.es != null) {
    const es = fund.es / 1000;
    const ei = es - itMm;
    return {
      nominal,
      fit: fitStr,
      max: nominal + es,
      min: nominal + ei,
      upperDev: es,
      lowerDev: ei,
      tolerance: itMm,
      kind: 'shaft',
    };
  }

  const ei = (fund.ei ?? 0) / 1000;
  const es = ei + itMm;
  return {
    nominal,
    fit: fitStr,
    max: nominal + es,
    min: nominal + ei,
    upperDev: es,
    lowerDev: ei,
    tolerance: itMm,
    kind: 'shaft',
  };
}

/**
 * Clearance between hole and shaft at an interface.
 * Positive = clearance, negative = interference.
 */
export function interfaceClearance(holeLimits, shaftLimits, scenario = 'nominal') {
  let hMin, hMax, sMin, sMax;

  if (scenario === 'worst') {
    // Max lateral play: largest hole, smallest shaft
    hMin = hMax = holeLimits.max;
    sMin = sMax = shaftLimits.min;
  } else if (scenario === 'best') {
    // Min lateral play: smallest hole, largest shaft
    hMin = hMax = holeLimits.min;
    sMin = sMax = shaftLimits.max;
  } else {
    hMin = holeLimits.min;
    hMax = holeLimits.max;
    sMin = shaftLimits.min;
    sMax = shaftLimits.max;
  }

  const minClearance = holeLimits.min - shaftLimits.max;
  const maxClearance = holeLimits.max - shaftLimits.min;

  const activeMinClearance = hMin - sMax;
  const activeMaxClearance = hMax - sMin;

  return {
    minClearance,
    maxClearance,
    activeMinClearance,
    activeMaxClearance,
    type: minClearance < 0 ? 'interference' : 'clearance',
    radialMinClearance: activeMinClearance / 2,
    radialMaxClearance: activeMaxClearance / 2,
  };
}

export const COMMON_FITS = [
  'H7', 'H8', 'H11',
  'g6', 'f7', 'e8', 'h6', 'h11',
  'k6', 'n6', 'p6',
];

export function suggestFit(interfaceType, isHole) {
  const suggestions = {
    rotating_clearance: { hole: 'H7', shaft: 'g6' },
    sliding_clearance: { hole: 'H7', shaft: 'f7' },
    locational_clearance: { hole: 'H7', shaft: 'h6' },
    press_fit: { hole: 'H7', shaft: 'p6' },
    loose: { hole: 'H11', shaft: 'h11' },
  };
  const s = suggestions[interfaceType] || suggestions.rotating_clearance;
  return isHole ? s.hole : s.shaft;
}

export function formatMm(value, decimals = 3) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)} mm`;
}

export function formatUm(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value * 1000).toFixed(1)} µm`;
}
