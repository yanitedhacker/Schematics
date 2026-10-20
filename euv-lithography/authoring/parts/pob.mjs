// Projection optics and the metrology frame. A heavy metro plate on four airmounts carries the six-mirror POB
// (hung on its collar flange through the plate's notch), the level and alignment sensors at the measure position,
// interferometer reference blocks and the sensor harness. Inside the POB, cut open on +y, M1-M6 fold the light in an
// unobscured zig-zag from the mask to the wafer, each mirror on three flexure pads on a mount plate with rigid-body
// actuators; a dynamic gas lock cone with its membrane closes the exit and takes the downward H2 purge.
// Sources: REFERENCES.md (US20260016756A1, US7151592B2, Lowisch 2012, Heil 2015, Heertjes 2020).
import { k, G, A } from "../lib.mjs";

const PIECE = "pob";
const NA_WAFER = 0.33;                       // [Lowisch 2012]
const NA_MASK = NA_WAFER / 4;                // 4x reduction [Lowisch 2012]
const CRAO = 6;                              // chief ray at the mask, deg [Lowisch 2012, Heil 2015]

// mirror bounce points as offsets from the wafer point (x along scan, z up)
// DERIVED: annealed layout search: every leg's full-aperture beam clears every other mirror body
// plus its mount, all inside the 77 x 137 patent cuboid; AOI 8-24 deg (normal incidence); intermediate image near M3
// and powers PNPPNP after US7151592B2. M5 is the mirror nearest the wafer (US20260016756A1: "M5 to image 52 mm");
// M6, the largest, sits 56 cm up because NA 0.33 needs a 2*L*tan(19.3 deg) ~ 42 cm footprint at that height.
const MIRRORS = [
  { id: "m1", dz: 76.1, w: 15, c: 28, power: "P" },                 // M1 280 x <180 mm [US20260016756A1]; on the 6 deg ray from the mask
  { id: "m2", dx: 14.8, dz: 126.5, w: 18, c: 30, power: "N" },      // DERIVED: footprint 2*d*tan(4.7 deg) + slit, +2 cm rim
  { id: "m3", dx: 38.6, dz: 79.3, w: 11, c: 22, power: "P" },       // DERIVED: smallest beam, near the intermediate image
  { id: "m4", dx: -11.6, dz: 126.6, w: 20, c: 32, power: "P" },     // DERIVED: diverging beam after the intermediate image
  { id: "m5", dx: -14.1, dz: 17.6, w: 15, c: 26, power: "N" },      // DERIVED: aperture stop at M5 [US20260016756A1]
  { id: "m6", dx: 15.6, dz: 56.4, w: 43, c: 38, power: "P" },       // DERIVED: 2*58.5*tan(19.3)+1.5 = 42.4 scan; cross held to 38 by the 43 cuboid
];

export function build(L, ctx) {
  const { P, OPTIC, MOUNTS, MEASURE, ENV } = ctx;
  const { at, S, Ln, Dots, slab, boxOf, turned, prism, flangeAt, boss, ballAt, elbow, pipe, valveOn, cable, clampAt, put, record, screwsOn } = L;
  const V = L.V;
  const [WX, WY, WZ] = OPTIC.wafer;
  const Z = (d) => WZ + d;
  const add = G.add3, sub = G.sub3, mul = G.mul3, unit = G.unit3, dot = G.dot3;
  const name = (n) => `${PIECE}.${n}`;
  const box = (n, a, b, tone = "mid", options = {}) => boxOf(PIECE, a, b, { tone }, { name: name(n), ...options });
  const plan = (a, b) => ({ x: a[0], y: a[1], w: b[0] - a[0], d: b[1] - a[1], r: 0.4 });
  const seams = (a, b, list, steps = 3) => Ln(list.map((z) => k.sideSeam(plan(a, b), z, P, steps)).join(""), { tone: "faint" });
  const vert = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

  // ---------------- the light path ----------------
  const R = [...OPTIC.reticle];
  const W = [...OPTIC.wafer];
  const tan6 = Math.tan((CRAO * Math.PI) / 180);
  const pts = MIRRORS.map((m) => (m.id === "m1" ? [R[0] - tan6 * (R[2] - Z(m.dz)), 0, Z(m.dz)] : [WX + m.dx, 0, Z(m.dz)]));
  const path = [R, ...pts, W];
  ctx.shared.pobMirrors = path.map((p) => p.map((v) => +v.toFixed(2)));
  ctx.shared.pobNA = { wafer: NA_WAFER, mask: NA_MASK };

  // ---------------- housing: 77 x 43 x 137 [US20260016756A1 cuboid 427 x 774 x 1371 mm] ----------------
  const HX = [84, 161];           // DERIVED: centred between mask (142) and wafer (110) x, widened to hold M6
  const HY = [-21.5, 21.5];
  const T = 1.2;                  // DERIVED: 12 mm stainless skin over internal bulkheads
  const BOT = [Z(6.5), Z(8)];     // DERIVED: bottom plate just under M5's mount, leaving 6.5 cm for the gas lock
  const TOP = [Z(138.5), Z(140)]; // housing top at pobTop
  const CUT_TOP = -6;             // DERIVED: cover cut back to y -6 so both mask legs (POB entry, illuminator relay up to the mask) pass the open top
  const CUT_RIGHT = -6;           // right wall cut back so M3 shows
  const IN_BACK = HY[0] + T;

  // bottom plate cut open in front of the exit so the gas lock shows: a back strip plus a strip under M5
  const BOT_CUT = -4;
  box("bottom-plate", [HX[0], HY[0], BOT[0]], [HX[1], BOT_CUT, BOT[1]], "mid", { inner: seams([HX[0], HY[0]], [HX[1], BOT_CUT], [BOT[0] + 0.75]) });
  box("bottom-plate", [HX[0], BOT_CUT, BOT[0]], [HX[0] + 16, HY[1], BOT[1]], "mid", { inner: seams([HX[0], BOT_CUT], [HX[0] + 16, HY[1]], [BOT[0] + 0.75]) });
  box("back-wall", [HX[0], HY[0], BOT[1]], [HX[1], IN_BACK, TOP[0]], "lo", { inner: Ln([108, 134].map((x) => k.segment([x, IN_BACK, BOT[1]], [x, IN_BACK, TOP[0]], P)).join(""), { tone: "faint" }) });
  box("left-wall", [HX[0], IN_BACK, BOT[1]], [HX[0] + T, HY[1], TOP[0]], "lo");
  box("top-cover", [HX[0], HY[0], TOP[0]], [HX[1], CUT_TOP, TOP[1]], "mid", {
    extra: screwsOn([[HX[0] + 2.5, HY[0] + 2.5], [HX[1] - 2.5, HY[0] + 2.5], [HX[0] + 2.5, CUT_TOP - 2.5], [HX[1] - 2.5, CUT_TOP - 2.5]], TOP[1], { ring: 0.9 }),
  });
  // inner bulkheads: shelves on the back wall between the mirror tiers, wall to wall
  for (const zb of [Z(40), Z(100)]) // DERIVED: tiers fall between M5/M6 (Z 16..64) and M1/M3 (Z 72..85) and M2/M4 (Z 118+)
    box("bulkhead", [HX[0] + T, IN_BACK, zb], [HX[1] - T, IN_BACK + 5, zb + 1.6], "mid", { extra: Dots([0.15, 0.35, 0.65, 0.85].map((f) => at([HX[0] + (HX[1] - HX[0]) * f, IN_BACK + 4, zb + 1.6])), { size: 0.4 }) });
  // illuminator feed port in the right wall: the relay's feed enters at about z 231 on the line [200,0,180] -> [147,0,250]
  // opening 22 wide x 14 tall: the full-cell audit puts the feed beam at z 229.7-238.7 and the relay arm at y -10.4..-9
  const FEED = { y0: -11, y1: 11, z0: 227, z1: 241 };
  const RW = [HX[1] - T, HX[1]];
  const RW_FRONT = FEED.y1 + 2;
  box("right-wall", [RW[0], IN_BACK, BOT[1]], [RW[1], FEED.y0, TOP[0]], "mid", { inner: seams([RW[0], IN_BACK], [RW[1], FEED.y0], [Z(40), Z(100)]) });
  box("right-wall", [RW[0], FEED.y0, BOT[1]], [RW[1], CUT_RIGHT, FEED.z0], "mid", { inner: seams([RW[0], FEED.y0], [RW[1], CUT_RIGHT], [Z(40)]) });
  box("right-wall-upper", [RW[0], CUT_RIGHT, 220], [RW[1], RW_FRONT, FEED.z0], "mid");
  box("right-wall-upper", [RW[0], FEED.y0, FEED.z1], [RW[1], RW_FRONT, TOP[0]], "mid");
  box("right-wall-upper", [RW[0], FEED.y1, FEED.z0], [RW[1], RW_FRONT, FEED.z1], "mid");
  const FL = 0.8, FT = 2;
  box("feed-port-flange", [HX[1], FEED.y0 - FT, FEED.z0 - FT], [HX[1] + FL, FEED.y1 + FT, FEED.z0], "hi", { extra: Dots([-8, -4, 0, 4, 8].map((y) => at([HX[1] + FL, y, FEED.z0 - FT / 2])), { size: 0.4 }) });
  box("feed-port-flange", [HX[1], FEED.y0 - FT, FEED.z1], [HX[1] + FL, FEED.y1 + FT, FEED.z1 + FT], "hi", { extra: Dots([-8, -4, 0, 4, 8].map((y) => at([HX[1] + FL, y, FEED.z1 + FT / 2])), { size: 0.4 }) });
  box("feed-port-flange", [HX[1], FEED.y0 - FT, FEED.z0], [HX[1] + FL, FEED.y0, FEED.z1], "hi");
  box("feed-port-flange", [HX[1], FEED.y1, FEED.z0], [HX[1] + FL, FEED.y1 + FT, FEED.z1], "hi");

  // label plate on the right wall's outer face
  {
    const x = HX[1];
    const y0 = HY[0] + 2, y1 = FEED.y0 - 1.5, z0 = Z(58), z1 = Z(68);
    box("label", [x, y0, z0], [x + 0.4, y1, z1], "lo", {
      extra: Ln([0.72, 0.5, 0.28].map((f, i) => k.segment([x + 0.4, y0 + 1, z0 + (z1 - z0) * f], [x + 0.4, y1 - 1 - i * 1.2, z0 + (z1 - z0) * f], P)).join(""), { tone: "lo", free: true })
        + Dots([at([x + 0.4, y0 + 0.9, z1 - 0.9]), at([x + 0.4, y1 - 0.9, z0 + 0.9])], { size: 0.4 }),
    });
  }

  // ---------------- mirrors on their mounts ----------------
  MIRRORS.forEach((m, i) => {
    const c = pts[i];
    const prev = path[i], next = path[i + 2];
    const n = unit(add(unit(sub(prev, c)), unit(sub(next, c))));
    let t = [n[2], 0, -n[0]];
    if (t[0] < 0) t = mul(t, -1);
    const F = G.frameOf(c, [0, 1, 0], t, n);
    const wp = (u, v, s) => add(add(add(c, mul(t, u)), mul(n, v)), [0, s, 0]);
    const th = Math.max(4.5, 0.15 * m.w);   // DERIVED: Zerodur blanks ~1/6 of their width thick for figure stiffness
    const hw = m.w / 2, hc = m.c / 2;
    const sag = 0.6;                        // DERIVED: drawn sag, ~R/40 for these off-axis aspheres
    const poly = m.power === "N"
      ? [[-hw + 0.8, -th], [hw - 0.8, -th], [hw, -th + 0.8], ...Array.from({ length: 9 }, (_, j) => { const u = hw - (2 * hw * j) / 8; return [u, sag * (1 - (u / hw) ** 2) - sag]; }), [-hw, -th + 0.8]]
      : [[-hw + 0.8, -th], [hw - 0.8, -th], [hw, -th + 0.8], [hw, sag], [-hw, sag], [-hw, -th + 0.8]];
    const faceSeen = dot(n, V) > 0.1;
    const extra = [];
    // the dished face shown on the near end face, edge to edge
    if (m.power === "P") extra.push(Ln(k.pathOf(Array.from({ length: 17 }, (_, j) => { const u = -hw + (2 * hw * j) / 16; return at(wp(u, sag * (u / hw) ** 2, hc)); })), { tone: "lo" }));
    if (faceSeen && m.power === "P") extra.push(Ln(k.pathOf([[-hw + 1.4, -hc + 1.4], [hw - 1.4, -hc + 1.4], [hw - 1.4, hc - 1.4], [-hw + 1.4, hc - 1.4]].map(([u, s]) => at(wp(u, sag, s))), true), { tone: "faint" }));
    prism(PIECE, F, poly, -hc, hc, { tone: "hi" }, { name: name(`${m.id}`), extra: extra.join("") });

    // three flexure pads on the back face, a mount plate, rigid-body actuators on its near end
    const PAD = 1, PLATE = 2;               // DERIVED: 1 cm bipod flexures, 2 cm Invar mount plate
    const padAt = [[-hw / 2.2, -hc / 2], [hw / 2.2, -hc / 2], [0, hc / 2]];   // DERIVED: 3-point kinematic support at 120 deg
    for (const [u, s] of padAt) boss(PIECE, wp(u, -th, s), mul(n, -1), 0.9, PAD, { tone: "mid", ring: false, name: name(`${m.id}-flexure`) });
    const pw = hw + 1;
    const mountPoly = [[-pw, -th - PAD - PLATE], [pw, -th - PAD - PLATE], [pw, -th - PAD], [-pw, -th - PAD]];
    // split where the right wall's cut edge lies, so the part behind the wall and the part in the open each sort
    prism(PIECE, F, mountPoly, IN_BACK, CUT_RIGHT, { tone: "mid" }, { name: name(`${m.id}-mount`), owner: name(`${m.id}-mount`) });
    prism(PIECE, F, mountPoly, CUT_RIGHT, hc + 1, { tone: "mid" }, { name: name(`${m.id}-mount`), owner: name(`${m.id}-mount`) });
    for (const u of [-pw * 0.62, 0, pw * 0.62]) boss(PIECE, wp(u, -th - PAD - PLATE / 2, hc + 1), [0, 1, 0], 0.75, 1.6, { tone: "hi", name: name(`${m.id}-actuator`) });
  });

  // ---------------- dynamic gas lock under the exit, H2 purge feed ----------------
  // DERIVED: vertical cone around the exit cone (19.3 deg half angle) from the bottom plate down to 2.4 above the wafer
  const leg = unit(sub(pts[5], W));
  const atZ = (dz) => add(W, mul(leg, dz / leg[2]));
  const DX = atZ(4)[0];
  const DGL = vert(DX, 0, WZ);
  turned(PIECE, DGL, [[5.7, 7.5], [6.5, 7.5]], { tone: "mid" }, { name: name("dgl-flange"), extra: Dots(G.dotsOf(DGL, 5.7, 6.6, 10, P, { fade: L.FADE ?? [0.04, 0.42] }), { size: 0.4 }) });
  const CONE = [[3.0, 3.2], [5.7, 5.2]];
  const cone = turned(PIECE, DGL, CONE, { tone: "hi" }, { name: name("dgl-cone") });
  turned(PIECE, DGL, [[2.4, 3.6], [3.0, 3.6]], { tone: "mid" }, { name: name("dgl-membrane-frame"), extra: Ln(G.circleOf(DGL, 2.4, 2.8, P, 40), { tone: "faint" }) });
  const portAt = G.pointOf(DGL, 4.35, 4.2, 0);
  const portFace = boss(PIECE, portAt, [1, 0, 0], 0.9, 1.2, { host: cone, name: name("dgl-h2-port") });

  // H2 manifold block hanging under the metro plate, right of the housing
  const PLATE_Z = [MOUNTS.metroTop.z - 10, MOUNTS.metroTop.z];   // DERIVED: 10 cm steel plate, metroTop is its top
  const MAN = { x0: 165, x1: 173, y0: -4, y1: 4, z0: Z(12), z1: PLATE_Z[0] };
  box("h2-manifold", [MAN.x0, MAN.y0, MAN.z0], [MAN.x1, MAN.y1, MAN.z1], "mid", { inner: seams([MAN.x0, MAN.y0], [MAN.x1, MAN.y1], [MAN.z0 + 3]) });
  const h2 = pipe(PIECE, [portFace, [169, 0, portFace[2]], [169, 0, MAN.z0]], 0.6, { flangeR: 1.5, name: name("h2-feed") });
  valveOn(PIECE, h2, 0.4, 0.6, { side: [0, 0, 1], name: name("h2-valve") });   // DERIVED: isolation valve on the feed, closes when the stage chamber vents

  // ---------------- metrology frame plate with its notch for the POB ----------------
  const MP = { x0: ENV.pob.x, x1: ENV.pob.x + ENV.pob.w, y0: -58, y1: 12 };   // back edge -58: the plate stops short of the frame's back columns (ENV.pob.y now reaches the seats)   // DERIVED: cut at y 12 so the sensors and POB show
  const NOTCH = { x0: HX[0] - 2, x1: HX[1] + 2, y: HY[0] - 2 };
  // three slabs (back strip, left and right wings) so each one depth-sorts against the housing it surrounds
  const PLATES = [
    ["metro-plate-back", [MP.x0, MP.y0], [MP.x1, NOTCH.y]],
    ["metro-plate-left", [MP.x0, NOTCH.y], [NOTCH.x0, MP.y1]],
    ["metro-plate-right", [NOTCH.x1, NOTCH.y], [MP.x1, MP.y1]],
  ];
  for (const [id, a, b] of PLATES) {
    const bolts = [];
    for (let x = a[0] + 6; x < b[0] - 3; x += 12) bolts.push([x, (a[1] + b[1]) / 2]);
    box(id, [a[0], a[1], PLATE_Z[0]], [b[0], b[1], PLATE_Z[1]], "mid", { bevel: 0.8, inner: seams(a, b, [PLATE_Z[0] + 3]), extra: screwsOn(bolts, PLATE_Z[1], { ring: 1 }) });
  }
  // POB collar flange resting on the plate around the notch
  const CZ = [PLATE_Z[1], PLATE_Z[1] + 4];
  const collarBolts = (a, b, n) => Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * (i + 0.5)) / n, a[1] + ((b[1] - a[1]) * (i + 0.5)) / n]);
  box("collar-back", [NOTCH.x0, HY[0] - 4, CZ[0]], [NOTCH.x1, HY[0], CZ[1]], "hi", { extra: screwsOn(collarBolts([HX[0] - 2, HY[0] - 2], [HX[1] + 2, HY[0] - 2], 9), CZ[1], { ring: 0.8 }) });
  box("collar-left", [HX[0] - 4, HY[0], CZ[0]], [HX[0], MP.y1, CZ[1]], "hi", { extra: screwsOn(collarBolts([HX[0] - 2, HY[0]], [HX[0] - 2, MP.y1], 3), CZ[1], { ring: 0.8 }) });
  box("collar-right", [HX[1], HY[0], CZ[0]], [HX[1] + 4, CUT_RIGHT, CZ[1]], "hi", { extra: screwsOn(collarBolts([HX[1] + 2, HY[0]], [HX[1] + 2, CUT_RIGHT], 2), CZ[1], { ring: 0.8 }) });

  // ---------------- airmounts on the frame's metro seats, outrigger arms out to them ----------------
  // four isolators (pneumatic spring ~0.5 Hz with 6-DoF Lorentz actuators [Heertjes 2020]) on seats outside the stage plate
  const SEATS = MOUNTS.metroSeats;
  const SEAT = SEATS.z;
  const ARM_W = 12;                       // DERIVED: 12 x 10 cm box arms, the plate's own depth, so the frame stays one stiff body
  for (const [x, y] of SEATS.at) {
    const F = vert(x, y, 0);
    if (ctx.solo) record({ ...A.slab({ x: x - SEATS.size / 2, y: y - SEATS.size / 2, w: SEATS.size, d: SEATS.size, r: 0.5 }, SEAT - 1, 1, { name: "stand.stub" }), ground: true, piece: "frame", ride: "frame", move: ctx.PIECES.frame.move });
    turned(PIECE, F, [[SEAT, 7.6], [SEAT + 1.4, 7.6]], { tone: "lo" }, { name: name("airmount-foot"), extra: Dots(G.dotsOf(F, SEAT + 1.4, 6.6, 8, P, { all: true }), { size: 0.4 }) });
    turned(PIECE, F, [[SEAT + 1.4, 7], [SEAT + 8, 7]], { tone: "mid" }, { name: name("airmount-can"), inner: G.arcOf(F, SEAT + 5, 7, P) });
    turned(PIECE, F, [[SEAT + 8, 6.2], [SEAT + 9.2, 6.7, 1], [SEAT + 10.4, 6.2]], { tone: "lo" }, { name: name("airmount-diaphragm") });
    turned(PIECE, F, [[SEAT + 10.4, 5.4], [SEAT + 14, 5.4]], { tone: "hi" }, { name: name("airmount-piston") });
    turned(PIECE, F, [[SEAT + 14, 3.2], [PLATE_Z[0] - 1.2, 3.2]], { tone: "mid" }, { name: name("airmount-post") });
    turned(PIECE, F, [[PLATE_Z[0] - 1.2, 5.6], [PLATE_Z[0], 5.6]], { tone: "mid" }, { name: name("airmount-cap") });
    const sy = y > 0 ? 1 : -1;
    box("airmount-actuator", [x + 7, y - 3, SEAT + 2.4], [x + 10.5, y + 3, SEAT + 7], "hi");
    const ya = sy > 0 ? [MP.y1, y + 8] : [y - 8, MP.y0];
    box("outrigger", [x - ARM_W / 2, ya[0], PLATE_Z[0]], [x + ARM_W / 2, ya[1], PLATE_Z[1]], "mid", {
      inner: seams([x - ARM_W / 2, ya[0]], [x + ARM_W / 2, ya[1]], [PLATE_Z[0] + 5]),
      extra: screwsOn([[x - 3, sy > 0 ? ya[0] + 3 : ya[1] - 3], [x + 3, sy > 0 ? ya[0] + 3 : ya[1] - 3], [x - 3, y], [x + 3, y]], PLATE_Z[1], { ring: 0.8 }),
    });
  }

  // ---------------- measure position: alignment head and level sensor ----------------
  const [MX, , MZ] = MEASURE;
  const SB = MZ + 4;                      // brief: sensor bottoms no lower than 4 above the wafer
  // alignment sensor (SMASH/ORION class): head block, objective barrel, lens tip
  box("align-head", [MX - 6, -6, SB + 6], [MX + 6, MP.y1, PLATE_Z[0]], "mid", { inner: seams([MX - 6, -6], [MX + 6, MP.y1], [SB + 10]) });
  turned(PIECE, vert(MX, 0, 0), [[SB + 1.5, 3], [SB + 6, 3]], { tone: "hi" }, { name: name("align-objective"), inner: G.arcOf(vert(MX, 0, 0), SB + 4, 3, P) });
  turned(PIECE, vert(MX, 0, 0), [[SB, 1.8], [SB + 1.5, 1.8]], { tone: "hi" }, { name: name("align-tip") });

  // level sensor arms, angled down at the spot from either side in the scan plane
  const SPOT = [MX, 0, MZ];
  const LS_TILT = 62;                     // DERIVED: grazing UV projection ~25 deg off the wafer plane, typical for optical level sensors
  const arm = (side) => {
    const a = unit([side * Math.sin((LS_TILT * Math.PI) / 180), 0, Math.cos((LS_TILT * Math.PI) / 180)]);
    const F = G.frameOf(SPOT, a, [0, 1, 0], unit(G.cross3(a, [0, 1, 0])));
    turned(PIECE, F, [[13, 2.2], [15, 2.2]], { tone: "hi" }, { name: name("ls-lens") });
    prism(PIECE, F, [[-3.5, -2.6], [3.5, -2.6], [3.5, 2.6], [-3.5, 2.6]], 15, 23, { tone: "mid" }, { name: name("ls-arm"), owner: name(`ls-${side}`) });
    const end = G.add3(SPOT, mul(a, 23));
    const bx = end[0] + side * 1;
    const corners = [-2.6, 2.6].map((v) => add(end, mul(F.v, v)));
    const topCorner = corners.reduce((p, q) => (q[2] > p[2] ? q : p));
    const blockX = side > 0 ? [topCorner[0] - 3.5, topCorner[0] + 4] : [topCorner[0] - 4, topCorner[0] + 3.5];
    box("ls-hanger", [blockX[0], -4, topCorner[2]], [blockX[1], MP.y1, PLATE_Z[0]], "lo", { owner: name(`ls-${side}`) });
    return { x: (blockX[0] + blockX[1]) / 2, z: end[2] + 1, bx };
  };
  const proj = arm(-1);
  const det = arm(1);

  // ---------------- interferometer reference blocks ----------------
  for (const x0 of [30, 54]) {
    // DERIVED: reference mirrors for the stage interferometers, fixed to the metro frame like the lens
    box("ifm-ref", [x0, 2, PLATE_Z[0] - 10], [x0 + 12, 16, PLATE_Z[0]], "mid", { inner: seams([x0, 2], [x0 + 12, 16], [PLATE_Z[0] - 3]) });
    for (const dx of [3.5, 8.5]) boss(PIECE, [x0 + dx, 16, PLATE_Z[0] - 6.5], [0, 1, 0], 1.6, 1, { tone: "hi", name: name("ifm-window") });
  }

  // ---------------- sensor harness on the plate's front face ----------------
  const FRONT = MP.y1;
  const LANE_Y = FRONT + 1.3;
  const LANES = [PLATE_Z[0] + 8.5, PLATE_Z[0] + 5.5, PLATE_Z[0] + 2.5];
  const JB = { x0: 58, x1: 70 };
  // junction box on the plate face, left of the notch
  box("junction-box", [JB.x0, FRONT, PLATE_Z[0] + 0.5], [JB.x1, FRONT + 4, PLATE_Z[1] - 0.5], "mid", { extra: Dots([at([JB.x0 + 1, FRONT + 4, PLATE_Z[1] - 1.5]), at([JB.x1 - 1, FRONT + 4, PLATE_Z[0] + 1.5])], { size: 0.4 }) });
  const sources = [[proj.x + 2.5, LANES[0]], [MX, LANES[1]], [det.x, LANES[2]]];
  const clampXs = [-20, 0, 24, 46];
  sources.forEach(([x, lane], i) => {
    const zc = PLATE_Z[0] - 4;
    const face = boss(PIECE, [x, FRONT, zc], [0, 1, 0], 0.9, 0.6, { tone: "hi", name: name("sensor-connector") });
    const out = elbow(PIECE, face, [0, 1, 0], 0.9, [x, LANE_Y, lane], 1.2, 0.62, { name: name("sensor-elbow") });
    const clamps = clampXs.filter((cx) => cx > x + 4 && cx < JB.x0 - 2).map((cx) => clampAt(PIECE, [cx, LANE_Y, lane], [1, 0, 0], 1.35, { bundle: name("harness") }));
    cable(PIECE, [out, [x, LANE_Y, lane], [JB.x0, LANE_Y, lane]], { name: name("harness"), bundle: name("harness"), clamps, bend: 2.2, touch: ["pob.clamp*"] });
  });
}
