import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {hashPassword} from './passwords.js';

const password=randomBytes(24).toString('hex'),hash=await hashPassword(password);
const origin='http://127.0.0.1:3004',publicOrigin='https://nicolasopazo7.github.io';
const dataDir=path.resolve('.test-data',`reviews-${Date.now()}-${randomBytes(3).toString('hex')}`);
const image=fs.readFileSync('public/logo.jpg');let child,cookie='';
async function start(){
  child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3004',HOST:'127.0.0.1',DATA_DIR:dataDir,IMPORT_PROVIDED_MEDIA:'false',ADMIN_USER:'reviews-test',ADMIN_PASSWORD_HASH:hash,ADMIN_PASSWORD:'',PUBLIC_ORIGIN:publicOrigin,NODE_ENV:'production'},stdio:'pipe'});
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('Server exited '+code)))})
}
async function stop(){if(!child)return;const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;child=undefined}
const json=body=>({headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function request(url,options={}){return fetch(origin+url,{...options,headers:{...(cookie?{Cookie:cookie}:{}),...options.headers}})}
try{
  await start();
  assert.equal((await request('/api/admin/reviews')).status,401);
  assert.equal((await request('/panel-resenas')).headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
  const crossAdmin=await request('/api/admin/login',{method:'POST',...json({username:'reviews-test',password}),headers:{'Content-Type':'application/json',Origin:publicOrigin}});
  assert.equal(crossAdmin.status,403);
  const login=await request('/api/admin/login',{method:'POST',...json({username:'reviews-test',password})});
  assert.equal(login.status,200);const rawCookie=login.headers.get('set-cookie');
  assert.match(rawCookie,/HttpOnly/);assert.match(rawCookie,/Secure/);assert.match(rawCookie,/SameSite=Strict/);cookie=rawCookie.split(';')[0];
  const form=new FormData();form.set('name','');form.set('rating','5');form.set('comment','Reseña sintética para verificar la moderación.');form.set('consent','on');form.set('image',new Blob([image],{type:'image/jpeg'}),'test.jpg');
  const submitted=await fetch(origin+'/api/reviews',{method:'POST',body:form,headers:{Origin:publicOrigin}});
  assert.equal(submitted.status,201);assert.equal(submitted.headers.get('access-control-allow-origin'),publicOrigin);
  assert.deepEqual(await(await fetch(origin+'/api/reviews')).json(),[]);
  const list=await request('/api/admin/reviews');assert.equal(list.headers.get('cache-control'),'no-store');
  const [review]=await list.json();assert.equal(review.status,'pending');assert.equal(review.name,'Anónimo');
  assert.equal((await fetch(origin+review.image)).status,404);
  assert.equal((await request(review.image)).status,200);
  const blocked=await request(`/api/admin/reviews/${review.id}`,{method:'PATCH',...json({status:'approved'}),headers:{'Content-Type':'application/json',Origin:publicOrigin}});
  assert.equal(blocked.status,403);
  assert.equal((await fetch(origin+`/api/admin/reviews/${review.id}`,{method:'PATCH',...json({status:'approved'})})).status,401);
  const invalid=await request(`/api/admin/reviews/${review.id}`,{method:'PATCH',...json({status:'approved',response:123})});assert.equal(invalid.status,400);
  assert.equal((await(await fetch(origin+'/api/reviews')).json()).length,0);
  assert.equal((await request(`/api/admin/reviews/${review.id}`,{method:'PATCH',...json({status:'approved'})})).status,200);
  const publicList=await fetch(origin+'/api/reviews',{headers:{Origin:publicOrigin}});assert.equal(publicList.headers.get('access-control-allow-origin'),publicOrigin);
  assert.equal((await publicList.json()).length,1);
  const approvedImage=await fetch(origin+review.image);assert.equal(approvedImage.status,200);assert.equal(approvedImage.headers.get('cache-control'),'no-store');assert.equal(approvedImage.headers.get('cross-origin-resource-policy'),'cross-origin');
  await stop();await start();
  assert.equal((await request('/api/admin/reviews')).status,401);
  assert.equal((await(await fetch(origin+'/api/reviews')).json()).length,1);
  const again=await request('/api/admin/login',{method:'POST',...json({username:'reviews-test',password})});cookie=again.headers.get('set-cookie').split(';')[0];
  await request(`/api/admin/reviews/${review.id}`,{method:'PATCH',...json({status:'rejected'})});
  assert.equal((await(await fetch(origin+'/api/reviews')).json()).length,0);assert.equal((await fetch(origin+review.image)).status,404);
  assert.equal((await request(`/api/admin/reviews/${review.id}`,{method:'DELETE'})).status,200);
  assert.equal((await request(`/api/admin/reviews/${review.id}`,{method:'PATCH',...json({status:'approved'})})).status,404);
  assert.equal((await request('/api/admin/logout',{method:'POST'})).status,200);
  assert.equal((await request('/api/admin/reviews')).status,401);
  console.log('OK: login con hash, cookies seguras, acceso privado, CORS, reseña anónima con imagen, moderación, persistencia, rechazo y cierre de sesión.');
}finally{await stop()}
