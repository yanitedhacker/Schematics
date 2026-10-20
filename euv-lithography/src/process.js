// A dated NXE:3800E reference cycle, not a production control model.
export const REFERENCE = Object.freeze({
  name: "NXE:3800E · 2024/2025 reference",
  wavelength: 13.5,
  na: 0.33,
  reduction: 4,
  wafer: 300,
  field: [26, 33],
  dose: 30,
  wph: 220,
});
export const SCAN = 0.117,
  SWAP = 1.2,
  CYCLE = 3600 / REFERENCE.wph;
export const FIELDS = [];
for (let j = -7; j <= 7; j++) {
  const row = [];
  for (let i = -6; i <= 6; i++) {
    const x = i * 3.3,
      y = j * 2.6 + 1.3;
    if (Math.hypot(Math.max(0, Math.abs(x) - 1.65), Math.max(0, Math.abs(y) - 1.3)) < 14.7) row.push([x, y]);
  }
  if (j % 2) row.reverse();
  FIELDS.push(...row);
}
export const STEP = (CYCLE - SWAP) / FIELDS.length - SCAN;
export const FIELD = SCAN + STEP,
  EXPOSURE = FIELDS.length * FIELD;
export const JOURNEY = [
  { id: "foup", name: "FOUP · load", at: [-530, 149, 106] },
  { id: "coat", name: "Spin coat", at: [-255, 104, 155.3] },
  { id: "soft-bake", name: "Soft bake", at: [-256, -24, 153.5] },
  { id: "cool", name: "Cool plate", at: [-220, -24, 153.5] },
  { id: "load-lock", name: "Load lock · vacuum transfer", at: [-50, 0, 142.4] },
  { id: "measure", name: "Alignment and level measurement", at: [-10, 0, 140] },
  { id: "expose", name: "Slit exposure", at: [110, 0, 140] },
  { id: "unload", name: "Unload lock · return to track", at: [-50, 0, 142.4] },
  { id: "peb", name: "Post-exposure bake", at: [-364, -24, 185.5] },
  { id: "post-cool", name: "Cool after bake", at: [-220, -24, 153.5] },
  { id: "develop", name: "Develop and rinse", at: [-392, 104, 187.3] },
  { id: "return", name: "FOUP · return", at: [-530, 149, 106] },
];
const ease = (x) => x * x * (3 - 2 * x),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function scanPose(i, t) {
  const [x, y] = FIELDS[i],
    dir = i % 2 ? 1 : -1;
  const s = (Math.min(t / SCAN, 1) - 0.5) * (0.3 * 100 * SCAN) * dir;
  return { wafer: [-x - s, -y, 0], reticle: [4 * s, 0, 0] };
}
function exposePose(t) {
  const i = Math.min(95, Math.floor((t + 1e-10) / FIELD)),
    u = t - i * FIELD;
  const a = scanPose(i, u);
  if (u <= SCAN) return { ...a, field: i + 1, lit: true };
  const k = ease(Math.max(0, Math.min(1, (u - SCAN) / STEP)));
  const b = i < 95 ? scanPose(i + 1, 0) : { wafer: [0, 0, 0], reticle: [0, 0, 0] };
  return { wafer: mix(a.wafer, b.wafer, k), reticle: mix(a.reticle, b.reticle, k), field: i + 1, lit: false };
}
export class Process {
  time = 0;
  running = false;
  start() {
    this.running = true;
  }
  stop() {
    this.running = false;
  }
  reset() {
    this.time = 0;
    this.running = false;
  }
  advance(dt) {
    if (this.running && Number.isFinite(dt) && dt > 0) this.time += dt;
  }
  state() {
    const time = Math.round(this.time * 1e10) / 1e10;
    const wafers = Math.floor((time + 1e-9) / CYCLE),
      t = Math.max(0, time - wafers * CYCLE),
      odd = wafers % 2;
    const restA = [110, 0, 140],
      restB = [-10, 0, 140];
    const station = (atLens) => [atLens ? 110 : -10, 0, 140];
    let a = station(!odd),
      b = station(!!odd),
      reticle = [0, 0, 0],
      field = 96,
      lit = false,
      phase = "swap";
    if (t < EXPOSURE) {
      const pose = exposePose(t);
      field = pose.field;
      lit = pose.lit;
      reticle = pose.reticle;
      phase = pose.lit ? "expose" : "step";
      const exp = [110 + pose.wafer[0], pose.wafer[1], 140];
      const measure = [-10 + 5 * Math.sin(t * 0.7), 4 * Math.sin(t * 0.35), 140];
      if (!odd) {
        a = exp;
        b = measure;
      } else {
        a = measure;
        b = exp;
      }
    } else {
      const k = Math.min(1, (t - EXPOSURE) / SWAP),
        s = ease(k),
        lane = 18 * Math.sin(Math.PI * k);
      const next = scanPose(0, 0),
        m = [-10 + 5 * Math.sin(EXPOSURE * 0.7), 4 * Math.sin(EXPOSURE * 0.35), 140];
      const startA = odd ? m : [110, 0, 140],
        startB = odd ? [110, 0, 140] : m;
      const endA = odd ? [110 + next.wafer[0], next.wafer[1], 140] : [-10, 0, 140];
      const endB = odd ? [-10, 0, 140] : [110 + next.wafer[0], next.wafer[1], 140];
      a = mix(startA, endA, s);
      b = mix(startB, endB, s);
      a[1] += lane;
      b[1] -= lane;
      reticle = mix([0, 0, 0], next.reticle, s);
    }
    const journeyT = (time / 4) % JOURNEY.length; // independent illustrated route; not production dwell times
    const ji = Math.floor(journeyT),
      jk = journeyT - ji;
    const current = JOURNEY[ji],
      next = JOURNEY[Math.min(ji + 1, JOURNEY.length - 1)];
    const transit = Math.max(0, Math.min(1, (jk - 0.35) / 0.65));
    return {
      phase,
      field,
      wafers,
      lit: lit && this.running,
      chuckA: a.map((v, i) => v - restA[i]),
      chuckB: b.map((v, i) => v - restB[i]),
      reticle,
      journey: {
        index: ji,
        id: current.id,
        name: current.name,
        at: mix(current.at, next.at, ease(transit)),
        transit: transit > 0 && transit < 1,
      },
      cycleFraction: t / CYCLE,
    };
  }
}
