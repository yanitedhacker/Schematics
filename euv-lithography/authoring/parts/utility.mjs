// Pumps, gas and power behind the scanner's back wall: two turbo-drag pumps on gate valves pumping the stage
// compartment and the source vessel, their backing lines dropping through the raised floor to the sub-fab dry
// pumps, the hydrogen gas cabinet with its regulator panel feeding the source, the electronics cabinet with the
// harness to the pumps and valves on a clamped tray, and the cooling-water manifold.
// Sources: research/layout.md 3.3-3.6 (H2 ~600-660 slm at 400-999 kPag, 1-10 Pa in the scanner, ~100 Pa at the
// collector, dry backing pumps and abatement in the sub-fab, 1.23-1.44 MW per installation); mechanics.md row 30.
// Everything solid stands at y <= -172: the frame leaves first along -y and its rear parts close in by up to
// 8.5 cm before this assembly's spring catches up (STAGGER/SPRING replay), so 9+ cm of air stays behind them.
import { k, G, A, RIB_FADE } from "../lib.mjs";

const PIECE = "utility";
const PY = -180;                 // pump axis line, behind the back wall line
const VAC_R = 8;                 // pipe bore radius at the pump ports (PORTS r)
const GATE_R = 6;                // DERIVED: valveOn size whose 1.45r end bore (8.7) covers the DN160 line
const TURBO = [[0, 13], [2.4, 13], [2.4, 10.5], [4, 10.5], [4, 11], [26, 11], [26, 10], [28, 10], [28, 7], [31, 7]];
// DERIVED: DN160 inlet (ISO-F flange 26 cm), 22 cm body, 31 cm long: a compound turbo-drag pump with ~1.5-2 m3/s for
// H2 that still runs at ~10 Pa inlet; at 5 Pa that removes ~8-10 Pa m3/s, ~5-6 slm, the stage compartment's purge share (assumed)
const FORE_R = 2.5;              // DERIVED: DN40 backing line; the pump's ~1 slm-class foreline flow needs nothing larger
const H2_R = 1.5;                // DERIVED: 600 slm at ~5 bar is ~2 l/s actual; a 2.5 cm bore keeps it under ~4 m/s

export function build(L, ctx) {
  const { P, PORTS } = ctx;
  const { at, Ln, Dots, Faded, boxOf, turned, pipe, valveOn, cable, clampAt, boss, padOn, screwsOn, path3, record, R } = L;
  const vert = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const box = (name, p0, p1, tone, options = {}) => boxOf(PIECE, p0, p1, { tone }, { name: `${PIECE}.${name}`, steps: 2, ...options });
  const shapeNamed = (name) => {
    const shape = R.solids.find((s) => s.name === name);
    if (!shape) throw new Error(`utility: no recorded shape ${name}`);
    return shape;
  };
  const alongNear = (line, p) => {
    let best = Infinity;
    let along = 0;
    let s = 0;
    for (let i = 0; i < line.length; i++) {
      if (i) s += G.len3(G.sub3(line[i], line[i - 1]));
      const d = G.len3(G.sub3(line[i], p));
      if (d < best) { best = d; along = s; }
    }
    return along;
  };
  const filletOf = (control, r) => G.fillet(control, Math.max(r * 2.6, 3), r > 3 ? 24 : 12, { P, tube: r });
  const faceSlots = (y, x0, x1, z0, z1, n) => {
    const w = (x1 - x0) / n;
    return Array.from({ length: n }, (_, i) => path3([[x0 + i * w + w * 0.3, y, z0], [x0 + i * w + w * 0.7, y, z0], [x0 + i * w + w * 0.7, y, z1], [x0 + i * w + w * 0.3, y, z1]], true)).join("");
  };
  const rect = (y, x0, x1, z0, z1) => path3([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true);

  // the ports belong to the stage compartment and the source vessel; built alone, stand-ins hold the pipe ends
  if (ctx.solo)
    for (const port of [PORTS.pumpStages, PORTS.pumpSource, PORTS.h2Supply])
      record({ ...A.disc(G.frameAlong(port.at, port.normal), -2, 0, port.r * 2.2, { name: "stand.stub-port" }), ground: true });

  // ---- a pump train: port -> spool -> gate valve -> turbo-drag pump on its stand; foreline down to the floor ----
  const train = (key, port, inletX, valveX) => {
    const [px, , pz] = port.at;
    // a vacuum cross turns the line: flat flanged faces instead of a bend seen edge-on
    const CX = 15;   // DERIVED: 30 cm DN160 cross body so the 12.4 flanges seat inside its faces
    const cross = { x: px - CX, y: PY - CX, w: 2 * CX, d: 2 * CX, r: 1 };
    L.slab(PIECE, cross, pz - CX, 2 * CX, { tone: "mid" }, { name: `${PIECE}.cross-${key}`, steps: 2, bevel: 0.5 });
    const top = boss(PIECE, [px, PY, pz + CX], [0, 0, 1], 11, 1.6, { name: `${PIECE}.cross-blank-${key}`, ring: false });
    L.put(PIECE, top, Dots(G.dotsOf(G.frameAlong(top, [0, 0, 1]), 0, 9, 8, P, { all: true }), { size: 0.4 }), { name: `${PIECE}.cross-bolts-${key}`, shapes: [A.disc(G.frameAlong(top, [0, 0, 1]), 0, 0.05, 9.4, { name: `${PIECE}.cross-bolts-${key}` })] });
    pipe(PIECE, [port.at, [px, PY + CX, pz]], VAC_R, { name: `${PIECE}.vac-${key}`, free: [true, false], flangeR: [Math.min(1.55, (port.r || VAC_R * 1.55) / VAC_R), 1.55] });   // the end flange matches the port flange it bolts to
    const control = [[px - CX, PY, pz], [inletX, PY, pz]];
    const total = px - CX - inletX;
    const along = total - (valveX - inletX);
    const run = pipe(PIECE, control, VAC_R, { name: `${PIECE}.spool-${key}`, flangeR: [1.55, 13 / VAC_R], valve: [along, GATE_R] });
    const valve = valveOn(PIECE, run, along, GATE_R, { name: `${PIECE}.gate-${key}` });

    // turbo-drag pump, inlet face on the pipe's end flange, axis along -x
    const F = G.frameAlong([inletX, PY, pz], [-1, 0, 0]);
    const ribs = G.ribsOf(F, 6, 24, 11, 44, P, { fade: RIB_FADE, seams: true });
    const turbo = turned(PIECE, F, TURBO, { tone: "hi" }, { name: `${PIECE}.turbo-${key}`, extra: Faded(ribs, { tone: "lo" }), inner: G.arcOf(F, 4, 11, P) + G.arcOf(F, 26, 11, P) });
    const rearX = inletX - TURBO[TURBO.length - 1][0];

    // stand: base plate, column, saddle tangent to the body
    const midX = inletX - 15;
    const bodyBottom = pz - 11;
    box(`turbo-stand-plate`, [midX - 10, PY - 10, 0], [midX + 10, PY + 8, 3], "lo", { extra: screwsOn([[midX - 7, PY - 7], [midX + 7, PY + 5]], 3, { ring: 0.8, size: 0.38 }) });
    box(`turbo-stand`, [midX - 4, PY - 4, 3], [midX + 4, PY + 4, bodyBottom - 4], "mid");
    box(`turbo-saddle`, [midX - 8, PY - 8, bodyBottom - 4], [midX + 8, PY + 6, bodyBottom], "mid");

    // backing line from the rear face to a floor penetration flange (the dry pump is in the sub-fab)
    const foreX = rearX - 13;
    const floor = boss(PIECE, [foreX, PY, 0], [0, 0, 1], 6.5, 2, { name: `${PIECE}.floor-flange` });
    pipe(PIECE, [[rearX, PY, pz], [foreX, PY, pz], floor], FORE_R, { name: `${PIECE}.foreline-${key}`, bands: [0.62], bellows: [0.25, 0.38, 6] });

    // gauge head under the valve body on a saddle pad: every pumped volume reads its own pressure
    const vbody = shapeNamed(`${PIECE}.gate-${key}`);
    const crown = GATE_R * 1.85 * 1.08;
    const face = padOn(PIECE, vbody, [valveX, PY, pz - crown + 0.6], [0, 0, -1], 2.2, 1.8, { name: `${PIECE}.gauge-pad-${key}` });
    const GF = G.frameAlong(face, [0, 0, -1]);
    const gauge = [[0, 1.8], [3, 1.8], [3, 3.4], [9, 3.4, 1], [10, 2.6, 1], [10.6, 1.2]];
    turned(PIECE, GF, gauge, { tone: "mid" }, { name: `${PIECE}.gauge-${key}`, inner: G.arcOf(GF, 5.5, 3.4, P) });
    const gaugeTip = G.add3(face, [0, 0, -10.6]);

    // pump controller on the floor below the valve
    const CTRL = { x0: valveX - 14, x1: valveX + 8, y0: -198, y1: PY + 6, z1: 60 };
    box(`controller-${key}`, [CTRL.x0, CTRL.y0, 0], [CTRL.x1, CTRL.y1, CTRL.z1], "mid", {
      extra: Ln(rect(CTRL.y1, CTRL.x0 + 2, CTRL.x1 - 2, 4, CTRL.z1 - 4) + faceSlots(CTRL.y1, CTRL.x0 + 4, CTRL.x1 - 4, 8, 20, 6), { tone: "faint" }),
    });
    cable(PIECE, [gaugeTip, [valveX, PY, CTRL.z1]], { name: `${PIECE}.gauge-cable-${key}` });
    return { valve, CTRL, turbo };
  };

  const STG = train("stages", PORTS.pumpStages, 40, 62);
  const SRC = train("source", PORTS.pumpSource, 350, 375);

  // ---- electronics cabinet: plinth, two doors with closed vent slots, handles, label plate, cable glands ----
  const EC = { x0: 130, x1: 210, y0: -198, y1: -172, z1: 236 };   // DERIVED: 80 x 26 x 236 cm, a double 19-inch rack for pump, valve and gauge drives
  box("cabinet-plinth", [EC.x0 + 2, EC.y0 + 2, 0], [EC.x1 - 2, EC.y1 - 2, 6], "lo");
  {
    const y = EC.y1;
    const xm = (EC.x0 + EC.x1) / 2;
    const doors = rect(y, EC.x0 + 1.6, xm - 0.6, 8, EC.z1 - 2) + rect(y, xm + 0.6, EC.x1 - 1.6, 8, EC.z1 - 2);
    const vents = [[EC.x0 + 6, xm - 5], [xm + 5, EC.x1 - 6]].flatMap(([a, b]) => [faceSlots(y, a, b, 14, 30, 9), faceSlots(y, a, b, 208, 224, 9)]).join("");
    box("cabinet", [EC.x0, EC.y0, 6], [EC.x1, EC.y1, EC.z1], "mid", { inner: Ln(k.sideSeam({ x: EC.x0, y: EC.y0, w: EC.x1 - EC.x0, d: EC.y1 - EC.y0, r: 0.4 }, EC.z1 - 6, P, 2), { tone: "faint" }), extra: Ln(doors + vents, { tone: "faint" }) });
    for (const x of [xm - 4, xm + 2.6]) box("cabinet-handle", [x, y, 116], [x + 1.4, y + 1.4, 136], "hi");
    const lx0 = EC.x0 + 12;
    const lx1 = lx0 + 22;
    const ly = y + 0.5;
    const rules = [[lx0 + 2, lx1 - 2, 186], [lx0 + 2, lx1 - 7, 183], [lx0 + 2, lx1 - 11, 180]].map(([a, b, z]) => k.segment([a, ly, z], [b, ly, z], P)).join("");
    box("cabinet-label", [lx0, y, 177], [lx1, ly, 189], "hi", { extra: Ln(rules, { tone: "lo", free: true }) + Dots([at([lx0 + 1.4, ly, 187.6]), at([lx1 - 1.4, ly, 178.4])], { size: 0.32 }) });
  }

  // ---- hydrogen gas cabinet with its regulator panel and exhaust cap ----
  const GC = { x0: 236, x1: 290, y0: -198, y1: -172, z1: 210 };   // DERIVED: 54 x 26 x 210 cm, a single-line gas valve-manifold box (fab bulk supply, no cylinders)
  box("gas-plinth", [GC.x0 + 2, GC.y0 + 2, 0], [GC.x1 - 2, GC.y1 - 2, 6], "lo");
  box("gas-cabinet", [GC.x0, GC.y0, 6], [GC.x1, GC.y1, GC.z1], "mid", { extra: Ln(rect(GC.y1, GC.x0 + 1.6, GC.x1 - 1.6, 8, GC.z1 - 2) + rect(GC.y1, GC.x0 + 10, GC.x1 - 10, 60, 120) + faceSlots(GC.y1, GC.x0 + 6, GC.x1 - 6, 14, 28, 7), { tone: "faint" }) });
  const PANEL = { x0: GC.x0 + 6, x1: GC.x1 - 6, y: GC.y1 + 1.6, z0: 148, z1: 202 };
  box("regulator-panel", [PANEL.x0, GC.y1, PANEL.z0], [PANEL.x1, PANEL.y, PANEL.z1], "lo", { extra: Dots([[PANEL.x0 + 1.6, PANEL.z0 + 1.6], [PANEL.x1 - 1.6, PANEL.z0 + 1.6], [PANEL.x0 + 1.6, PANEL.z1 - 1.6], [PANEL.x1 - 1.6, PANEL.z1 - 1.6]].map(([x, z]) => at([x, PANEL.y, z])), { size: 0.38 }) });
  for (const x of [PANEL.x0 + 9, PANEL.x0 + 22]) {
    // pressure gauge: dial on the panel, ticks between two rings, needle from the hub
    const F = G.frameAlong([x, PANEL.y, 186], [0, 1, 0]);
    const ticks = G.spokesOf(F, 2, 3, 3.7, 12, P, { from: -2.4, to: 2.4 });
    const needle = k.segment(G.pointOf(F, 2, 0, 0), G.pointOf(F, 2, 2.6, 0.7), P);
    turned(PIECE, F, [[0, 4.2], [2, 4.2]], { tone: "hi" }, { name: `${PIECE}.h2-gauge`, extra: Ln(G.circleOf(F, 2, 3, P, 28) + G.circleOf(F, 2, 3.7, P, 28) + ticks, { tone: "lo" }) + Ln(needle, { tone: "hi", free: "end" }) + Dots([at(G.pointOf(F, 2, 0, 0))], { size: 0.45, tone: "hi" }) });
    // pressure regulator below it: body, bonnet, hand knob
    const RF = G.frameAlong([x, PANEL.y, 164], [0, 1, 0]);
    turned(PIECE, RF, [[0, 3], [4, 3], [4, 1.8], [6.4, 1.8], [6.4, 2.6], [9, 2.6]], { tone: "mid" }, { name: `${PIECE}.h2-regulator`, extra: Ln(G.circleOf(RF, 9, 1.4, P, 16), { tone: "faint" }) });
  }
  const outlet = boss(PIECE, [PANEL.x1 - 4, PANEL.y, 196], [0, 1, 0], 3.2, 2, { name: `${PIECE}.h2-outlet` });
  {
    const [hx, hy, hz] = PORTS.h2Supply.at;
    const control = [outlet, [outlet[0], hy - 22, hz], [hx, hy - 22, hz], PORTS.h2Supply.at].map((p) => [p[0], p[1], hz]);
    const line = filletOf(control, H2_R);
    const along = alongNear(line, [(outlet[0] + hx) / 2, hy - 22, hz]);
    const run = pipe(PIECE, control, H2_R, { name: `${PIECE}.h2-line`, flangeR: [2, 2], valve: [along, 1.6], free: [false, true] });
    valveOn(PIECE, run, along, 1.6, { name: `${PIECE}.h2-valve` });
  }
  {
    const F = vert(GC.x1 - 15, GC.y0 + 7.5, GC.z1);
    turned(PIECE, F, [[0, 4.5], [10, 4.5], [10, 7], [12, 7], [12, 5.6], [13.4, 5.6], [13.4, 0]], { tone: "mid" }, { name: `${PIECE}.gas-exhaust` });
  }

  // ---- cooling-water manifold: two feeds up through the floor, two lines with valves into the cabinet ----
  const MF = { x0: 82, x1: 124, y0: -194, y1: -180, z0: 40, z1: 50 };   // DERIVED: process cooling water for the turbo and drive electronics (~2-3 kW here), 1-inch lines
  for (const x of [MF.x0 + 3, MF.x1 - 7]) box("manifold-leg", [x, MF.y0 + 3, 0], [x + 4, MF.y1 - 3, MF.z0], "lo");
  box("manifold", [MF.x0, MF.y0, MF.z0], [MF.x1, MF.y1, MF.z1], "hi", { extra: screwsOn([[MF.x0 + 2, MF.y0 + 2], [MF.x1 - 2, MF.y1 - 2]], MF.z1, { ring: 0.7, size: 0.35 }) });
  const WR = 2;
  for (const x of [94, 112]) {
    const floor = boss(PIECE, [x, -187, 0], [0, 0, 1], 4.4, 1.6, { name: `${PIECE}.floor-flange` });
    const along = (MF.z0 - floor[2]) / 2;
    const run = pipe(PIECE, [[x, -187, MF.z0], floor], WR, { name: `${PIECE}.water-feed`, valve: [along, 2.1] });
    valveOn(PIECE, run, along, 2.1, { name: `${PIECE}.water-valve`, side: [0, 1, 0] });
  }
  for (const [x, y, z] of [[98, -190, 92], [110, -184, 78]]) {
    const control = [[x, y, MF.z1], [x, y, z], [EC.x0, y, z]];
    const along = (z - MF.z1) * 0.45;
    const run = pipe(PIECE, control, WR, { name: `${PIECE}.water-line`, valve: [along, 2.1] });
    valveOn(PIECE, run, along, 2.1, { name: `${PIECE}.water-valve`, side: [0, 1, 0] });
  }

  // ---- cable tray off the cabinet's -x face, on a post; the harness runs in lanes on clamps ----
  const TR = { x0: 72, x1: EC.x0, y0: -196, y1: -172, z0: 226, t: 1 };
  box("tray-post-plate", [TR.x0 - 1, -200, 0], [TR.x0 + 9, -190, 2], "lo");
  box("tray-post", [TR.x0, -198, 2], [TR.x0 + 6, -192, TR.z0], "mid");
  box("tray", [TR.x0, TR.y0, TR.z0], [TR.x1, TR.y1, TR.z0 + TR.t], "mid");
  box("tray-lip", [TR.x0, TR.y0, TR.z0 + TR.t], [TR.x1, TR.y0 + 0.8, TR.z0 + 5], "mid");
  box("tray-lip", [TR.x0, TR.y1 - 0.8, TR.z0 + TR.t], [TR.x1, TR.y1, TR.z0 + 5], "mid");
  const CR = 1.4;
  const lane = TR.z0 + TR.t + CR;
  const gland = (x, y, z, dir) => boss(PIECE, [x, y, z], dir, 1.3, 2, { name: `${PIECE}.gland` });
  const laneClamps = (y, bundle) => [86, 112].map((x) => clampAt(PIECE, [x, y, lane], [1, 0, 0], CR, { name: `${PIECE}.tray-clamp`, bundle }));
  // A: to the stage gate valve's actuator lid
  {
    const y = PY;
    const start = gland(EC.x0, y, lane, [-1, 0, 0]);
    cable(PIECE, [start, [62, y, lane], STG.valve.port], { name: `${PIECE}.harness`, bundle: `${PIECE}.lane-a`, clamps: laneClamps(y, `${PIECE}.lane-a`), touch: [`${PIECE}.tray-clamp*`] });
  }
  // B: to the stage pump controller
  {
    const y = -192;
    const x = STG.CTRL.x0 + 7;
    const start = gland(EC.x0, y, lane, [-1, 0, 0]);
    cable(PIECE, [start, [x, y, lane], [x, y, STG.CTRL.z1]], { name: `${PIECE}.harness`, bundle: `${PIECE}.lane-b`, clamps: laneClamps(y, `${PIECE}.lane-b`), touch: [`${PIECE}.tray-clamp*`] });
  }
  // C: cabinet to gas cabinet interlock
  {
    const a = gland(EC.x1, -188, 200, [1, 0, 0]);
    const b = gland(GC.x0, -188, 200, [-1, 0, 0]);
    cable(PIECE, [a, b], { name: `${PIECE}.interlock` });
  }
  // D: over the gas cabinet top on clamps to the source gate valve's lid
  {
    const z = GC.z1 + CR;
    const a = gland(EC.x1, PY, z, [1, 0, 0]);
    const clamps = [GC.x0 + 12, GC.x0 + 28].map((x) => clampAt(PIECE, [x, PY, z], [1, 0, 0], CR, { name: `${PIECE}.top-clamp`, bundle: `${PIECE}.lane-d` }));
    cable(PIECE, [a, [375, PY, z], SRC.valve.port], { name: `${PIECE}.harness`, bundle: `${PIECE}.lane-d`, clamps, touch: [`${PIECE}.top-clamp*`] });
  }
  // E: gas cabinet to the source pump controller
  {
    const a = gland(GC.x1, -192, 40, [1, 0, 0]);
    const b = gland(SRC.CTRL.x0, -192, 40, [-1, 0, 0]);
    cable(PIECE, [a, b], { name: `${PIECE}.harness` });
  }
}
