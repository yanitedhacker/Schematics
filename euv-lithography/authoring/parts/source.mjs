// Tin-plasma EUV source vessel, cut open on +y. The collector sits at the bottom facing up, its axis tilted 27 deg toward
// the illuminator; tin droplets cross the plasma point along -y from the generator on the front ledge to the catcher at the back;
// the CO2 beam rises from the floor port, folds twice in the final focus assembly and climbs the axis through the collector's
// hole inside the hydrogen gas cone; the light converges through the vane frame and the IF neck to the intermediate focus.
// Sources: research/source.md (Fomenkov 2017, Purvis 2020, Cymer/ASML patents); optics from parts/illum.mjs (euv()).
// DERIVED collector (solved in euv()): foci 120 apart on an axis tilted 27.1 deg from vertical toward the field facet mirror;
// rim Ø65 and a Ø12 hole together subtend 5.5 sr, which gives a = 79.7, b = 52.5, the vertex 19.7 behind the plasma, the rim
// plane 2.7 behind it, rim AOI 39.9 deg (sourced "approaches 45") and an IF cone half-angle of 14.8 deg.
// DERIVED droplets along y: tilted 27 deg, the rim's uphill side stands 11 cm above the plasma, so only a path square to the
// tilt plane (along y) clears it (by 2.4 cm).
import { k, G, A } from "../lib.mjs";
import { euv, HOLE_R, RIM_R } from "./illum.mjs";

const PIECE = "source";
const DEG = Math.PI / 180;

// DERIVED: collector substrate 4.5 cm: Mo/Si-coated substrate with milled cooling channels under the face (collector held < 50 C [US8575575B2])
const COLLECTOR_T = 4.5;
// DERIVED: vessel walls 3 cm stainless, roof 6 cm: they run above 232 C [US8575575B2] and carry the neck, pumps and doors
const WALL = 3;
const ROOF_T = 6;
// DERIVED: vessel cut on the plane y = 30, just in front of the collector rim (r 32.5) so its bore stays whole
const CUT_Y = 30;
// DERIVED: nozzle 45 cm from the plasma, just outside the collector's cooling ring (r 40.6); research estimates ~30 cm
const NOZZLE_Y = 45;
// DERIVED: catcher mouth 44 cm out, Ø6 cm (inside the 20-100 mm range), axis 12 deg above the droplet path (1-30 deg) [US8138487B2]
const CATCHER_Y = -44;
const CATCHER_TILT = 12 * DEG;

export function build(L, ctx) {
  const { P, MOUNTS, PORTS, ENV } = ctx;
  const { at, S, Ln, Dots, put, record, slab, boxOf, turned, band, prism, ballAt, boss, padOn, flangeAt, pipe, cable, clampAt, screwsOn } = L;
  const O = euv(ctx.OPTIC);
  const { plasma, AX, F: CF, E } = O;
  const name = (part) => `${PIECE}.${part}`;
  const FZ = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const vert = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const onAxis = (s) => G.add3(plasma, G.mul3(AX, s));
  const box = (part, a, b, tone = "mid", options = {}) => boxOf(PIECE, a, b, { tone }, { name: name(part), ...options });
  const seamOf = (a, b, z, steps = 2) => k.sideSeam({ x: a[0], y: a[1], w: b[0] - a[0], d: b[1] - a[1], r: 0.4 }, z, P, steps);

  // a lathe body from a closed [s, r] meridian, recorded as drawn
  function body(part, F, meridian, style = {}, { extra = "", inner = "", bias = 0, hole = null, smooth = false, owner } = {}) {
    const id = L.nameFor(name(part));
    const ss = meridian.map(([s]) => s);
    const mid = (Math.min(...ss) + Math.max(...ss)) / 2;
    const paths = G.lathe(meridian, F, P, { hole, smooth });
    const shape = record(A.body(F, meridian.map(([s, r]) => [s, r]), { name: id, owner }));
    put(PIECE, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [shape] });
    return shape;
  }
  const ring = (part, F, s0, s1, rIn, rOut, style = {}, options = {}) => body(part, F, [[s0, rIn], [s0, rOut], [s1, rOut], [s1, rIn]], style, { hole: [s1, rIn], ...options });

  const shapeNamed = (id) => L.R.solids.findLast((shape) => shape.name === id);
  const crossAt = (line, centre, axis) => { let best = 0; let d0 = Infinity; const n = 2000; const tot = G.pathLength(line); for (let i = 0; i <= n; i++) { const p = G.pointAlong(line, (tot * i) / n); const d = Math.abs(G.dot3(G.sub3(p, centre), axis)) + G.len3(G.sub3(p, centre)) * 0.01; if (d < d0) { d0 = d; best = (tot * i) / n; } } return best; };
  // a pad on a thin plate needs a host deep enough for padOn's search: the plate's own shape extended down, same name and piece
  const deep = (shape, by) => ({ ...shape, s0: shape.s0 - by });
  const ground = (plan, z) => record({ ...A.slab(plan, z - 1, 1, { name: "stand.stub" }), ground: true });

  // ================= vessel: feet on the base frame deck, floor, walls cut at y = CUT_Y, roof =================
  // DERIVED: the vessel stands on its own steel pedestal on the raised floor (the scanner's base deck stops short of it);
  // the pedestal top at z 94 puts the collector's vertex just above the vessel floor with the plasma at OPTIC.plasma
  const DECK = 94;
  const VP = { x: 318, y: -122, w: 122, d: 226, r: 10 };    // DERIVED: Ø65 collector + carriage; generator bay on the +y ledge, catcher bay at the back
  const X0 = VP.x;
  const X1 = VP.x + VP.w;
  const YB = VP.y;
  const FLOOR = [DECK + 2, DECK + 7];
  const ROOF = [206, 206 + ROOF_T];       // DERIVED: roof under the IF neck; light cone r 9 there
  const FEET = [[330, -110], [428, -110], [330, 78], [428, 78]];
  const TOP = [DECK - 4, DECK];
  const LEG = 5;
  for (const [x, y] of FEET) {
    const base = { x: x - 9, y: y - 9, w: 18, d: 18, r: 1 };
    slab(PIECE, base, 0, 2, { tone: "lo" }, { name: name("pedestal-foot"), extra: screwsOn(k.corners(base, 2.4), 2, { ring: 0.8, size: 0.4 }) });
    box("pedestal-leg", [x - LEG, y - LEG, 2], [x + LEG, y + LEG, TOP[0]], "lo", { inner: Ln([30, 60].map((z) => seamOf([x - LEG, y - LEG], [x + LEG, y + LEG], z)).join(""), { tone: "faint" }) });
  }
  // top frame on the legs and a brace ring at knee height
  const [xa, xb] = [FEET[0][0], FEET[1][0]];
  const [ya, yb] = [FEET[0][1], FEET[2][1]];
  for (const [z0, z1, part] of [[TOP[0], TOP[1], "pedestal-top"], [28, 33, "pedestal-brace"]]) {
    for (const y of [ya, yb]) box(part, [xa + LEG, y - 4, z0], [xb - LEG, y + 4, z1], "lo");
    for (const x of [xa, xb]) box(part, [x - 4, ya + LEG, z0], [x + 4, yb - LEG, z1], "lo");
  }
  for (const [x, y] of FEET) {
    const plan = { x: x - 7, y: y - 7, w: 14, d: 14, r: 1 };
    box("pedestal-cap", [x - LEG, y - LEG, TOP[0]], [x + LEG, y + LEG, TOP[1]], "lo");
    slab(PIECE, plan, DECK, 2, { tone: "lo" }, { name: name("foot"), extra: screwsOn(k.corners(plan, 2.2), DECK + 2, { ring: 0.8, size: 0.4 }) });
  }
  ctx.back.push(`<path class="iso-halo" d="${k.haloOf(VP, DECK, 2, P)}"/>`);
  slab(PIECE, VP, FLOOR[0], FLOOR[1] - FLOOR[0], { tone: "lo" }, { name: name("floor"), steps: 6, bevel: 0.6, inner: Ln(k.sideSeam(VP, FLOOR[0] + 2, P, 6), { tone: "faint" }) });

  const WZ = [FLOOR[1], ROOF[0]];
  const corner = (c, a0, a1, n, part) => {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const p = (t, r) => [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
      prism(PIECE, FZ, [p(t0, VP.r - WALL), p(t0, VP.r), p(t1, VP.r), p(t1, VP.r - WALL)], WZ[0], WZ[1], { tone: "mid" }, { name: name(part) });
    }
  };
  const CL = [X0 + VP.r, YB + VP.r];
  const CR = [X1 - VP.r, YB + VP.r];
  box("wall-back", [CL[0], YB, WZ[0]], [CR[0], YB + WALL, WZ[1]], "mid", { inner: Ln(seamOf([CL[0], YB], [CR[0], YB + WALL], WZ[1] - 8), { tone: "faint" }) });
  corner(CL, Math.PI, 1.5 * Math.PI, 5, "wall-corner");
  corner(CR, 1.5 * Math.PI, 2 * Math.PI, 5, "wall-corner");
  box("wall-left", [X0, CL[1], WZ[0]], [X0 + WALL, CUT_Y, WZ[1]], "mid");
  box("wall-right", [X1 - WALL, CR[1], WZ[0]], [X1, CUT_Y, WZ[1]], "mid", { inner: Ln(seamOf([X1 - WALL, CR[1]], [X1, CUT_Y], WZ[1] - 8), { tone: "faint" }) });

  // roof: one prism, back corners round, cut square at the front; bolt row along its flange
  const arc = (c, a0, a1, r, n) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]; });
  const ROOF_POLY = [[X0, CUT_Y], ...arc(CL, Math.PI, 1.5 * Math.PI, VP.r, 8), ...arc(CR, 1.5 * Math.PI, 2 * Math.PI, VP.r, 8), [X1, CUT_Y]];
  const roofBolts = [];
  for (let y = CR[1]; y <= CUT_Y - 3; y += 9) roofBolts.push([X1 - 1.5, y], [X0 + 1.5, y]);
  for (let x = CL[0]; x <= CR[0]; x += 9) roofBolts.push([x, YB + 1.5]);
  prism(PIECE, FZ, ROOF_POLY, ROOF[0], ROOF[1], { tone: "mid" }, { name: name("roof"), extra: Dots(roofBolts.map(([x, y]) => at([x, y, ROOF[1]])), { size: 0.4, tone: "mid" }) });
  const ROOF_SHAPE = shapeNamed(name("roof"));

  // ================= collector =================
  const { a, b, c, sRim } = E;
  const rIn = E.r;
  const aO = a + COLLECTOR_T;
  const bO = b + COLLECTOR_T;
  const rOut = (s) => bO * Math.sqrt(Math.max(0, 1 - ((s - c) / aO) ** 2));
  const slopeOut = (s) => -(bO * (s - c)) / (aO * aO * Math.sqrt(Math.max(1e-9, 1 - ((s - c) / aO) ** 2)));
  const sAt = (radius, aa, bb) => c - aa * Math.sqrt(1 - (radius / bb) ** 2);   // where an ellipse surface reaches `radius`, vertex side
  const sHoleIn = sAt(HOLE_R, a, b);
  const sHoleOut = sAt(HOLE_R, aO, bO);
  const RO = rOut(sRim);
  const knots = (s0, s1, n, f) => Array.from({ length: n + 1 }, (_, i) => { const s = s0 + (s1 - s0) * (i / n) ** 1.6; return [s, f(s)]; });
  const RING = { s0: sRim - 4.5, s1: sRim - 0.5, r: RO + 2.5 };
  const outerRun = knots(sHoleOut, RING.s0, 24, rOut);
  const innerRun = knots(sHoleIn, RING.s0, 24, rIn).reverse();
  const innerRim = knots(RING.s0, sRim, 4, rIn).reverse();
  let BACK;
  {
    // back of the dish, hole to the cooling ring
    const id = name("collector");
    const outer = G.lathe([[sHoleOut, 0], ...outerRun.map(([s, r]) => [s, r, 1]).slice(0, -1), [RING.s0, rOut(RING.s0)], [RING.s0, 0]], CF, P, { smooth: { slope: slopeOut, radius: (s) => (s <= sHoleOut ? 0 : rOut(s)) } });
    BACK = { svg: S(outer, { tone: "hi" }), shape: record(A.body(CF, [...outerRun, [RING.s0, rIn(RING.s0)], ...innerRun], { name: id })) };
  }
  let COOL_RING;
  {
    // rim band with its cooling ring, and the Mo/Si face seen through the rim: zone rings and the hole, clipped to the rim
    const id = name("collector");
    const meridian = [[RING.s0, 0], [RING.s0, RING.r], [RING.s1, RING.r], [RING.s1, rOut(RING.s1)], [sRim, RO], [sRim, 0]];
    const paths = G.lathe(meridian, CF, P, {});
    const rimD = G.circleOf(CF, sRim, RIM_R, P, 96);
    const zones = [-14, -10, -6].map((s) => G.arcOf(CF, s, rIn(s), P, { inward: true, slope: E.slope(s), least: -1 })).join("");
    const holeD = G.circleOf(CF, sHoleIn, HOLE_R, P, 32);
    // DERIVED: gas cone tapers from the hole (r 6) to 2.4 at 7 cm short of the plasma; H2 jets 1-20 slm [US8304752B2, US9795023B2]
    const CONE = [[sHoleIn, HOLE_R], [-7, 2.4]];
    const cone = S(G.solidOf(CONE, CF, P), { tone: "mid" });
    const face = `<clipPath id="src-rim"><path d="${rimD}"/></clipPath><g clip-path="url(#src-rim)"><path class="iso-shade" data-shade="0" d="${rimD}"/>${Ln(zones, { tone: "faint" })}<path class="iso-fill" d="${holeD}"/>${Ln(holeD, { tone: "lo" })}${cone}</g>${Ln(rimD, { tone: "hi" })}`;
    const bolts = Dots(G.dotsOf(CF, RING.s1, RING.r - 1.2, 24, P, { fade: [0.04, 0.42] }), { size: 0.4, tone: "mid" });
    const crescent = [[RING.s0, rOut(RING.s0)], [RING.s0, RING.r], [RING.s1, RING.r], [RING.s1, rOut(RING.s1)], [sRim, RO], [sRim, RIM_R], ...innerRim];
    COOL_RING = record(A.body(CF, crescent, { name: id }));
    // one item: the back, then the rim band with the ring, then the face; the three nest, so no painter's key could split them
    put(PIECE, onAxis((sHoleOut + sRim) / 2), BACK.svg + S(paths, { tone: "hi" }) + bolts + face, { name: id, shapes: [BACK.shape, COOL_RING, record(A.solid(CF, [[sHoleIn, HOLE_R], [-7, 2.4]], { name: name("gas-cone"), owner: id }))] });
  }

  // three kinematic mounts: boss on the ring's back face, ball, post down to the swap carriage
  const MOUNT_R = RO + 1.2;
  const BALL = 2.4;
  const posts = [0, 120, 240].map((deg) => {
    const face = G.pointOf(CF, RING.s0, MOUNT_R, deg * DEG);
    const out = boss(PIECE, face, G.mul3(AX, -1), 1.2, 1.6, { name: name("mount-boss"), tone: "mid" });
    const centre = G.add3(out, G.mul3(AX, -Math.sqrt(BALL ** 2 - 1.2 ** 2)));
    ballAt(PIECE, centre, BALL, { name: name("mount-ball"), tone: "hi" });
    return centre;
  });
  // swap carriage on two floor rails; it rolls out through the service door on +x
  const FT = FLOOR[1];
  const RAIL_T = FT + 2;
  const BEAM = [RAIL_T, RAIL_T + 4];
  const yPost = Math.abs(posts[1][1]);
  for (const s of [1, -1]) {
    const y0 = s > 0 ? yPost - 2 : -yPost - 2;
    box("rail", [X0 + WALL + 6, y0 + 0.5, FT], [X1 - WALL, y0 + 3.5, RAIL_T], "lo", { extra: screwsOn([[X0 + 12, y0 + 2], [380, y0 + 2], [X1 - 8, y0 + 2]], RAIL_T, { ring: 0.6, size: 0.35 }) });
    box("carriage-beam", [350, y0 - 2, BEAM[0]], [428, y0 + 6, BEAM[1]], "mid", { inner: Ln(seamOf([350, y0 - 2], [428, y0 + 6], BEAM[0] + 2), { tone: "faint" }) });
  }
  box("carriage-cross", [414, -yPost + 4, BEAM[0]], [426, yPost - 4, BEAM[1]], "mid", { extra: screwsOn([[416, -yPost + 8], [424, yPost - 8]], BEAM[1], { ring: 0.6, size: 0.35 }) });
  box("carriage-cross", [350, -yPost + 4, BEAM[0]], [358, yPost - 4, BEAM[1]], "mid");
  for (const centre of posts) {
    const top = centre[2] - Math.sqrt(BALL ** 2 - 1.3 ** 2);
    flangeAt(PIECE, [centre[0], centre[1], BEAM[1] + 0.5], [0, 0, 1], 3, 1, { tone: "mid", bolts: 4, name: name("post-foot") });
    turned(PIECE, vert(centre[0], centre[1], BEAM[1] + 1), [[0, 1.3], [top - BEAM[1] - 1, 1.3]], { tone: "mid" }, { name: name("mount-post") });
  }

  // ================= CO2 beam: floor port, riser, final focus assembly, gas cone =================
  const BEAM_IN = PORTS.beamEntry.at;
  // DERIVED: riser r 7 carries the expanded beam; its floor flange r 14 matches the beamline's port [PORTS.beamEntry]
  pipe(PIECE, [[BEAM_IN[0], BEAM_IN[1], BEAM_IN[2]], [BEAM_IN[0], BEAM_IN[1], FLOOR[0]]], 7, { name: name("beam-riser"), free: [true, false], flangeR: [PORTS.beamEntry.r / 7, 1.5], bellows: [0.12, 0.3, 7], bands: [0.6] });
  // final focus assembly: M1 folds the beam to +x, M2 (all-reflective focusing mirror, DERIVED f ~ 34 cm: its distance to the plasma) folds it up the axis
  const FFA = [[372, -11, FT], [404, 11, FT + 5]];
  const M_Z = FT + 2.5;
  const tM2 = (plasma[2] - M_Z) / -AX[2];
  box("ffa", FFA[0], FFA[1], "mid", { inner: Ln(seamOf(FFA[0], FFA[1], FT + 1.5), { tone: "faint" }), extra: screwsOn([[374, -9], [402, -9], [374, 9], [402, 9]], FFA[1][2], { ring: 0.6, size: 0.35 }) + Ln(k.planOutline({ x: 375, y: -8, w: 12, d: 16, r: 1 }, FFA[1][2], P, 2), { tone: "faint" }) });
  const FFA_SHAPE = shapeNamed(name("ffa"));
  const sTop = (FFA[1][2] - plasma[2]) / AX[2];
  const snoutFace = padOn(PIECE, deep(FFA_SHAPE, 12), onAxis(sTop), AX, 3.4, 1.2, { name: name("ffa-snout-pad"), tone: "mid" });
  const sSnout = G.dot3(G.sub3(snoutFace, plasma), AX);
  const sConeBack = sHoleOut - 1.5;
  turned(PIECE, CF, [[sSnout, 2.8], [sConeBack, 2.8]], { tone: "mid" }, { name: name("ffa-snout") });
  turned(PIECE, CF, [[sConeBack, 6.4], [sHoleOut, 6.4]], { tone: "mid" }, { name: name("gas-cone-flange") });

  // ================= neck: roof pad, flange, cone to the IF flange, H2 collar =================
  const sRoof = (ROOF[1] - plasma[2]) / AX[2];
  // DERIVED: neck pad 8.5 tall so the 15 cm flange clears the roof on its low side (15 x tan 27 deg = 7.6)
  const neckFace = padOn(PIECE, deep(ROOF_SHAPE, 50), onAxis(sRoof), AX, 15, 8.5, { name: name("neck-pad"), tone: "mid" });
  const sN = G.dot3(G.sub3(neckFace, plasma), AX);
  turned(PIECE, CF, [[sN, 15], [sN + 1.5, 15]], { tone: "mid" }, { name: name("neck-flange"), extra: Dots(G.dotsOf(CF, sN + 1.5, 13.6, 14, P, { fade: [0.04, 0.42] }), { size: 0.4, tone: "mid" }) });
  const NECK0 = sN + 1.5;
  const neckR = (s) => 13 + ((s - NECK0) / (116 - NECK0)) * (6.5 - 13);
  const COLLAR = [101, 105];
  turned(PIECE, CF, [[NECK0, 13], [COLLAR[0], neckR(COLLAR[0])]], { tone: "mid" }, { name: name("neck") });
  const collar = turned(PIECE, CF, [[COLLAR[0], neckR(COLLAR[0]) + 3], [COLLAR[1], neckR(COLLAR[1]) + 3]], { tone: "mid" }, { name: name("h2-collar"), inner: G.arcOf(CF, (COLLAR[0] + COLLAR[1]) / 2, neckR(COLLAR[1]) + 3, P) });
  turned(PIECE, CF, [[COLLAR[1], neckR(COLLAR[1])], [116, 6.5]], { tone: "mid" }, { name: name("neck") });
  turned(PIECE, CF, [[116, 9], [118, 9]], { tone: "mid" }, { name: name("if-flange"), extra: Dots(G.dotsOf(CF, 118, 7.6, 10, P, { fade: [0.04, 0.42] }), { size: 0.4, tone: "mid" }) });

  // ================= droplet generator on the floor ledge at +y, firing -y across the plasma =================
  // s runs along +y from the plasma: nozzle at NOZZLE_Y, then capillary, piezo head, filter, reservoir toward the vessel front
  const DGF = G.frameOf([plasma[0], 0, plasma[2]], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const ZP = plasma[2];
  turned(PIECE, DGF, [[NOZZLE_Y, 1.1], [NOZZLE_Y + 5, 1.6]], { tone: "hi" }, { name: name("dg-shroud") });
  const CAP = [NOZZLE_Y + 5, NOZZLE_Y + 15];
  turned(PIECE, DGF, [[CAP[0], 1.4], [CAP[1], 2.6]], { tone: "hi" }, { name: name("dg-capillary") });
  // DERIVED: piezo pump chamber Ø8.4: the piezo disk drives a membrane so the tin never touches it [WO2017102261A1]
  const PZ = [CAP[1], CAP[1] + 11];
  const PIEZO = turned(PIECE, DGF, [[PZ[0], 4.2], [PZ[1], 4.2]], { tone: "hi" }, { name: name("dg-piezo"), inner: G.arcOf(DGF, PZ[0] + 5.5, 4.2, P) });
  const FIL = [PZ[1], PZ[1] + 5];
  turned(PIECE, DGF, [[FIL[0], 5.5], [FIL[1], 5.5]], { tone: "mid" }, { name: name("dg-filter"), inner: G.arcOf(DGF, FIL[0] + 2.5, 5.5, P) });
  // DERIVED: tin reservoir Ø18 x 22 cm held above tin's 232 C melting point by two heater bands; gas pressure feeds the nozzle [Purvis 2020]
  const RES = [FIL[1], FIL[1] + 22];
  const BANDS = [[RES[0] + 5, RES[0] + 7], [RES[0] + 14, RES[0] + 16]];
  const cuts = [RES[0], ...BANDS.flat(), RES[1]];
  const resShapes = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const banded = i % 2 === 1;
    const first = i === 0;
    const last = i === cuts.length - 2;
    const prof = first ? [[cuts[i], 7.5], [cuts[i] + 1.5, 9], [cuts[i + 1], 9]] : last ? [[cuts[i], 9], [cuts[i + 1] - 1.5, 9], [cuts[i + 1], 7.5]] : [[cuts[i], banded ? 9.6 : 9], [cuts[i + 1], banded ? 9.6 : 9]];
    const shape = turned(PIECE, DGF, prof, { tone: banded ? "mid" : "hi" }, { name: name(banded ? "dg-heater-band" : "dg-reservoir") });
    if (!banded) resShapes.push(shape);
  }
  turned(PIECE, DGF, [[RES[1], 5], [RES[1] + 2, 5]], { tone: "mid" }, { name: name("dg-end-cap"), extra: Dots(G.dotsOf(DGF, RES[1] + 2, 3.8, 6, P, { all: true }), { size: 0.4, tone: "mid" }) });
  // steering stage: column on the floor, base plate, x-z slide carrying two cradles under the reservoir
  const SC = [[plasma[0] - 10, RES[0] + 2, FT], [plasma[0] + 10, RES[1] - 2, ZP - 18]];
  box("dg-column", SC[0], SC[1], "lo", { inner: Ln(seamOf(SC[0], SC[1], FT + 4), { tone: "faint" }) });
  const SB = [[plasma[0] - 15, RES[0], ZP - 18], [plasma[0] + 15, RES[1], ZP - 15]];
  box("dg-stage-base", SB[0], SB[1], "mid", { extra: screwsOn([[SB[0][0] + 1.6, SB[0][1] + 1.6], [SB[1][0] - 1.6, SB[0][1] + 1.6], [SB[0][0] + 1.6, SB[1][1] - 1.6], [SB[1][0] - 1.6, SB[1][1] - 1.6]], ZP - 15, { ring: 0.6, size: 0.35 }) });
  const SL = [[plasma[0] - 9, RES[0] + 1, ZP - 15], [plasma[0] + 9, RES[1] - 1, ZP - 12]];
  box("dg-stage-slide", SL[0], SL[1], "mid", { inner: Ln(seamOf(SL[0], SL[1], ZP - 13.5), { tone: "faint" }) });
  for (const dx of [-12.5, 12.5]) {
    const F = vert(plasma[0] + dx, (RES[0] + RES[1]) / 2, ZP - 15);
    turned(PIECE, F, [[0, 1.7], [4.5, 1.7]], { tone: "mid" }, { name: name("dg-stage-motor"), extra: Ln(G.circleOf(F, 4.5, 0.8, P, 16), { tone: "faint" }) });
  }
  for (const s of [RES[0] + 3, RES[1] - 3]) padOn(PIECE, resShapes, G.pointOf(DGF, s, 0, 0).map((v, i) => (i === 2 ? ZP - 9 : v)), [0, 0, -1], 1.9, 3, { name: name("dg-cradle"), tone: "mid" });
  // tin feed and gas-pressure line from the end cap to a floor feedthrough
  const capFace = G.pointOf(DGF, RES[1] + 2, 0, 0);
  const FEED = [plasma[0], RES[1] + 6, FT];
  boss(PIECE, FEED, [0, 0, 1], 2.2, 1.4, { name: name("feedthrough"), tone: "mid" });
  pipe(PIECE, [capFace, G.add3(capFace, [0, 4, 0]), [FEED[0], FEED[1], FT + 1.4]], 1.2, { name: name("dg-gas-line"), bands: [0.55] });
  // piezo drive and heater cables down to floor feedthroughs beside the column
  const LANE_Y = RES[1] + 3.5;
  const harness = (port, lane, part, out = G.radialOf(DGF, 2.6)) => {
    const fd = boss(PIECE, [lane, LANE_Y, FT], [0, 0, 1], 1.1, 1.2, { name: name("feedthrough"), tone: "mid" });
    const lift = G.add3(port, G.mul3(out, 2.5));
    cable(PIECE, [port, lift, [lane, lift[1], lift[2]], [lane, LANE_Y, lift[2]], fd], { name: name(part), bend: 2.5, bundle: "dg-harness" });
  };
  const piezoBoss = padOn(PIECE, PIEZO, G.pointOf(DGF, PZ[0] + 2.5, 4.2, 2.6), G.radialOf(DGF, 2.6), 1, 1, { name: name("dg-piezo-port") });
  harness(piezoBoss, plasma[0] - 19, "piezo-cable");
  BANDS.forEach(([s0, s1], i) => {
    const up = 2.6;
    const port = boss(PIECE, G.pointOf(DGF, (s0 + s1) / 2, 9.6, up), G.radialOf(DGF, up), 0.9, 1, { name: name("heater-port"), tone: "mid" });
    harness(port, plasma[0] - 16.5 + i * 2.2, "heater-cable");
  });

  // ================= catcher at the back, on a heated pedestal =================
  const CAX = [0, -Math.cos(CATCHER_TILT), Math.sin(CATCHER_TILT)];
  const CAF = G.frameAlong([plasma[0], CATCHER_Y, plasma[2]], CAX);
  turned(PIECE, CAF, [[0, 3.8], [1.2, 3.8]], { tone: "hi" }, { name: name("catcher-mouth") });
  turned(PIECE, CAF, [[1.2, 3.3], [13, 3.3]], { tone: "hi" }, { name: name("catcher-tube") });
  turned(PIECE, CAF, [[13, 5.6], [14.5, 5.6]], { tone: "mid" }, { name: name("catcher-flange") });
  const TANK = [[14.5, 7], [17, 7], [17, 7.6], [19, 7.6], [19, 7], [27, 7], [27, 7.6], [29, 7.6], [29, 7]];
  const tankShapes = [];
  for (let i = 0; i < TANK.length - 1; i += 1) {
    if (TANK[i][0] === TANK[i + 1][0]) continue;
    const heater = TANK[i][1] > 7;
    const shape = turned(PIECE, CAF, [TANK[i], TANK[i + 1]], { tone: heater ? "mid" : "hi" }, { name: name(heater ? "catcher-heater" : "catcher-tank") });
    if (!heater) tankShapes.push(shape);
  }
  turned(PIECE, CAF, [[29, 6], [30.5, 6]], { tone: "mid" }, { name: name("catcher-cap") });
  const tankMid = G.pointOf(CAF, 23, 0, 0);
  const tankLow = [tankMid[0], tankMid[1], tankMid[2] - 7 / Math.cos(CATCHER_TILT) - 0.5];
  const padFace = padOn(PIECE, tankShapes[1], tankLow, [0, 0, -1], 1.6, 1.4, { name: name("catcher-pad"), tone: "mid" });
  flangeAt(PIECE, [tankMid[0], tankMid[1], FT + 0.75], [0, 0, 1], 4.2, 1.5, { tone: "mid", bolts: 6, name: name("catcher-base") });
  turned(PIECE, vert(tankMid[0], tankMid[1], FT + 1.5), [[0, 2], [padFace[2] - FT - 1.5, 2]], { tone: "mid" }, { name: name("catcher-post") });

  // ================= vane frame: two rings joined by twelve radial tin vanes around the light cone =================
  // DERIVED: vanes sit outside the converging cone (r 21 at s 40, r 14 at s 66) with 3-4 cm margin; heated, they shed tin [US8519366B2]
  const V0 = [39, 41, 24, 26];
  const V1 = [65, 67, 17, 19];
  ring("vane-ring", CF, V0[0], V0[1], V0[2], V0[3], { tone: "mid" });
  const VR1 = ring("vane-ring", CF, V1[0], V1[1], V1[2], V1[3], { tone: "mid" });
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const Fv = G.frameOf(plasma, G.tangentOf(CF, t), AX, G.radialOf(CF, t));
    prism(PIECE, Fv, [[V0[1], V0[2] + 0.4], [V1[0], V1[2] + 0.4], [V1[0], V1[3] - 0.2], [V0[1], V0[3] - 0.2]], -0.25, 0.25, { tone: "hi" }, { name: name("vane") });
  }
  for (const deg of [0, 120, 240]) {
    const p = G.pointOf(CF, (V1[0] + V1[1]) / 2, V1[3], deg * DEG);
    const face = padOn(PIECE, VR1, [p[0], p[1], p[2] + 0.4], [0, 0, 1], 1.1, 1, { name: name("hanger-pad"), tone: "mid" });
    turned(PIECE, vert(face[0], face[1], face[2]), [[0, 0.8], [ROOF[0] - face[2], 0.8]], { tone: "mid" }, { name: name("vane-hanger") });
  }

  // ================= service door, droplet cameras and light curtains =================
  // DERIVED: door 76 x 92 cm on the +x wall passes the collector carriage (80 cm over its beams) for the < 8 h swap [wikichip 2019]
  const DOOR = { y0: -48, y1: CUT_Y - 2, z0: FT + 4, z1: ROOF[0] - 8 };
  const DX = X1 + 2.5;
  const doorBolts = [];
  for (let y = DOOR.y0 + 2; y <= DOOR.y1 - 2; y += 6) doorBolts.push([DX, y, DOOR.z0 + 2], [DX, y, DOOR.z1 - 2]);
  for (let z = DOOR.z0 + 8; z <= DOOR.z1 - 8; z += 8) doorBolts.push([DX, DOOR.y0 + 2, z], [DX, DOOR.y1 - 2, z]);
  box("door", [X1, DOOR.y0, DOOR.z0], [DX, DOOR.y1, DOOR.z1], "mid", { extra: Dots(doorBolts.map(at), { size: 0.4, tone: "mid" }) });
  for (const z of [DOOR.z0 + 10, (DOOR.z0 + DOOR.z1) / 2, DOOR.z1 - 10]) {
    box("door-hinge-leaf", [DX, DOOR.y0 + 1, z - 3], [DX + 1, DOOR.y0 + 5, z + 3], "lo");
    turned(PIECE, vert(DX + 2.2, DOOR.y0 + 3, z - 3), [[0, 1.2], [6, 1.2]], { tone: "mid" }, { name: name("door-hinge") });
  }
  for (const z of [DOOR.z1 - 40, DOOR.z1 - 12]) box("door-latch", [DX, DOOR.y1 - 7, z - 2], [DX + 2, DOOR.y1 - 3, z + 2], "lo");
  // label plate: three printed rule lines
  {
    const xP = DX + 0.4;
    box("label-plate", [DX, DOOR.y0 + 10, DOOR.z0 + 6], [xP, DOOR.y0 + 26, DOOR.z0 + 13], "lo", {
      extra: Ln([[12, 6], [9, 4.8], [11, 3.6]].map(([w, h]) => k.segment([xP, DOOR.y0 + 12, DOOR.z0 + 6 + h], [xP, DOOR.y0 + 12 + w, DOOR.z0 + 6 + h], P)).join(""), { tone: "lo", free: true }),
    });
  }
  // DERIVED: two narrow-field cameras watch the stream 10 and 22 cm upstream of the plasma, each behind a viewport in the door [US9241395B2]
  const camBoxes = [];
  for (const y of [10, 22]) {
    flangeAt(PIECE, [DX + 0.6, y, ZP], [1, 0, 0], 3.4, 1.2, { tone: "mid", bolts: 6, name: name("viewport") });
    turned(PIECE, G.frameAlong([DX + 1.2, y, ZP], [1, 0, 0]), [[0, 2.2], [5, 2.2], [5, 1.8], [6, 1.8]], { tone: "hi" }, { name: name("camera-lens") });
    const cb = [[DX + 7.2, y - 3.2, ZP - 3.2], [DX + 15.5, y + 3.2, ZP + 3.2]];
    box("camera-body", cb[0], cb[1], "mid", { inner: Ln(k.sideSeam({ x: cb[0][0], y: cb[0][1], w: cb[1][0] - cb[0][0], d: cb[1][1] - cb[0][1], r: 0.4 }, ZP - 1, P, 2), { tone: "faint" }) });
    camBoxes.push(cb);
  }
  // camera cables drop to a junction box on the door
  const JB = [[DX, 8, DOOR.z0 + 3], [DX + 4, 24, DOOR.z0 + 11]];
  box("junction-box", JB[0], JB[1], "mid", { inner: Ln(k.sideSeam({ x: JB[0][0], y: JB[0][1], w: 4, d: 16, r: 0.4 }, DOOR.z0 + 7, P, 2), { tone: "faint" }) });
  camBoxes.forEach((cb, i) => {
    const x = cb[1][0] - 2 - i * 2.4;
    const yy = (cb[0][1] + cb[1][1]) / 2;
    cable(PIECE, [[x, yy, cb[0][2]], [x, yy, JB[1][2] + 5], [DX + 2, yy, JB[1][2] + 5], [DX + 2, yy, JB[1][2]]], { name: name("camera-cable"), bend: 2 });
  });
  // light-curtain lasers on the -x wall's inner face, aimed across the stream at the cameras
  for (const y of [10, 22]) {
    const lb = [[X0 + WALL, y - 2.4, ZP - 2.4], [X0 + WALL + 6, y + 2.4, ZP + 2.4]];
    box("curtain-laser", lb[0], lb[1], "mid");
    turned(PIECE, G.frameAlong([lb[1][0], y, ZP], [1, 0, 0]), [[0, 1.2], [1.5, 1.2]], { tone: "hi" }, { name: name("curtain-lens") });
  }

  // ================= collector coolant: two lines from the cooling ring's low side to floor feedthroughs =================
  for (const deg of [188, 206]) {
    const t = deg * DEG;
    const start = G.pointOf(CF, (RING.s0 + RING.s1) / 2, RING.r, t);
    const port = padOn(PIECE, COOL_RING, start, G.radialOf(CF, t), 1.7, 1.2, { name: name("coolant-port"), tone: "mid" });
    const radial = G.radialOf(CF, t);
    const out = G.add3(port, G.mul3(radial, 4));
    const fd = boss(PIECE, [out[0], out[1], FT], [0, 0, 1], 1.8, 1.2, { name: name("feedthrough"), tone: "mid" });
    pipe(PIECE, [port, out, [fd[0], fd[1], FT + 1.2]], 0.9, { name: name("coolant-line"), flangeR: 1.5 });
  }

  // ================= H2 supply over the roof to the neck collar; pump stub; gauge =================
  const h2 = PORTS.h2Supply.at;
  const collarMid = (COLLAR[0] + COLLAR[1]) / 2;
  const cPort = G.pointOf(CF, collarMid, neckR(collarMid) + 3, -Math.PI / 2);
  const cFace = padOn(PIECE, collar, cPort, [0, -1, 0], 2.2, 1.6, { name: name("collar-port"), tone: "mid" });
  const hZ = cFace[2];
  const back = YB - 3.5;
  const h2Route = [h2, [h2[0], back, h2[2]], [h2[0], back, hZ], [h2[0], -60, hZ], [cFace[0], -36, hZ], [cFace[0], cFace[1], hZ]];
  const h2Line = G.fillet(h2Route, Math.max(1.4 * 2.6, 3), 12, { P, tube: 1.4 });
  const h2Total = G.pathLength(h2Line);
  const STAND_Y = [-100, -76];
  const gaps = STAND_Y.map((y) => crossAt(h2Line, [h2[0], y, hZ], [0, 1, 0])).map((s) => [s - 0.95, s + 0.95]);
  void h2Total;
  pipe(PIECE, h2Route, 1.4, { name: name("h2-line"), flangeR: [PORTS.h2Supply.r / 1.4, 1.4], free: [true, false], gaps, touch: [`${PIECE}.h2-clamp*`] });
  for (const y of STAND_Y) {
    clampAt(PIECE, [h2[0], y, hZ], [0, 1, 0], 2.2, { name: name("h2-clamp") });
    turned(PIECE, vert(h2[0], y, ROOF[1]), [[0, 0.8], [hZ - 2.2 - ROOF[1] + 0.05, 0.8]], { tone: "mid" }, { name: name("h2-stanchion") });
  }
  const pumpAt = PORTS.pumpSource.at;
  pipe(PIECE, [[pumpAt[0], YB, pumpAt[2]], pumpAt], 5.5, { name: name("pump-stub"), flangeR: [1.7, PORTS.pumpSource.r / 5.5], free: [false, true] });
  // vacuum gauge and an EUV energy sensor port on the roof
  for (const [x, y, r, h, part] of [[420, -90, 2.4, 6, "gauge"], [415, -40, 3, 4, "euv-sensor"]]) {
    flangeAt(PIECE, [x, y, ROOF[1] + 0.6], [0, 0, 1], r + 1.6, 1.2, { tone: "mid", bolts: 6, name: name(`${part}-flange`) });
    turned(PIECE, vert(x, y, ROOF[1] + 1.2), [[0, r], [h, r], [h, r * 0.6], [h + 1.5, r * 0.6]], { tone: "hi" }, { name: name(part) });
  }

  // ================= roof stiffeners and lifting lugs; wall stiffeners and the wall-heater controller on +x =================
  // DERIVED: three 2.5 cm ribs stiffen the 6 cm roof against 1 atm when the vessel is pumped (span ~1.2 m)
  for (const y of [-104, -64, -22]) box("roof-rib", [350, y - 1, ROOF[1]], [434, y + 1, ROOF[1] + 2.5], "mid", { extra: screwsOn([[353, y], [431, y]], ROOF[1] + 2.5, { ring: 0.5, size: 0.35 }) });
  for (const [x, y] of [[326, -114], [432, -114], [432, 22]]) {
    box("lift-lug", [x - 2.5, y - 0.6, ROOF[1]], [x + 2.5, y + 0.6, ROOF[1] + 5], "lo", { extra: Ln(G.circleOf(G.frameAlong([x, y + 0.6, ROOF[1] + 3], [0, 1, 0]), 0, 1.1, P, 16), { tone: "lo" }) });
  }
  for (const z of [FT + 22, ROOF[0] - 22]) box("wall-rib", [X1, CR[1] + 2, z - 1], [X1 + 1.6, DOOR.y0 - 2, z + 1], "mid");
  const HB = [[X1, -100, ZP - 2], [X1 + 4, -84, ZP + 14]];
  box("heater-controller", HB[0], HB[1], "mid", { inner: Ln(k.sideSeam({ x: X1, y: -100, w: 4, d: 16, r: 0.4 }, ZP + 11, P, 2), { tone: "faint" }), extra: Dots([at([X1 + 4, -98.5, ZP + 12.5]), at([X1 + 4, -85.5, ZP - 0.5])], { size: 0.4 }) });
  [[-96, ROOF[0] - 14], [-88, FT + 12]].forEach(([y, z], i) => {
    const tc = boss(PIECE, [X1, y, z], [1, 0, 0], 1.1, 1.4, { name: name("thermocouple"), tone: "mid" });
    const lane = X1 + 3.2;
    cable(PIECE, [[lane, y, i ? HB[0][2] : HB[1][2]], [lane, y, z], [lane + 2.5, y, z], tc].slice(0, 2).concat([[tc[0] + 1.8, y, z], tc]), { name: name("thermocouple-lead"), bend: 1.2 });
  });

  ctx.shared.droplet = { from: G.pointOf(DGF, NOZZLE_Y, 0, 0).map((v) => +v.toFixed(2)), to: [plasma[0], CATCHER_Y, plasma[2]], plasma: [...plasma], speed_ms: 70, rate_hz: 50000 };
  void ENV; void band;
}
