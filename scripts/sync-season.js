require('dotenv').config({quiet:true});
const {MongoClient}=require('mongodb');
const {createSeasonService}=require('../src/season');
const {ensureLocalMongo}=require('../src/local-mongo');
(async()=>{
  const uri=process.env.MONGODB_URI||'mongodb://127.0.0.1:27017';
  const stop=await ensureLocalMongo(uri);const client=new MongoClient(uri);let service;
  try{
    await client.connect();service=await createSeasonService({db:client.db(process.env.MONGODB_DB||'ice_atlas'),enabled:false});
    await service.sync();const result=await service.read();
    console.log(JSON.stringify({syncState:result.syncState,syncedAt:result.syncedAt,events:result.events.length,podiums:result.events.filter(e=>e.podium?.length===3).length,scoredPodiums:result.events.filter(e=>e.podium?.length===3&&e.podium.every(p=>typeof p.score==='number')).length,failedEvents:result.failedEvents},null,2));
  }finally{service?.stop();await client.close();await stop();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
