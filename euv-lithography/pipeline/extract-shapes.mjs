import {gzipSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../authoring/',import.meta.url));
const {makeLib}=await import(pathToFileURL(root+'lib.mjs'));
const plan=await import(pathToFileURL(root+'plan.mjs'));
const P=plan.project(),L=makeLib(P,plan.PIECES,{order:plan.STAGGER,spring:plan.SPRING}),shared={};
const ctx={...plan,P,back:[],theme:'light',solo:false,shared};
for(const name of ['stand','laser','beamline','utility','frame','stages','pob','reticle','illum','source','interface','track','loadport','oht']){
 const mod=await import(pathToFileURL(root+'parts/'+name+'.mjs'));mod.build(L,ctx);
}
for(const item of L.R.items){const host=plan.RIDES[item.piece];if(host){item.ride=host;item.move=plan.PIECES[host].move;}}
const items=L.R.items.map(i=>({name:i.name,piece:i.piece,ride:i.ride||i.piece,live:i.live||null,move:i.move,pos:i.pos,svg:i.svg,shapes:i.shapes}));
const counts={},cuts={};let noShapes=0;
for(const i of items){if(!i.shapes?.length)noShapes++;for(const s of i.shapes||[]){counts[s.kind]=(counts[s.kind]||0)+1;if(s.cut)cuts[s.kind]=(cuts[s.kind]||0)+1;}}
const clean=(key,value)=>key.startsWith('_')||typeof value==='function'?undefined:value;
writeFileSync(new URL('../source-shapes.json.gz',import.meta.url),gzipSync(JSON.stringify({items,shared,P,pieces:plan.PIECES,stagger:plan.STAGGER},clean))); 
console.log(JSON.stringify({items:items.length,noShapes,counts,cuts,examples:Object.fromEntries(Object.keys(counts).map(k=>[k,items.flatMap(i=>i.shapes||[]).find(s=>s.kind===k)]))},clean,2).slice(0,10500));
