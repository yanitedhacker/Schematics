// Three TAS300-class 300 mm load ports bolted to the track's front face (y 130), standing on the raised floor.
// Left: empty, kinematic plate and pins showing, port door closed. Middle: docked FOUP, door pulled in by the
// opener, its 25 wafers seen through the shell. Right: undocked, waiting for the FOUP the OHT is lowering.
// Sizes from research/track.md; every number not read there carries a DERIVED note.
import { k, G, A } from "../lib.mjs";

// SEMI / TDK numbers, cm
export const HDP = 90;              // horizontal datum plane above the floor [TAS300 drawing]
const FRAME_W = 47.2;               // TAS300 frame width 472 [drawing]
const FRAME_H = 138.6;              // TAS300 height 1386 [drawing]
const STAGE_FRONT = 49.3;           // stage depth in front of the BOLTS plane [drawing]
const DOCK = 7;                     // Y dock stroke 70 [drawing]
const PLATE_T = 2.5;                // DERIVED: frame plate thickness; a 25 mm aluminium plate carries a 47x139 cantilevered stage
export const SEAL = 16.55;          // door seal face 165.5 from the facial datum (wafer centre) [AUX018]
const KEY_X = 12.9;                 // latch keys at +-129 [AUX018]
export const SLOT0 = 4.4;           // wafer access band 44..284 above the HDP [US9834378]
export const PITCH = 1.0;           // 25 slots at 10 pitch [Entegris A300]
const BOLTS = 130;                  // BOLTS plane = track front face [plan.mjs]
export const PORT_X = [-581, -530, -479]; // DERIVED: middle port fixed at foupDock x; E15.1 minimum pitch 50.5 rounded up to 51

// FOUP render envelope 42 x 34 x 33.5 [track.md 4.1, ESTIMATED vendor midpoint]
export const FOUP = { w: 42, d: 34, h: 33.5 };
const SHELL_HALF = 19.5;            // DERIVED: shell 39 wide; side rails and handles reach the 42 envelope
const BASE_T = 1.2;                 // DERIVED: moulded base plate carrying the three V-grooves
const NECK = { w: 10, d: 8, h: 2 }; // DERIVED: top flange dimensions not published; sized to an OHT gripper's two hands
const FLANGE = { w: 16, d: 12, h: 1 };
// SEMI E57-0299 primary pins from the wafer centre: front pair (+-11.5, 8.0), rear (0, 12.0).
// DERIVED: the front pair is taken on the door side (-y in FOUP terms) so the three pins make a kinematic triangle.
export const PINS = [[-11.5, -8], [11.5, -8], [0, 12]];
const PIN_R = 0.6;                  // pins dia 12 [E57]
const PIN_H = 1.3;                  // pin tops 13 above the plate [E57]

const rr = (o, ex, ey, w, h, r, n = 4) => {
  const pts = [];
  const c = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]];
  for (const [cu, cv, a0] of c)
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      const u = cu + r * Math.cos(a);
      const v = cv + r * Math.sin(a);
      pts.push(G.add3(o, G.add3(G.mul3(ex, u), G.mul3(ey, v))));
    }
  return pts;
};
// a closed slot or window outline on a vertical face (normal along y), centred at [x, y, z]
export const faceLoop = (L, [x, y, z], w, h, r = 0.5) => L.path3(rr([x, y, z], [1, 0, 0], [0, 0, 1], w, h, Math.min(r, w / 2, h / 2)), true);
const faceLoopX = (L, [x, y, z], w, h, r = 0.5) => L.path3(rr([x, y, z], [0, 1, 0], [0, 0, 1], w, h, Math.min(r, w / 2, h / 2)), true);
export const faceLine = (L, a, b) => L.path3([a, b]);

// the wafer stack seen through the shell: the visible front arc of each wafer rim, ending on the stack's two limbs
function stackLines(L, [cx, cy], z0, z1, count, r) {
  const h = G.unit3([L.V[0], L.V[1], 0]);
  const perp = [-h[1], h[0], 0];
  const arcs = [];
  for (let i = 0; i < count; i++) {
    const z = z0 + ((z1 - z0) * i) / (count - 1);
    const pts = [];
    for (let j = 0; j <= 24; j++) {
      const t = Math.PI * (j / 24);
      const d = G.add3(G.mul3(perp, Math.cos(t)), G.mul3(h, Math.sin(t)));
      pts.push([cx + r * d[0], cy + r * d[1], z]);
    }
    arcs.push(L.path3(pts));
  }
  const limbs = [1, -1].map((s) => L.path3([[cx + s * r * perp[0], cy + s * r * perp[1], z0], [cx + s * r * perp[0], cy + s * r * perp[1], z1]]));
  return L.Ln(arcs.join(""), { tone: "faint" }) + L.Ln(limbs.join(""), { tone: "lo" });
}

// one FOUP: front (door) face at y = f facing -y, centred on x = cx, base on z = zb
export function foup(L, piece, base, cx, f, zb, { wafers = true } = {}) {
  const { boxOf, Ln, Dots, at } = L;
  const yc = f + FOUP.d / 2;
  const wc = [cx, f + SEAL];
  const z1 = zb + BASE_T;
  const z2 = zb + FOUP.h - NECK.h - FLANGE.h;   // shell top
  boxOf(piece, [cx - SHELL_HALF + 0.5, f + 0.5, zb], [cx + SHELL_HALF - 0.5, f + FOUP.d - 0.5, z1], { tone: "mid" }, { name: `${base}.base`, r: 2.5 });
  const shellName = `${base}.shell`;
  const shellPlan = { x: cx - SHELL_HALF, y: f, w: 2 * SHELL_HALF, d: FOUP.d, r: 3 };
  const seam = k.sideSeam(shellPlan, z1 + 3.2, L.P, 4);          // DERIVED: door-frame rib line moulded round the shell
  const s0 = zb - PIN_H + SLOT0;                                 // slot 1 at 4.4 above the HDP the FOUP rests on
  const stack = wafers ? stackLines(L, wc, s0, s0 + 24 * PITCH, 25, 15) : "";
  L.slab(piece, shellPlan, z1, z2 - z1, { tone: "hi" }, { name: shellName, owner: shellName, steps: 4, bevel: 0.6, inner: Ln(seam, { tone: "faint" }) + stack });
  // side rails along the bottom of both sides (conveyor rails), handles on both sides
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? cx + SHELL_HALF : cx - SHELL_HALF - 1;
    boxOf(piece, [x0, f + 3, z1], [x0 + 1, f + FOUP.d - 3, z1 + 1.4], { tone: "mid" }, { name: `${base}.rail`, r: 0.3 });
    const xp = s > 0 ? cx + SHELL_HALF : cx - SHELL_HALF - 0.8;
    for (const yy of [f + 9, f + 23.5]) boxOf(piece, [xp, yy, z1 + 13.2], [xp + 0.8, yy + 1.5, z1 + 14.8], { tone: "mid" }, { name: `${base}.handle-post`, r: 0.2 });
    const xb = s > 0 ? cx + SHELL_HALF + 0.8 : cx - SHELL_HALF - 1.5;
    boxOf(piece, [xb, f + 8.5, z1 + 12.6], [xb + 0.7, f + 25.5, z1 + 15.4], { tone: "hi" }, { name: `${base}.handle`, r: 0.3 });
  }
  // carrier ID label on the back face
  const ly = f + FOUP.d;
  const lz = z1 + 12;
  const rules = [[-6, 4.2, 4.6], [-6, 2.2, 3.2], [-6, 0.2, 5.4]].map(([x0, dz, len]) => faceLine(L, [cx + x0, ly + 0.4, lz + dz], [cx + x0 + len * 2, ly + 0.4, lz + dz])).join("");
  boxOf(piece, [cx - 7.5, ly, lz - 1.2], [cx + 7.5, ly + 0.4, lz + 6], { tone: "mid" }, { name: `${base}.label`, r: 0.3, extra: Ln(faceLoop(L, [cx, ly + 0.4, lz + 2.4], 13.8, 6, 0.4), { tone: "faint" }) + Ln(rules, { tone: "lo", free: true }) + Dots([at([cx + 6.3, ly + 0.4, lz - 0.3]), at([cx + 6.3, ly + 0.4, lz + 5.1])], { size: 0.4 }) });
  // robotic flange on the top, on its neck
  boxOf(piece, [cx - NECK.w / 2, yc - NECK.d / 2, z2], [cx + NECK.w / 2, yc + NECK.d / 2, z2 + NECK.h], { tone: "mid" }, { name: `${base}.neck`, r: 0.6 });
  const fz = z2 + NECK.h;
  const fp = { x: cx - FLANGE.w / 2, y: yc - FLANGE.d / 2, w: FLANGE.w, d: FLANGE.d, r: 1 };
  L.slab(piece, fp, fz, FLANGE.h, { tone: "hi" }, { name: `${base}.flange`, steps: 3, bevel: 0.4, extra: L.screwsOn(k.corners(fp, 1.6), fz + FLANGE.h, { ring: 0.6, size: 0.35 }) });
  return { shellName, wc, slot: (n) => s0 + (n - 1) * PITCH, flangeTop: fz + FLANGE.h, flangeBottom: fz, flangePlan: fp, top: fz + FLANGE.h };
}

export function build(L, ctx) {
  const { ENV, PORTS, shared } = ctx;
  const { boxOf, slab, band, prism, Ln, Dots, at, screwsOn } = L;
  const PC = "loadport";
  if (Math.abs(PORTS.foupDock.at[0] - PORT_X[1]) > 1e-6) throw new Error("middle port must sit on PORTS.foupDock");
  if (ENV.loadport.z1 < FRAME_H) throw new Error("loadport envelope shorter than the TAS300 frame");

  const front = BOLTS + PLATE_T;                 // frame plate front face, where a docked FOUP seals
  const stageY1 = BOLTS + STAGE_FRONT;

  PORT_X.forEach((cx, index) => {
    const n = `${PC}.p${index + 1}`;
    const docked = index === 1;
    const f = docked ? front : front + DOCK;    // FOUP front face (door) position on this port's stage
    const wc = [cx, f + SEAL];
    const hw = FRAME_W / 2;

    // floor foot, bolted to the tiles
    const foot = { x: cx - hw, y: BOLTS, w: FRAME_W, d: 22, r: 0.6 };   // DERIVED: base foot spreading the stage moment onto the raised floor
    slab(PC, foot, 0, 1.2, { tone: "lo" }, { name: `${n}.foot`, steps: 2, extra: screwsOn([[cx - hw + 2.4, BOLTS + 19.6], [cx + hw - 2.4, BOLTS + 19.6]], 1.2, { ring: 1, size: 0.4 }) });

    // frame plate on the BOLTS plane, with bolts along its visible edges, and its top cap
    const boltDots = [];
    for (let z = 92; z <= 134; z += 7) for (const s of [-1, 1]) boltDots.push(at([cx + s * (hw - 0.8), front, z]));
    boxOf(PC, [cx - hw, BOLTS, 1.2], [cx + hw, front, 137.4], { tone: "mid" }, { name: `${n}.frame`, r: 0.3, bevel: 0.4, extra: Dots(boltDots, { size: 0.38 }) });
    boxOf(PC, [cx - hw, BOLTS, 137.4], [cx + hw, front + 1.5, FRAME_H], { tone: "mid" }, { name: `${n}.cap`, r: 0.4, bevel: 0.4, extra: screwsOn([[cx - hw + 2, BOLTS + 2], [cx + hw - 2, BOLTS + 2]], FRAME_H, { ring: 0.6, size: 0.35 }) });

    // E84 handshake indicator: five lamps (L_REQ, U_REQ, READY, HO_AVBL, ES) [E84 pinout, Hokuyo]
    const ez = 132.4;
    const lamps = [-4.8, -2.4, 0, 2.4, 4.8].map((dx) => at([cx + dx, front + 1.1, ez]));
    boxOf(PC, [cx - 7, front, 129.4], [cx + 7, front + 1.1, 135.4], { tone: "mid" }, { name: `${n}.e84`, r: 0.4, extra: Ln(faceLoop(L, [cx, front + 1.1, ez], 12, 2.4, 0.8), { tone: "lo" }) + Dots(lamps, { size: 0.5, tone: "hi" }) });

    // lower cover housing: drive electronics, with vents, a panel seam and a label plate
    const LH = { x: cx - 21, y: front, w: 42, d: 15.5, r: 0.8 };
    const ly = front + LH.d;
    const vents = [];
    for (let row = 0; row < 6; row++) for (const dx of [-9.5, 9.5]) vents.push(faceLoop(L, [cx + dx, ly, 9 + row * 3], 15, 1.1, 0.55));
    const corner = [[-19.6, 3], [19.6, 3], [-19.6, 76.6], [19.6, 76.6]].map(([dx, z]) => at([cx + dx, ly, z]));
    slab(PC, LH, 1.2, 77.8, { tone: "mid" }, { name: `${n}.lower`, steps: 3, bevel: 0.5, inner: Ln(k.sideSeam(LH, 40, L.P, 3), { tone: "faint" }), extra: Ln(vents.join(""), { tone: "lo" }) + Dots(corner, { size: 0.4 }) });
    const rules = [[3.2, 8], [1.6, 5.6], [0, 9]].map(([dz, len]) => faceLine(L, [cx - 5.4, ly + 0.4, 60 + dz], [cx - 5.4 + len, ly + 0.4, 60 + dz])).join("");
    boxOf(PC, [cx - 7, ly, 57.6], [cx + 7, ly + 0.4, 66], { tone: "lo" }, { name: `${n}.label`, r: 0.3, extra: Ln(faceLoop(L, [cx, ly + 0.4, 61.8], 12.8, 7.2, 0.4), { tone: "faint" }) + Ln(rules, { tone: "lo", free: true }) + Dots([at([cx + 5.8, ly + 0.4, 58.6]), at([cx + 5.8, ly + 0.4, 65])], { size: 0.38 }) });

    // stage housing, cantilevered on two gussets; indicator window and operator buttons on its front
    const SH = { x: cx - 22, y: front, w: 44, d: stageY1 - front, r: 1 };
    const sz = 79;
    const sTop = HDP - 1.3;
    const ind = [-3, 0, 3].map((dx) => at([cx + dx, stageY1, 84]));
    const slot = k.planOutline({ x: cx - 19, y: front + 0.8, w: 38, d: 41.5, r: 1 }, sTop, L.P, 3);
    slab(PC, SH, sz, sTop - sz, { tone: "mid" }, { name: `${n}.stage`, steps: 3, bevel: 0.5, extra: Ln(slot, { tone: "faint" }) + Ln(faceLoop(L, [cx, stageY1, 84], 9, 3.4, 0.8), { tone: "lo" }) + Dots(ind, { size: 0.45, tone: "hi" }) });
    for (const dx of [-14, 14]) {
      const F = G.frameAlong([cx + dx, stageY1, 84], [0, 1, 0]);
      L.turned(PC, F, [[0, 0.9], [0.5, 0.9], [0.5, 0.6], [0.8, 0.6]], { tone: "hi" }, { name: `${n}.button` });
    }
    for (const dx of [-16, 14.5]) {
      const F = G.frameOf([cx + dx, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      prism(PC, F, [[ly, sz], [ly + 22, sz], [ly, sz - 22]], 0, 1.5, { tone: "lo" }, { name: `${n}.gusset` });   // DERIVED: gusset sized to the 49 cm stage overhang
    }

    // docking plate (moves 7 along y when docking) with its kinematic pins, placement sensors and purge nozzles
    const DP = { x: cx - 18, y: f + 1, w: 36, d: 32, r: 1.2 };
    slab(PC, DP, sTop, HDP - sTop, { tone: "hi" }, { name: `${n}.dock`, steps: 3, bevel: 0.4, extra: screwsOn(k.corners(DP, 1.8), HDP, { ring: 0.6, size: 0.35 }) });
    for (const [dx, dy] of PINS) {
      const F = G.frameAlong([wc[0] + dx, wc[1] + dy, HDP], [0, 0, 1]);
      L.turned(PC, F, [[0, PIN_R], [0.85, PIN_R], [1.15, 0.38], [PIN_H, 0]], { tone: "hi" }, { name: `${n}.pin` });
    }
    if (!docked) for (const [dx, dy] of [[-15, 4], [15, 4]]) boxOf(PC, [wc[0] + dx - 0.6, wc[1] + dy - 0.6, HDP], [wc[0] + dx + 0.6, wc[1] + dy + 0.6, HDP + 0.6], { tone: "mid" }, { name: `${n}.presence`, r: 0.2 });   // DERIVED: two placement switches beside the pins
    for (const [dx, dy] of [[-8, 13], [8, 13]]) {
      const F = G.frameAlong([wc[0] + dx, wc[1] + dy, HDP], [0, 0, 1]);
      L.turned(PC, F, [[0, 1.1], [0.35, 1.1], [0.35, 0.55], [0.8, 0.55]], { tone: "mid" }, { name: `${n}.purge` });   // bottom N2 purge nozzles [TAS300; US6899145]
    }
    if (!docked) boxOf(PC, [cx - 3.5, f + 1.6, HDP], [cx + 3.5, f + 3.6, HDP + 0.5], { tone: "lo" }, { name: `${n}.rfid`, r: 0.3 });   // carrier ID reader on the stage [Hermos]

    if (docked) {
      // the docked FOUP, door pulled in by the opener (inside the track), front opening facing -y
      const F0 = foup(L, PC, `${PC}.foup`, cx, f, HDP + PIN_H);
      const z13 = F0.slot(13);
      L.live("wafer", () => band(PC, G.frameAlong([wc[0], wc[1], z13], [0, 0, 1]), -0.039, 0.039, 15, { tone: "hi" }, { name: `${PC}.live-wafer`, owner: F0.shellName }));
      shared.waferStart = [wc[0], wc[1], z13];
      return;
    }

    // closed port door (FIMS) with its latch keys, registration pins and the mapping sensor across its top
    const dz0 = 92;
    const dz1 = 121;
    const dzc = (dz0 + dz1) / 2;
    boxOf(PC, [cx - 18, front, dz0], [cx + 18, front + 0.8, dz1], { tone: "mid" }, { name: `${n}.door`, r: 0.6, bevel: 0.3, extra: Ln(faceLoop(L, [cx, front, dzc], 37.6, dz1 - dz0 + 1.6, 1), { tone: "lo" }) });
    for (const s of [-1, 1]) {
      const kx = cx + s * KEY_X;
      const F = G.frameAlong([kx, front + 0.8, dzc], [0, 1, 0]);
      band(PC, F, 0, 0.4, 1.0, { tone: "mid" }, { name: `${n}.key-hub` });
      boxOf(PC, [kx - 0.25, front + 1.2, dzc - 0.675], [kx + 0.25, front + 1.6, dzc + 0.675], { tone: "hi" }, { name: `${n}.key`, r: 0.1 });   // key 5 wide, rotation radius 6.75 [AUX018]
      const R = G.frameAlong([cx + s * 7, front + 0.8, dzc - 6], [0, 1, 0]);   // DERIVED: registration pins below the keys, into the door's dia 9 holes
      L.turned(PC, R, [[0, 0.45], [0.7, 0.45], [1.0, 0]], { tone: "hi" }, { name: `${n}.reg-pin` });
    }
    // DERIVED: through-beam mapping pair on arms at the door top; they swing into the FOUP and sweep down the slots
    boxOf(PC, [cx - 16, front, dz1], [cx + 16, front + 2, dz1 + 1.4], { tone: "mid" }, { name: `${n}.mapper`, r: 0.3 });
    for (const s of [-1, 1]) boxOf(PC, [cx + s * 15 - 1, front + 2, dz1], [cx + s * 15 + 1, front + 3.6, dz1 + 1.4], { tone: "hi" }, { name: `${n}.map-head`, r: 0.2 });
  });
}
