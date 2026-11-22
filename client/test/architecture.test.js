import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const src=fileURLToPath(new URL('../src/',import.meta.url));
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(path,e.name)):/\.[jt]sx?$/.test(e.name)?[resolve(path,e.name)]:[])}
test('общие модули и функциональные разделы не зависят от оболочки приложения',()=>{
  for(const file of files(src)){
    const name=relative(src,file);if(!name.startsWith('shared/')&&!name.startsWith('features/'))continue;
    for(const [,spec] of readFileSync(file,'utf8').matchAll(/(?:from\s*|import\s*\()?["'](\.{1,2}\/[^"']+)["']/g)){
      const target=relative(src,resolve(dirname(file),spec));
      assert.ok(!target.startsWith('app/'),`${name} -> ${target}`);
      if(name.startsWith('shared/'))assert.ok(!target.startsWith('features/'),`${name} -> ${target}`);
    }
  }
});
