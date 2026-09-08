import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.mjs':'app.mjs','/model.mjs':'model.mjs'};
http.createServer((req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);return res.end('Not found')}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');res.setHeader('Cache-Control','no-store');fs.createReadStream(path.join(root,file)).pipe(res)}).listen(4174,'127.0.0.1',()=>console.log('Ranking demo: http://localhost:4174'));
