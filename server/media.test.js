import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mediaType,validateProject} from './validation.js';
test('Detecta imágenes y video WebM por contenido, no por nombre',()=>{assert.deepEqual(mediaType(fs.readFileSync('server/fixtures/test.webm')),{type:'video',ext:'webm'});assert.equal(mediaType(fs.readFileSync('public/logo.jpg')).type,'image');for(const file of ['<svg/>','<script>alert(1)</script>','fake video.mp4'])assert.equal(mediaType(Buffer.from(file)),null)});
test('Valida MP4 y rechaza contenedores incompatibles',()=>{const b=Buffer.alloc(24);b.write('ftyp',4);b.write('isom',8);assert.deepEqual(mediaType(b),{type:'video',ext:'mp4'});b.write('qt  ',8);assert.equal(mediaType(b),null)});
test('Permite categoría y descripción opcionales; rechaza datos inválidos',()=>{assert.equal(validateProject({title:'Un cierre'}),null);assert.equal(validateProject({title:'Un cierre',category:'',description:''}),null);for(const b of [{title:''},{title:[]},{title:'Cierre',category:'Inventada'},{title:'Cierre',description:'x'.repeat(2001)}])assert.ok(validateProject(b))});
