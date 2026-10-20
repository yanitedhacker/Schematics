// Exact spring integration keeps the motion independent of display refresh rate.
const same = (a, b) => a && b && a.kind === b.kind && a.id === b.id;
export class InspectionMotion {
  constructor() {
    this.reset();
  }
  reset() {
    this.current = null;
    this.pending = null;
    this.amount = 0;
    this.velocity = 0;
    this.target = 0;
  }
  get moving() {
    return !!this.pending || (!!this.current && (this.amount !== this.target || this.velocity !== 0));
  }
  request(selection, immediate = false) {
    if (!selection) {
      this.close(immediate);
      return;
    }
    if (immediate) {
      this.current = selection;
      this.pending = null;
      this.amount = 1;
      this.velocity = 0;
      this.target = 1;
      return;
    }
    if (!this.current) {
      this.current = selection;
      this.target = 1;
    } else if (same(this.current, selection)) {
      this.pending = null;
      this.target = 1;
    } else {
      this.pending = selection;
      this.target = 0;
    }
  }
  close(immediate = false) {
    if (immediate) {
      this.reset();
      return;
    }
    this.pending = null;
    this.target = 0;
  }
  settle() {
    const selection = this.pending || (this.target === 1 ? this.current : null);
    if (selection) this.request(selection, true);
    else this.reset();
  }
  step(seconds) {
    if (!this.current) return;
    const dt = Math.max(0, Math.min(0.1, seconds)),
      omega = 11,
      d = this.amount - this.target,
      c = this.velocity + omega * d,
      e = Math.exp(-omega * dt);
    this.amount = this.target + (d + c * dt) * e;
    this.velocity = (this.velocity - omega * c * dt) * e;
    if (this.amount < 0 || this.amount > 1) {
      this.amount = Math.max(0, Math.min(1, this.amount));
      this.velocity = 0;
    }
    if (Math.abs(this.amount - this.target) < 0.0002 && Math.abs(this.velocity) < 0.002) {
      this.amount = this.target;
      this.velocity = 0;
      if (this.target === 0) {
        this.current = this.pending;
        this.pending = null;
        if (this.current) this.target = 1;
      }
    }
  }
}
