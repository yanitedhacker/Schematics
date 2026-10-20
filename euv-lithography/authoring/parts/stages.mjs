// Twin wafer stages in the vacuum stage compartment: a base plate on airmounts, the floating Halbach magnet plate
// (the balance mass), and two moving-coil planar movers, each carrying a 6-DOF Lorentz short stroke, an
// interferometer mirror block, the electrostatic burl clamp with its wafer, E-pin drives and a TIS/ILIAS fiducial
// plate. Interferometer heads on posts read the mirror blocks; a cable slab and shuttle feed each mover.
// Sources: research/mechanics.md Part A (Heertjes 2020, Butler 2013, Hurk 2020, Steur 2017, Jansen thesis).
import { k, G, A } from "../lib.mjs";

const PIECE = "stages";

// z-stack, world cm, as heights above the base frame top (MOUNTS.baseTop); the wafer top lands on OPTIC.wafer[2].
const ZH = {
  base: 0,           // MOUNTS.baseTop
  plate0: 9,        // compartment base plate bottom, on the airmounts
  plate1: 14,        // DERIVED: 5 cm steel deck spans 143 cm between airmounts at < 0.1 mm sag under ~2 t
  magnet0: 16,       // magnet plate bearings 32..34
  magnet1: 20,       // DERIVED: 4 cm plate ~730 kg; with the two movers swapping in opposite directions the momenta cancel, so recoil stays mm-scale
    mover1: 28,        // DERIVED: 8 cm coil block (coil layer + cooling plate + carbon-fibre frame)
  ss0: 29.5,         // Lorentz actuator pucks 46..47.5
  ss1: 33.5,
  mirror1: 40.5,     // DERIVED: 7 cm mirror faces carry three stacked beams (x, Rx/Ry pairs) at ~1.5 cm pitch, 0.6 cm beams
  table1: 43,
  clamp1: 45.92,
  wafer1: 46,
};
const GAP = 0.1;         // levitation gap ~1 mm, UNVERIFIED; DERIVED: typical for moving-coil maglev planar motors
const WAFER_R = 15;      // 300 mm wafer [svmi SV030]
const CLAMP_R = 16;      // DERIVED: 1 cm rim outside the wafer for the peripheral back-fill gas seal [Steur] and burl run-out
const TABLE_R = 11;      // DERIVED: clamp support disc; the overhang leaves room for the E-pin drives under the clamp
const HALF_Y = 17;       // DERIVED: chucks pass at y +-18 (36 apart), so every rigid body of a chuck group stays within |dy| <= 17
const MOVER = { dx0: -30, dx1: 30 };   // DERIVED: ~80 kg mover at 4 g needs ~3.1 kN; at ~5 N/cm2 (0.5 T Halbach, 10 A/mm2, 1 cm coils) that is ~620 cm2 of coil, 60 x 34 leaves margin for levitation (~0.8 kN) and duty cycle
const CABLE_DX = -22;    // DERIVED: cable exit offset along x so the slab clears the y interferometer posts at the chuck centres

export function build(L, ctx) {
  const { P, MOUNTS, OPTIC, MEASURE, PORTS } = ctx;
  const BZ = MOUNTS.baseTop.z;
  const z = (h) => BZ + h;   // height above the base frame top
  const Z = Object.fromEntries(Object.entries(ZH).map(([key, h]) => [key, z(h)]));
  if (Math.abs(Z.wafer1 - OPTIC.wafer[2]) > 1e-9 || Math.abs(Z.wafer1 - MEASURE[2]) > 1e-9) throw new Error(`stages: wafer top ${Z.wafer1} != OPTIC.wafer z ${OPTIC.wafer[2]}`);
  const { S, put, record, at, Ln, Dots, slab, boxOf, turned, band, cable, clampAt, screwsOn, path3, live } = L;
  const vert = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const seam = (plan, z, steps = 3) => k.sideSeam(plan, z, P, steps);

  if (ctx.solo) L.record({ ...A.slab(MOUNTS.baseTop.plan, Z.base - 1, 1, { name: "stand.stub" }), ground: true });

  // ---- base plate on six airmounts ----
  const BASE = { x: -60, y: -140, w: 318, d: 275, r: 2 };
  const SPLIT = -2.5;   // deck and magnet plate are cut here into segments either side of the page's beam-plane layer split (y = -2)
  // DERIVED: six airmounts, so no deck span exceeds ~145 cm; positions under the deck's stiff edges
  for (const x of [-44, 99, 242]) for (const y of [-124, 122]) {
    const F = vert(x, y, Z.base);
    band(PIECE, F, 0, 1.5, 7, { tone: "lo" }, { name: `${PIECE}.airmount-foot` });
    turned(PIECE, F, [[1.5, 5.5], [7.5, 5.5]], { tone: "mid" }, { name: `${PIECE}.airmount-can`, inner: G.arcOf(F, 4.5, 5.5, P) });
    band(PIECE, F, 7.5, Z.plate0 - Z.base, 6, { tone: "mid" }, { name: `${PIECE}.airmount-piston` });
  }
  const baseScrews = [[-56, -110], [-56, 132], [254, -110], [254, 132], [100, 132], [180, 132], [-56, -5], [254, -5], [-56, 0], [254, 0]];
  for (const [y0, y1] of [[BASE.y, SPLIT], [SPLIT, BASE.y + BASE.d]]) {
    const plan = { x: BASE.x, y: y0, w: BASE.w, d: y1 - y0, r: 0.4 };
    slab(PIECE, plan, Z.plate0, Z.plate1 - Z.plate0, { tone: "lo" }, { name: `${PIECE}.base-plate`, steps: 2, inner: Ln(seam(plan, z(11.5), 2), { tone: "faint" }), extra: screwsOn(baseScrews.filter(([, y]) => y > y0 && y < y1), Z.plate1) });
  }

  // ---- back wall of the stage compartment with the pump port (PORTS.pumpStages on its -y face) ----
  const WALL = { x: -60, y: -140, w: 318, d: 4, r: 0.4 };
  const PS = PORTS.pumpStages.at;
  const port = [PS[0], WALL.y + WALL.d, PS[2]];   // grille on the visible face, the port face itself is the wall's -y face
  const PF = G.frameOf(port, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const grille = [];
  for (let dz = -5; dz <= 5; dz += 2.5) {
    const hw = Math.sqrt(7 * 7 - dz * dz) - 1.2;
    grille.push(path3([[port[0] - hw, port[1], port[2] + dz - 0.6], [port[0] + hw, port[1], port[2] + dz - 0.6], [port[0] + hw, port[1], port[2] + dz + 0.6], [port[0] - hw, port[1], port[2] + dz + 0.6]], true));
  }
  const ribs = [-20, 20, 60, 140, 180, 220].map((x) => k.segment([x, -136, Z.plate1], [x, -136, z(52)], P));
  slab(PIECE, WALL, Z.plate1, z(52) - Z.plate1, { tone: "mid" }, {
    name: `${PIECE}.back-wall`, steps: 2,
    inner: Ln(ribs.join("") + seam(WALL, z(48), 2), { tone: "faint" }),
    extra: Ln(G.circleOf(PF, 0, 8, P, 48), { tone: "lo" }) + Ln(grille.join(""), { tone: "faint" }) + screwsOn([[-50, -138], [100, -138], [248, -138]], z(52), { ring: 0.9 }),
  });

  // ---- magnet plate bearings and the Halbach magnet plate (balance mass) ----
  for (const x of [-46, 6, 58, 110, 162]) for (const y of [-48, 42]) band(PIECE, vert(x, y, Z.plate1), 0, Z.magnet0 - Z.plate1, 2.6, { tone: "mid" }, { name: `${PIECE}.magnet-bearing` });
  // DERIVED: plate covers both chuck positions (x -10 and 110) plus the mover half-length 30 and +-15 field steps, and the +-18 swap lanes plus 17 + 15 in y
  // Built as two segments joined at y = SPLIT (a tile boundary): the page paints items behind the beam plane (y < -2) in a
  // layer under the shader, so a slab straddling it would cover everything standing on its far half.
  const MAG = { x: -53.5, y: -56, w: 223.5, d: 106, r: 1.5 };
  const PITCH = 5.5;   // magnet pitch UNVERIFIED; DERIVED: ~5 cm pole pitch is typical for planar motors at this force density (Jansen thesis prototypes)
  for (const [y0, y1, rows] of [[MAG.y, SPLIT, [0, 9]], [SPLIT, MAG.y + MAG.d, [9, 18]]]) {
    const plan = { x: MAG.x, y: y0, w: MAG.w, d: y1 - y0, r: 0.4 };
    const tiles = [];
    for (let i = 0; i < 40; i++) for (let j = rows[0]; j < rows[1]; j++) {
      const x = -51.5 + i * PITCH;
      const y = SPLIT + (j - 9) * PITCH;
      tiles.push(k.planOutline({ x: x + 0.35, y: y + 0.35, w: PITCH - 0.7, d: PITCH - 0.7, r: 0.2 }, Z.magnet1, P, 1));
      // Halbach: main poles (inner square) alternate with the side magnets that turn the field
      if ((i + j) % 2 === 0) tiles.push(k.planOutline({ x: x + 1.7, y: y + 1.7, w: PITCH - 3.4, d: PITCH - 3.4, r: 0.1 }, Z.magnet1, P, 1));
    }
    const sy = y0 < SPLIT ? y0 + 1.5 : y1 - 1.5;
    slab(PIECE, plan, Z.magnet0, Z.magnet1 - Z.magnet0, { tone: "mid" }, {
      name: `${PIECE}.magnet-plate`, steps: 2, bevel: 0.5,
      inner: Ln(seam(plan, z(18), 2), { tone: "faint" }),
      extra: Ln(tiles.join(""), { tone: "faint" }) + screwsOn([[-52, sy], [60, sy], [168.5, sy]], Z.magnet1, { ring: 0.6, size: 0.35 }),
    });
  }

  // balance-mass anti-drift actuators: the plate recoils freely during a move and is re-centred slowly between moves
  // DERIVED: a free balance mass drifts with every imbalance of the two movers' momenta, so it needs weak x/y centring motors
  for (const [x0, x1] of [[MAG.x - 5, MAG.x], [MAG.x + MAG.w, MAG.x + MAG.w + 5]]) for (const y of [-34, 26]) {
    boxOf(PIECE, [x0, y, Z.plate1], [x1, y + 8, Z.magnet1 - 0.6], { tone: "mid" }, { name: `${PIECE}.drift-motor`, steps: 1, inner: Ln(k.sideSeam({ x: x0, y, w: x1 - x0, d: 8, r: 0.4 }, Z.plate1 + 2.4, P, 1), { tone: "faint" }), extra: screwsOn([[(x0 + x1) / 2, y + 1.5], [(x0 + x1) / 2, y + 6.5]], Z.magnet1 - 0.6, { ring: 0.5, size: 0.3 }) });
  }

  // interferometer laser source and fibre splitter on the deck; DERIVED: one stabilised source feeds all heads by fibre
  const LS = { x: 192, y: -72, w: 48, d: 28, r: 1 };
  const vents = [];
  for (let i = 0; i < 7; i++) vents.push(path3([[LS.x + 6 + i * 5, LS.y + LS.d, Z.plate1 + 3], [LS.x + 8.4 + i * 5, LS.y + LS.d, Z.plate1 + 3], [LS.x + 8.4 + i * 5, LS.y + LS.d, Z.plate1 + 9], [LS.x + 6 + i * 5, LS.y + LS.d, Z.plate1 + 9]], true));
  slab(PIECE, LS, Z.plate1, 12, { tone: "mid" }, { name: `${PIECE}.laser-source`, steps: 3, bevel: 0.5, inner: Ln(seam(LS, Z.plate1 + 10.5), { tone: "faint" }), extra: Ln(vents.join(""), { tone: "lo" }) + Ln(k.planOutline(k.insetPlan(LS, 3), Z.plate1 + 12, P, 3), { tone: "faint" }) + screwsOn(k.corners(LS, 1.6), Z.plate1 + 12, { ring: 0.6, size: 0.35 }) });

  // vacuum gauge on the compartment wall
  const GF = G.frameOf([170, -136, z(30)], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  turned(PIECE, GF, [[0, 3.2], [1.2, 3.2], [1.2, 1.6], [3.6, 1.6], [3.6, 3.4], [9, 3.4]], { tone: "mid" }, { name: `${PIECE}.vacuum-gauge`, extra: Ln(G.circleOf(GF, 9, 2, P, 24), { tone: "faint" }) + Dots(G.dotsOf(GF, 1.2, 2.5, 4, P, { all: true }), { size: 0.3 }) });

  // ---- shuttle beds (static) ----
  for (const side of [1, -1]) {
    const BED = { x: -56, y: side > 0 ? 87 : -136, w: 180, d: 48, r: 1 };
    const groove = k.planOutline(k.insetPlan(BED, 3), Z.plate1 + 3, P, 2);
    slab(PIECE, BED, Z.plate1, 3, { tone: "lo" }, { name: `${PIECE}.slab-bed`, steps: 2, extra: Ln(groove, { tone: "faint" }) + screwsOn([[BED.x + 1.5, BED.y + 1.5], [BED.x + 1.5, BED.y + BED.d - 1.5], [BED.x + BED.w - 1.5, BED.y + 1.5], [BED.x + BED.w - 1.5, BED.y + BED.d - 1.5]], Z.plate1 + 3, { ring: 0.6, size: 0.35 }) });
    for (const x of [BED.x + 1, BED.x + BED.w - 5]) boxOf(PIECE, [x, BED.y + 6, Z.plate1 + 3], [x + 4, BED.y + BED.d - 6, Z.plate1 + 6], { tone: "mid" }, { name: `${PIECE}.slab-stop`, extra: screwsOn([[x + 2, BED.y + 9], [x + 2, BED.y + BED.d - 9]], Z.plate1 + 6, { ring: 0.6, size: 0.35 }) });
  }

  // ---- interferometer heads on posts, aimed at the mirror blocks ----
  // NXE wafer stages are read by interferometers off the mirror block [Heertjes 2020; euvlitho 2023 P62]; axis count UNVERIFIED
  const HEAD_Z = z(37);   // DERIVED: beam height at the middle of the mirror faces
  const head = (x, y, aim) => {
    const F = vert(x, y, Z.plate1);
    band(PIECE, F, 0, 1.2, 2.8, { tone: "lo" }, { name: `${PIECE}.ifm-collar`, extra: "" });
    turned(PIECE, F, [[1.2, 1.6], [HEAD_Z - 5 - Z.plate1, 1.6]], { tone: "mid" }, { name: `${PIECE}.ifm-post`, inner: G.arcOf(F, 9, 1.6, P) });
    const along = aim[0] !== 0;
    const half = along ? [3, 3.5] : [3.5, 3];
    const lo = [x - half[0], y - half[1], HEAD_Z - 5];
    const hi = [x + half[0], y + half[1], HEAD_Z + 5];
    const box = { x: lo[0], y: lo[1], w: hi[0] - lo[0], d: hi[1] - lo[1], r: 0.4 };
    boxOf(PIECE, lo, hi, { tone: "mid" }, { name: `${PIECE}.ifm-head`, steps: 2, inner: Ln(seam(box, HEAD_Z + 3, 2), { tone: "faint" }), extra: screwsOn([[x - half[0] + 1, y - half[1] + 1], [x + half[0] - 1, y + half[1] - 1]], HEAD_Z + 5, { ring: 0.5, size: 0.3 }) });
    const face = [x + aim[0] * half[0], y + aim[1] * half[1], HEAD_Z];
    const LF = G.frameAlong(face, aim);
    turned(PIECE, LF, [[0, 1.8], [2, 1.8], [2, 1.2], [3, 1.2]], { tone: "hi" }, { name: `${PIECE}.ifm-optic`, extra: G.dot3(LF.a, L.V) > 0.12 ? Ln(G.circleOf(LF, 3, 0.7, P, 16), { tone: "lo" }) : "" });
    // fibre to a connector block on the deck, from the side face that is not the optic
    const d = along ? [0, 1, 0] : [1, 0, 0];
    const hw = along ? half[1] : half[0];
    const c0 = [x + d[0] * hw, y + d[1] * hw, HEAD_Z + 1];
    const c1 = [x + d[0] * (hw + 5), y + d[1] * (hw + 5), HEAD_Z + 1];
    const cb = [x + d[0] * (hw + 5), y + d[1] * (hw + 5)];
    boxOf(PIECE, [cb[0] - 1.4, cb[1] - 1.4, Z.plate1], [cb[0] + 1.4, cb[1] + 1.4, Z.plate1 + 2], { tone: "mid" }, { name: `${PIECE}.ifm-connector`, steps: 2 });
    cable(PIECE, [c0, c1, [cb[0], cb[1], Z.plate1 + 2]], { r: 0.45, bend: 3, name: `${PIECE}.ifm-fibre`, tone: "mid" });
  };
  head(248, 0, [-1, 0, 0]);                  // x axis, exposure chuck +x mirror face
  head(-57, 0, [1, 0, 0]);                   // x axis, measure chuck -x mirror face
  head(OPTIC.wafer[0], -80, [0, 1, 0]);      // y axis, exposure chuck -y mirror face
  head(MEASURE[0], -80, [0, 1, 0]);          // y axis, measure chuck -y mirror face

  // ---- the two chuck groups ----
  const chuck = (id, cx, side) => live(id, () => {
    const nm = (part) => `${PIECE}.live-${id}.${part}`;
    const cy = 0;
    const ys = (y) => side * y;
    const yr = (a, b) => (side > 0 ? [a, b] : [-b, -a]);

    // long stroke: moving-coil planar mover over the magnet plate
    const MV = { x: cx + MOVER.dx0, y: -HALF_Y, w: MOVER.dx1 - MOVER.dx0, d: 2 * HALF_Y, r: 1.2 };
    const m0 = Z.magnet1 + GAP;
    const joints = [cx - 10, cx + 10].map((x) => k.segment([x, HALF_Y, m0], [x, HALF_Y, Z.mover1], P)).join("") + [-6, 6].map((y) => k.segment([cx + MOVER.dx1, y, m0], [cx + MOVER.dx1, y, Z.mover1], P)).join("");
    slab(PIECE, MV, m0, Z.mover1 - m0, { tone: "mid" }, {
      name: nm("mover"), steps: 3, bevel: 0.5,
      inner: Ln(seam(MV, z(22.2)) + seam(MV, z(25.6)) + joints, { tone: "faint" }),
      extra: screwsOn([[cx - 27.5, -14], [cx - 27.5, 14], [cx + 29, -14], [cx + 29, 14]], Z.mover1, { ring: 0.6, size: 0.35 }),
    });
    // Lorentz short-stroke actuators (magnet yokes on the short stroke over coils on the long stroke) [Heertjes 2020]
    for (const [dx, dy] of [[-18, -11], [-18, 11], [22, -11], [22, 11]]) band(PIECE, vert(cx + dx, dy, Z.mover1), 0, Z.ss0 - Z.mover1, 2.4, { tone: "lo" }, { name: nm("lorentz") });
    const SS = { x: cx - 24, y: -16, w: 52, d: 32, r: 1 };
    slab(PIECE, SS, Z.ss0, Z.ss1 - Z.ss0, { tone: "mid" }, { name: nm("short-stroke"), steps: 3, inner: Ln(seam(SS, z(31.5)), { tone: "faint" }), extra: screwsOn([[cx - 22.5, -14.5], [cx - 22.5, 14.5], [cx + 26.5, -14.5], [cx + 26.5, 14.5]], Z.ss1, { ring: 0.5, size: 0.3 }) });

    // mirror block with polished faces on all four sides (interferometer targets)
    const MB = { x: cx - 17, y: -16.6, w: 46, d: 33.2, r: 0.3 };
    slab(PIECE, MB, Z.ss1, Z.mirror1 - Z.ss1, { tone: "mid" }, { name: nm("mirror-block"), steps: 2, extra: screwsOn([[cx - 15, -14.6], [cx - 15, 14.6], [cx + 27, -14.6], [cx + 27, 14.6]], Z.mirror1, { ring: 0.5, size: 0.3 }) });
    const mz0 = Z.ss1 + 0.6;
    const mz1 = Z.mirror1 - 0.6;
    // polished faces: a sheen pair across each visible mirror, edge to edge
    const sheenY = [[-6, -2], [-3.6, 0.4]].map(([a, b]) => k.segment([cx + a + 8, 17, mz0], [cx + b + 12, 17, mz1], P)).join("");
    const sheenX = [[-4, 0], [-1.6, 2.4]].map(([a, b]) => k.segment([cx + 29.4, a, mz0], [cx + 29.4, b + 4, mz1], P)).join("");
    boxOf(PIECE, [cx - 16, 16.6, mz0], [cx + 28, 17, mz1], { tone: "hi" }, { name: nm("mirror-y+"), r: 0.1, steps: 1, extra: Ln(sheenY, { tone: "faint" }) });
    boxOf(PIECE, [cx - 16, -17, mz0], [cx + 28, -16.6, mz1], { tone: "hi" }, { name: nm("mirror-y-"), r: 0.1, steps: 1 });
    boxOf(PIECE, [cx + 29, -15.6, mz0], [cx + 29.4, 15.6, mz1], { tone: "hi" }, { name: nm("mirror-x+"), r: 0.1, steps: 1, extra: Ln(sheenX, { tone: "faint" }) });
    boxOf(PIECE, [cx - 17.4, -15.6, mz0], [cx - 17, 15.6, mz1], { tone: "hi" }, { name: nm("mirror-x-"), r: 0.1, steps: 1 });

    // clamp table, E-pin drives under the clamp overhang, the electrostatic burl clamp and the wafer
    const CF = vert(cx, cy, Z.mirror1);
    band(PIECE, CF, 0, Z.table1 - Z.mirror1, TABLE_R, { tone: "lo" }, { name: nm("clamp-table") });
    // 3 E-pins lift the wafer through the clamp [Steur]; their drives sit at 120 degrees under the rim (arrangement ESTIMATED)
    for (const a of [Math.PI / 4, Math.PI / 4 + (2 * Math.PI) / 3, Math.PI / 4 + (4 * Math.PI) / 3]) band(PIECE, vert(cx + 13.4 * Math.cos(a), cy + 13.4 * Math.sin(a), Z.mirror1), 0, Z.table1 - Z.mirror1, 1.1, { tone: "mid" }, { name: nm("e-pin") });
    // burls: tens of thousands, < 0.3 mm, pitch "a few mm" [Hurk; Steur]; the visible ring outside the wafer drawn at 0.45 pitch
    const burls = [];
    for (const r of [15.35, 15.7]) {
      const n = Math.round((2 * Math.PI * r) / 0.45);
      for (let i = 0; i < n; i++) burls.push(at([cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI), Z.clamp1]));
    }
    const KF = vert(cx, cy, Z.table1);
    // wafer with the 26 x 33 mm field grid [asml 3600D]
    const grid = [];
    for (let x = -13; x <= 13.01; x += 2.6) { const h = Math.sqrt(WAFER_R ** 2 - x * x); grid.push(k.lineOnTop([cx + x, cy - h], [cx + x, cy + h], Z.wafer1, P)); }
    for (let y = -13.2; y <= 13.21; y += 3.3) { const h = Math.sqrt(WAFER_R ** 2 - y * y); grid.push(k.lineOnTop([cx - h, cy + y], [cx + h, cy + y], Z.wafer1, P)); }
    // the wafer (0.8 mm) lies thinner than the settle's depth tolerance on its clamp, so clamp and wafer are one item, painted clamp first
    const WF = vert(cx, cy, Z.clamp1);
    const clampShape = A.disc(KF, 0, Z.clamp1 - Z.table1, CLAMP_R, { name: nm("clamp.wafer") });
    const waferShape = A.disc(WF, 0, Z.wafer1 - Z.clamp1, WAFER_R, { name: nm("clamp.wafer") });
    const svg = S(G.disc(0, Z.clamp1 - Z.table1, CLAMP_R, KF, P), { tone: "hi", inner: Ln(G.arcOf(KF, 1.3, CLAMP_R, P), { tone: "faint" }) }) + Dots(burls, { size: 0.22, tone: "lo" })
      + S(G.disc(0, Z.wafer1 - Z.clamp1, WAFER_R, WF, P), { tone: "hi" }) + Ln(grid.join(""), { tone: "lo" });
    put(PIECE, [cx, cy, Z.clamp1], svg, { name: nm("clamp.wafer"), shapes: [record(clampShape), record(waferShape)] });

    // TIS / ILIAS fiducial plate beside the wafer, top flush with the wafer surface [US7282701B2]; size ESTIMATED
    boxOf(PIECE, [cx + 18, -5, Z.mirror1], [cx + 27, 5, z(44.6)], { tone: "mid" }, { name: nm("fiducial-riser"), steps: 2 });
    const FP = { x: cx + 18.5, y: -4.5, w: 8, d: 9, r: 0.3 };
    const marks = [];
    for (let i = 0; i < 4; i++) marks.push(k.planOutline({ x: FP.x + 1 + i * 0.9, y: FP.y + 1.2, w: 0.4, d: 3, r: 0 }, Z.wafer1, P, 1));
    for (let i = 0; i < 4; i++) marks.push(k.planOutline({ x: FP.x + 4.4, y: FP.y + 4.8 + i * 0.8, w: 3, d: 0.35, r: 0 }, Z.wafer1, P, 1));
    marks.push(k.planOutline({ x: FP.x + 1, y: FP.y + 5.2, w: 2.4, d: 2.4, r: 0.2 }, Z.wafer1, P, 2));
    slab(PIECE, FP, z(44.6), Z.wafer1 - z(44.6), { tone: "hi" }, { name: nm("fiducial"), steps: 2, extra: Ln(marks.join(""), { tone: "lo" }) + screwsOn([[FP.x + 6.9, FP.y + 1.1], [FP.x + 1.1, FP.y + 7.9]], Z.wafer1, { ring: 0.35, size: 0.25 }) });

    // service block on the away side of the mover: coolant manifold + connector panel
    const x0 = cx + CABLE_DX;
    const [sb0, sb1] = yr(HALF_Y, 21);
    boxOf(PIECE, [x0 - 5, sb0, z(21)], [x0 + 5, sb1, z(27.5)], { tone: "mid" }, { name: nm("service-block"), steps: 2, extra: screwsOn([[x0 - 4, ys(19)], [x0 + 4, ys(19)]], z(27.5), { ring: 0.5, size: 0.3 }) });
    const [br0, br1] = yr(21, 27);
    boxOf(PIECE, [x0 - 3.4, br0, z(20.3)], [x0 + 3.4, br1, z(21)], { tone: "mid" }, { name: nm("slab-bracket"), steps: 1 });
    // shuttle sled on its bed, follows the mover along x [Butler 2013]
    const [sl0, sl1] = yr(104, 118);
    const SLED = { x: x0 - 8, y: sl0, w: 16, d: sl1 - sl0, r: 0.8 };
    slab(PIECE, SLED, Z.plate1 + 3, 4, { tone: "mid" }, { name: nm("shuttle"), steps: 2, inner: Ln(seam(SLED, z(19), 2), { tone: "faint" }), extra: screwsOn([[x0 - 6.5, ys(116.5)], [x0 + 6.5, ys(116.5)]], z(21), { ring: 0.5, size: 0.3 }) });
    const [cb0, cb1] = yr(110, 116);
    boxOf(PIECE, [x0 - 4.5, cb0, z(21)], [x0 + 4.5, cb1, z(27.4)], { tone: "mid" }, { name: nm("shuttle-connector"), steps: 2, extra: screwsOn([[x0 - 3.5, ys(113)], [x0 + 3.5, ys(113)]], z(27.4), { ring: 0.5, size: 0.3 }) });
    const CZ = z(24.2);
    const bundle = `${PIECE}.slab-${id}`;
    const clamps = [clampAt(PIECE, [x0, ys(25), CZ], [0, side, 0], 3.2, { name: nm("slab-clamp"), bundle }), clampAt(PIECE, [x0, ys(106), CZ], [0, side, 0], 3.2, { name: nm("slab-clamp"), bundle })];
    // DERIVED: ~1.5 kW coil heat at a 2 K rise needs ~11 L/min; a 1.2 cm bore hose at 1.6 m/s carries it (outer r 0.85)
    [[-2.2, 0.85, "hi"], [0, 0.55, "mid"], [2.2, 0.55, "mid"]].forEach(([dx, r, tone], index) => {
      const x = x0 + dx;
      cable(PIECE, [[x, ys(21), CZ], [x, ys(38), CZ], [x, ys(54), z(32)], [x, ys(90), z(32)], [x, ys(100), CZ], [x, ys(110), CZ]], { r, bend: 6, name: nm(index ? "slab-cable" : "slab-hose"), bundle, clamps, tone, touch: [`${nm("slab-clamp")}*`] });
    });
  });

  chuck("chuckA", OPTIC.wafer[0], 1);
  chuck("chuckB", MEASURE[0], -1);

  // ---- label plate ----
  const LP = { x: 196, y: 108, w: 40, d: 18, r: 1 };
  const rules = [[LP.x + 4, LP.y + 5, 26], [LP.x + 4, LP.y + 9, 18], [LP.x + 4, LP.y + 13, 22]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], Z.plate1 + 0.8, P)).join("");
  slab(PIECE, LP, Z.plate1, 0.8, { tone: "mid" }, { name: `${PIECE}.label`, steps: 3, extra: Ln(k.planOutline(k.insetPlan(LP, 1.6), Z.plate1 + 0.8, P, 3), { tone: "faint" }) + Ln(rules, { tone: "lo", free: true }) + screwsOn([[LP.x + 2.2, LP.y + 2.2], [LP.x + LP.w - 2.2, LP.y + LP.d - 2.2]], Z.plate1 + 0.8, { ring: 0.6, size: 0.35 }) });

  ctx.shared.stages = { chuckA: [OPTIC.wafer[0], 0, Z.wafer1], chuckB: [MEASURE[0], 0, Z.wafer1], waferZ: Z.wafer1, waferR: WAFER_R };
}
