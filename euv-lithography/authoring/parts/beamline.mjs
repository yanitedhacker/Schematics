// The beam transport (BTS) from the laser's output port in the sub-fab up through the waffle slab and the raised
// floor to the source vessel's bottom port: sealed beam tubes with bellows, a safety-shutter box with its beam dump
// and interlock switches, floor-penetration collars at each slab face, and hangers to the slab.
// [Trumpf] sealed beam path, up to 30 m, laser class 1 with interlocks; [Cymer 2011] sealed tubes rise through the
// waffle-slab floor. Tube size, rise and layout are UNVERIFIED in the research, so they are DERIVED below.
import { k, G, A } from "../lib.mjs";

// DERIVED: plan.mjs moves this assembly [60, 0, -40]; any drop drives the riser and the plenum spool into the
// waffle slab and the laser turret. It slides out sideways (+x) so every collar slides along its slab face.
export const BEAMLINE_MOVE = [0, 0, 0];   // it threads the waffle slab and the tile penetration: it stays with the building

export function build(L, ctx) {
  const { P, PORTS, WAFFLE } = ctx;
  const { Ln, Dots, at, path3 } = L;
  const M = { move: BEAMLINE_MOVE };
  const [bx, by, bz] = PORTS.laserOut.at;
  const top = PORTS.beamEntry.at;
  const R = 12;                              // DERIVED: 24 cm bore for the 3.6x-expanded beam [WO2011075346A1] plus margin
  const box = (name, a, b, tone, opts = {}) => L.boxOf("beamline", a, b, { tone }, { ...M, name: `beamline.${name}`, ...opts });
  const upF = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

  // solo build: stand in for the laser's output port this tube bolts onto
  if (!ctx.shared.laserOut) L.record({ ...A.disc(G.frameAlong([bx, by, bz - 1], [0, 0, 1]), 0, 1, 21, { name: "stand.stub" }), ground: true });

  // ---------- safety shutter box with beam dump ----------
  // DERIVED: class-1 enclosure needs a fail-safe shutter that folds the beam into a water-cooled dump when any
  // interlock opens; a 62 x 56 x 44 box above the laser, its lid on the hanger ears.
  const SB = { x0: 350, x1: 412, y0: -28, y1: 28, z0: bz + 48, z1: bz + 92 };
  const sPlan = { x: SB.x0, y: SB.y0, w: SB.x1 - SB.x0, d: SB.y1 - SB.y0, r: 0.4 };
  box("shutter", [SB.x0, SB.y0, SB.z0], [SB.x1, SB.y1, SB.z1], "mid", {
    inner: Ln(k.sideSeam(sPlan, SB.z0 + 6, P, 3), { tone: "faint" }),
    extra: Dots([[SB.x0 + 4, SB.z0 + 10], [SB.x1 - 4, SB.z0 + 10], [SB.x0 + 4, SB.z1 - 4], [SB.x1 - 4, SB.z1 - 4]].map(([x, z]) => at([x, SB.y1, z])), { size: 0.45 }),
  });
  const lid = { x: SB.x0 + 1.5, y: SB.y0 + 1.5, w: SB.x1 - SB.x0 - 3, d: SB.y1 - SB.y0 - 3, r: 0.6 };
  const LID_TOP = SB.z1 + 2;
  L.slab("beamline", lid, SB.z1, 2, { tone: "mid" }, {
    ...M, name: "beamline.shutter.lid", steps: 2, bevel: 0.4,
    extra: Dots(k.corners(lid, 2.6).map(([x, y]) => at([x, y, LID_TOP])), { size: 0.45 }),
  });
  const label = { x0: 353, x1: 364, z0: SB.z1 - 22, z1: SB.z1 - 14 };
  box("shutter.label", [label.x0, SB.y1, label.z0], [label.x1, SB.y1 + 0.5, label.z1], "lo", {
    extra: Ln([2.5, 5].map((dz) => k.segment([label.x0 + 1.5, SB.y1 + 0.5, label.z1 - dz], [label.x1 - (dz === 5 ? 4 : 1.5), SB.y1 + 0.5, label.z1 - dz], P)).join(""), { tone: "lo", free: true }),
  });
  const DUMP_Z = (SB.z0 + SB.z1) / 2;
  const fins = [[0, 13], [2, 13], [2, 9.5]];
  for (let s = 3.2; s < 10; s += 2.4) fins.push([s, 9.5], [s, 12], [s + 1.2, 12], [s + 1.2, 9.5]);
  fins.push([12, 9.5], [12, 7]);
  L.turned("beamline", G.frameOf([bx, SB.y1, DUMP_Z], [0, 1, 0], [1, 0, 0], [0, 0, 1]), fins, { tone: "hi" }, { ...M, name: "beamline.dump" });
  L.turned("beamline", G.frameOf([SB.x1, by, DUMP_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]), [[0, 6], [2, 6], [2, 5], [7, 5], [8, 3.5]], { tone: "mid" }, { ...M, name: "beamline.shutter.actuator" });

  // ---------- riser: laser port -> shutter -> under the waffle slab ----------
  L.pipe("beamline", [[bx, by, bz], [bx, by, SB.z0]], R, { ...M, name: "beamline.riser-low", bellows: [0.3, 0.7, 5], free: [true, false] });
  const PLATE_T = 2;
  const low = { x: bx - 20, y: by - 20, w: 40, d: 40, r: 0.6 };
  L.slab("beamline", low, WAFFLE.bottom - PLATE_T, PLATE_T, { tone: "lo" }, {
    ...M, name: "beamline.collar-under", steps: 2,
  });
  L.pipe("beamline", [[bx, by, LID_TOP], [bx, by, WAFFLE.bottom - PLATE_T]], R, { ...M, name: "beamline.riser-high", bellows: [0.6, 0.82, 5], bands: [0.3] });

  // ---------- hangers from the slab soffit to the shutter ears ----------
  // DERIVED: two M16 threaded rods carry the shutter box (~60 kg) so the bellows never carry it
  for (const y of [-20, 20]) {
    box("hanger.ear", [341, y - 4, SB.z1 - 6], [SB.x0, y + 4, SB.z1], "lo");
    box("hanger.anchor", [340, y - 5, WAFFLE.bottom - PLATE_T], [350, y + 5, WAFFLE.bottom], "lo", {
      extra: Dots([[342, y], [348, y]].map(([x, yy]) => at([x, yy, WAFFLE.bottom - PLATE_T])), { size: 0.4 }),
    });
    L.turned("beamline", upF(345, y, SB.z1), [[0, 2.6], [2, 2.6]], { tone: "mid" }, { ...M, name: "beamline.hanger.nut" });
    L.turned("beamline", upF(345, y, SB.z1 + 2), [[0, 1.6], [WAFFLE.bottom - PLATE_T - 2 - SB.z1 - 2, 1.6]], { tone: "mid" }, { ...M, name: "beamline.hanger.rod" });
    L.turned("beamline", upF(345, y, WAFFLE.bottom - PLATE_T - 2), [[0, 2.6], [2, 2.6]], { tone: "mid" }, { ...M, name: "beamline.hanger.nut" });
  }

  // ---------- interlocks: shutter-position and lid switches to a junction box on the soffit ----------
  const JB = { x0: 401, x1: 417, y0: -30, y1: -14, z0: WAFFLE.bottom - 16, z1: WAFFLE.bottom };
  box("interlock.box", [JB.x0, JB.y0, JB.z0], [JB.x1, JB.y1, JB.z1], "mid", {
    inner: Ln(path3([[JB.x0 + 2, JB.y1, JB.z0 + 2], [JB.x1 - 2, JB.y1, JB.z0 + 2], [JB.x1 - 2, JB.y1, JB.z1 - 2], [JB.x0 + 2, JB.y1, JB.z1 - 2]], true), { tone: "faint" }),
  });
  const SW = [[405, -22], [391, -22]];
  for (const [x, y] of SW) {
    box("interlock.switch", [x - 4, y - 4, LID_TOP], [x + 4, y + 4, LID_TOP + 6], "hi", {
      extra: Ln(k.planOutline({ x: x - 2.5, y: y - 2.5, w: 5, d: 5, r: 0.4 }, LID_TOP + 6, P, 2), { tone: "faint" }),
    });
  }
  L.cable("beamline", [[405, -22, LID_TOP + 6], [405, -22, JB.z0]], { ...M, name: "beamline.interlock", bundle: "beamline.interlock" });
  L.cable("beamline", [[391, -22, LID_TOP + 6], [391, -22, JB.z0 - 18], [403, -26, JB.z0 - 18], [403, -26, JB.z0]], { ...M, name: "beamline.interlock", bundle: "beamline.interlock", bend: 4 });

  // ---------- floor penetration: collar on the waffle top, plenum spool, seal flange under the tile ----------
  const high = { x: bx - 20, y: by - 20, w: 40, d: 40, r: 0.6 };
  L.slab("beamline", high, WAFFLE.top, PLATE_T, { tone: "lo" }, {
    ...M, name: "beamline.collar-over", steps: 2,
    extra: Dots(k.corners(high, 3).map(([x, y]) => at([x, y, WAFFLE.top + PLATE_T])), { size: 0.45 }),
  });
  // the raised floor has a 120 x 60 penetration under the source vessel (stand.mjs), so the spool runs up through
  // it and ends on the vessel's bottom flange at PORTS.beamEntry
  const TILE_UNDER = top[2];
  L.pipe("beamline", [[top[0], top[1], WAFFLE.top + PLATE_T], [top[0], top[1], TILE_UNDER]], R, { ...M, name: "beamline.plenum", bellows: [0.35, 0.65, 5], free: [false, true], flangeR: [1.55, PORTS.beamEntry.r / R] });
}
