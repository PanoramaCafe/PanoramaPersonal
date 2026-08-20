(()=>{
const ENDPOINT='https://dtmhffgpwxzdncbuoohb.supabase.co/functions/v1/panorama-personal-sync';
const APIKEY='sb_publishable_S_wZkfLNvx0mnHBLGHcfgg_Q_SkycdW';
let key=null,last='',ready=false,applying=false,lastRemote='';
const headers={'Content-Type':'application/json','apikey':APIKEY,'Authorization':'Bearer '+APIKEY};
const score=(o)=>{if(!o||typeof o!=='object'||Array.isArray(o))return 0;const k=Object.keys(o).join(' ').toLowerCase();let s=0;['employee','emplead','session','attendance','work','hora','payment','pago','payroll','nomina','bonus','bono','review','week'].forEach(x=>{if(k.includes(x))s+=2});return s};
function find(){let best=null,bs=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);try{const v=JSON.parse(localStorage.getItem(k));const s=score(v);if(s>bs){bs=s;best={key:k,data:v}}}catch{}}return best}
function fingerprint(v){try{return JSON.stringify(v)}catch{return ''}}
async function getRemote(){const r=await fetch(ENDPOINT,{method:'GET',headers,cache:'no-store'});if(!r.ok)throw new Error('GET '+r.status+' '+await r.text());return await r.json()}
async function push(data){const r=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({data:{__panorama_sync:true,key,data}})});if(!r.ok)throw new Error('POST '+r.status+' '+await r.text())}
function remotePayload(row){if(!row||!row.data)return null;const d=row.data;return d&&d.__panorama_sync?d:null}
async function boot(){try{const row=await getRemote();const p=remotePayload(row);const found=find();if(p){key=p.key||key||(found&&found.key);const remote=fingerprint(p.data);if(key&&remote!==fingerprint(found&&found.data)){applying=true;localStorage.setItem(key,remote);localStorage.setItem('__panorama_remote_state_v1',remote);applying=false;location.reload();return}last=remote;lastRemote=remote}else if(found){key=found.key;last=fingerprint(found.data);await push(found.data);lastRemote=last}ready=true}catch(e){ready=true;console.warn('Panorama sync offline',e)}}
async function tick(){const found=key?(()=>{try{return {key,data:JSON.parse(localStorage.getItem(key))}}catch{return find()}})():find();if(found){key=found.key;const cur=fingerprint(found.data);if(ready&&cur!==last&&!applying){last=cur;try{await push(found.data);lastRemote=cur}catch(e){console.warn('Pendiente de sincronizar',e)}}}if(ready&&navigator.onLine){try{const row=await getRemote();const p=remotePayload(row);if(p){const remote=fingerprint(p.data);if(remote!==lastRemote&&remote!==last){key=p.key||key;applying=true;localStorage.setItem(key,remote);localStorage.setItem('__panorama_remote_state_v1',remote);applying=false;location.reload();return}lastRemote=remote}}catch{}}}
window.addEventListener('online',tick);window.addEventListener('focus',tick);setInterval(tick,2500);boot();
})();