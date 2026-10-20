// Browser-based SVG compiler. Bind only to this computer.
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url);
const generated=new URL('authoring/generated-light.html',root);
const input=existsSync(generated)?readFileSync(generated,'utf8'):gunzipSync(readFileSync(new URL('fixtures/original-light.html.gz',root))).toString();
const bundle=await build({entryPoints:[fileURLToPath(new URL('pipeline/convert-artwork.js',root))],bundle:true,write:false,format:'iife'});
const page=input.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace('</body>',`<button id="compile" style="position:fixed;top:12px;left:12px;z-index:99999;padding:20px">Compile drawing mesh</button><script src="/converter.js"></script><script>document.querySelector('#compile').onclick=async function(){this.disabled=true;this.textContent='Compiling…';try{await window.convert();this.textContent='Saved. You can close this tab.'}catch(e){this.textContent='Failed: '+e.message;this.disabled=false;console.error(e)}};</script></body>`);
createServer(async(req,res)=>{
 try{
  if(req.method==='GET'&&req.url==='/'){res.setHeader('Content-Type','text/html');res.end(page);return;}
  if(req.method==='GET'&&req.url==='/converter.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  if(req.method==='POST'&&req.url==='/__mesh'){
   if(req.headers.origin!=='http://127.0.0.1:8877'){res.writeHead(403);res.end();return;}
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>512*1024*1024)throw Error('Mesh exceeds 512 MB');chunks.push(c);}
   const data=JSON.parse(Buffer.concat(chunks).toString());mkdirSync(new URL('build/',root),{recursive:true});const raw=Buffer.from(data.binary,'base64');delete data.binary;
   if(raw.length!==data.vertices*10*4)throw Error('Invalid vertex buffer length');
   writeFileSync(new URL('build/machine.f32.gz',root),gzipSync(raw));writeFileSync(new URL('build/machine.json',root),JSON.stringify(data));
   res.end('ok');console.log(`Saved ${data.vertices} vertices. Run npm run build:drawing next.`);return;
  }
  res.writeHead(404);res.end();
 }catch(e){console.error(e);res.writeHead(500);res.end(e.message);}
}).listen(8877,'127.0.0.1',()=>console.log('Open http://127.0.0.1:8877 and click Compile drawing mesh. Keep this process open until Saved appears.'));
