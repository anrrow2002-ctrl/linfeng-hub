import { createService } from './core.mjs';
const service=createService();
export const info={id:'linfeng-notes',name:'Linfeng Notes · 自动帖子推送',description:'按手帐关键词自动匹配公开帖子、解析正文并缓存，支持受限站点占位。'};
export async function init(router){
 router.get('/health',(_req,res)=>res.json({ok:true,version:'2.0.1'}));
 router.get('/feed',async(req,res)=>{
  const q=req.query||{};
  if(String(q.q||'').length>300||String(q.url||'').length>4096)return res.status(400).json({status:'placeholder',reason:'请求过长'});
  try{const result=await service.feed({site:String(q.site||'web'),query:String(q.q||''),title:String(q.title||''),seed:String(q.seed||''),url:q.url?String(q.url):'',exclude:typeof q.exclude==='string'?q.exclude.split('|'):[]});res.set('Cache-Control','no-store').json(result);}
  catch{res.status(503).json({status:'placeholder',reason:'自动推送暂时不可用'});}
 });
 console.info('[linfeng-notes] 自动帖子推送后端已加载');
}
export async function exit(){service.clear();}
