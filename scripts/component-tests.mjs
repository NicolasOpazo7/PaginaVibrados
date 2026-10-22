import {build} from 'esbuild';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const result=await build({entryPoints:['tests/components.test.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',write:false});
fs.mkdirSync('.test-data',{recursive:true});const target=path.resolve('.test-data/components.test.mjs');fs.writeFileSync(target,result.outputFiles[0].contents);await import(pathToFileURL(target).href);
