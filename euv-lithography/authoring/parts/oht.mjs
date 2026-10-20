// The overhead hoist transport over the load ports: a ceiling-hung rail, and a vehicle stopped over the right
// port lowering a FOUP on four belts. Rail ~260 above the raised floor, vehicle ~90 below it [US7771153];
// vehicle length 78.4 [ufast, UNVERIFIED]. Every other number is DERIVED and says why.
import { k, G, A } from "../lib.mjs";
import { PORT_X, foup, FOUP } from "./loadport.mjs";

const PC = "oht";
const CX = PORT_X[2];                 // the vehicle stops over the right port
const F_FRONT = 130 + 2.5 + 7;        // that port's undocked FOUP front face (loadport.mjs: BOLTS + plate + dock stroke)
const RY = F_FRONT + FOUP.d / 2;      // rail and hoist centreline over the FOUP centre

// DERIVED: rail drawn as an I-section monorail; the trolley wheels ride the bottom flange both sides of the web,
// as on an overhead hoist monorail, and the vehicle hangs from the trolleys below the flange.
const RAIL = { x0: -629, x1: -331, split: -400, w: 14, bf: [252.8, 254.4], web: [254.4, 266], tf: [266, 267.6], webT: 1.6 };
const HANGERS = [-612, -548, -410, -346];
const VEH = { x0: CX - 39.2, x1: CX + 39.2, y0: RY - 23, y1: RY + 23 };   // 784 long [ufast]; DERIVED 46 wide to enclose the 34-deep FOUP
const BOGIES = [CX - 26, CX + 26];
const WHEEL = { r: 2.6, w: 1.4 };     // DERIVED: polyurethane tread sized for ~15 kg of vehicle + 8.2 kg loaded FOUP per wheel pair
const CHASSIS = [230, 244];
const COVERS = [172, 230];            // DERIVED: end covers reach below a FOUP held right under the drums (travel pose)
const DRUM = { r: 2.5, z: 212, x0: CX - 11, x1: CX + 11, dy: 3.5 };  // DERIVED: two belt drums, belts at +-6 of the centreline; hung low enough to show under the chassis lip
const BELT_X = [CX - 8, CX + 8];
const ZB = 142;                       // hanging FOUP base: partway down, 50.7 above its seat on the pins

export function build(L, ctx) {
  const { ENV } = ctx;
  const { boxOf, band, turned, Ln, Dots, at, screwsOn, record, put, S } = L;
  if (RAIL.x0 < ENV.oht.x || RAIL.x1 > ENV.oht.x + ENV.oht.w) throw new Error("rail leaves the oht envelope");
  const Z1 = ENV.oht.z1;

  // ---- rail: two I-section lengths spliced at x -400, end plates where the figure cuts it
  const hy = RAIL.w / 2;
  for (const [x0, x1] of [[RAIL.x0, RAIL.split], [RAIL.split, RAIL.x1]]) {
    boxOf(PC, [x0, RY - hy, RAIL.bf[0]], [x1, RY + hy, RAIL.bf[1]], { tone: "mid" }, { name: `${PC}.rail.bottom`, r: 0.2 });
    boxOf(PC, [x0, RY - RAIL.webT / 2, RAIL.web[0]], [x1, RY + RAIL.webT / 2, RAIL.web[1]], { tone: "mid" }, { name: `${PC}.rail.web`, r: 0.2 });
    boxOf(PC, [x0, RY - hy, RAIL.tf[0]], [x1, RY + hy, RAIL.tf[1]], { tone: "mid" }, { name: `${PC}.rail.top`, r: 0.2, bevel: 0.3 });
  }
  for (const [x0, x1] of [[RAIL.x0 - 1, RAIL.x0], [RAIL.x1, RAIL.x1 + 1]]) boxOf(PC, [x0, RY - hy - 0.5, RAIL.bf[0] - 0.5], [x1, RY + hy + 0.5, RAIL.tf[1] + 0.5], { tone: "lo" }, { name: `${PC}.rail.end`, r: 0.2 });
  const sy = RY + RAIL.webT / 2;
  const spliceBolts = [];
  for (const dx of [-3.4, 3.4]) for (const z of [257.5, 260.2, 262.9]) spliceBolts.push(at([RAIL.split + dx, sy + 0.6, z]));
  boxOf(PC, [RAIL.split - 5, sy, 255.4], [RAIL.split + 5, sy + 0.6, 265], { tone: "lo" }, { name: `${PC}.rail.splice`, r: 0.2, extra: Dots(spliceBolts, { size: 0.4 }) });
  // DERIVED: stop-position marker the vehicle's sensor reads to park over the port within a few mm
  boxOf(PC, [CX - 2, RY + 3.3, RAIL.bf[1]], [CX + 2, RY + 4.5, RAIL.bf[1] + 3.6], { tone: "hi" }, { name: `${PC}.rail.marker`, r: 0.2 });

  // ---- ceiling hangers: beam clamp on the top flange, threaded rod, nuts, and a ceiling plate stub (ground)
  for (const x of HANGERS) {
    const top = RAIL.tf[1];
    boxOf(PC, [x - 2, RY - hy, top], [x + 2, RY + hy, top + 1.4], { tone: "lo" }, { name: `${PC}.hanger.clamp`, r: 0.3, extra: screwsOn([[x, RY - hy + 1.6], [x, RY + hy - 1.6]], top + 1.4, { ring: 0.6, size: 0.35 }) });
    const z0 = top + 1.4;
    const plateZ = Z1 - 2;
    const F = G.frameAlong([x, RY, z0], [0, 0, 1]);
    const rod = `${PC}.hanger.rod-${x}`;
    band(PC, F, 0, plateZ - z0, 0.6, { tone: "mid" }, { name: rod, owner: rod });
    band(PC, F, 0, 1, 1.1, { tone: "hi" }, { name: `${PC}.hanger.nut`, owner: rod });
    band(PC, F, plateZ - z0 - 1, plateZ - z0, 1.1, { tone: "hi" }, { name: `${PC}.hanger.nut`, owner: rod });
    const plan = { x: x - 4, y: RY - 4, w: 8, d: 8, r: 0.5 };
    const id = L.nameFor(`${PC}.ceiling-plate`);
    const shape = record({ ...A.slab(plan, plateZ, 2, { name: id }, 3), ground: true });   // ceiling not drawn: a ground stub
    put(PC, [x, RY, plateZ + 1], S(k.slabOf(plan, plateZ, 2, L.P, 3, 0.3), { tone: "lo" }) + screwsOn(k.corners(plan, 1.2), Z1, { ring: 0.6, size: 0.35 }), { name: id, shapes: [shape] });
  }

  // ---- trolleys: a wheel each side of the web on the bottom flange, side plates, a yoke under the flange, the pivot pin
  const wz = RAIL.bf[1] + WHEEL.r;
  BOGIES.forEach((xb, index) => {
    const yn = RY + RAIL.webT / 2 + 2.1;                 // near wheel inner face, clear of the web
    const yf = RY - RAIL.webT / 2 - 2.1 - WHEEL.w;
    for (const [y, out] of [[yn, 1], [yf, -1]]) {
      const F = G.frameAlong([xb, out > 0 ? y : y + WHEEL.w, wz], [0, out, 0]);
      turned(PC, F, [[0, WHEEL.r], [WHEEL.w, WHEEL.r]], { tone: "hi" }, { name: `${PC}.wheel`, extra: out > 0 ? Ln(G.circleOf(F, WHEEL.w, 1.1, L.P, 20), { tone: "faint" }) + Dots(G.dotsOf(F, WHEEL.w, 1.7, 4, L.P, { all: true }), { size: 0.3 }) : "" });
    }
    const plateN = RY + hy + 0.5;
    const plateF = RY - hy - 0.7;
    band(PC, G.frameAlong([xb, yn + WHEEL.w, wz], [0, 1, 0]), 0, plateN - yn - WHEEL.w, 0.6, { tone: "mid" }, { name: `${PC}.axle` });
    band(PC, G.frameAlong([xb, yf, wz], [0, -1, 0]), 0, yf - plateF, 0.6, { tone: "mid" }, { name: `${PC}.axle` });
    const sp = [248, wz + 0.6];   // DERIVED: side plates stop just above the axle so the wheel treads show
    boxOf(PC, [xb - 4, plateN, sp[0]], [xb + 4, plateN + 1.2, sp[1]], { tone: "mid" }, { name: `${PC}.bogie.plate`, r: 0.4, bevel: 0.3, extra: Dots([at([xb - 3, plateN + 1.2, 249.2]), at([xb + 3, plateN + 1.2, 249.2]), at([xb, plateN + 1.2, wz])], { size: 0.35 }) });
    boxOf(PC, [xb - 4, plateF - 1.2, sp[0]], [xb + 4, plateF, sp[1]], { tone: "mid" }, { name: `${PC}.bogie.plate`, r: 0.4 });
    boxOf(PC, [xb - 4, plateF, sp[0]], [xb + 4, plateN, sp[0] + 3], { tone: "lo" }, { name: `${PC}.bogie.yoke`, r: 0.4 });
    band(PC, G.frameAlong([xb, RY, CHASSIS[1]], [0, 0, 1]), 0, sp[0] - CHASSIS[1], 1.3, { tone: "hi" }, { name: `${PC}.bogie.pivot` });
    if (index === 0) {
      // DERIVED: the front trolley's wheel is driven by a geared servo on its axle line
      const F = G.frameAlong([xb, plateN + 1.2, wz], [0, 1, 0]);
      turned(PC, F, [[0, 2.0], [4.6, 2.0], [4.6, 1.6], [5.6, 1.6]], { tone: "hi" }, { name: `${PC}.drive`, extra: Ln(G.arcOf(F, 1.2, 2.0, L.P), { tone: "faint" }) });
    }
  });

  // ---- vehicle body: chassis with the electronics, two end covers, drop-prevention flaps, PIO sensor
  const CH = { x: VEH.x0, y: VEH.y0, w: VEH.x1 - VEH.x0, d: VEH.y1 - VEH.y0, r: 1.5 };
  const cy1 = VEH.y1;
  const vents = [];
  for (let i = 0; i < 7; i++) vents.push(L.path3(slot([CX - 30 + i * 3, cy1, 237], 1, 8), true));
  const rules = [[3, 8], [1.5, 6], [0, 9.6]].map(([dz, len]) => L.path3([[CX + 14, cy1 + 0.4, 235 + dz], [CX + 14 + len, cy1 + 0.4, 235 + dz]])).join("");
  L.slab(PC, CH, CHASSIS[0], CHASSIS[1] - CHASSIS[0], { tone: "mid" }, { name: `${PC}.chassis`, steps: 4, bevel: 0.6, inner: Ln(k.sideSeam(CH, CHASSIS[0] + 3, L.P, 4), { tone: "faint" }), extra: Ln(vents.join(""), { tone: "lo" }) + screwsOn(k.corners(CH, 2.4), CHASSIS[1], { ring: 0.7, size: 0.4 }) + Ln(k.planOutline(k.insetPlan(CH, 4), CHASSIS[1], L.P, 3), { tone: "faint" }) });
  boxOf(PC, [CX + 12.5, cy1, 233.8], [CX + 25.5, cy1 + 0.4, 239.6], { tone: "lo" }, { name: `${PC}.label`, r: 0.3, extra: Ln(rules, { tone: "lo", free: true }) + Dots([at([CX + 24.6, cy1 + 0.4, 234.6]), at([CX + 24.6, cy1 + 0.4, 238.8])], { size: 0.35 }) });
  for (const [x0, x1, flap] of [[VEH.x0, VEH.x0 + 10, 1], [VEH.x1 - 10, VEH.x1, -1]]) {
    const hp = { x: x0, y: VEH.y0, w: x1 - x0, d: VEH.y1 - VEH.y0, r: 1.2 };
    const hv = [];
    for (let i = 0; i < 6; i++) hv.push(L.path3(slot([(x0 + x1) / 2, cy1, 190 + i * 3.2], 7, 1.1), true));
    L.slab(PC, hp, COVERS[0], COVERS[1] - COVERS[0], { tone: "mid" }, { name: `${PC}.cover`, steps: 3, bevel: 0.5, inner: Ln(k.sideSeam(hp, 212, L.P, 3), { tone: "faint" }), extra: Ln(hv.join(""), { tone: "lo" }) + Dots([at([x0 + 1.6, cy1, 228.4]), at([x1 - 1.6, cy1, 228.4]), at([x0 + 1.6, cy1, 183.6]), at([x1 - 1.6, cy1, 183.6])], { size: 0.38 }) });
    // DERIVED: drop-prevention flaps folded flat on the inner faces; they swing under the FOUP in travel
    const fx = flap > 0 ? x1 : x0 - 0.8;
    boxOf(PC, [fx, VEH.y0 + 7, COVERS[0] + 1], [fx + 0.8, VEH.y1 - 7, COVERS[0] + 10], { tone: "lo" }, { name: `${PC}.flap`, r: 0.2 });
  }
  // E84 PIO optical sensor under the front cover, looking down at the port [E84; Hokuyo pinout]
  boxOf(PC, [VEH.x0 + 2.5, VEH.y1 - 9, COVERS[0] - 2.4], [VEH.x0 + 7.5, VEH.y1 - 3, COVERS[0]], { tone: "hi" }, { name: `${PC}.pio`, r: 0.3, extra: Ln(L.path3(slot([VEH.x0 + 5, VEH.y1 - 3, COVERS[0] - 1.2], 3, 1.2), true), { tone: "lo" }) });

  // ---- belt hoist: bearing blocks under the chassis, two drums, the hoist motor
  for (const [x0, x1] of [[DRUM.x0 - 2, DRUM.x0], [DRUM.x1, DRUM.x1 + 2]])
    boxOf(PC, [x0, RY - 7, DRUM.z - 3.5], [x1, RY + 7, CHASSIS[0]], { tone: "mid" }, { name: `${PC}.hoist.block`, r: 0.3, extra: Dots([at([x1, RY + 7, DRUM.z - 2.4]), at([x1, RY + 7, CHASSIS[0] - 1.2])], { size: 0.35 }) });
  for (const dy of [-DRUM.dy, DRUM.dy]) {
    const F = G.frameAlong([DRUM.x0, RY + dy, DRUM.z], [1, 0, 0]);
    const seams = BELT_X.flatMap((bx) => [bx - DRUM.x0 - 1.2, bx - DRUM.x0 + 1.2]).map((s) => G.arcOf(F, s, DRUM.r, L.P)).join("");
    band(PC, F, 0, DRUM.x1 - DRUM.x0, DRUM.r, { tone: "hi", inner: Ln(seams, { tone: "faint" }) }, { name: `${PC}.hoist.drum` });
  }
  const MF = G.frameAlong([DRUM.x1 + 2, RY + DRUM.dy, DRUM.z], [1, 0, 0]);
  turned(PC, MF, [[0, 2.2], [6.2, 2.2], [6.2, 1.7], [7.2, 1.7]], { tone: "mid" }, { name: `${PC}.hoist.motor`, extra: Ln(G.arcOf(MF, 3.1, 2.2, L.P), { tone: "faint" }) });

  // ---- live: the FOUP and gripper the page lowers, and the four belts it stretches
  const beltY = [RY - DRUM.dy - DRUM.r, RY + DRUM.dy + DRUM.r];   // belts leave each drum tangentially
  let grip = null;
  L.live("hoistFoup", () => {
    const H = foup(L, PC, `${PC}.live-hoistFoup`, CX, F_FRONT, ZB);
    const g0 = H.flangeTop;
    const g1 = g0 + 3.5;   // DERIVED: gripper plate thick enough for two jaw slides and their cam
    const gp = { x: CX - 11, y: RY - 8, w: 22, d: 16, r: 1 };
    L.slab(PC, gp, g0, g1 - g0, { tone: "mid" }, { name: `${PC}.live-hoistFoup.gripper`, steps: 3, bevel: 0.5, inner: Ln(k.sideSeam(gp, g0 + 1.2, L.P, 3), { tone: "faint" }) });
    const fp = H.flangePlan;
    for (const s of [-1, 1]) {
      // jaws close on the flange's long edges and their lips hook under it [US12139176]
      const yEdge = s > 0 ? fp.y + fp.d : fp.y;
      const [ja, jb] = s > 0 ? [yEdge, yEdge + 2] : [yEdge - 2, yEdge];
      boxOf(PC, [CX - 5, ja, H.flangeBottom - 1.6], [CX + 5, jb, g0], { tone: "hi" }, { name: `${PC}.live-hoistFoup.jaw`, r: 0.2 });
      const [la, lb] = s > 0 ? [yEdge - 1.8, yEdge] : [yEdge, yEdge + 1.8];
      boxOf(PC, [CX - 5, la, H.flangeBottom - 1.1], [CX + 5, lb, H.flangeBottom], { tone: "hi" }, { name: `${PC}.live-hoistFoup.lip`, r: 0.2 });
    }
    for (const bx of BELT_X)
      for (const by of beltY) {
        const [ya, yb] = by > RY ? [by - 0.7, by + 1.0] : [by - 1.0, by + 0.7];
        boxOf(PC, [bx - 1.3, ya, g1], [bx + 1.3, yb, g1 + 1.5], { tone: "lo" }, { name: `${PC}.live-hoistFoup.belt-clamp`, r: 0.2, extra: Dots([at([bx, (ya + yb) / 2, g1 + 1.5])], { size: 0.3 }) });
      }
    boxOf(PC, [CX - 3, RY - 2.5, g1], [CX + 3, RY + 2.5, g1 + 2.5], { tone: "lo" }, { name: `${PC}.live-hoistFoup.grip-motor`, r: 0.4 });
    grip = g1 + 1.5;
  });
  L.live("hoistBelts", () => {
    for (const bx of BELT_X)
      for (const by of beltY) {
        const [ya, yb] = by > RY ? [by, by + 0.3] : [by - 0.3, by];
        boxOf(PC, [bx - 0.9, ya, grip], [bx + 0.9, yb, DRUM.z], { tone: "hi" }, { name: `${PC}.live-hoistBelts.belt`, r: 0.05 });
      }
  });
  ctx.shared.hoist = { beltTop: DRUM.z, beltBottom: grip, foupBase: ZB, seat: 90 + 1.3, travelLift: DRUM.z - DRUM.r - 1 - grip };
}

// a closed slot outline on a +y face
function slot([x, y, z], w, h) {
  const r = Math.min(w, h) / 2;
  const pts = [];
  for (const [cx, cz, a0] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]])
    for (let i = 0; i <= 4; i++) {
      const a = ((a0 + 22.5 * i) * Math.PI) / 180;
      pts.push([x + cx + r * Math.cos(a), y, z + cz + r * Math.sin(a)]);
    }
  return pts;
}
