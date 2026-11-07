const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {MongoClient}=require('mongodb');
const {createApplication}=require('../src/app');
const {ensureLocalMongo}=require('../src/local-mongo');
const seed=require('../data/forum-seed.json');

test('论坛完整流程：真实 MongoDB、权限、评论并发与重建服务持久化',{timeout:60000},async()=>{
 const uri='mongodb://127.0.0.1:27017',stop=await ensureLocalMongo(uri),client=new MongoClient(uri);
 const dbName=`ice_atlas_test_${Date.now()}_${process.pid}_forum`;let server,base,cookie='';
 const boot=async()=>{const {app}=await createApplication({client,dbName,secret:'forum-test-secret-at-least-thirty-two-characters',enableSeasonSync:false});server=app.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;};
 const request=async(url,{body,guest=false}={})=>{const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Ice-Atlas':'1',Origin:base,...(!guest&&cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(!guest&&r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};};
 try{
  await client.connect();await boot();
  assert.equal((await request('/api/forum/posts')).data.total,seed.length);
  for(const sample of seed){
   const category=(await request(`/api/forum/posts?category=${encodeURIComponent(sample.category)}`,{guest:true})).data;
   assert.ok(category.posts.some(post=>post._id===sample._id&&post.commentCount===sample.comments.length));
   const detail=(await request(`/api/forum/posts/${sample._id}`,{guest:true})).data.post;
   assert.equal(detail.content,sample.content);assert.equal(detail.comments[0].content,sample.comments[0].content);
  }
  assert.equal((await request('/api/forum/posts',{guest:true,body:{title:'游客',content:'不能写入'}})).status,401);
  assert.equal((await request('/api/forum/posts/000000000000000000000000/comments',{guest:true,body:{content:'不能写入'}})).status,401);
  const account={nickname:'论坛测试员',email:'forum@example.test',password:'Forum-test-2026!'};
  assert.equal((await request('/api/auth/register',{body:account})).status,201);
  await request('/api/auth/logout',{body:{}});
  assert.equal((await request('/api/auth/login',{body:account})).status,200);
  assert.equal((await request('/api/forum/posts',{body:{title:' ',content:'正文',category:'自由交流'}})).status,400);
  assert.equal((await request('/api/forum/posts',{body:{title:'标题',content:{'$gt':''},category:'自由交流'}})).status,400);
  assert.equal((await request('/api/forum/posts',{body:{title:'标题',content:'正文',category:'非法分类'}})).status,400);
  const text='<script>alert(1)</script>\n技术讨论纯文本';
  const created=await request('/api/forum/posts',{body:{title:'跳跃识别讨论',content:text,category:'技术分析',author:'伪造作者'}});
  assert.equal(created.status,201);const id=created.data.id;
  const comments=await Promise.all(['第一条评论','第二条评论'].map(content=>request(`/api/forum/posts/${id}/comments`,{body:{content}})));
  assert.ok(comments.every(r=>r.status===201));
  const detail=(await request(`/api/forum/posts/${id}`,{guest:true})).data.post;
  assert.equal(detail.author,account.nickname);assert.equal(detail.content,text);assert.equal(detail.comments.length,2);
  assert.ok(!JSON.stringify(detail).includes('authorId'));assert.ok(!JSON.stringify(detail).includes(account.email));
  const list=(await request('/api/forum/posts?category=技术分析',{guest:true})).data;
  assert.equal(list.total,1+seed.filter(post=>post.category==='技术分析').length);
  const listed=list.posts.find(post=>post._id===id);assert.equal(listed.commentCount,2);assert.equal(listed.content,undefined);
  assert.equal((await request('/api/forum/posts?category=赛事讨论')).data.total,seed.filter(post=>post.category==='赛事讨论').length);
  assert.equal((await request('/api/forum/posts/not-an-id')).status,400);
  assert.equal((await request('/api/forum/posts/000000000000000000000000')).status,404);
  assert.equal((await request(`/api/forum/posts/${seed[0]._id}/comments`,{body:{content:'示例帖上的真实回复'}})).status,201);
  await new Promise(resolve=>server.close(resolve));await boot();
  assert.equal((await request('/api/forum/posts')).data.total,seed.length+1);
  const sampleAfterRestart=(await request(`/api/forum/posts/${seed[0]._id}`)).data.post;
  assert.equal(sampleAfterRestart.comments.length,seed[0].comments.length+1);
  assert.equal(sampleAfterRestart.comments.at(-1).content,'示例帖上的真实回复');
  const persisted=await request(`/api/forum/posts/${id}`,{guest:true});assert.equal(persisted.data.post.comments.length,2);assert.equal(persisted.data.post.content,text);
  assert.equal((await request('/api/auth/me')).data.user.nickname,account.nickname);
 }finally{
  if(server?.listening)await new Promise(resolve=>server.close(resolve));
  assert.match(dbName,/^ice_atlas_test_\d+_\d+_forum$/);await client.db(dbName).dropDatabase();await client.close();await stop();
 }
});
