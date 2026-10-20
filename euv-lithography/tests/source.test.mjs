import {test}from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{createHash}from'node:crypto';import{gunzipSync}from'node:zlib';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root));
test('GPU buffers have valid indices, finite coordinates, valid group IDs and repaired artwork',()=>{
 const m=JSON.parse(read('app/data/mesh-meta.json')),v=gunzipSync(read('app/assets/machine.vertices.bin')),idx=new Uint32Array(gunzipSync(read('app/assets/machine.indices.bin')).buffer);
 assert.equal(v.length,m.uniqueVertices*20);assert.equal(m.repairs,4);assert.equal(m.indices%3,0);
 const dv=new DataView(v.buffer,v.byteOffset,v.byteLength);
 for(let i=0;i<m.uniqueVertices;i++){assert.ok(Number.isFinite(dv.getFloat32(i*20,true)));assert.ok(Number.isFinite(dv.getFloat32(i*20+4,true)));assert.ok(dv.getUint8(i*20+16)<m.groups.length);assert.ok(dv.getUint8(i*20+17)<m.pieces.length);}
 for(const n of idx)assert.ok(n<m.uniqueVertices);
});
test('new copy is standalone and contains no live machine SVG or remote runtime dependency',()=>{
 const s=read('dist/euv-lithography.html').toString();assert.equal(/<svg\b/i.test(s),false);assert.equal(/<script[^>]+src=/i.test(s),false);assert.ok(s.includes('DecompressionStream'));assert.match(s,/getContext\(['"]webgl2['"]/);assert.ok(s.includes('Post-exposure bake'));
});
test('original fixture hash matches the reviewed source',()=>{
 const s=gunzipSync(read('fixtures/original-light.html.gz'));assert.equal(createHash('sha256').update(s).digest('hex'),'10b6c00319bdc8d05df5e96bd5bcdc2b3ce8532548d06e889902874e5b3b2075');
});
test('automatic detail retains every filled machine triangle at all levels',()=>{
 const m=JSON.parse(read('app/data/mesh-meta.json')),v=gunzipSync(read('app/assets/machine.vertices.bin')),buffer=gunzipSync(read('app/assets/machine.indices.bin')),all=new Uint32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4);
 const solidHash=level=>{const a=all.subarray(level.byteOffset/4,level.byteOffset/4+level.count),keep=[];for(let i=0;i<a.length;i+=3){if(v[a[i]*20+18]===0)keep.push(a[i],a[i+1],a[i+2]);}return createHash('sha256').update(new Uint32Array(keep)).digest('hex');};
 assert.equal(solidHash(m.levels.full),solidHash(m.levels.medium));assert.equal(solidHash(m.levels.full),solidHash(m.levels.coarse));assert.ok(m.levels.coarse.count<m.levels.medium.count);assert.ok(m.levels.medium.count<m.levels.full.count);
});
