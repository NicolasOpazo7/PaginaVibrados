import {test} from 'node:test';import assert from 'node:assert/strict';import {validateReview,isImage} from './validation.js';
const valid={name:'Cliente',rating:'5',comment:'Un comentario real de prueba.',consent:'on'};
test('Valida consentimiento, calificación y longitudes',()=>{assert.equal(validateReview(valid),null);for(const b of [{...valid,consent:''},{...valid,rating:'6'},{...valid,rating:'2.5'},{...valid,name:''},{...valid,comment:'corto'}])assert.ok(validateReview(b))});
test('Rechaza archivos ejecutables y SVG',()=>{assert.equal(isImage(Buffer.from('<svg onload="alert(1)"></svg>')),null);assert.equal(isImage(Buffer.from('MZ executable')),null);assert.equal(isImage(Buffer.from([255,216,255,224])), 'jpg')});
