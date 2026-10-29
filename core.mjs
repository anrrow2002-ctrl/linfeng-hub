const SITES={
 xiaohongshu:{name:'小红书',hosts:['xiaohongshu.com','xhslink.com','xhslink.cn']},
 x:{name:'X',hosts:['x.com','twitter.com','t.co']},
 weibo:{name:'微博',hosts:['weibo.com','weibo.cn']},zhihu:{name:'知乎',hosts:['zhihu.com']},
 bilibili:{name:'B站',hosts:['bilibili.com','b23.tv']},youtube:{name:'YouTube',hosts:['youtube.com','youtu.be']},
 douban:{name:'豆瓣',hosts:['douban.com']},tieba:{name:'贴吧',hosts:['tieba.baidu.com']},
 douyin:{name:'抖音',hosts:['douyin.com','iesdouyin.com']},github:{name:'GitHub',hosts:['github.com']},
 pornhub:{name:'Pornhub',hosts:['pornhub.com']},web:{name:'网页',hosts:[]}
};
const INFRA=['html.duckduckgo.com','duckduckgo.com','www.bing.com','cn.bing.com','publish.twitter.com','cdn.syndication.twimg.com','api.bilibili.com'];
const ALLOWED=[...new Set(Object.values(SITES).flatMap(s=>s.hosts).concat(INFRA))];
export function publicURL(value) {
 try { const u=new URL(value),h=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&h.includes('.')&&!h.endsWith('.')&&!h.includes(':')&&!/^\d+(?:\.\d+){3}$/.test(h)&&!/(^|\.)(localhost|local|internal|test|invalid)$/.test(h); } catch { return false; }
}
export function allowed(value, publicWeb=false){try{const u=new URL(value);return publicURL(value)&&(publicWeb||ALLOWED.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)));}catch{return false;}}
function mixSeed(value){let n=2166136261;for(let i=0;i<value.length;i++)n=Math.imul(n^value.charCodeAt(i),16777619);return n>>>0;}
function decode64(value){try{return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));}catch{return '';}}
function combinedSignal(signals){if(AbortSignal.any)return AbortSignal.any(signals);const ctl=new AbortController();for(const s of signals){if(s.aborted){ctl.abort();break;}s.addEventListener('abort',()=>ctl.abort(),{once:true});}return ctl.signal;}
function deadline(ms){if(AbortSignal.timeout)return AbortSignal.timeout(ms);const ctl=new AbortController();setTimeout(()=>ctl.abort(),ms);return ctl.signal;}
export function failureReason(code){return ({native_unavailable:'当前酒馆没有可用的网页读取接口，请更新酒馆后重试。',session_required:'酒馆登录或请求校验未通过，请重新登录酒馆后刷新。',native_response:'酒馆联网接口返回了异常页面，请查看扩展中的连接检查。',transport_disabled:'自动推送扩展已关闭，请启用后刷新。',search_blocked:'搜索来源暂时要求验证，稍后会再翻找。',network_error:'联网请求未成功，请检查运行酒馆的服务器网络。',timeout:'这次翻找超时了，可以稍后再翻一条。',no_matches:'没有匹配到这条记录的公开内容。',source_unreadable:'找到了相关链接，但原站暂时没有提供可读取的正文。',empty_query:'这条记录缺少搜索关键词。',cancelled:'本次翻找已停止。',queue_full:'翻找请求较多，稍后再试。'})[code]||'暂时没有取得可展示的公开内容。';}
export function sourceSite(value){try{const h=new URL(value).hostname;return Object.keys(SITES).find(k=>SITES[k].hosts.some(d=>h===d||h.endsWith('.'+d)))||'web';}catch{return'web';}}
export function htmlText(value){return String(value||'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(br|\/p|\/div|\/li)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&#(x[\da-f]+|\d+);/gi,(_,c)=>{try{return String.fromCodePoint(c[0].toLowerCase()==='x'?parseInt(c.slice(1),16):+c)}catch{return''}}).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,c)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[c])).replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();}
function meta(html,key){for(const tag of html.matchAll(/<meta\s[^>]*>/gi)){const a={};for(const m of tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs))a[m[1].toLowerCase()]=m[3];if(a.property===key||a.name===key)return htmlText(a.content);}return'';}
function state(html,key){let pos=html.indexOf(key);if(pos<0)return null;pos=html.indexOf('=',pos+key.length)+1;let start=-1,depth=0,quote=false,escape=false,end=-1;for(let i=pos;i<html.length;i++){const c=html[i];if(start<0){if(c==='{'||c==='['){start=i;depth=1;}else if(!/[\s=]/.test(c))return null;continue;}if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}if(c==='"')quote=true;else if(c==='{'||c==='[')depth++;else if((c==='}'||c===']')&&!--depth){end=i+1;break;}}if(start<0||end<0)return null;const raw=html.slice(start,end);let cleaned='';quote=false;escape=false;for(let i=0;i<raw.length;i++){const c=raw[i];if(quote){cleaned+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}if(c==='"'){quote=true;cleaned+=c;continue;}const bad=raw.slice(i).match(/^(undefined|NaN|Infinity)(?=\s*[,}\]])/);if(bad){cleaned+='null';i+=bad[0].length-1;}else cleaned+=c;}try{return JSON.parse(cleaned);}catch{return null;}}
export function specific(url,site){try{const u=new URL(url);if(sourceSite(url)!==site||/^\/?$/.test(u.pathname)||/\/(search|search_result|results)(\/|$)/.test(u.pathname))return false;if(site==='xiaohongshu')return /\/(explore|discovery\/item)\/[a-z0-9]+/i.test(u.pathname)||/xhslink\.(cn|com)$/.test(u.hostname);if(site==='bilibili')return /\/video\/(BV[0-9a-z]+|av\d+)/i.test(u.pathname)||u.hostname==='b23.tv';if(site==='youtube')return /^[\w-]{11}$/.test(u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()||'');if(site==='pornhub')return /^[a-z0-9]{6,32}$/i.test(u.searchParams.get('viewkey')||(u.pathname.match(/^\/embed\/([a-z0-9]+)/i)||[])[1]||'');if(site==='douyin')return /\/(video|share\/video)\/\d+/.test(u.pathname)||u.hostname==='v.douyin.com';if(site==='tieba')return /\/p\/\d+/.test(u.pathname);if(site==='douban')return /\/(note|review|subject|status|group\/topic)\/\d+/.test(u.pathname);if(site==='github')return /^\/[^/]+\/[^/]+\/(issues|pull|discussions)\/\d+/.test(u.pathname);if(site==='x')return /\/status\/\d+/.test(u.pathname);if(site==='weibo')return /\/(detail|status)\/[a-z0-9]+|^\/\d+\/[a-z0-9]+/i.test(u.pathname);if(site==='zhihu')return /\/(question|answer|p)\/\d+/.test(u.pathname);return true;}catch{return false;}}
function pack(site,url,title,author,body,images=[],summary=false){const text=htmlText(body);if((text.length<8&&!images.some(v=>typeof v==='string'&&v.startsWith('https://')))||/^(扫码登录|请先登录|安全验证|访问受限|访问异常|登录后查看)/.test(text))return null;return{site:SITES[site]?.name||site,provider:site,url,title:htmlText(title||SITES[site]?.name+'帖子').slice(0,160),author:htmlText(author).slice(0,80),text:text.slice(0,12000),images:[...new Set(images.filter(v=>typeof v==='string'&&/^https:\/\//.test(v)))].slice(0,6),summary};}
export function parsePost(body,site,url){let data;try{data=JSON.parse(body);}catch{}let d=data?.data||data;
 if(site==='x'&&d?.text){return pack(site,url,'X 帖子',d.user?.name||d.user?.screen_name,d.text,(d.photos||[]).map(p=>p.url).concat((d.mediaDetails||[]).map(p=>p.media_url_https)));}
 if(site==='x'&&d?.html){return pack(site,url,'X 帖子',d.author_name,d.html,[],false);}
 if(site==='weibo'){d=d?.status||d;const text=d?.longText?.longTextContent||d?.longTextContent||d?.text_raw||d?.text;if(text)return pack(site,url,'微博正文',d.user?.screen_name,text,(d.pics||[]).map(p=>p.large?.url||p.url),!!d.isLongText&&!d.longText);const r=state(body,'$render_data');if(r?.[0]?.status)return parsePost(JSON.stringify(r[0].status),site,url);}
 if(site==='zhihu'&&(d?.content||d?.detail))return pack(site,url,d.title||d.question?.title,d.author?.name,d.content||d.detail);
 if(site==='xiaohongshu'){const raw=state(body,'window.__INITIAL_STATE__'),map=raw?.note?.noteDetailMap;if(map){const id=(url.match(/\/(?:explore|discovery\/item)\/([a-z0-9]+)/i)||[])[1];const item=id?map[id]:map[Object.keys(map)[0]],note=item?.note||item;if(note?.desc)return pack(site,url,note.title,note.user?.nickname,note.desc,(note.imageList||[]).map(p=>p.urlDefault||p.url||p.infoList?.[0]?.url));}}
 if(/<title[^>]*>[^<]*(安全验证|访问异常|登录|Login)/i.test(body))return null;
 for(const m of body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const j=JSON.parse(m[1]),arr=Array.isArray(j)?j:j['@graph']||[j];for(const a of arr){if(!/Article|Posting|VideoObject/.test(String(a['@type'])))continue;const author=Array.isArray(a.author)?a.author[0]:a.author,images=Array.isArray(a.image)?a.image:[a.image];const p=pack(site,url,a.headline||a.name,typeof author==='string'?author:author?.name,a.articleBody||a.text||a.description,images.map(v=>typeof v==='string'?v:v?.url),!a.articleBody&&!a.text);if(p)return p;}}catch{}}
 const description=meta(body,'og:description')||meta(body,'description');if(/上知乎.*发现|发现生活|小红书.*生活方式|登录后|扫码登录|安全验证|访问受限/.test(description))return null;
 return pack(site,url,meta(body,'og:title')||(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1],meta(body,'author'),description,[meta(body,'og:image')],true);
}
function decodeBing(url){try{const u=new URL(htmlText(url),'https://html.duckduckgo.com');if((u.hostname==='duckduckgo.com'||u.hostname==='html.duckduckgo.com')&&u.searchParams.get('uddg'))return u.searchParams.get('uddg');if(u.hostname.endsWith('bing.com')&&u.pathname==='/ck/a'){const raw=u.searchParams.get('u');if(raw?.startsWith('a1'))return decode64(raw.slice(2));}return u.href;}catch{return'';}}
export function searchResults(body,site,{publicWeb=false}={}){const found=[],seen=new Set();function add(url,title,description=''){url=decodeBing(url);let host='';try{host=new URL(url).hostname}catch{return;}if(INFRA.includes(host)||/(^|\.)(bing\.com|duckduckgo\.com|google\.com)$/.test(host)||['www.baidu.com','m.baidu.com','baidu.com'].includes(host))return;const provider=sourceSite(url);if(!allowed(url,publicWeb)||provider==='web'&&!publicWeb||site!=='web'&&provider!==site||site==='web'&&provider==='pornhub'||!specific(url,provider)||seen.has(url))return;title=htmlText(title);if(title.length<3)return;seen.add(url);found.push({url,title,description:htmlText(description),provider});}
 for(const item of body.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const val=tag=>(item[1].match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i'))||[])[1]||'';add(val('link').replace(/<!\[CDATA\[|\]\]>/g,''),val('title').replace(/<!\[CDATA\[|\]\]>/g,''),val('description'));}
 for(const block of body.matchAll(/<(?:div|li)\b[^>]*class=["'][^"']*(?:\bresult\b|\bb_algo\b)[^"']*["'][^>]*>([\s\S]*?)(?=<(?:div|li)\b[^>]*class=["'][^"']*(?:\bresult\b|\bb_algo\b)|$)/gi)){
  const title=(block[1].match(/<a\b(?=[^>]*class=["'][^"']*result__a[^"']*["'])[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)||block[1].match(/<h2[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i));
  const desc=(block[1].match(/<(?:a|div|span)\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i)||block[1].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)||[])[1];if(title)add(title[1],title[2],desc||'');
 }
 for(const a of body.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi))add(a[2],a[3]);return found.slice(0,16);
}
function terms(query){return [...new Set([...new Intl.Segmenter('zh',{granularity:'word'}).segment(query.toLowerCase())].filter(p=>p.isWordLike&&p.segment.length>1).map(p=>p.segment))].slice(0,20);}
export function rankCandidates(items,query,seed=''){const ts=terms(query);return items.map(v=>({...v,score:ts.reduce((n,t)=>n+(v.title.toLowerCase().includes(t)?5:0)+(v.description.toLowerCase().includes(t)?1:0),0),mix:mixSeed(seed+v.url)})).filter(v=>!ts.length||v.score>0).sort((a,b)=>b.score-a.score||a.mix-b.mix);}
export function createService({fetcher=fetch,timeout=24000,now=Date.now,publicWeb=false}={}){
 const cache=new Map(),inflight=new Map();let running=0;const queue=[];
 async function slot(fn){if(running>=2){if(queue.length>=32)throw Error('busy');await new Promise(resolve=>queue.push(resolve));}running++;try{return await fn();}finally{running--;queue.shift()?.();}}
 async function resource(url,signal,budget=8000,trace=[],stage='source'){
  const host=(()=>{try{return new URL(url).hostname}catch{return ''}})();
  try {for(let n=0;n<5;n++){
   if(!allowed(url,publicWeb))throw Object.assign(Error('source_not_allowed'),{code:'source_not_allowed'});
   const res=await fetcher(url,{signal:combinedSignal([signal,deadline(budget)]),redirect:'manual',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/json,application/rss+xml'}});
   if(res.status>=300&&res.status<400){const location=res.headers.get('location');if(!location)throw Error('redirect');url=new URL(location,url).href;continue;}
   if(!res.ok)throw Object.assign(Error('HTTP '+res.status),{code:'upstream_http',status:res.status});
   if(/\/(login|signin|passport)(\/|\?|$)/i.test(new URL(url).pathname))throw Object.assign(Error('login_required'),{code:'login_required'});
   if(Number(res.headers.get('content-length'))>4000000)throw Error('body_too_large');const body=await res.text();if(body.length>4000000)throw Error('body_too_large');
   if(stage==='search'&&/id=["']challenge-form|class=["'][^"']*anomaly-modal|<title[^>]*>[^<]*(?:安全验证|captcha|Just a moment)|verify you are human|请输入验证码/i.test(body))throw Object.assign(Error('search_blocked'),{code:'search_blocked'});
   return {body,url};
  }throw Error('too_many_redirects');}
  catch(e){trace.push({stage,host,code:typeof e.code==='string'?e.code:/Abort|Timeout/.test(e.name)?'timeout':'network_error',...(e.status?{status:e.status}:{})});throw e;}
 }
 async function resolve(url,site,signal,trace=[]){const u=new URL(url);let api=[];
  if(site==='x'){const id=(u.pathname.match(/\/status\/(\d+)/)||[])[1];if(id){const token=((Number(id)/1e15)*Math.PI).toString(36).replace(/(0+|\.)/g,'');api.push('https://cdn.syndication.twimg.com/tweet-result?id='+id+'&lang=zh&token='+token,'https://publish.twitter.com/oembed?url='+encodeURIComponent('https://twitter.com/i/status/'+id)+'&omit_script=true&dnt=true');}}
  if(site==='weibo'){const id=(u.pathname.match(/\/(?:status|detail)\/([a-z0-9]+)/i)||u.pathname.match(/^\/\d+\/([a-z0-9]+)/i)||[])[1];if(id)api.push('https://m.weibo.cn/statuses/show?id='+id);}
  if(site==='zhihu'){const answer=u.pathname.match(/\/answer\/(\d+)/),article=u.pathname.match(/\/p\/(\d+)/),question=u.pathname.match(/\/question\/(\d+)/);if(answer)api.push('https://www.zhihu.com/api/v4/answers/'+answer[1]+'?include=content,author,question');else if(article)api.push('https://www.zhihu.com/api/v4/articles/'+article[1]+'?include=content,author');else if(question)api.push('https://www.zhihu.com/api/v4/questions/'+question[1]+'?include=detail');}
  if(site==='youtube'){const id=u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop();if(/^[\w-]{11}$/.test(id)){try{const r=await resource('https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id)+'&format=json',signal,8000,trace),j=JSON.parse(r.body);if(j.title)return{site:'YouTube',provider:site,url:'https://www.youtube.com/watch?v='+id,title:j.title,author:j.author_name||'',text:'',images:[],kind:'video',embed:'https://www.youtube.com/embed/'+id};}catch(e){if(signal.aborted)throw e;}}}
  if(site==='bilibili'){const id=(u.pathname.match(/\/(BV[\da-z]+)/i)||[])[1];if(id){try{const r=await resource('https://api.bilibili.com/x/web-interface/view?bvid='+id,signal,8000,trace),j=JSON.parse(r.body);if(j.code===0&&j.data?.title)return{site:'B站',provider:site,url:'https://www.bilibili.com/video/'+id,title:j.data.title,author:j.data.owner?.name||'',text:j.data.desc||'',images:j.data.pic?[j.data.pic]:[],kind:'video',embed:'https://player.bilibili.com/player.html?bvid='+id+'&autoplay=0'};}catch(e){if(signal.aborted)throw e;}}}
  api.push(url);for(const target of api){try{const r=await resource(target,signal,8000,trace),post=parsePost(r.body,site,r.url===target?url:r.url);if(!post)trace.push({stage:'source',host:new URL(target).hostname,code:'unreadable'});if(post){if(site==='pornhub'&&specific(post.url,site)){const id=new URL(post.url).searchParams.get('viewkey')||(new URL(post.url).pathname.match(/^\/embed\/([a-z0-9]+)/i)||[])[1];post.kind='video';post.embed='https://www.pornhub.com/embed/'+id;}return post;}}catch(e){if(signal.aborted)throw e;}}
  return null;
 }
 async function run(input){
  const site=Object.hasOwn(SITES,input.site)?input.site:'web',q=String(input.query||input.title||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,100),seed=String(input.seed||'').slice(0,120),exclude=new Set((input.exclude||[]).slice(0,30));
  const key=JSON.stringify([site,q,seed,input.url||'',[...exclude].sort()]);const old=cache.get(key);if(old&&old.until>now())return old.value;if(inflight.has(key))return inflight.get(key);
  const work=slot(async()=>{
   const controller=new AbortController(),abort=()=>controller.abort(),trace=[];let searched=0,matched=0,read=0;
   let post=null,candidates=[];
   input.signal?.addEventListener('abort',abort,{once:true});if(input.signal?.aborted)controller.abort();const timer=setTimeout(abort,timeout);
   try{
    if(input.url&&allowed(input.url,publicWeb)&&specific(input.url,sourceSite(input.url))){read++;post=await resolve(input.url,sourceSite(input.url),controller.signal,trace);}
    else if(q){
     if(site==='pornhub'){try{const r=await resource('https://www.pornhub.com/webmasters/search?search='+encodeURIComponent(q)+'&page=1',controller.signal,8000,trace),j=JSON.parse(r.body),video=(j.videos||[]).find(v=>/^[\da-z]{6,32}$/i.test(v.video_id)&&!exclude.has('https://www.pornhub.com/view_video.php?viewkey='+v.video_id));if(video)post={site:'Pornhub',provider:site,url:'https://www.pornhub.com/view_video.php?viewkey='+video.video_id,title:video.title,author:'',text:'',images:[],kind:'video',embed:'https://www.pornhub.com/embed/'+video.video_id};}catch{}}
     const domain=site==='web'?'':SITES[site].hosts[0];
     const query=(domain?'site:'+domain+' ':'')+q;
     if(!post){
      const urls=['https://www.bing.com/search?q='+encodeURIComponent(query),'https://html.duckduckgo.com/html/?q='+encodeURIComponent(query)];searched+=urls.length;
      const pages=await Promise.allSettled(urls.map(url=>resource(url,controller.signal,6000,trace,'search')));
      const fatal=trace.find(e=>['native_unavailable','session_required','native_response','transport_disabled'].includes(e.code));if(fatal)throw Object.assign(Error(fatal.code),{code:fatal.code});
      let found=pages.flatMap(r=>r.status==='fulfilled'?searchResults(r.value.body,site,{publicWeb}):[]);
      if(!found.length&&!controller.signal.aborted){searched++;try{const r=await resource('https://www.bing.com/search?q='+encodeURIComponent(query)+'&format=rss',controller.signal,6000,trace,'search');found=searchResults(r.body,site,{publicWeb});}catch{}}
      candidates=rankCandidates([...new Map(found.map(v=>[v.url,v])).values()],q+' '+String(input.title||''),seed).filter(v=>!exclude.has(v.url));
      if(!candidates.length&&input.title&&String(input.title).trim()!==q&&!controller.signal.aborted){
       searched++;const alternate=(domain?'site:'+domain+' ':'')+String(input.title).trim().slice(0,100);
       try{const page=await resource('https://www.bing.com/search?format=rss&q='+encodeURIComponent(alternate),controller.signal,6000,trace,'search');candidates=rankCandidates(searchResults(page.body,site,{publicWeb}),q+' '+input.title,seed).filter(v=>!exclude.has(v.url));}catch{}
      }
      matched=candidates.length;
     }
     for(const candidate of candidates.slice(0,4)){read++;post=await resolve(candidate.url,candidate.provider,controller.signal,trace);if(post)break;}
     if(!post){const excerpt=candidates.find(v=>htmlText(v.description).length>=30);if(excerpt){post=pack(excerpt.provider,excerpt.url,excerpt.title,'',excerpt.description,[],true);if(post)post.retrieval='search-index';}}
    }
    let code=!q&&!input.url?'empty_query':read?'source_unreadable':'no_matches';
    if(!post&&!matched&&trace.some(e=>e.stage==='search'))code=trace.some(e=>e.code==='search_blocked')?'search_blocked':'network_error';
    const result=post?{status:'ready',post,matchedBy:input.url?'source-link':'keyword-search'}:{status:['network_error','search_blocked'].includes(code)?'error':'placeholder',site:SITES[site].name,code,reason:failureReason(code)};
    result.diagnostics={searched,matched,read,errors:trace.slice(-12)};
    if(result.status!=='error')cache.set(key,{value:result,until:now()+(post?15*60*1000:15000)});if(cache.size>500)cache.delete(cache.keys().next().value);return result;
   }catch(e){const excerpt=!input.signal?.aborted&&candidates.find(v=>htmlText(v.description).length>=30);if(excerpt){const summary=pack(excerpt.provider,excerpt.url,excerpt.title,'',excerpt.description,[],true);if(summary){summary.retrieval='search-index';return{status:'ready',post:summary,matchedBy:'keyword-search',diagnostics:{searched,matched,read,errors:trace.slice(-12)}};}}const code=controller.signal.aborted?(input.signal?.aborted?'cancelled':'timeout'):e.code||'network_error';return{status:'error',site:SITES[site].name,code,reason:failureReason(code),diagnostics:{searched,matched,read,errors:trace.slice(-12)}};}
   finally{clearTimeout(timer);input.signal?.removeEventListener('abort',abort);}
  });
  inflight.set(key,work);try{return await work;}catch{return{status:'error',code:'queue_full',reason:failureReason('queue_full')};}finally{inflight.delete(key);}
 }

 return{feed:run,resolve:async url=>{if(!allowed(url,publicWeb))throw Error('source_not_allowed');const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{return await resolve(url,sourceSite(url),c.signal);}finally{clearTimeout(t);}},clear(){cache.clear();}};
}
export { SITES };
