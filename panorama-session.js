/* Panorama Personal — sesión de la nube (Supabase Auth, sin librerías).
   La tablet inicia sesión UNA vez con un usuario de Supabase; los empleados nunca la ven.
   Mientras no haya sesión, la app sigue usando la clave pública (compatible con las políticas actuales). */
(function(){
'use strict';
const KEY='panorama_personal_auth_v1',C=()=>window.PANORAMA_SUPABASE;
let inflight=null;
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
const notify=()=>{window.dispatchEvent(new Event('panorama-auth-change'));paint()};
function write(s){localStorage.setItem(KEY,JSON.stringify(s));notify()}
function clear(){localStorage.removeItem(KEY);notify()}
async function post(path,body){
  const c=C(),r=await fetch(c.url+'/auth/v1/'+path,{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error_description||j.msg||j.message||'Error de autenticación');e.status=r.status;throw e}
  return j;
}
const pack=(j,old)=>({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Math.floor(Date.now()/1000)+(j.expires_in||3600),email:j.user?.email||old?.email||''});
async function login(email,password){write(pack(await post('token?grant_type=password',{email,password})))}
function refresh(){
  if(inflight)return inflight;
  const s=read();
  if(!s?.refresh_token)return Promise.reject(new Error('sin sesión'));
  inflight=(async()=>{
    try{const n=pack(await post('token?grant_type=refresh_token',{refresh_token:s.refresh_token}),s);write(n);return n}
    catch(e){if(e.status===400||e.status===401||e.status===403)clear();throw e}
    finally{inflight=null}
  })();
  return inflight;
}
async function token(){
  const s=read();
  if(!s)return null;
  if(s.expires_at-60>Date.now()/1000||!navigator.onLine)return s.access_token;
  try{return (await refresh()).access_token}catch{return null}
}
async function headers(extra){
  const c=C(),t=await token();
  return {apikey:c.key,Authorization:'Bearer '+(t||c.key),'Content-Type':'application/json',...(extra||{})};
}
function paint(){
  const el=document.getElementById('cloudAuthStatus');if(!el)return;
  const s=read();
  el.textContent=s?'🟢 Sesión de la nube activa: '+s.email:'⚪ Sin sesión de la nube (usa la clave pública)';
}
function openLogin(){
  const s=read();
  openModal(`<div class="modalhead"><div><h2 style="margin:0">🔐 Sesión de la nube</h2><div class="muted">${s?'Sesión activa: '+esc(s.email):'Solo para el administrador. Los empleados no necesitan esto.'}</div></div><button class="close" onclick="closeModal()">✕</button></div>
  ${s?'':'<label>Correo</label><input id="paEmail" type="email" autocomplete="username"><label>Contraseña</label><input id="paPass" type="password" autocomplete="current-password"><div id="paErr" style="color:var(--bad);min-height:18px;margin-top:6px;font-weight:700"></div>'}
  <div class="actions"><button onclick="closeModal()">Cerrar</button>${s?'<button class="danger" onclick="PanoramaAuth.logout();closeModal()">Cerrar sesión</button>':'<button class="primary" onclick="PanoramaAuth.submit()">Entrar</button>'}</div>`);
}
async function submit(){
  const email=document.getElementById('paEmail')?.value.trim(),pass=document.getElementById('paPass')?.value,err=document.getElementById('paErr');
  if(!email||!pass){if(err)err.textContent='Escribe correo y contraseña.';return}
  try{await login(email,pass);closeModal();showToast('Sesión de la nube iniciada');window.PanoramaPersonalSync?.sync()}
  catch(e){if(err)err.textContent=e.message}
}
window.PanoramaAuth={headers,token,login,logout:clear,openLogin,submit,has:()=>!!read()};
paint();
})();
