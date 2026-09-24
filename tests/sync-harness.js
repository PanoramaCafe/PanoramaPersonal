const vm=require('vm'),fs=require('fs');
const dir=(process.argv[2]||'.').replace(/\/?$/,'/');
const idx=fs.readFileSync(dir+'index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const block=idx.slice(idx.indexOf('const STORE='),idx.indexOf('function showView'));
const sess=fs.readFileSync(dir+'panorama-session.js','utf8');const core=fs.readFileSync(dir+'panorama-core-integration.js','utf8'),bridge=fs.readFileSync(dir+'panorama-auth.js','utf8');
const server={state:null,payroll:[],posts:0,lock:false,auths:[],refreshCalls:0,refreshFail:false,seenAuth:[]};
function device(){
  const ls=new Map(),els={};
  const ctx={PANORAMA_SUPABASE:{url:'http://x',key:'k'},navigator:{onLine:true},console:{...console,warn(){}},
    localStorage:{getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,String(v)),removeItem:k=>ls.delete(k)},
    document:{getElementById:i=>els[i]||null,createElement:()=>({style:{}}),body:{append(e){els[e.id]=e}},documentElement:{},addEventListener(){}},
    MutationObserver:class{observe(){}},CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail}},Event:class{constructor(t){this.type=t}},
    setInterval:()=>0,setTimeout:(f,ms)=>ms===700?0:setTimeout(f,ms),clearTimeout,renderAll(){},hooks:{},
    addEventListener(t,f){(ctx.L[t]=ctx.L[t]||[]).push(f)},dispatchEvent(e){(ctx.L[e.type]||[]).forEach(f=>f(e))},L:{}};
  ctx.window=ctx;ctx.alert=()=>{};
  ctx.fetch=async(url,o={})=>{
    const ok=(b)=>({ok:true,status:200,json:async()=>b,text:async()=>''});
    if(url.includes('/auth/v1/token')){const b=JSON.parse(o.body);
      if(url.includes('password'))return ok({access_token:'at1',refresh_token:'rt1',expires_in:3600,user:{email:b.email}});
      server.refreshCalls++;await new Promise(r=>setTimeout(r,20));
      if(server.refreshFail)return {ok:false,status:400,json:async()=>({error_description:'invalid refresh token'}),text:async()=>''};
      return ok({access_token:'at2',refresh_token:'rt2',expires_in:3600,user:{email:'tablet@x'}})}
    if(url.includes('/rest/v1/')){server.seenAuth.push(o.headers?.Authorization);
      if(server.lock&&o.headers?.Authorization==='Bearer k')return {ok:false,status:401,json:async()=>({}),text:async()=>'401'}}
    if(url.includes('panorama_personal_state')){
      if(!o.method)return ok(server.state?[{data:JSON.parse(JSON.stringify(server.state))}]:[]);
      if(ctx.hooks.beforePut)ctx.hooks.beforePut();
      server.state=JSON.parse(JSON.parse(o.body).data?JSON.stringify(JSON.parse(o.body).data):'null');server.posts++;return ok([{id:'personal-main',data:JSON.parse(JSON.stringify(server.state))}]);
    }
    if(url.includes('panorama_payroll_payments')){server.payroll.push(JSON.parse(o.body));return ok([])}
    return ok([]);
  };
  vm.createContext(ctx);vm.runInContext(block,ctx);vm.runInContext(sess,ctx);vm.runInContext(core,ctx);vm.runInContext(bridge,ctx);return ctx;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));const SY=async c=>{await wait(15);let r=await c.PanoramaPersonalSync.sync();await wait(15);return r};
const run=(c,s)=>vm.runInContext(s,c);
let fails=0;const t=(n,c)=>{console.log((c?'PASS':'FAIL'),n);if(!c)fails++};
(async()=>{
  const e1={id:'e1',name:'Ana',rate:50,pin:'1111',active:true};
  server.state={employees:[e1],sessions:[],payments:[{id:'pagoX',employeeId:'e1',amount:500,type:'payment',paidDate:'2026-09-10',periodStart:'2026-09-01',periodEnd:'2026-09-07'},{id:'bonoY',employeeId:'e1',amount:100,type:'bonus',paidDate:'2026-09-11'}],approvals:{},weekFinalizations:{},payrollPeriods:{},adminPin:'4321'};
  const K=device();await wait(80);
  t('K recibe el remoto en su db real (antes quedaba viejo)',run(K,'db.payments.length')===2&&run(K,'db.adminPin')==='4321');
  run(K,'db.sessions.unshift({id:"s1",employeeId:"e1",entrada:"2026-09-14T09:00:00Z",salida:null});save()');
  await SY(K);
  t('Guardar en dispositivo con datos recibidos NO borra el pago remoto',server.state.payments.length===2&&server.state.sessions.length===1);
  // otro dispositivo cierra la sesión
  const A=device();await wait(80);run(A,'db.sessions[0].salida="2026-09-14T15:00:00Z";save()');await SY(A);
  await SY(K);
  t('K ve la salida hecha en A',run(K,'db.sessions[0].salida')==='2026-09-14T15:00:00Z');
  run(K,'db.payments.unshift({id:"p3",employeeId:"e1",amount:10,type:"payment",paidDate:"2026-09-12"});save()');await SY(K);
  t('Salida de A no se revierte tras guardar en K',server.state.sessions[0].salida==='2026-09-14T15:00:00Z'&&server.state.payments.length===3);
  // edición durante la sincronización
  K.hooks.beforePut=()=>{K.hooks.beforePut=null;run(K,'db.employees[0].name="Ana M";save()')};
  run(K,'db.payments.unshift({id:"p4",employeeId:"e1",amount:20,type:"payment",paidDate:"2026-09-13"});save()');
  await SY(K);await SY(K);
  t('Edición hecha durante el sync no se pierde (db y remoto)',run(K,'db.employees[0].name')==='Ana M'&&server.state.employees[0].name==='Ana M');
  // freno de cambios masivos
  server.state.sessions=Array.from({length:6},(_,i)=>({id:'q'+i,employeeId:'e1',entrada:'2026-09-0'+(i+1)+'T09:00:00Z',salida:'2026-09-0'+(i+1)+'T15:00:00Z'}));
  await SY(K);await SY(K);
  run(K,'db.sessions=[];save()');const before=server.state.sessions.length;await SY(K);
  t('Freno: borrar >50% de jornadas sin autorización NO llega al remoto',server.state.sessions.length===before&&before>=4);
  K.PanoramaPersonalSync.allowBulk();await SY(K);
  t('Con autorización explícita (importar/reset) sí se aplica',server.state.sessions.length===0);
  // normalización de importación
  t('normalizeDB completa campos faltantes',run(K,'JSON.stringify(Object.keys(normalizeDB({employees:[],sessions:[]})).sort())').includes('payments'));
  // puente
  await wait(400);await K.PanoramaPaymentBridge.reconcile();
  const rows=server.payroll.flat();
  t('Puente publica en lote (1 petición) e incluye bonos',server.payroll.length>=1&&rows.some(r=>r.id==='bonoY')&&Array.isArray(server.payroll[0]));
  // ---- sesión de la nube ----
  server.seenAuth=[];await SY(K);
  t('Sin sesión: usa la clave pública',server.seenAuth.length>0&&server.seenAuth.every(a=>a==='Bearer k'));
  server.lock=true;await SY(K);await wait(20);
  t('Con acceso público cerrado y sin sesión, el indicador pide iniciar sesión',(K.document.getElementById('panoramaSyncStatus').textContent||'').includes('Iniciar sesión'));
  await K.PanoramaAuth.login('tablet@x','pw');await wait(30);
  server.seenAuth=[];run(K,'db.payments.unshift({id:"p9",employeeId:"e1",amount:5,type:"payment",paidDate:"2026-09-20"});save()');await SY(K);
  t('Tras iniciar sesión se envía el token y sincroniza aunque el acceso público esté cerrado',server.seenAuth.length>0&&server.seenAuth.every(a=>a==='Bearer at1')&&server.state.payments.some(p=>p.id==='p9'));
  const sv=JSON.parse(run(K,'localStorage.getItem("panorama_personal_auth_v1")'));sv.expires_at=1;run(K,'localStorage.setItem("panorama_personal_auth_v1",'+JSON.stringify(JSON.stringify(sv))+')');
  server.refreshCalls=0;const [h1,h2]=await Promise.all([K.PanoramaAuth.headers(),K.PanoramaAuth.headers()]);
  t('Token vencido: se renueva una sola vez aunque haya llamadas simultáneas',server.refreshCalls===1&&h1.Authorization==='Bearer at2'&&h2.Authorization==='Bearer at2');
  const sv2=JSON.parse(run(K,'localStorage.getItem("panorama_personal_auth_v1")'));sv2.expires_at=1;run(K,'localStorage.setItem("panorama_personal_auth_v1",'+JSON.stringify(JSON.stringify(sv2))+')');
  server.refreshFail=true;const h3=await K.PanoramaAuth.headers();
  t('Renovación rechazada: se limpia la sesión y no se rompe la app',h3.Authorization==='Bearer k'&&!K.PanoramaAuth.has());
  console.log(fails?'\nFALLOS: '+fails:'\nTODAS LAS PRUEBAS PASARON');
  process.exit(fails?1:0);
})();
