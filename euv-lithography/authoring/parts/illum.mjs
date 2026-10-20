// Illuminator: from the intermediate focus to the mask. The top of this file is the EUV light path from plasma to mask,
// shared with parts/source.mjs (which imports it); everything plan.mjs leaves open is engineered here and marked DERIVED.
import { k, G, A } from "../lib.mjs";

const DEG = 180 / Math.PI;
const unit = G.unit3;

// DERIVED: plasma to IF 120 cm, inside the sourced 100-160 cm foci spacing [source.md: US12360458B2, NON-ASML]
export const FOCI = 120;
export const RIM_R = 32.5;        // 650 mm collector [wikichip 2019]
export const OMEGA = 5.5;         // sr collected [Fomenkov 2017]
// DERIVED: 6 cm hole radius passes the f/4 CO2 cone (Ø~12 cm at 46 cm from M2's 15 cm beam) plus the gas-cone wall
export const HOLE_R = 6;

// mirror normal that sends `din` into `dout`
const normalOf = (din, dout) => unit(G.sub3(dout, din));
const aoiOf = (din, dout) => Math.acos(Math.max(-1, Math.min(1, -G.dot3(din, dout)))) / 2 * DEG;

// Ellipse with foci at s = 0 (plasma) and s = 2c (IF), s along the collector axis toward the IF.
// Solve a so the rim (radius RIM_R) and the hole together subtend OMEGA from the plasma.
function ellipse() {
  const c = FOCI / 2;
  let a = 80;
  let th = 0;
  let rho = 0;
  for (let i = 0; i < 200; i++) {
    const vertex = a - c;
    const hole = Math.atan2(HOLE_R, vertex);
    th = Math.acos(Math.cos(hole) - OMEGA / (2 * Math.PI));
    rho = RIM_R / Math.sin(th);
    const l = rho * (1 + (c / a) * Math.cos(th));
    a -= ((a * a - c * c) / a - l) * 0.5;
  }
  const b = Math.sqrt(a * a - c * c);
  const sRim = -rho * Math.cos(th);
  const r = (s) => b * Math.sqrt(Math.max(0, 1 - ((s - c) / a) ** 2));
  const slope = (s) => -(b * (s - c)) / (a * a * Math.sqrt(Math.max(1e-9, 1 - ((s - c) / a) ** 2)));
  const ifHalf = Math.atan2(RIM_R, FOCI - sRim);
  return { a, b, c, vertex: c - a, sRim, rimTheta: th * DEG, ifHalf: ifHalf * DEG, rimAoi: ((Math.PI - th - ifHalf) / 2) * DEG, r, slope };
}

export function euv(OPTIC) {
  const plasma = [...OPTIC.plasma];
  const field = [...OPTIC.facetField];
  const mask = [...OPTIC.reticle];
  // DERIVED: collector axis points from the plasma at the field facet mirror. A vertical axis (IF straight above the plasma)
  // sends the IF cone (half-angle ~15 deg) straight up, 66 deg away from the field facet mirror, so the axis tilts 27 deg toward -x.
  const AX = unit(G.sub3(field, plasma));
  const IF = G.add3(plasma, G.mul3(AX, FOCI));
  const U = unit(G.cross3([0, 1, 0], AX));   // in the x-z plane, square to the axis, pointing +x and up
  const F = G.frameOf(plasma, AX, U, [0, 1, 0]);
  const E = ellipse();
  // DERIVED (coordinator): the light reaches the mask at the sourced 6 deg [Lowisch 2012]. The relay sits on the 6 deg ray
  // 45 cm below the mask face, where the 0.8 cm slit's incoming and reflected legs (12 deg apart) clear each other; a second
  // grazing mirror g1 feeds it from below-right at 72 deg AOI (din = dout turned +36 deg), at x 171 just outside the POB wall.
  // The pupil facet mirror sits as low and as far to -x as the box allows, clear of the source vessel roof (x >= 318, z <= 212).
  const pupil = [302, 0, 208];
  const CRAO = (6 * Math.PI) / 180;
  const relay = [mask[0] + 45 * Math.tan(CRAO), 0, mask[2] - 45];
  const dout = unit(G.sub3(mask, relay));
  const turn = (36 * Math.PI) / 180;
  const din = [dout[0] * Math.cos(turn) - dout[2] * Math.sin(turn), 0, dout[0] * Math.sin(turn) + dout[2] * Math.cos(turn)];
  const g1 = G.sub3(relay, G.mul3(din, (relay[0] - 171) / din[0]));
  const legs = [IF, field, pupil, g1, relay, mask];
  const dirs = legs.slice(1).map((p, i) => unit(G.sub3(p, legs[i])));
  const mirror = (at, i) => ({ at, normal: normalOf(dirs[i], dirs[i + 1]), aoi: aoiOf(dirs[i], dirs[i + 1]) });
  const mirrors = { field: mirror(field, 0), pupil: mirror(pupil, 1), g1: mirror(g1, 2), relay: mirror(relay, 3) };
  const maskAngle = Math.acos(dirs[dirs.length - 1][2]) * DEG;
  const rim = Array.from({ length: 24 }, (_, i) => G.pointOf(F, E.sRim, RIM_R, (i / 24) * Math.PI * 2));
  // the beam's radius along each leg: zero at the IF, the IF cone's half-angle out to the field facet mirror
  const tanHalf = Math.tan(E.ifHalf / DEG);
  return { plasma, IF, AX, U, F, E, field, pupil, g1, relay, mask, legs, dirs, mirrors, maskAngle, rim, tanHalf, fieldBeamR: G.len3(G.sub3(field, IF)) * tanHalf };
}

// the beam the WebGL layer draws, published once by whichever module builds first
export function publishBeam(ctx) {
  if (ctx.shared.beam) return ctx.shared.beam;
  const O = euv(ctx.OPTIC);
  const r3 = (p) => p.map((v) => +v.toFixed(2));
  ctx.shared.beam = {
    plasma: r3(O.plasma),
    IF: r3(O.IF),
    axis: r3(O.AX),
    collectorRim: O.rim.map(r3),
    path: O.legs.map(r3),
    names: ["IF", "field facet", "pupil facet", "grazing g1", "relay", "mask"],
    maskAngleDeg: +O.maskAngle.toFixed(1),
  };
  return ctx.shared.beam;
}

// ============ the illuminator hardware: research/mechanics.md Part C section 2; the rest engineered and marked DERIVED ============
const PIECE = "illum";
const T = 1.4;          // DERIVED: 14 mm Al walls; the housing sits inside the ~5 Pa H2 scanner vacuum, so it is a stiff contamination shield, not a pressure wall
const YB = -27;         // inner face of the back wall
const CUT = { floor: 27, side: 6, lid: 14, roof: -2 };   // where each wall ends toward the cut-away +y side
// beam radius at each aperture (ESTIMATED), linear along each leg
const R_PF = 9;         // DERIVED: inside the r 11 pupil facet base with a 2 cm rim
// DERIVED: the 4.7 deg cone onto the 0.8 cm slit is ~4.1 cm in radius 45 cm below the mask; g1 and the relay are sized for 3 cm,
// the most that keeps g1's tip at x >= 162 (POB wall x 161) and the relay's top end clear of the mask-to-M1 leg
const R_G1 = 3;
const R_RELAY = 3;
const R_MASK = 2;       // DERIVED: 0.8 cm slit [Part B section 3, ESTIMATED] plus the cone over the last few cm
// field facet mirror: 4 columns [US20110164233A1]; drawn 24 facets per column (75 at 4x would be ~1.8 px)
const FF = { half: 16.5, facet: 1, base: 4, columns: 4, facets: 24, board: [4, 4.8] };
const PFM = { r: 11, facetR: 10.2, facet: 0.8, base: 3, plate: [4.6, 6], plateR: 8, pitch: 1.25 };   // DERIVED: base thinned to 2.2 so its low corner clears the floor at z 197.4
// grazing mirrors: wedge substrates, thick where the three balls and the back plate sit, thinning toward the tip that
// reaches the neighbour (g1: the POB wall; relay: the mask-to-M1 leg)
const G1M = { half: 10, width: 7.5, thick: 3, tip: 0.8, ball: 0.7, plate: [4.4, 6], wallU: -12 };
const RLM = { half: 9, width: 7.5, thick: 2.4, tip: 0.6, ball: 0.7, plate: [3.8, 5.2], lug: -9 };

// split a simple CCW polygon into convex pieces: ear clipping, then Hertel-Mehlhorn merges
function convexParts(poly) {
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const rotate = (list, at) => [...list.slice(at), ...list.slice(0, at)];
  const idx = poly.map((_, i) => i);
  const parts = [];
  while (idx.length > 3) {
    const n = idx.length;
    const ear = idx.findIndex((_, i) => {
      const [ia, ib, ic] = [idx[(i + n - 1) % n], idx[i], idx[(i + 1) % n]];
      const [a, b, c] = [poly[ia], poly[ib], poly[ic]];
      if (cross(a, b, c) <= 1e-9) return false;
      return !idx.some((j) => j !== ia && j !== ib && j !== ic && cross(a, b, poly[j]) >= -1e-9 && cross(b, c, poly[j]) >= -1e-9 && cross(c, a, poly[j]) >= -1e-9);
    });
    if (ear < 0) throw new Error("convexParts: no ear, polygon is not simple and CCW");
    parts.push([idx[(ear + n - 1) % n], idx[ear], idx[(ear + 1) % n]]);
    idx.splice(ear, 1);
  }
  parts.push(idx);
  const convex = (ring) => ring.every((_, i) => cross(poly[ring[i]], poly[ring[(i + 1) % ring.length]], poly[ring[(i + 2) % ring.length]]) >= -1e-9);
  for (let merged = true; merged; ) {
    merged = false;
    search: for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const [a, b] = [parts[i], parts[j]];
      for (let p = 0; p < a.length; p++) {
        const q = b.findIndex((x, m) => x === a[(p + 1) % a.length] && b[(m + 1) % b.length] === a[p]);
        if (q < 0) continue;
        const ring = [...rotate(a, (p + 1) % a.length), ...rotate(b, (q + 2) % b.length).slice(0, b.length - 2)];
        if (!convex(ring)) continue;
        parts[i] = ring;
        parts.splice(j, 1);
        merged = true;
        break search;
      }
    }
  }
  return parts.map((ring) => ring.map((i) => poly[i]));
}

const roundRect = (u0, u1, v0, v1, r, steps = 3) =>
  [[u1 - r, v1 - r, 0], [u0 + r, v1 - r, 90], [u0 + r, v0 + r, 180], [u1 - r, v0 + r, 270]].flatMap(([cu, cv, a0]) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const t = ((a0 + (90 * i) / steps) * Math.PI) / 180;
      return [cu + r * Math.cos(t), cv + r * Math.sin(t)];
    }));

export function build(L, ctx) {
  publishBeam(ctx);
  const { P, MOUNTS, PIECES } = ctx;
  const E = ctx.ENV.illum;
  const O = euv(ctx.OPTIC);
  const { at, Ln, Dots, prism, turned, flangeAt, boss, ballAt, pipe, cable, clampAt, boxOf, screwsOn, path3, record } = L;
  const add = G.add3, mul = G.mul3;
  const nm = (n) => `${PIECE}.${n}`;
  const box = (n, a, b, tone = "mid", options = {}) => boxOf(PIECE, a, b, { tone }, { name: nm(n), ...options });
  const vert = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

  // a mirror frame: a into the substrate (-normal), u in the x-z plane, v = +y; s = 0 is the reflecting surface
  const mirrorFrame = (o, normal) => { const a = mul(normal, -1); return G.frameOf(o, a, [a[2], 0, -a[0]], [0, 1, 0]); };
  const pt = (F, s, u, v = 0) => add(add(add(F.o, mul(F.a, s)), mul(F.u, u)), mul(F.v, v));
  const FFr = mirrorFrame(O.field, O.mirrors.field.normal);
  const PFr = mirrorFrame(O.pupil, O.mirrors.pupil.normal);
  const GFr = mirrorFrame(O.g1, O.mirrors.g1.normal);
  const RFr = mirrorFrame(O.relay, O.mirrors.relay.normal);
  // collector-axis coordinates: s from the plasma along O.AX, r along O.U
  const onAxis = (s, r = 0) => add(add(O.plasma, mul(O.AX, s)), mul(O.U, r));
  // x-z polygons extruded along y: u = x, v = z, a = -y, so s = -y
  const XZ = G.frameOf([0, 0, 0], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
  const xz = (p) => [p[0], p[2]];
  const plate = (n, poly, y0, y1, tone, options = {}) => prism(PIECE, XZ, poly, -y1, -y0, { tone }, { name: nm(n), ...options });
  const meet = ([p, d], [q, e]) => {
    const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]);
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  };
  const lineThrough = (a, b) => [a, [b[0] - a[0], b[1] - a[1]]];
  const atX = ([p, d], x) => [x, p[1] + (d[1] * (x - p[0])) / d[0]];
  const onPlane = (s, x) => [x, O.plasma[2] + (s - (x - O.plasma[0]) * O.AX[0]) / O.AX[2]];

  // ================= housing: one x-z outline extruded along y, open toward +y =================
  const up2 = (d) => [d[2], -d[0]];                    // right normal of a leg direction in x-z (up for the duct leg)
  const n2 = up2(O.dirs[2]);
  const off2 = (p, n, d) => xz(p).map((v, i) => v + n[i] * d);
  const roofLine = lineThrough(off2(O.pupil, n2, R_PF + 2.1), off2(O.g1, n2, R_G1 + 2.1));
  const floorLine = lineThrough(off2(O.pupil, n2, -(R_PF + 2.1)), off2(O.g1, n2, -(R_G1 + 2.1)));
  const fd = [O.dirs[3][0], O.dirs[3][2]];             // feed leg g1 -> relay, up and to -x
  const fr = up2(O.dirs[3]);                           // its right side (+x, up)
  const feedRight = [off2(O.g1, fr, R_G1 + 2), fd];
  const W0 = xz(pt(GFr, G1M.plate[1], 0));             // g1's end wall meets the snout's lower wall behind g1's middle
  const lowerOuter = [W0[0] - fr[0] * T, W0[1] - fr[1] * T];
  // DERIVED: the snout ends where its lower outer corner reaches x 162.4, 1.4 short of the POB wall's port (x 161)
  const kEnd = (162.4 - lowerOuter[0]) / fd[0];
  const S_END = (lowerOuter[0] + fd[0] * kEnd - xz(O.g1)[0]) * fd[0] + (lowerOuter[1] + fd[1] * kEnd - xz(O.g1)[1]) * fd[1];
  const atS = ([p, d], sEnd) => { const g = xz(O.g1); const k0 = ((g[0] - p[0]) * d[0] + (g[1] - p[1]) * d[1]) + sEnd; return [p[0] + d[0] * k0, p[1] + d[1] * k0]; };
  const lowerLine = [W0, fd];
  const X_LO = 314.8;   // DERIVED: 2.2 clear of the FF->PF beam edge (x 312.6 at z 243) and 1.3 inside the entrance flange rim (x 317.5)
  const X_HI = 333.9;   // DERIVED: right of the entrance flange's upper rim (x 334.2, z 243) once above it
  const X_W = 276;      // DERIVED: 8 cm clear of the field facet mirror's -x end for its mount post
  const Z_FLOOR = E.z0 + T;
  const Z_LID = E.z1 - 1 - T;
  const S_PLATE = [125, 126.5];   // DERIVED: entrance plate square to the collector axis, 5 cm past the IF
  const IX = { snoutLow: 0, w0: 1, wallLow: 2, kink: 3, step: 4, v1: 5, v2: 6, v3: 7, v4: 8, v5: 9, v6: 10, roofEnd: 11, snoutUp: 12 };
  const W = [
    atS(lowerLine, S_END),                         // snout's lower wall at its open end
    W0,
    xz(pt(GFr, G1M.plate[1], G1M.wallU)),          // end wall behind g1, lower corner
    atX(floorLine, X_W),
    [285, Z_FLOOR],                                // DERIVED: floor steps down under the pupil facet mirror's bracket
    [X_LO, Z_FLOOR],
    onPlane(S_PLATE[1], X_LO),
    onPlane(S_PLATE[1], X_HI),
    [X_HI, Z_LID],
    [X_W, Z_LID],
    atX(roofLine, X_W),
    meet(roofLine, feedRight),                     // the duct roof turns into the snout's upper wall, 2 cm off the feed leg
    atS(feedRight, S_END),
  ];
  const outward = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(...d); return [d[1] / l, -d[0] / l]; };
  const OUT = W.map((p, i) => {
    const n0 = i > 0 ? outward(W[i - 1], p) : null;
    const n1 = i < W.length - 1 ? outward(p, W[i + 1]) : null;
    if (!n0 || !n1) { const n = n0 || n1; return [p[0] + n[0] * T, p[1] + n[1] * T]; }
    const m = [n0[0] + n1[0], n0[1] + n1[1]];
    const l = Math.hypot(...m);
    const k = T / ((m[0] / l) * n0[0] + (m[1] / l) * n0[1]);
    return [p[0] + (m[0] / l) * k, p[1] + (m[1] / l) * k];
  });
  const quad = (i) => [W[i], W[i + 1], OUT[i + 1], OUT[i]];
  const mid = (poly, y) => { const c = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]); return [c[0], y, c[1]]; };
  // ref y seeds each wall's depth key from the side of the beam plane it faces the viewer from
  const WALLS = [
    ["snout-lower", 10, "mid", -6],
    ["end-wall", 10, "lo", -6],
    ["duct-floor", CUT.floor, "mid", -6],
    ["floor-ramp", CUT.floor, "mid", -6],
    ["floor", CUT.floor, "mid", -6],
    ["wall-lower", CUT.side, "mid", 0],
    null,
    ["wall-upper", CUT.side, "mid", 0],
    ["lid", CUT.lid, "mid", 0],
    ["wall-left", CUT.lid, "lo", -6],
    ["duct-roof", CUT.roof, "mid", 0],
    ["snout-upper", CUT.roof, "mid", 0],
  ];
  const LID_TOP = OUT[IX.v4][1];
  const XO = OUT[IX.v3][0];   // outer face of the upper +x wall
  const along = (a, b, x) => { const t = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; };
  const DUCT_JOINTS = [205, 240];
  const extras = {
    floor: { extra: screwsOn([290, 300, 310].map((x) => [x, CUT.floor - 2]), Z_FLOOR, { ring: 0.8, size: 0.4 }) },
    lid: { extra: screwsOn([280, 292, 304, 316, 328].flatMap((x) => [[x, CUT.lid - 1.5], [x, YB + 1.5]]), LID_TOP, { ring: 0.8, size: 0.4 }) },
    "wall-left": { inner: Ln(k.segment([X_W, -8, W[IX.v6][1]], [X_W, -8, Z_LID], P), { tone: "faint" }) },
    "wall-upper": { inner: Ln(k.segment([XO, YB, 304], [XO, CUT.side, 304], P), { tone: "faint" }) },
    // duct floor: panel joints edge to edge across its top, bolts by the cut edge
    "duct-floor": {
      inner: Ln(DUCT_JOINTS.map((x) => k.segment([x, YB, along(W[IX.wallLow], W[IX.kink], x)], [x, CUT.floor, along(W[IX.wallLow], W[IX.kink], x)], P)).join(""), { tone: "faint" }),
      extra: Dots([192, 222, 258].map((x) => at([x, CUT.floor - 1.5, along(W[IX.wallLow], W[IX.kink], x)])), { size: 0.4 }),
    },
    "duct-roof": { extra: Dots([200, 225, 250].map((x) => at([x, CUT.roof - 1.5, along(OUT[IX.v6], OUT[IX.roofEnd], x)])), { size: 0.4 }) },
  };
  WALLS.forEach((spec, i) => {
    if (!spec) return;
    const [n, cut, tone, ry] = spec;
    plate(n, quad(i), YB, cut, tone, { ref: mid(quad(i), ry), ...(extras[n] || {}) });
  });
  // entrance plate, square to the collector axis, with a square hole for the snout; the snout's collar covers it
  {
    const HOLE = 4.5;
    const [s0, s1] = S_PLATE;
    const sr = (s, r) => xz(onAxis(s, r));
    const lower = [W[IX.v2], sr(s1, -HOLE), sr(s0, -HOLE), OUT[IX.v2]];
    const upper = [sr(s1, HOLE), W[IX.v3], OUT[IX.v3], sr(s0, HOLE)];
    const middle = [sr(s1, -HOLE), sr(s1, HOLE), sr(s0, HOLE), sr(s0, -HOLE)];
    plate("entrance-plate", lower, YB, HOLE, "mid", { ref: mid(lower, 0) });
    plate("entrance-plate", upper, YB, HOLE, "mid", { ref: mid(upper, 0) });
    plate("entrance-plate", middle, YB, -HOLE, "mid", { ref: mid(middle, -6) });
  }
  // exit end plate across the snout mouth behind the beam (y < -9); the relay arm leaves its face
  const SNOUT_Y = -9;
  const endPlate = [W[IX.snoutLow], W[IX.snoutUp], atS(feedRight, S_END - T), atS(lowerLine, S_END - T)];
  plate("exit-plate", endPlate, YB, SNOUT_Y, "lo", { ref: mid(endPlate, -12) });
  // back wall panels, jointed where the chamber meets the duct and level with the entrance plate's lower corner
  const shelf = [OUT[IX.v6][0], OUT[IX.v2][1]];
  const PANELS = [
    [shelf, OUT[IX.v2], OUT[IX.v3], OUT[IX.v4], OUT[IX.v5]],
    [OUT[IX.kink], OUT[IX.step], OUT[IX.v1], OUT[IX.v2], shelf, OUT[IX.v6]],
    ...convexParts([OUT[IX.snoutLow], OUT[IX.w0], OUT[IX.wallLow], OUT[IX.kink], OUT[IX.v6], OUT[IX.roofEnd], OUT[IX.snoutUp], W[IX.snoutUp], W[IX.snoutLow]]),
  ];
  PANELS.forEach((poly) => plate("back-wall", poly, YB - T, YB, "lo", { ref: mid(poly, YB - T / 2) }));

  // DERIVED: the duct cantilevers ~1.1 m past the legs, so two 3 cm stiffener strips run under its floor
  for (const [y0, y1] of [[-20, -17], [17, 20]]) {
    const deep = (p) => [p[0], p[1] - 3];
    const end = [258, along(OUT[IX.wallLow], OUT[IX.kink], 258)];   // stops short of the -x legs' saddle block
    const strip = [OUT[IX.wallLow], end, deep(end), deep(OUT[IX.wallLow])];
    plate("duct-stiffener", strip, y0, y1, "lo", { ref: mid(strip, -6) });
  }
  // back wall stiffener rib across the chamber, wall to wall
  box("back-rib", [X_W, YB, 265], [X_HI, YB + 1.6, 267], "lo", { extra: Dots([285, 300, 325].map((x) => at([x, YB + 0.8, 267])), { size: 0.38 }) });

  // ================= pedestal: four legs from the base frame deck to the housing floor, braced in x and y =================
  // DERIVED: hangers from the upper deck cannot work: the illuminator comes apart upward ([60, 40, 110]) into whatever holds it
  // from above. The base frame deck (top z 94) runs to x 296 and the stage chamber ends at x 258, so the legs stand at x 266 and
  // 291: the +x pair under the chamber floor, the -x pair on a level saddle block under the duct floor.
  const BT = MOUNTS.baseTop.z;
  const LEG = { r: 3.5, x: [266, 291], y: [-18, 18], head: 6, foot: 6.5 };   // DERIVED: 4 x 7 cm tubes carry ~0.5 t at ~1 m with a large buckling margin
  const floorBottom = (x) => (x >= OUT[IX.step][0] ? OUT[IX.step][1] : along(OUT[IX.wallLow], OUT[IX.kink], x));
  const SADDLE = { x0: LEG.x[0] - LEG.head - 0.5, x1: LEG.x[0] + LEG.head + 0.5 };
  const saddleBot = Math.min(floorBottom(SADDLE.x0), floorBottom(SADDLE.x1)) - 1.2;
  {
    const poly = [[SADDLE.x0, saddleBot], [SADDLE.x1, saddleBot], [SADDLE.x1, floorBottom(SADDLE.x1)], [SADDLE.x0, floorBottom(SADDLE.x0)]];
    plate("leg-saddle", poly, LEG.y[0] - LEG.head - 0.5, LEG.y[1] + LEG.head + 0.5, "lo", { ref: mid(poly, -6) });
  }
  const headZ = [saddleBot, floorBottom(LEG.x[1])];
  const BRACE_Z = (BT + Math.min(...headZ)) / 2;
  LEG.x.forEach((x, i) => {
    for (const y of LEG.y) {
      flangeAt(PIECE, [x, y, BT + 0.75], [0, 0, 1], LEG.foot, 1.5, { tone: "lo", bolts: 6, name: nm("leg-foot") });
      const F = vert(x, y, BT + 1.5);
      const h = headZ[i] - 1.5 - BT - 1.5;
      turned(PIECE, F, [[0, LEG.r], [h, LEG.r]], { tone: "mid" }, { name: nm("leg"), inner: G.arcOf(F, BRACE_Z - BT - 1.5 + 2.2, LEG.r, P) + G.arcOf(F, BRACE_Z - BT - 1.5 - 2.2, LEG.r, P) });
      flangeAt(PIECE, [x, y, headZ[i] - 0.75], [0, 0, 1], LEG.head, 1.5, { tone: "mid", bolts: 6, name: nm("leg-head") });
      // the solo ground stub is only a pad under each foot: the deck it stands for is the frame's
      if (ctx.solo) record({ ...A.slab({ x: x - LEG.foot - 1, y: y - LEG.foot - 1, w: 2 * LEG.foot + 2, d: 2 * LEG.foot + 2, r: 0.4 }, BT - 1, 1, { name: "stand.stub" }), ground: true, piece: "frame", ride: "frame", move: PIECES.frame.move });
    }
  });
  // braces: box ties between the legs at mid height, ending on each leg's skin
  for (const y of LEG.y) box("brace-x", [LEG.x[0] + LEG.r - 0.2, y - 1.2, BRACE_Z - 2], [LEG.x[1] - LEG.r + 0.2, y + 1.2, BRACE_Z + 2], "lo");
  for (const x of LEG.x) box("brace-y", [x - 1.2, LEG.y[0] + LEG.r - 0.2, BRACE_Z - 2], [x + 1.2, LEG.y[1] - LEG.r + 0.2, BRACE_Z + 2], "lo");

  // ================= IF entrance: flange face to face with the source neck's, snout, collar on the entrance plate =================
  flangeAt(PIECE, onAxis(118.75), O.AX, 9, 1.5, { tone: "hi", bolts: 12, name: nm("if-flange") });
  turned(PIECE, G.frameAlong(onAxis(119.5), O.AX), [[0, 5.2], [2.6, 4.5], [S_PLATE[0] - 119.5 - 1.4, 4.5], [S_PLATE[0] - 119.5 - 1.4, 6.5], [S_PLATE[0] - 119.5, 6.5]], { tone: "mid" }, { name: nm("if-snout"), inner: G.arcOf(G.frameAlong(onAxis(119.5), O.AX), 1.2, 5.2 - 0.27 * 1.2, P, { slope: -0.27 }) });

  // ================= field facet mirror =================
  // the face points down at the IF and the pupil facets, so this camera sees the rim and the back: the four facet columns
  // show on the +y and +u edges, the 4-column tilt-actuator field (one actuator per facet, +-3 deg [US20110164233A1]) on the back
  const colV = Array.from({ length: FF.columns }, (_, j) => { const w = (2 * FF.half - 0.5 * (FF.columns - 1)) / FF.columns; const v0 = -FF.half + j * (w + 0.5); return [v0, v0 + w]; });
  colV.forEach(([v0, v1], j) => {
    const lines = j === FF.columns - 1 ? Ln(Array.from({ length: FF.facets - 1 }, (_, i) => { const u = -FF.half + ((i + 1) * 2 * FF.half) / FF.facets; return k.segment(pt(FFr, 0, u, v1), pt(FFr, FF.facet, u, v1), P); }).join(""), { tone: "lo" }) : "";
    prism(PIECE, FFr, roundRect(-FF.half, FF.half, v0, v1, 0.2, 1), 0, FF.facet, { tone: "hi" }, { name: nm("ff-facets"), inner: lines });
  });
  prism(PIECE, FFr, roundRect(-FF.half, FF.half, -FF.half, FF.half, 0.6, 2), FF.facet, FF.base, { tone: "mid" }, { name: nm("ff-base") });
  const CAP_U = Array.from({ length: 9 }, (_, i) => -7.8 + i * 2.2);
  colV.forEach(([v0, v1]) => {
    const vc = (v0 + v1) / 2;
    const caps = CAP_U.map((u) => pt(FFr, FF.board[1], u, vc));
    prism(PIECE, FFr, roundRect(-11, 11, v0 + 0.6, v1 - 0.6, 0.3, 1), FF.board[0], FF.board[1], { tone: "lo" }, {
      name: nm("ff-actuators"),
      extra: Ln(caps.map((c) => G.circleOf(G.frameAlong(c, FFr.a), 0, 0.55, P, 12)).join(""), { tone: "lo" }) + Dots(caps.map(at), { size: 0.32, tone: "mid" }),
    });
  });
  prism(PIECE, FFr, roundRect(12, 16, -15.5, -4, 0.4, 1), FF.base, 6.5, { tone: "mid" }, { name: nm("ff-manifold") });
  for (const [u, v] of [[-13.5, -12], [-13.5, 12], [13.5, 8]]) {
    ballAt(PIECE, pt(FFr, FF.base + 0.8, u, v), 0.8, { tone: "mid", name: nm("ff-ball") });
    turned(PIECE, G.frameAlong(pt(FFr, FF.base + 1.6, u, v), FFr.a), [[0, 1.6], [1.2, 1.6]], { tone: "mid" }, { name: nm("ff-socket") });
    const c = pt(FFr, FF.base + 2.8, u, v);
    const zb = c[2] - 0.12;
    turned(PIECE, vert(c[0], c[1], zb), [[0, 0.9], [Z_LID - 1.2 - zb, 0.9]], { tone: "mid" }, { name: nm("ff-post") });
    flangeAt(PIECE, [c[0], c[1], Z_LID - 0.6], [0, 0, 1], 1.8, 1.2, { tone: "mid", bolts: 0, name: nm("ff-post-head") });
  }

  // ================= pupil facet mirror: round base, ~450 round facets [Conradi 2011]; nearly edge-on from this camera =================
  const PFc = PFr;
  {
    const dots = [];
    const rowH = PFM.pitch * 0.866;
    for (let row = -Math.floor(PFM.facetR / rowH); row <= Math.floor(PFM.facetR / rowH); row++)
      for (let u = -PFM.facetR; u <= PFM.facetR; u += PFM.pitch) {
        const uu = u + (row % 2 ? PFM.pitch / 2 : 0);
        const vv = row * rowH;
        if (Math.hypot(uu, vv) < PFM.facetR - 0.6) dots.push(pt(PFc, 0, uu, vv));
      }
    turned(PIECE, G.frameAlong(O.pupil, PFc.a), [[0, PFM.facetR], [PFM.facet, PFM.facetR]], { tone: "hi" }, { name: nm("pf-facets"), extra: Dots(dots.map(at), { size: 0.28, tone: "lo" }) });
  }
  turned(PIECE, G.frameAlong(pt(PFc, PFM.facet, 0), PFc.a), [[0, PFM.r], [PFM.base - PFM.facet, PFM.r]], { tone: "mid" }, { name: nm("pf-base"), inner: G.arcOf(G.frameAlong(pt(PFc, PFM.facet, 0), PFc.a), 1.5, PFM.r, P) });
  for (const ang of [90, 210, 330]) ballAt(PIECE, G.pointOf(PFc, PFM.base + 0.8, 8, (ang * Math.PI) / 180), 0.8, { tone: "mid", name: nm("pf-ball") });
  turned(PIECE, G.frameAlong(pt(PFc, PFM.plate[0], 0), PFc.a), [[0, PFM.plateR], [PFM.plate[1] - PFM.plate[0], PFM.plateR]], { tone: "mid" }, { name: nm("pf-backplate") });
  {
    const a = pt(PFc, PFM.plate[1], 6);
    const b = pt(PFc, PFM.plate[1], -6);
    const poly = [[a[0], Z_FLOOR], [b[0], Z_FLOOR], [b[0], b[2]], [a[0], a[2]]];
    plate("pf-bracket", poly, -6, 6, "lo", { ref: mid(poly, 0), inner: Ln(k.segment([a[0] + 2, 6, Z_FLOOR], [a[0] + 2, 6, a[2] + (2 * (b[2] - a[2])) / (b[0] - a[0])], P), { tone: "faint" }) });
  }

  // ================= grazing mirrors g1 and relay: wedge substrate on three balls, back plate on the thick half =================
  const wedge = (F, M) => [[-M.half, 0], [M.half, 0], [M.half, M.tip], [0, M.thick], [-M.half, M.thick]].map(([u, s]) => xz(pt(F, s, u)));
  const grazing = (id, F, M, plateU) => {
    const c = pt(F, M.thick / 2, 0);
    plate(`${id}-mirror`, wedge(F, M), -M.width, M.width, "hi", {
      ref: [c[0], -6, c[2]],
      inner: Ln(path3(roundRect(-M.half + 1, M.half - 1, -M.width + 1, M.width - 1, 0.6, 2).map(([u, v]) => pt(F, 0, u, v)), true), { tone: "faint" }),
    });
    for (const [u, v] of [[-8, -4], [-8, 4], [-2, 0]]) ballAt(PIECE, pt(F, M.thick + M.ball, u, v), M.ball, { tone: "mid", name: nm(`${id}-ball`) });
    prism(PIECE, F, roundRect(plateU[0], plateU[1], M.lug ?? -6.5, 6.5, 0.5, 2), M.plate[0], M.plate[1], { tone: "mid" }, { name: nm(`${id}-backplate`), ref: pt(F, M.plate[0], (plateU[0] + plateU[1]) / 2, -6) });
  };
  grazing("g1", GFr, G1M, [-10, 0]);
  // DERIVED: the relay back plate covers only u -9..-3; above that its back would reach the mask-to-M1 leg
  grazing("relay", RFr, RLM, [-9, -3]);
  // relay arm: a bar at y -10.4..-9, beside the beam, from the snout's end plate through the POB port to the relay back plate's lug
  {
    const A = atS([off2(O.g1, fr, 0), fd], S_END);
    const B = xz(pt(RFr, (RLM.plate[0] + RLM.plate[1]) / 2, -6.5));
    const ab = [B[0] - A[0], B[1] - A[1]];
    const l = Math.hypot(...ab);
    const pa = [-fd[1], fd[0]];
    const pb = [-ab[1] / l, ab[0] / l];
    const H = 1.5;
    const arm = [[A[0] + pa[0] * H, A[1] + pa[1] * H], [A[0] - pa[0] * H, A[1] - pa[1] * H], [B[0] - pb[0] * H, B[1] - pb[1] * H], [B[0] + pb[0] * H, B[1] + pb[1] * H]];
    plate("relay-arm", arm, SNOUT_Y - 1.4, SNOUT_Y, "mid", { ref: mid(arm, -10) });
  }

  // ================= cooling: each mirror's water runs straight back to bosses on the back wall (feedthroughs) =================
  const feed = (n, start, r) => {
    const end = [start[0], YB + 1, start[2]];
    boss(PIECE, [start[0], YB, start[2]], [0, 1, 0], r * 2.4, 1, { tone: "mid", name: nm(`${n}-feedthrough`) });
    return end;
  };
  for (const u of [13, 15]) {
    const s = pt(FFr, (FF.base + 6.5) / 2, u, -15.5);
    pipe(PIECE, [s, feed("ff", s, 0.6)], 0.6, { tone: "mid", flangeR: 1.3, name: nm("ff-coolant") });
  }
  for (const ang of [-80, -100]) {
    const a = (ang * Math.PI) / 180;
    const face = boss(PIECE, G.pointOf(PFc, (PFM.facet + PFM.base) / 2, PFM.r, a), G.radialOf(PFc, a), 0.9, 1, { tone: "mid", name: nm("pf-port") });
    const out = add(face, mul(G.radialOf(PFc, a), 2.5));
    pipe(PIECE, [face, out, feed("pf", out, 0.55)], 0.55, { tone: "mid", flangeR: 1.6, name: nm("pf-coolant") });
  }
  for (const u of [-6, -2]) {
    const s = pt(GFr, G1M.thick / 2, u, -G1M.width);
    pipe(PIECE, [s, feed("g1", s, 0.5)], 0.5, { tone: "mid", flangeR: 1.6, name: nm("g1-coolant") });
  }

  // ================= actuator harness: one cable per column board, up off the board and back to the feedthrough =================
  const CAB_U = -9.4;
  const ends = colV.map(([v0, v1], j) => {
    const vc = (v0 + v1) / 2;
    const p0 = pt(FFr, FF.board[1], CAB_U, vc);
    const p1 = pt(FFr, FF.board[1] + 2.1 + 1.3 * j, CAB_U, vc);
    const p2 = [p1[0], YB + 2, p1[2]];
    cable(PIECE, [p0, p1, p2], { r: 0.5, bend: 1.6, bundle: nm("ff-harness"), name: nm("ff-cable"), tone: "mid" });
    return p2;
  });
  {
    const xs = ends.map((p) => p[0]);
    const zs = ends.map((p) => p[2]);
    box("ff-connector", [Math.min(...xs) - 1.6, YB, Math.min(...zs) - 1.6], [Math.max(...xs) + 1.6, YB + 2, Math.max(...zs) + 1.6], "mid");
  }

  // ================= services on the upper +x wall: pump port and gate valve, gauge, H2 purge, label =================
  {
    const F = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const PY = -12, PZ = 290;
    turned(PIECE, F(XO, PY, PZ), [[0, 4.4], [1.2, 4.4]], { tone: "mid" }, { name: nm("pump-boss") });
    turned(PIECE, F(XO + 1.2, PY, PZ), [[0, 4.2], [1.1, 4.2], [1.1, 3], [4, 3], [4, 4.2], [5.1, 4.2]], { tone: "mid" }, { name: nm("pump-spool"), extra: Dots(G.dotsOf(F(XO + 1.2, PY, PZ), 5.1, 3.5, 8, P, { fade: [0.04, 0.42] }).map((d) => d), { size: 0.4 }) });
    const VX = XO + 6.3;
    box("gate-valve", [VX, PY - 5.4, PZ - 5.4], [VX + 4, PY + 5.4, PZ + 5.4], "mid", { inner: Ln(k.sideSeam({ x: VX, y: PY - 5.4, w: 4, d: 10.8, r: 0.4 }, PZ, P, 3), { tone: "faint" }) });
    box("gate-bonnet", [VX + 0.8, PY - 2, PZ + 5.4], [VX + 3.2, PY + 2, PZ + 10], "lo", { extra: screwsOn([[VX + 2, PY]], PZ + 10, { ring: 0.7, size: 0.4 }) });
    turned(PIECE, F(VX + 4, PY, PZ), [[0, 4.2], [1.2, 4.2]], { tone: "mid" }, { name: nm("pump-flange"), extra: Dots(G.dotsOf(F(VX + 4, PY, PZ), 1.2, 3.4, 8, P, { all: true }), { size: 0.42 }) + Ln(G.circleOf(F(VX + 4, PY, PZ), 1.2, 2.4, P, 24), { tone: "faint" }) });

    // vacuum gauge, its cable down a clamp to the wall's junction box
    const GY = -2, GZ = 302;
    const gface = boss(PIECE, [XO, GY, GZ], [1, 0, 0], 1.6, 1, { tone: "mid", name: nm("gauge-boss") });
    turned(PIECE, F(gface[0], GY, GZ), [[0, 1.4], [1.2, 1.4], [1.2, 2.4], [6.4, 2.4], [7, 1.9]], { tone: "mid" }, { name: nm("gauge") });
    const gEnd = [gface[0] + 7, GY, GZ];
    const JB = { x1: XO + 3, z0: 263, z1: 272 };
    box("junction-box", [XO, GY - 4, JB.z0], [JB.x1, GY + 4, JB.z1], "mid", { inner: Ln(k.sideSeam({ x: XO, y: GY - 4, w: 3, d: 8, r: 0.4 }, JB.z1 - 1.5, P, 3), { tone: "faint" }) });
    const CX = gEnd[0] + 1.6;
    const clamp = clampAt(PIECE, [CX, GY, 285], [0, 0, 1], 1.2, { name: nm("gauge-clamp"), bundle: nm("gauge") });
    box("clamp-bracket", [XO, GY - 0.6, 284.4], [CX - 1.2, GY + 0.6, 285.6], "lo");
    cable(PIECE, [gEnd, [CX, GY, GZ], [CX, GY, 267.5], [JB.x1, GY, 267.5]], { r: 0.5, bend: 2.2, name: nm("gauge-cable"), clamps: [clamp], bundle: nm("gauge"), touch: [nm("gauge-clamp*")] });

    // H2 purge (~5 Pa scanner atmosphere [euvlitho 2024 S45]): inlet fitting outside, a line and nozzle inside over the field facets
    const HY = -21, HZ = 300;
    const hface = boss(PIECE, [XO, HY, HZ], [1, 0, 0], 1.4, 1, { tone: "mid", name: nm("purge-boss") });
    turned(PIECE, F(hface[0], HY, HZ), [[0, 1], [1.4, 1], [1.4, 1.6], [3.4, 1.6], [3.4, 1], [4.8, 1]], { tone: "hi" }, { name: nm("purge-fitting") });
    const iface = boss(PIECE, [X_HI, HY, HZ], [-1, 0, 0], 1.4, 1, { tone: "mid", name: nm("purge-inner-boss") });
    const nozzleAt = [320, HY, HZ];
    pipe(PIECE, [iface, nozzleAt], 0.5, { tone: "mid", flangeR: 1.8, name: nm("purge-line") });
    turned(PIECE, G.frameOf(nozzleAt, [-1, 0, 0], [0, 1, 0], [0, 0, 1]), [[0, 0.8], [2, 0.8], [2.8, 0.45]], { tone: "hi" }, { name: nm("purge-nozzle") });

    // label plate: three printed rule lines
    const LX = XO + 0.4;
    box("label", [XO, -25, 256], [LX, -13, 263], "lo", {
      extra: Ln([[261.4, 10], [259.8, 7], [258.2, 8.5]].map(([z, w]) => k.segment([LX, -24, z], [LX, -24 + w, z], P)).join(""), { tone: "lo", free: true }) + Dots([at([LX, -24.4, 262.4]), at([LX, -13.6, 256.6])], { size: 0.38 }),
    });
  }
}
