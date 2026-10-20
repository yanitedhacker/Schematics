import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url))),require=createRequire(import.meta.url),resolve=name=>require.resolve(name,{paths:[root]});
const T=await import(pathToFileURL(join(dirname(resolve('three')),'three.module.js'))),{Brush,Evaluator,SUBTRACTION}=await import(pathToFileURL(join(dirname(resolve('three-bvh-csg')),'../src/index.js'))),{mergeGeometries,mergeVertices}=await import(pathToFileURL(resolve('three/addons/utils/BufferGeometryUtils.js')));
const src=JSON.parse(gunzipSync(fs.readFileSync(new URL('../source-shapes.json.gz',import.meta.url)))),out=new URL('../app/',import.meta.url);
const v=a=>new T.Vector3(...a),evaluator=new Evaluator();evaluator.attributes=['position','normal'];evaluator.useGroups=false;
function orient(g,F,lathe=false){const m=new T.Matrix4().makeBasis(v(F.u),v(lathe?F.a:F.v),v(lathe?F.v:F.a));m.setPosition(v(F.o));g.applyMatrix4(m);if(m.determinant()<0){const a=g.index.array;for(let i=0;i<a.length;i+=3)[a[i+1],a[i+2]]=[a[i+2],a[i+1]];}return g;}
function solid(s,cut=true){let g;
 if(s.kind==='body'){let p=s.poly.map(([a,r])=>new T.Vector2(r,a));if(!p[0].equals(p.at(-1)))p.push(p[0].clone());g=orient(new T.LatheGeometry(p,64),s.F,true);}
 else if(s.kind==='prism'){const shape=new T.Shape(s.poly.map(p=>new T.Vector2(...p)));g=new T.ExtrudeGeometry(shape,{depth:s.s1-s.s0,bevelEnabled:false,steps:1,curveSegments:16});g.translate(0,0,s.s0);if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));g=orient(g,s.F);}
 else if(s.kind==='ball'){g=new T.SphereGeometry(s.r,32,20);g.translate(...s.o);}
 else if(s.kind==='box'){g=new T.BoxGeometry(...s.half.map(x=>2*x));const m=new T.Matrix4().makeBasis(...s.axes.map(v));m.setPosition(v(s.o));g.applyMatrix4(m);}
 else if(s.kind==='tube'){
  const pts=s.points.map(v),keep=[0];for(let i=1;i<pts.length-1;i++){const a=pts[i].clone().sub(pts[i-1]).normalize(),b=pts[i+1].clone().sub(pts[i]).normalize();if(a.dot(b)<.999999||Math.abs(s.radii[i]-s.radii[i-1])>1e-5||Math.abs(s.radii[i+1]-s.radii[i])>1e-5)keep.push(i);}keep.push(pts.length-1);
  const p=[],idx=[],n=24;let prevU=null;
  for(let j=0;j<keep.length;j++){const i=keep[j],t=pts[keep[Math.min(j+1,keep.length-1)]].clone().sub(pts[keep[Math.max(j-1,0)]]).normalize();let u=prevU?prevU.clone().addScaledVector(t,-prevU.dot(t)):new T.Vector3(0,0,1).cross(t);if(u.lengthSq()<1e-8)u.set(0,1,0).cross(t);u.normalize();const w=t.clone().cross(u).normalize();prevU=u;
   for(let k=0;k<n;k++){const a=k/n*Math.PI*2;qpush(p,pts[i].clone().addScaledVector(u,Math.cos(a)*s.radii[i]).addScaledVector(w,Math.sin(a)*s.radii[i]));}
   if(j)for(let k=0;k<n;k++){const a=(j-1)*n+k,b=(j-1)*n+(k+1)%n,c=j*n+k,d=j*n+(k+1)%n;idx.push(a,b,c,b,d,c);}
  }
  const first=p.length/3;qpush(p,pts[0]);const last=p.length/3;qpush(p,pts.at(-1));for(let k=0;k<n;k++){idx.push(first,(k+1)%n,k);const o=(keep.length-1)*n;idx.push(last,o+k,o+(k+1)%n);}
  g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
 }else throw Error('Unknown shape '+s.kind);
 for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key);
 if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
 // Orient closed solids consistently before boolean subtraction.
 let vol=0;const p=g.attributes.position,ix=g.index.array,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();for(let i=0;i<ix.length;i+=3){a.fromBufferAttribute(p,ix[i]);b.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);vol+=a.dot(b.cross(c));}if(vol<0){for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];g.attributes.normal.array.forEach((x,i,arr)=>arr[i]=-x);}
 if(cut&&s.cut){let brush=new Brush(g);brush.updateMatrixWorld();for(const other of Array.isArray(s.cut)?s.cut:[s.cut]){const b=new Brush(solid(other,false));b.updateMatrixWorld();brush=evaluator.evaluate(brush,b,SUBTRACTION);}g=brush.geometry;}
 return g;
}
function qpush(a,p){a.push(p.x,p.y,p.z);}
const groups=[],objects=[],positions=[],normals=[],ids=[],gids=[],indices=[],edges=[],edgeIDs=[],edgeGroups=[],counts={};let vertexOffset=0,cutCount=0,marks=0;
const az=src.P.azimuth*Math.PI/180,el=src.P.elevation*Math.PI/180,R=new T.Vector3(Math.sin(az),-Math.cos(az),0),D=new T.Vector3(Math.cos(az)*Math.sin(el),Math.sin(az)*Math.sin(el),-Math.cos(el)),V=new T.Vector3(Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)),ray=new T.Raycaster(),mat=new T.MeshBasicMaterial({side:T.DoubleSide});
for(const [oid,item]of src.items.entries()){
 let gid=groups.findIndex(g=>g.piece===item.piece&&g.live===item.live&&g.move.join()===item.move.join());if(gid<0){gid=groups.length;groups.push({piece:item.piece,live:item.live,move:item.move});}
 const gs=item.shapes.map(s=>{counts[s.kind]=(counts[s.kind]||0)+1;if(s.cut)cutCount++;return solid(s);});let geo=mergeGeometries(gs.map(g=>g.index?g.toNonIndexed():g));
 const pp=geo.attributes.position,nn=geo.attributes.normal,cp=[],cn=[],va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3();
 for(let j=0;j<pp.count;j+=3){va.fromBufferAttribute(pp,j);vb.fromBufferAttribute(pp,j+1).sub(va);vc.fromBufferAttribute(pp,j+2).sub(va);const face=vb.cross(vc);if(face.lengthSq()<1e-16)continue;face.normalize();for(let k=0;k<3;k++){cp.push(pp.getX(j+k),pp.getY(j+k),pp.getZ(j+k));const normal=new T.Vector3().fromBufferAttribute(nn,j+k);if(normal.lengthSq()<1e-12)normal.copy(face);normal.normalize();qpush(cn,normal);}}
 geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(cp,3));geo.setAttribute('normal',new T.Float32BufferAttribute(cn,3));geo=mergeVertices(geo,1e-6);geo.computeBoundingBox();
 const p=geo.attributes.position,n=geo.attributes.normal,box=geo.boundingBox,center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
 const object={id:oid,name:item.name,piece:item.piece,group:gid,live:item.live,bounds:[box.min.toArray(),box.max.toArray()],center:center.toArray(),radius:size.length()/2,vertexStart:vertexOffset,vertexCount:p.count,indexStart:indices.length,indexCount:geo.index.count,edgeStart:edgeIDs.length,shapes:item.shapes.length,cut:item.shapes.some(s=>s.cut)};objects.push(object);
 for(let j=0;j<p.count;j++){positions.push(p.getX(j),p.getY(j),p.getZ(j));normals.push(n.getX(j),n.getY(j),n.getZ(j));ids.push(oid);gids.push(gid);}for(const k of geo.index.array)indices.push(vertexOffset+k);vertexOffset+=p.count;
 const e=new T.EdgesGeometry(geo,22).attributes.position;for(let j=0;j<e.count;j++){edges.push(e.getX(j),e.getY(j),e.getZ(j));edgeIDs.push(oid);edgeGroups.push(gid);}
 // Lift source-side engraved marks to the actual surface, never onto a billboard.
 const mesh=new T.Mesh(geo,mat);mesh.updateMatrixWorld();const cache=new Map();
 const lift=(x,y)=>{const key=x+','+y;if(cache.has(key))return cache.get(key);const base=R.clone().multiplyScalar((x-src.P.origin[0])/src.P.scale).addScaledVector(D,(y-src.P.origin[1])/src.P.scale).addScaledVector(V,5000);ray.set(base,V.clone().negate());const hit=ray.intersectObject(mesh,false)[0],pt=hit?hit.point.clone().addScaledVector(V,.025):null;cache.set(key,pt);return pt;};
 for(const m of item.svg.matchAll(/<path\s+class="iso-line"[^>]*d="([^"]*)"/g)){
  if(/[^MLZmlz0-9eE.,\s+\-]/.test(m[1]))continue;let prev=null,start=null;
  for(const t of m[1].matchAll(/([MLZ])([^MLZ]*)/g)){if(t[1]==='Z'){if(prev&&start)addMark(prev,start);continue;}const a=t[2].match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number)||[];for(let j=0;j<a.length-1;j+=2){const point=lift(a[j],a[j+1]);if(t[1]==='M'&&j===0)start=point;else if(prev&&point)addMark(prev,point);prev=point;}}
 }
 function addMark(a,b){if(a.distanceTo(b)>100)return;qpush(edges,a);qpush(edges,b);edgeIDs.push(oid,oid);edgeGroups.push(gid,gid);marks++;}
 object.edgeCount=edgeIDs.length-object.edgeStart;
 if(oid%400===0)console.log('3D items',oid);
}
function save(name,a){fs.writeFileSync(new URL('assets/'+name+'.bin',out),gzipSync(Buffer.from(a.buffer),{level:9}));}
save('solid.indices',new Uint32Array(indices));save('solid.positions',new Float32Array(positions));save('solid.normals',new Float32Array(normals));save('solid.ids',new Uint16Array(ids));save('solid.groups',new Uint8Array(gids));save('solid.edges',new Float32Array(edges));save('solid.edgeids',new Uint16Array(edgeIDs));save('solid.edgegroups',new Uint8Array(edgeGroups));
const meta={version:1,sourceItems:src.items.length,objects,groups,pieces:src.pieces,counts,cutCount,marks,vertices:positions.length/3,triangles:indices.length/3,indices:indices.length,edgeVertices:edges.length/3,camera:src.P};fs.writeFileSync(new URL('data/solid-meta.json',out),JSON.stringify(meta)+'\n');console.log(JSON.stringify({vertices:meta.vertices,triangles:meta.triangles,edgeVertices:meta.edgeVertices,groups:groups.length,cutCount,marks}));
