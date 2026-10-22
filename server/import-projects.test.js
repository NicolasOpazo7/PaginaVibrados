import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import {importProvidedProjects} from './import-projects.js';
const catalog=JSON.parse(fs.readFileSync('content/projects.json','utf8'));

test('Importa medios reales una sola vez y respeta posteriores ediciones o eliminaciones',async()=>{
  const SQL=await initSqlJs(),db=new SQL.Database();
  db.run('CREATE TABLE projects (id INTEGER PRIMARY KEY,title TEXT,category TEXT,description TEXT,image TEXT,position INTEGER);CREATE TABLE project_media (id INTEGER PRIMARY KEY,project_id INTEGER,type TEXT,src TEXT,thumbnail TEXT,alt TEXT,position INTEGER)');
  assert.equal(importProvidedProjects(db,catalog),true);
  assert.equal(db.exec('SELECT COUNT(*) FROM projects')[0].values[0][0],3);
  assert.equal(db.exec('SELECT COUNT(*) FROM project_media WHERE type="video"')[0].values[0][0],2);
  db.run('DELETE FROM projects WHERE id=1');
  assert.equal(importProvidedProjects(db,catalog),false);
  assert.equal(db.exec('SELECT COUNT(*) FROM projects')[0].values[0][0],2);db.close();
});

test('Los medios del catálogo existen y el video móvil pesa menos de 1 MB',()=>{
  for(const p of catalog)for(const m of p.media){assert.ok(fs.existsSync('public'+m.src));if(m.thumbnail)assert.ok(fs.existsSync('public'+m.thumbnail))}
  const mobile=fs.statSync('public/media/hero-mobile.mp4').size,desktop=fs.statSync('public/media/hero-desktop.mp4').size;
  assert.ok(mobile<1000000);assert.ok(mobile<desktop);
});
