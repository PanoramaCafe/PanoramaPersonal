/* Panorama Personal — sincronización limpia, local-first */
(function(){
'use strict';
const cfg=window.PANORAMA_SUPABASE,STORE='panorama_cafe_personal_v1',PENDING='panorama_personal_pending_v2',ROW='personal-main',PULL_MS=2500;
let syncing=false,applying=false,last='';
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function read(k=STORE){try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}}
function write(x){localStorage.setItem(STORE,JSON.stringify(x));}
function same(a,b){try{return JSON.stringify(a)===JSON.stringify(b)}catch{return false}}
function status(t,k){let e=document.getElementById('panoramaSyncStatus');if(!e){e=document.createElement('div');e.id='panoramaSyncStatus';e.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9999;padding:8px 11px;border-radius:999px;background:#fff;border:1px solid #ddd;font:800 11px system-ui';document.body.appendChild(e)}e.textContent=t;e.style.color=k==='ok'?'#16803a':k==='offline'?'#a56700':'#b36b00'}
function refresh(){if(!navigator.onLine)return status('● Sin conexión','offline');if(read(PENDING))return status('● Pendiente de sincronizar','pending');status('● Sincronizado','ok')}
function id(x){return x&&typeof x==='object'&&(x.id??x.sessionId??x.employeeId??x.key)}
function mergeValue(a,b){
 if(Array.isArray(a)||Array.isArray(b)){const aa=Array.isArray(a)?a:[],bb=Array.isArray(b)?b:[];const out=[],map=new Map();for(const v of [...aa,...bb]){const k=id(v);if(k==null){out.push(clone(v));continue}const old=map.get(String(k));if(!old){map.set(String(k),clone(v));continue}const ot=new Date(old.updatedAt||old.updated_at||old.modifiedAt||old.createdAt||old.created_at||0).getTime(),nt=new Date(v.updatedAt||v.updated_at||v.modifiedAt||v.createdAt||v.created_at||0).getTime();map.set(String(k),nt>=ot?mergeValue(old,v):mergeValue(v,old));}return [...map.values(),...out]}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){const o={...a};for(const k of Object.keys(b))o[k]=k in a?mergeValue(a[k],b[k]):clone(b[k]);return o}
 return b===undefined?clone(a):clone(b);
}
function merge(local,remote){if(!local)return clone(remote);if(!remote)return clone(local);return mergeValue(remote,local)}
function mark(x){localStorage.setItem(PENDING,JSON.stringify(x));refresh()}
function clear(){localStorage.removeItem(PENDING);refresh()}
function render(){try{if(typeof renderAll==='function')renderAll()}catch(e){console.warn(e)}}
function apply(x){if(!x||typeof x!=='object')return false;applying=true;try{db=x;write(x);last=JSON.stringify(x);render();window.dispatchEvent(new CustomEvent('panorama-core-personal-remote-update',{detail:{data:x}}));return true}finally{setTimeout(()=>applying=false,0)}}
if(!cfg?.url||!cfg?.key){refresh();return}
const H={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
async function getRemote(){const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW)+'&select=data,updated_at',{headers:H});if(!r.ok)throw new Error(await r.text());const a=await r.json();return a[0]||null}
async function put(data){const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?on_conflict=id',{method:'POST',headers:{...H,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:ROW,data})});if(!r.ok)throw new Error(await r.text());const a=await r.json();return a[0]||null}
async function publishPayments(data){const em=new Map((data?.employees||[]).map(e=>[String(e.id),e]));for(const p of data?.payments||[]){if(!p?.id||!p?.employeeId||!Number.isFinite(Number(p.amount)))continue;const e=em.get(String(p.employeeId))||{};await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?on_conflict=id',{method:'POST',headers:{...H,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:String(p.id),source:'personal',employee_id:String(p.employeeId),employee_name:String(e.name||p.employeeName||''),amount:Number(p.amount),paid_date:String(p.paidDate||p.date||'').slice(0,10)||null,period_start:p.periodStart||null,period_end:p.periodEnd||null,note:p.note||'',account:p.account||null,updated_at:new Date().toISOString()})})}}
async function sync(force=false){if(syncing||applying||!navigator.onLine)return false;syncing=true;try{const local=read(),queued=read(PENDING),base=queued||local;if(!base){const row=await getRemote();if(row?.data)apply(row.data);return true}
 const row=await getRemote();const combined=merge(base,row?.data||null);if(!same(combined,base)||force||queued){mark(combined);const saved=await put(combined);const confirmed=saved?.data||combined;apply(confirmed);try{await publishPayments(confirmed)}catch(e){console.warn('Pagos secundarios pendientes',e)}clear();last=JSON.stringify(confirmed);window.dispatchEvent(new Event('panorama-core-personal-synced'));return true}
 if(row?.data&&!same(row.data,local))apply(row.data);clear();return true
 }catch(e){const x=read(PENDING)||read();if(x)mark(x);console.warn('Panorama Personal: sincronización pendiente',e);return false}finally{syncing=false;refresh()}}
function observe(){let previous=JSON.stringify(read());setInterval(()=>{if(applying)return;const now=JSON.stringify(read());if(now!==previous){previous=now;const data=read();if(data){mark(data);setTimeout(()=>sync(),150)}}},500)}
window.addEventListener('online',()=>{refresh();sync(true)});window.addEventListener('offline',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
window.PanoramaPersonalSync={sync:()=>sync(true),status:()=>({online:navigator.onLine,pending:!!read(PENDING)}),merge};
refresh();observe();sync();setInterval(()=>sync(),PULL_MS);
})();