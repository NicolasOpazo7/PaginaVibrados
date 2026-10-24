import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {hashPassword} from '../server/passwords.js';

if(!process.stdin.isTTY){console.error('Ejecuta este comando en una terminal interactiva. No pases la contraseña como argumento.');process.exit(1)}
let muted=false;
const output=new Writable({write(chunk,_encoding,done){if(!muted)process.stdout.write(chunk);done()}});
const terminal=createInterface({input:process.stdin,output,terminal:true});
try{
  process.stdout.write('Nueva contraseña (16–256 caracteres; no se muestra): ');muted=true;
  const password=await terminal.question('');muted=false;
  process.stdout.write('\nConfirma la contraseña: ');muted=true;
  const confirmation=await terminal.question('');muted=false;
  process.stdout.write('\n');
  if(password!==confirmation)throw new Error('Las contraseñas no coinciden.');
  const hash=await hashPassword(password);
  console.log('\nGuarda este valor únicamente en las variables privadas del servidor:\n');
  console.log('ADMIN_PASSWORD_HASH='+hash);
}catch(error){muted=false;console.error('\n'+error.message);process.exitCode=1}finally{terminal.close()}
