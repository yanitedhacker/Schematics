// The world plan of the litho cell: one unit is 1 cm, x runs along the cell (track at -x, source at +x),
// y across it (+y toward the viewer's side, the cutaway face), z up from the fab's raised floor.
// Heights are true to the layout research (wafer ~1.4 m, mask ~3 m up); the scanner's length is drawn ~2x shorter than
// the real ~10-11 m so the cell fits one card.
// Every assembly module builds inside its envelope and meets its neighbours only at the PORTS below.
import { k } from "./lib.mjs";

export const W = 1440;
export const H = 1180;
export const AZIMUTH = 62;
export const ELEVATION = 26;

// fab floor: raised floor tiles at z 0, the waffle slab under it, the sub-fab floor below
export const FLOOR = { x: -640, y: -210, w: 1300, d: 420, r: 6 };
export const TILE = 60;                                 // raised-floor tile pitch
export const WAFFLE = { top: -60, bottom: -120 };       // concrete waffle slab under the pedestals
export const SUBFAB = { x: 40, y: -190, w: 600, d: 380, r: 6, z: -470 };

// envelopes, as plans with z ranges; modules stay inside them
export const ENV = {
  oht:       { x: -630, y: 120, w: 300, d: 80, z0: 120, z1: 290 },  // rail ~260 above floor, vehicle ~90 below it [track.md]
  loadport:  { x: -610, y: 130, w: 250, d: 75, z0: 0, z1: 140 },    // TAS300-class ports 139 tall, 47 wide, wafer datum 90 [track.md]
  track:     { x: -600, y: -150, w: 440, d: 280, z0: 0, z1: 250 },
  interface: { x: -160, y: -140, w: 90, d: 260, z0: 0, z1: 230 },
  stages:    { x: -60, y: -140, w: 320, d: 280, z0: 94, z1: 196 },
  pob:       { x: -50, y: -160, w: 240, d: 320, z0: 142, z1: 290 },  // y widened for the outriggers to metroSeats     // POB 43 x 77 x 137 [US20260016756A1] + metro frame + sensors
  reticle:   { x: 20, y: -110, w: 250, d: 220, z0: 290, z1: 366 },
  illum:     { x: 170, y: -100, w: 180, d: 200, z0: 196, z1: 316 },
  source:    { x: 300, y: -130, w: 160, d: 260, z0: 0, z1: 290 },
  frame:     { x: -70, y: -160, w: 540, d: 320, z0: 0, z1: 406 },   // scanner frame and skin, cut open on +y
  utility:   { x: -60, y: -200, w: 520, d: 50, z0: 0, z1: 260 },    // pumps, gas, electronics at the back
  beamline:  { x: 340, y: -40, w: 80, d: 80, z0: -440, z1: 20 },
  laser:     { x: 60, y: -170, w: 560, d: 340, z0: -470, z1: -300 },
};

// optical axis points (world), shared by source, illuminator, reticle, POB and stages so the beam is one line.
// Scan runs along world x. Mask face down 155 above the wafer [lowisch2012: 1500-1650 mm], offset 32 along the
// scan [US7151592B2: ~318 mm]; light reaches the mask from below at 6 deg and leaves 12 deg apart [Lowisch, Heil 2015].
export const OPTIC = {
  plasma: [380, 0, 134],              // first focus of the Ø65 collector; collector at the bottom facing up, laser up through its hole [source.md: Fomenkov 2017, Purvis 2020]
  IF: [380, 0, 254],                 // intermediate focus straight above the plasma; 120 apart is DERIVED inside the 100-160 cm range [source.md: TSMC patent]
  facetField: [300, 0, 290],         // field facet mirror, first mirror after the IF (DERIVED placement)
  facetPupil: [238, 0, 228],         // pupil facet mirror, conjugate to the POB pupil
  relay: [190, 0, 252],              // grazing relay that sends the light up to the mask at 6 deg (count UNVERIFIED)
  reticle: [142, 0, 295],            // patterned face of the mask, face down
  pobTop: [142, 0, 280],
  m6: [110, 0, 146],                  // POB exit just above the wafer (the mirror there is M5; M6 sits ~56 up). Geometry comes from shared.pobMirrors
  wafer: [110, 0, 140],               // wafer surface under the projection optics (exposure position)
};
export const MEASURE = [-10, 0, 140];   // wafer surface under the alignment and level sensors (measure position)

// meeting points between modules: a pipe or cable owned by one module ends on the other's port
export const PORTS = {
  beamEntry: { at: [380, 0, 0], normal: [0, 0, -1], r: 14 },          // beamline tube meets the source vessel floor flange
  laserOut: { at: [380, 0, -300], normal: [0, 0, 1], r: 14 },         // laser's final beam port, up
  waferHandoff: { at: [-160, 0, 140], normal: [-1, 0, 0] },            // track interface face into the scanner load lock
  foupDock: { at: [-530, 130, 90], normal: [0, 1, 0] },               // middle load port's docking plane on the track's front, wafer datum height
  h2Supply: { at: [340, -130, 196], normal: [0, -1, 0], r: 3 },       // hydrogen inlet on the vessel's back
  pumpSource: { at: [420, -130, 136], normal: [0, -1, 0], r: 8 },      // vessel turbo pump port
  pumpStages: { at: [100, -140, 126], normal: [0, -1, 0], r: 8 },      // stage chamber pump port
};

// surfaces one module provides for another to stand on. A module built alone (ctx.solo) records a
// ground stub on each mount it uses: if (ctx.solo) L.record({ ...A.slab(plan, z - 1, 1, { name: "stand.stub" }), ground: true })
export const MOUNTS = {
  baseTop: { plan: { x: -66, y: -158, w: 362, d: 314, r: 2 }, z: 94, by: "frame" },        // steel base frame top deck (wafer plane ~1.4 m above the floor [layout.md])
  upperDeck: { plan: { x: -20, y: -150, w: 330, d: 300, r: 2 }, z: 376, by: "frame" },     // top beams; the reticle stage hangs below (mask ~3 m up [layout.md])
  metroTop: { plan: { x: -50, y: -58, w: 240, d: 70, r: 2 }, z: 172, by: "pob" },         // metrology frame plate the POB and sensors hang from
  // four seats for the metrology frame's airmounts, on frame pillars that rise from baseTop outside the stage plate
  // (the stage plate spans y -140..135), so the metro frame is isolated from the stages. Each seat is a 16 x 16 pad, top z 142.
  metroSeats: { at: [[-40, -150], [180, -150], [-40, 148], [180, 148]], size: 16, z: 142, by: "frame" },
};

// assemblies: name, what the legend calls them, and the way each comes apart
export const PIECES = {
  stand:     { name: "Fab floor and sub-fab", move: [0, 0, 0] },
  oht:       { name: "Overhead hoist", move: [0, 0, 90] },
  loadport:  { name: "FOUP and load port", move: [0, 90, 0] },
  track:     { name: "Coater/developer track", move: [-70, 0, 0] },
  interface: { name: "Interface and load locks", move: [-30, 0, 0] },
  frame:     { name: "Scanner frame and skin", move: [0, -120, 0] },
  utility:   { name: "Pumps, gas and power", move: [0, -160, 0] },
  stages:    { name: "Twin wafer stages", move: [0, 110, 12] },
  pob:       { name: "Projection optics", move: [0, 130, 0] },
  reticle:   { name: "Reticle stage and mask", move: [0, 150, 0] },
  illum:     { name: "Illuminator", move: [0, 130, 0] },
  source:    { name: "Tin plasma source", move: [0, 170, 0] },
  beamline:  { name: "Beam transport", move: [0, 0, 0] },
  laser:     { name: "CO2 drive laser", move: [0, 140, 0] },
};
// outside parts leave first (motion.md, "Order the stagger"). The frame encloses the scanner and its +y side is open, so every
// interior assembly exits forward through the cutaway before the frame leaves backward; the utilities behind the frame go before it.
export const STAGGER = ["oht", "loadport", "track", "interface", "utility", "source", "illum", "reticle", "pob", "stages", "frame", "beamline", "laser", "stand"];
// threaded assemblies share a spring (motion.md): the illuminator's relay arm passes through the POB's wall port,
// so every illuminator item rides the POB spring while still highlighting as the illuminator
export const RIDES = { illum: "pob", stages: "pob" };   // the stages, POB and illuminator interleave at the exposure point: one block
export const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };

export const fitPoints = () => [
  ...k.boxCorners(FLOOR, SUBFAB.z, 0),
  ...k.boxCorners({ x: ENV.oht.x, y: ENV.oht.y, w: ENV.oht.w, d: ENV.oht.d, r: 0 }, 0, ENV.oht.z1),
  ...k.boxCorners({ x: ENV.frame.x, y: ENV.frame.y, w: ENV.frame.w, d: ENV.frame.d, r: 0 }, 0, ENV.frame.z1),
];
export const project = () => k.fitProjection(fitPoints(), W, H, { pad: 34, azimuth: AZIMUTH, elevation: ELEVATION });
