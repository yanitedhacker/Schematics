// Reticle stage, mask and handler, hanging from the scanner's upper deck: four hangers carry a long-stroke frame
// (two rails with linear-motor magnet tracks, cross beams, end stops); a sled rides the rails on shoes and carries a
// maglev short stroke on Lorentz pucks; under it a flexure neck, the cooled glass plate and the electrostatic clamp
// hold the mask face down with its pellicle. REMA blades sit just below the mask (X pair fixed, Y pair riding the scan).
// Toward -x a vacuum robot with a two-handed gripper serves a library of EUV inner pods.
// Sources: research/mechanics.md Part B (WO2024170186A1, US7105836, US6906789B2, US8765331B2, Brouns 2017, Entegris).
import { k, G, A } from "../lib.mjs";

const PIECE = "reticle";
const TRAVEL = 9;          // DERIVED: 132 mm field + 2 x 9 mm ramps (1.2^2 / 2*78) + 2 x ~10 mm settle ~ 170 mm, so +-9 cm about the slit
const MASK = 15.2;         // 152 mm LTEM substrate [SEMI P37, Entegris]
const MASK_T = 0.635;      // 6.35 mm thick [SEMI P37]
const PELLICLE = { x: 15.1, y: 11.7, gap: 0.25 };   // frame 151 x 117 mm, 2.5 mm standoff [imec/ASML, Brouns 2017]
const MEMBRANE = { x: 14.41, y: 11.07 };            // 144.1 x 110.7 mm [imec/ASML]
const FIELD = { x: 13.2, y: 10.4 };                 // 132 (scan) x 104 mm field on the mask [Heil 2015]

export function build(L, ctx) {
  const { P, OPTIC, MOUNTS, ENV } = ctx;
  ctx.shared.reticle = { maskCentre: [...OPTIC.reticle], travel: TRAVEL };
  const [X0, Y0, Z] = OPTIC.reticle;
  const DECK = MOUNTS.upperDeck.z;   // underside of the frame deck (frame.mjs puts it exactly here): hangers end here
  const E0 = ENV.reticle.z0;
  const { at, Ln, Dots, slab, boxOf, turned, cable, flangeAt, boss, clampAt, screwsOn, live } = L;
  const vert = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const seam = (plan, z, steps = 3) => k.sideSeam(plan, z, P, steps);
  const box = (name, a, b, tone = "mid", options = {}) => boxOf(PIECE, a, b, { tone }, { name: `${PIECE}.${name}`, ...options });
  const plan = (a, b) => ({ x: a[0], y: a[1], w: b[0] - a[0], d: b[1] - a[1], r: 0.4 });
  const seamsOf = (a, b, list) => Ln(list.map((z) => seam(plan(a, b), z)).join(""), { tone: "faint" });
  const mirrorY = (fn) => [1, -1].forEach((s) => fn(s));
  const yr = (s, y0, y1) => (s > 0 ? [y0, y1] : [-y1, -y0]);

  // the stub stands in for the frame's deck, so it leaves with the frame when the cell comes apart
  if (ctx.solo) L.record({ ...A.slab(MOUNTS.upperDeck.plan, DECK, 1, { name: "stand.stub" }), ground: true, piece: "frame", ride: "frame", move: ctx.PIECES.frame.move });

  // ---- z stack, as offsets from the patterned face ----
  const H = {
    clamp1: MASK_T + 1.565,   // DERIVED: 15.6 mm fused-glass clamp: two plates with the closed cooling channels between them [WO2024170186A1]
    plate1: MASK_T + 3.365,   // DERIVED: 18 mm cooled backing plate, the clamp's mount and its coolant ports
    neck1: 7,                 // DERIVED: 3 cm flexure neck decouples the short-stroke body's thermal and bending strain from the clamp
    ss1: 15,                  // DERIVED: 8 cm short-stroke body: Lorentz magnets + metrology faces, ~6 kg with clamp and mask at 8 g needs ~0.5 kN
    act1: 17.9,
    sled0: 21,                // DERIVED: 1 mm levitation gap over 2.9 cm coil pucks + 3 cm magnet pucks
    sled1: 28,
    rail0: 30,
    rail1: 38,
    beam1: 46,
  };
  const z = (h) => Z + h;

  // ================= fixed: long-stroke frame hanging from the deck =================
  const RAIL_X = [86, 198];
  const RAIL_Y = [26, 34];     // DERIVED: rails just outside the 64 cm sled so the shoes sit under them
  // cross beams sit on the rails' ends; hangers stand on the beams
  for (const [x0, x1] of [[86, 98], [186, 198]]) {
    box("cross-beam", [x0, -40, z(H.rail1)], [x1, 40, z(H.beam1)], "mid", { inner: seamsOf([x0, -40], [x1, 40], [z(H.rail1 + 4)]), extra: screwsOn([[x0 + 2, -37], [x1 - 2, -37], [x0 + 2, 37], [x1 - 2, 37]], z(H.beam1)) });
  }
  for (const x of [92, 192]) for (const y of [-30, 30]) {
    flangeAt(PIECE, [x, y, z(H.beam1) + 0.75], [0, 0, 1], 5, 1.5, { tone: "mid", name: `${PIECE}.hanger-foot` });
    const F = vert(x, y, z(H.beam1) + 1.5);
    const len = DECK - 1.5 - (z(H.beam1) + 1.5);
    turned(PIECE, F, [[0, 3], [len, 3]], { tone: "mid" }, { name: `${PIECE}.hanger`, inner: G.arcOf(F, len * 0.5, 3, P) });
    flangeAt(PIECE, [x, y, DECK - 0.75], [0, 0, 1], 5, 1.5, { tone: "mid", name: `${PIECE}.hanger-head` });
  }
  mirrorY((s) => {
    const [y0, y1] = yr(s, ...RAIL_Y);
    box("rail", [RAIL_X[0], y0, z(H.rail0)], [RAIL_X[1], y1, z(H.rail1)], "mid", { inner: seamsOf([RAIL_X[0], y0], [RAIL_X[1], y1], [z(H.rail0 + 2)]) });
    // linear-motor magnet track on the rail's inner face; pole joints every 3 cm run its full height
    const [t0, t1] = s > 0 ? [24.5, 26] : [-26, -24.5];
    const poles = [];
    if (s < 0) for (let x = 100; x <= 184; x += 3) poles.push(k.segment([x, t1, z(H.rail0)], [x, t1, z(H.rail1 - 0.5)], P));
    box("magnet-track", [98, t0, z(H.rail0)], [186, t1, z(H.rail1 - 0.5)], "lo", { inner: Ln(poles.join(""), { tone: "faint" }) });
    // end stops: rubber-faced bumpers under the rail, 1 cm past the shoes' end of travel
    for (const [x0, x1] of [[100, 104], [180, 184]]) {
      const [b0, b1] = yr(s, 27, 33);
      box("end-stop", [x0, b0, z(H.sled1 + 0.3)], [x1, b1, z(H.rail0)], "lo");
    }
  });
  // cable-shuttle rail on the +y rail
  box("shuttle-rail", [100, 27, z(H.rail1)], [184, 33, z(H.rail1 + 1.2)], "lo", { extra: screwsOn([[103, 30], [142, 30], [181, 30]], z(H.rail1 + 1.2), { ring: 0.8, size: 0.4 }) });
  // label plate on the +y rail's outer face: three printed rule lines
  {
    const y = 34.3;
    box("label-plate", [104, 34, z(H.rail0 + 1.5)], [120, y, z(H.rail0 + 6.5)], "lo", {
      extra: Ln([[106, 4.8, 12], [106, 3.6, 8], [106, 2.4, 10]].map(([x, h, w]) => k.segment([x, y, z(H.rail0 + 1.5 + h)], [x + w, y, z(H.rail0 + 1.5 + h)], P)).join(""), { tone: "lo", free: true }) + Dots([at([105, y, z(H.rail0 + 2.2)]), at([119, y, z(H.rail0 + 5.8)])], { size: 0.4 }),
    });
  }
  // stage junction box on the +y rail, fed to the REMA drive and to the cross beam bulkhead
  box("junction-box", [162, 34, z(H.rail0 + 1)], [178, 37.5, z(H.rail0 + 7)], "mid", { inner: Ln(k.planOutline({ x: 163, y: 34.6, w: 14, d: 2.6, r: 0.4 }, z(H.rail0 + 7), P, 2), { tone: "faint" }), extra: Dots([at([163.4, 37.5, z(H.rail0 + 6.4)]), at([176.6, 37.5, z(H.rail0 + 1.6)])], { size: 0.4 }) });
  cable(PIECE, [[162, 36.4, z(H.rail0 + 3)], [118, 36.4, z(H.rail0 + 3)]], { name: `${PIECE}.jb-rema`, bend: 2 });

  // ---- REMA: fixed frame carried on brackets off both rails ----
  // DERIVED: X blades 8 mm under the face, Y blades 13 mm: penumbra 2 g tan(4.7 deg) = 1.3 and 2.1 mm, inside the 2-3 mm black border [US8765331B2]
  const XB = { z0: -1.0, z1: -0.8 };
  const YB = { z0: -1.4, z1: -1.2 };
  const RR = { z0: -4.6, z1: -2.6 };   // REMA rails, below the Y-blade carriages
  mirrorY((s) => {
    const [b0, b1] = yr(s, 34, 40);
    box("rema-bracket", [110, b0, z(H.rail0 + 1)], [118, b1, z(H.rail0 + 7)], "mid", { extra: screwsOn([[111.6, s * 39], [116.4, s * 39]], z(H.rail0 + 7), { ring: 0.7, size: 0.4 }) });
    box("rema-post", [112, yr(s, 36, 40)[0], z(RR.z1)], [116, yr(s, 36, 40)[1], z(H.rail0 + 1)], "mid", { inner: seamsOf([112, yr(s, 36, 40)[0]], [116, yr(s, 36, 40)[1]], [z(12)]) });
    box("rema-arm", [110, yr(s, 21, 40)[0], z(RR.z0)], [146, yr(s, 21, 40)[1], z(RR.z1)], "mid");
    // DERIVED: 58 cm REMA rail covers the Y blades' +-9 cm ride plus their carriages
    box("rema-rail", [110, yr(s, 17, 21)[0], z(RR.z0)], [168, yr(s, 17, 21)[1], z(RR.z1)], "lo", { extra: screwsOn([[113, s * 19], [165, s * 19]], z(RR.z1), { ring: 0.7, size: 0.4 }) });
    box("x-blade-riser", [138, yr(s, 21, 24)[0], z(RR.z1)], [146, yr(s, 21, 24)[1], z(XB.z1)], "mid");
    // DERIVED: X blade 8 cm along the scan covers the 0.8 cm slit plus the 6 deg cone 1 cm down; edge at 52 mm sets the 104 mm width
    box("x-blade", [138, yr(s, FIELD.y / 2, 21)[0], z(XB.z0)], [146, yr(s, FIELD.y / 2, 21)[1], z(XB.z1)], "mid", { bevel: 0 });
  });

  // ================= fixed: handler bed, vacuum robot, inner-pod library =================
  const BED = { x: 20, y: -48, w: 70, d: 62, r: 1 };   // DERIVED: bed spans robot + library; four hangers keep it off the stage frame
  slab(PIECE, BED, E0, Z - 1 - E0, { tone: "lo" }, { name: `${PIECE}.handler-bed`, inner: Ln(seam(BED, E0 + 2), { tone: "faint" }), extra: screwsOn([[29, -45], [81, -45], [29, 11], [81, 11]], Z - 1) });
  for (const [x, y] of [[24, -46], [84.6, -46], [24, 12], [84.6, 12]]) {
    flangeAt(PIECE, [x, y, Z - 0.25], [0, 0, 1], 2.6, 0.5, { tone: "mid", bolts: 0, name: `${PIECE}.bed-hanger-foot` });
    const F = vert(x, y, Z - 0.5);
    turned(PIECE, F, [[0, 1.2], [DECK - 1 - (Z - 0.5), 1.2]], { tone: "mid" }, { name: `${PIECE}.bed-hanger` });
    flangeAt(PIECE, [x, y, DECK - 0.5], [0, 0, 1], 3, 1, { tone: "mid", bolts: 6, name: `${PIECE}.bed-hanger-head` });
  }
  // robot: base, column, turret, upper arm, elbow, forearm, wrist, two-handed gripper
  // DERIVED: 20 cm upper arm + 21.5 cm forearm + 33 cm hand-to-mask-centre reach ~75 cm from the column: the clamp at the long stroke's -x exchange end
  const RB = [60, -14];
  const RZ = (h) => Z - 1 + h;
  flangeAt(PIECE, [...RB, RZ(0.75)], [0, 0, 1], 7, 1.5, { tone: "lo", bolts: 8, name: `${PIECE}.robot-base` });
  {
    const F = vert(...RB, RZ(1.5));
    turned(PIECE, F, [[0, 4.5], [2.5, 4.5]], { tone: "mid" }, { name: `${PIECE}.robot-column`, inner: G.arcOf(F, 1.25, 4.5, P) });
    const T = vert(...RB, RZ(4));
    turned(PIECE, T, [[0, 6], [3, 6]], { tone: "mid" }, { name: `${PIECE}.robot-turret`, extra: Dots(G.dotsOf(T, 3, 4.8, 10, P, { all: true }), { size: 0.4, tone: "mid" }) });
  }
  box("upper-arm", [60, -17, RZ(7)], [80, -11, RZ(10)], "mid", { inner: seamsOf([60, -17], [80, -11], [RZ(8.5)]) });
  turned(PIECE, vert(80, -14, RZ(10)), [[0, 3.5], [5.5, 3.5]], { tone: "mid" }, { name: `${PIECE}.elbow` });
  box("forearm", [76.5, -17.5, RZ(15.5)], [83.5, 9, RZ(18.5)], "mid", { extra: screwsOn([[78, -16], [82, -16], [78, 7.5], [82, 7.5]], RZ(18.5), { ring: 0.7, size: 0.4 }) });
  turned(PIECE, vert(80, 6, RZ(12.5)), [[0, 3], [3, 3]], { tone: "mid" }, { name: `${PIECE}.wrist` });
  // two-handed gripper: the bar turns about the wrist, one hand toward the stage, one toward the library
  box("gripper-bar", [77, -8, RZ(10.5)], [83, 20, RZ(12.5)], "mid", { inner: seamsOf([77, -8], [83, 20], [RZ(11.5)]) });
  box("palm", [72, 20, RZ(10.5)], [88, 22, RZ(12.5)], "mid");
  box("palm", [72, -10, RZ(10.5)], [88, -8, RZ(12.5)], "mid");
  for (const [x0, x1] of [[72.6, 74.2], [85.8, 87.4]]) {
    box("tine", [x0, 22, RZ(10.5)], [x1, 37, RZ(11.3)], "lo");
    box("tine", [x0, -25, RZ(10.5)], [x1, -10, RZ(11.3)], "lo");
  }
  // the incoming mask on the +y hand, face down on the tines' edge-grip pads
  box("mask-incoming", [72.4, 22.2, RZ(11.3)], [87.6, 37.4, RZ(11.3) + MASK_T], "hi", { bevel: 0.2 });
  // robot amplifier and the bed junction box
  box("robot-amp", [64, -34, Z - 1], [68, -30, Z + 2.5], "mid", { extra: Ln(k.planOutline({ x: 64.6, y: -33.4, w: 2.8, d: 2.8, r: 0.3 }, Z + 2.5, P, 2), { tone: "faint" }) });
  box("bed-junction", [74, -38, Z - 1], [82, -30, Z + 3], "mid", { extra: screwsOn([[75, -37], [81, -31]], Z + 3, { ring: 0.6, size: 0.4 }) });
  cable(PIECE, [[74, -32, Z + 1], [68, -32, Z + 1]], { name: `${PIECE}.amp-feed`, bend: 2 });

  // library: four slots on posts, three pods and one open slot with its alignment pins
  // DERIVED: four slots: one pod opening, two queued, one spare for the swap
  // ESTIMATED: EUV inner pod 21.8 x 19.0 x 3.6 cm (Entegris datasheet dimensions not mapped to EIP/EOP)
  const LY = -24;   // library sits behind the robot, toward -y
  const SHELF = [Z - 1, Z + 8, Z + 17, Z + 26, Z + 35];
  for (const [x0, x1] of [[21, 22.5], [45.5, 47]]) for (const [y0, y1] of [[LY - 20, LY - 18.5], [LY + 1.5, LY + 3]])
    box("library-post", [x0, y0, Z - 1], [x1, y1, SHELF[4] + 0.6], "mid");
  SHELF.forEach((s, index) => box(index === 4 ? "library-top" : "library-shelf", [22.5, LY - 20, s], [45.5, LY + 3, s + 0.6], "lo"));
  SHELF.slice(0, 3).forEach((s, index) => {
    const b = s + 0.6;
    const base = { x: 23.1, y: LY - 18, w: 21.8, d: 19, r: 0.8 };
    slab(PIECE, base, b, 1.2, { tone: "lo" }, { name: `${PIECE}.pod-base`, steps: 3, extra: Ln(k.planOutline({ x: 25, y: LY - 16.4, w: 3, d: 2, r: 0.3 }, b + 1.2, P, 2) + k.planOutline({ x: 40, y: LY - 2.6, w: 3, d: 2, r: 0.3 }, b + 1.2, P, 2), { tone: "faint" }) });
    const cover = k.insetPlan(base, 1.4);
    slab(PIECE, cover, b + 1.2, 2.4, { tone: "mid" }, { name: `${PIECE}.pod-cover`, steps: 3, inner: Ln(seam(cover, b + 2.0), { tone: "faint" }), extra: screwsOn([[cover.x + 1.2, cover.y + 1.2], [cover.x + cover.w - 1.2, cover.y + cover.d - 1.2]], b + 3.6, { ring: 0.6, size: 0.4 }) });
    box("pod-handle", [30, LY - 11.5, b + 3.6], [38, LY - 5.5, b + 4.2], "mid", { extra: index === 2 ? Ln(k.planOutline({ x: 31, y: LY - 10.5, w: 6, d: 4, r: 0.4 }, b + 4.2, P, 2), { tone: "faint" }) : "" });
  });
  {
    const s = SHELF[3] + 0.6;
    for (const [x, y] of [[26, LY - 15], [42, LY - 15], [34, LY]]) turned(PIECE, vert(x, y, s), [[0, 0.6], [0.8, 0.6]], { tone: "mid" }, { name: `${PIECE}.pod-pin` });
  }

  // ================= live: the scanning carriage =================
  live(PIECE, () => {
    // sled on four shoes, with the two linear-motor coil blocks
    // DERIVED: ~45 kg sled + short stroke at 8 g needs ~3.5 kN; two 36 cm ironless coils at ~50 N/cm give it
    const SLED = { x: 112, y: -32, w: 60, d: 64, r: 1.5 };
    slab(PIECE, SLED, z(H.sled0), H.sled1 - H.sled0, { tone: "mid" }, { name: `${PIECE}.sled`, steps: 3, bevel: 0.6, inner: Ln(seam(SLED, z(H.sled0 + 2)), { tone: "faint" }), extra: screwsOn([[115, -29], [169, -29], [115, 29], [169, 29], [142, 29], [142, -29]], z(H.sled1)) + Ln(k.planOutline({ x: 128, y: -16, w: 28, d: 32, r: 1 }, z(H.sled1), P, 3), { tone: "faint" }) });
    for (const [x0, x1] of [[114, 122], [162, 170]]) mirrorY((s) => box("shoe", [x0, yr(s, 27, 33)[0], z(H.sled1)], [x1, yr(s, 27, 33)[1], z(H.rail0)], "lo"));
    mirrorY((s) => box("motor-coil", [124, yr(s, 20, 24)[0], z(H.sled1)], [160, yr(s, 20, 24)[1], z(H.rail1 - 2)], "mid", { inner: seamsOf([124, yr(s, 20, 24)[0]], [160, yr(s, 20, 24)[1]], [z(H.sled1 + 3), z(H.sled1 + 6)]) }));
    // Lorentz pucks: coil half on the short stroke, magnet half on the sled, 1 mm apart
    for (const x of [132, 152]) for (const y of [-13, 13]) {
      turned(PIECE, vert(x, y, z(H.ss1)), [[0, 2.4], [H.act1 - H.ss1, 2.4]], { tone: "lo" }, { name: `${PIECE}.lorentz-coil` });
      turned(PIECE, vert(x, y, z(H.act1 + 0.1)), [[0, 2.4], [H.sled0 - H.act1 - 0.1, 2.4]], { tone: "mid" }, { name: `${PIECE}.lorentz-magnet`, inner: G.arcOf(vert(x, y, z(H.act1 + 0.1)), 1.2, 2.4, P) });
    }
    // short stroke body
    const SS = { x: 128, y: -18, w: 28, d: 36, r: 1 };
    slab(PIECE, SS, z(H.neck1), H.ss1 - H.neck1, { tone: "mid" }, { name: `${PIECE}.short-stroke`, steps: 3, bevel: 0.5, inner: Ln(seam(SS, z(H.neck1 + 1.5)) + seam(SS, z(H.ss1 - 1.5)), { tone: "faint" }), extra: screwsOn([[130, -16], [154, -16], [130, 16], [154, 16]], z(H.ss1), { ring: 0.8, size: 0.42 }) });
    // flexure neck, cooled plate, clamp with two HV ears, mask, pellicle
    box("neck", [137, -5, z(H.plate1)], [147, 5, z(H.neck1)], "lo", { inner: Ln([139.5, 142, 144.5].map((x) => k.segment([x, 5, z(H.plate1)], [x, 5, z(H.neck1)], P)).join(""), { tone: "faint" }) });
    const PLATE = { x: 135, y: -7, w: 14, d: 14, r: 0.5 };
    slab(PIECE, PLATE, z(H.clamp1), H.plate1 - H.clamp1, { tone: "mid" }, { name: `${PIECE}.cooling-plate`, steps: 3, bevel: 0.3, inner: Ln(seam(PLATE, z(H.clamp1 + 0.9)), { tone: "faint" }) });
    const CLAMP = { x: X0 - 7.2, y: Y0 - 7.2, w: 14.4, d: 14.4, r: 0.4 };   // DERIVED: inside the mask so it covers the 142 mm quality area and never hides the mask's edges
    slab(PIECE, CLAMP, z(MASK_T), H.clamp1 - MASK_T, { tone: "hi" }, { name: `${PIECE}.clamp`, steps: 3, bevel: 0.25, inner: Ln(seam(CLAMP, z(MASK_T + 0.78)), { tone: "faint" }) });
    mirrorY((s) => {
      const [e0, e1] = yr(s, 7.2, 9.6);
      box("clamp-ear", [135, e0, z(MASK_T + 0.2)], [138, e1, z(H.clamp1 - 0.2)], "hi", { bevel: 0 });
      cable(PIECE, [[136.5, s * 8.4, z(H.clamp1 - 0.2)], [136.5, s * 8.4, z(H.neck1)]], { name: `${PIECE}.hv-lead`, r: 0.4, bend: 1 });
    });
    const MASKP = { x: X0 - MASK / 2, y: Y0 - MASK / 2, w: MASK, d: MASK, r: 0.1 };
    slab(PIECE, MASKP, Z, MASK_T, { tone: "hi" }, { name: `${PIECE}.mask`, steps: 2, bevel: 0.15 });
    const PF = { x: X0 - PELLICLE.x / 2, y: Y0 - PELLICLE.y / 2, w: PELLICLE.x, d: PELLICLE.y, r: 0.2 };
    slab(PIECE, PF, Z - PELLICLE.gap, PELLICLE.gap - 0.02, { tone: "lo" }, { name: `${PIECE}.pellicle-frame`, steps: 2, bevel: 0 });   // DERIVED: frame height (UNVERIFIED) = 2.5 mm standoff less the 0.2 mm vent gap [Brouns 2017]
    const MB = { x: X0 - MEMBRANE.x / 2, y: Y0 - MEMBRANE.y / 2, w: MEMBRANE.x, d: MEMBRANE.y, r: 0.1 };
    slab(PIECE, MB, Z - PELLICLE.gap, 0.02, { tone: "lo" }, { name: `${PIECE}.pellicle-membrane`, steps: 2, bevel: 0 });
    mirrorY((s) => {
      const [s0, s1] = yr(s, PELLICLE.y / 2, PELLICLE.y / 2 + 0.5);
      for (const dx of [-5, 5]) box("pellicle-stud", [X0 + dx - 0.4, s0, Z - PELLICLE.gap], [X0 + dx + 0.4, s1, Z], "mid", { bevel: 0 });
    });
    // coolant in and out of the plate: two flexible hoses up its near face to the short stroke, clear of the mask's sight line
    // DERIVED: ~10 W absorbed EUV + clamp heating need ~0.2 l/min at 1 K rise; 8 mm hoses (5 mm bore) carry it at ~0.2 m/s
    for (const x of [140, 144.5]) cable(PIECE, [[x, 7, z(H.clamp1 + 0.9)], [x, 9, z(H.clamp1 + 0.9)], [x, 9, z(H.neck1)]], { name: `${PIECE}.coolant`, r: 0.4, bend: 1.2, tone: "hi" });
    // flex leads sled -> short stroke
    for (const x of [146, 149]) cable(PIECE, [[x, 16.5, z(H.sled0)], [x, 16.5, z(H.ss1)]], { name: `${PIECE}.ss-lead`, r: 0.5, bend: 1 });
    // Y REMA blades on their carriages, riding the REMA rails with the scan
    for (const [x0, x1, b0, b1] of [[126, 130, 126, X0 - FIELD.x / 2], [154, 158, X0 + FIELD.x / 2, 158]]) {
      mirrorY((s) => box("y-carriage", [x0, yr(s, 16.5, 20.8)[0], z(RR.z1)], [x1, yr(s, 16.5, 20.8)[1], z(YB.z0)], "mid"));
      box("y-blade", [b0, -20.5, z(YB.z0)], [b1, 20.5, z(YB.z1)], "mid", { bevel: 0 });
    }
    // cable slab: three lanes from the sled's near connector up round the rail to the shuttle
    box("slab-connector", [134, 32, z(H.sled0 + 1.5)], [143, 33.5, z(H.sled0 + 7)], "mid");
    box("shuttle", [134, 27.5, z(H.rail1 + 1.2)], [146, 32.5, z(H.rail1 + 4)], "mid", { extra: screwsOn([[135.5, 29], [144.5, 29]], z(H.rail1 + 4), { ring: 0.6, size: 0.4 }) });
    box("shuttle-connector", [134.5, 28, z(H.rail1 + 4)], [142.5, 32.5, z(H.rail1 + 10)], "mid", { inner: Ln(seam(plan([134.5, 28], [142.5, 32.5]), z(H.rail1 + 6.5)), { tone: "faint" }) });
    // one strain-relief clamp at each end of the slab, on a stud off its connector
    const lo = z(H.sled0 + 4);
    const hi = z(H.rail1 + 7);
    boss(PIECE, [138.5, 33.5, lo + 2.3], [0, 1, 0], 0.5, 0.6, { name: `${PIECE}.clamp-stud`, ring: false });
    boss(PIECE, [138.5, 32.5, hi + 2.3], [0, 1, 0], 0.5, 0.6, { name: `${PIECE}.clamp-stud`, ring: false });
    const clamps = [clampAt(PIECE, [138.5, 35, lo], [0, 1, 0], 3.6, { bundle: `${PIECE}.slab`, name: `${PIECE}.slab-clamp` }), clampAt(PIECE, [138.5, 34, hi], [0, 1, 0], 3.6, { bundle: `${PIECE}.slab`, name: `${PIECE}.slab-clamp` })];
    [[136, 0.62], [138.5, 0.8], [141, 0.62]].forEach(([x, r], lane) =>
      cable(PIECE, [[x, 33.5, z(H.sled0 + 4)], [x, 41, z(H.sled0 + 4)], [x, 41, z(H.rail1 + 7)], [x, 32.5, z(H.rail1 + 7)]], { name: `${PIECE}.slab-${lane}`, r, bend: 3.5, bundle: `${PIECE}.slab`, clamps, touch: [`${PIECE}.slab-clamp*`], tone: lane === 1 ? "hi" : "mid" }));
  });
}
