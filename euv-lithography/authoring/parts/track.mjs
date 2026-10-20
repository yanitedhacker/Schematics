// The coater/developer track (TEL CLEAN TRACK LITHIUS Pro Z class), its near (+y) skin cut away so the six stacked
// process layers read as shelves. Block order and module counts follow TEL US 9,377,691 B2 [track.md 1.2]: carrier
// block D1 with the FOUP openers, tower T1, process block D2 (2 BCT, 2 COT, 2 DEV layers, bottom to top), and an exit
// tower that lowers the wafer to the interface handoff. The two DEV layers and the roof are cut back over the right
// third so the upper resist-coat layer (COT 2, the wafer's layer) is seen from above.
// Footprints are unpublished: every size below is ESTIMATED from the TEL ACT8-D proxy (3540 W x 1570 D x 2690 H) or
// DERIVED from the wafer and the module counts.
import { k, G, A } from "../lib.mjs";

const T = "track";
const N = (part) => `${T}.${part}`;

const X0 = -600, X1 = -160;
const Y_BACK = -65;           // DERIVED: ACT8-D depth 157 scaled by 440/354 = 195 deep, so the track spans y -65..130
const Y_FRONT = 130;          // the FOUP dock plane (PORTS.foupDock)
const Z_PLINTH = [3, 10];     // DERIVED: levelling feet 3 + a 7 cm steel plinth
const Z_TOP = 236;            // DERIVED: ENV z1 250 less 14 for roof and fan filter units (ACT8-D is 269 tall; ENV caps it)
const Z_TX = 176;             // DERIVED: the exit tower only spans the handoff (z 140) to the COT 2 layer, so it stays low
const D1 = [-600, -450];      // DERIVED: three ports at the 50.5 SEMI E15.1 minimum pitch [US7217076] plus 11 of frame
const T1 = [-450, -420];      // DERIVED: a 300 mm shelf (24 wide) between two 3 cm side plates
const D2 = [-420, -200];      // DERIVED: six 36-wide plate modules (4 PAB + 2 SCPL per COT layer) end to end = 216
const TX = [-200, -160];      // DERIVED: exit lift tower, a 300 mm wafer plus side plates, ending on ENV x1
const CUT = -310;             // the DEV layers and roof are cut back beyond here
const FLOOR_Y = [-46, 128];   // layer floors: a 15 cm exhaust chase behind them, 2 cm of front trim ahead
const CHASE_Y = -53.5;        // riser centreline, 3 clear of the back wall and of the floors' back edge
const LAYER_H = 32;           // DERIVED: 6 layers in z 44..236 (the chemical cabinet takes the 34 below)
const FLOOR_T = 2;
const LAYERS = [
  { id: "bct1", kind: "BCT" }, { id: "bct2", kind: "BCT" },
  { id: "cot1", kind: "COT" }, { id: "cot2", kind: "COT", hero: true },
  { id: "dev1", kind: "DEV", short: true }, { id: "dev2", kind: "DEV", short: true },
].map((layer, index) => ({ ...layer, L: 44 + index * LAYER_H, F: 44 + index * LAYER_H + FLOOR_T }));
const CUP_X = [-392, -340, -255];   // DERIVED: 3 coat cups per layer [US9377691]; Ø44 bowl = 300 mm wafer + 7 cm splash wall
const CUP_Y = 104;             // bowls run to 2 short of the floors' front edge, where the shelf above leaves them in view
const CUP_R = 22;
const MOD_W = 36;                   // DERIVED: a Ø30 plate (wafer + 0) in a 34-wide housing
const MOD_Y = [-42, -6];
const MOD_C = -24;
const PLATES = ["hot", "hot", "chill", "hot", "hot", "chill"];   // 4 PAB hot plates, 2 SCPL chill plates per COT layer
const modX = (index) => D2[0] + 2 + MOD_W * index + MOD_W / 2;
const PORTS_X = [-581, -530, -479];       // DERIVED: matches loadport PORT_X (E15.1 minimum pitch 50.5 rounded to 51) about PORTS.foupDock
const RAIL_Y = [26, 32];
const SHUTTLE_X = -255;

export function build(L, ctx) {
  const { P, PORTS } = ctx;
  const { S, Ln, Dots, at } = L;
  const ZD = PORTS.foupDock.at[2];
  const OPEN = { half: 18, z0: ZD - 8, z1: ZD + 34 };   // DERIVED: door 36 wide (a 300 mm wafer plus fork); spans the datum and the wafer band 4.4..28.4 above it [US9834378]
  const ZR = ZD - 12;   // DERIVED: robot column top, so hub 4 + link 3 + link 3.5 + fork 1 put the fork top 0.5 under the wafer datum
  const V = G.viewOf(P);
  const box = (part, a, b, tone = "mid", options = {}) => L.boxOf(T, a, b, { tone }, { name: N(part), bevel: 0.6, steps: 3, ...options });
  const up = (x, y, z = 0) => G.frameAlong([x, y, z], [0, 0, 1]);
  const disc = (part, x, y, z0, z1, r, tone = "mid", options = {}) => L.band(T, up(x, y), z0, z1, r, { tone }, { name: N(part), ...options });
  const lip = (part, F, s0, s1, rIn, rOut, tone = "mid", extra = "") => {
    const name = L.nameFor(N(part));
    L.put(T, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.ringBand(s0, s1, rIn, rOut, F, P), { tone }) + extra, { name, shapes: [L.record(A.ring(F, s0, s1, rIn, rOut, { name }))] });
  };
  const link = (part, from, to, r, z0, z1, tone = "mid", extra = "") => {
    const d = [to[0] - from[0], to[1] - from[1], 0];
    const len = Math.hypot(d[0], d[1]);
    const u = [d[0] / len, d[1] / len, 0];
    const F = G.frameOf([from[0], from[1], 0], [0, 0, 1], u, [-u[1], u[0], 0]);
    L.prism(T, F, G.stadium(r, r, len), z0, z1, { tone }, { name: N(part), extra });
  };
  const faceX = (x, pts) => pts.map(([y, z]) => [x, y, z]);
  const faceY = (y, pts) => pts.map(([x, z]) => [x, y, z]);
  const slotY = (y, x0, x1, z0, z1, r = 0.8) => {
    const pts = [];
    for (const [cx, cz, a0] of [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, 90], [x0 + r, z0 + r, 180], [x1 - r, z0 + r, 270]])
      for (let s = 0; s <= 4; s++) { const a = ((a0 + s * 22.5) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]); }
    return k.pathOf(pts.map(at), true);
  };
  const slotX = (x, y0, y1, z0, z1, r = 0.8) => {
    const pts = [];
    for (const [cy, cz, a0] of [[y1 - r, z1 - r, 0], [y0 + r, z1 - r, 90], [y0 + r, z0 + r, 180], [y1 - r, z0 + r, 270]])
      for (let s = 0; s <= 4; s++) { const a = ((a0 + s * 22.5) * Math.PI) / 180; pts.push([x, cy + r * Math.cos(a), cz + r * Math.sin(a)]); }
    return k.pathOf(pts.map(at), true);
  };
  const seg = (a, b) => k.segment(a, b, P);
  const faceDots = (points, size = 0.45) => Dots(points.map(at), { size, tone: "mid" });
  // a plate in the y-z plane with a rectangular pass-through for the wafer, as four slabs around the hole
  const plateWithHole = (part, [x0, x1], [y0, y1], [z0, z1], hole, tone = "lo") => {
    box(`${part}-low`, [x0, y0, z0], [x1, y1, hole.z0], tone);
    box(`${part}-high`, [x0, y0, hole.z1], [x1, y1, z1], tone);
    box(`${part}-back`, [x0, y0, hole.z0], [x1, hole.y0, hole.z1], tone, { bevel: 0 });
    box(`${part}-front`, [x0, hole.y1, hole.z0], [x1, y1, hole.z1], tone, { bevel: 0 });
  };

  // ---- base: levelling feet and the steel plinth --------------------------------------------------------------
  const feet = [];
  for (const x of [X0 + 8, -450, -310, X1 - 8]) for (const y of [Y_BACK + 8, Y_FRONT - 8]) feet.push([x, y]);
  for (const [x, y] of feet) {
    disc("foot-pad", x, y, 0, 1.2, 4.2, "lo");
    disc("foot", x, y, 1.2, Z_PLINTH[0], 2.6, "mid");
  }
  const plinthPlan = { x: X0, y: Y_BACK, w: X1 - X0, d: Y_FRONT - Y_BACK, r: 1 };
  ctx.back.push(`<path class="iso-halo" d="${k.haloOf(plinthPlan, 0, 6, P)}"/>`);
  L.slab(T, plinthPlan, Z_PLINTH[0], Z_PLINTH[1] - Z_PLINTH[0], { tone: "lo" }, { name: N("plinth"), bevel: 1, steps: 3,
    inner: Ln([-450, -310, -200].map((x) => seg([x, Y_FRONT, Z_PLINTH[0]], [x, Y_FRONT, Z_PLINTH[1]])).join("") + seg([X1, Y_BACK, 6.5], [X1, Y_FRONT, 6.5]), { tone: "faint" }),
    extra: faceDots([-590, -460, -440, -320, -300, -210].map((x) => [x, Y_FRONT, 6.5])) });

  // ---- carrier block D1: back and side walls, roof, FOUP openers behind the dock plane, the transfer robot ---------
  const Z_D1 = 150;   // DERIVED: openers to z 140 [TAS300 1386 frame on the floor] plus a 10 cm roof beam
  box("d1-back", [D1[0], Y_BACK, Z_PLINTH[1]], [D1[1], Y_BACK + 4, Z_D1], "lo", {
    inner: Ln([-560, -520, -480].map((x) => seg([x, Y_BACK + 4, Z_PLINTH[1]], [x, Y_BACK + 4, Z_D1])).join(""), { tone: "faint" }) });
  box("d1-side", [D1[0], Y_BACK + 4, Z_PLINTH[1]], [D1[0] + 4, 126, Z_D1], "lo");
  box("d1-roof", [D1[0], Y_BACK, Z_D1], [D1[1], Y_FRONT, Z_D1 + 4], "mid", { bevel: 1,
    inner: Ln(seg([-525, Y_FRONT, Z_D1], [-525, Y_FRONT, Z_D1 + 4]), { tone: "faint" }) });
  const ffu = (part, x0, x1, y0, y1, z) => {
    const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 1.2 };
    const top = z + 10;   // DERIVED: 10 cm FFU, fan plus ULPA filter, the class used on tool roofs (ESTIMATED)
    const grille = k.dotGrid(x0 + 6, y0 + 8, Math.floor((x1 - x0 - 12) / 6) + 1, Math.floor((y1 - y0 - 30) / 6) + 1, 6, top, P);
    const vent = { x: x0 + 6, y: y1 - 14, w: x1 - x0 - 12, d: 4, r: 1.5 };
    L.slab(T, plan, z, 10, { tone: "mid" }, { name: N(part), bevel: 1, steps: 3,
      inner: Ln(k.sideSeam(plan, z + 3, P, 3), { tone: "faint" }),
      extra: Dots(grille, { size: 0.4, tone: "lo" }) + Ln(k.planOutline(vent, top, P, 3) + k.planOutline(k.insetPlan(plan, 2.5), top, P, 3), { tone: "faint" }) + L.screwsOn(k.corners(plan, 1.6), top, { ring: 0.9 }) });
  };
  ffu("d1-ffu", D1[0] + 4, D1[1] - 4, -40, 110, Z_D1 + 4);

  // status light column on the carrier roof, the operator side; DERIVED: r 2.3 lenses, a standard 50-ish mm signal tower (ESTIMATED)
  disc("beacon-base", -590, 120, Z_D1 + 4, Z_D1 + 6, 3, "mid");
  disc("beacon-post", -590, 120, Z_D1 + 6, Z_D1 + 16, 1.1, "mid");
  ["beacon-red", "beacon-amber", "beacon-green"].forEach((part, index) => disc(part, -590, 120, Z_D1 + 16 + index * 4, Z_D1 + 20 + index * 4, 2.3, "hi", { extra: Ln(G.arcOf(up(-590, 120, Z_D1 + 16 + index * 4), 2, 2.3, P), { tone: "faint" }) }));
  disc("beacon-cap", -590, 120, Z_D1 + 28, Z_D1 + 29, 2.3, "mid");

  // BOLTS plate on the dock plane: sill, lintel and posts round three door openings
  const BOLT_Y = [126, Y_FRONT];
  box("bolts-sill", [D1[0], BOLT_Y[0], Z_PLINTH[1]], [D1[1], BOLT_Y[1], OPEN.z0], "mid", {
    inner: Ln(PORTS_X.map((x) => seg([x - OPEN.half, Y_FRONT, Z_PLINTH[1]], [x - OPEN.half, Y_FRONT, OPEN.z0]) + seg([x + OPEN.half, Y_FRONT, Z_PLINTH[1]], [x + OPEN.half, Y_FRONT, OPEN.z0])).join(""), { tone: "faint" }),
    extra: faceDots(PORTS_X.flatMap((x) => [[x - 14, Y_FRONT, 76], [x + 14, Y_FRONT, 76], [x - 14, Y_FRONT, 16], [x + 14, Y_FRONT, 16]])) });
  box("bolts-lintel", [D1[0], BOLT_Y[0], OPEN.z1], [D1[1], BOLT_Y[1], 140], "mid", {
    extra: faceDots(PORTS_X.flatMap((x) => [[x - 14, Y_FRONT, 132], [x + 14, Y_FRONT, 132]])) });
  const posts = [[D1[0], PORTS_X[0] - OPEN.half], [PORTS_X[0] + OPEN.half, PORTS_X[1] - OPEN.half], [PORTS_X[1] + OPEN.half, PORTS_X[2] - OPEN.half], [PORTS_X[2] + OPEN.half, D1[1]]];
  posts.forEach(([x0, x1], index) => box(`bolts-post${index}`, [x0, BOLT_Y[0], OPEN.z0], [x1, BOLT_Y[1], OPEN.z1], "mid", { bevel: 0 }));
  PORTS_X.forEach((x, index) => {
    const open = x === PORTS.foupDock.at[0];
    box(`opener${index}-drive`, [x - 6, 112, Z_PLINTH[1]], [x + 6, 119, open ? 70 : 80], "mid", {
      inner: Ln(k.sideSeam({ x: x - 6, y: 112, w: 12, d: 7, r: 0.4 }, 30, P, 3), { tone: "faint" }),
      extra: faceDots([[x - 3.5, 119, 62], [x + 3.5, 119, 62]]) });
    const door = open ? [[x - 17.9, 119, 40], [x + 17.9, 122, OPEN.z0 - 1]] : [[x - 17.9, 126.2, OPEN.z0 + 0.1], [x + 17.9, 129, OPEN.z1 - 0.1]];
    const face = door[1][1];
    const zc = (door[0][2] + door[1][2]) / 2;
    // latch keys at ±129 mm about the door centre [SEMI AUX018]
    box(`opener${index}-door`, door[0], door[1], "mid", { bevel: 0.6,
      extra: Ln([-12.9, 12.9].map((dx) => slotY(face, x + dx - 0.25, x + dx + 0.25, zc - 2.6, zc + 2.6, 0.24)).join("") + slotY(face, x - 15, x + 15, door[0][2] + 3, door[1][2] - 3, 1.5), { tone: "faint" }) });
  });

  // transfer robot: x traverse rail, carriage, vertical axis; the arm reaches through the open door to the FOUP
  const ROBOT = [-530, 60];   // DERIVED: shoulder 70 behind the dock plane so the folded arm clears the door openers; column r 7
  box("robot-rail", [-592, 56, Z_PLINTH[1]], [-468, 64, 13], "mid", { extra: Ln(k.lineOnTop([-590, 60], [-470, 60], 13, P), { tone: "faint" }) });
  box("robot-stop-l", [-596, 54, Z_PLINTH[1]], [-592, 66, 16], "mid");
  box("robot-stop-r", [-468, 54, Z_PLINTH[1]], [-464, 66, 16], "mid");
  box("robot-carriage", [ROBOT[0] - 11, 49, 13], [ROBOT[0] + 11, 71, 18], "mid", { bevel: 0.8,
    extra: L.screwsOn(k.corners({ x: ROBOT[0] - 11, y: 49, w: 22, d: 22 }, 2), 18, { ring: 0.8 }) });
  L.turned(T, up(ROBOT[0], ROBOT[1], 18), [[0, 9.5], [3, 9.5], [3, 7], [ZR - 26, 7], [ZR - 24, 6.4], [ZR - 18, 6.4]], { tone: "mid" }, { name: N("robot-column"),
    inner: G.arcOf(up(ROBOT[0], ROBOT[1], 18), 30, 7, P) });
  // DERIVED: links of 38 put the fork centre 88 out, past the FOUP wafer centre 16.5 beyond the door seal [AUX018]
  const SH = ROBOT, WR = [ROBOT[0], 96], EL = [ROBOT[0] - Math.sqrt(38 ** 2 - 18 ** 2), 78];
  L.live("trackRobot", () => {
    disc("live-trackRobot.hub", SH[0], SH[1], ZR, ZR + 4, 6.4, "hi", { extra: Dots([at([SH[0], SH[1], ZR + 4])], { size: 0.5 }) });
    link("live-trackRobot.link1", SH, EL, 5.5, ZR + 4, ZR + 7, "hi");
    link("live-trackRobot.link2", EL, WR, 4, ZR + 7, ZR + 10.5, "hi");
    disc("live-trackRobot.elbow", EL[0], EL[1], ZR + 10.5, ZR + 11.3, 2.6, "mid");
    box("live-trackRobot.palm", [WR[0] - 7, WR[1] - 3, ZR + 10.5], [WR[0] + 7, WR[1] + 4, ZR + 11.5], "hi", { bevel: 0.3 });
    box("live-trackRobot.tine-l", [WR[0] - 7, WR[1] + 4, ZR + 10.5], [WR[0] - 4.5, WR[1] + 22, ZR + 11.5], "hi", { bevel: 0.3 });
    box("live-trackRobot.tine-r", [WR[0] + 4.5, WR[1] + 4, ZR + 10.5], [WR[0] + 7, WR[1] + 22, ZR + 11.5], "hi", { bevel: 0.3 });
  });

  // ---- walls, towers and the roof of the process block ------------------------------------------------------------
  box("back-wall", [T1[0], Y_BACK, Z_PLINTH[1]], [TX[0], Y_BACK + 4, Z_TOP], "lo", {
    inner: Ln([-380, -300, -230].map((x) => seg([x, Y_BACK + 4, Z_PLINTH[1]], [x, Y_BACK + 4, Z_TOP])).join("") + LAYERS.filter(({ L: z }) => Math.abs(z - Z_TX) > 8).map(({ L: z }) => k.pathOf([[T1[0], Y_BACK + 4, z], [TX[0], Y_BACK + 4, z], [TX[0], Y_BACK, z]].map(at))).join(""), { tone: "faint" }) });
  const T1_HOLE_LOW = { y0: 30, y1: 90, z0: ZD - 6, z1: ZD + 8 };   // DERIVED: pass-through for the carrier fork and wafer
  plateWithHole("t1-plate-l", [T1[0], T1[0] + 3], [FLOOR_Y[0], FLOOR_Y[1]], [Z_PLINTH[1], Z_TOP], T1_HOLE_LOW);
  const hero = LAYERS.find((layer) => layer.hero);
  const T1_HOLE_HERO = { y0: 22, y1: 64, z0: hero.F + 6, z1: hero.F + 18 };
  plateWithHole("t1-plate-r", [T1[1] - 3, T1[1]], [FLOOR_Y[0], FLOOR_Y[1]], [Z_PLINTH[1], Z_TOP], T1_HOLE_HERO);
  const T1_SHELF = [{ z: ZD - 2, part: "t1-trs" }, ...LAYERS.map((layer) => ({ z: layer.F, part: `t1-shelf-${layer.id}` }))];
  for (const { z, part } of T1_SHELF)
    box(part, [T1[0] + 3, 30, z], [T1[1] - 3, 90, z + 1], "mid", { bevel: 0.3, extra: Dots([[-435, 52], [-440, 66], [-430, 66]].map(([x, y]) => at([x, y, z + 1])), { size: 0.45, tone: "mid" }) });
  disc("t1-lift-column", -435, 0, Z_PLINTH[1], Z_TOP, 2.5, "mid", { extra: "" });
  box("t1-lift-carriage", [-441, 2.5, hero.F + 6], [-429, 12, hero.F + 12], "mid");
  box("t1-lift-fork", [-439, 12, hero.F + 11], [-431, 40, hero.F + 11.6], "hi", { bevel: 0.2 });

  // exit tower: side plate with the pass-through from the hero layer, a closed front panel, the end wall
  box("tx-back", [TX[0], Y_BACK, Z_PLINTH[1]], [X1 - 5, Y_BACK + 4, Z_TX], "lo");
  plateWithHole("tx-plate", [TX[0], TX[0] + 3], [FLOOR_Y[0], 125], [Z_PLINTH[1], Z_TX], { y0: 22, y1: 64, z0: hero.F + 6, z1: hero.F + 18 });
  const ZW = PORTS.waferHandoff.at[2];
  const panelSeams = [118].map((z) => seg([TX[0] + 3, 129.4, z], [-165, 129.4, z])).join("");
  box("tx-front", [TX[0] + 3, 125, Z_PLINTH[1]], [-165, 129.4, Z_TX], "mid", { bevel: 0.8,
    inner: Ln(panelSeams, { tone: "faint" }),
    extra: faceDots([[TX[0] + 6, 129.4, 120.5], [-168, 129.4, 120.5], [TX[0] + 7.6, 129.4, 30], [TX[0] + 7.6, 129.4, 96]]) + Ln(slotY(129.4, TX[0] + 5.5, -168.5, 14, 112, 1.2), { tone: "lo" }) + Ln(slotY(129.4, TX[0] + 9, -171, 22, 52, 1.5) + slotY(129.4, TX[0] + 9, -171, 30, 32, 0.6) + slotY(129.4, TX[0] + 9, -171, 38, 40, 0.6), { tone: "faint" }) });
  box("tx-handle", [-175, 129.4, 60], [-172.5, 130, 72], "mid", { bevel: 0.2 });
  // label plate: rule lines stand for printed text
  box("label-plate", [TX[0] + 8, 129.4, 154], [-170, 130, 168], "lo", { bevel: 0.2,
    extra: Ln(slotY(130, TX[0] + 9.2, -171.2, 155.2, 166.8, 0.5), { tone: "faint" }) + Ln(seg([TX[0] + 11, 130, 163.5], [-179, 130, 163.5]) + seg([TX[0] + 11, 130, 160.5], [-174, 130, 160.5]) + seg([TX[0] + 11, 130, 157.5], [-186, 130, 157.5]), { tone: "lo", free: true }) + faceDots([[TX[0] + 9.6, 130, 161], [-171.6, 130, 161]], 0.4) });
  const wallSeams = [-20, 50].map((y) => seg([X1, y, Z_PLINTH[1]], [X1, y, Z_TX])).join("") + [60, 110].map((z) => k.sideSeam({ x: X1 - 5, y: Y_BACK, w: 5, d: Y_FRONT - Y_BACK, r: 0.4 }, z, P, 3)).join("");
  const wallScrews = [-20, 50].flatMap((y) => [60, 110].flatMap((z) => [[X1, y - 3, z - 3], [X1, y + 3, z - 3], [X1, y - 3, z + 3], [X1, y + 3, z + 3]]));
  const HAND = { y0: -18, y1: 18, z0: ZW - 6, z1: ZW + 7 };   // DERIVED: a 36 x 13 slot passes a 300 mm wafer on a fork
  plateWithHole("end-wall", [X1 - 5, X1], [Y_BACK, Y_FRONT], [Z_PLINTH[1], Z_TX], HAND, "mid");
  L.put(T, [X1, 0, 120], Ln(wallSeams, { tone: "faint" }) + faceDots(wallScrews, 0.42) + Ln(slotX(X1 + 0.01, HAND.y0 - 3, HAND.y1 + 3, HAND.z0 - 3, HAND.z1 + 3, 2), { tone: "lo" }), { name: N("end-wall-skin"), bias: 0.5, shapes: [L.record(A.box([X1 - 0.05, Y_BACK, Z_PLINTH[1]], [X1, Y_FRONT, Z_TX], { name: N("end-wall-skin") }))] });
  box("tx-cap", [TX[0], Y_BACK, Z_TX], [X1, Y_FRONT, Z_TX + 3], "mid", { bevel: 1 });

  // process-block roof over the uncut part, its fan filter units and the exhaust header on the back wall
  box("roof", [T1[0], FLOOR_Y[0], Z_TOP], [CUT, Y_FRONT, Z_TOP + 4], "mid", { bevel: 1,
    inner: Ln(seg([-380, Y_FRONT, Z_TOP], [-380, Y_FRONT, Z_TOP + 4]), { tone: "faint" }) });
  ffu("ffu-a", T1[0] + 4, -382, -40, 122, Z_TOP + 4);
  ffu("ffu-b", -378, CUT + 4, -40, 122, Z_TOP + 4);
  const HEADER = { x: -440, y: Y_BACK + 1, w: 200, d: FLOOR_Y[0] - Y_BACK - 1, r: 1.5 };
  L.slab(T, HEADER, Z_TOP, 8, { tone: "mid" }, { name: N("exhaust-header"), bevel: 1, steps: 3,
    inner: Ln(k.sideSeam(HEADER, Z_TOP + 4, P, 3) + [-380, -310].map((x) => seg([x, FLOOR_Y[0], Z_TOP], [x, FLOOR_Y[0], Z_TOP + 8])).join(""), { tone: "faint" }) });
  L.boss(T, [-340, CHASE_Y, Z_TOP + 8], [0, 0, 1], 6.5, 3, { name: N("exhaust-outlet"), tone: "mid" });
  L.flangeAt(T, [-340, CHASE_Y, Z_TOP + 11.6], [0, 0, 1], 8.4, 1.2, { bolts: 8, tone: "mid", name: N("exhaust-outlet-flange") });
  for (const x of [-400, -260])
    L.pipe(T, [[x, CHASE_Y, Z_PLINTH[1]], [x, CHASE_Y, Z_TOP]], 4.5, { name: N(`exhaust-riser${x}`), bands: [0.3, 0.62], flangeR: 1.35, maxLength: 40 });

  // posts that carry the cut-back DEV floors and the roof at x CUT
  const upper = LAYERS.filter((layer) => layer.short);
  for (const [y0, y1] of [[122, 128], [-46, -43]])
    for (const z0 of [hero.F, ...upper.map((layer) => layer.F)]) {
      const z1 = z0 === hero.F ? upper[0].L : z0 === upper[0].F ? upper[1].L : Z_TOP;
      box(`cut-post${y0}`, [CUT - 4, y0, z0], [CUT, y1, z1], "mid", { bevel: 0.3 });
    }

  // ---- chemical supply cabinet under the process block --------------------------------------------------------
  const CAB = [Z_PLINTH[1], LAYERS[0].L];
  for (const [index, x0] of [-404, -336, -268].entries()) {
    const bottle = [x0, 108];   // DERIVED: Ø16 x 26 is a 4 L resist bottle (≈ π·8²·20 = 4.0 L of body)
    L.turned(T, up(bottle[0], bottle[1], CAB[0]), [[0, 7.6], [0.8, 8], [18, 8], [21, 6.8], [23, 3.6], [24, 2.6], [26, 2.6]], { tone: "mid" }, { name: N(`bottle${index}`), smooth: false,
      inner: G.arcOf(up(bottle[0], bottle[1], CAB[0]), 5, 8, P) + G.arcOf(up(bottle[0], bottle[1], CAB[0]), 15, 8, P) });
    disc(`bottle${index}-cap`, bottle[0], bottle[1], CAB[0] + 26, CAB[0] + 28, 3.2, "mid");
    const pump = { x: x0 + 16, y: 103, w: 12, d: 10, r: 0.6 };   // DERIVED: a bellows dispense pump sized for 0.5 mL shots [US8043657], ESTIMATED housing
    L.slab(T, pump, CAB[0], 12, { tone: "mid" }, { name: N(`pump${index}`), bevel: 0.6, steps: 3, inner: Ln(k.sideSeam(pump, CAB[0] + 3, P, 3), { tone: "faint" }) });
    disc(`pump${index}-motor`, x0 + 24.5, 108, CAB[0] + 12, CAB[0] + 20, 3, "mid", { extra: Ln(G.circleOf(up(x0 + 24.5, 108), CAB[0] + 20, 1.6, P), { tone: "faint" }) });
    const manifold = { x: x0 + 35, y: 102, w: 10, d: 12, r: 0.6 };
    L.slab(T, manifold, CAB[1] - 7, 7, { tone: "mid" }, { name: N(`bulkhead${index}`), bevel: 0.5, steps: 3,
      extra: L.screwsOn([[x0 + 37, 104], [x0 + 43, 112]], CAB[1], { ring: 0.6 }) });
    L.turned(T, up(x0 + 40, 108, CAB[1] - 21), [[0, 0], [0, 2.4], [1.2, 3.6, 1], [3, 4.2, 1], [11, 4.2], [11, 3.2], [14, 3.2]], { tone: "hi" }, { name: N(`filter${index}`),
      inner: G.arcOf(up(x0 + 40, 108, CAB[1] - 21), 9, 4.2, P) });
    L.pipe(T, [[bottle[0], bottle[1], CAB[0] + 28], [bottle[0], bottle[1], CAB[0] + 31], [x0 + 19, bottle[1], CAB[0] + 31], [x0 + 19, bottle[1], CAB[0] + 12]], 1.2, { name: N(`suction${index}`), bend: 3 });
    L.pipe(T, [[x0 + 28, 108, CAB[0] + 6], [x0 + 40, 108, CAB[0] + 6], [x0 + 40, 108, CAB[1] - 21]], 1.2, { name: N(`delivery${index}`), bend: 3 });
    L.turned(T, up(x0 + 52, 112, CAB[0]), [[0, 6.6], [0.8, 7], [17, 7], [20, 5.6], [22, 2.4], [24, 2.4]], { tone: "mid" }, { name: N(`spare-bottle${index}`), smooth: false });
    disc(`spare-bottle${index}-cap`, x0 + 52, 112, CAB[0] + 24, CAB[0] + 26, 3, "mid");
  }

  // ---- the six process layers -------------------------------------------------------------------------------------
  const stations = {};
  for (const layer of LAYERS) {
    const { id, F, L: z0, hero: isHero } = layer;
    const x1 = layer.short ? CUT : D2[1];
    const floorPlan = { x: D2[0], y: FLOOR_Y[0], w: x1 - D2[0], d: FLOOR_Y[1] - FLOOR_Y[0], r: 0.4 };
    L.slab(T, floorPlan, z0, FLOOR_T, { tone: "lo" }, { name: N(`floor-${id}`), bevel: 0.4, steps: 2,
      inner: Ln([-366, -270].filter((x) => x < x1).map((x) => seg([x, FLOOR_Y[1], z0], [x, FLOOR_Y[1], F])).join(""), { tone: "faint" }),
      extra: Ln(k.lineOnTop([D2[0] + 1, 68], [x1 - 1, 68], F, P), { tone: "faint" }) });

    // shuttle rail along the corridor, end stops
    box(`rail-${id}`, [D2[0] + 4, RAIL_Y[0], F], [x1 - 4, RAIL_Y[1], F + 2], "mid", { bevel: 0.3,
      extra: Ln(k.lineOnTop([D2[0] + 5, 29], [x1 - 5, 29], F + 2, P), { tone: "faint" }) });
    box(`rail-stop-${id}`, [D2[0] + 4, RAIL_Y[0] - 2, F + 2], [D2[0] + 7, RAIL_Y[1] + 2, F + 5], "mid", { bevel: 0.2 });
    const cx = isHero ? SHUTTLE_X : D2[0] + 40 + 30 * (LAYERS.indexOf(layer) % 3);
    const shuttle = () => {
      box(isHero ? "live-shuttle.carriage" : `carriage-${id}`, [cx - 8, RAIL_Y[0] - 5, F + 2], [cx + 8, RAIL_Y[1] + 5, F + 6], "mid", { bevel: 0.5,
        extra: L.screwsOn(k.corners({ x: cx - 8, y: RAIL_Y[0] - 5, w: 16, d: 16 }, 1.6), F + 6, { ring: 0.7 }) });
      disc(isHero ? "live-shuttle.turret" : `turret-${id}`, cx, 29, F + 6, F + 8, 6, "mid");
      box(isHero ? "live-shuttle.head" : `head-${id}`, [cx - 5, 23, F + 8], [cx + 5, 35, F + 12], isHero ? "hi" : "mid", { bevel: 0.4 });
      if (!isHero) return;
      // two forks, one above the other [US9377691 main arm with 2 forks]
      for (const [fork, za] of [["lower", F + 9], ["upper", F + 11]]) {
        box(`live-shuttle.${fork}-palm`, [cx - 7, 35, za], [cx + 7, 39, za + 0.6], "hi", { bevel: 0.15 });
        box(`live-shuttle.${fork}-tine-l`, [cx - 7, 39, za], [cx - 4.6, 58, za + 0.6], "hi", { bevel: 0.15 });
        box(`live-shuttle.${fork}-tine-r`, [cx + 4.6, 39, za], [cx + 7, 58, za + 0.6], "hi", { bevel: 0.15 });
      }
    };
    if (isHero) L.live("shuttle", shuttle);
    else shuttle();

    // coat or develop cups along the front
    const cups = CUP_X.filter((x) => x + CUP_R < x1 - 2);
    cups.forEach((x, index) => {
      const Fc = up(x, CUP_Y, F);   // DERIVED: lip bore 15.5 clears the 15 wafer radius; chuck r 7 holds the back centre only
      L.turned(T, Fc, [[0, CUP_R - 1.4], [1, CUP_R], [9, CUP_R], [11.4, 19.6, 1], [12, 19]], { tone: "mid" }, { name: N(`cup-${id}-${index}`),
        inner: G.arcOf(Fc, 4.5, CUP_R, P),
        extra: `<path class="iso-shade" data-shade="0" d="${G.circleOf(Fc, 12, 15.5, P)}"/>` });
      lip(`cup-lip-${id}-${index}`, Fc, 12, 14, 15.5, 19, "mid");
      disc(`chuck-${id}-${index}`, x, CUP_Y, F + 12, F + 12.8, 7, isHero ? "hi" : "mid", { extra: Ln(G.circleOf(Fc, 12.8, 4.4, P) + G.circleOf(Fc, 12.8, 1.4, P), { tone: "faint" }) });
      // dispense arm: a drive box beside the cup, the arm swung over the chuck, the nozzle at its tip
      const side = index === 2 ? -1 : 1;   // the third cup swings its arm in from the WEE side, clear of the exit tower
      const pivot = [x + side * 25.5, CUP_Y - 22];
      const u = G.unit3([x - pivot[0], CUP_Y - pivot[1], 0]);
      const tail = [pivot[0] - 9 * u[0], pivot[1] - 9 * u[1]];
      box(`dispense-drive-${id}-${index}`, [pivot[0] - 4.5, pivot[1] - 4.5, F], [pivot[0] + 4.5, pivot[1] + 4.5, F + 15], "mid", { bevel: 0.5,
        inner: Ln(k.sideSeam({ x: pivot[0] - 4.5, y: pivot[1] - 4.5, w: 9, d: 9, r: 0.4 }, F + 11, P, 3), { tone: "faint" }) });
      link(`dispense-arm-${id}-${index}`, tail, [x, CUP_Y], 1.6, F + 15, F + 16.2, isHero ? "hi" : "mid");
      L.turned(T, up(x, CUP_Y, F + 13.6), [[0, 0.4], [0.5, 0.8], [1.4, 0.8]], { tone: isHero ? "hi" : "mid" }, { name: N(`nozzle-${id}-${index}`) });
      if (layer.kind === "COT") {
        box(`suckback-valve-${id}-${index}`, [tail[0] - 2, tail[1] - 2, F], [tail[0] + 2, tail[1] + 2, F + 4], "mid", { bevel: 0.3 });
        L.cable(T, [[tail[0], tail[1], F + 4], [tail[0], tail[1], F + 15]], { r: 0.5, name: N(`resist-line-${id}-${index}`) });
      }
      if (isHero && index === 2) stations.coat = [x, CUP_Y, F + 13.3];
      if (layer.id === "dev1" && index === 0) stations.develop = [x, CUP_Y, F + 13.3];
    });

    // bake and chill plates along the back
    PLATES.forEach((kind, index) => {
      const mx = modX(index);
      if (mx + MOD_W / 2 > x1) return;
      const plan = { x: mx - 17, y: MOD_Y[0], w: 34, d: MOD_Y[1] - MOD_Y[0], r: 0.6 };
      const detail = isHero || layer.id === "dev1";
      L.slab(T, plan, F, 8, { tone: "mid" }, { name: N(`${kind}-${id}-${index}`), bevel: 0.6, steps: 3,
        inner: Ln(k.sideSeam(plan, F + 2.5, P, 3), { tone: "faint" }),
        extra: detail ? faceDots([[mx - 14, MOD_Y[1], F + 5.5], [mx + 14, MOD_Y[1], F + 5.5]], 0.4) + Ln(slotY(MOD_Y[1], mx - 8, mx + 4, F + 4.4, F + 6.4, 0.5), { tone: "faint" }) : "" });
      const Fp = up(mx, MOD_C, F + 8);   // DERIVED: Ø30 plate = the wafer; 8-tall housing for heater, lift-pin drive and cover seal
      disc(`${kind}-plate-${id}-${index}`, mx, MOD_C, F + 8, F + 9.5, 15, kind === "hot" && isHero ? "hi" : "mid", {
        extra: Ln(G.circleOf(Fp, 1.5, 11, P), { tone: "faint" }) });
      if (!detail) return;
      [0, 1, 2].forEach((pin) => {
        const a = (pin * 2 * Math.PI) / 3 + 0.4;
        disc(`${kind}-pin-${id}-${index}`, mx + 6 * Math.cos(a), MOD_C + 6 * Math.sin(a), F + 9.5, F + 11, 0.6, "hi");
      });
      if (kind === "hot") {   // DERIVED: the cover rides 10 up on four rods, room for the fork to pass over the pins
        for (const [dx, y] of [[-15, -39.5], [15, -39.5], [-15, -8.5], [15, -8.5]]) disc(`${kind}-lid-rod-${id}-${index}`, mx + dx, y, F + 8, F + 18, 0.8, "mid");
        const lid = { x: mx - 17, y: MOD_Y[0], w: 34, d: MOD_Y[1] - MOD_Y[0], r: 1.2 };
        L.slab(T, lid, F + 18, 2, { tone: "mid" }, { name: N(`hot-lid-${id}-${index}`), bevel: 0.6, steps: 3,
          extra: Ln(k.planOutline(k.insetPlan(lid, 3), F + 20, P, 3), { tone: "faint" }) + L.screwsOn(k.corners(lid, 2), F + 20, { ring: 0.7 }) });
        L.boss(T, [mx + 10, MOD_Y[1], F + 4], [0, 1, 0], 1.3, 1.4, { name: N(`hot-connector-${id}-${index}`), tone: "mid" });
      }
      if (isHero && index === 4) stations.bake = [mx, MOD_C, F + 11.5];
      if (layer.id === "dev1" && index === 1) stations.peb = [mx, MOD_C, F + 11.5];
    });

    if (isHero) {
      // cable-chain trough beside the rail, the flat chain lying in it from the fixed end to the carriage bracket
      box("chain-trough", [D2[0] + 4, 38, F], [x1 - 4, 44, F + 1.2], "lo", { bevel: 0.2 });
      const chainEnd = SHUTTLE_X - 8;
      box("cable-chain", [D2[0] + 8, 38.6, F + 1.2], [chainEnd, 43.4, F + 3.2], "mid", { bevel: 0.2,
        extra: Ln(Array.from({ length: Math.floor((chainEnd - D2[0] - 12) / 4) }, (_, i) => k.lineOnTop([D2[0] + 10 + 4 * i, 38.6], [D2[0] + 10 + 4 * i, 43.4], F + 3.2, P)).join(""), { tone: "faint" }) });
      box("chain-anchor", [D2[0] + 4, 37, F + 1.2], [D2[0] + 8, 45, F + 4.5], "mid", { bevel: 0.2 });
      // perforated downflow floor panel under the corridor, beside the plates
      const perf = { x: -306, y: -2, w: 100, d: 20, r: 0.6 };
      L.slab(T, perf, F, 0.6, { tone: "lo" }, { name: N("perf-panel"), bevel: 0, steps: 2, extra: Dots(k.dotGrid(-302, 2, 25, 4, 4, F + 0.6, P), { size: 0.4, tone: "mid" }) });
      // wafer-edge exposure unit in the gap between the second and third cups; DERIVED: 20 x 28 housing for a Ø30 edge, ESTIMATED
      box("wee", [-308, 84, F], [-288, 112, F + 10], "mid", { bevel: 0.6,
        inner: Ln(k.sideSeam({ x: -308, y: 84, w: 20, d: 28, r: 0.4 }, F + 3, P, 3), { tone: "faint" }),
        extra: Ln(slotY(112, -304, -292, F + 5.5, F + 7.5, 0.6), { tone: "faint" }) });
      L.turned(T, up(-298, 98, F + 10), [[0, 4.4], [5, 4.4], [6, 3.4]], { tone: "hi" }, { name: N("wee-lamp") });
    }
  }

  // ---- the wafer's path and the stations it visits ------------------------------------------------------------------
  const dock = PORTS.foupDock.at;
  const wHero = hero.F + 12;
  const zTRS = ZD - 0.5;
  const track = [
    [dock[0], dock[1] - 5, dock[2]],
    [WR[0], WR[1] + 12, dock[2]],
    [ROBOT[0] + 25, 76, dock[2]],
    [T1[0] - 10, 60, zTRS],
    [-435, 60, zTRS],
    [-435, 30, zTRS],
    [-435, 30, wHero],
    [D2[0] + 10, 48, wHero],
    [stations.coat[0], 48, wHero],
    stations.coat,
    [stations.coat[0], 48, wHero],
    [stations.bake[0], 48, wHero],
    stations.bake,
    [stations.bake[0], 48, wHero],
    [modX(5), 48, wHero],
    [modX(5), MOD_C, hero.F + 11.5],
    [modX(5), 48, wHero],
    [TX[0] + 18, 43, wHero],
    [TX[0] + 18, 0, wHero],
    [TX[0] + 18, 0, ZW],
    [X1 - 3, 0, ZW],
  ];
  ctx.shared.waferPath = { ...(ctx.shared.waferPath || {}), track };
  ctx.shared.trackStations = { ...(ctx.shared.trackStations || {}), coat: stations.coat, bake: stations.bake, develop: stations.develop, peb: stations.peb, chill: [modX(5), MOD_C, hero.F + 11.5] };
}
