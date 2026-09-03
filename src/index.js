import JSZip from 'jszip';
import QRCode from 'qrcode';

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 300;
const MAX_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;

const MIME = {
  html:'text/html; charset=utf-8',htm:'text/html; charset=utf-8',css:'text/css; charset=utf-8',
  js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8',
  png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',
  ico:'image/x-icon',txt:'text/plain; charset=utf-8',xml:'application/xml; charset=utf-8',
  pdf:'application/pdf',mp3:'audio/mpeg',mp4:'video/mp4',wav:'audio/wav',
  woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf'
};

function cleanTeamName(value=''){
  return value.trim().toLowerCase().normalize('NFKC')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff_-]+/g,'-')
    .replace(/^-+|-+$/g,'').slice(0,40);
}
function safePath(name){
  const n=name.replace(/\\/g,'/').replace(/^\.\//,'');
  if(!n||n.startsWith('/')||n.split('/').some(p=>p==='..'))return null;
  return n;
}
function ignored(path){return path.split('/').some(p=>p==='__MACOSX'||p==='.DS_Store'||p.startsWith('._'));}
function ext(path){const x=path.split('.').pop().toLowerCase();return MIME[x]||'application/octet-stream';}
function decodeUrlPath(value){try{return decodeURIComponent(value)}catch{return null}}

function htmlPage(){
return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#080808">
<title>VOICE PUBLISH — Webサイトを世界へ</title>
<style>
:root{--red:#ed1c24;--ink:#090909;--paper:#f4f2ed;--muted:#777;--line:#d8d5cf}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;background:var(--paper);color:var(--ink);min-height:100vh}
body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.22;background-image:linear-gradient(#0000 23px,#0000000a 24px),linear-gradient(90deg,#0000 23px,#0000000a 24px);background-size:24px 24px}
.shell{position:relative;max-width:1120px;margin:auto;padding:24px 28px 70px}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #aaa;padding:0 0 18px}
.logo{display:flex;align-items:center;gap:12px;font-weight:950;letter-spacing:-.04em;font-size:22px}
.logo-mark{width:28px;height:28px;background:var(--red);display:grid;place-items:center;color:#fff;font-size:12px;transform:rotate(-5deg)}
.status{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;display:flex;gap:8px;align-items:center}
.status i{width:7px;height:7px;background:#27c66d;border-radius:50%;box-shadow:0 0 0 4px #27c66d22}
.hero{display:grid;grid-template-columns:1.08fr .92fr;min-height:650px}
.intro{padding:74px 58px 40px 0;border-right:1px solid #aaa}
.kicker{color:var(--red);font:800 12px/1 monospace;letter-spacing:.16em;text-transform:uppercase;margin-bottom:22px}
h1{font-size:clamp(50px,6vw,82px);line-height:.91;letter-spacing:-.075em;margin:0;max-width:650px}
h1 span{display:block;color:var(--red)}
.description{font-size:15px;line-height:1.9;color:#555;max-width:470px;margin:30px 0 0}
.specs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:55px}
.spec{border-top:1px solid #aaa;padding-top:10px}.spec b{display:block;font-size:18px}.spec small{color:#777;font-size:10px;letter-spacing:.08em}
.panel{padding:58px 0 40px 58px;display:flex;align-items:center}
.card{width:100%;background:#fff;border:1px solid #bdb9b2;box-shadow:12px 12px 0 #111;padding:30px}
.card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.card h2{font-size:24px;letter-spacing:-.04em;margin:0}.step-no{font:700 11px monospace;color:var(--red)}
label{display:block;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin:18px 0 8px}
input[type=text]{width:100%;padding:14px 15px;border:1px solid #bbb;border-radius:0;background:#fafafa;font-size:15px;outline:none}
input[type=text]:focus{border-color:#111;box-shadow:inset 3px 0 0 var(--red)}
.drop{position:relative;border:1.5px dashed #999;padding:25px 18px;text-align:center;background:#fafafa;transition:.2s;cursor:pointer}
.drop.drag,.drop:hover{border-color:var(--red);background:#fff5f5}
.drop input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.upload-icon{width:42px;height:42px;margin:0 auto 10px;border-radius:50%;background:#111;color:#fff;display:grid;place-items:center;font-size:20px}
.drop b{font-size:14px}.drop p{font-size:11px;color:#777;margin:5px 0 0}
.file-info{display:none;margin-top:9px;background:#111;color:#fff;padding:10px 12px;font:12px monospace;word-break:break-all}
button{border:0;border-radius:0;font:900 14px inherit;cursor:pointer}
.publish{width:100%;margin-top:20px;padding:17px;background:var(--red);color:#fff;letter-spacing:.08em;position:relative;transition:.2s}
.publish:hover{background:#111;transform:translateY(-2px)}.publish:disabled{opacity:.55;transform:none;cursor:wait}
.publish:after{content:"→";position:absolute;right:18px;font-size:20px;top:13px}
.note{font-size:10px;color:#777;margin-top:13px;line-height:1.6}
.progress{display:none;margin-top:16px}.progress-row{display:flex;justify-content:space-between;font:700 10px monospace;margin-bottom:6px}.bar{height:3px;background:#ddd;overflow:hidden}.bar i{display:block;width:35%;height:100%;background:var(--red);animation:load 1.2s infinite ease-in-out}
@keyframes load{0%{transform:translateX(-120%)}100%{transform:translateX(380%)}}
.result{display:none;margin-top:20px;border:1px solid #111;background:#fff;padding:20px}
.success-label{color:var(--red);font:800 10px monospace;letter-spacing:.12em}.result h3{font-size:24px;margin:6px 0 16px;letter-spacing:-.04em}
.result-grid{display:grid;grid-template-columns:1fr 128px;gap:18px;align-items:center}
.urlbox{font:11px/1.5 monospace;background:#eee;padding:12px;word-break:break-all;border-left:3px solid var(--red)}
.qr{width:128px;height:128px;background:#fff;border:1px solid #ddd}
.actions{display:flex;gap:8px;margin-top:12px}.actions a,.actions button{flex:1;text-align:center;padding:12px;text-decoration:none;font-size:12px;font-weight:900}
.open{background:var(--red);color:#fff}.copy{background:#111;color:#fff}.error{color:#b30000;font-weight:700;font-size:13px}
footer{border-top:1px solid #aaa;padding-top:16px;display:flex;justify-content:space-between;color:#777;font:10px monospace;letter-spacing:.08em}
@media(max-width:820px){.hero{grid-template-columns:1fr}.intro{border-right:0;padding:52px 0 36px}.panel{padding:20px 0 50px}.specs{margin-top:35px}.card{box-shadow:8px 8px 0 #111}}
@media(max-width:520px){.shell{padding:18px 17px 45px}.status{display:none}h1{font-size:52px}.description{font-size:13px}.card{padding:22px}.result-grid{grid-template-columns:1fr}.qr{margin:auto}.actions{flex-direction:column}}
</style>
</head>
<body>
<main class="shell">
<header><div class="logo"><span class="logo-mark">V</span>VOICE PUBLISH</div><div class="status"><i></i>System online</div></header>
<section class="hero">
<div class="intro">
<div class="kicker">Ship your idea to the world</div>
<h1>つくったものを、<span>世界に放とう。</span></h1>
<p class="description">ZIPファイルを選ぶだけで、あなたのWebサイトが公開されます。難しい設定は必要ありません。発行されたURLとQRコードを、その場ですぐ共有できます。</p>
<div class="specs">
<div class="spec"><b>20MB</b><small>MAX ZIP SIZE</small></div>
<div class="spec"><b>3 STEP</b><small>TO PUBLISH</small></div>
<div class="spec"><b>FREE</b><small>EVENT USE</small></div>
</div>
</div>
<div class="panel">
<div class="card">
<div class="card-head"><h2>サイトを公開</h2><span class="step-no">01 / UPLOAD</span></div>
<form id="f">
<label for="team">チーム名</label>
<input id="team" name="team" type="text" placeholder="例：チームA" required maxlength="40" autocomplete="off">
<label for="zip">サイトのZIPファイル</label>
<div class="drop" id="drop"><input id="zip" name="zip" type="file" accept=".zip,application/zip" required><div class="upload-icon">↑</div><b>ZIPを選択 または ドロップ</b><p>index.htmlを含む20MB以下のファイル</p></div>
<div id="fileInfo" class="file-info"></div>
<button id="btn" class="publish">公開URLを発行する</button>
<div id="progress" class="progress"><div class="progress-row"><span>UPLOADING & PUBLISHING</span><span>PLEASE WAIT</span></div><div class="bar"><i></i></div></div>
</form>
<div class="note">Macで作成されたZIPにも対応しています。ZIP内にフォルダが1つ入っていても自動で検出します。</div>
<div id="result" class="result"></div>
</div>
</div>
</section>
<footer><span>VOICE EVENT © 2026</span><span>POWERED BY CLOUDFLARE</span></footer>
</main>
<script>
const f=document.getElementById('f'),btn=document.getElementById('btn'),progress=document.getElementById('progress'),result=document.getElementById('result'),zipInput=document.getElementById('zip'),drop=document.getElementById('drop'),fileInfo=document.getElementById('fileInfo');
function showFile(){const file=zipInput.files[0];if(!file){fileInfo.style.display='none';return}fileInfo.style.display='block';fileInfo.textContent='✓ '+file.name+'  /  '+(file.size/1024/1024).toFixed(2)+' MB'}
zipInput.addEventListener('change',showFile);
['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>{if(e.dataTransfer.files.length){zipInput.files=e.dataTransfer.files;showFile()}});
f.addEventListener('submit',async e=>{
 e.preventDefault();result.style.display='none';btn.disabled=true;progress.style.display='block';
 try{
  const fd=new FormData(f),r=await fetch('/api/publish',{method:'POST',body:fd}),d=await r.json();
  result.style.display='block';if(!r.ok)throw new Error(d.error||'公開に失敗しました');
  result.innerHTML='<div class="success-label">● PUBLISH COMPLETE</div><h3>公開できました！</h3><div class="result-grid"><div><div class="urlbox">'+d.url+'</div><div class="actions"><a class="open" href="'+d.url+'" target="_blank" rel="noopener">サイトを開く ↗</a><button class="copy" type="button" id="copyUrl">URLをコピー</button></div></div><img class="qr" src="'+d.qr+'" alt="公開URLのQRコード"></div>';
  const copy=document.getElementById('copyUrl');copy.addEventListener('click',async()=>{await navigator.clipboard.writeText(d.url);copy.textContent='コピーしました ✓';setTimeout(()=>copy.textContent='URLをコピー',1800)});
 }catch(err){result.style.display='block';result.innerHTML='<span class="error">! '+err.message+'</span>'}
 finally{btn.disabled=false;progress.style.display='none'}
});
</script>
</body></html>`;
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/')return new Response(htmlPage(),{headers:{'content-type':'text/html; charset=utf-8'}});
  if(request.method==='POST'&&url.pathname==='/api/publish'){
   try{
    const form=await request.formData(),file=form.get('zip'),team=cleanTeamName(String(form.get('team')||''));
    if(!team)return Response.json({error:'チーム名を入力してください。'},{status:400});
    if(!file||typeof file.arrayBuffer!=='function')return Response.json({error:'ZIPファイルを選んでください。'},{status:400});
    if(file.size>MAX_ZIP_BYTES)return Response.json({error:'ZIPは20MB以下にしてください。'},{status:413});
    let zip;try{zip=await JSZip.loadAsync(await file.arrayBuffer())}catch{return Response.json({error:'ZIPを読み込めませんでした。ZIP形式を確認してください。'},{status:400})}
    const entries=Object.values(zip.files).filter(e=>!e.dir).map(e=>({e,path:safePath(e.name)})).filter(x=>x.path&&!ignored(x.path));
    if(!entries.length)return Response.json({error:'ZIPの中に公開できるファイルがありません。'},{status:400});
    if(entries.length>MAX_FILES)return Response.json({error:`ファイル数は${MAX_FILES}個以下にしてください。`},{status:400});
    const indexes=entries.filter(x=>x.path.toLowerCase().endsWith('/index.html')||x.path.toLowerCase()==='index.html');
    if(!indexes.length)return Response.json({error:'index.html が見つかりません。サイトのフォルダに index.html を入れてください。'},{status:400});
    indexes.sort((a,b)=>a.path.split('/').length-b.path.split('/').length);
    const indexPath=indexes[0].path,root=indexPath.slice(0,indexPath.length-'index.html'.length),siteEntries=entries.filter(x=>x.path.startsWith(root));
    let total=0;const prepared=[];
    for(const x of siteEntries){const relative=x.path.slice(root.length);if(!relative||ignored(relative))continue;const data=await x.e.async('uint8array');total+=data.byteLength;if(total>MAX_UNCOMPRESSED_BYTES)return Response.json({error:'展開後のファイル容量が大きすぎます。'},{status:413});prepared.push({relative,data})}
    if(!prepared.some(x=>x.relative.toLowerCase()==='index.html'))return Response.json({error:'index.html を公開ルートに設定できませんでした。'},{status:400});
    const siteId=`${team}-${crypto.randomUUID().slice(0,8)}`;
    for(let i=0;i<prepared.length;i+=5){const batch=prepared.slice(i,i+5);await Promise.all(batch.map(x=>env.SITES.put(`sites/${siteId}/${x.relative}`,x.data,{httpMetadata:{contentType:ext(x.relative)}})))}
    await env.SITES.put(`sites/${siteId}/.manifest`,JSON.stringify({createdAt:new Date().toISOString(),files:prepared.map(x=>x.relative)}),{httpMetadata:{contentType:'application/json'}});
    const publishedUrl=`${url.origin}/s/${encodeURIComponent(siteId)}/`;
    const qrSvg=await QRCode.toString(publishedUrl,{type:'svg',width:256,margin:1,color:{dark:'#090909',light:'#ffffff'},errorCorrectionLevel:'M'});
    const qr=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
    return Response.json({url:publishedUrl,qr});
   }catch(e){console.error(e);return Response.json({error:'公開処理でエラーが発生しました。もう一度試してください。'},{status:500})}
  }
  if(request.method==='GET'&&url.pathname.startsWith('/s/')){
   const rest=url.pathname.slice(3),slash=rest.indexOf('/');
   if(slash<1)return new Response('Not Found',{status:404});
   const siteId=decodeUrlPath(rest.slice(0,slash));let path=decodeUrlPath(rest.slice(slash+1)||'index.html');
   if(!siteId||!path)return new Response('Not Found',{status:404});path=safePath(path);if(!path)return new Response('Not Found',{status:404});
   let obj=await env.SITES.get(`sites/${siteId}/${path}`);if(!obj&&!path.includes('.'))obj=await env.SITES.get(`sites/${siteId}/${path}/index.html`);
   if(!obj)return new Response('Not Found',{status:404});
   const headers=new Headers();obj.writeHttpMetadata(headers);headers.set('etag',obj.httpEtag);headers.set('x-content-type-options','nosniff');
   return new Response(obj.body,{headers});
  }
  return new Response('Not Found',{status:404});
 }
};
