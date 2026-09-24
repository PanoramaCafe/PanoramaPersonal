/* Panorama Personal — puente de pagos hacia Finanzas (nombre de archivo conservado por compatibilidad).
   Único publicador de pagos a panorama_payroll_payments. Nunca borra filas remotas.
   Si supabase-config.js define softDelete:true (y la tabla tiene la columna deleted_at, ver docs/),
   los pagos eliminados en Personal se marcan con deleted_at en lugar de quedarse como fantasmas. */
(function(){
'use strict';
const cfg=()=>window.PANORAMA_SUPABASE,TOMB='panorama_personal_payment_tombstones';
let lastSignature='',busy=false;
const getDB=()=>(typeof window.__panoramaGetDB==='function'?window.__panoramaGetDB():window.db)||null;
const rd=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
async function request(path,opt={}){
  const c=cfg();
  if(!c?.url||!c?.key||!navigator.onLine)throw new Error('offline');
  const r=await fetch(c.url+'/rest/v1/'+path,{...opt,headers:window.PanoramaAuth?await window.PanoramaAuth.headers(opt.headers):{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json',...(opt.headers||{})},cache:'no-store'});
  if(!r.ok)throw new Error(await r.text());
  return r;
}
const valid=p=>p&&p.id&&p.employeeId&&Number.isFinite(+p.amount);
function toRow(p,emps){
  const e=emps.get(String(p.employeeId))||{};
  return {id:String(p.id),source:'personal',employee_id:String(p.employeeId),employee_name:String(e.name||p.employeeName||''),amount:Number(p.amount),paid_date:String(p.paidDate||p.date||'').slice(0,10)||null,period_start:p.periodStart||null,period_end:p.periodEnd||null,note:p.note||'',account:p.account||null,updated_at:new Date().toISOString()};
}
async function flushDeleted(){
  if(cfg()?.softDelete!==true)return;
  const ids=rd(TOMB)||[];
  if(!ids.length)return;
  await request('panorama_payroll_payments?id=in.('+ids.map(encodeURIComponent).join(',')+')',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({deleted_at:new Date().toISOString()})});
  localStorage.removeItem(TOMB);
}
async function reconcile(){
  if(busy)return;
  const state=getDB();
  if(!state)return;
  const payments=(state.payments||[]).filter(valid);
  const signature=JSON.stringify(payments.map(p=>[p.id,p.amount,p.paidDate,p.periodStart,p.periodEnd,p.employeeId,p.note]))+JSON.stringify((rd(TOMB)||[]));
  if(signature===lastSignature)return;
  busy=true;
  try{
    const emps=new Map((state.employees||[]).map(e=>[String(e.id),e]));
    for(let i=0;i<payments.length;i+=100){
      await request('panorama_payroll_payments?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payments.slice(i,i+100).map(p=>toRow(p,emps)))});
    }
    await flushDeleted();
    lastSignature=signature;
    window.dispatchEvent(new CustomEvent('panorama-payment-bridge-sync',{detail:{count:payments.length}}));
  }catch(e){console.warn('Puente Personal→Finanzas pendiente',e)}
  finally{busy=false}
}
function markDeleted(id){
  if(cfg()?.softDelete!==true)return;
  const ids=rd(TOMB)||[];
  if(!ids.includes(String(id)))ids.push(String(id));
  localStorage.setItem(TOMB,JSON.stringify(ids));
  setTimeout(reconcile,0);
}
window.PanoramaPaymentBridge={reconcile,markDeleted};
['panorama-local-saved','panorama-core-personal-remote-update','online'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(reconcile,300)));
setTimeout(()=>{reconcile();setInterval(reconcile,4000)},0);
})();
