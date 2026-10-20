// The fab floor the cell stands on, cut open along its near edge: raised-floor tiles on pedestals, the
// perforated concrete waffle slab under them, and the sub-fab below the scanner with its columns and floor.
// Every slab is a depth-sorted item so pipes and frames beneath or behind them are hidden where they should be.
// A 120 x 60 penetration in the tiles, on tile boundaries under the source vessel, lets the CO2 beam through.
import { k, G, A } from "../lib.mjs";

export const HOLE = { x: 320, y: -30, w: 120, d: 60 };   // centred on PORTS.beamEntry [380, 0]

export function build(L, ctx) {
  const { P, FLOOR, TILE, WAFFLE, SUBFAB, back } = ctx;
  const { S, Ln, Dots, at, put, record } = L;
  const ground = (shape) => record({ ...shape, ground: true });
  const nearY = FLOOR.y + FLOOR.d;

  back.push(`<path class="iso-halo" d="${k.haloOf(SUBFAB, SUBFAB.z - 30, 30, P)}"/>`);

  // sub-fab floor slab and its cable trench
  const TRENCH = { x: SUBFAB.x + 20, y: SUBFAB.y + SUBFAB.d - 70, w: SUBFAB.w - 40, d: 24, r: 2 };
  const trench = Ln(k.planOutline(TRENCH, SUBFAB.z, P, 3), { tone: "lo" }) + Ln(Array.from({ length: Math.floor(TRENCH.w / 40) - 1 }, (_, i) => k.lineOnTop([TRENCH.x + 40 * (i + 1), TRENCH.y], [TRENCH.x + 40 * (i + 1), TRENCH.y + TRENCH.d], SUBFAB.z, P)).join(""), { tone: "faint" });
  L.slab("stand", SUBFAB, SUBFAB.z - 30, 30, { tone: "lo", crease: "faint" }, { name: "stand.subfab-floor", steps: 4, bevel: 1.2, inner: Ln(k.sideSeam(SUBFAB, SUBFAB.z - 12, P, 4), { tone: "faint" }), extra: trench, bias: -2 });

  // building columns at the far corners of the sub-fab, from its floor to the waffle slab
  for (const [cx, cy] of [[SUBFAB.x + 24, SUBFAB.y + 24], [SUBFAB.x + SUBFAB.w - 24, SUBFAB.y + 24]]) {
    const plan = { x: cx - 18, y: cy - 18, w: 36, d: 36, r: 1 };
    const h = WAFFLE.bottom - SUBFAB.z;
    L.slab("stand", plan, SUBFAB.z, h, { tone: "mid" }, { name: "stand.column", steps: 2, bevel: 0.6, inner: Ln([0.25, 0.5, 0.75].map((f) => k.sideSeam(plan, SUBFAB.z + h * f, P, 2)).join(""), { tone: "faint" }) });
  }

  // waffle slab: the structural floor, with its vertical air holes cut through at the near edge
  const slabH = WAFFLE.top - WAFFLE.bottom;
  const holeRings = [];
  for (let x = FLOOR.x + 30; x <= FLOOR.x + FLOOR.w - 30; x += 60) holeRings.push(G.circleOf(G.frameAlong([x, nearY, (WAFFLE.top + WAFFLE.bottom) / 2], [0, 1, 0]), 0, 14, P, 28));
  L.slab("stand", FLOOR, WAFFLE.bottom, slabH, { tone: "lo" }, { name: "stand.waffle", steps: 4, bevel: 1.4, inner: Ln(holeRings.join(""), { tone: "lo" }), bias: -1 });

  // pedestals under the tile corners: the two near rows and the ring round the penetration (the rest hide under the tiles)
  const PED_Z0 = WAFFLE.top;
  const PED_Z1 = -6;
  const peds = [];
  for (let x = FLOOR.x + TILE; x < FLOOR.x + FLOOR.w; x += TILE) for (const y of [nearY - TILE, nearY - 2 * TILE]) peds.push([x, y]);
  for (let x = HOLE.x; x <= HOLE.x + HOLE.w; x += TILE) for (const y of [HOLE.y, HOLE.y + HOLE.d]) peds.push([x, y]);
  for (const [x, y] of peds) {
    const svg = S(k.cylinder(x, y, 5, PED_Z0, 1.2, P, 18), { tone: "lo" }) + S(k.cylinder(x, y, 1.8, PED_Z0 + 1.2, PED_Z1 - PED_Z0 - 3.2, P, 14), { tone: "mid" }) + S(k.cylinder(x, y, 2.6, PED_Z1 - 2, 1.4, P, 6), { tone: "mid" }) + S(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 0.6 }, PED_Z1 - 0.6, 0.6, P, 2), { tone: "lo" });
    put("stand", [x, y, (PED_Z0 + PED_Z1) / 2], svg, { name: L.nameFor("stand.pedestal"), shapes: [record(A.cylinder(x, y, 5, PED_Z0, PED_Z1 - PED_Z0, { name: "stand.pedestal" }))] });
  }

  // raised-floor tiles as four slabs round the penetration, seams edge to edge within each, perforated tiles in front
  const TILE_T = 4;
  const TRIM = 2.4;
  const CUT = { x: HOLE.x - TRIM, y: HOLE.y - TRIM, w: HOLE.w + 2 * TRIM, d: HOLE.d + 2 * TRIM };   // tiles stop at the trim
  const x0 = FLOOR.x, x1 = FLOOR.x + FLOOR.w, y0 = FLOOR.y, y1 = nearY;
  const parts = [
    { x: x0, y: y0, w: CUT.x - x0, d: FLOOR.d, r: 0 },
    { x: CUT.x + CUT.w, y: y0, w: x1 - CUT.x - CUT.w, d: FLOOR.d, r: 0 },
    { x: CUT.x, y: y0, w: CUT.w, d: CUT.y - y0, r: 0 },
    { x: CUT.x, y: CUT.y + CUT.d, w: CUT.w, d: y1 - CUT.y - CUT.d, r: 0 },
  ];
  const within = (p, x, y) => x >= p.x - 1e-6 && x <= p.x + p.w + 1e-6 && y >= p.y - 1e-6 && y <= p.y + p.d + 1e-6;
  parts.forEach((p, index) => {
    const seams = [];
    for (let x = FLOOR.x + TILE; x < x1; x += TILE) if (x > p.x + 0.5 && x < p.x + p.w - 0.5) seams.push(k.lineOnTop([x, p.y], [x, p.y + p.d], 0, P));
    for (let y = FLOOR.y + TILE; y < y1; y += TILE) if (y > p.y + 0.5 && y < p.y + p.d - 0.5) seams.push(k.lineOnTop([p.x, y], [p.x + p.w, y], 0, P));
    const edge = [];
    for (let x = FLOOR.x + TILE; x < x1; x += TILE) if (p.y + p.d === y1 && x > p.x + 0.5 && x < p.x + p.w - 0.5) edge.push(k.segment([x, y1, -TILE_T], [x, y1, 0], P));
    let dots = "";
    for (let x = -60; x < 480; x += TILE) if (within(p, x + 30, nearY - TILE / 2)) dots += Dots(k.dotGrid(x + 6, nearY - TILE + 6, 9, 9, 6, 0, P), { size: 0.4, tone: "lo" });
    L.slab("stand", p, -TILE_T, TILE_T, { tone: "mid" }, { name: "stand.tiles", steps: 1, bevel: index ? 0 : 0.8, inner: Ln(edge.join(""), { tone: "faint" }), extra: Ln(seams.join(""), { tone: "faint" }) + dots });
  });

  // aluminium edge trim: the full-depth frame of the penetration, flush with the tile top
  const trims = [
    { x: HOLE.x - TRIM, y: HOLE.y - TRIM, w: HOLE.w + 2 * TRIM, d: TRIM, r: 0 },
    { x: HOLE.x - TRIM, y: HOLE.y + HOLE.d, w: HOLE.w + 2 * TRIM, d: TRIM, r: 0 },
    { x: HOLE.x - TRIM, y: HOLE.y, w: TRIM, d: HOLE.d, r: 0 },
    { x: HOLE.x + HOLE.w, y: HOLE.y, w: TRIM, d: HOLE.d, r: 0 },
  ];
  for (const t of trims) L.slab("stand", t, -TILE_T, TILE_T, { tone: "lo", crease: "none" }, { name: "stand.trim", steps: 1, bevel: 0, extra: L.screwsOn([[t.x + t.w / 2, t.y + t.d / 2]], 0, { ring: 0.6, size: 0.35 }) });
}
