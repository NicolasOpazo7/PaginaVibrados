import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const password=randomBytes(24).toString('hex');
const preview=process.argv.includes('--preview'),port=preview?3002:3003,origin=`http://127.0.0.1:${port}`;
const dataDir=path.resolve('.test-data',`run-${Date.now()}-${randomBytes(3).toString('hex')}`);
fs.mkdirSync(path.join(dataDir,'uploads'),{recursive:true});
const image=fs.readFileSync('public/logo.jpg'),video=fs.readFileSync('server/fixtures/test.webm');
// Start with the previous schema to test an actual legacy migration.
const SQL=await initSqlJs(),legacy=new SQL.Database();
const oldFile='/uploads/'+randomBytes(20).toString('hex')+'.jpg';
fs.writeFileSync(path.join(dataDir,oldFile.slice(1)),image);
legacy.run('CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,image TEXT NOT NULL,position INTEGER DEFAULT 0)');
legacy.run('INSERT INTO projects (title,category,description,image) VALUES (?,?,?,?)',['PRUEBA — proyecto anterior','Cierres perimetrales','Contenido aislado para comprobar compatibilidad.',oldFile]);
fs.writeFileSync(path.join(dataDir,'site.sqlite'),legacy.export());legacy.close();
let child,cookie;
async function start(){child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dataDir,ADMIN_USER:'test-admin',ADMIN_PASSWORD:password},stdio:'pipe'});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('Server exited '+code)))})}
async function stop(){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited}
async function request(url,options={}){return fetch(origin+'/api'+url,{...options,headers:{...(cookie?{cookie}:{}),...options.headers}})}
const json=body=>({headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function login(){const r=await request('/admin/login',{method:'POST',...json({username:'test-admin',password})});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0]}
async function getProjects(){return (await request('/projects')).json()}
async function review(index){const f=new FormData();f.set('name',`PRUEBA ${index} — datos de QA`);f.set('comment','Contenido de prueba técnica en un servidor aislado. No es una experiencia de cliente.');f.set('rating',String(index%2?5:4));f.set('consent','on');const r=await request('/reviews',{method:'POST',body:f});assert.equal(r.status,201)}
try{
  await start();assert.equal((await request('/admin/content')).status,401);
  assert.equal((await request('/admin/projects',{method:'POST'})).status,401);
  const migrated=(await getProjects())[0];assert.equal(migrated.media.length,1);assert.equal(migrated.media[0].src,oldFile);
  assert.equal((await fetch(origin+oldFile)).status,200);
  await login();
  await review(1);assert.equal((await(await request('/reviews')).json()).length,0);
  let reviews=(await(await request('/admin/content')).json()).reviews;
  assert.equal((await request(`/admin/reviews/${reviews[0].id}`,{method:'PATCH',...json({status:'approved'})})).status,200);
  assert.equal((await(await request('/reviews')).json()).length,1);
  const bad=new FormData();bad.set('title','No debe guardarse');bad.set('media',new Blob(['<svg onload="alert(1)"/>'],{type:'image/jpeg'}),'fake.jpg');
  assert.equal((await request('/admin/projects',{method:'POST',body:bad})).status,400);assert.equal((await getProjects()).length,1);
  const large=new FormData();large.set('title','Imagen demasiado grande');large.set('media',new Blob([image,new Uint8Array(5*1024*1024)],{type:'image/jpeg'}),'large.jpg');assert.equal((await request('/admin/projects',{method:'POST',body:large})).status,400);
  const form=new FormData();form.set('title','PRUEBA — fotos y video');form.set('description','Material técnico de prueba.');form.set('category','Parcelas y lotes');form.append('media',new Blob([image],{type:'image/jpeg'}),'photo.jpg');form.append('media',new Blob([video],{type:'video/webm'}),'test.webm');
  const created=await request('/admin/projects',{method:'POST',body:form});assert.equal(created.status,201);const id=(await created.json()).id;
  let project=(await getProjects()).find(p=>p.id===id);assert.deepEqual(project.media.map(m=>m.type),['image','video']);
  const videoMedia=project.media[1];const thumb=new FormData();thumb.set('image',new Blob([image],{type:'image/jpeg'}),'thumbnail.jpg');assert.equal((await request(`/admin/media/${videoMedia.id}/thumbnail`,{method:'POST',body:thumb})).status,200);
  assert.equal((await request(`/admin/media/${videoMedia.id}`,{method:'PATCH',...json({alt:'Video técnico de prueba'})})).status,200);
  assert.equal((await request(`/admin/projects/${id}/media/order`,{method:'PUT',...json({ids:[videoMedia.id,videoMedia.id]})})).status,400);
  assert.equal((await request(`/admin/projects/${id}/media/order`,{method:'PUT',...json({ids:project.media.map(m=>m.id).reverse()})})).status,200);
  project=(await getProjects()).find(p=>p.id===id);assert.equal(project.media[0].type,'video');assert.ok(project.media[0].thumbnail);
  const streamed=await fetch(origin+videoMedia.src,{headers:{Range:'bytes=0-99'}});assert.equal(streamed.status,206);assert.match(streamed.headers.get('content-type'),/video\/webm/);
  const update={title:project.title,description:'Descripción editada.',category:'',position:2};assert.equal((await request(`/admin/projects/${id}`,{method:'PUT',...json(update)})).status,200);
  const denied=await request(`/admin/projects/${id}`,{method:'PUT',...json(update),headers:{'Content-Type':'application/json',Origin:'https://invalid.example'}});assert.equal(denied.status,403);
  await stop();await start();cookie=undefined;assert.equal((await request('/admin/content')).status,401);await login();
  project=(await getProjects()).find(p=>p.id===id);assert.equal(project.media.length,2);assert.equal(project.media[0].type,'video');assert.equal((await(await request('/reviews')).json()).length,1);
  if(preview){
    for(let i=2;i<=4;i++)await review(i);
    reviews=(await(await request('/admin/content')).json()).reviews;
    for(const r of reviews)await request(`/admin/reviews/${r.id}`,{method:'PATCH',...json({status:'approved'})});
    console.log(`QA aislado: ${origin} (datos de prueba; no se modificó data/)`);
    process.on('SIGINT',()=>{child.kill();process.exit(0)});process.on('SIGTERM',()=>{child.kill();process.exit(0)});
    await new Promise(resolve=>child.once('exit',resolve));
  }else{
    const imageMedia=project.media.find(m=>m.type==='image');assert.equal((await request(`/admin/media/${imageMedia.id}`,{method:'DELETE'})).status,200);assert.equal((await request(`/admin/media/${videoMedia.id}`,{method:'DELETE'})).status,400);
    assert.equal((await request(`/admin/projects/${id}`,{method:'DELETE'})).status,200);assert.equal((await fetch(origin+videoMedia.src)).status,404);
    console.log('OK: migración, permisos, moderación, persistencia, carga múltiple, videos/Range, miniaturas, orden, validación y eliminación.');
  }
}finally{child?.kill()}
