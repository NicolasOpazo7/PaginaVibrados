import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import initSqlJs from 'sql.js';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateReview,isImage,mediaType,validateProject} from './validation.js';
import {importProvidedProjects} from './import-projects.js';
import {hashPassword,verifyPassword,validPasswordHash} from './passwords.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
fs.mkdirSync(dataDir,{recursive:true});fs.mkdirSync(path.join(dataDir,'uploads'),{recursive:true});
const SQL=await initSqlJs();const dbPath=path.join(dataDir,'site.sqlite');const db=new SQL.Database(fs.existsSync(dbPath)?fs.readFileSync(dbPath):undefined);
db.run('CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,image TEXT NOT NULL,position INTEGER DEFAULT 0); CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,rating INTEGER NOT NULL,comment TEXT NOT NULL,image TEXT,created TEXT NOT NULL,status TEXT DEFAULT "pending",response TEXT DEFAULT "")');
db.run('CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, content TEXT NOT NULL)');
const save=()=>{const tmp=dbPath+'.tmp';fs.writeFileSync(tmp,db.export());fs.renameSync(tmp,dbPath)};save();
const query=(sql,args=[])=>{const stmt=db.prepare(sql);try{stmt.bind(args);const rows=[];while(stmt.step())rows.push(stmt.getAsObject());return rows}finally{stmt.free()}};
db.run('CREATE TABLE IF NOT EXISTS project_media (id INTEGER PRIMARY KEY AUTOINCREMENT,project_id INTEGER NOT NULL,type TEXT NOT NULL,src TEXT NOT NULL,thumbnail TEXT DEFAULT "",alt TEXT DEFAULT "",position INTEGER DEFAULT 0)');
// Preserve existing single-image projects without changing their IDs or files.
for(const project of query('SELECT * FROM projects')){if(project.image&&!query('SELECT id FROM project_media WHERE project_id=?',[project.id]).length)db.run('INSERT INTO project_media (project_id,type,src,alt) VALUES (?,"image",?,?)',[project.id,project.image,project.title])}save();
if(process.env.IMPORT_PROVIDED_MEDIA!=='false'){
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'content/projects.json'),'utf8'));
  if(importProvidedProjects(db,catalog))save();
}
const getProjects=()=>query('SELECT * FROM projects ORDER BY position,id DESC').map(p=>({...p,media:query('SELECT id,type,src,thumbnail,alt,position FROM project_media WHERE project_id=? ORDER BY position,id',[p.id])}));
const syncCover=id=>{const first=query('SELECT * FROM project_media WHERE project_id=? ORDER BY position,id LIMIT 1',[id])[0];db.run('UPDATE projects SET image=? WHERE id=?',[first?(first.type==='image'?first.src:first.thumbnail||''):'',id])};
const production=process.env.NODE_ENV==='production';
const supabaseOrigin=new URL(process.env.VITE_SUPABASE_URL||JSON.parse(fs.readFileSync(path.join(root,'content/supabase.json'),'utf8')).url).origin;
const passwordHash=process.env.ADMIN_PASSWORD_HASH||(process.env.ADMIN_PASSWORD?.length>=16&&!production?await hashPassword(process.env.ADMIN_PASSWORD):'');
if(production&&(!process.env.ADMIN_USER||!validPasswordHash(passwordHash)))throw new Error('Configura ADMIN_USER y ADMIN_PASSWORD_HASH antes de iniciar producción.');
const app=express();
if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','blob:',supabaseOrigin],connectSrc:["'self'",supabaseOrigin],mediaSrc:["'self'"],upgradeInsecureRequests:process.env.NODE_ENV==='production'?[]:null}}}));app.use(express.json({limit:'20kb'}));
app.use('/api',(req,res,next)=>{
  const origin=req.get('origin'),ownOrigin=`${req.protocol}://${req.get('host')}`;
  const publicReviews=req.path==='/reviews';
  if(publicReviews&&origin&&origin===process.env.PUBLIC_ORIGIN){
    res.set('Access-Control-Allow-Origin',origin);res.vary('Origin');
    res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.set('Access-Control-Allow-Headers','Content-Type');
    if(req.method==='OPTIONS')return res.sendStatus(204);
  }
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin&&origin!==ownOrigin&&origin!==process.env.PUBLIC_ORIGIN)return res.status(403).json({error:'Origen no autorizado.'});
  if(req.path.startsWith('/admin')){
    res.set('Cache-Control','no-store');
    const allowedAdmin=origin===ownOrigin||(!production&&origin===process.env.PUBLIC_ORIGIN);
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin&&!allowedAdmin)return res.status(403).json({error:'El panel debe abrirse desde su servidor.'});
  }
  next();
});
app.use('/api',rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:10}});
function storeImage(file){if(!file)return '';const ext=isImage(file.buffer);if(!ext)throw new Error('La imagen debe ser JPG, PNG o WebP válida.');const filename=randomBytes(20).toString('hex')+'.'+ext;fs.writeFileSync(path.join(dataDir,'uploads',filename),file.buffer);return '/uploads/'+filename}
app.get('/uploads/:name',(req,res)=>{if(!/^[a-f0-9]{40}\.(jpg|png|webp|mp4|webm)$/.test(req.params.name))return res.sendStatus(404);const image='/uploads/'+req.params.name;const allowed=query('SELECT id FROM project_media WHERE src=? OR thumbnail=?',[image,image]).length||query('SELECT id FROM projects WHERE image=?',[image]).length||query('SELECT id FROM reviews WHERE image=? AND status="approved"',[image]).length||validSession(req);if(!allowed)return res.sendStatus(404);res.set('Cache-Control','no-store');res.set('Cross-Origin-Resource-Policy','cross-origin');res.sendFile(path.join(dataDir,'uploads',req.params.name))});
const sessions=new Map();function validSession(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vl_session='))?.slice(11);const session=sessions.get(token);if(!session||session.expires<Date.now()||session.lastSeen<Date.now()-30*60000){sessions.delete(token);return false}session.lastSeen=Date.now();return true}
function auth(req,res,next){if(!validSession(req))return res.status(401).json({error:'Inicia sesión para continuar.'});next()}
function equal(a,b){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right)}
const cookieOptions={httpOnly:true,sameSite:'strict',secure:production,path:'/'};
app.post('/api/admin/login',rateLimit({windowMs:15*60000,limit:8,standardHeaders:true,legacyHeaders:false,message:{error:'Demasiados intentos. Espera 15 minutos antes de volver a intentar.'}}),async(req,res,next)=>{
 try{
  if(!process.env.ADMIN_USER||!validPasswordHash(passwordHash))return res.status(503).json({error:'El acceso administrativo aún no está configurado en el servidor.'});
  const {username,password}=req.body;
  if(typeof username!=='string'||username.length>100||typeof password!=='string'||password.length>256)return res.status(401).json({error:'Credenciales incorrectas.'});
  const correctPassword=await verifyPassword(password,passwordHash);
  if(!equal(username,process.env.ADMIN_USER)||!correctPassword)return res.status(401).json({error:'Credenciales incorrectas.'});
  const previous=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vl_session='))?.slice(11);if(previous)sessions.delete(previous);
  for(const [key,session] of sessions)if(session.expires<Date.now()||session.lastSeen<Date.now()-30*60000)sessions.delete(key);
  const token=randomBytes(32).toString('hex');sessions.set(token,{expires:Date.now()+2*3600000,lastSeen:Date.now()});
  res.cookie('vl_session',token,{...cookieOptions,maxAge:2*3600000});res.json({ok:true});
 }catch(error){next(error)}
});
app.post('/api/admin/logout',auth,(req,res)=>{const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vl_session='))?.slice(11);sessions.delete(token);res.clearCookie('vl_session',cookieOptions);res.json({ok:true})});
app.get('/api/settings',(_req,res)=>res.json(query('SELECT content FROM settings WHERE id=1')[0]?JSON.parse(query('SELECT content FROM settings WHERE id=1')[0].content):{}));
app.get('/api/projects',(_req,res)=>res.json(getProjects()));
app.get('/api/reviews',(_req,res)=>{res.set('Cache-Control','no-store');res.json(query('SELECT * FROM reviews WHERE status="approved" ORDER BY id DESC'))});
app.post('/api/reviews',rateLimit({windowMs:3600000,limit:5,standardHeaders:true,legacyHeaders:false,message:{error:'Has enviado varias reseñas. Inténtalo de nuevo más tarde.'}}),upload.single('image'),(req,res,next)=>{try{const error=validateReview(req.body);if(error)return res.status(400).json({error});const image=storeImage(req.file);db.run('INSERT INTO reviews (name,rating,comment,image,created) VALUES (?,?,?,?,?)',[req.body.name?.trim()||'Anónimo',Number(req.body.rating),req.body.comment.trim(),image,new Date().toISOString()]);save();res.status(201).json({ok:true})}catch(e){next(e)}});
app.use('/api/admin',auth);
app.get('/api/admin/reviews',(_req,res)=>res.json(query('SELECT * FROM reviews ORDER BY id DESC')));
app.put('/api/admin/settings',(req,res)=>{const b=req.body;if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!/^56[0-9]{9}$/.test(b.whatsapp)||!/^9[0-9]{8}$/.test(b.phone)||typeof b.address!=='string'||!b.address.trim()||b.address.length>250||typeof b.about!=='string'||b.about.length>2000)return res.status(400).json({error:'Revisa los datos. WhatsApp: 56 y nueve dígitos. Teléfono: nueve dígitos.'});db.run('INSERT OR REPLACE INTO settings (id,content) VALUES (1,?)',[JSON.stringify({name:b.name,whatsapp:b.whatsapp,phone:b.phone,address:b.address,about:b.about})]);save();res.json({ok:true})});
app.get('/api/admin/content',(_req,res)=>res.json({projects:getProjects(),reviews:query('SELECT * FROM reviews ORDER BY id DESC')}));

const projectUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:40*1024*1024,files:8,fields:10}}).fields([{name:'media',maxCount:8},{name:'image',maxCount:1}]);
function validatedMedia(req){
  const files=[...(req.files?.media||[]),...(req.files?.image||[])];
  if(!files.length)throw new Error('Agrega al menos una imagen o video.');
  if(files.reduce((sum,f)=>sum+f.size,0)>120*1024*1024)throw new Error('La carga completa no puede superar 120 MB.');
  return files.map(file=>{const info=mediaType(file.buffer);if(!info)throw new Error('Formato no válido. Usa JPG, PNG, WebP, MP4 o WebM.');if(info.type==='image'&&file.size>5*1024*1024)throw new Error('Cada imagen puede pesar hasta 5 MB.');return {...info,file}});
}
function insertMedia(projectId,files){
  const count=query('SELECT MAX(position) AS position FROM project_media WHERE project_id=?',[projectId])[0]?.position??-1;
  files.forEach((entry,index)=>{const name=randomBytes(20).toString('hex')+'.'+entry.ext;fs.writeFileSync(path.join(dataDir,'uploads',name),entry.file.buffer);db.run('INSERT INTO project_media (project_id,type,src,alt,position) VALUES (?,?,?,?,?)',[projectId,entry.type,'/uploads/'+name,'',Number(count)+index+1])});syncCover(projectId);
}
app.post('/api/admin/projects',projectUpload,(req,res,next)=>{try{
  const error=validateProject(req.body);if(error)return res.status(400).json({error});const files=validatedMedia(req);
  db.run('BEGIN');try{db.run('INSERT INTO projects (title,category,description,image) VALUES (?,?,?,"")',[req.body.title.trim(),req.body.category||'',req.body.description?.trim()||'']);const id=query('SELECT last_insert_rowid() AS id')[0].id;insertMedia(id,files);db.run('COMMIT');save();res.status(201).json({ok:true,id})}catch(e){db.run('ROLLBACK');throw e}
}catch(e){next(e)}});
app.put('/api/admin/projects/:id',(req,res)=>{const error=validateProject(req.body);if(error||!Number.isSafeInteger(Number(req.body.position)))return res.status(400).json({error:error||'Orden inválido.'});if(!query('SELECT id FROM projects WHERE id=?',[Number(req.params.id)]).length)return res.status(404).json({error:'Proyecto no encontrado.'});db.run('UPDATE projects SET title=?,category=?,description=?,position=? WHERE id=?',[req.body.title.trim(),req.body.category||'',req.body.description?.trim()||'',Number(req.body.position),Number(req.params.id)]);save();res.json({ok:true})});
app.delete('/api/admin/projects/:id',(req,res)=>{db.run('DELETE FROM project_media WHERE project_id=?',[Number(req.params.id)]);db.run('DELETE FROM projects WHERE id=?',[Number(req.params.id)]);save();res.json({ok:true})});
app.post('/api/admin/projects/:id/media',projectUpload,(req,res,next)=>{try{const id=Number(req.params.id);if(!query('SELECT id FROM projects WHERE id=?',[id]).length)return res.status(404).json({error:'Proyecto no encontrado.'});const files=validatedMedia(req);db.run('BEGIN');try{insertMedia(id,files);db.run('COMMIT');save();res.status(201).json({ok:true})}catch(e){db.run('ROLLBACK');throw e}}catch(e){next(e)}});
app.put('/api/admin/projects/:id/media/order',(req,res)=>{const id=Number(req.params.id),all=query('SELECT id FROM project_media WHERE project_id=?',[id]).map(m=>m.id),ids=req.body.ids;if(!Array.isArray(ids)||ids.length!==all.length||new Set(ids).size!==all.length||ids.some(item=>!all.includes(item)))return res.status(400).json({error:'La lista debe incluir cada archivo del proyecto una sola vez.'});ids.forEach((item,index)=>db.run('UPDATE project_media SET position=? WHERE id=?',[index,item]));syncCover(id);save();res.json({ok:true})});
app.patch('/api/admin/media/:id',(req,res)=>{if(typeof req.body.alt!=='string'||req.body.alt.length>250)return res.status(400).json({error:'Descripción inválida (máximo 250 caracteres).'});db.run('UPDATE project_media SET alt=? WHERE id=?',[req.body.alt,Number(req.params.id)]);save();res.json({ok:true})});
app.post('/api/admin/media/:id/thumbnail',upload.single('image'),(req,res,next)=>{try{const media=query('SELECT * FROM project_media WHERE id=?',[Number(req.params.id)])[0];if(!media||media.type!=='video')return res.status(404).json({error:'Video no encontrado.'});if(!req.file)return res.status(400).json({error:'Selecciona una imagen.'});const thumbnail=storeImage(req.file);db.run('UPDATE project_media SET thumbnail=? WHERE id=?',[thumbnail,media.id]);syncCover(media.project_id);save();res.json({ok:true})}catch(e){next(e)}});
app.delete('/api/admin/media/:id',(req,res)=>{const media=query('SELECT * FROM project_media WHERE id=?',[Number(req.params.id)])[0];if(!media)return res.status(404).json({error:'Archivo no encontrado.'});if(query('SELECT id FROM project_media WHERE project_id=?',[media.project_id]).length<=1)return res.status(400).json({error:'Conserva al menos un archivo en el proyecto.'});db.run('DELETE FROM project_media WHERE id=?',[media.id]);syncCover(media.project_id);save();res.json({ok:true})});
app.patch('/api/admin/reviews/:id',(req,res)=>{if(!query('SELECT id FROM reviews WHERE id=?',[Number(req.params.id)]).length)return res.status(404).json({error:'Reseña no encontrada.'});if(req.body.response!==undefined&&(typeof req.body.response!=='string'||req.body.response.length>2000))return res.status(400).json({error:'Respuesta inválida.'});if(req.body.status!==undefined){if(!['approved','rejected','pending'].includes(req.body.status))return res.status(400).json({error:'Estado inválido.'});db.run('UPDATE reviews SET status=? WHERE id=?',[req.body.status,Number(req.params.id)])}if(req.body.response!==undefined){if(typeof req.body.response!=='string'||req.body.response.length>2000)return res.status(400).json({error:'Respuesta inválida.'});db.run('UPDATE reviews SET response=? WHERE id=?',[req.body.response,Number(req.params.id)])}save();res.json({ok:true})});
app.delete('/api/admin/reviews/:id',(req,res)=>{if(!query('SELECT id FROM reviews WHERE id=?',[Number(req.params.id)]).length)return res.status(404).json({error:'Reseña no encontrada.'});db.run('DELETE FROM reviews WHERE id=?',[Number(req.params.id)]);save();res.json({ok:true})});
app.use('/api',(_req,res)=>res.status(404).json({error:'Ruta no encontrada.'}));app.use(['/admin','/panel-resenas'],(_req,res,next)=>{res.set('X-Robots-Tag','noindex, nofollow, noarchive');res.set('Cache-Control','no-store');next()});app.use(express.static(path.join(root,'dist')));app.get('*',(_req,res)=>res.sendFile(path.join(root,'dist/index.html')));
app.use((err,_req,res,_next)=>{res.status(400).json({error:err instanceof multer.MulterError?'Archivo demasiado grande o formulario inválido.':err.message||'Solicitud inválida.'})});
app.listen(Number(process.env.PORT)||3001,process.env.HOST||(production?'0.0.0.0':'127.0.0.1'),()=>console.log('Servidor: http://127.0.0.1:'+(process.env.PORT||3001)));
