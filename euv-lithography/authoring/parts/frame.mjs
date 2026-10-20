// The scanner's steel base frame on leveling feet, the columns and upper deck beams the reticle stage hangs
// from, and the vacuum chamber skin cut away on the near (+y) side and along the top front edge: the back wall
// is a portal (end panels and a top band) so the pumps behind it show, the end walls and roof keep their back
// strips, and every cut face shows the skin's thickness.
// Sources: REFERENCES.md (base frame bolted to the floor carries the airmounts, Heertjes 2020;
// vacuum chamber 7,600 kg; scanner 64,380 kg); REFERENCES.md (base frame ~0.5-1 m tall, ESTIMATED).
// Geometry the frame must leave free for its neighbours' explode paths: the frame leaves first along -y, so
// nothing of it may stand at y > the interior envelopes inside their x/z ranges (near columns sit at the x ends).
import { k, G, A } from "../lib.mjs";

const PIECE = "frame";

const BACK_SKIN = 2;   // DERIVED: back skin 2 cm Al with the ribs, so the metro seats at y -158 stand clear of it
const SKIN = 3;        // DERIVED: 7.6 t over ~100 m2 of chamber skin is ~76 kg/m2; a 3 cm Al-alloy skin (~81 kg/m2) with ribs carries 10 t/m2 of atmosphere
const RIB = { t: 3, h: 4 };   // DERIVED: ribs at <= 100 cm pitch keep a 3 cm Al plate under ~25 MPa at 1 bar
const DECK_T = 8;      // DERIVED: 8 cm deck plate over girders at <= 110 cm spacing; the stage reaction forces go to the floor through it
const GIRDER = 24;     // DERIVED: 24 cm deep box girders, span/depth ~ 15 between legs, stiff enough for the stage reaction loads
const LEG = 14;        // DERIVED: 14 cm box legs, buckling-safe at ~0.6 m for ~6 t each (64 t over ~10 legs)
const COL = 12;        // DERIVED: 12 cm box columns carry the 0.3 t reticle stage plus deck and skin, well below buckling at 2.8 m

export function build(L, ctx) {
  const { P, MOUNTS, ENV } = ctx;
  const { at, Ln, Dots, slab, boxOf, turned, band, prism, cable, clampAt, boss, screwsOn, path3 } = L;
  const E = ENV.frame;
  const BZ = MOUNTS.baseTop.z;
  const UZ = MOUNTS.upperDeck.z;
  const TOP = E.z1;
  const X0 = E.x;
  const X1 = E.x + E.w;
  const Y0 = E.y;
  const Y1 = E.y + E.d;
  const DECK0 = BZ - DECK_T;
  const G0 = DECK0 - GIRDER;
  const BEAM = 16;                       // DERIVED: 16 cm deep upper deck beams, so beams + roof + ribs + lugs fit under TOP
  const ROOF0 = UZ + BEAM;               // roof skin sits on the beams and the walls
  const ROOF1 = ROOF0 + 6;               // DERIVED: 6 cm roof plate (skin plus doubler where the lugs and trays bolt down)
  const RIB1 = ROOF1 + 4;
  const SRC = ENV.source;
  const SRC_X = SRC.x - 4;               // the deck stops short of the source vessel, which stands on the floor through the opening
  const vert = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const seam = (plan, z, steps = 3) => k.sideSeam(plan, z, P, steps);
  const box = (name, p0, p1, tone, options = {}) => boxOf(PIECE, p0, p1, { tone }, { name: `${PIECE}.${name}`, steps: 2, ...options });
  const inXZ = (name, poly, y0, y1, tone = "mid") => prism(PIECE, G.frameOf([0, y0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), poly, 0, y1 - y0, { tone }, { name: `${PIECE}.${name}` });

  // ---- leveling feet: pad, stud, lock nut, leg base plate ----
  const foot = (x, y) => {
    const F = vert(x, y, 0);
    band(PIECE, F, 0, 2.5, 9, { tone: "lo" }, { name: `${PIECE}.foot-pad`, extra: Dots(G.dotsOf(F, 2.5, 7, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.45 }) });
    band(PIECE, F, 2.5, 8, 2.6, { tone: "mid" }, { name: `${PIECE}.foot-stud` });
    turned(PIECE, F, [[8, 4.6], [11, 4.6]], { tone: "mid" }, { name: `${PIECE}.foot-nut`, steps: 6 });
    const plate = { x: x - 10, y: y - 10, w: 20, d: 20, r: 1 };
    slab(PIECE, plate, 11, 3, { tone: "lo" }, { name: `${PIECE}.leg-plate`, steps: 2, extra: screwsOn(k.corners(plate, 3), 14, { ring: 1, size: 0.4 }) });
    return 14;
  };

  // ---- base frame: legs, box girders, deck plate (top exactly at MOUNTS.baseTop.z) ----
  const NEAR_Y = 145;
  const BACK_Y = -144;
  const nearXs = [X0 + 18, 52, 166, SRC_X - 16];
  const backXs = [...nearXs, 372, X1 - 18];
  const legAt = (x, y, row) => {
    const z = foot(x, y);
    const plan = { x: x - LEG / 2, y: y - LEG / 2, w: LEG, d: LEG, r: 0.6 };
    slab(PIECE, plan, z, G0 - z, { tone: "mid" }, { name: `${PIECE}.leg-${row}`, steps: 2, inner: Ln(seam(plan, z + 4, 2), { tone: "faint" }) });
  };
  for (const x of nearXs) legAt(x, NEAR_Y, "near");
  for (const x of backXs) legAt(x, BACK_Y, "back");

  const GN = { y0: 134, y1: 156 };       // near girder
  const GB = { y0: -158, y1: -136 };     // back girder
  const girderLines = (y, xs) => Ln(xs.map((x) => k.segment([x, y, G0], [x, y, DECK0], P)).join(""), { tone: "faint" });
  const stiffX = [-20, 20, 92, 110, 210, 240];
  box("girder-near", [X0 + 4, GN.y0, G0], [SRC_X, GN.y1, DECK0], "mid", { inner: girderLines(GN.y1, stiffX) + Ln(seam({ x: X0 + 4, y: GN.y0, w: SRC_X - X0 - 4, d: GN.y1 - GN.y0, r: 0.4 }, G0 + 2, 2) + seam({ x: X0 + 4, y: GN.y0, w: SRC_X - X0 - 4, d: GN.y1 - GN.y0, r: 0.4 }, DECK0 - 2, 2), { tone: "faint" }) });
  box("girder-back", [X0 + 4, GB.y0, G0], [X1 - 8, GB.y1, DECK0], "lo");
  box("girder-end", [X0 + 4, GB.y1, G0], [X0 + 20, GN.y0, DECK0], "lo");
  box("girder-cross", [SRC_X - 16, GB.y1, G0], [SRC_X, GN.y0, DECK0], "lo");
  box("girder-mid", [109, GB.y1, G0], [123, GN.y0, DECK0], "lo");

  // knee gussets under the girders and diagonal braces between the legs, both in the planes of the leg rows
  const braceRow = (xs, y0, row, flip) => {
    const y1 = y0 + 3;
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i] + LEG / 2;
      const xb = xs[i + 1] - LEG / 2;
      if (xb - xa < 30) continue;
      const lo = 20;
      const hi = G0 - 13;
      const up = (i + flip) % 2 === 0;
      const [za, zb] = up ? [lo, hi - 7] : [hi - 7, lo];
      inXZ(`brace-${row}`, [[xa, za], [xb, zb], [xb, zb + 7], [xa, za + 7]], y0, y1, "lo");
      inXZ(`gusset-${row}`, [[xa, G0], [xa, G0 - 12], [xa + 12, G0]], y0, y1, "mid");
      inXZ(`gusset-${row}`, [[xb, G0], [xb - 12, G0], [xb, G0 - 12]], y0, y1, "mid");
    }
  };
  braceRow(nearXs, NEAR_Y - 7, "near", 0);
  braceRow(backXs, BACK_Y + 4, "back", 1);

  const DECK = { x: X0 + 4, y: GB.y0, w: SRC_X - X0 - 4, d: GN.y1 - GB.y0, r: 1.2 };
  const deckScrews = [];
  for (let x = DECK.x + 8; x < DECK.x + DECK.w - 4; x += 24) deckScrews.push([x, GN.y1 - 4]);
  slab(PIECE, DECK, DECK0, DECK_T, { tone: "mid" }, { name: `${PIECE}.deck`, steps: 3, bevel: 0.8, inner: Ln(seam(DECK, DECK0 + 3), { tone: "faint" }), extra: screwsOn(deckScrews, BZ, { ring: 1, size: 0.42 }) });
  // the back rail runs on past the deck behind the source vessel, carrying the back columns at the +x end
  const RAIL = { x: SRC_X, y: GB.y0, w: X1 - 8 - SRC_X, d: 18, r: 0.8 };
  slab(PIECE, RAIL, DECK0, DECK_T, { tone: "mid" }, { name: `${PIECE}.deck-rail`, steps: 2, bevel: 0.6 });

  // label plate on the near girder face; its rule lines stand for printed text
  {
    const x0 = 134;
    const x1 = 170;
    const z0 = G0 + 5;
    const z1 = DECK0 - 5;
    const y = GN.y1 + 0.6;
    const rules = [[x0 + 3, x1 - 3, z1 - 4], [x0 + 3, x1 - 9, z1 - 7.5], [x0 + 3, x1 - 15, z1 - 11]].map(([a, b, z]) => k.segment([a, y, z], [b, y, z], P)).join("");
    box("label", [x0, GN.y1, z0], [x1, y, z1], "hi", { extra: Ln(path3([[x0 + 1.4, y, z0 + 1.4], [x1 - 1.4, y, z0 + 1.4], [x1 - 1.4, y, z1 - 1.4], [x0 + 1.4, y, z1 - 1.4]], true), { tone: "faint" }) + Ln(rules, { tone: "lo", free: true }) + Dots([at([x0 + 2.4, y, z0 + 2.6]), at([x1 - 2.4, y, z0 + 2.6])], { size: 0.38 }) });
  }

  // grounding straps: braided copper from a lug on a near leg to a ground bar on the floor
  for (const x of [nearXs[1], nearXs[2]]) {
    const z = 26;
    const tip = boss(PIECE, [x + LEG / 2, NEAR_Y, z], [1, 0, 0], 1.6, 1.6, { name: `${PIECE}.ground-lug` });
    const bar = { x: x + 15, y: NEAR_Y - 5, w: 10, d: 10, r: 0.6 };
    slab(PIECE, bar, 0, 3, { tone: "lo" }, { name: `${PIECE}.ground-bar`, steps: 2, extra: screwsOn([[bar.x + 2.4, bar.y + 5], [bar.x + 7.6, bar.y + 5]], 3, { ring: 0.7, size: 0.35 }) });
    cable(PIECE, [tip, [x + 20, NEAR_Y, z], [x + 20, NEAR_Y, 3]], { r: 0.8, bend: 5, name: `${PIECE}.ground-strap`, tone: "lo", rings: { pitch: 1.1, twist: 0.6, cross: true, tone: "faint" } });
  }

  // ---- columns from the deck (and from the floor at the +x near corner) to the upper deck beams ----
  const column = (name, plan, z0) => {
    slab(PIECE, plan, z0, UZ - z0, { tone: "mid" }, { name: `${PIECE}.${name}`, steps: 2, inner: Ln(seam(plan, z0 + 6, 2) + seam(plan, UZ - 6, 2), { tone: "faint" }) });
  };
  const colBase = (plan, z) => {
    const p = { x: plan.x - 1.5, y: plan.y, w: plan.w + 3, d: plan.d, r: 0.5 };
    slab(PIECE, p, z, 3, { tone: "lo" }, { name: `${PIECE}.column-plate`, steps: 2, extra: screwsOn(k.corners(p, 1.6), z + 3, { ring: 0.7, size: 0.38 }) });
    return z + 3;
  };
  const NC = 138;                       // near columns: y 138..150, at the x ends only, clear of every interior envelope
  const BC = -152;                      // back columns: y -152..-140, behind the stage compartment wall
  const cNearL = { x: X0 - 14, y: NC, w: 10, d: 150 - NC, r: 0.5 };   // just outside the stage plate (x >= -60), out of the stages' forward exit
  column("column-near", cNearL, foot(X0 - 9, 144));   // off the deck edge now: on its own floor foot
  // the +x near column stands on the floor under the upper deck's +x end, clear of the source vessel's forward exit
  const UDX1 = MOUNTS.upperDeck.plan.x + MOUNTS.upperDeck.plan.w;
  const cNearR = { x: UDX1 - 12, y: NC, w: 10, d: 150 - NC, r: 0.5 };
  // no +x near column: any post near the +x end stands in the illuminator's or the source's forward exit. The near
  // upper beam is carried by the cross beams, which tie it to the back columns at x 141 and 448 (DERIVED: moment frame)
  void cNearR;
  const backCols = [{ x: X0 + 8, y: BC, w: COL, d: COL, r: 0.5 }, { x: 141, y: BC, w: COL + 2, d: COL, r: 0.5 }, { x: X1 - 22, y: BC, w: COL + 2, d: COL, r: 0.5 }];
  for (const plan of backCols) column("column-back", plan, colBase(plan, BZ));

  // ---- metrology frame seats: four pillars from the deck to MOUNTS.metroSeats, the POB airmounts stand on their pads ----
  {
    const MS = MOUNTS.metroSeats;
    for (const [cx, cy] of MS.at) {
      const pad = { x: cx - MS.size / 2, y: cy - MS.size / 2, w: MS.size, d: MS.size, r: 0.8 };
      const post = k.insetPlan(pad, 2.5);
      const PAD_T = 4;   // DERIVED: 4 cm seat plate spreads the airmount's ~0.5 t onto the 11 cm pillar
      // the near (+y) pillars belong to the metrology-frame assembly: the frame leaves backward and would drag them
      // through the stage plate, while the POB assembly leaves forward, away from it
      const OWN = cy > 0 ? "pob" : PIECE;
      slab(OWN, post, BZ, MS.z - PAD_T - BZ, { tone: "mid" }, { name: `${OWN}.seat-pillar`, steps: 2, inner: Ln(seam(post, BZ + 4, 2) + seam(post, MS.z - PAD_T - 4, 2), { tone: "faint" }) });
      const F = vert(cx, cy, MS.z);
      slab(OWN, pad, MS.z - PAD_T, PAD_T, { tone: "hi" }, { name: `${OWN}.seat-pad`, steps: 2, bevel: 0.5, extra: Ln(k.ring(cx, cy, 5.4, MS.z, P, 28), { tone: "faint" }) + Dots(G.dotsOf(F, 0, 5.4, 6, P, { all: true }), { size: 0.4 }) });
    }
  }

  // ---- upper deck: longitudinal beams on the columns, cross beams between them, underside at MOUNTS.upperDeck.z ----
  const flangeLines = (plan) => Ln(seam(plan, UZ + 2, 2) + seam(plan, UZ + BEAM - 2, 2), { tone: "faint" });
  const BB = { x: X0 + 8, y: BC, w: X1 - 8 - X0 - 8, d: COL, r: 0.4 };
  slab(PIECE, BB, UZ, BEAM, { tone: "mid" }, { name: `${PIECE}.beam-back`, steps: 2, inner: flangeLines(BB) });
  const NB = { x: X0 + 4, y: NC, w: UDX1 - X0 - 4, d: 150 - NC, r: 0.4 };
  const nbScrews = [];
  for (let x = NB.x + 6; x < NB.x + NB.w - 4; x += 30) nbScrews.push([x, NB.y + NB.d / 2]);
  slab(PIECE, NB, UZ, BEAM, { tone: "mid" }, { name: `${PIECE}.beam-near`, steps: 2, bevel: 0.5, inner: flangeLines(NB), extra: screwsOn(nbScrews, UZ + BEAM, { ring: 0.8, size: 0.38 }) });
  const UD = MOUNTS.upperDeck.plan;
  const crossXs = [UD.x, 66, 142, 220, UD.x + UD.w - 12];   // DERIVED: <= 80 cm between cross beams, so the reticle stage's hangers always land on one
  // DERIVED: dedicated support beams where the reticle module hangs its stage (hangers at x 92 and 192, flanges r 5)
  // and its handler bed (rods at x 24 and 84.6): the deck carries a beam under every hanger it holds
  const reticleBeams = [[18, 12], [78, 20], [186, 12]];
  for (const [x, w] of [...crossXs.map((x) => [x, 12]), ...reticleBeams]) {
    const plan = { x, y: BC + COL, w, d: NC - BC - COL, r: 0.3 };
    slab(PIECE, plan, UZ, BEAM, { tone: "lo" }, { name: `${PIECE}.beam-cross`, steps: 2, inner: Ln(seam(plan, UZ + 2, 2), { tone: "faint" }), extra: screwsOn([[x + w / 2, NC - 4], [x + w / 2, BC + COL + 4]], UZ + BEAM, { ring: 0.8, size: 0.38 }) });
  }

  // ---- vacuum chamber skin ----
  const WY0 = Y0;                       // back wall outer face
  const WY1 = Y0 + BACK_SKIN;                // back wall inner face
  const CH = 6;                         // floor channel the skin stands on
  // floor channels under the back wall and under both end walls
  box("channel", [X0, WY0 - 2, 0], [X1, WY1 + 1, CH], "lo");
  const END_L = { y1: -40 };            // -x end wall kept back of y -40, so the load locks outside read
  const END_R = { y1: -60 };            // +x end wall kept back of y -60, so the source vessel reads
  box("channel", [X0, WY1 + 1, 0], [X0 + SKIN + 3, END_L.y1, CH], "lo");
  box("channel", [X1 - SKIN - 5, WY1 + 1, 0], [X1 - 2, END_R.y1, CH], "lo");

  // back wall: a portal with the window cut out between its end panels and below its top band
  const WIN = { x0: X0 + 40, x1: X1 - 30, z1: 300 };   // DERIVED: window top above the utility envelope (260) so the pumps behind show
  const ribsY = (x0, x1, zs) => zs.forEach((z) => box("rib", [x0, WY1, z - RIB.t / 2], [x1, WY1 + RIB.h, z + RIB.t / 2], "lo"));
  box("wall-back", [X0, WY0, CH], [WIN.x0, WY1, ROOF0], "mid");
  box("wall-back", [WIN.x1, WY0, CH], [X1 - SKIN - 4, WY1, ROOF0], "mid");
  box("wall-back", [WIN.x0, WY0, WIN.z1], [WIN.x1, WY1, ROOF0], "mid", { inner: Ln(k.segment([WIN.x0, WY1, (WIN.z1 + ROOF0) / 2], [WIN.x1, WY1, (WIN.z1 + ROOF0) / 2], P), { tone: "faint" }) });
  ribsY(X0 + SKIN, WIN.x0, [200, 300]);
  ribsY(WIN.x1, X1 - SKIN - 4, [100, 200]);
  for (let x = WIN.x0 + 40; x < WIN.x1 - 20; x += 48) {
    if (x > 136 && x < 160) continue;
    box("rib", [x - RIB.t / 2, WY1, WIN.z1], [x + RIB.t / 2, WY1 + RIB.h, ROOF0], "lo");
  }

  // round service hatch with its bolt circle on the +x back panel
  {
    const c = [(WIN.x1 + X1 - SKIN - 4) / 2, WY1, 150];
    const F = G.frameAlong(c, [0, 1, 0]);
    turned(PIECE, F, [[0, 10], [2, 10], [2, 7.8], [3.4, 7.8]], { tone: "hi" }, { name: `${PIECE}.hatch-round`, extra: Dots(G.dotsOf(F, 2, 8.9, 12, P, { all: true }), { size: 0.42 }) + Ln(G.circleOf(F, 3.4, 5, P, 32), { tone: "faint" }) });
    box("hatch-handle", [c[0] - 4, WY1 + 3.4, c[2] - 1], [c[0] + 4, WY1 + 4.6, c[2] + 1], "mid");
  }
  // viewport on the -x back panel
  const viewport = (c, axis, name) => {
    const F = G.frameAlong(c, axis);
    turned(PIECE, F, [[0, 11], [2.2, 11], [2.2, 8.4], [3.2, 8.4]], { tone: "mid" }, { name: `${PIECE}.${name}`, extra: Dots(G.dotsOf(F, 2.2, 9.7, 10, P, { all: true }), { size: 0.4 }) });
    band(PIECE, F, 3.2, 3.6, 6.4, { tone: "hi" }, { name: `${PIECE}.${name}-glass`, extra: Ln(G.circleOf(F, 3.6, 4.6, P, 28), { tone: "faint" }) });
  };
  viewport([(X0 + SKIN + WIN.x0) / 2, WY1, 250], [0, 1, 0], "viewport");
  viewport([(X0 + SKIN + WIN.x0) / 2, WY1, 350], [0, 1, 0], "viewport");

  // -x end wall: its inner face looks at the viewer; a rectangular service hatch and a viewport
  const LX1 = X0 + SKIN;
  box("wall-end", [X0, WY1, CH], [LX1, END_L.y1, ROOF0], "mid");
  [100, 300].forEach((z) => box("rib", [LX1, WY1 + RIB.h, z - RIB.t / 2], [LX1 + RIB.h, END_L.y1, z + RIB.t / 2], "lo"));
  {
    const y0 = -132;
    const y1 = -64;
    const z0 = 140;
    const z1 = 236;
    const x = LX1 + 2;
    const bolts = [];
    for (let y = y0 + 3; y <= y1 - 3 + 1e-6; y += (y1 - y0 - 6) / 8) bolts.push(at([x, y, z0 + 3]), at([x, y, z1 - 3]));
    for (let z = z0 + 3 + (z1 - z0 - 6) / 10; z < z1 - 3 - 1e-6; z += (z1 - z0 - 6) / 10) bolts.push(at([x, y0 + 3, z]), at([x, y1 - 3, z]));
    box("hatch", [LX1, y0, z0], [x, y1, z1], "hi", { extra: Ln(path3([[x, y0 + 6, z0 + 6], [x, y1 - 6, z0 + 6], [x, y1 - 6, z1 - 6], [x, y0 + 6, z1 - 6]], true), { tone: "faint" }) + Dots(bolts, { size: 0.4 }) });
    for (const z of [z0 + 24, z1 - 24]) box("hatch-handle", [x, (y0 + y1) / 2 - 7, z - 1], [x + 1.4, (y0 + y1) / 2 + 7, z + 1], "mid");
  }
  viewport([LX1, -96, 345], [1, 0, 0], "viewport");

  // +x end wall: seen from outside, so its ribs and viewport are on the outer face
  const RX0 = X1 - SKIN - 4;
  const RX1 = RX0 + SKIN;
  box("wall-end", [RX0, WY0, CH], [RX1, END_R.y1, ROOF0], "mid");
  [100, 200, 300].forEach((z) => box("rib", [RX1, WY0, z - RIB.t / 2], [RX1 + RIB.h, END_R.y1, z + RIB.t / 2], "lo"));
  viewport([RX1, -108, 250], [1, 0, 0], "viewport");

  // roof strip over the back, on the walls and the back beam; ribs across it, lifting lugs and cable trays on top
  const ROOF = { x: X0, y: Y0, w: X1 - X0, d: 60, r: 0.6 };
  slab(PIECE, ROOF, ROOF0, ROOF1 - ROOF0, { tone: "mid" }, { name: `${PIECE}.roof`, steps: 2, bevel: 0.5 });
  const ribXs = [];
  for (let x = X0 + 45; x < X1 - 40; x += 30) ribXs.push(x);   // DERIVED: 30 cm rib pitch on the 6 cm roof plate, one under every tray section
  for (const x of ribXs) box("roof-rib", [x - RIB.t / 2, ROOF.y, ROOF1], [x + RIB.t / 2, ROOF.y + ROOF.d, RIB1], "lo");
  for (const x of [X0 + 30, X1 - 60]) {
    const xa = x - 6;
    const xb = x + 6;
    const yl = ROOF.y + 44;
    const base = ROOF1 + 0.8;
    const lug = [[xa, base], [xb, base], [xb, TOP - 3], [x + 3, TOP], [x - 3, TOP], [xa, TOP - 3]];
    const hole = G.frameAlong([x, yl + 2, TOP - 3.2], [0, 1, 0]);
    box("lug-plate", [xa - 2, yl - 2, ROOF1], [xb + 2, yl + 4, base], "lo", { extra: screwsOn([[xa - 0.6, yl + 1], [xb + 0.6, yl + 1]], base, { ring: 0.5, size: 0.32 }) });
    prism(PIECE, G.frameOf([0, yl, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), lug, 0, 2, { tone: "hi" }, { name: `${PIECE}.lug`, extra: Ln(G.circleOf(hole, 0, 1.4, P, 20), { tone: "lo" }) });
  }

  // cable tray along the top in 28 cm sections, one on each roof rib, with two feeders between junction boxes
  const TRAY = { y0: ROOF.y + 6, y1: ROOF.y + 28 };
  for (const x of ribXs) box("tray", [x - 14, TRAY.y0, RIB1], [x + 14, TRAY.y1, RIB1 + 0.8], "mid", { extra: screwsOn([[x, TRAY.y0 + 1.6], [x, TRAY.y1 - 1.6]], RIB1 + 0.8, { ring: 0.5, size: 0.3 }) });
  const JB = [{ x0: X0 + 4, x1: ribXs[0] - 18 }, { x0: ribXs[ribXs.length - 1] + 18, x1: X1 - 4 }];
  for (const { x0, x1 } of JB) box("junction-box", [x0, TRAY.y0 - 2, ROOF1], [x1, TRAY.y1 + 2, TOP], "hi", { extra: screwsOn([[(x0 + x1) / 2, TRAY.y0 + 1], [(x0 + x1) / 2, TRAY.y1 - 1]], TOP, { ring: 0.6, size: 0.35 }) });
  const CR = 1.4;
  const cz = RIB1 + 0.8 + CR;
  const clampXs = ribXs.filter((_, i) => i % 4 === 2);
  for (const [i, y] of [TRAY.y0 + 5, TRAY.y1 - 5].entries()) {
    const bundle = `${PIECE}.feeder-${i}`;
    const clamps = clampXs.map((x) => clampAt(PIECE, [x + (i ? 6 : -6), y, cz], [1, 0, 0], CR, { name: `${PIECE}.tray-clamp`, bundle }));
    cable(PIECE, [[JB[0].x1, y, cz], [JB[1].x0, y, cz]], { name: `${PIECE}.feeder`, clamps, bundle, r: 0.62, touch: [`${PIECE}.tray-clamp*`] });
  }
}
