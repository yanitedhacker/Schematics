// Shared drawing helpers for the litho cell. Every helper puts its item into one recorder and records the
// true shape it draws, so A.settle and the audit see everything (anatomy craft.md, section 8).
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { tubePieces, tubeSvg, crossingsOf } from "./kit/tube.mjs";
import * as A from "./kit/audit.mjs";

export { k, G, A, tubePieces, tubeSvg, crossingsOf };

export const FADE = [0.04, 0.42];
export const RIB_FADE = [0.1, 0.55];
export const CLAMP_HALF = 0.9;

export function makeLib(P, PIECES, { order = [], spring = {} } = {}) {
  const V = G.viewOf(P);
  const KS = G.scaleOf(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (points, style) => k.dotsSvg(points, style);
  const Faded = (list, style) => k.fadedSvg(list, style);
  const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
  const R = A.recorder(P, { order, spring });
  const { nameFor } = R;
  const record = R.solid;
  const CABLES = [];
  const PIPES = [];

  // items drawn inside live(id, fn) carry data-live=id: the page moves them as one sub-assembly (a chuck, the reticle carriage)
  let LIVE = null;
  const live = (id, fn) => { const prev = LIVE; LIVE = id; try { return fn(); } finally { LIVE = prev; } };

  const moveOf = (piece) => (PIECES[piece] && PIECES[piece].move) || [0, 0, 0];
  const rideOf = (piece, move) => (move ? Object.keys(PIECES).find((id) => PIECES[id].move === move) ?? piece : piece);

  function put(piece, ref, svg, { bias = 0, move, ride, shapes = [], name, route, chunk } = {}) {
    if (!PIECES[piece]) throw new Error(`unknown piece ${piece}`);
    return R.put({ piece, ride: ride ?? rideOf(piece, move), at: ref, bias, svg, move: move ?? moveOf(piece), shapes, name: name ?? nameFor(`${piece}.item`), route, chunk, pos: ref, ...(LIVE ? { live: LIVE } : {}) });
  }

  function tubeItems(piece, route, r, { name, tone = "hi", bias = 0, move, maxLength, spacing, closed = false, owner, touch, bundle, limp = false, breaks = [], gaps = [], caps = true, ends = [true, true], rims, free = [false, false], rings } = {}) {
    const id = nameFor(name ?? `${piece}.tube`);
    R.route(id, route, r, { owner: owner ?? id, touch, bundle, limp, gaps, closed, ends, rims, free, piece, move: move ?? moveOf(piece), ride: rideOf(piece, move) });
    tubePieces(route, r, P, { maxLength, spacing, closed, breaks, gaps, caps, ...(rings ? { rings } : {}) }).forEach((part, index) =>
      put(piece, part.mid, tubeSvg(part, { tone }), { bias, move, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
    );
    return id;
  }

  // a turned part on frame F from an [s, r(, smooth)] profile
  function turned(piece, F, profile, style = {}, { extra = "", inner = "", bias = 0, move, rims, bevel = 0, steps, name, owner, smooth = profile.some((point) => point[2]) } = {}) {
    const paths = G.solidOf(profile, F, P, { bevel, smooth: smooth === true ? { rows: Math.max(...profile.map(([, r]) => r)) < 20 ? 3 : 5 } : smooth, ...(rims ? { rims } : {}), ...(steps ? { steps } : {}) });
    const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
    const id = nameFor(name ?? `${piece}.turned`);
    const shape = record(A.solid(F, profile, { name: id, owner, curve: smooth && !smooth.slope ? profile : undefined, radius: smooth && smooth.radius ? smooth.radius : undefined }));
    put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, move, name: id, shapes: [shape] });
    return shape;
  }
  const band = (piece, F, s0, s1, r, style = {}, options = {}) => turned(piece, F, [[s0, r], [s1, r]], style, options);

  function flangeAt(piece, centre, axis, r, thick, { bolts = 8, tone = "hi", move, bias = 0, boltR, name, owner } = {}) {
    const F = G.frameAlong(centre, axis);
    const id = nameFor(name ?? `${piece}.flange`);
    const paths = G.disc(-thick / 2, thick / 2, r, F, P);
    const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
    const face = Math.abs(G.dot3(F.a, V)) > 0.12 && bolts ? Dots(G.dotsOf(F, towards, boltR ?? r * 0.74, bolts, P, { all: true }), { size: 0.42, tone: "mid" }) : "";
    put(piece, centre, S(paths, { tone }) + face, { bias, move, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
  }

  // a pipe through control points: filleted, flanged at both ends, gapped under every collar
  function pipe(piece, control, r, { bend = 2.6, tone = "hi", flanges = [true, true], flangeR = 1.55, coupling = false, bands = [], bellows = null, valve = null, move, bias = 0, maxLength = 26, spacing, name, touch, breaks = [], gaps: extra = [], free, rings } = {}) {
    const flangeRs = [flangeR].flat().length > 1 ? [flangeR].flat() : [flangeR, flangeR].flat();
    if (coupling) flanges = [flanges[0], false];
    const line = G.fillet(control, Math.max(r * bend, 3), r > 3 ? 24 : 12, { P, tube: r });
    const total = G.pathLength(line);
    const collars = [];
    [[0, -1], [total, 1]].forEach(([along, sign], index) => {
      if (!flanges[index]) return;
      const thick = Math.max(0.9, r * 0.55);
      const tangent = G.tangentAlong(line, along);
      collars.push({ kind: "flange", centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * flangeRs[index], thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
    });
    if (coupling) {
      const thick = Math.max(1.6, r * 1.4);
      collars.push({ kind: "coupling", centre: G.pointAlong(line, total - thick / 2), tangent: G.tangentAlong(line, total), radius: r * 1.5, thick, gap: [total - thick, total] });
    }
    const ringAt = (along, radius, thick, kind) => collars.push({ kind, centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius, thick, gap: [along - thick / 2, along + thick / 2] });
    for (const share of bands) ringAt(total * share, r * 1.18, Math.max(0.8, r * 0.7), "band");
    if (bellows) {
      const [from, to, count] = bellows;
      for (let index = 0; index < count; index++) ringAt(total * (from + ((to - from) * index) / (count - 1)), r * 1.26, Math.max(0.6, r * 0.3), "bellows");
    }
    const gaps = [...collars.map(({ gap }) => gap), ...extra];
    if (valve) {
      const along = valve[0] > 1 ? valve[0] : total * valve[0];
      gaps.push([along - valve[1] * 2.4, along + valve[1] * 2.4]);
    }
    const owner = tubeItems(piece, line, r, { name: name ?? `${piece}.pipe`, tone, bias, move, maxLength, spacing: spacing ?? Math.max(0.8, Math.min(2.4, r * 0.18)), touch, gaps, breaks, free, rings, rims: flanges.map((flanged, index) => (flanged ? r * flangeRs[index] : index && coupling ? r * 1.5 : r)) });
    for (const { kind, centre, tangent, radius, thick } of collars)
      flangeAt(piece, centre, tangent, radius, thick, { bolts: kind === "flange" && r > 3 ? 8 : 0, tone: kind === "flange" || kind === "coupling" ? tone : "mid", move, bias, name: `${owner}.${kind}`, owner });
    line.owner = owner;
    PIPES.push({ piece, name: owner, route: line, r });
    return line;
  }

  // an axis-aligned rounded box on the floor plan, recorded as its slab
  function slab(piece, plan, z, h, style = {}, { extra = "", inner = "", bias = 0, move, bevel = 0.5, steps = 3, name, owner } = {}) {
    const centre = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
    const id = nameFor(name ?? `${piece}.slab`);
    put(piece, centre, S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style, inner }) + extra, { bias, move, name: id, shapes: [record(A.slab(plan, z, h, { name: id, owner }, steps))] });
    return { plan, z, h, top: z + h };
  }
  const boxOf = (piece, [x0, y0, z0], [x1, y1, z1], style = {}, options = {}) => slab(piece, { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: options.r ?? 0.4 }, z0, z1 - z0, style, options);

  // a prism of a convex polygon in frame F's (u, v) plane, extruded along F.a from s0 to s1
  function prism(piece, F, poly, s0, s1, style = {}, { extra = "", inner = "", bias = 0, move, name, owner, ref } = {}) {
    const id = nameFor(name ?? `${piece}.prism`);
    const cu = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const cv = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const centre = G.add3(G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.mul3(F.u, cu)), G.mul3(F.v, cv));
    put(piece, ref ?? centre, S(G.prismOf(F, poly, s0, s1, P), { tone: "mid", ...style, inner }) + extra, { bias, move, name: id, shapes: [record(A.prism(F, poly, s0, s1, { name: id, owner }))] });
    return centre;
  }

  function ballAt(piece, centre, r, { move, tone = "mid", bias = 0, name, owner } = {}) {
    const id = nameFor(name ?? `${piece}.ball`);
    put(piece, centre, S(G.sphereOf(centre, r, P, { steps: G.stepsFor(r, 32) }), { tone }), { move, bias, name: id, shapes: [record(A.ball(centre, r, { name: id, owner }))] });
  }

  // a ball fitting on a face so a line can turn inside it; returns where the line leaves the ball toward `toward`
  function elbow(piece, face, normal, faceR, toward, ball, rim, { name, owner, move } = {}) {
    const centre = G.add3(face, G.mul3(normal, Math.sqrt(ball ** 2 - faceR ** 2)));
    ballAt(piece, centre, ball, { tone: "hi", name, owner, move });
    const axis = G.unit3(G.sub3(toward, centre));
    return G.add3(centre, G.mul3(axis, Math.sqrt(ball ** 2 - rim ** 2)));
  }

  // a short boss standing on a flat face along `outward`; returns the point on its outer face
  function boss(piece, centre, outward, r, length, { move, tone = "hi", bias = 0.1, name, host, ring = true, owner } = {}) {
    if (host) return padOn(piece, host, centre, outward, r, length, { move, tone, bias, name: name ?? `${piece}.boss`, ring, owner });
    const F = G.frameAlong(centre, outward);
    const id = nameFor(name ?? `${piece}.boss`);
    put(piece, G.add3(centre, G.mul3(F.a, length / 2)), S(G.disc(0, length, r, F, P), { tone }) + (ring && G.dot3(F.a, V) > 0.15 ? Ln(G.circleOf(F, length, r * 0.55, P, 16), { tone: "faint" }) : ""), { bias, move, name: id, shapes: [record(A.disc(F, 0, length, r, { name: id, owner }))] });
    return G.add3(centre, G.mul3(F.a, length));
  }

  // a saddle pad on a curved host shape (or list of shapes); returns the point on its flat face
  function padOn(piece, host, point, outward, a, h, { move, name, tone = "hi", bias = 0.1, owner, ring = false } = {}) {
    const hosts = [host].flat();
    const inside = (p) => hosts.some((shape) => A.sdf(shape, p) < 0);
    const axis = G.unit3(outward);
    const F = G.frameAlong(point, axis);
    const start = (angle) => {
      let lo = -2.5 * a;
      let hi = h;
      if (!inside(G.pointOf(F, lo, a, angle))) return 0;
      for (let step = 0; step < 40; step++) {
        const mid = (lo + hi) / 2;
        if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
        else hi = mid;
      }
      return hi;
    };
    const low = Math.min(...Array.from({ length: 48 }, (_, index) => start((index / 48) * Math.PI * 2)));
    const id = nameFor(name ?? `${piece}.pad`);
    const face = ring && G.dot3(axis, V) > 0.15 ? Ln(G.circleOf(F, h, a * 0.55, P, 16), { tone: "faint" }) : "";
    put(piece, G.add3(point, G.mul3(axis, h / 2)), S(G.saddleOf(F, a, start, h, P), { tone }) + face, { bias, move, name: id, shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: hosts }))] });
    return G.add3(point, G.mul3(axis, h));
  }

  // an inline valve on a straight leg of `line`; returns its actuator port
  function valveOn(piece, line, share, r, { move, tone = "hi", name, side = [0, 0, 1] } = {}) {
    const total = G.pathLength(line);
    const along = share > 1 ? share : total * share;
    const centre = G.pointAlong(line, along);
    const tangent = G.tangentAlong(line, along);
    const F = G.frameAlong(centre, tangent);
    const body = r * 1.85;
    const id = nameFor(name ?? `${line.owner}.valve`);
    const owner = line.owner;
    const crown = body * 1.08;
    const bulge = (x) => r * 1.45 + (crown - r * 1.45) * Math.sqrt(Math.max(0, 1 - (x / (r * 1.6)) ** 2));
    const bulgeSlope = (x) => {
      if (Math.abs(x) >= r * 1.6 - 1e-9) return 0;
      const t = Math.max(-0.995, Math.min(0.995, x / (r * 1.6)));
      return (-(crown - r * 1.45) * t) / (r * 1.6 * Math.sqrt(1 - t * t));
    };
    const meridian = [[-r * 2.4, 0], [-r * 2.4, r * 1.45], ...Array.from({ length: 17 }, (_, index) => {
      const x = r * 1.6 * Math.sin(((index - 8) / 8) * (Math.PI / 2));
      return [x, bulge(x), index && index < 16 ? 1 : 0];
    }), [r * 2.4, r * 1.45], [r * 2.4, 0]];
    put(piece, centre, S(G.lathe(meridian, F, P, { steps: 36, smooth: { slope: bulgeSlope, rows: 3 } }), { tone }) + Dots([...G.dotsOf(F, -r * 2.4, r * 1.2, 8, P, { all: true }), ...G.dotsOf(F, r * 2.4, r * 1.2, 8, P, { all: true })].filter((_, index) => index % 2 === 0), { size: 0.4, tone: "mid" }), { move, name: id, shapes: [record(A.body(F, meridian, { name: id, owner }))] });
    const up = G.unit3(side);
    const NF = G.frameAlong(centre, up);
    const s0 = body * 1.08 - 0.25;
    const s1 = body * 1.08 + body * 0.45;
    put(piece, G.add3(centre, G.mul3(up, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 0.5, NF, P), { tone }), { move, bias: 0.2, name: `${id}.neck`, shapes: [record(A.disc(NF, s0, s1, r * 0.5, { name: `${id}.neck`, owner }))] });
    if (up[2] > 0.99) {
      const top = G.add3(centre, [0, 0, s1]);
      const plan = { x: top[0] - r * 1.5, y: top[1] - r * 1.5, w: r * 3, d: r * 3, r: 0.8 };
      const lid = top[2] + r * 2.2;
      slab(piece, plan, top[2], r * 2.2, { tone }, { move, bias: 0.3, name: `${id}.actuator`, owner, extra: Ln(k.planOutline(k.insetPlan(plan, 0.8), lid, P, 2), { tone: "faint" }) + Dots([at([plan.x + 1.2, plan.y + 1.2, lid]), at([plan.x + plan.w - 1.2, plan.y + plan.d - 1.2, lid])], { size: 0.4 }) });
      const port = [top[0], top[1], lid];
      return { port, approach: G.add3(port, [0, 0, 5]), lid };
    }
    const can = [[s1, 0], [s1, r * 1.5], [s1 + r * 2.2, r * 1.5], [s1 + r * 2.2, 0]];
    const end = s1 + r * 2.2;
    put(piece, G.add3(centre, G.mul3(up, (s1 + end) / 2)), S(G.lathe(can, NF, P, { steps: 32, bevel: 0.6 }), { tone }) + Ln(G.circleOf(NF, end, r * 1.1, P, 24), { tone: "faint" }) + Dots(G.dotsOf(NF, end, r * 1.25, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.4 }), { move, bias: 0.3, name: `${id}.actuator`, shapes: [record(A.body(NF, can, { name: `${id}.actuator`, owner }))] });
    const port = G.add3(centre, G.mul3(up, end));
    return { port, approach: G.add3(port, G.mul3(up, 5)) };
  }

  // a cable: terminal dots on ends that stay with this piece, connector shells on ends that land on another piece
  function cable(piece, points, { move, bias = 0.2, r = 0.62, bend = 6, name, bundle, touch, clamps = [], shells = [false, false], free, tone = "mid", rings } = {}) {
    const route = G.fillet(points, bend, 12, { P, tube: r });
    const total = G.pathLength(route);
    const SHELL = 2.2;
    const gaps = [...clamps.flatMap(({ centre, axis, radius }) => crossingsOf(route, centre, axis, radius).map((a) => [a - CLAMP_HALF - 0.05, a + CLAMP_HALF + 0.05])), ...(shells[0] ? [[0, SHELL]] : []), ...(shells[1] ? [[total - SHELL, total]] : [])];
    const id = tubeItems(piece, route, r, { name: name ?? `${piece}.cable`, tone, bias, move, maxLength: 14, spacing: 1, bundle, touch, gaps, free, limp: true, rings, rims: shells.map((on) => (on ? r * 2 : r)) });
    CABLES.push({ piece, name: id, route });
    [0, 1].forEach((index) => {
      const end = index ? route[route.length - 1] : route[0];
      if (!shells[index]) {
        put(piece, end, Dots([at(end)], { size: 0.5, tone: "hi" }), { bias: bias + 0.15, move, name: `${id}.end`, shapes: [A.ball(end, 0.5 / KS)] });
        return;
      }
      const tangent = G.tangentAlong(route, index ? total : 0);
      const F = G.frameAlong(end, tangent);
      const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
      const outer = index ? s0 : s1;
      put(piece, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 2, F, P, { bevel: 0.25 }), { tone: "mid" }) + (G.dot3(G.mul3(F.a, index ? -1 : 1), V) > 0.2 ? Ln(G.circleOf(F, outer, r * 1.1, P, 12), { tone: "faint" }) : ""), { bias: bias + 0.1, move, name: `${id}.shell`, shapes: [record(A.disc(F, s0, s1, r * 2, { name: `${id}.shell`, owner: id }))] });
    });
    return route;
  }

  function clampAt(piece, centre, axis, r, { move, bias = 0.3, name = `${piece}.clamp`, bundle } = {}) {
    const F = G.frameAlong(centre, axis);
    const id = nameFor(name);
    put(piece, centre, S(G.disc(-CLAMP_HALF, CLAMP_HALF, r, F, P), { tone: "mid" }), { bias, move, name: id, shapes: [record(A.disc(F, -CLAMP_HALF, CLAMP_HALF, r, { name: id, anchor: false, bundle, fitting: true }))] });
    return { centre, axis, radius: r };
  }

  // the direction across the screen from a leg along d, so a bend in the plane of d and sideOn(d) faces the viewer
  const sideOn = (d) => G.unit3(G.cross3(G.unit3(G.sub3(V, G.mul3(d, G.dot3(V, d)))), d));

  // the SVG transform that maps a face plane (origin o, unit axes ex, ey) to the screen, for screens and engraving
  function planeMatrix(o, ex, ey) {
    const p0 = at(o);
    const px = at(G.add3(o, ex));
    const py = at(G.add3(o, ey));
    const v = (x) => x.toFixed(4);
    return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
  }

  // screws: dots with a faint ring on a top face at z
  const screwsOn = (points, z, { ring = 1.2, size = 0.45 } = {}) => Ln(points.map(([x, y]) => k.ring(x, y, ring, z, P, 12)).join(""), { tone: "lo" }) + Dots(points.map(([x, y]) => at([x, y, z])), { size });

  return { live, P, V, KS, R, at, S, Ln, Dots, Faded, path3, record, nameFor, put, tubeItems, turned, band, flangeAt, pipe, slab, boxOf, prism, ballAt, elbow, boss, padOn, valveOn, cable, clampAt, sideOn, planeMatrix, screwsOn, CABLES, PIPES, PIECES };
}
