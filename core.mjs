const SITES={
 xiaohongshu:{name:'小红书',hosts:['xiaohongshu.com','xhslink.com','xhslink.cn']},
 x:{name:'X',hosts:['x.com','twitter.com','t.co']},
 weibo:{name:'微博',hosts:['weibo.com','weibo.cn']},zhihu:{name:'知乎',hosts:['zhihu.com']},
 bilibili:{name:'B站',hosts:['bilibili.com','b23.tv']},youtube:{name:'YouTube',hosts:['youtube.com','youtu.be']},
 douban:{name:'豆瓣',hosts:['douban.com']},tieba:{name:'贴吧',hosts:['tieba.baidu.com']},
 douyin:{name:'抖音',hosts:['douyin.com','iesdouyin.com']},github:{name:'GitHub',hosts:['github.com']},
 pornhub:{name:'Pornhub',hosts:['pornhub.com']},web:{name:'网页',hosts:[]}
};
const INFRA=['html.duckduckgo.com','duckduckgo.com','www.bing.com','cn.bing.com','www.sogou.com','publish.twitter.com','cdn.syndication.twimg.com','api.bilibili.com'];
const ALLOWED=[...new Set(Object.values(SITES).flatMap(s=>s.hosts).concat(INFRA))];
export function publicURL(value) {
 try { const u=new URL(value),h=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&h.includes('.')&&!h.endsWith('.')&&!h.includes(':')&&!/^\d+(?:\.\d+){3}$/.test(h)&&!/(^|\.)(localhost|local|internal|test|invalid)$/.test(h); } catch { return false; }
}
export function allowed(value, publicWeb=false){try{const u=new URL(value);return publicURL(value)&&(publicWeb||ALLOWED.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)));}catch{return false;}}
function mixSeed(value){let n=2166136261;for(let i=0;i<value.length;i++)n=Math.imul(n^value.charCodeAt(i),16777619);return n>>>0;}
function decode64(value){try{return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));}catch{return '';}}
function combinedSignal(signals){if(AbortSignal.any)return AbortSignal.any(signals);const ctl=new AbortController();for(const s of signals){if(s.aborted){ctl.abort();break;}s.addEventListener('abort',()=>ctl.abort(),{once:true});}return ctl.signal;}
function deadline(ms){if(AbortSignal.timeout)return AbortSignal.timeout(ms);const ctl=new AbortController();setTimeout(()=>ctl.abort(),ms);return ctl.signal;}
export function failureReason(code){return ({native_unavailable:'当前酒馆没有可用的网页读取接口，请更新酒馆后重试。',session_required:'酒馆登录或请求校验未通过，请重新登录酒馆后刷新。',native_response:'酒馆联网接口返回了异常页面，请查看扩展中的连接检查。',transport_disabled:'自动推送扩展已关闭，请启用后刷新。',search_blocked:'搜索来源暂时要求验证，稍后会再翻找。',network_error:'联网请求未成功，请检查运行酒馆的服务器网络。',timeout:'这次翻找超时了，可以稍后再翻一条。',no_matches:'没有匹配到这条记录的公开内容。',source_unreadable:'找到了相关链接，但原站暂时没有提供可读取的正文。',source_blocked:'找到了相关链接，但原站要求验证或登录，暂时无法展示正文。',empty_query:'这条记录缺少搜索关键词。',cancelled:'本次翻找已停止。',queue_full:'翻找请求较多，稍后再试。'})[code]||'暂时没有取得可展示的公开内容。';}
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
 if(challenge(body)||/<title[^>]*>[^<]*(安全验证|访问异常|登录|Login)/i.test(body))return null;
 for(const m of body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const j=JSON.parse(m[1]),arr=Array.isArray(j)?j:j['@graph']||[j];for(const a of arr){if(!/Article|Posting|VideoObject/.test(String(a['@type'])))continue;const author=Array.isArray(a.author)?a.author[0]:a.author,images=Array.isArray(a.image)?a.image:[a.image];const p=pack(site,url,a.headline||a.name,typeof author==='string'?author:author?.name,a.articleBody||a.text||a.description,images.map(v=>typeof v==='string'?v:v?.url),!a.articleBody&&!a.text);if(p)return p;}}catch{}}
 const article=(body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)||[])[1];
 if(article){const cleaned=article.replace(/<(nav|aside|form|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');if(htmlText(cleaned).length>=120)return pack(site,url,meta(body,'og:title')||(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1],meta(body,'author'),cleaned,[meta(body,'og:image')]);}
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
 // 搜狗把原帖地址放在每张可见结果末尾的元数据中。标题和摘要只读取同一结果的可见内容。
 let previous=0;
 for(const record of body.matchAll(/<div\b(?=[^>]*class=["'][^"']*\bresult_list\b[^"']*["'])[^>]*data-url=["']([^"']+)["'][^>]*>/gi)){
  const block=body.slice(Math.max(previous,record.index-20000),record.index),headings=[...block.matchAll(/<h3\b[^>]*class=["'][^"']*\bvr-title\b[^"']*["'][^>]*>[\s\S]*?<\/h3>/gi)],heading=headings.at(-1)?.[0];
  if(heading){const after=block.slice(block.lastIndexOf(heading)+heading.length),description=(after.match(/<(?:div|p)\b[^>]*class=["'][^"']*(?:\bfz-mid\b[^"']*\bspace-txt\b|\bstr_info\b|\bstr-text-info\b)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i)||[])[1]||'';add(record[1],heading,description);}
  previous=record.index+record[0].length;
 }
 for(const a of body.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi))add(a[2],a[3]);return found.slice(0,16);
}
export function isChineseText(value){
 const t=htmlText(value),han=(t.match(/[\u3400-\u9fff]/g)||[]).length,latin=(t.match(/[a-z]/gi)||[]).length,kana=(t.match(/[\u3040-\u30ff]/g)||[]).length,hangul=(t.match(/[\uac00-\ud7af]/g)||[]).length;
 return han>=2&&han/(han+latin+kana+hangul)>=.15&&kana<=han*.2&&hangul<=han*.2;
}
export function isChinesePost(post){const body=String(post?.text||'').trim();return isChineseText(body.length>=30?body:String(post?.title||'')+' '+body);}
export function preferredQuery(input){
 const keyword=String(input.query||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,100),title=String(input.title||'').trim().slice(0,100);
 if(isChineseText(keyword))return keyword;
 if(isChineseText(title))return title;
 return keyword||title;
}
function indexedSummary(candidates,chineseOnly=false){
 for(const item of candidates){if((item.platformSearch?htmlText(item.description).length<8&&!item.image:htmlText(item.description).length<30)||chineseOnly&&!isChineseText(item.platformSearch?item.title+' '+item.description:item.description))continue;const post=pack(item.provider,item.url,item.title,item.author||'',item.description,item.image?[item.image]:[],true);if(post){post.retrieval='search-index';if(item.platformSearch&&item.provider==='bilibili'){post.kind='video';post.embed=item.embed;}post.language=isChinesePost(post)?'zh':'foreign';return post;}}return null;
}
function challenge(body){return /id=["']challenge-form|class=["'][^"']*anomaly-modal|<title[^>]*>[^<]*(?:安全验证|验证码|captcha|Just a moment|Sina Visitor System|访问异常|搜狗搜索.*验证)|risk-captcha-app|id=[\"']seccodeForm|antispider\.min\.js|verify you are human|请输入验证码/i.test(body);}
function apiFailure(code){return [-412,-352,-403,403,412,20003].includes(Number(code))?'search_blocked':'upstream_error';}
function biliID(url){try{return new URL(url).pathname.match(/\/video\/(BV[\da-z]{10}|av\d+)(?:\/|$)/i)?.[1]||'';}catch{return '';}}
// 平台搜索返回的标题、简介和封面均来自真实结果，不补写正文。
export function bilibiliResults(body){
 let json;try{json=JSON.parse(body);}catch{return [];}
 if(json.code!==0||!Array.isArray(json.data?.result))return [];
 const found=[];
 const rows=json.data.result.flatMap(item=>item.result_type==='video'&&Array.isArray(item.data)?item.data:item.type==='video'||item.bvid||item.arcurl?[item]:[]);
 for(const item of rows){
  const id=/^BV[\da-z]{10}$/i.test(item.bvid||'')?item.bvid:biliID(String(item.arcurl||'').replace(/^http:/,'https:'));
  if(!id||!htmlText(item.title))continue;
  let image=String(item.pic||'');if(image.startsWith('//'))image='https:'+image;else image=image.replace(/^http:/,'https:');if(!publicURL(image))image='';
  found.push({url:'https://www.bilibili.com/video/'+id,title:htmlText(item.title),description:htmlText(item.description),provider:'bilibili',author:htmlText(item.author),image,platformSearch:true,embed:'https://player.bilibili.com/player.html?'+(/^BV/i.test(id)?'bvid=':'aid=')+id.replace(/^av/i,'')+'&autoplay=0'});
 }
 return found.slice(0,16);
}
function searchURL(query,rss=false,engine='bing'){
 const url=new URL(engine==='duck'?'https://html.duckduckgo.com/html/':'https://www.bing.com/search');url.searchParams.set('q',query);
 if(engine==='duck')url.searchParams.set('kl','cn-zh');else{url.searchParams.set('mkt','zh-CN');url.searchParams.set('setlang','zh-hans');url.searchParams.set('cc','cn');if(rss)url.searchParams.set('format','rss');}return url.href;
}
function terms(query){return [...new Set([...new Intl.Segmenter('zh',{granularity:'word'}).segment(query.toLowerCase())].filter(p=>p.isWordLike&&p.segment.length>1).map(p=>p.segment))].slice(0,20);}
export function rankCandidates(items,query,seed=''){
 const ts=terms(query);return items.map(v=>({...v,chinese:isChineseText(v.title+' '+v.description),score:ts.reduce((n,t)=>n+(v.title.toLowerCase().includes(t)?5:0)+(v.description.toLowerCase().includes(t)?1:0),0),mix:mixSeed(seed+v.url)})).filter(v=>!ts.length||v.score>0).sort((a,b)=>Number(b.chinese)-Number(a.chinese)||b.score-a.score||a.mix-b.mix);
}
export function createService({fetcher=fetch,timeout=24000,now=Date.now,publicWeb=false}={}){
 const cache=new Map(),inflight=new Map();let running=0;const queue=[];
 async function slot(fn){if(running>=2){if(queue.length>=32)throw Error('busy');await new Promise(resolve=>queue.push(resolve));}running++;try{return await fn();}finally{running--;queue.shift()?.();}}
 async function resource(url,signal,budget=8000,trace=[],stage='source'){
  const host=(()=>{try{return new URL(url).hostname}catch{return ''}})();
  try {for(let n=0;n<5;n++){
   if(!allowed(url,publicWeb))throw Object.assign(Error('source_not_allowed'),{code:'source_not_allowed'});
   const res=await fetcher(url,{signal:combinedSignal([signal,deadline(budget)]),redirect:'manual',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/json,application/rss+xml'}});
   if(res.status>=300&&res.status<400){const location=res.headers.get('location');if(!location)throw Error('redirect');url=new URL(location,url).href;continue;}
   if(!res.ok)throw Object.assign(Error('HTTP '+res.status),{code:[401,403,412,429].includes(res.status)?stage==='search'?'search_blocked':'source_blocked':'upstream_http',status:res.status});
   if(/\/(login|signin|passport)(\/|\?|$)/i.test(new URL(url).pathname))throw Object.assign(Error('login_required'),{code:'login_required'});
   if(Number(res.headers.get('content-length'))>4000000)throw Error('body_too_large');const body=await res.text();if(body.length>4000000)throw Error('body_too_large');
   if(challenge(body))throw Object.assign(Error('blocked'),{code:stage==='search'?'search_blocked':'source_blocked'});
   return {body,url};
  }throw Error('too_many_redirects');}
  catch(e){trace.push({stage,host,code:typeof e.code==='string'?e.code:/Abort|Timeout/.test(e.name)?'timeout':'network_error',...(e.status?{status:e.status}:{})});throw e;}
 }
 async function resolve(url,site,signal,trace=[]){const u=new URL(url);let api=[];
  if(site==='x'){const id=(u.pathname.match(/\/status\/(\d+)/)||[])[1];if(id){const token=((Number(id)/1e15)*Math.PI).toString(36).replace(/(0+|\.)/g,'');api.push('https://cdn.syndication.twimg.com/tweet-result?id='+id+'&lang=zh&token='+token,'https://publish.twitter.com/oembed?url='+encodeURIComponent('https://twitter.com/i/status/'+id)+'&omit_script=true&dnt=true');}}
  if(site==='weibo'){const id=(u.pathname.match(/\/(?:status|detail)\/([a-z0-9]+)/i)||u.pathname.match(/^\/\d+\/([a-z0-9]+)/i)||[])[1];if(id)api.push('https://m.weibo.cn/statuses/show?id='+id);}
  if(site==='zhihu'){const answer=u.pathname.match(/\/answer\/(\d+)/),article=u.pathname.match(/\/p\/(\d+)/),question=u.pathname.match(/\/question\/(\d+)/);if(answer)api.push('https://www.zhihu.com/api/v4/answers/'+answer[1]+'?include=content,author,question');else if(article)api.push('https://www.zhihu.com/api/v4/articles/'+article[1]+'?include=content,author');else if(question)api.push('https://www.zhihu.com/api/v4/questions/'+question[1]+'?include=detail');}
  if(site==='youtube'){const id=u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop();if(/^[\w-]{11}$/.test(id)){try{const r=await resource('https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id)+'&format=json',signal,8000,trace),j=JSON.parse(r.body);if(j.title)return{site:'YouTube',provider:site,url:'https://www.youtube.com/watch?v='+id,title:j.title,author:j.author_name||'',text:'',images:[],kind:'video',embed:'https://www.youtube.com/embed/'+id};}catch(e){if(signal.aborted)throw e;}}}
  if(site==='bilibili'){const id=biliID(url);if(id){try{const r=await resource('https://api.bilibili.com/x/web-interface/view?'+(/^BV/i.test(id)?'bvid='+id:'aid='+id.slice(2)),signal,5000,trace),j=JSON.parse(r.body);if(j.code===0&&j.data?.title){const bv=/^BV[\da-z]{10}$/i.test(j.data.bvid||'')?j.data.bvid:id,image=String(j.data.pic||'').replace(/^http:/,'https:');return{site:'B站',provider:site,url:'https://www.bilibili.com/video/'+bv,title:htmlText(j.data.title),author:htmlText(j.data.owner?.name||''),text:htmlText(j.data.desc||''),images:publicURL(image)?[image]:[],kind:'video',embed:'https://player.bilibili.com/player.html?'+(/^BV/i.test(bv)?'bvid='+bv:'aid='+bv.slice(2))+'&autoplay=0'};}if(j.code)trace.push({stage:'source',host:'api.bilibili.com',code:apiFailure(j.code)==='search_blocked'?'source_blocked':'upstream_error',upstreamCode:j.code});}catch(e){if(signal.aborted)throw e;}}}
  api.push(url);for(const target of api){try{const r=await resource(target,signal,5000,trace);if(site==='bilibili'&&u.hostname==='b23.tv'){const canonical=meta(r.body,'og:url')||(r.body.match(/https?:\\?\/\\?\/(?:www\.)?bilibili\.com\\?\/video\\?\/(BV[\da-z]{10})/i)||[])[0]?.replace(/\\/g,'');if(canonical&&sourceSite(canonical)==='bilibili'&&biliID(canonical))return resolve(canonical.replace(/^http:/,'https:'),site,signal,trace);}const post=parsePost(r.body,site,r.url===target?url:r.url);if(!post)trace.push({stage:'source',host:new URL(target).hostname,code:'unreadable'});if(post){if(site==='pornhub'&&specific(post.url,site)){const id=new URL(post.url).searchParams.get('viewkey')||(new URL(post.url).pathname.match(/^\/embed\/([a-z0-9]+)/i)||[])[1];post.kind='video';post.embed='https://www.pornhub.com/embed/'+id;}return post;}}catch(e){if(signal.aborted)throw e;}}
  return null;
 }
 async function run(input){
  const site=Object.hasOwn(SITES,input.site)?input.site:'web',q=preferredQuery(input),seed=String(input.seed||'').slice(0,120),exclude=new Set((input.exclude||[]).slice(0,30));
  const key=JSON.stringify([site,q,seed,input.url||'',[...exclude].sort()]);const old=cache.get(key);if(old&&old.until>now())return old.value;if(inflight.has(key))return inflight.get(key);
  const work=slot(async()=>{
   const controller=new AbortController(),abort=()=>controller.abort(),trace=[];let searched=0,matched=0,read=0,searchSucceeded=0;
   let post=null,foreign=null,candidates=[];
   input.signal?.addEventListener('abort',abort,{once:true});if(input.signal?.aborted)controller.abort();const timer=setTimeout(abort,timeout);
   try{
    if(input.url&&allowed(input.url,publicWeb)&&specific(input.url,sourceSite(input.url))){read++;post=await resolve(input.url,sourceSite(input.url),controller.signal,trace);}
    else if(q){
     const relevant=q+' '+String(input.query||'')+' '+String(input.title||'');
     const select=items=>{const unique=new Map();for(const item of items){const old=unique.get(item.url);if(!old||item.description.length>old.description.length)unique.set(item.url,item);}return rankCandidates([...unique.values()],relevant,seed).filter(v=>!exclude.has(v.url));};
     const transport=()=>{const fatal=trace.find(e=>['native_unavailable','session_required','native_response','transport_disabled'].includes(e.code));if(fatal)throw Object.assign(Error(fatal.code),{code:fatal.code});};
     const pageSearch=async url=>{
      searched++;
      try{const r=await resource(url,controller.signal,3500,trace,'search'),items=searchResults(r.body,site,{publicWeb});
       if(!items.length&&!/<rss\b|<feed\b|\bb_algo\b|\bb_results\b|result__a|\bvrwrap\b|\bno-results\b|没有找到|未找到相关|没有相关结果|No results|There are no results/i.test(r.body)){
        trace.push({stage:'search',host:new URL(url).hostname,code:'invalid_search_response'});return [];
       }
       searchSucceeded++;return items;
      }catch{return [];}
     };
     if(site==='bilibili'){
      searched++;
      try{
       const r=await resource('https://api.bilibili.com/x/web-interface/search/all/v2?keyword='+encodeURIComponent(q)+'&page=1',controller.signal,3000,trace,'search');
       let j;try{j=JSON.parse(r.body);}catch{throw Object.assign(Error('invalid_search_response'),{code:'invalid_search_response'});}
       if(j.code!==0)throw Object.assign(Error('platform search failed'),{code:apiFailure(j.code),upstreamCode:j.code});
       if(!Array.isArray(j.data?.result))throw Object.assign(Error('invalid_search_response'),{code:'invalid_search_response'});
       searchSucceeded++;candidates=select(bilibiliResults(r.body));
      }catch(e){if(!trace.some(v=>v.stage==='search'&&v.host==='api.bilibili.com'))trace.push({stage:'search',host:'api.bilibili.com',code:e.code||'network_error',...(e.upstreamCode!==undefined?{upstreamCode:e.upstreamCode}:{})});}
      transport();
     }
     if(site==='pornhub'){
      const queries=[q];const original=String(input.query||'').trim().slice(0,100);if(original&&original!==q&&!isChineseText(original))queries.push(original);
      for(const keyword of queries){
       searched++;
       try{const r=await resource('https://www.pornhub.com/webmasters/search?search='+encodeURIComponent(keyword)+'&page=1',controller.signal,3000,trace,'search'),j=JSON.parse(r.body);if(!Array.isArray(j.videos))throw Object.assign(Error('invalid_search_response'),{code:'invalid_search_response'});searchSucceeded++;
        const video=j.videos.find(v=>/^[\da-z]{6,32}$/i.test(v.video_id)&&htmlText(v.title)&&!exclude.has('https://www.pornhub.com/view_video.php?viewkey='+v.video_id));
        if(video){post={site:'Pornhub',provider:site,url:'https://www.pornhub.com/view_video.php?viewkey='+video.video_id,title:htmlText(video.title),author:'',text:'',images:[],kind:'video',embed:'https://www.pornhub.com/embed/'+video.video_id};matched=1;break;}
       }catch(e){if(e.code==='invalid_search_response')trace.push({stage:'search',host:'www.pornhub.com',code:e.code});}
       transport();if(controller.signal.aborted)break;
      }
     }
     const domain=site==='web'?'':SITES[site].hosts[0],query=(domain?'site:'+domain+' ':'')+q;
     if(!post&&!candidates.length){
      // 独立来源并行，某个验证页面不会阻止另一个来源返回结果。
      let found=(await Promise.all([searchURL(query,true),searchURL(query,false,'duck')].map(pageSearch))).flat();transport();candidates=select(found);
      if(!candidates.length&&!controller.signal.aborted){const sogou='https://www.sogou.com/web?query='+encodeURIComponent(query);found.push(...(await Promise.all([sogou,searchURL(query)].map(pageSearch))).flat());transport();candidates=select(found);}
      if(!candidates.length&&input.title&&String(input.title).trim()!==q&&!controller.signal.aborted){
       const alternate=(domain?'site:'+domain+' ':'')+String(input.title).trim().slice(0,100);
       found.push(...await pageSearch('https://www.sogou.com/web?query='+encodeURIComponent(alternate)));candidates=select(found);transport();
      }
     }
     matched=post?matched:candidates.length;
     for(const [index,candidate] of candidates.slice(0,4).entries()){
      read++;const item=await resolve(candidate.url,candidate.provider,controller.signal,trace);
      if(!item){if(candidate.platformSearch&&indexedSummary([candidate]))break;continue;}
      if(isChinesePost(item)){post=item;break;}
      foreign=foreign||item;if(!candidates.slice(index+1,4).some(v=>v.chinese))break;
     }
     if(!post)post=indexedSummary(candidates,true);
    }
    if(!post)post=foreign||indexedSummary(candidates);
    if(post)post.language=isChinesePost(post)?'zh':'foreign';
    let code=!q&&!input.url?'empty_query':read?'source_unreadable':'no_matches';
    if(!post&&read&&trace.some(e=>e.stage==='source'&&['source_blocked','login_required'].includes(e.code)))code='source_blocked';
    if(!post&&!matched&&!searchSucceeded&&trace.some(e=>e.stage==='search'))code=trace.some(e=>e.code==='search_blocked')?'search_blocked':trace.filter(e=>e.stage==='search').every(e=>e.code==='timeout')?'timeout':'network_error';
    const result=post?{status:'ready',post,matchedBy:input.url?'source-link':'keyword-search'}:{status:['network_error','search_blocked'].includes(code)?'error':'placeholder',site:SITES[site].name,code,reason:failureReason(code)};
    result.diagnostics={searched,matched,read,errors:trace.slice(-12)};
    if(result.status!=='error')cache.set(key,{value:result,until:now()+(post?15*60*1000:15000)});if(cache.size>500)cache.delete(cache.keys().next().value);return result;
   }catch(e){
    const fallback=!input.signal?.aborted&&(indexedSummary(candidates,true)||foreign||indexedSummary(candidates));
    if(fallback){fallback.language=isChinesePost(fallback)?'zh':'foreign';return{status:'ready',post:fallback,matchedBy:'keyword-search',diagnostics:{searched,matched,read,errors:trace.slice(-12)}};}
    const code=controller.signal.aborted?(input.signal?.aborted?'cancelled':'timeout'):e.code||'network_error';return{status:'error',site:SITES[site].name,code,reason:failureReason(code),diagnostics:{searched,matched,read,errors:trace.slice(-12)}};
   }
   finally{clearTimeout(timer);input.signal?.removeEventListener('abort',abort);}
  });
  inflight.set(key,work);try{return await work;}catch{return{status:'error',code:'queue_full',reason:failureReason('queue_full')};}finally{inflight.delete(key);}
 }

 return{feed:run,resolve:async url=>{if(!allowed(url,publicWeb))throw Error('source_not_allowed');const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{return await resolve(url,sourceSite(url),c.signal);}finally{clearTimeout(t);}},clear(){cache.clear();}};
}
export { SITES };
