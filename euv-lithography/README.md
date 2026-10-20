# Inside the EUV cell

Interactive schematic of an ASML TWINSCAN NXE:3800E EUV lithography cell (13.5 nm, 0.33 NA), from tin droplet to patterned wafer.

## Modes

- **Drawing**: GPU-rendered isometric cutaway of 13 subsystems: overhead hoist, FOUP and load port, coater/developer track, interface and load locks, utilities, tin plasma source, illuminator, reticle stage, projection optics, twin wafer stages, scanner frame, beam transport, and CO₂ drive laser. Camera presets, explode view, EUV and CO₂ ray overlay, wafer route.
- **3D breakdown**: 2,834 solid objects with orbit, pan and zoom. Click a part to extract it and read its function, scope and uncertainty.
- **True scale**: 300 mm wafer, 26 × 33 mm scanned field and 104 × 132 mm mask-pattern area at nominal metric scale.
- **Run wafers**: animated scanner cycle. 96 fields, 16.364 s per wafer, 220 wph reference.

## Run

The page uses ES modules and `fetch`. Browsers block both from `file://`, so serve the folder over HTTP:

```sh
cd euv-lithography
python3 -m http.server 8000
```

Open http://localhost:8000. No build step and no network access are needed. Three.js is in `vendor/`.

Requires WebGL2, import maps and `DecompressionStream`.

**iPad:** copy the folder into Textastic (or any editor with a local web preview), open `index.html`, and use Web Preview.

## Layout

| Path | Content |
| --- | --- |
| `index.html` | Page structure |
| `src/app.js` | UI, part descriptions, mode switching, frame loop |
| `src/renderer.js` | WebGL2 drawing renderer |
| `src/three-view.js` | 3D breakdown: camera, extraction, shaders |
| `src/inspection-motion.js` | Critically damped spring for part extraction (ω = 11) |
| `src/process.js` | Wafer process timing and route |
| `src/evidence.js`, `src/evidence-ui.js` | Reference values, sources, uncertainty labels |
| `src/reference-scene.js` | True-scale comparison geometry |
| `data/*.json` | Mesh, solid-object and reference metadata |
| `assets/*.bin` | Gzipped geometry buffers (drawing mesh and 3D solids) |
| `dimension-evidence.json` | Exported dimension sources |
| `vendor/` | Three.js 0.180.0 and OrbitControls, unmodified, MIT |

## Accuracy

The machine is a **schematic**, not manufacturer CAD. Heights are retained and lengths are compressed. Every value carries a source and a label: calibrated, estimate, derived, or schematic. A missing tolerance means unknown, not zero. Only the wafer, field, and mask comparison in True scale is to nominal scale.

Sources: ASML NXE:3800E and NXE:3400B product pages, ASML EUV platform pages, ZEISS SMT EUV optics, ASML 2024 annual report (SEC 20-F), and Maas et al., *EUV Industrialization*, EUVL Workshop 2023. Links are in the app and in `dimension-evidence.json`.

## Geometry

The `assets/` buffers are build output. The shape data and build scripts that generated them (CSG cuts with three-bvh-csg) are not in this repo, so geometry cannot be regenerated here. Runtime behaviour, text, styling and motion can be edited directly.

| Buffer | Size |
| --- | --- |
| Drawing mesh | 1,580,062 triangles (full LOD) |
| 3D solids | 695,535 triangles, 477,328 vertices, 2,834 objects |
