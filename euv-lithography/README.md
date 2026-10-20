# Inside the EUV cell

Interactive schematic of an ASML TWINSCAN NXE:3800E EUV lithography cell (13.5 nm, 0.33 NA), from tin droplet to patterned wafer.

## Modes

- **Drawing**: GPU-rendered isometric cutaway of 13 subsystems: overhead hoist, FOUP and load port, coater/developer track, interface and load locks, utilities, tin plasma source, illuminator, reticle stage, projection optics, twin wafer stages, scanner frame, beam transport, and CO₂ drive laser. Camera presets, explode view, EUV and CO₂ ray overlay, wafer route.
- **3D breakdown**: 2,834 solid objects with orbit, pan and zoom. Click a part to extract it and read its function, scope and uncertainty.
- **True scale**: 300 mm wafer, 26 × 33 mm scanned field and 104 × 132 mm mask-pattern area at nominal metric scale.
- **Run wafers**: animated scanner cycle. 96 fields, 16.364 s per wafer, 220 wph reference.

## Run

`app/` is the complete runtime. It needs no build step and no network.

```sh
python3 -m http.server 8000 -d app
```

Open http://localhost:8000. The page uses ES modules and `fetch`, and browsers block both from `file://`.

To get one file that opens with a double-click, run `npm ci && npm run build:single`. The output is `dist/euv-lithography.html` (about 44 MB, with all geometry inlined).

**iPad:** copy `app/` into Textastic (or any editor with a local web preview), open `index.html`, and use Web Preview. Or AirDrop the single file.

Requires WebGL2, import maps and `DecompressionStream`.

## Layout

| Path | Content |
| --- | --- |
| `app/index.html`, `app/src/` | Runtime: UI, WebGL2 drawing renderer, Three.js 3D view, process animation, evidence |
| `app/data/`, `app/assets/` | Generated metadata and gzipped geometry buffers |
| `app/vendor/` | Three.js 0.180.0 and OrbitControls, unmodified, MIT |
| `authoring/parts/` | The 14 procedural assemblies, one module each |
| `authoring/plan.mjs` | World units (1 unit = 1 cm), camera, assembly envelopes, optical points, ports |
| `authoring/model.mjs` | Published facts and sources used by the drawing |
| `authoring/lib.mjs`, `authoring/kit/` | Geometry helpers: slabs, turned bodies, tubes, isometric projection, audit |
| `source-shapes.json.gz` | Frozen snapshot of every recorded shape (2,834 items) |
| `fixtures/original-light.html.gz` | The reference SVG drawing that the shipped drawing mesh was compiled from |
| `reference-overrides.json` | Manual corrections merged into `app/data/reference-data.json` |
| `pipeline/` | Shape extraction, SVG to mesh compile, 3D CSG build, single-file build, evidence export |
| `tests/` | Buffer integrity, evidence, process timing, inspection motion |

## Build pipeline

```
authoring/parts/*.mjs ─┬─ author:svg ──► authoring/generated-light.html ─┐
                       │                (or fixtures/original-light)     ├─ convert ─► build:drawing ─► app/assets/machine.*  app/data/mesh-meta.json
                       └─ author:shapes ► source-shapes.json.gz ── build:3d ─► app/assets/solid.*    app/data/solid-meta.json
app/src/evidence.js ── build:evidence ─► app/dimension-evidence.json  DIMENSION-SOURCES.md
app/ ── build:single ─► dist/euv-lithography.html
```

Setup needs Node 22+, Python 3.11+ and Chromium:

```sh
npm ci
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

| Change | Commands |
| --- | --- |
| UI, text, styles, motion, evidence (`app/src/`) | None. Reload. Run `npm run build:evidence` after an evidence change. |
| 3D geometry only | `npm run author:shapes && npm run build:3d` |
| Drawing geometry | `npm run author:svg:quick` (or `author:svg` for release), then `npm run convert`. Open http://127.0.0.1:8877, click **Compile drawing mesh**, wait for **Saved**, stop the server. Then `npm run build:drawing`. |
| Check | `npm test` (builds the single file, then 25 tests) |

`author:svg` depth-sorts 2,834 items so that the painter's order holds in every explode-animation state. The full sort replays 1,387 states and takes about 30 to 40 minutes. `author:svg:quick` sorts on 63 states and takes about 90 s. Its assembled drawing is pixel-identical to the reference fixture, so use quick mode while you iterate. Run the full sort before you ship, so that mid-explode overlaps are correct. `--fast` skips the sort and is for layout checks only.

### Reproducibility

Checked on Linux against the shipped buffers:

- `author:shapes`: same 2,834 items and 25,624 shapes. Floats can differ in the last bit (≤1 ULP) because `Math.sin` differs by platform.
- `build:3d` from the frozen snapshot: **byte-identical** solid buffers and metadata.
- `convert` + `build:drawing` from the fixture: same items, groups and pieces. 1,579,959 triangles against 1,580,062 shipped (−0.007%), because browser SVG tessellation differs by platform and version.
- `author:svg --fast`: `reference-data.json` is byte-identical.

## Accuracy

The machine is a **schematic**, not manufacturer CAD. Heights are retained and lengths are compressed. Every value carries a source and a label: published, derived, illustrative or unknown. A missing tolerance means unknown, not zero. Parts carry `// DERIVED:` comments wherever the geometry was engineered from physics and constraints and not taken from a source. Only the wafer, field and mask comparison in True scale is to nominal scale. See [DIMENSION-SOURCES.md](DIMENSION-SOURCES.md).

Sources: ASML NXE:3800E and NXE:3400B product pages, ASML EUV platform pages, ZEISS SMT EUV optics, ASML 2024 annual report (SEC 20-F), Maas et al., *EUV Industrialization*, EUVL Workshop 2023, and the patents and papers cited in each part module.

## Geometry

| Buffer | Size |
| --- | --- |
| Drawing mesh | 1,580,062 triangles at full detail, 3 LODs |
| 3D solids | 695,535 triangles, 477,328 vertices, 2,834 objects, 15 CSG cuts |
