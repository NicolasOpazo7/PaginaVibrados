import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const options={N:131072,r:8,p:1,maxmem:256*1024*1024};
export async function hashPassword(password){
  if(typeof password!=='string'||password.length<16||password.length>256)throw new Error('Usa una contraseña de entre 16 y 256 caracteres.');
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,32,options);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export function validPasswordHash(value){return /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value||'')}
export async function verifyPassword(password,hash){
  if(!validPasswordHash(hash)||typeof password!=='string'||password.length>256)return false;
  const [,salt,key]=hash.split('$');
  const candidate=await derive(password,salt,32,options);
  return timingSafeEqual(candidate,Buffer.from(key,'hex'));
}
