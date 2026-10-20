from pathlib import Path
import gzip,json
import numpy as np
root=Path(__file__).resolve().parent.parent;build=root/'build';out=root/'app'
a=np.frombuffer(gzip.decompress((build/'machine.f32.gz').read_bytes()),dtype='<f4').reshape(-1,10)
dtype=np.dtype([('xy','<f4',(2,)),('z','<f4'),('rgba','u1',(4,)),('group','u1'),('piece','u1'),('line','u1'),('pad','u1')])
p=np.zeros(len(a),dtype=dtype);p['xy']=a[:,:2];p['z']=a[:,2];p['rgba']=np.rint(np.clip(a[:,3:7],0,1)*255).astype('u1');p['group']=a[:,7];p['piece']=a[:,8];p['line']=a[:,9]
u,inv=np.unique(p,return_inverse=True)
(out/'assets/machine.vertices.bin').write_bytes(gzip.compress(u.tobytes(),9,mtime=0));(out/'assets/machine.indices.bin').write_bytes(gzip.compress(inv.astype('<u4').tobytes(),9,mtime=0))
d=json.loads((build/'machine.json').read_text());d['uniqueVertices']=len(u);d['vertexBytes']=20;d['indices']=len(inv);(out/'data/mesh-meta.json').write_text(json.dumps(d,separators=(',',':')))
print({'vertices':len(u),'indices':len(inv),'vertexRaw':u.nbytes,'indexRaw':len(inv)*4,'gzip':(out/'assets/machine.vertices.bin').stat().st_size+(out/'assets/machine.indices.bin').stat().st_size})
