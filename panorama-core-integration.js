/* Panorama Personal -> Panorama Café Core
   Integración mínima y segura para la app existente.
   No toca interfaz, reloj, nómina ni datos locales.
   Lee la misma clave de localStorage que usa Panorama Personal y sincroniza empleados.
*/
(function(){
  const STORE='panorama_cafe_personal_v1';
  const cfg=window.PANORAMA_SUPABASE;
  if(!cfg?.url||!cfg?.key){console.warn('Panorama Core: falta configuración Supabase');return;}

  const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',Prefer:'return=representation'};

  function readLocalEmployees(){
    try{
      if(window.db&&Array.isArray(window.db.employees)) return window.db.employees;
      const raw=localStorage.getItem(STORE);
      const state=raw?JSON.parse(raw):null;
      return Array.isArray(state?.employees)?state.employees:[];
    }catch(error){console.error('Panorama Core: no se pudieron leer empleados locales',error);return [];}
  }

  async function syncEmployee(employee){
    const name=String(employee?.name||employee?.full_name||'').trim();
    if(!name) return null;
    const endpoint=cfg.url+'/rest/v1/employees?full_name=eq.'+encodeURIComponent(name)+'&select=id,full_name';
    const found=await fetch(endpoint,{headers});
    if(!found.ok) throw new Error('Consulta employees: '+found.status+' '+await found.text());
    const existing=await found.json();
    if(existing?.[0]) return existing[0];
    const created=await fetch(cfg.url+'/rest/v1/employees',{method:'POST',headers,body:JSON.stringify({full_name:name,active:employee.active!==false,created_by_app:'personal',updated_by_app:'personal'})});
    if(!created.ok) throw new Error('Alta employee: '+created.status+' '+await created.text());
    const rows=await created.json();
    return rows?.[0]||null;
  }

  async function run(){
    const employees=readLocalEmployees();
    console.info('Panorama Core: empleados locales detectados',employees.length);
    for(const employee of employees) await syncEmployee(employee);
    console.info('Panorama Core: sincronización mínima terminada');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>run().catch(e=>console.error('Panorama Core:',e)),300),{once:true});
  else setTimeout(()=>run().catch(e=>console.error('Panorama Core:',e)),300);
})();
