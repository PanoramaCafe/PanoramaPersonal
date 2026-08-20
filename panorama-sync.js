(()=>{
const ENDPOINT='https://dtmhffgpwxzdncbuoohb.supabase.co/functions/v1/panorama-personal-sync-v2';
const APIKEY='sb_publishable_S_wZkfLNvx0mnHBLGHcfgg_Q_SkycdW';
const headers={'Content-Type':'application/json','apikey':APIKEY,'Authorization':'Bearer '+APIKEY};
let key=null,last='',remote='',ready=false,applying=false,busy=false;
const fp=v=>JSON.stringify(v);
function find(){for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);try{const d=JSON.parse(localStorage.getItem(k));if(d&&typeof d==='object'&&!Array.isArray(d)&&(/employee|emplead|hora|pago|nomina|bono/i.test(Object.keys(d).join(' '))))return {key:k,data:d}}catch{}}return null}
async function api(method,body){const r=await fetch(ENDPOINT,{method,headers,cache:'no-store',body:body?JSON.stringify(body):undefined});const t=await r.text();if(!r.ok)throw Error(method+' '+r.status+' '+t);return t?JSON.parse(t):null}
async function upload(data){await api('POST',{data:{__panorama_sync:true,key,data}})}
function unpack(row){return row?.data?.__panorama_sync?row.data:null}
function apply(p){if(!p?.data)return;key=p.key||key;const s=fp(p.data);applying=true;localStorage.setItem(key,s);last=s;remote=s;applying=false;location.reload()}
async function start(){const f=find();if(f){key=f.key;last=fp(f.data)}try{const row=await api('GET');const p=unpack(row);if(p){const s=fp(p.data);if(s!==last)apply(p);else remote=s}else if(f){await upload(f.data);remote=last}}catch(e){console.warn('Panorama Personal offline',e)}ready=true}
async function sync(){if(busy||applying)return;busy=true;try{const f=key?(()=>{try{return {key,data:JSON.parse(localStorage.getItem(key))}}catch{return find()}})():find();if(f){key=f.key;const s=fp(f.data);if(s!==last){last=s;try{await upload(f.data);remote=s}catch(e){console.warn('Pendiente',e)}}}if(ready&&navigator.onLine){const row=await api('GET');const p=unpack(row);if(p){const s=fp(p.data);if(s!==remote&&s!==last)apply(p);else remote=s}}}catch(e){console.warn('Panorama sync',e)}finally{busy=false}}
window.addEventListener('online',sync);window.addEventListener('focus',sync);setInterval(sync,2000);start();
})();