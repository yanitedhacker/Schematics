from pathlib import Path
import gzip,json,numpy as np
out=Path(__file__).resolve().parent.parent/'app';dt=np.dtype([('xy','<f4',(2,)),('z','<f4'),('rgba','u1',(4,)),('group','u1'),('piece','u1'),('line','u1'),('pad','u1')]);v=np.frombuffer(gzip.decompress((out/'assets/machine.vertices.bin').read_bytes()),dt);m=json.loads((out/'data/mesh-meta.json').read_text());ids=np.frombuffer(gzip.decompress((out/'assets/machine.indices.bin').read_bytes()),'<u4')[:m['indices']].reshape(-1,3);p=v['xy'][ids];a=p[:,1]-p[:,0];b=p[:,2]-p[:,0];cross=np.abs(a[:,0]*b[:,1]-a[:,1]*b[:,0]);side=np.max(np.linalg.norm(p-np.roll(p,1,axis=1),axis=2),axis=1);line=v['line'][ids[:,0]]==1
full=ids[cross>1e-7];medium=full[~((line[cross>1e-7])&(side[cross>1e-7]<.42))];coarse=full[~((line[cross>1e-7])&(side[cross>1e-7]<.68))]
levels={};off=0
for name,ary in [('full',full),('medium',medium),('coarse',coarse)]:levels[name]={'count':int(ary.size),'byteOffset':off*4,'triangles':len(ary)};off+=ary.size
(out/'assets/machine.indices.bin').write_bytes(gzip.compress(np.concatenate([full,medium,coarse]).astype('<u4').tobytes(),9,mtime=0));m['indices']=int(full.size);m['levels']=levels;m['removedZeroAreaTriangles']=int(len(ids)-len(full));(out/'data/mesh-meta.json').write_text(json.dumps(m,separators=(',',':'))+'\n');print(levels)
