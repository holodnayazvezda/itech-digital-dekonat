import { mkdir, copyFile, rename, rm } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const revision='2c4055b12046f11709e9df2c122e59ffbdc2f900';
const root='public/models/multilingual-search';
for(const file of ['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/model_quantized.onnx']) {
  const dest=`${root}/${file}`;
  if(existsSync(dest)) continue;
  await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});
  const response=await fetch(`https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/resolve/${revision}/${file}`);
  if(!response.ok) throw new Error(`${file}: ${response.status}`);
  try {
    await pipeline(Readable.fromWeb(response.body),createWriteStream(dest+'.part'));
    await rename(dest+'.part',dest);
  } catch(error) { await rm(dest+'.part',{force:true}); throw error; }
  console.log(`Installed ${file}`);
}
await mkdir('public/onnx',{recursive:true});
for(const file of ['ort-wasm-simd-threaded.asyncify.wasm','ort-wasm-simd-threaded.asyncify.mjs']) {
  await copyFile(`node_modules/onnxruntime-web/dist/${file}`,`public/onnx/${file}`);
}
