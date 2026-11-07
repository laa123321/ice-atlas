require('dotenv').config({quiet:true});
const {MongoClient}=require('mongodb');
const {createRankingsService}=require('../src/rankings');
const {ensureLocalMongo}=require('../src/local-mongo');
(async()=>{const uri=process.env.MONGODB_URI||'mongodb://127.0.0.1:27017';const stop=await ensureLocalMongo(uri);const client=new MongoClient(uri);let service;
 try{await client.connect();service=await createRankingsService({db:client.db(process.env.MONGODB_DB||'ice_atlas'),enabled:false});await service.sync();for(const group of ['senior','junior']){const r=await service.read(group);console.log(JSON.stringify({group,state:r.syncState,rows:r.rows.length,officialUpdatedAt:r.officialUpdatedAt,syncedAt:r.syncedAt,first:r.rows[0]?.name,points:r.rows[0]?.points}));if(r.syncState!=='ok')process.exitCode=1;}}
 finally{service?.stop();await client.close();await stop();}})().catch(e=>{console.error(e.message);process.exitCode=1});
