/**
 * Part type definitions and assembly model.
 */

export const PART_TYPES = {
  housing_bore: {
    label: 'Housing bore (e.g. valve body)',
    description: 'Inner bore only — no outer diameter. Fully constrained reference surface.',
    defaultConstraint: 'fixed',
    dims: [
      { key: 'bore', label: 'Bore diameter (ID)', default: 50, step: 0.1 },
      { key: 'length', label: 'Length', default: 80, step: 0.5 },
    ],
    fits: [{ key: 'boreFit', label: 'Bore fit', default: 'H8', target: 'bore' }],
    hasOd: false,
    hasId: true,
    color: '#4a6fa5',
  },
  bushing: {
    label: 'Bushing (plain)',
    description: 'Plain cylindrical bushing with OD and ID.',
    defaultConstraint: 'floating',
    dims: [
      { key: 'od', label: 'Outer diameter (OD)', default: 50, step: 0.1 },
      { key: 'id', label: 'Inner diameter (ID)', default: 25, step: 0.1 },
      { key: 'length', label: 'Length', default: 20, step: 0.5 },
    ],
    fits: [
      { key: 'odFit', label: 'OD fit ( mates with housing )', default: 'g7', target: 'od' },
      { key: 'idFit', label: 'ID fit ( mates with inner part )', default: 'H7', target: 'id' },
    ],
    hasOd: true,
    hasId: true,
    color: '#6b8e6b',
  },
  flanged_bushing: {
    label: 'Flanged bushing',
    description: 'Bushing with a radial flange for axial retention.',
    defaultConstraint: 'floating',
    dims: [
      { key: 'od', label: 'Outer diameter (OD)', default: 50, step: 0.1 },
      { key: 'id', label: 'Inner diameter (ID)', default: 25, step: 0.1 },
      { key: 'length', label: 'Bore length', default: 18, step: 0.5 },
      { key: 'flangeOd', label: 'Flange OD', default: 62, step: 0.1 },
      { key: 'flangeThickness', label: 'Flange thickness', default: 3, step: 0.1 },
    ],
    fits: [
      { key: 'odFit', label: 'OD fit', default: 'g7', target: 'od' },
      { key: 'idFit', label: 'ID fit', default: 'H7', target: 'id' },
    ],
    hasOd: true,
    hasId: true,
    hasFlange: true,
    color: '#5a9a7a',
  },
  shaft_solid: {
    label: 'Solid shaft / plug core',
    description: 'Solid cylindrical shaft or plug (e.g. valve rotor).',
    defaultConstraint: 'floating',
    dims: [
      { key: 'od', label: 'Outer diameter (OD)', default: 25, step: 0.1 },
      { key: 'length', label: 'Length', default: 60, step: 0.5 },
    ],
    fits: [{ key: 'odFit', label: 'OD fit', default: 'f7', target: 'od' }],
    hasOd: true,
    hasId: false,
    color: '#a07850',
  },
  shaft_hollow: {
    label: 'Hollow shaft / sleeve',
    description: 'Hollow cylindrical member with OD and ID.',
    defaultConstraint: 'floating',
    dims: [
      { key: 'od', label: 'Outer diameter (OD)', default: 30, step: 0.1 },
      { key: 'id', label: 'Inner diameter (ID)', default: 15, step: 0.1 },
      { key: 'length', label: 'Length', default: 40, step: 0.5 },
    ],
    fits: [
      { key: 'odFit', label: 'OD fit', default: 'g6', target: 'od' },
      { key: 'idFit', label: 'ID fit', default: 'H7', target: 'id' },
    ],
    hasOd: true,
    hasId: true,
    color: '#8a7055',
  },
  flanged_component: {
    label: 'Flanged component',
    description: 'Generic flanged part (retainer, cover, etc.).',
    defaultConstraint: 'floating',
    dims: [
      { key: 'od', label: 'Outer diameter (OD)', default: 40, step: 0.1 },
      { key: 'id', label: 'Inner diameter (ID)', default: 20, step: 0.1 },
      { key: 'length', label: 'Body length', default: 15, step: 0.5 },
      { key: 'flangeOd', label: 'Flange OD', default: 55, step: 0.1 },
      { key: 'flangeThickness', label: 'Flange thickness', default: 4, step: 0.1 },
    ],
    fits: [
      { key: 'odFit', label: 'OD fit', default: 'h7', target: 'od' },
      { key: 'idFit', label: 'ID fit', default: 'H7', target: 'id' },
    ],
    hasOd: true,
    hasId: true,
    hasFlange: true,
    color: '#7a6a90',
  },
};

let nextId = 1;

export function createPart(type, overrides = {}) {
  const def = PART_TYPES[type];
  if (!def) throw new Error(`Unknown part type: ${type}`);

  const dims = {};
  def.dims.forEach(d => { dims[d.key] = d.default; });

  const fits = {};
  def.fits.forEach(f => { fits[f.key] = f.default; });

  return {
    id: overrides.id ?? `part-${nextId++}`,
    name: overrides.name ?? def.label,
    type,
    constraint: overrides.constraint ?? def.defaultConstraint,
    dims: { ...dims, ...overrides.dims },
    fits: { ...fits, ...overrides.fits },
    zOffset: overrides.zOffset ?? 0,
  };
}

export function createPlugValveExample() {
  nextId = 1;
  return {
    name: 'Plug valve assembly',
    parts: [
      createPart('housing_bore', {
        id: 'body',
        name: 'Valve body bore',
        constraint: 'fixed',
        dims: { bore: 50, length: 80 },
        fits: { boreFit: 'H8' },
      }),
      createPart('flanged_bushing', {
        id: 'bushing',
        name: 'Flanged bushing',
        constraint: 'floating',
        dims: { od: 50, id: 25, length: 18, flangeOd: 62, flangeThickness: 3 },
        fits: { odFit: 'g7', idFit: 'H7' },
        zOffset: 10,
      }),
      createPart('shaft_solid', {
        id: 'plug',
        name: 'Plug / rotor core',
        constraint: 'floating',
        dims: { od: 25, length: 55 },
        fits: { odFit: 'f7' },
        zOffset: 12,
      }),
    ],
  };
}

/**
 * Resolve mating interfaces between adjacent parts in stack order.
 */
export function getInterfaces(assembly) {
  const interfaces = [];
  const parts = assembly.parts;

  for (let i = 0; i < parts.length - 1; i++) {
    const outer = parts[i];
    const inner = parts[i + 1];
    const iface = detectInterface(outer, inner);
    if (iface) interfaces.push({ ...iface, outerId: outer.id, innerId: inner.id });
  }
  return interfaces;
}

function detectInterface(outer, inner) {
  const oDef = PART_TYPES[outer.type];
  const iDef = PART_TYPES[inner.type];

  // Housing bore inner surface ↔ bushing/shaft OD
  if (outer.type === 'housing_bore' && iDef.hasOd) {
    return {
      holePart: outer.id,
      holeFeature: 'bore',
      holeFit: outer.fits.boreFit,
      holeNominal: outer.dims.bore,
      shaftPart: inner.id,
      shaftFeature: 'od',
      shaftFit: inner.fits.odFit,
      shaftNominal: inner.dims.od,
    };
  }

  // Outer part ID ↔ inner part OD
  if (oDef.hasId && iDef.hasOd) {
    return {
      holePart: outer.id,
      holeFeature: 'id',
      holeFit: outer.fits.idFit,
      holeNominal: outer.dims.id,
      shaftPart: inner.id,
      shaftFeature: 'od',
      shaftFit: inner.fits.odFit,
      shaftNominal: inner.dims.od,
    };
  }

  return null;
}

export function serializeAssembly(assembly) {
  return JSON.stringify(assembly, null, 2);
}

export function deserializeAssembly(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data.parts || !Array.isArray(data.parts)) throw new Error('Invalid assembly file');
  data.parts.forEach(p => {
    if (!p.id) p.id = `part-${nextId++}`;
  });
  return data;
}
