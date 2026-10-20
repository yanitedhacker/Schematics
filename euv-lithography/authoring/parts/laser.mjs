// The Trumpf CO2 drive laser in the sub-fab: two seed lasers and a pre-amplifier in the seed module (HPSM),
// four fast-flow power amplifiers PA0-PA3 on an isolation frame (HPAC), linked stage to stage through
// fold-mirror boxes, the beam expander and the output turret that turns the beam up into the beam transport.
// Sourced facts are in research/source.md (Trumpf EUV drive-laser page; Kaschke, EUVL Workshop 2018, S36;
// Cymer SPIE 2011/2013; WO2011075346A1). Everything else is DERIVED below.
import { k, G, A } from "../lib.mjs";

// DERIVED: plan.mjs moves the laser [0, 0, -120], straight down through the sub-fab floor slab it stands on.
// The real unit rolls out sideways on its service aisle, so it leaves toward the viewer (+y).
export const LASER_MOVE = [0, 140, 0];

export function build(L, ctx) {
  const { P, SUBFAB, PORTS } = ctx;
  const { Ln, Dots, at, path3 } = L;
  const M = { move: LASER_MOVE };
  const Z0 = SUBFAB.z;

  const faceY = (Y, x0, x1, z0, z1) => path3([[x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1]], true);
  const faceX = (X, y0, y1, z0, z1) => path3([[X, y0, z0], [X, y1, z0], [X, y1, z1], [X, y0, z1]], true);
  const slotsY = (Y, x0, x1, z0, z1, n) => Array.from({ length: n }, (_, i) => {
    const w = (x1 - x0) / n;
    return faceY(Y, x0 + i * w + w * 0.18, x0 + (i + 1) * w - w * 0.18, z0, z1);
  }).join("");
  const box = (name, a, b, tone, opts = {}) => L.boxOf("laser", a, b, { tone }, { ...M, name: `laser.${name}`, ...opts });
  const upF = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

  // ---------- isolation frame ----------
  // [Cymer 2011] the laser sits on an isolation frame. DERIVED: 8 air-spring isolators under a 10 cm steel deck.
  const DECK = { x: 95, y: -118, w: 470, d: 236, r: 1.2 };
  const DECK_Z = Z0 + 8;
  const DECK_TOP = DECK_Z + 10;
  for (const x of [130, 250, 370, 490]) for (const y of [-104, 104])
    L.turned("laser", upF(x, y, Z0), [[0, 9], [2.5, 9], [2.5, 7.5], [5.5, 7.5], [5.5, 8.5], [8, 8.5]], { tone: "lo" }, { ...M, name: "laser.isolator" });
  L.slab("laser", DECK, DECK_Z, 10, { tone: "lo" }, {
    ...M, name: "laser.deck", steps: 3, bevel: 0.6,
    inner: Ln(k.sideSeam(DECK, DECK_Z + 4, P, 3), { tone: "faint" }),
    extra: Dots([...k.corners(DECK, 4), [DECK.x + DECK.w / 2, DECK.y + 4], [DECK.x + DECK.w / 2, DECK.y + DECK.d - 4]].map(([x, y]) => at([x, y, DECK_TOP])), { size: 0.45 }),
  });

  // ---------- power amplifiers PA0..PA3 ----------
  // [S36 slide 8] each PA has its own blower, RF supply and gas mix. [S36 slide 5] frame ~5.0-5.5 m long, ~2.4 m high.
  // DERIVED: the envelope stops 170 cm above the sub-fab floor, so the four PAs lie side by side in one tier, each a
  // 3.75 m discharge housing with its blower section at the far (-x) end; the serpentine beam fixes their order in y.
  const PA_Y = [84, 28, -28, -84];
  const HALF = 18;
  const BEAM_Z = -425;                      // DERIVED: beam axis at mid height of the 50 cm discharge housing
  const BLOWER = [140, 176];
  const DISCH = [176, 515];
  const DISCH_TOP = DECK_TOP + 50;
  const BLOWER_TOP = DECK_TOP + 64;
  const MATCH_X = [340, 327, 262, 197];      // RF matchbox x, under each PA's coax drop
  PA_Y.forEach((yc, i) => {
    const y0 = yc - HALF;
    const y1 = yc + HALF;
    const bPlan = { x: BLOWER[0], y: y0, w: BLOWER[1] - BLOWER[0], d: 2 * HALF, r: 1 };
    box(`pa${i}.blower-box`, [BLOWER[0], y0, DECK_TOP], [BLOWER[1], y1, BLOWER_TOP], "mid", {
      inner: Ln(k.sideSeam(bPlan, DECK_TOP + 22, P, 3), { tone: "faint" }),
      extra: Ln(slotsY(y1, BLOWER[0] + 4, BLOWER[1] - 4, DECK_TOP + 6, DECK_TOP + 16, 4), { tone: "lo" }),
    });
    // DERIVED: each discharge housing is two bolted 1.7 m modules, so a service crew can swap one half
    for (const [x0, x1] of [[DISCH[0], 345], [345, DISCH[1]]]) {
      const dPlan = { x: x0, y: y0, w: x1 - x0, d: 2 * HALF, r: 1 };
      const panel = (x0 + x1) / 2;
      box(`pa${i}.housing`, [x0, y0, DECK_TOP], [x1, y1, DISCH_TOP], "hi", {
        inner: Ln(k.sideSeam(dPlan, DECK_TOP + 8, P, 3) + k.segment([panel, y1, DECK_TOP], [panel, y1, DISCH_TOP], P), { tone: "faint" }),
        extra: Dots([x0 + 10, panel - 8, panel + 8, x1 - 10].map((x) => at([x, y1, DISCH_TOP - 4])), { size: 0.42 }) + (x1 === DISCH[1] ? Ln(slotsY(y1, 440, 505, DECK_TOP + 14, DECK_TOP + 18, 3), { tone: "lo" }) : ""),
      });
    }
    // blower: DERIVED radial turbo blower, volute on the blower section with its motor can above
    L.turned("laser", upF(158, yc, BLOWER_TOP), [[0, 15], [7, 15], [7, 11], [9, 11], [9, 8.5, 0], [22, 8.5], [24, 6.5]], { tone: "mid" }, {
      ...M, name: `laser.pa${i}.blower`,
      inner: Ln(G.arcOf(upF(158, yc, BLOWER_TOP), 15, 8.5, P), { tone: "faint" }),
    });
    // gas return duct along the housing top, blower face to the gas header block
    box(`pa${i}.gas-header`, [480, yc + 2, DISCH_TOP], [500, yc + 16, DISCH_TOP + 16], "mid", {
      extra: Dots([[484, yc + 5], [496, yc + 13]].map(([x, y]) => at([x, y, DISCH_TOP + 16])), { size: 0.42 }),
    });
    L.pipe("laser", [[BLOWER[1], yc + 9, DISCH_TOP + 7], [480, yc + 9, DISCH_TOP + 7]], 3, { ...M, name: `laser.pa${i}.gas-duct`, tone: "mid", bands: [0.33, 0.66] });
    // RF matchbox where the coax from the RF generator lands (13.56 MHz [Cymer 2013])
    const mx = MATCH_X[i];
    box(`pa${i}.matchbox`, [mx - 15, yc - 16, DISCH_TOP], [mx + 15, yc + 2, DISCH_TOP + 14], "mid", {
      extra: Ln(k.planOutline(k.insetPlan({ x: mx - 15, y: yc - 16, w: 30, d: 18, r: 0.4 }, 2), DISCH_TOP + 14, P, 2), { tone: "faint" }) +
        Dots([[mx - 12, yc - 13], [mx + 12, yc - 1]].map(([x, y]) => at([x, y, DISCH_TOP + 14])), { size: 0.42 }),
    });
  });

  // ---------- fold-mirror boxes and stage-to-stage beam tubes ----------
  // [S36 slide 8] relay optics between stages. DERIVED: 28 x 84 boxes with two 45 deg mirrors, 3 cm service lid.
  const FOLD_H = 44;
  const lidded = (name, x0, x1, y0, y1, z0, z1) => {
    // inspection port with a bolted cover on the near face, corner screws
    const cx = (x0 + x1) / 2;
    const cz = z1 - 12;
    box(`${name}`, [x0, y0, z0], [x1, y1, z1], "mid", {
      inner: Ln(k.sideSeam({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.4 }, z0 + 6, P, 3), { tone: "faint" }),
      extra: Ln(k.sideRing([cx, y1, cz], 5, "y", P, 28) + k.sideRing([cx, y1, cz], 3.4, "y", P, 24), { tone: "lo" }) +
        Dots([[x0 + 3, z1 - 3], [x1 - 3, z1 - 3], [x0 + 3, z0 + 10], [x1 - 3, z0 + 10]].map(([x, z]) => at([x, y1, z])), { size: 0.42 }),
    });
    const lid = { x: x0 + 1.5, y: y0 + 1.5, w: x1 - x0 - 3, d: y1 - y0 - 3, r: 0.6 };
    L.slab("laser", lid, z1, 2.5, { tone: "mid" }, {
      ...M, name: `laser.${name}.lid`, steps: 2, bevel: 0.4,
      extra: Ln(k.planOutline(k.insetPlan(lid, 2), z1 + 2.5, P, 2), { tone: "faint" }) + Dots(k.corners(lid, 2.6).map(([x, y]) => at([x, y, z1 + 2.5])), { size: 0.45 }),
    });
  };
  lidded("fold01", 100, 128, 14, 98, DECK_TOP, DECK_TOP + FOLD_H);
  lidded("fold23", 100, 128, -98, -14, DECK_TOP, DECK_TOP + FOLD_H);
  lidded("fold12", 533, 561, -42, 42, DECK_TOP, DECK_TOP + FOLD_H);
  lidded("fold-in", 533, 561, 70, 98, DECK_TOP, DECK_TOP + FOLD_H);
  const OUT_Z = -345;                      // DERIVED: periscope lifts the beam over the PAs to the expander height
  lidded("periscope", 533, 561, -100, -68, DECK_TOP, OUT_Z + 15);

  // DERIVED: stage beam r 4 = BTS tube r 12 / 3.6x expander [WO2011075346A1]
  const BR = 4;
  const beam = (name, a, b, r = BR) => L.pipe("laser", [a, b], r, { ...M, name: `laser.${name}`, tone: "hi" });
  // window bosses on the PA end faces
  PA_Y.forEach((yc, i) => {
    L.boss("laser", [BLOWER[0], yc, BEAM_Z], [-1, 0, 0], 6.5, 2, { ...M, name: `laser.pa${i}.window-in` });
    L.boss("laser", [DISCH[1], yc, BEAM_Z], [1, 0, 0], 6.5, 2, { ...M, name: `laser.pa${i}.window-out` });
  });
  // seed -> PA0 runs -x, PA1 +x, PA2 -x, PA3 +x
  beam("beam-in", [547, 98, BEAM_Z], [547, 146, BEAM_Z]);
  beam("beam-pa0", [533, 84, BEAM_Z], [DISCH[1] + 2, 84, BEAM_Z]);
  beam("beam-01a", [BLOWER[0] - 2, 84, BEAM_Z], [128, 84, BEAM_Z]);
  beam("beam-01b", [128, 28, BEAM_Z], [BLOWER[0] - 2, 28, BEAM_Z]);
  beam("beam-12a", [DISCH[1] + 2, 28, BEAM_Z], [533, 28, BEAM_Z]);
  beam("beam-12b", [533, -28, BEAM_Z], [DISCH[1] + 2, -28, BEAM_Z]);
  beam("beam-23a", [BLOWER[0] - 2, -28, BEAM_Z], [128, -28, BEAM_Z]);
  beam("beam-23b", [128, -84, BEAM_Z], [BLOWER[0] - 2, -84, BEAM_Z]);
  beam("beam-pa3", [DISCH[1] + 2, -84, BEAM_Z], [533, -84, BEAM_Z]);

  // ---------- beam expander, last fold and the output turret ----------
  // [WO2011075346A1] 2 off-axis paraboloids, ~3.6x, at the laser exit. DERIVED: 70 x 32 x 34 housing on a post off PA3.
  const EXP = { x0: 430, x1: 500, y0: -100, y1: -68, z0: OUT_Z - 17, z1: OUT_Z + 17 };
  box("expander", [EXP.x0, EXP.y0, EXP.z0], [EXP.x1, EXP.y1, EXP.z1], "mid", {
    inner: Ln(k.segment([465, EXP.y1, EXP.z0], [465, EXP.y1, EXP.z1], P), { tone: "faint" }),
    extra: Dots([[436, EXP.z1 - 4], [494, EXP.z1 - 4], [436, EXP.z0 + 4], [494, EXP.z0 + 4]].map(([x, z]) => at([x, EXP.y1, z])), { size: 0.42 }),
  });
  box("expander.post", [455, -98, DISCH_TOP], [475, -88, EXP.z0], "lo");
  beam("beam-exp-in", [533, -84, OUT_Z], [EXP.x1, -84, OUT_Z]);
  const BTS_R = 10;                         // DERIVED: expanded beam in r 10 tubes inside the laser
  const F7 = { x0: 362, x1: 398, y0: -100, y1: -68, z0: OUT_Z - 17, z1: OUT_Z + 17 };
  box("fold-out", [F7.x0, F7.y0, F7.z0], [F7.x1, F7.y1, F7.z1], "mid", {
    extra: Dots([[366, F7.z1 - 4], [394, F7.z1 - 4]].map(([x, z]) => at([x, F7.y1, z])), { size: 0.42 }),
  });
  box("fold-out.post", [372, -98, DISCH_TOP], [388, -88, F7.z0], "lo");
  beam("beam-exp-out", [EXP.x0, -84, OUT_Z], [F7.x1, -84, OUT_Z], BTS_R);
  const [px, py, pz] = PORTS.laserOut.at;
  const TUR = { x0: px - 20, x1: px + 20, y0: py - 20, y1: py + 20, z0: OUT_Z - 17, z1: pz - 12 };
  box("turret", [TUR.x0, TUR.y0, TUR.z0], [TUR.x1, TUR.y1, TUR.z1], "mid", {
    inner: Ln(k.sideSeam({ x: TUR.x0, y: TUR.y0, w: 40, d: 40, r: 0.4 }, OUT_Z + 4, P, 3), { tone: "faint" }),
    extra: Dots([[TUR.x0 + 4, TUR.y0 + 4], [TUR.x1 - 4, TUR.y0 + 4], [TUR.x0 + 4, TUR.y1 - 4], [TUR.x1 - 4, TUR.y1 - 4]].map(([x, y]) => at([x, y, TUR.z1])), { size: 0.45 }),
  });
  box("turret.post", [px - 7, py - 6, DECK_TOP], [px + 7, py + 6, TUR.z0], "lo");
  beam("beam-turret", [px, F7.y1, OUT_Z], [px, TUR.y0, OUT_Z], BTS_R);
  // the output port: a flanged boss whose top face is PORTS.laserOut; the beam transport bolts on here
  L.turned("laser", upF(px, py, TUR.z1), [[0, 21], [12, 21]], { tone: "hi" }, { ...M, name: "laser.out-port" });
  ctx.shared.laserOut = { at: [px, py, pz], r: 21 };

  // ---------- seed module (HPSM): 2 seed lasers, pre-amplifier, seed isolation module ----------
  // [S36 slide 6] seed cabinet ~3.2 x 1.4 m front face, ESTIMATED. DERIVED: 4.2 m x 24 cm x 65 cm in front of
  // the frame, clear of the floor trench; seed tubes are sealed RF-pumped CO2 tubes [US8681427].
  const SEED = { x0: 140, x1: 560, y0: 146, y1: 170, z0: Z0, z1: Z0 + 65 };
  box("seed", [SEED.x0, SEED.y0, SEED.z0], [SEED.x1, SEED.y1, SEED.z1], "mid", {
    inner: Ln([200, 300, 420, 500].map((x) => k.segment([x, SEED.y1, SEED.z0], [x, SEED.y1, SEED.z1], P)).join(""), { tone: "faint" }),
    extra: Ln(slotsY(SEED.y1, 210, 290, SEED.z0 + 8, SEED.z0 + 14, 5) + slotsY(SEED.y1, 430, 490, SEED.z0 + 8, SEED.z0 + 14, 4), { tone: "lo" }),
  });
  const seedTube = (name, y) => {
    const F = G.frameOf([280, y, SEED.z1 + 6], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    for (const x of [300, 400]) box(`${name}.saddle`, [x - 4, y - 3, SEED.z1], [x + 4, y + 3, SEED.z1 + 1.2], "lo");
    L.turned("laser", F, [[0, 4.4], [4, 4.4], [4, 5], [156, 5], [156, 4.4], [160, 4.4]], { tone: "hi" }, { ...M, name: `laser.${name}` });
  };
  seedTube("seed-pp", 152.5);
  seedTube("seed-mp", 163.5);
  const SIM = { x0: 440, x1: 500 };
  box("sim", [SIM.x0, 147, SEED.z1], [SIM.x1, 169, SEED.z1 + 14], "mid", {
    extra: Ln(k.planOutline(k.insetPlan({ x: SIM.x0, y: 147, w: 60, d: 22, r: 0.4 }, 2.5), SEED.z1 + 14, P, 2), { tone: "faint" }),
  });
  box("preamp", [145, 147, SEED.z1], [235, 169, SEED.z1 + 20], "mid", {
    inner: Ln(k.sideSeam({ x: 145, y: 147, w: 90, d: 22, r: 0.4 }, SEED.z1 + 6, P, 3), { tone: "faint" }),
    extra: Ln(slotsY(169, 175, 230, SEED.z1 + 10, SEED.z1 + 16, 4), { tone: "lo" }),
  });

  // ---------- heat exchanger and cooling-water manifold ----------
  // [Cymer 2013] heat exchangers sit in the sub-fab; [Trumpf] HPAC has 3 cooling circuits. DERIVED: one water-water
  // heat exchanger at the -x end, a manifold bar, and a supply and a return line per PA blower section.
  const HX = { x0: 62, x1: 92, y0: -110, y1: 104, z0: Z0, z1: Z0 + 90 };
  box("hx", [HX.x0, HX.y0, HX.z0], [HX.x1, HX.y1, HX.z1], "mid", {
    inner: Ln(k.sideSeam({ x: HX.x0, y: HX.y0, w: 30, d: 214, r: 0.4 }, HX.z0 + 30, P, 3), { tone: "faint" }),
    extra: Ln(slotsY(HX.y1, HX.x0 + 3, HX.x1 - 3, HX.z0 + 8, HX.z0 + 22, 3), { tone: "lo" }),
  });
  L.turned("laser", upF(77, -70, HX.z1), [[0, 11], [3, 11], [3, 9], [20, 9], [22, 7]], { tone: "mid" }, { ...M, name: "laser.hx.pump" });
  const BAR = { x0: HX.x1, x1: 98, z0: -406, z1: -388 };
  box("hx.manifold", [BAR.x0, -104, BAR.z0], [BAR.x1, 104, BAR.z1], "mid");
  const WATER_Z = -396;
  PA_Y.forEach((yc, i) => {
    for (const [side, dy] of [["supply", -10], ["return", 10]]) {
      const line = L.pipe("laser", [[BAR.x1, yc + dy, WATER_Z], [BLOWER[0], yc + dy, WATER_Z]], 2.5, { ...M, name: `laser.pa${i}.water-${side}`, tone: "mid", valve: side === "supply" ? [0.55, 2.5] : null });
      if (side === "supply") L.valveOn("laser", line, 0.55, 2.5, { ...M });
    }
  });

  // ---------- RF generator, control and gas cabinets ----------
  // [S36 slide 5] 5 RF/electrical cabinets ~650 mm wide, >= 1.9 m high. DERIVED: 150 cm tall to fit the envelope;
  // one RF generator per PA plus one for the pre-amplifier; control and gas cabinets at the +x end of the row.
  const CAB_Y = [-170, -124];
  const CAB_TOP = Z0 + 150;
  const cabinet = (name, x0, x1) => {
    const [y0, y1] = CAB_Y;
    box(name, [x0, y0, Z0], [x1, y1, CAB_TOP], "mid", {
      inner: Ln(faceY(y1, x0 + 3, x1 - 3, Z0 + 4, CAB_TOP - 4), { tone: "faint" }),
      extra: Ln(slotsY(y1, x0 + 8, x1 - 8, Z0 + 10, Z0 + 14, 4) + slotsY(y1, x0 + 8, x1 - 8, CAB_TOP - 16, CAB_TOP - 12, 4), { tone: "lo" }),
    });
    box(`${name}.handle`, [x1 - 10, y1, Z0 + 70], [x1 - 7, y1 + 2.5, Z0 + 90], "lo");
    const plate = { x0: x0 + 10, x1: x0 + 30, z0: CAB_TOP - 40, z1: CAB_TOP - 28 };
    box(`${name}.label`, [plate.x0, y1, plate.z0], [plate.x1, y1 + 0.5, plate.z1], "lo", {
      extra: Ln([3, 6, 9].map((dz) => k.segment([plate.x0 + 2, y1 + 0.5, plate.z1 - dz], [plate.x1 - (dz === 9 ? 8 : 2), y1 + 0.5, plate.z1 - dz], P)).join(""), { tone: "lo", free: true }),
    });
  };
  const RF_X = [100, 165, 230, 295, 360, 425];
  for (let i = 0; i < 5; i++) cabinet(`rf${i}`, RF_X[i], RF_X[i + 1]);
  cabinet("control", 440, 505);
  cabinet("gas", 515, 580);

  // coax from each RF generator front gland over the PA tops to its matchbox (r 1, DERIVED)
  const COAX_Z = -330;
  const coax = (name, gx, ty, tz) => {
    const face = L.boss("laser", [gx, CAB_Y[1], COAX_Z], [0, 1, 0], 2.2, 3, { ...M, name: `laser.${name}.gland` });
    L.cable("laser", [face, [gx, ty, COAX_Z], [gx, ty, tz]], { ...M, name: `laser.${name}`, r: 1, bend: 18, tone: "mid" });
  };
  PA_Y.forEach((yc, i) => coax(`coax-pa${i}`, MATCH_X[i], yc - 7, DISCH_TOP + 14));

  // ---------- cable tray on the cabinet tops with the control harness ----------
  // DERIVED: 16 cm ladder tray on standoffs; one signal cable from the control cabinet to each RF generator,
  // in lanes, dropping through the perforated tray floor into each cabinet, clamped at cleat bars.
  const TRAY = { x0: 105, x1: 500, y0: -168, y1: -128, z0: CAB_TOP + 4 };
  for (const x of [130, 230, 330, 400, 470]) box("tray.standoff", [x - 3, -151, CAB_TOP], [x + 3, -145, TRAY.z0], "lo");
  box("tray", [TRAY.x0, TRAY.y0, TRAY.z0], [TRAY.x1, TRAY.y1, TRAY.z0 + 2], "lo", {
    extra: Dots([0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => k.dotGrid(TRAY.x0 + 12 + i * 48, TRAY.y0 + 4, 4, 2, 4, TRAY.z0 + 2, P)), { size: 0.4, tone: "lo" }),
  });
  const LANE_Z = TRAY.z0 + 8;
  const RUNG_X = [170, 300, 430];
  for (const x of RUNG_X) box("tray.rung", [x - 0.9, TRAY.y0 + 1.6, TRAY.z0 + 2], [x + 0.9, TRAY.y1 - 1.6, LANE_Z - 0.62 - 0.4], "lo");
  const LANES = [-155, -152.5, -150, -147.5, -145];
  const target = [132, 197, 262, 327, 392];
  const harnessFrom = [478, 474, 470, 466, 462];
  for (let i = 0; i < 5; i++) {
    const y = LANES[i];
    const start = [harnessFrom[i], y, TRAY.z0 + 2];
    const end = [target[i], y, TRAY.z0 + 2];
    const clamps = RUNG_X.filter((x) => x > target[i] + 8 && x < harnessFrom[i] - 8).map((x) => L.clampAt("laser", [x, y, LANE_Z], [1, 0, 0], 1.02, { ...M, name: "laser.harness.clamp", bundle: "laser.harness" }));
    L.cable("laser", [start, [harnessFrom[i], y, LANE_Z], [target[i], y, LANE_Z], end], { ...M, name: "laser.harness", bundle: "laser.harness", clamps, bend: 2.5, touch: ["laser.harness.clamp*"] });
  }
}
