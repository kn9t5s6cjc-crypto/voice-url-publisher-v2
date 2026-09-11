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
function escapeHtml(value=''){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function inlineJson(value){return JSON.stringify(value).replace(/</g,'\\u003c')}

async function replaceSiteFiles(env,siteId,prepared,teamLabel){
 const manifestKey=`sites/${siteId}/.manifest`;
 const previous=await env.SITES.get(manifestKey);
 if(previous){
  try{
   const old=await previous.json(),next=new Set(prepared.map(x=>x.relative));
   const stale=(old.files||[]).filter(path=>!next.has(path)).map(path=>`sites/${siteId}/${path}`);
   if(stale.length)await env.SITES.delete(stale);
  }catch{}
 }
 for(let i=0;i<prepared.length;i+=5){const batch=prepared.slice(i,i+5);await Promise.all(batch.map(x=>env.SITES.put(`sites/${siteId}/${x.relative}`,x.data,{httpMetadata:{contentType:ext(x.relative)}})))}
 await env.SITES.put(manifestKey,JSON.stringify({team:teamLabel,updatedAt:new Date().toISOString(),files:prepared.map(x=>x.relative)}),{httpMetadata:{contentType:'application/json'}});
}

function ensureEditorAssets(html){
 let output=String(html||'').trim();
 if(!output)return '';
 if(!/<!doctype/i.test(output))output='<!doctype html>\n'+output;
 if(!/<link[^>]+href=["'](?:\.\/)?style\.css["']/i.test(output)){
  const tag='<link rel="stylesheet" href="style.css">';
  output=/<\/head>/i.test(output)?output.replace(/<\/head>/i,tag+'\n</head>'):tag+'\n'+output;
 }
 if(!/<script[^>]+src=["'](?:\.\/)?script\.js["']/i.test(output)){
  const tag='<script src="script.js"><\/script>';
  output=/<\/body>/i.test(output)?output.replace(/<\/body>/i,tag+'\n</body>'):output+'\n'+tag;
 }
 return output;
}

function resultPage(siteUrl,qr){
 const safeUrl=siteUrl.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090909"><title>完成！— VOICE PUBLISH</title><style>'+
 '*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;background:#090909;color:#fff;display:grid;place-items:center;padding:24px}body:before{content:"";position:fixed;inset:0;opacity:.12;pointer-events:none;background-image:linear-gradient(#fff0 23px,#fff 24px),linear-gradient(90deg,#fff0 23px,#fff 24px);background-size:24px 24px}.wrap{position:relative;width:min(820px,100%);text-align:center}.brand{font:900 11px monospace;letter-spacing:.2em;color:#ed1c24;margin-bottom:24px}.check{width:94px;height:94px;border-radius:50%;background:#ed1c24;display:grid;place-items:center;margin:0 auto 20px;font-size:48px;font-weight:900;box-shadow:0 0 0 12px #ed1c2422}h1{font-size:clamp(52px,10vw,92px);line-height:.9;letter-spacing:-.07em;margin:0}.lead{color:#aaa;margin:20px 0 30px;font-size:15px}.result{display:grid;grid-template-columns:1fr 260px;gap:28px;text-align:left;background:#f4f2ed;color:#090909;padding:34px;box-shadow:14px 14px 0 #ed1c24}.label{font:900 10px monospace;letter-spacing:.15em;color:#ed1c24;margin-bottom:10px}.url{background:#fff;border-left:4px solid #ed1c24;padding:16px;font:12px/1.6 monospace;word-break:break-all}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.actions a,.actions button{border:0;border-radius:0;padding:15px;text-align:center;text-decoration:none;font-size:12px;font-weight:900;cursor:pointer}.open{background:#ed1c24;color:#fff}.copy{background:#111;color:#fff}.again{display:inline-block;margin-top:24px;color:#fff;text-decoration:none;border-bottom:1px solid #777;padding:8px;font-size:12px;font-weight:800}.qrbox{text-align:center;background:#fff;padding:14px}.qrbox img{display:block;width:100%;height:auto}.qrbox p{font-size:11px;font-weight:800;margin:10px 0 0}@media(max-width:650px){.result{grid-template-columns:1fr;padding:22px;box-shadow:8px 8px 0 #ed1c24}.qrbox{max-width:260px;margin:auto}.actions{grid-template-columns:1fr}h1{font-size:62px}}'+
 '</style></head><body><main class="wrap"><div class="brand">VOICE / PUBLISH COMPLETE</div><div class="check">✓</div><h1>完成！</h1><p class="lead">Webサイトがインターネットに公開されました。</p><section class="result"><div><div class="label">PUBLIC URL</div><div class="url">'+safeUrl+'</div><div class="actions"><a class="open" href="'+safeUrl+'" target="_blank" rel="noopener">サイトを開く ↗</a><button class="copy" id="copy" type="button">URLをコピー</button></div></div><div class="qrbox"><img src="'+qr+'" alt="公開URLのQRコード"><p>スマホで読み取って開く</p></div></section><a class="again" href="/">← 別のサイトを公開する</a>　<a class="again" href="/sites">公開サイト一覧を見る →</a></main><script>const siteUrl='+JSON.stringify(siteUrl)+';document.getElementById("copy").addEventListener("click",async function(){await navigator.clipboard.writeText(siteUrl);this.textContent="コピーしました ✓";setTimeout(()=>this.textContent="URLをコピー",1800)});</script></body></html>';
}

function sitesPage(items,origin){
 const cards=items.length?items.map(item=>{const url=`${origin}/s/${encodeURIComponent(item.id)}/`;return `<article class="site"><div><span class="eyebrow">TEAM SITE</span><h2>${escapeHtml(item.team)}</h2><p>${escapeHtml(url)}</p></div><div class="actions"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">開く ↗</a><button data-url="${escapeHtml(url)}">コピー</button></div></article>`}).join(''):'<div class="empty">まだ公開されたサイトはありません。</div>';
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090909"><title>公開サイト一覧 — VOICE PUBLISH</title><style>
 :root{--red:#ed1c24;--ink:#090909;--paper:#f4f2ed}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;background:var(--paper);color:var(--ink)}.wrap{width:min(980px,100%);margin:auto}header{display:flex;justify-content:space-between;align-items:center;padding:8px 0 22px;border-bottom:1px solid #aaa}.brand{font-weight:950;font-size:20px;letter-spacing:-.04em}.brand b{display:inline-grid;place-items:center;width:28px;height:28px;margin-right:10px;background:var(--red);color:#fff;font-size:12px;transform:rotate(-5deg)}header a{color:#111;font-size:13px;font-weight:800;text-decoration:none}h1{font-size:clamp(42px,8vw,74px);letter-spacing:-.07em;line-height:.95;margin:56px 0 12px}h1 span{color:var(--red)}.lead{color:#666;margin:0 0 38px}.grid{display:grid;gap:15px}.site{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#fff;border:1px solid #bbb;padding:24px;box-shadow:7px 7px 0 #111}.eyebrow{font:800 10px monospace;letter-spacing:.14em;color:var(--red)}h2{font-size:26px;margin:5px 0 8px;letter-spacing:-.04em}.site p{max-width:570px;margin:0;color:#777;font:12px/1.5 monospace;word-break:break-all}.actions{display:flex;gap:8px;flex-shrink:0}.actions a,.actions button{border:0;padding:12px 16px;text-decoration:none;font-size:12px;font-weight:900;cursor:pointer}.actions a{background:var(--red);color:#fff}.actions button{background:#111;color:#fff}.empty{padding:50px;background:#fff;border:1px solid #bbb;text-align:center;color:#777}.toast{position:fixed;right:20px;bottom:20px;padding:13px 17px;background:#111;color:#fff;font-size:13px;font-weight:800;transform:translateY(160%);transition:.25s}.toast.show{transform:none}@media(max-width:620px){body{padding:16px}.site{display:block;padding:19px;box-shadow:5px 5px 0 #111}.actions{margin-top:16px}.actions a,.actions button{flex:1;text-align:center}h1{margin-top:42px}}
 </style></head><body><main class="wrap"><header><div class="brand"><b>V</b>VOICE PUBLISH</div><a href="/">＋ サイトを作る</a></header><h1>みんなの<span>Webサイト。</span></h1><p class="lead">公開されたチームサイトを一覧で確認できます。</p><section class="grid">${cards}</section></main><div id="toast" class="toast">URLをコピーしました ✓</div><script>document.querySelectorAll('[data-url]').forEach(button=>button.addEventListener('click',async()=>{await navigator.clipboard.writeText(button.dataset.url);const toast=document.getElementById('toast');toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}));</script></body></html>`;
}

function editorPage(){
 const starterHtml=`<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>私たちのWebサイト</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="hero">
    <p class="eyebrow">VOICE WEB WORKSHOP</p>
    <h1>アイデアを、<br><span>Webサイトにしよう。</span></h1>
    <p class="lead">左側のHTML・CSS・JavaScriptを書き換えると、ここにすぐ反映されます。</p>
    <button id="action">クリックしてみる</button>
  </main>
  <script src="script.js"><\/script>
</body>
</html>`;
 const starterCss=`* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  font-family: Arial, "Noto Sans JP", sans-serif;
  background: #f4f2ed;
  color: #090909;
}
.hero { max-width: 760px; }
.eyebrow { color: #e60012; font-weight: 800; letter-spacing: .14em; }
h1 { margin: 18px 0; font-size: clamp(48px, 8vw, 92px); line-height: .95; letter-spacing: -.06em; }
h1 span { color: #e60012; }
.lead { max-width: 560px; font-size: 18px; line-height: 1.8; }
button { margin-top: 20px; border: 0; padding: 16px 24px; background: #090909; color: white; font-weight: 800; cursor: pointer; }`;
 const starterJs=`document.getElementById('action').addEventListener('click', () => {
  alert('JavaScriptも動いています！');
});`;
 return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#090909">
<title>VOICE STUDIO — サイト制作</title>
<style>
:root{--red:#ed1c24;--ink:#090909;--paper:#f4f2ed;--muted:#8b8b8b;--line:#2c2c2c}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;overflow:hidden;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;background:#0d0d0d;color:#fff}
button,input,textarea{font:inherit}.topbar{height:68px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:18px;padding:0 20px;background:#111}.brand{font-weight:950;letter-spacing:-.04em;white-space:nowrap}.brand b{display:inline-grid;place-items:center;width:28px;height:28px;margin-right:10px;background:var(--red);transform:rotate(-5deg);font-size:12px}.back{color:#aaa;text-decoration:none;font-size:13px}.team{margin-left:auto;display:flex;align-items:center;gap:9px}.team label{font-size:12px;color:#aaa}.team input{width:180px;background:#1a1a1a;border:1px solid #454545;color:#fff;padding:10px 12px;outline:none}.team input:focus{border-color:var(--red)}.save-state{font:12px monospace;color:#8f8}.toolbar-btn{border:1px solid #444;background:#181818;color:#fff;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer}.publish{border-color:var(--red);background:var(--red);min-width:112px}.workspace{height:calc(100vh - 68px);display:grid;grid-template-columns:minmax(330px,46%) 1fr}.code-side{min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--line);background:#101010}.tabs{height:48px;display:flex;align-items:stretch;border-bottom:1px solid var(--line);padding-left:10px}.tab{border:0;border-bottom:3px solid transparent;background:transparent;color:#888;padding:0 18px;font:800 12px monospace;cursor:pointer}.tab.active{color:#fff;border-color:var(--red)}.editor-wrap{position:relative;flex:1;min-height:0}.filename{position:absolute;z-index:2;right:14px;top:11px;color:#555;font:11px monospace;pointer-events:none}.editor{position:absolute;inset:0;width:100%;height:100%;resize:none;border:0;outline:0;padding:24px 22px 70px;background:#101010;color:#eee;font:14px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;tab-size:2}.editor[hidden]{display:none}.hint{height:38px;border-top:1px solid var(--line);padding:10px 16px;color:#777;font-size:12px}.preview-side{min-width:0;display:flex;flex-direction:column;background:#262626}.preview-head{height:48px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid var(--line);font-size:12px;font-weight:800}.dots{display:flex;gap:6px;margin-right:12px}.dots i{width:8px;height:8px;border-radius:50%;background:#555}.dots i:first-child{background:var(--red)}.preview-label{color:#aaa}.device{margin-left:auto;display:flex;gap:4px}.device button{border:0;background:#171717;color:#888;padding:6px 10px;font-size:11px;cursor:pointer}.device button.active{background:#fff;color:#111}.stage{flex:1;min-height:0;display:grid;place-items:center;padding:18px;overflow:auto}.frame-shell{width:100%;height:100%;background:#fff;box-shadow:0 10px 40px #0008;transition:.25s}.frame-shell.mobile{width:390px;max-width:100%;height:min(760px,100%)}iframe{display:block;width:100%;height:100%;border:0;background:#fff}.toast{position:fixed;right:22px;bottom:22px;z-index:20;background:#fff;color:#111;padding:14px 18px;border-left:5px solid var(--red);font-size:13px;font-weight:800;box-shadow:8px 8px 0 var(--red);transform:translateY(150%);transition:.25s}.toast.show{transform:none}.busy{position:fixed;inset:0;z-index:30;background:#090909eF;display:none;place-items:center}.busy.show{display:grid}.busy-card{text-align:center}.spinner{width:70px;height:70px;margin:auto;border:3px solid #333;border-top-color:var(--red);border-radius:50%;animation:spin 1s linear infinite}.busy h2{font-size:38px;margin:22px 0 8px}.busy p{color:#aaa}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:800px){body{overflow:auto}.topbar{height:auto;min-height:62px;flex-wrap:wrap;padding:12px}.back,.save-state{display:none}.team{order:3;width:100%;margin:0}.team input{flex:1}.workspace{height:auto;min-height:calc(100vh - 112px);grid-template-columns:1fr;grid-template-rows:52vh 58vh}.code-side{border-right:0;border-bottom:1px solid var(--line)}.stage{padding:10px}.toolbar-btn{padding:9px 11px}.publish{min-width:86px}.brand{margin-right:auto}.frame-shell.mobile{height:100%}}
@media(max-width:480px){.brand{font-size:14px}.brand b{margin-right:6px}.toolbar-btn.reset{display:none}.tab{padding:0 13px}.editor{font-size:13px;padding:20px 16px 60px}}
</style>
</head>
<body>
<header class="topbar"><a class="back" href="/">← 公開画面</a><div class="brand"><b>V</b>VOICE STUDIO</div><div id="saveState" class="save-state">自動保存 ON</div><div class="team"><label for="team">チーム名</label><input id="team" maxlength="40" placeholder="例：チームA"></div><button id="reset" class="toolbar-btn reset" type="button">最初に戻す</button><button id="publish" class="toolbar-btn publish" type="button">公開する ↗</button></header>
<main class="workspace">
 <section class="code-side" aria-label="コード編集">
  <nav class="tabs" aria-label="編集するファイル"><button class="tab active" data-lang="html">HTML</button><button class="tab" data-lang="css">CSS</button><button class="tab" data-lang="js">JavaScript</button></nav>
  <div class="editor-wrap"><span id="filename" class="filename">index.html</span><textarea id="html" class="editor" aria-label="HTMLコード" spellcheck="false"></textarea><textarea id="css" class="editor" aria-label="CSSコード" spellcheck="false" hidden></textarea><textarea id="js" class="editor" aria-label="JavaScriptコード" spellcheck="false" hidden></textarea></div>
  <div class="hint">入力すると右のプレビューに自動反映・この端末に自動保存されます</div>
 </section>
 <section class="preview-side" aria-label="プレビュー">
  <div class="preview-head"><span class="dots"><i></i><i></i><i></i></span><span class="preview-label">LIVE PREVIEW</span><div class="device"><button class="active" data-device="desktop">PC</button><button data-device="mobile">スマホ</button></div></div>
  <div class="stage"><div id="frameShell" class="frame-shell"><iframe id="preview" title="Webサイトのプレビュー" sandbox="allow-scripts allow-modals"></iframe></div></div>
 </section>
</main>
<div id="toast" class="toast" role="status"></div><div id="busy" class="busy"><div class="busy-card"><div class="spinner"></div><h2>公開中…</h2><p>URLとQRコードを作っています</p></div></div>
<script>
const defaults={html:${inlineJson(starterHtml)},css:${inlineJson(starterCss)},js:${inlineJson(starterJs)}};
const names={html:'index.html',css:'style.css',js:'script.js'};
const editors={html:document.getElementById('html'),css:document.getElementById('css'),js:document.getElementById('js')};
const preview=document.getElementById('preview'),frameShell=document.getElementById('frameShell'),filename=document.getElementById('filename'),saveState=document.getElementById('saveState'),toast=document.getElementById('toast');
let timer;
function getSaved(key,fallback){try{return localStorage.getItem(key)||fallback}catch{return fallback}}
Object.keys(editors).forEach(key=>editors[key].value=getSaved('voice-studio-'+key,defaults[key]));
document.getElementById('team').value=getSaved('voice-studio-team','');
function documentSource(){let html=editors.html.value;const style='<style>'+editors.css.value+'</style>';const data='data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(editors.js.value)));const script='<scr'+'ipt src="'+data+'"></scr'+'ipt>';html=/<\\/head>/i.test(html)?html.replace(/<\\/head>/i,style+'</head>'):style+html;html=/<\\/body>/i.test(html)?html.replace(/<\\/body>/i,script+'</body>'):html+script;return html}
function render(){preview.srcdoc=documentSource()}
function changed(){saveState.textContent='保存中…';clearTimeout(timer);timer=setTimeout(()=>{Object.keys(editors).forEach(key=>localStorage.setItem('voice-studio-'+key,editors[key].value));localStorage.setItem('voice-studio-team',document.getElementById('team').value);render();saveState.textContent='保存しました ✓'},350)}
Object.values(editors).forEach(el=>{el.addEventListener('input',changed);el.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const s=el.selectionStart;el.value=el.value.slice(0,s)+'  '+el.value.slice(el.selectionEnd);el.selectionStart=el.selectionEnd=s+2;changed()}})});
document.getElementById('team').addEventListener('input',changed);
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));Object.entries(editors).forEach(([key,el])=>el.hidden=key!==btn.dataset.lang);filename.textContent=names[btn.dataset.lang];editors[btn.dataset.lang].focus()}));
document.querySelectorAll('[data-device]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-device]').forEach(x=>x.classList.toggle('active',x===btn));frameShell.classList.toggle('mobile',btn.dataset.device==='mobile')}));
function message(text){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
document.getElementById('reset').addEventListener('click',()=>{if(!confirm('書いたコードを消して、最初の状態に戻しますか？'))return;Object.keys(editors).forEach(key=>{editors[key].value=defaults[key];localStorage.setItem('voice-studio-'+key,defaults[key])});render();message('最初の状態に戻しました')});
document.getElementById('publish').addEventListener('click',async()=>{const team=document.getElementById('team').value.trim();if(!team){message('チーム名を入力してください');document.getElementById('team').focus();return}document.getElementById('busy').classList.add('show');try{const r=await fetch('/api/publish-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({team,html:editors.html.value,css:editors.css.value,js:editors.js.value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'公開に失敗しました');location.href=d.resultUrl}catch(e){document.getElementById('busy').classList.remove('show');message(e.message)}});
render();
</script>
</body></html>`;
}

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
.status{color:#111;text-decoration:none;font-size:11px;font-weight:800;letter-spacing:.1em;display:flex;gap:8px;align-items:center}
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
.editor-start{display:block;background:#111;color:#fff;padding:16px;text-align:center;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:.06em;transition:.2s}.editor-start:hover{background:var(--red);transform:translateY(-2px)}.or{display:flex;align-items:center;gap:10px;margin:18px 0;color:#777;font-size:11px}.or:before,.or:after{content:"";height:1px;background:#ddd;flex:1}
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
.progress{display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;padding:22px;background:#090909eF;backdrop-filter:blur(10px);color:#fff}.progress-box{width:min(620px,100%);text-align:center;border:1px solid #ffffff55;background:#111;padding:54px 48px 44px;box-shadow:16px 16px 0 var(--red);position:relative;overflow:hidden}.progress-box:before{content:"VOICE / PUBLISHING";position:absolute;top:16px;left:20px;color:#ffffff77;font:800 10px monospace;letter-spacing:.18em}.progress-symbol{width:86px;height:86px;margin:0 auto 25px;border:2px solid #ffffff33;border-top-color:var(--red);border-radius:50%;display:grid;place-items:center;color:var(--red);font-size:34px;font-weight:900;animation:spin 1.1s linear infinite}.progress-row{display:block}.progress-label{display:block;font-size:clamp(28px,5vw,48px);font-weight:950;letter-spacing:-.055em;line-height:1.1}.progress-percent{display:block;color:var(--red);font:900 18px monospace;margin:13px 0 22px}.bar{height:7px;background:#333;overflow:hidden}.bar i{display:block;width:0;height:100%;background:var(--red);transition:width .65s cubic-bezier(.22,1,.36,1)}.progress-sub{font-size:12px;color:#aaa;margin-top:16px;letter-spacing:.06em}.progress.complete{background:#090909f5}.progress.complete .progress-box{background:var(--red);box-shadow:16px 16px 0 #fff}.progress.complete .progress-box:before{color:#ffffffaa}.progress.complete .progress-symbol{border-color:#fff;background:#fff;color:var(--red);animation:none}.progress.complete .progress-percent{color:#fff}.progress.complete .bar{background:#ffffff55}.progress.complete .bar i{background:#fff}.progress.complete .progress-sub{color:#fff}@keyframes spin{to{transform:rotate(360deg)}}
.result{display:none;margin-top:20px;border:1px solid #111;background:#fff;padding:20px}
.success-label{color:var(--red);font:800 10px monospace;letter-spacing:.12em}.result h3{font-size:24px;margin:6px 0 16px;letter-spacing:-.04em}
.result-grid{display:grid;grid-template-columns:1fr 128px;gap:18px;align-items:center}
.urlbox{font:11px/1.5 monospace;background:#eee;padding:12px;word-break:break-all;border-left:3px solid var(--red)}
.qr{width:128px;height:128px;background:#fff;border:1px solid #ddd}
.actions{display:flex;gap:8px;margin-top:12px}.actions a,.actions button{flex:1;text-align:center;padding:12px;text-decoration:none;font-size:12px;font-weight:900}
.open{background:var(--red);color:#fff}.copy{background:#111;color:#fff}.error{color:#b30000;font-weight:700;font-size:13px}
footer{border-top:1px solid #aaa;padding-top:16px;display:flex;justify-content:space-between;color:#777;font:10px monospace;letter-spacing:.08em}
@media(max-width:820px){.hero{grid-template-columns:1fr}.intro{border-right:0;padding:52px 0 36px}.panel{padding:20px 0 50px}.specs{margin-top:35px}.card{box-shadow:8px 8px 0 #111}}
@media(max-width:520px){.shell{padding:18px 17px 45px}.status{display:none}h1{font-size:52px}.description{font-size:13px}.card{padding:22px}.result-grid{grid-template-columns:1fr}.qr{margin:auto}.actions{flex-direction:column}.progress-box{padding:48px 22px 36px;box-shadow:8px 8px 0 var(--red)}.progress.complete .progress-box{box-shadow:8px 8px 0 #fff}.progress-symbol{width:70px;height:70px;font-size:28px}}
</style>
</head>
<body>
<main class="shell">
<header><div class="logo"><span class="logo-mark">V</span>VOICE PUBLISH</div><a class="status" href="/sites"><i></i>公開サイト一覧 →</a></header>
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
<div class="card-head"><h2>サイトを作る・公開</h2><span class="step-no">01 / START</span></div>
<a class="editor-start" href="/editor">この中でサイトを作る →</a>
<div class="or">または、ZIPから公開</div>
<form id="f">
<label for="team">チーム名</label>
<input id="team" name="team" type="text" placeholder="例：チームA" required maxlength="40" autocomplete="off">
<label for="zip">サイトのZIPファイル</label>
<div class="drop" id="drop"><input id="zip" name="zip" type="file" accept=".zip,application/zip" required><div class="upload-icon">↑</div><b>ZIPを選択 または ドロップ</b><p>index.htmlを含む20MB以下のファイル</p></div>
<div id="fileInfo" class="file-info"></div>
<button id="btn" class="publish">公開URLを発行する</button>
<div id="progress" class="progress"><div class="progress-box"><div id="progressSymbol" class="progress-symbol">↗</div><div class="progress-row"><span id="progressLabel" class="progress-label">ZIPを読み込み中…</span><span id="progressPercent" class="progress-percent">10%</span></div><div class="bar"><i id="progressBar"></i></div><div id="progressSub" class="progress-sub">あなたのWebサイトを公開しています</div></div></div>
</form>
<div class="note">Macで作成されたZIPにも対応しています。ZIP内にフォルダが1つ入っていても自動で検出します。</div>
<div id="result" class="result"></div>
</div>
</div>
</section>
<footer><span>VOICE EVENT © 2026</span><span>POWERED BY CLOUDFLARE</span></footer>
</main>
<script>
const f=document.getElementById('f'),btn=document.getElementById('btn'),progress=document.getElementById('progress'),progressLabel=document.getElementById('progressLabel'),progressPercent=document.getElementById('progressPercent'),progressBar=document.getElementById('progressBar'),progressSymbol=document.getElementById('progressSymbol'),progressSub=document.getElementById('progressSub'),result=document.getElementById('result'),zipInput=document.getElementById('zip'),drop=document.getElementById('drop'),fileInfo=document.getElementById('fileInfo');
let progressTimers=[];
function setProgress(label,percent,complete=false){progressLabel.textContent=label;progressPercent.textContent=percent+'%';progressBar.style.width=percent+'%';progress.classList.toggle('complete',complete);progressSymbol.textContent=complete?'✓':'↗';progressSub.textContent=complete?'あなたのWebサイトが公開されました！':'あなたのWebサイトを公開しています'}
function startProgress(){progressTimers.forEach(clearTimeout);progressTimers=[];progress.style.display='flex';setProgress('ZIPを読み込み中…',10);progressTimers.push(setTimeout(()=>setProgress('ファイルを確認中…',30),700));progressTimers.push(setTimeout(()=>setProgress('Webサイトを作成中…',55),2200));progressTimers.push(setTimeout(()=>setProgress('インターネットに公開中…',75),4800));progressTimers.push(setTimeout(()=>setProgress('公開URLを発行中…',90),8000))}
function finishProgress(nextUrl){progressTimers.forEach(clearTimeout);progressTimers=[];setProgress('完成！',100,true);progressTimers.push(setTimeout(()=>{location.href=nextUrl},1500))}
function showFile(){const file=zipInput.files[0];if(!file){fileInfo.style.display='none';return}fileInfo.style.display='block';fileInfo.textContent='✓ '+file.name+'  /  '+(file.size/1024/1024).toFixed(2)+' MB'}
zipInput.addEventListener('change',showFile);
['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>{if(e.dataTransfer.files.length){zipInput.files=e.dataTransfer.files;showFile()}});
f.addEventListener('submit',async e=>{
 e.preventDefault();result.style.display='none';btn.disabled=true;startProgress();
 try{
  const fd=new FormData(f),r=await fetch('/api/publish',{method:'POST',body:fd}),d=await r.json();
  if(!r.ok){result.style.display='block';throw new Error(d.error||'公開に失敗しました')}
  finishProgress(d.resultUrl);
 }catch(err){progressTimers.forEach(clearTimeout);progressTimers=[];progress.style.display='none';result.style.display='block';result.innerHTML='<span class="error">! '+err.message+'</span>'}
 finally{btn.disabled=false}
});
</script>
</body></html>`;
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/')return new Response(htmlPage(),{headers:{'content-type':'text/html; charset=utf-8'}});
  if(request.method==='GET'&&url.pathname==='/editor')return new Response(editorPage(),{headers:{'content-type':'text/html; charset=utf-8'}});
  if(request.method==='GET'&&url.pathname==='/sites'){
   const prefixes=[];let cursor;
   do{
    const page=await env.SITES.list({prefix:'sites/',delimiter:'/',cursor});
    prefixes.push(...(page.delimitedPrefixes||[]));cursor=page.truncated?page.cursor:undefined;
   }while(cursor);
   const items=(await Promise.all(prefixes.slice(0,300).map(async prefix=>{
    const id=prefix.slice('sites/'.length).replace(/\/$/,'');
    try{const obj=await env.SITES.get(`${prefix}.manifest`);const data=obj?await obj.json():{};return {id,team:data.team||id.replace(/-[a-f0-9]{8}$/i,''),updatedAt:data.updatedAt||data.createdAt||''}}catch{return {id,team:id.replace(/-[a-f0-9]{8}$/i,''),updatedAt:''}}
   }))).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
   return new Response(sitesPage(items,url.origin),{headers:{'content-type':'text/html; charset=utf-8'}});
  }
  if(request.method==='GET'&&url.pathname==='/result'){
   const siteId=url.searchParams.get('site')||'';
   if(!/^[a-z0-9\u3040-\u30ff\u3400-\u9fff_-]{1,60}$/u.test(siteId))return new Response('Not Found',{status:404});
   const publishedUrl=`${url.origin}/s/${encodeURIComponent(siteId)}/`;
   const qrSvg=await QRCode.toString(publishedUrl,{type:'svg',width:256,margin:1,color:{dark:'#090909',light:'#ffffff'},errorCorrectionLevel:'M'});
   const qr=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
   return new Response(resultPage(publishedUrl,qr),{headers:{'content-type':'text/html; charset=utf-8'}});
  }
  if(request.method==='POST'&&url.pathname==='/api/publish'){
   try{
    const form=await request.formData(),file=form.get('zip'),teamLabel=String(form.get('team')||'').trim(),team=cleanTeamName(teamLabel);
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
    const siteId=team;
    await replaceSiteFiles(env,siteId,prepared,teamLabel);
    const publishedUrl=`${url.origin}/s/${encodeURIComponent(siteId)}/`;
    const resultUrl=`${url.origin}/result?site=${encodeURIComponent(siteId)}`;
    return Response.json({url:publishedUrl,resultUrl});
   }catch(e){console.error(e);return Response.json({error:'公開処理でエラーが発生しました。もう一度試してください。'},{status:500})}
  }
  if(request.method==='POST'&&url.pathname==='/api/publish-code'){
   try{
    const form=await request.json(),teamLabel=String(form.team||'').trim(),team=cleanTeamName(teamLabel);
    const html=String(form.html||''),css=String(form.css||''),js=String(form.js||'');
    if(!team)return Response.json({error:'チーム名を入力してください。'},{status:400});
    if(!html.trim())return Response.json({error:'HTMLを入力してください。'},{status:400});
    if(html.length>1024*1024||css.length>512*1024||js.length>512*1024)return Response.json({error:'コードの容量が大きすぎます。'},{status:413});
    const siteId=team;
    const prepared=[
     {relative:'index.html',data:ensureEditorAssets(html)},
     {relative:'style.css',data:css},
     {relative:'script.js',data:js}
    ];
    await replaceSiteFiles(env,siteId,prepared,teamLabel);
    return Response.json({url:`${url.origin}/s/${encodeURIComponent(siteId)}/`,resultUrl:`${url.origin}/result?site=${encodeURIComponent(siteId)}`});
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
