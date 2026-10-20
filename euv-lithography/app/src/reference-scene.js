import * as T from "three";
import { REFERENCE_SHAPES as R, findEvidence } from "./evidence.js";
export function createReferenceScene() {
  const group = new T.Group(),
    ink = new T.LineBasicMaterial({ color: 0x65767a }),
    teal = new T.LineBasicMaterial({ color: 0x247d82 }),
    violet = new T.LineBasicMaterial({ color: 0x71539e });
  const objects = {},
    batches = new Map();
  const line = (pts, material = ink) => {
    if (!batches.has(material)) batches.set(material, []);
    const out = batches.get(material);
    for (let i = 1; i < pts.length; i++) out.push(...pts[i - 1], ...pts[i]);
  };
  const wafer = new T.Mesh(
    new T.CircleGeometry(R.wafer.diameter / 2, 256),
    new T.MeshBasicMaterial({
      color: 0xe4e9e4,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  wafer.position.set(...R.wafer.center);
  group.add(wafer);
  objects.wafer = wafer;
  const ring = Array.from({ length: 257 }, (_, i) => [
    R.wafer.center[0] + (R.wafer.diameter / 2) * Math.cos((i / 256) * Math.PI * 2),
    (R.wafer.diameter / 2) * Math.sin((i / 256) * Math.PI * 2),
    0.01,
  ]);
  line(ring);
  for (const [name, spec, color] of [
    ["field", R.field, 0xbad3d0],
    ["mask", R.mask, 0xe3ddeb],
  ]) {
    const [w, h] = spec.size,
      c = spec.center,
      m = new T.Mesh(
        new T.PlaneGeometry(w, h),
        new T.MeshBasicMaterial({
          color,
          side: T.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
    m.position.set(...c);
    group.add(m);
    objects[name] = m;
    line(
      [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
        [-w / 2, -h / 2],
      ].map((p) => [p[0] + c[0], p[1] + c[1], c[2] + 0.01]),
      name === "field" ? teal : violet,
    );
  }
  // Nominal extents only: no invented substrate thickness or uncertainty envelope.
  const dim = (a, b) => {
    line([a, b]);
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      n = Math.hypot(dx, dy),
      u = [(-dy / n) * 0.45, (dx / n) * 0.45, 0];
    for (const p of [a, b])
      line([
        [p[0] - u[0], p[1] - u[1], p[2]],
        [p[0] + u[0], p[1] + u[1], p[2]],
      ]);
  };
  const [wx, wy] = R.wafer.center,
    wr = R.wafer.diameter / 2,
    [mx, my] = R.mask.center,
    [mw, mh] = R.mask.size,
    [fx, fy] = R.field.center,
    [fw, fh] = R.field.size;
  dim([wx - wr, wy - wr - 3, 0], [wx + wr, wy - wr - 3, 0]);
  for (const x of [wx - wr, wx + wr])
    line([
      [x, wy - wr, 0],
      [x, wy - wr - 4, 0],
    ]);
  dim([mx - mw / 2, my - mh / 2 - 3.4, 0], [mx + mw / 2, my - mh / 2 - 3.4, 0]);
  dim([mx + mw / 2 + 2.8, my - mh / 2, 0], [mx + mw / 2 + 2.8, my + mh / 2, 0]);
  dim([fx - fw / 2, fy + fh / 2 + 1.35, 0], [fx + fw / 2, fy + fh / 2 + 1.35, 0]);
  dim([fx + fw / 2 + 2.2, fy - fh / 2, 0], [fx + fw / 2 + 2.2, fy + fh / 2, 0]);
  for (const [material, points] of batches) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(points, 3));
    group.add(new T.LineSegments(geometry, material));
  }
  return {
    group,
    objects,
    labels: [
      {
        text: `P · ${findEvidence("wafer").value} mm · nominal`,
        at: [wx, wy - wr - 5, 0],
        kind: "published",
      },
      { text: "Wafer · planar outline", at: [wx, wy + wr + 2, 0], kind: "published" },
      {
        text: `P · ${findEvidence("field").value.join(" × ")} mm · scanned field`,
        at: [fx, fy + fh / 2 + 3.35, 0],
        kind: "published",
      },
      { text: "D · Mask-pattern footprint", at: [mx, my + mh / 2 + 3.4, 0], kind: "derived" },
      {
        text: findEvidence("mask-pattern").value[0] + " mm",
        at: [mx, my - mh / 2 - 5.4, 0],
        kind: "derived",
      },
      {
        text: findEvidence("mask-pattern").value[1] + " mm",
        at: [mx + mw / 2 + 5.8, my, 0],
        kind: "derived",
      },
    ],
  };
}
