// The interface between the track and the scanner. Track side: TEL interface block D3 with tower T2 (TRS, buffer,
// CPL), the BST back-side clean and PIR post-exposure wash stations, a DI-water manifold and interface arms 41, 42
// and 43 [US9377691B2]. Scanner side: two stacked two-door vacuum load locks on a pedestal with their roughing lines,
// valves and gauges, and the vacuum handler chamber with its SCARA handler, pre-aligner and thermal conditioning
// plate [US7878755B2]. The handler is built at rest, folded over its deck; the page extends it to MEASURE.
import { k, G, A } from "../lib.mjs";

const PC = "interface";
const N = (s) => `${PC}.${s}`;

const WAFER_R = 15;          // 300 mm wafer [track.md 4.1]
const LINK = 56;             // DERIVED: two equal 56 links reach 99.4 from the shoulder to the wrist at MEASURE and fold back to the locks and plates
const PZ = 12;               // DERIVED: plinth top; 9 cm steel plinth on 3 cm levelling feet carries the block over the raised floor
const ROOF = 214;            // DERIVED: roof under a 12 cm FFU so the block stays inside ENV z1 230
const SHELF = 4;             // DERIVED: buffer shelf pitch; 300 mm wafer plus an end-effector pass (~2 cm) and shelf (0.5)

export function build(L, ctx) {
  const { P, PORTS, MEASURE, ENV, shared } = ctx;
  const ZW = PORTS.waferHandoff.at[2];
  const M = MEASURE;
  if (M[2] !== ZW) throw new Error(`interface: MEASURE z ${M[2]} != waferHandoff z ${ZW}`);
  const { at, S, Ln, Dots, boxOf, band, turned, prism, boss, elbow, pipe, valveOn, ballAt, flangeAt, put, record, screwsOn, path3, live } = L;
  const E = ENV.interface;
  const top = [];

  const vert = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const down = (x, y, z) => G.frameOf([x, y, z], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
  const plan = (x0, y0, x1, y1, r = 0.4) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });
  const seam = (x0, y0, x1, y1, z, r = 0.4) => k.sideSeam(plan(x0, y0, x1, y1, r), z, P, 3);
  const box = (name, a, b, tone, o = {}) => {
    top.push(b[2]);
    return boxOf(PC, a, b, { tone }, { name: N(name), ...o });
  };
  const loop = (o, ex, ey, w, h, r) => {
    const pts = [];
    r = Math.min(r, w / 2, h / 2);
    for (const [cu, cv, a0] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]])
      for (let i = 0; i <= 4; i++) {
        const a = ((a0 + 22.5 * i) * Math.PI) / 180;
        pts.push(G.add3(o, G.add3(G.mul3(ex, cu + r * Math.cos(a)), G.mul3(ey, cv + r * Math.sin(a)))));
      }
    return path3(pts, true);
  };
  const loopY = (c, w, h, r = 0.5) => loop(c, [1, 0, 0], [0, 0, 1], w, h, r);
  const loopX = (c, w, h, r = 0.5) => loop(c, [0, 1, 0], [0, 0, 1], w, h, r);
  const ringOn = (F, s, r, name, rIn, tone = "mid") =>
    put(PC, G.add3(F.o, G.mul3(F.a, s + 0.75)), S(G.ringBand(s, s + 1.5, rIn, r, F, P), { tone }), { name: N(name), shapes: [record(A.ring(F, s, s + 1.5, rIn, r, { name: N(name) }))] });

  // ---------------- TEL interface block D3: feet, plinth, back wall, side panel, front posts, roof, FFU ----------------
  const X0 = E.x;
  const X1 = -116;            // DERIVED: block face on the scanner side leaves 4 for the load lock outer doors
  const Y0 = E.y;
  const Y1 = 118;
  for (const x of [X0 + 5, X1 - 5]) for (const y of [Y0 + 6, -10, Y1 - 6]) turned(PC, vert(x, y, 0), [[0, 4], [1, 4], [1, 2.4], [3, 2.4]], { tone: "lo" }, { name: N("foot") });
  box("plinth", [X0, Y0, 3], [X1, Y1, PZ], "lo", { r: 1, bevel: 1.2, inner: Ln(seam(X0, Y0, X1, Y1, 8, 1), { tone: "faint" }) });
  const backJoints = [-145, -131].map((x) => k.segment([x, Y0 + 4, PZ], [x, Y0 + 4, ROOF], P)).join("");
  const backScrews = [];
  for (const x of [-145, -131]) for (let z = 24; z < ROOF; z += 32) backScrews.push(at([x + 1.2, Y0 + 4, z]));
  box("back-wall", [X0, Y0, PZ], [X1, Y0 + 4, ROOF], "mid", { bevel: 1, inner: Ln(backJoints + seam(X0, Y0, X1, Y0 + 4, 80) + seam(X0, Y0, X1, Y0 + 4, 150), { tone: "faint" }), extra: Dots(backScrews, { size: 0.4 }) });
  const vents = [];
  for (const y of [-118, -68]) for (let z = 30; z <= 96; z += 6) vents.push(loopX([X1, y, z], 12, 1.2, 0.6));
  box("side-panel", [X1 - 2, Y0 + 4, PZ], [X1, -50, ROOF], "mid", { bevel: 1, inner: Ln(seam(X1 - 2, Y0 + 4, X1, -50, 150), { tone: "faint" }), extra: Ln(vents.join(""), { tone: "lo" }) });
  const LP = X1 + 0.4;
  const rules = [[3, 9], [1, 6], [-1, 11]].map(([dz, len]) => path3([[LP, -98.5, 162 + dz], [LP, -98.5 + len, 162 + dz]])).join("");
  box("label", [X1, -100, 157], [LP, -86, 167], "lo", { r: 0.2, extra: Ln(loopX([LP, -93, 162], 13, 9, 0.4), { tone: "faint" }) + Ln(rules, { tone: "lo", free: true }) + Dots([at([LP, -87.2, 158.2]), at([LP, -87.2, 165.8])], { size: 0.38 }) });
  box("front-post", [X0, Y1 - 3, PZ], [X0 + 3, Y1, ROOF], "mid", { bevel: 0.6 });
  box("front-post", [X1 - 3, Y1 - 3, PZ], [X1, Y1, ROOF], "mid", { bevel: 0.6 });
  box("roof", [X0, Y0, ROOF], [X1, Y1, ROOF + 4], "mid", { r: 1, bevel: 1.2, extra: Ln(k.planOutline(plan(X0 + 3, Y0 + 3, X1 - 3, Y1 - 3, 1), ROOF + 4, P, 3), { tone: "faint" }) });
  // FFU over the block: three fan intakes and a filter seam [TEL track, ULPA downflow]
  const FFU = plan(-154, -118, -122, 96, 1);
  const fanY = [-80, -11, 58];
  const ffuTop = ROOF + 14;
  const fans = fanY.map((y) => k.ring(-138, y, 11, ffuTop, P, 48) + k.ring(-138, y, 3, ffuTop, P, 20)).join("");
  box("ffu", [FFU.x, FFU.y, ROOF + 4], [FFU.x + FFU.w, FFU.y + FFU.d, ffuTop], "mid", { r: 1, bevel: 1, inner: Ln(k.sideSeam(FFU, ROOF + 8, P, 3), { tone: "faint" }), extra: Ln(fans, { tone: "lo" }) + screwsOn(k.corners(FFU, 2.5), ffuTop, { ring: 0.9 }) });

  // ---------------- tower T2: four posts carrying the base, buffers, TRS and CPL ----------------
  const T2 = [-140, 0];
  const TX = [-158, -122];
  const TY = 18;
  const T2TOP = 162;
  for (const [x0, x1] of [[TX[0], TX[0] + 2], [TX[1] - 2, TX[1]]]) for (const [y0, y1] of [[-TY, -TY + 2], [TY - 2, TY]]) box("t2-post", [x0, y0, PZ], [x1, y1, T2TOP], "mid", { r: 0.3, bevel: 0.4 });
  box("t2-cap", [TX[0], -TY, T2TOP], [TX[1], TY, T2TOP + 2], "mid", { bevel: 0.6, extra: screwsOn(k.corners(plan(TX[0], -TY, TX[1], TY), 1.2), T2TOP + 2, { ring: 0.6, size: 0.35 }) });
  const MX = [TX[0] + 2, TX[1] - 2];
  const t2Vents = [];
  for (let z = 22; z <= 48; z += 5) for (const dx of [-8, 8]) t2Vents.push(loopY([T2[0] + dx, TY, z], 13, 1.2, 0.6));
  box("t2-base", [MX[0], -TY, PZ], [MX[1], TY, 58], "mid", { bevel: 0.8, extra: Ln(t2Vents.join(""), { tone: "lo" }) });
  // exposed-wafer buffer, closed cassette with its door
  box("t2-bu-exposed", [MX[0], -TY, 60], [MX[1], TY, 94], "mid", { bevel: 0.8, extra: Ln(loopY([T2[0], TY, 77], 28, 30, 1), { tone: "lo" }) + Dots([at([T2[0] - 12, TY, 64]), at([T2[0] + 12, TY, 64]), at([T2[0] - 12, TY, 90]), at([T2[0] + 12, TY, 90])], { size: 0.4 }) });
  // unexposed-wafer buffer: open shelf rack, combs at both sides, 7 slotted shelves
  const BU0 = 96;
  const BU1 = 132;
  box("t2-bu-floor", [MX[0], -TY, BU0], [MX[1], TY, BU0 + 1.2], "lo", { bevel: 0.3 });
  box("t2-bu-top", [MX[0], -TY, BU1 - 1.2], [MX[1], TY, BU1], "lo", { bevel: 0.3 });
  for (const [x0, x1] of [[MX[0], MX[0] + 4], [MX[1] - 4, MX[1]]]) box("t2-bu-comb", [x0, -14, BU0 + 1.2], [x1, 14, BU1 - 1.2], "mid", { r: 0.3, bevel: 0.3 });
  const shelfZ = (n) => BU0 + 4 + SHELF * n;
  for (let n = 0; n < 7; n++) box("t2-bu-shelf", [MX[0] + 4, -13, shelfZ(n)], [MX[1] - 4, 13, shelfZ(n) + 0.5], "hi", { r: 0.3, bevel: 0 });
  // TRS: transfer plate with three lift pins, pin tops at the handoff height
  const TRS0 = ZW - 6;
  const PIN_H = 3.5;          // DERIVED: pins lift the wafer 3.5 above the plate so a 2.5 fork slides under it
  box("t2-trs", [MX[0], -TY, TRS0], [MX[1], TY, TRS0 + 2], "mid", { bevel: 0.6 });
  for (const a of [90, 210, 330]) {
    const r = (a * Math.PI) / 180;
    turned(PC, vert(T2[0] + 9 * Math.cos(r), T2[1] + 9 * Math.sin(r), TRS0 + 2), [[0, 0.7], [PIN_H - 0.8, 0.7], [PIN_H, 0.35]], { tone: "hi" }, { name: N("t2-trs-pin") });
  }
  // CPL chill plate [US20070089673A1: two stages to 23 +-0.2 C]
  const CPL0 = ZW + 6;
  box("t2-cpl-base", [MX[0], -TY, CPL0], [MX[1], TY, CPL0 + 4], "mid", { bevel: 0.6 });
  const CPLF = vert(T2[0], T2[1], CPL0 + 4);
  band(PC, CPLF, 0, 2, WAFER_R, { tone: "hi" }, { name: N("t2-cpl-plate"), extra: Ln(G.circleOf(CPLF, 2, 11, P) + G.circleOf(CPLF, 2, 6, P), { tone: "faint" }) });
  const CPL_TOP = CPL0 + 6;

  // ---------------- wash tower: BST (T4) low, PIR (T3) above it ----------------
  const WX = [-158, -120];
  const WY = [40, 95];
  const WTOP = 146;
  for (const [x0, x1] of [[WX[0], WX[0] + 2], [WX[1] - 2, WX[1]]]) for (const [y0, y1] of [[WY[0], WY[0] + 2], [WY[1] - 2, WY[1]]]) box("wash-post", [x0, y0, PZ], [x1, y1, WTOP], "mid", { r: 0.3, bevel: 0.4 });
  box("wash-top", [WX[0], WY[0], WTOP], [WX[1], WY[1], WTOP + 2], "mid", { bevel: 0.6 });
  const CUP = [-139, 66];
  const CUP_R = 16.5;         // DERIVED: wafer radius 15 plus a 1.5 splash gap
  const LIP_IN = 15.6;
  const CUP_H = 20;           // DERIVED: cup deep enough to catch spin-off at 1000-2000 rpm
  const DIS = { x0: -155.5, y0: 84, x1: -148.5, y1: 91 };
  const station = (id, z0, nozzle) => {
    box(`${id}-tray`, [WX[0] + 2, WY[0], z0 - 8], [WX[1] - 2, WY[1], z0], "lo", { bevel: 0.6, extra: screwsOn([[WX[0] + 4, WY[1] - 2], [WX[1] - 4, WY[1] - 2]], z0, { ring: 0.6, size: 0.35 }) });
    const F = vert(CUP[0], CUP[1], z0);
    const voidD = G.circleOf(F, CUP_H, LIP_IN, P);
    turned(PC, F, [[0, CUP_R - 1], [1, CUP_R], [CUP_H, CUP_R]], { tone: "mid" }, { name: N(`${id}-cup`), inner: G.arcOf(F, CUP_H - 5, CUP_R, P), extra: `<path class="iso-shade" data-shade="0" d="${voidD}"/>` });
    ringOn(F, CUP_H, CUP_R, `${id}-cup-lip`, LIP_IN);
    band(PC, F, CUP_H, CUP_H + 2, 10, { tone: "hi" }, { name: N(`${id}-chuck`), extra: Ln(G.circleOf(F, CUP_H + 2, 6, P) + G.circleOf(F, CUP_H + 2, 2, P), { tone: "faint" }) });
    // arm on a post beside the cup, head over the chuck edge
    const AP = [-125, 47];
    const AH = [-136, 58];
    const armZ = z0 + 27;
    band(PC, vert(AP[0], AP[1], z0), 0, armZ - z0, 1.5, { tone: "mid" }, { name: N(`${id}-arm-post`) });
    const u = G.unit3([AH[0] - AP[0], AH[1] - AP[1], 0]);
    prism(PC, G.frameOf([AP[0], AP[1], 0], [0, 0, 1], u, G.cross3([0, 0, 1], u)), G.stadium(1.6, 1.6, Math.hypot(AH[0] - AP[0], AH[1] - AP[1])), armZ, armZ + 1.5, { tone: "mid" }, { name: N(`${id}-arm`) });
    const HF = vert(AH[0], AH[1], z0 + 23.5);
    turned(PC, HF, nozzle ? [[0, 0.6], [1.2, 1.6], [3.5, 1.6]] : [[0, 2.5], [3.5, 2.5]], { tone: "hi" }, { name: N(`${id}-${nozzle ? "nozzle" : "brush"}`) });
    box(`${id}-dispense`, [DIS.x0, DIS.y0, z0], [DIS.x1, DIS.y1, z0 + 12], "mid", { r: 0.5, bevel: 0.5, extra: screwsOn([[DIS.x0 + 1.2, DIS.y0 + 1.2], [DIS.x1 - 1.2, DIS.y1 - 1.2]], z0 + 12, { ring: 0.5, size: 0.32 }) });
    return { chuckTop: z0 + CUP_H + 2, dz: z0 + 6 };
  };
  const BST = station("bst", 20, false);
  const PIR = station("pir", 110, true);

  // DI-water manifold in front of the wash tower, one spool to each dispense block
  const DM = { x0: -157, y0: 98, x1: -147, y1: 108, z1: 34 };
  const DX = (DM.x0 + DM.x1) / 2;
  const DYc = (DM.y0 + DM.y1) / 2;
  box("di-manifold", [DM.x0, DM.y0, PZ], [DM.x1, DM.y1, DM.z1], "mid", { r: 0.6, bevel: 1, inner: Ln(seam(DM.x0, DM.y0, DM.x1, DM.y1, 18, 0.6), { tone: "faint" }), extra: screwsOn([[DM.x0 + 1.5, DM.y0 + 1.5], [DM.x1 - 1.5, DM.y1 - 1.5]], DM.z1, { ring: 0.6, size: 0.35 }) });
  pipe(PC, [[DX, DM.y0, BST.dz], [DX, DIS.y1, BST.dz]], 2, { name: N("di-bst") });
  const DB = 3;               // DERIVED: tee ball r3 over r2 lines (>= sqrt(2^2+2^2))
  const DBC = [DX, DYc, PIR.dz];
  const rimOff = Math.sqrt(DB ** 2 - 4);
  pipe(PC, [[DX, DYc, DM.z1], [DX, DYc, PIR.dz - rimOff]], 2, { name: N("di-pir-riser"), flanges: [true, false] });
  ballAt(PC, DBC, DB, { tone: "hi", name: N("di-pir-elbow") });
  pipe(PC, [[DX, DYc - rimOff, PIR.dz], [DX, DIS.y1, PIR.dz]], 2, { name: N("di-pir"), flanges: [false, true] });

  // ---------------- interface arms 41/42 (shared column) and 43, parked pointing -x ----------------
  const arm = (id, col, zc) => {
    const [cx0, cy] = col;
    box(`${id}-carriage`, [cx0 - 4, cy - 3, zc - 8], [cx0, cy + 3, zc], "mid", { r: 0.3, bevel: 0.4 });
    const S0 = [cx0 - 2.5, cy];
    const W = [cx0 - 12.5, cy];
    prism(PC, G.frameOf([S0[0], S0[1], 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0]), G.stadium(2, 2, S0[0] - W[0]), zc, zc + 2.5, { tone: "hi" }, { name: N(`${id}-link`) });
    const fz = zc + 2.5;
    box(`${id}-palm`, [W[0] - 6, cy - 4, fz], [W[0] + 1, cy + 4, fz + 1], "hi", { r: 0.3, bevel: 0 });
    box(`${id}-tine`, [W[0] - 18, cy - 4, fz], [W[0] - 6, cy - 1.5, fz + 1], "hi", { r: 0.3, bevel: 0 });
    box(`${id}-tine`, [W[0] - 18, cy + 1.5, fz], [W[0] - 6, cy + 4, fz + 1], "hi", { r: 0.3, bevel: 0 });
    return [W[0] - 10, cy, fz + 1.5];
  };
  const column = (id, [x, y]) => {
    box(`${id}-base`, [x - 5.5, y - 5.5, PZ], [x + 5.5, y + 5.5, PZ + 2], "lo", { r: 0.5, bevel: 0.4, extra: screwsOn(k.corners(plan(x - 5.5, y - 5.5, x + 5.5, y + 5.5), 1.2), PZ + 2, { ring: 0.5, size: 0.32 }) });
    box(`${id}-column`, [x - 4, y - 4, PZ + 2], [x + 4, y + 4, 150], "mid", { r: 0.5, bevel: 0.5, inner: Ln(seam(x - 4, y - 4, x + 4, y + 4, 100, 0.5), { tone: "faint" }) });
    return x - 4;
  };
  const C12 = [-123, 30];
  const C3 = [-125, -35];
  const c12 = column("arm41-42", C12);
  const c3 = column("arm43", C3);
  arm("arm42", [c12, C12[1]], BST.chuckTop + 0.5);
  arm("arm41", [c12, C12[1]], PIR.chuckTop + 0.5);
  const A43 = arm("arm43", [c3, C3[1]], ZW - 4);

  // ---------------- load locks: pedestal, LL1 and LL2, doors, viewports, gauges ----------------
  const LX = [-112, -62];
  const LY = 24;
  const LL1 = [ZW - 10, ZW + 10];  // DERIVED: 50 x 48 x 20 chamber holds one 300 mm wafer with 2 cm walls and a 34 cm bore
  const LL2 = [ZW + 12, ZW + 32];
  const LLC = [(LX[0] + LX[1]) / 2, 0];
  const RAIL = LL1[0] - 4;
  for (const x of [-102, -78]) for (const y of [-22, 18]) {
    box("ped-foot", [x - 1, y - 1, 0], [x + 5, y + 5, 1.5], "lo", { r: 0.4, bevel: 0.3 });
    box("ped-leg", [x, y, 1.5], [x + 4, y + 4, RAIL], "mid", { r: 0.3, bevel: 0.4 });
  }
  for (const y of [-21.5, 18.5]) box("ped-brace", [-98, y, 60], [-78, y + 3, 63], "mid", { r: 0.3, bevel: 0.3 });
  for (const [y0, y1] of [[-22, -14], [14, 22]]) box("ped-rail", [-110, y0, RAIL], [-74, y1, LL1[0]], "mid", { r: 0.4, bevel: 0.5, extra: screwsOn([[-106, (y0 + y1) / 2], [-80, (y0 + y1) / 2]], LL1[0], { ring: 0.7, size: 0.35 }) });
  const llBody = (id, [z0, z1]) => box(id, [LX[0], -LY, z0], [LX[1], LY, z1], "mid", { r: 1.5, bevel: 1.2, inner: Ln(seam(LX[0], -LY, LX[1], LY, z1 - 4, 1.5), { tone: "faint" }), extra: screwsOn(k.corners(plan(LX[0], -LY, LX[1], LY), 2.5), z1, { ring: 0.8 }) });
  llBody("ll1", LL1);
  // DERIVED: 2 cm spacer plate so LL2 rests on LL1 instead of floating 2 above it
  box("ll-spacer", [LX[0] + 2, -LY + 2, LL1[1]], [LX[1] - 2, LY - 2, LL2[0]], "lo", { r: 1, bevel: 0.4 });
  llBody("ll2", LL2);
  // DERIVED: 31-wide gate over a 30.6 slit (300 mm wafer + end effector), 16 tall plate on a 20 tall chamber
  const IDX = [-101, -71];
  const doors = (id, [z0, z1], below) => {
    const zA = below ? z0 - 4 : z1 - 2;
    const zB = below ? z0 + 2 : z1 + 4;
    box(`${id}-outer-door`, [-116, -20, z0 + 2], [LX[0], 20, z1 - 2], "mid", { r: 0.5, bevel: 0.5 });
    box(`${id}-outer-bonnet`, [-116, -6, zA], [LX[0], 6, zB], "mid", { r: 0.5, bevel: 0.4 });
    const doorFace = loopY([(IDX[0] + IDX[1]) / 2, LY + 4, (z0 + z1) / 2], IDX[1] - IDX[0] - 2, z1 - z0 - 6, 1);
    const doorDots = [[IDX[0] + 1.6, z0 + 3.4], [IDX[1] - 1.6, z0 + 3.4], [IDX[0] + 1.6, z1 - 3.4], [IDX[1] - 1.6, z1 - 3.4]].map(([x, z]) => at([x, LY + 4, z]));
    box(`${id}-inner-door`, [IDX[0], LY, z0 + 2], [IDX[1], LY + 4, z1 - 2], "mid", { r: 0.5, bevel: 0.5, extra: Ln(doorFace, { tone: "lo" }) + Dots(doorDots, { size: 0.4 }) });
    box(`${id}-inner-bonnet`, [-94, LY, zA], [-78, LY + 4, zB], "mid", { r: 0.5, bevel: 0.4 });
    // DERIVED: pneumatic gate cylinders, 11 long for a 2 cm gate stroke plus cushion and clevis
    const prof = [[0, 2.2], [8, 2.2], [8, 1.2], [11, 1.2]];
    const zC = below ? zA : zB;
    for (const [x, y] of [[-114, 0], [-86, LY + 2]]) turned(PC, below ? down(x, y, zC) : vert(x, y, zC), prof, { tone: "mid" }, { name: N(`${id}-gate-cyl`), inner: G.arcOf(below ? down(x, y, zC) : vert(x, y, zC), 4, 2.2, P) });
  };
  doors("ll1", LL1, true);
  doors("ll2", LL2, false);
  // LL2 viewports: top and +y face; gauge on top
  const VT = [-96, -6, LL2[1]];
  flangeAt(PC, [VT[0], VT[1], VT[2] + 0.6], [0, 0, 1], 5, 1.2, { tone: "mid", bolts: 8, name: N("ll2-viewport-flange") });
  band(PC, vert(VT[0], VT[1], VT[2] + 1.2), 0, 0.3, 3.6, { tone: "lo" }, { name: N("ll2-viewport-glass") });
  const VY = [-106.5, LY, LL2[0] + 15.5];
  flangeAt(PC, [VY[0], LY + 0.5, VY[2]], [0, 1, 0], 3.2, 1, { tone: "mid", bolts: 6, name: N("ll2-side-viewport-flange") });
  band(PC, G.frameAlong([VY[0], LY + 1, VY[2]], [0, 1, 0]), 0, 0.3, 2.2, { tone: "lo" }, { name: N("ll2-side-viewport-glass") });
  const gauge = (id, x, y, z, up) => {
    const F = up ? vert(x, y, z) : down(x, y, z);
    turned(PC, F, [[0, 1.6], [1.5, 1.6], [1.5, 1.2], [3, 1.2], [3, 2.6], [7.5, 2.6], [7.5, 1.8], [8.5, 1.8]], { tone: "mid" }, { name: N(`${id}-gauge`), inner: G.arcOf(F, 5.2, 2.6, P) });
  };
  gauge("ll2", -78, 12, LL2[1], true);
  gauge("ll1", -84, 8, LL1[0], false);

  // ---------------- roughing lines and manifold ----------------
  const RM = { x0: -110, y0: LY, x1: -88, y1: 34, z1: 14 };
  box("rough-manifold", [RM.x0, RM.y0, 0], [RM.x1, RM.y1, RM.z1], "lo", { r: 0.6, bevel: 1, inner: Ln(seam(RM.x0, RM.y0, RM.x1, RM.y1, 6, 0.6), { tone: "faint" }), extra: screwsOn([[RM.x0 + 2, RM.y1 - 2], [RM.x1 - 2, RM.y1 - 2], [RM.x0 + 2, RM.y0 + 2]], RM.z1, { ring: 0.7 }) });
  const fore = boss(PC, [RM.x1, (RM.y0 + RM.y1) / 2, 7], [1, 0, 0], 3.4, 1.5, { name: N("rough-foreline-boss") });
  flangeAt(PC, G.add3(fore, [0.6, 0, 0]), [1, 0, 0], 4.2, 1.2, { tone: "mid", bolts: 6, name: N("rough-foreline-blank") });
  const PR = 2;               // DERIVED: KF40-class roughing line, 4 cm bore
  const p1 = boss(PC, [-92, 0, LL1[0]], [0, 0, -1], 3.4, 2, { name: N("ll1-pump-boss") });
  const l1 = pipe(PC, [p1, [-92, 0, 7], [-92, RM.y0, 7]], PR, { name: N("ll1-rough"), valve: [0.45, PR] });
  valveOn(PC, l1, 0.45, PR, { side: [0, 1, 0], name: N("ll1-rough-valve") });
  const EB = 4;               // DERIVED: elbow ball big enough that the r2 drop clears the r2.6 boss by 1
  const p2 = boss(PC, [-106.5, LY, LL2[0] + 6], [0, 1, 0], 2.6, 2.5, { name: N("ll2-pump-boss"), owner: N("ll2-pump") });
  const p2c = G.add3(p2, [0, Math.sqrt(EB ** 2 - 2.6 ** 2), 0]);
  const drop = [p2c[0], p2c[1], RM.z1];
  const p2x = elbow(PC, p2, [0, 1, 0], 2.6, drop, EB, PR, { name: N("ll2-pump-elbow"), owner: N("ll2-pump") });
  const l2 = pipe(PC, [p2x, drop], PR, { name: N("ll2-rough"), flanges: [false, true], valve: [0.5, PR] });
  valveOn(PC, l2, 0.5, PR, { side: [0, 1, 0], name: N("ll2-rough-valve") });

  // ---------------- vacuum handler chamber: deck on legs, end wall, column, pre-aligner, thermal plate ----------------
  const DK = { x0: -116, y0: 34, x1: -72, y1: 118 };
  const DZ = ZW - 24;
  for (const x of [DK.x0, DK.x1 - 4]) for (const y of [38, 112]) {
    box("deck-foot", [x - 1, y - 1, 0], [x + 5, y + 5, 1.5], "lo", { r: 0.4, bevel: 0.3 });
    box("deck-leg", [x, y, 1.5], [x + 4, y + 4, DZ - 4], "mid", { r: 0.3, bevel: 0.4 });
  }
  box("deck-brace", [DK.x0 + 0.5, 42, 50], [DK.x0 + 3.5, 112, 53], "mid", { r: 0.3, bevel: 0.3 });
  const deckPlan = plan(DK.x0, DK.y0, DK.x1, DK.y1, 1);
  box("deck", [DK.x0, DK.y0, DZ - 4], [DK.x1, DK.y1, DZ], "mid", { r: 1, bevel: 1.2, extra: Ln(k.planOutline(k.insetPlan(deckPlan, 2.5), DZ, P, 3), { tone: "faint" }) + screwsOn(k.corners(deckPlan, 1.4), DZ, { ring: 0.6, size: 0.35 }) });
  const wallScrews = [];
  for (const y of [40, 76, 112]) for (const z of [DZ + 3, DZ + 13]) wallScrews.push(at([DK.x0 + 4, y, z]));
  box("chamber-end-wall", [DK.x0, DK.y0, DZ], [DK.x0 + 4, DK.y1, DZ + 16], "mid", { r: 0.6, bevel: 1, extra: Dots(wallScrews, { size: 0.4 }) });
  const SH = [-94, 76];
  const COL_TOP = ZW + 16;
  const CBF = vert(SH[0], SH[1], DZ);
  band(PC, CBF, 0, 2, 9, { tone: "mid" }, { name: N("handler-base"), extra: Dots(G.dotsOf(CBF, 2, 7.6, 8, P, { all: true }), { size: 0.4 }) });
  const CF = vert(SH[0], SH[1], DZ + 2);
  band(PC, CF, 0, COL_TOP - DZ - 2, 6, { tone: "mid" }, { name: N("handler-column"), inner: G.arcOf(CF, 8, 6, P) + G.arcOf(CF, COL_TOP - DZ - 8, 6, P) });
  // pre-aligner: chuck on a post, notch sensor fork straddling the wafer edge
  const PA = [-100, 48];
  const PA_TOP = ZW + 4;
  box("prealign-base", [PA[0] - 6, PA[1] - 6, DZ], [PA[0] + 6, PA[1] + 6, DZ + 4], "mid", { r: 0.6, bevel: 0.6 });
  band(PC, vert(PA[0], PA[1], DZ + 4), 0, PA_TOP - 2 - DZ - 4, 2, { tone: "mid" }, { name: N("prealign-post") });
  const PAF = vert(PA[0], PA[1], PA_TOP - 2);
  band(PC, PAF, 0, 2, 5, { tone: "hi" }, { name: N("prealign-chuck"), extra: Ln(G.circleOf(PAF, 2, 3, P), { tone: "faint" }) });
  const NX = PA[0] + WAFER_R;
  box("notch-post", [NX + 1, PA[1] - 2, DZ], [NX + 4, PA[1] + 2, PA_TOP + 3], "mid", { r: 0.3, bevel: 0.3 });
  for (const z of [PA_TOP - 3, PA_TOP + 2]) box("notch-arm", [NX - 4, PA[1] - 1.5, z], [NX + 1, PA[1] + 1.5, z + 1], "hi", { r: 0.3, bevel: 0 });
  // thermal conditioning plate on its block, coolant in and out to the end wall
  const TP = [-93, 102];
  const TP_TOP = ZW - 4;
  const TB = { x0: TP[0] - 8, y0: TP[1] - 8, x1: TP[0] + 8, y1: TP[1] + 8 };
  box("thermal-block", [TB.x0, TB.y0, DZ], [TB.x1, TB.y1, TP_TOP - 4], "mid", { r: 0.6, bevel: 0.6 });
  const TPF = vert(TP[0], TP[1], TP_TOP - 4);
  band(PC, TPF, 0, 4, 16, { tone: "hi" }, { name: N("thermal-plate"), inner: G.arcOf(TPF, 2, 16, P), extra: Ln(G.circleOf(TPF, 4, 12, P) + G.circleOf(TPF, 4, 7, P), { tone: "faint" }) });
  for (const y of [TP[1] - 4, TP[1] + 4]) pipe(PC, [[TB.x0, y, DZ + 8], [DK.x0 + 4, y, DZ + 8]], 2, { name: N("thermal-coolant") });

  // ---------------- the vacuum wafer handler (SCARA), parked folded over the deck ----------------
  // At rest every link stays at x <= -60, clear of the metrology frame and the sensors over MEASURE; the page extends
  // it only for the handoff (shared.handlerReach). Extended, the wrist sits 20 short of MEASURE and the fork runs under
  // the alignment head on a thin blade.
  const deg = Math.PI / 180;
  const EL = [SH[0] + LINK * Math.cos(-58 * deg), SH[1] + LINK * Math.sin(-58 * deg)];   // DERIVED: elbow at -58° keeps its hub 1 off LL2's +y face and 0.8 short of x -60
  const WR = [EL[0] + LINK * Math.cos(145 * deg), EL[1] + LINK * Math.sin(145 * deg)];   // DERIVED: link 2 folds back to 145° so the fork parks between the pre-aligner and the column
  const WR_EXT = [M[0] - 20, M[1]];
  const dSW = Math.hypot(WR_EXT[0] - SH[0], WR_EXT[1] - SH[1]);
  if (dSW > 2 * LINK) throw new Error(`interface: wrist out of reach (${dSW.toFixed(1)} > ${2 * LINK})`);
  const FORK0 = M[2] + 1.3;   // DERIVED: 1 cm blade, underside 1.3 over the wafer plane, top 142.3 under the sensors' lowest point (z 144); the chuck E-pins lift 2.4 to take the wafer
  const BLADE = 1;
  const FORK_REACH = 32;      // palm 14 + tines 18 ahead of the wrist; the fork centre is 20 ahead
  live("handler", () => {
    const link = (name, from, to, r0, r1, z0, z1) => {
      const u = G.unit3([to[0] - from[0], to[1] - from[1], 0]);
      prism(PC, G.frameOf([from[0], from[1], 0], [0, 0, 1], u, G.cross3([0, 0, 1], u)), G.stadium(r0, r1, Math.hypot(to[0] - from[0], to[1] - from[1])), z0, z1, { tone: "hi" }, { name: N(`live-handler.${name}`) });
    };
    // DERIVED: link widths 10/8/7 taper with bending moment from the shoulder outward
    link("link1", SH, EL, 5, 4, COL_TOP, COL_TOP + 4);
    link("link2", EL, WR, 4, 3.5, COL_TOP - 4, COL_TOP);
    const SF = vert(SH[0], SH[1], COL_TOP + 4);
    band(PC, SF, 0, 2, 4.5, { tone: "hi" }, { name: N("live-handler.shoulder"), extra: Dots(G.dotsOf(SF, 2, 3.2, 6, P, { all: true }), { size: 0.35 }) });
    band(PC, vert(EL[0], EL[1], COL_TOP + 4), 0, 1.5, 3.5, { tone: "hi" }, { name: N("live-handler.elbow") });
    // DERIVED: wrist hub runs down to the blade top so the blade is held flush
    band(PC, vert(WR[0], WR[1], FORK0 + BLADE), 0, COL_TOP - 4 - FORK0 - BLADE, 3.5, { tone: "hi" }, { name: N("live-handler.wrist") });
    boxOf(PC, [WR[0] - 4, WR[1] - 6, FORK0], [WR[0] + 10, WR[1] + 6, FORK0 + BLADE], { tone: "hi" }, { name: N("live-handler.palm"), r: 0.4, bevel: 0 });
    for (const [y0, y1] of [[-6, -3.5], [3.5, 6]]) boxOf(PC, [WR[0] + 10, WR[1] + y0, FORK0], [WR[0] + FORK_REACH, WR[1] + y1, FORK0 + BLADE], { tone: "hi" }, { name: N("live-handler.tine"), r: 0.4, bevel: 0 });
  });
  const restMax = Math.max(EL[0] + 3.5, WR[0] + FORK_REACH);
  if (restMax > -60) throw new Error(`interface: parked handler reaches x ${restMax.toFixed(1)} > -60`);
  shared.handlerReach = { from: [WR[0], WR[1], FORK0 + BLADE], to: [WR_EXT[0], WR_EXT[1], FORK0 + BLADE] };

  const zMax = Math.max(...top);
  if (zMax > E.z1) throw new Error(`interface: part top ${zMax} above ENV z1 ${E.z1}`);

  // ---------------- wafer path, every waypoint from the constants above ----------------
  const ZC = ZW + 8;          // DERIVED: carry height over the deck, clear of the pre-aligner fork (147) and thermal plate
  const ZB = FORK0 + BLADE + 0.1;   // wafer riding on the blade under the sensors
  const side = TY + 4;        // the y lane between T2 and the arm column
  const lift = BST.chuckTop + 8;
  const slot = shelfZ(2) + 0.5 + 0.5;
  const LLW = LL1[0] + 10;
  shared.waferPath = {
    ...(shared.waferPath || {}),
    interface: [
      [X0 + 2, 0, ZW],
      [T2[0], T2[1], TRS0 + 2 + PIN_H + 0.5],
      [T2[0], side, ZW],
      [T2[0], side, slot],
      [T2[0], 0, slot],
      [T2[0], side, slot],
      [T2[0], side, lift],
      [CUP[0], CUP[1], lift],
      [CUP[0], CUP[1], BST.chuckTop + 0.5],
      [CUP[0], CUP[1], lift],
      [T2[0], side, lift],
      [T2[0], side, CPL_TOP + 0.5],
      [T2[0], 0, CPL_TOP + 0.5],
      [T2[0], -side, CPL_TOP + 0.5],
      [A43[0], A43[1], CPL_TOP + 0.5],
      [A43[0], A43[1], A43[2]],
      [-128, 0, ZW],
      [LLC[0], LLC[1], LLW],
      [LLC[0], LY + 2, LLW],
      [LLC[0], DK.y0 + 6, ZC],
      [PA[0], PA[1], ZC],
      [PA[0], PA[1], PA_TOP + 0.5],
      [PA[0], PA[1], ZC],
      [DK.x1 - 4, 62, ZC],
      [DK.x1 - 4, 92, ZC],
      [TP[0], TP[1], ZC],
      [TP[0], TP[1], TP_TOP + 0.5],
      [TP[0], TP[1], ZC],
      [-55, 34, ZC],
      [-50, 0, ZC],
      [-50, 0, ZB],
      [M[0], M[1], ZB],
      [M[0], M[1], M[2]],
    ],
  };
}
