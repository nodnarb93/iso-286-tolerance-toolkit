# ISO 286 Tolerance Toolkit

A browser-based tool for designing coaxial assemblies (e.g. plug valves) with ISO 286 tolerance fits, cross-section visualization, tolerance bands, and lateral wiggle simulation.

**No install required** — open `index.html` locally or host on GitHub Pages and embed in Notion.

## Features

- **Part creation modal** — housing bore, bushing, flanged bushing, solid/hollow shaft, flanged components
- **Constraint modes** — fixed (pinned) or floating (laterally free within clearance)
- **ISO 286 fits** — H7, g6, f7, etc. with computed min/max limits
- **Cross-section & plan views** — SVG assembly diagram
- **Tolerance bands** — green (hole) and red (shaft) machining limit lines
- **Wiggle test** — drag floating parts laterally at worst/best-case tolerances
- **Export / import** — JSON configuration files

## Quick start

Open `index.html` in a modern browser, or serve locally:

```bash
npx serve .
```

The app loads a **plug valve example** by default (valve body bore → flanged bushing → plug core).

## Notion embed

1. Enable GitHub Pages for this repo
2. In Notion: `/embed` → paste your Pages URL

## File format

Exported JSON contains part types, dimensions, fits, constraints, and axial offsets. Re-import via the Import button.

## Roadmap

- Expanded ISO 286 tables (more grades & diameters)
- URL hash sharing (`#config=...`)
- RSS / statistical stack-up
- PDF export of diagrams
