import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,validPasswordHash,verifyPassword} from './passwords.js';

test('El administrador usa un hash con sal aleatoria y verifica la contraseña sin almacenarla',async()=>{
  const password='contraseña sintética de prueba 2026';
  const first=await hashPassword(password),second=await hashPassword(password);
  assert.notEqual(first,second);assert.ok(validPasswordHash(first));assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password,first),true);
  assert.equal(await verifyPassword('incorrecta',first),false);
  assert.equal(await verifyPassword(password,'hash inválido'),false);
  await assert.rejects(hashPassword('corta'));
});
