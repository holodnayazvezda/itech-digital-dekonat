import { pipeline, env } from '@huggingface/transformers';
env.allowRemoteModels=false;
env.allowLocalModels=true;
env.localModelPath='/models/';
env.backends.onnx.wasm.wasmPaths='/onnx/';
env.backends.onnx.wasm.numThreads=1;
let extractor, indexKey='', vectors=[], latestId=0;
let queue=Promise.resolve();
async function search({id,query,documents}) {
  if(id!==latestId) return;
  try {
    extractor ||= pipeline('feature-extraction','multilingual-search',{dtype:'q8',device:'wasm'});
    const embed=await extractor;
    const key=JSON.stringify(documents);
    if(key!==indexKey) {
      const next=[];
      for(let i=0;i<documents.length;i+=8) {
        const batch=await embed(documents.slice(i,i+8).map(d=>d.text),{pooling:'mean',normalize:true});
        next.push(...batch.tolist());
      }
      vectors=next;indexKey=key;
    }
    if(id!==latestId) return;
    const [q]= (await embed(query,{pooling:'mean',normalize:true})).tolist();
    const scores=documents.map((d,i)=>({id:d.id,score:vectors[i].reduce((s,v,j)=>s+v*q[j],0)}));
    self.postMessage({id,scores});
  } catch(error) { console.error('Local search model:',error.message);extractor=null;self.postMessage({id,error:true}); }
}
self.onmessage=({data})=>{latestId=data.id;queue=queue.then(()=>search(data));};
