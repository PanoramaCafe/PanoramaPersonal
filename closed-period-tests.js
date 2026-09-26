const vm=require('vm'),fs=require('fs'),assert=require('assert');
const dir=(process.argv[2]||'.').replace(/\/?$/,'/');
const html=fs.readFileSync(dir+'index.html','utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const block=code.slice(code.indexOf('const STORE='), code.indexOf('renderAll();'));
function ctx(){
  const els={};
  const c={localStorage:{s:{},getItem(k){return this.s[k]??null},setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}},
    console,document:{getElementById:id=>els[id]||(els[id]={style:{},value:'',textContent:'',innerHTML:'',classList:{toggle(){},contains:()=>false,add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[]}),addEventListener(){},body:{appendChild(){},removeChild(){}},createElement:()=>({style:{},classList:{add(){},remove(){}}})},
    alert(){},confirm:()=>true,crypto:{randomUUID:()=>'id-'+Math.random().toString(36).slice(2)},
    addEventListener(){},dispatchEvent(){},setInterval(){},setTimeout,clearTimeout,navigator:{onLine:true},
    Event:class{constructor(t){this.type=t}},CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail}},
    Date,Math,JSON,Object,Array,Number,String,Boolean,isNaN,parseInt,parseFloat};
  c.window=c;vm.createContext(c);vm.runInContext(block,c);return c;
}
let fails=0;const t=(n,ok)=>{console.log(ok?'PASS':'FAIL',n);if(!ok)fails++};
const run=(c,s)=>vm.runInContext(s,c);
const K=ctx();
// Empleado Yescas, tarifa 30
run(K,'db.employees.push({id:"e1",name:"Yescas",rate:30,active:true})');
// Jornada correcta 14 sep: 19:31 a 22:00 (~2.48h) -> luego se revisa
run(K,'db.sessions.push({id:"s1",employeeId:"e1",entrada:"2026-09-14T19:31:00.000Z",salida:"2026-09-14T22:00:00.000Z",rateAtEntry:30})');
const before=run(K,'sessionPay(db.sessions[0])');
// Revisar semana 14-20 sep
run(K,'db.payrollPeriods["2026-09-14"]={id:"2026-09-14",start:"2026-09-14",end:"2026-09-20",status:"reviewed",reviewedAt:new Date().toISOString(),snapshot:buildPayrollSnapshot(new Date("2026-09-14T00:00:00"),new Date("2026-09-21T00:00:00"))}');
const frozenAmt=run(K,'db.payrollPeriods["2026-09-14"].snapshot.sessions["s1"].amount');
t('snapshot congela el monto original de la jornada',Math.abs(frozenAmt-before)<0.01);
t('sessionOutstanding usa el monto congelado antes de editar',Math.abs(run(K,'sessionOutstanding(db.sessions[0])')-before)<0.01);
// Editar la jornada como en el caso real: entrada 20:01->18:01 agrega horas (simulando el bug reportado)
run(K,'saveSession=saveSession'); // noop, aseguro existe
run(K,'document.getElementById("sesEmp").value="e1";document.getElementById("sesIn").value="2026-09-14T18:01";document.getElementById("sesOut").value="2026-09-14T22:00";saveSession("s1")');
const afterLive=run(K,'sessionPay(db.sessions[0])');
t('la jornada en vivo sí cambió (más horas)',afterLive>before+1);
t('el saldo pendiente de esa jornada SIGUE igual al monto revisado (no se cuela la deuda)',Math.abs(run(K,'sessionOutstanding(db.sessions[0])')-before)<0.01);
t('la nómina de la semana revisada (renderPayroll/snapshot) no cambió sola',Math.abs(run(K,'db.payrollPeriods["2026-09-14"].snapshot.totalAmount')-before)<0.01);
t('se registró un ajuste pendiente con el detalle correcto',(()=>{
  const adj=run(K,'JSON.stringify(db.payrollPeriods["2026-09-14"].adjustments["s1"])');
  const a=JSON.parse(adj);
  return a.status==='pending'&&Math.abs(a.before.amount-before)<0.01&&Math.abs(a.after.amount-afterLive)<0.01;
})());
t('allPendingAdjustments lo reporta',run(K,'allPendingAdjustments().length')===1);
// Descartar: la nómina revisada se mantiene igual
run(K,'dismissAdjustment("2026-09-14","s1")');
t('al descartar, el saldo sigue siendo el revisado (no el editado)',Math.abs(run(K,'sessionOutstanding(db.sessions[0])')-before)<0.01);
t('el ajuste descartado ya no aparece como pendiente',run(K,'allPendingAdjustments().length')===0);
// Aplicar (en otro caso): crear ajuste de nuevo editando otra vez
run(K,'document.getElementById("sesIn").value="2026-09-14T17:01";saveSession("s1")');
t('se generó un nuevo ajuste tras otra edición',run(K,'allPendingAdjustments().length')===1);
const liveNow=run(K,'sessionPay(db.sessions[0])');
run(K,'const id=Object.keys(db.payrollPeriods["2026-09-14"].adjustments)[0];applyAdjustment("2026-09-14",id)');
t('al aplicar, el saldo pasa a reflejar el nuevo valor',Math.abs(run(K,'sessionOutstanding(db.sessions[0])')-liveNow)<0.01);
t('ya no queda pendiente tras aplicar',run(K,'allPendingAdjustments().length')===0);
// Eliminar una jornada de un periodo revisado -> debe generar ajuste "deleted"
run(K,'db.sessions.push({id:"s2",employeeId:"e1",entrada:"2026-09-15T09:00:00.000Z",salida:"2026-09-15T13:00:00.000Z",rateAtEntry:30})');
run(K,'db.payrollPeriods["2026-09-14"]=(()=>{const p=db.payrollPeriods["2026-09-14"];p.snapshot=buildPayrollSnapshot(new Date("2026-09-14T00:00:00"),new Date("2026-09-21T00:00:00"));return p})()');
t('s2 quedó congelada en el snapshot',!!run(K,'db.payrollPeriods["2026-09-14"].snapshot.sessions["s2"]'));
run(K,'deleteSession("s2")');
t('eliminar una jornada revisada genera ajuste pendiente, no la borra silenciosamente del saldo',run(K,'allPendingAdjustments().length')===1&&run(K,'allPendingAdjustments()[0].deleted')===true);
// Reabrir periodo: recalcula todo con datos actuales y resuelve pendientes
run(K,'reopenPayrollPeriod("2026-09-14")');
t('reabrir resuelve los ajustes pendientes',run(K,'allPendingAdjustments().length')===0);
t('reabrir recalcula el total con las jornadas actuales (s1 editada, s2 ya no existe)',Math.abs(run(K,'db.payrollPeriods["2026-09-14"].snapshot.totalAmount')-run(K,'sessionPay(db.sessions[0])'))<0.01);
// Corte de saldo editable (reemplaza el parche fijo)
run(K,'db.employees.push({id:"e2",name:"Andrea",rate:40,active:true})');
run(K,'db.sessions.push({id:"s3",employeeId:"e2",entrada:"2026-09-01T09:00:00.000Z",salida:"2026-09-01T13:00:00.000Z",rateAtEntry:40})');
t('sin corte, la jornada vieja SÍ genera pendiente',run(K,'sessionOutstanding(db.sessions.find(s=>s.id==="s3"))')>0);
run(K,'document.getElementById("cutThrough").value="2026-09-05";document.getElementById("cutReason").value="Conciliado";saveBalanceCutoff("e2")');
t('con corte de saldo manual, la jornada anterior ya no genera pendiente',run(K,'sessionOutstanding(db.sessions.find(s=>s.id==="s3"))')===0);
run(K,'clearBalanceCutoff("e2")');
t('al quitar el corte, vuelve a generar pendiente',run(K,'sessionOutstanding(db.sessions.find(s=>s.id==="s3"))')>0);
// migración del parche fijo -> editable, una sola vez
const M=ctx();
run(M,'db.employees.push({id:"2530dcff-ca33-45be-a48c-f530c789bd09",name:"Edwin",rate:35,active:true})');
run(M,'const d=normalizeDB({employees:db.employees,sessions:[],payments:[],payrollPeriods:{}});db=d');
t('migración: Edwin recibe su corte legacy en datos editables',run(M,'db.balanceCutoffs["2530dcff-ca33-45be-a48c-f530c789bd09"].through')==='2026-09-14');
run(M,'clearBalanceCutoff("2530dcff-ca33-45be-a48c-f530c789bd09")');
run(M,'db=normalizeDB(db)');
t('tras quitarlo, la migración YA NO lo vuelve a poner (es de una sola vez)',run(M,'db.balanceCutoffs["2530dcff-ca33-45be-a48c-f530c789bd09"]')===undefined);
console.log(fails?'\nFALLOS: '+fails:'\nTODAS LAS PRUEBAS DEL PERIODO CERRADO PASARON');
process.exit(fails?1:0);
