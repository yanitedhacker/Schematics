import { test } from 'node:test';
import assert from 'node:assert/strict';
const path = new URL('../app/src/process.js', import.meta.url);
let model;
try { model = await import(path); } catch (e) { if(e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }

test('96 fields and one cycle give the dated 220 wph reference', () => {
  assert.ok(model, 'Process model must exist');
  assert.equal(model.FIELDS.length, 96);
  assert.ok(Math.abs(3600 / model.CYCLE - 220) < 1e-9);
  assert.ok(model.STEP > 0);
  assert.ok(Math.abs(model.CYCLE - (96 * (model.SCAN + model.STEP) + model.SWAP)) < 1e-9);
});
test('elapsed time gives the same cycle state at 60 and 120 Hz', () => {
  assert.ok(model, 'Process model must exist');
  for (const seconds of [3, 16, 49]) {
    const a = new model.Process(), b = new model.Process(); a.start(); b.start();
    for (let i=0;i<seconds*60;i++) a.advance(1/60);
    for (let i=0;i<seconds*120;i++) b.advance(1/120);
    assert.ok(Math.abs(a.time-b.time)<1e-8);
    const aa=a.state(), bb=b.state(); assert.equal(aa.field,bb.field); assert.equal(aa.wafers,bb.wafers);
    assert.ok(Math.abs(aa.reticle[0]-bb.reticle[0])<1e-7);
  }
});
test('reticle scans in the opposite direction at four times wafer speed', () => {
  assert.ok(model, 'Process model must exist');
  const p=new model.Process();p.start();p.advance(.02);const a=p.state();p.advance(.01);const b=p.state();
  assert.ok(Math.abs((b.reticle[0]-a.reticle[0]) / (b.chuckA[0]-a.chuckA[0]) + 4)<1e-8);
});
test('stage swap ends at the next valid station with no position jump', () => {
  assert.ok(model, 'Process model must exist');
  const p=new model.Process();p.start();p.advance(model.CYCLE-1e-5);const a=p.state();p.advance(2e-5);const b=p.state();
  assert.ok(Math.hypot(...a.chuckA.map((x,i)=>x-b.chuckA[i]))<.01);
  assert.equal(b.wafers,1);
});
test('stop freezes motion, restart resumes, reset restores first field', () => {
  assert.ok(model, 'Process model must exist');
  const p=new model.Process();p.start();p.advance(3);p.stop();const t=p.time;p.advance(8);assert.equal(p.time,t);
  p.start();p.advance(.5);assert.equal(p.time,t+.5);p.reset();assert.equal(p.time,0);assert.equal(p.running,false);
});
test('full wafer route includes post exposure processing and FOUP return', () => {
  assert.ok(model, 'Process model must exist');
  const names=model.JOURNEY.map(s=>s.id);
  for(const id of ['coat','soft-bake','cool','load-lock','measure','expose','unload','peb','post-cool','develop','return']) assert.ok(names.includes(id),id);
  assert.equal(names.at(-1),'return');
  assert.deepEqual(model.JOURNEY[0].at,model.JOURNEY.at(-1).at);
});
