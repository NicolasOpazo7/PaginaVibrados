import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Supabase: las políticas protegen las reseñas e imágenes y solo el administrador puede moderar',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon, authenticated;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select,insert,delete on storage.objects to anon, authenticated;
    `);
    await db.exec(fs.readFileSync('supabase/reviews.sql','utf8'));
    await db.exec(fs.readFileSync('supabase/reviews.sql','utf8')); // Safe to reapply the setup.
    const admin='11111111-1111-4111-8111-111111111111',stranger='22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users(id) values ($1),($2)',[admin,stranger]);
    await db.query('insert into public.review_admins(user_id) values ($1)',[admin]);
    await db.exec('set role anon');
    await assert.rejects(db.query("insert into public.reviews(name,rating,comment,status) values ('Ataque',5,'No debe publicarse','approved')"));
    await assert.rejects(db.query("select * from public.submit_review('Prueba',5,'Descripción de prueba.',null,false)"),/autorización/);
    const {rows:[draft]}=await db.query("select * from public.submit_review('',5,'Descripción de una prueba técnica.','jpg',true)");
    assert.ok(draft.review_id);assert.ok(draft.upload_token);assert.match(draft.image_path,/\.jpg$/);
    assert.equal((await db.query('select id from public.reviews')).rows.length,0);
    await assert.rejects(db.query('select upload_token from public.reviews'));
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('review-images','inventado.jpg')"));
    await assert.rejects(db.query('select public.complete_review($1,$2)',[draft.review_id,admin]));
    await assert.rejects(db.query('select public.complete_review($1,$2)',[draft.review_id,draft.upload_token]));
    await db.query("insert into storage.objects(bucket_id,name) values ('review-images',$1)",[draft.image_path]);
    assert.equal((await db.query('select name from storage.objects')).rows.length,0);
    await db.query('select public.complete_review($1,$2)',[draft.review_id,draft.upload_token]);
    await assert.rejects(db.query('select public.complete_review($1,$2)',[draft.review_id,draft.upload_token]));
    await db.exec('reset role;set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[stranger]);
    assert.equal((await db.query('select id from public.reviews')).rows.length,0);
    assert.equal((await db.query("update public.reviews set status='approved' returning id")).rows.length,0);
    assert.equal((await db.query('select name from storage.objects')).rows.length,0);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
    assert.equal((await db.query('select status from public.reviews')).rows[0].status,'pending');
    assert.equal((await db.query('select name from storage.objects')).rows.length,1);
    await assert.rejects(db.query("update public.reviews set comment='No se permite reescribir al cliente'"));
    await db.query("update public.reviews set status='approved' where id=$1",[draft.review_id]);
    await db.exec("reset role;set role anon;select set_config('request.jwt.claim.sub','',false)");
    assert.equal((await db.query('select name from public.reviews')).rows[0].name,'Anónimo');
    assert.equal((await db.query('select name from storage.objects')).rows.length,1);
    await assert.rejects(db.query("update public.reviews set status='approved'"));
    await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
    await db.query("update public.reviews set status='rejected' where id=$1",[draft.review_id]);
    await db.exec("reset role;set role anon;select set_config('request.jwt.claim.sub','',false)");
    assert.equal((await db.query('select id from public.reviews')).rows.length,0);
    assert.equal((await db.query('select name from storage.objects')).rows.length,0);
    for(let i=0;i<4;i++)await db.query("select * from public.submit_review('Prueba',5,'Otra reseña sintética de prueba.',null,true)");
    await assert.rejects(db.query("select * from public.submit_review('Prueba',5,'Otra reseña sintética de prueba.',null,true)"),/temporalmente limitado/);
  }finally{await db.close()}
});
