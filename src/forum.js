const express=require('express');
const {ObjectId}=require('mongodb');
const {rateLimit}=require('express-rate-limit');
const seed=require('../data/forum-seed.json');
const CATEGORIES=['赛事讨论','选手交流','技术分析','自由交流'];
async function createForumRouter(db,currentUser){
 const router=express.Router(),posts=db.collection('posts');
 await posts.createIndex({createdAt:-1,_id:-1});
 // 固定编号仅补入示例，重启时保留已有正文和后续真实回复。
 await posts.bulkWrite(seed.map(post=>{
  const {_id,createdAt,comments,...fields}=post;
  return {updateOne:{filter:{_id:new ObjectId(_id)},update:{$setOnInsert:{...fields,createdAt:new Date(createdAt),comments:comments.map((comment,index)=>({...comment,_id:new ObjectId(),createdAt:new Date(new Date(createdAt).getTime()+(index+1)*600000)}))}},upsert:true}};
 }));
 const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
 const id=value=>/^[a-f0-9]{24}$/i.test(value)?new ObjectId(value):null;
 const limiter=rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'提交太频繁，请稍后再试。'}});
 async function requireUser(req,res,next){const user=await currentUser(req);if(!user)return res.status(401).json({message:'请先登录后再参与讨论。'});req.forumUser=user;next();}
 router.get('/access',async(req,res)=>{const user=await currentUser(req);res.json({canRead:true,canPost:Boolean(user),canReply:Boolean(user)});});
 router.get('/posts',async(req,res)=>{
  const category=req.query.category||'all';
  if(typeof category!=='string'||(category!=='all'&&!CATEGORIES.includes(category)))return res.status(400).json({message:'请选择有效分类。'});
  const page=Math.max(1,Math.min(10000,Number.parseInt(req.query.page,10)||1));
  const match=category==='all'?{}:category==='自由交流'?{$or:[{category},{category:{$exists:false}}]}:{category};
  const total=await posts.countDocuments(match);
  const rows=await posts.aggregate([{$match:match},{$sort:{createdAt:-1,_id:-1}},{$skip:(page-1)*20},{$limit:20},{$project:{title:1,author:1,createdAt:1,category:{$ifNull:['$category','自由交流']},commentCount:{$size:{$ifNull:['$comments',[]]}}}}]).toArray();
  res.json({posts:rows,total,page,pageSize:20});
 });
 router.post('/posts',requireUser,limiter,async(req,res)=>{
  const {title,content}=req.body||{},category=req.body?.category??'自由交流';
  if(!text(title,100)||!text(content,2000)||!CATEGORIES.includes(category))return res.status(400).json({message:'标题需为 1–100 字，正文需为 1–2000 字，并选择有效分类。'});
  const user=req.forumUser;
  const result=await posts.insertOne({title:title.trim(),content:content.trim(),category,authorId:user._id,author:user.nickname,createdAt:new Date(),comments:[]});
  res.status(201).json({id:result.insertedId.toString()});
 });
 router.get('/posts/:id',async(req,res)=>{
  const key=id(req.params.id);if(!key)return res.status(400).json({message:'帖子编号无效。'});
  const post=await posts.findOne({_id:key},{projection:{'comments.authorId':0}});
  if(!post)return res.status(404).json({message:'帖子不存在。'});
  const {authorId, ...publicPost} = post;
  const user = await currentUser(req);
  const isOwner = Boolean(user && authorId instanceof ObjectId && authorId.equals(user._id));
  res.json({post:{...publicPost,category:post.category||'自由交流',comments:post.comments||[],isOwner}});
 });
 router.delete('/posts/:id', requireUser, limiter, async (req, res) => {
  const key = id(req.params.id);
  if (!key) return res.status(400).json({message:'帖子编号无效。'});
  // Comments are embedded in the post, so the same write removes them.
  const result = await posts.deleteOne({_id:key, authorId:req.forumUser._id});
  if (result.deletedCount === 1) return res.json({deleted:true});
  const exists = await posts.findOne({_id:key}, {projection:{_id:1}});
  if (!exists) return res.status(404).json({message:'帖子不存在或已删除。'});
  res.status(403).json({message:'只有帖子作者可以删除这篇讨论。'});
 });
 router.post('/posts/:id/comments',requireUser,limiter,async(req,res)=>{
  const key=id(req.params.id);if(!key)return res.status(400).json({message:'帖子编号无效。'});
  if(!text(req.body?.content,1000))return res.status(400).json({message:'评论需为 1–1000 字。'});
  const user=req.forumUser,comment={_id:new ObjectId(),authorId:user._id,author:user.nickname,content:req.body.content.trim(),createdAt:new Date()};
  // 单次原子更新，多个用户同时评论也不会覆盖彼此。
  const result=await posts.updateOne({_id:key},{$push:{comments:comment}});
  if(!result.matchedCount)return res.status(404).json({message:'帖子不存在。'});
  res.status(201).json({id:comment._id.toString()});
 });
 return router;
}
module.exports={createForumRouter};
