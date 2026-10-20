import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {ShapeGeometry} from 'three';
const NS='http://www.w3.org/2000/svg';
window.convert=async()=>{
 const style=document.createElement('style');style.textContent='.iso[data-theme="light"]{--anatomy-hi:#35373b;--anatomy-mid:#74777b;--anatomy-lo:#a3a6a8;--anatomy-faint:#c5c8c9;--anatomy-shade-0:#d2d5d5;--anatomy-shade-1:#e0e3e2;--anatomy-shade-2:#eceeeb;--anatomy-shade-3:#f4f5f1;}';document.head.append(style);
 const all=[...document.querySelectorAll('.it')].sort((a,b)=>+a.dataset.k-+b.dataset.k||+a.dataset.i-+b.dataset.i);
 const pieces=[...new Set(all.map(n=>n.dataset.piece))],groups=[],groupKeys=new Map(),items=[],flat=document.createElementNS(NS,'svg');
 let repairs=0,shapeCount=0,skippedHalo=0,clipped=0;
 const paintMeta=[];
 const rgb=s=>{const n=s.match(/[\d.]+/g);return n?n.slice(0,3).map(x=>+x/255):[.3,.3,.3];};
 const point=(p,m)=>[m.a*p[0]+m.c*p[1]+m.e,m.b*p[0]+m.d*p[1]+m.f];
 for(let i=0;i<all.length;i++){
  const item=all[i],key=[item.dataset.ride||item.dataset.piece,item.dataset.live||''].join('|');
  if(!groupKeys.has(key)){groupKeys.set(key,groups.length);groups.push({ride:item.dataset.ride||item.dataset.piece,live:item.dataset.live||null,move:item.dataset.m.split(',').map(Number)});}
  const gi=groupKeys.get(key),pi=pieces.indexOf(item.dataset.piece),bb=item.getBBox();
  items.push({name:item.dataset.name,piece:item.dataset.piece,group:gi,key:+item.dataset.k,bounds:[bb.x,bb.y,bb.width,bb.height]});
  const svg=item.ownerSVGElement,inv=svg.getCTM().inverse();let paintIndex=0;
  for(const n of item.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line')){
   if(n.closest('defs,clipPath'))continue;
   if(n.classList.contains('iso-halo')){skippedHalo++;continue;}
   const cs=getComputedStyle(n);if(cs.display==='none'||cs.visibility==='hidden')continue;
   const clone=n.cloneNode(false);clone.removeAttribute('class');clone.removeAttribute('id');clone.removeAttribute('style');
   let d=clone.getAttribute('d');if(d&&d.startsWith('<path')){const parsed=new DOMParser().parseFromString(`<svg xmlns="${NS}">${d}</svg>`,'image/svg+xml').querySelector('path');if(!parsed)throw Error('Cannot repair path');clone.setAttribute('d',parsed.getAttribute('d'));repairs++;}
   const mat=inv.multiply(n.getCTM());clone.setAttribute('transform',`matrix(${mat.a} ${mat.b} ${mat.c} ${mat.d} ${mat.e} ${mat.f})`);
   let opacity=1,ancestor=n;while(ancestor&&ancestor!==svg){opacity*=+(getComputedStyle(ancestor).opacity||1);ancestor=ancestor.parentElement;}
   for(const attr of ['fill','stroke','fill-rule','stroke-linecap','stroke-linejoin','stroke-miterlimit'])clone.setAttribute(attr,cs.getPropertyValue(attr));
   clone.setAttribute('fill-opacity',+cs.fillOpacity*opacity);clone.setAttribute('stroke-opacity',+cs.strokeOpacity*opacity);
   clone.setAttribute('stroke-width',Math.max(.3,+cs.strokeWidth.replace('px','')*1.25));
   let clip=null;ancestor=n;
   while(ancestor&&ancestor!==item){const cp=ancestor.getAttribute('clip-path');if(cp){const id=cp.match(/#([^)]*)/)[1],c=document.getElementById(id)?.querySelector('path');if(c){const cm=inv.multiply(c.getCTM());const total=c.getTotalLength();clip=Array.from({length:96},(_,j)=>{const p=c.getPointAtLength(total*j/96);return point([p.x,p.y],cm);});}break;}ancestor=ancestor.parentElement;}
   const mi=paintMeta.length;clone.setAttribute('data-meta',mi);paintMeta.push({group:gi,piece:pi,depth:+item.dataset.k+paintIndex++*.000015,fill:rgb(cs.fill),stroke:rgb(cs.stroke),clip});
   flat.append(clone);shapeCount++;
  }
  if(i%200===0)await new Promise(r=>setTimeout(r,0));
 }
 const data=new SVGLoader().parse(new XMLSerializer().serializeToString(flat));
 const chunks=[];let vertices=0;
 function clipPoly(poly,clip){
  if(!clip)return poly;
  let area=0;for(let i=0;i<clip.length;i++){const a=clip[i],b=clip[(i+1)%clip.length];area+=a[0]*b[1]-b[0]*a[1];}
  const sign=area>0?1:-1;
  for(let i=0;i<clip.length&&poly.length;i++){
   const a=clip[i],b=clip[(i+1)%clip.length],out=[],dist=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
   for(let j=0;j<poly.length;j++){const p=poly[j],q=poly[(j+1)%poly.length],dp=dist(p),dq=dist(q);if(dp>=0)out.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
   poly=out;
  }return poly;
 }
 function emit(geometry,meta,color,alpha,line){
  if(!geometry||alpha<=.005)return;
  let g=geometry.index?geometry.toNonIndexed():geometry;const p=g.attributes.position.array,out=[];
  for(let j=0;j<p.length;j+=9){let poly=[[p[j],p[j+1]],[p[j+3],p[j+4]],[p[j+6],p[j+7]]];if(meta.clip){poly=clipPoly(poly,meta.clip);clipped++;}
   for(let k=1;k<poly.length-1;k++)for(const q of [poly[0],poly[k],poly[k+1]])out.push(q[0],q[1],meta.depth+(line?.000008:0),...color,alpha,meta.group,meta.piece,line?1:0);
  }
  chunks.push(new Float32Array(out));vertices+=out.length/10;geometry.dispose();if(g!==geometry)g.dispose();
 }
 for(let i=0;i<data.paths.length;i++){
  const p=data.paths[i],s=p.userData.style,m=paintMeta[+p.userData.node.getAttribute('data-meta')];
  if(s.fill!=='none')for(const sh of SVGLoader.createShapes(p))emit(new ShapeGeometry(sh,8),m,m.fill,s.fillOpacity,false);
  if(s.stroke!=='none'&&s.strokeWidth>0)for(const sub of p.subPaths)emit(SVGLoader.pointsToStroke(sub.getPoints(8),s,4,.02),m,m.stroke,s.strokeOpacity,true);
  if(i%800===0)await new Promise(r=>setTimeout(r,0));
 }
 const buffer=new Float32Array(vertices*10);let off=0;for(const c of chunks){buffer.set(c,off);off+=c.length;}
 const bytes=new Uint8Array(buffer.buffer);let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));
 const result={pieces,groups,items,vertices,repairs,shapeCount,skippedHalo,clipped,stride:10,binary:btoa(str)};
 const saved=await fetch('/__mesh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});if(!saved.ok)throw Error('Save failed');
 return {...result,binary:`${bytes.length} bytes`};
};
