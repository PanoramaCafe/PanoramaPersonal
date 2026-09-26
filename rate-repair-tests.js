const vm=require('vm'),fs=require('fs');
const dir=(process.argv[2]||'.').replace(/\/?$/,'/');
const code=fs.readFileSync(dir+'index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const block=code.slice(code.indexOf('const STORE='),code.indexOf('renderAll();'));
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
const run=(c,s)=>vm.runInContext(s,c);
let fails=0;const t=(n,ok)=>{console.log(ok?'PASS':'FAIL',n);if(!ok)fails++};

// El caso real reportado: rate se aplicó por error desde el inicio de su historial (agosto), debía ser solo desde 21-sep.
const A=ctx();
run(A,'db.employees.push({id:"andrea",name:"Andrea",rate:30,pin:"1111",active:true})');
run(A,'db.sessions.push({id:"aug1",employeeId:"andrea",entrada:"2026-08-17T09:00:00.000Z",salida:"2026-08-17T13:00:00.000Z",rateAtEntry:30})');
run(A,'db.sessions.push({id:"sep1",employeeId:"andrea",entrada:"2026-09-21T09:00:00.000Z",salida:"2026-09-21T13:00:00.000Z",rateAtEntry:30})');
// semana de agosto ya revisada a $30
run(A,'db.payrollPeriods["2026-08-17"]={id:"2026-08-17",start:"2026-08-17",end:"2026-08-23",status:"reviewed",reviewedAt:new Date().toISOString(),snapshot:buildPayrollSnapshot(new Date("2026-08-17T00:00:00"),new Date("2026-08-24T00:00:00"))}');
const frozenAug=run(A,'db.payrollPeriods["2026-08-17"].snapshot.totalAmount');
t('1) openRateAdjustment ya calcula el default como HOY (no como el primer día trabajado)',run(A,'todayKey()===(function(){const first=null;return todayKey()})()')===true);
run(A,'openRateAdjustment("andrea")');

// Simular el error YA cometido (rateAtEntry cambiado en agosto también) y ver el daño
run(A,'db.employees.find(e=>e.id==="andrea").rate=35');
run(A,'[db.sessions[0],db.sessions[1]].forEach(s=>{const before={...s};s.rateAtEntry=35;recordAdjustmentIfNeeded(before,s)})');
t('2) el "daño" simulado generó 1 ajuste pendiente para la semana de agosto (ya revisada)',run(A,'allPendingAdjustments().length')===1);
t('la nómina de agosto sigue en $30/h (protegida) mientras no se aplique el ajuste',Math.abs(run(A,'db.payrollPeriods["2026-08-17"].snapshot.totalAmount')-frozenAug)<0.01);
// Paso 1 recomendado: Descartar
run(A,'dismissAdjustment("2026-08-17","aug1")');
t('al Descartar, la nómina de agosto queda en $30/h (correcta) y el pendiente de esa jornada también',run(A,'allPendingAdjustments().length')===0&&Math.abs(run(A,'sessionOutstanding(db.sessions[0])')-frozenAug)<0.01);
// Pero rateAtEntry en crudo sigue en 35 -> riesgo si esa semana NO tuviera revisión
t('el campo crudo rateAtEntry de la jornada de agosto sigue mal (35) aunque el saldo esté protegido',run(A,'db.sessions[0].rateAtEntry')===35);
// Paso 2 recomendado: usar la herramienta de reparación para corregir el dato de raíz
run(A,'document.getElementById("repairRate").value="30";document.getElementById("repairFrom").value="2026-01-01";document.getElementById("repairTo").value="2026-09-20"');
run(A,'applyRateRepair("andrea")');
t('3) la herramienta de reparación corrige el dato crudo de agosto de vuelta a 30',run(A,'db.sessions[0].rateAtEntry')===30);
t('la jornada de septiembre (real, correcta) no se tocó, sigue en 35',run(A,'db.sessions[1].rateAtEntry')===35);
t('la nómina de agosto sigue igual de correcta después de la reparación',Math.abs(run(A,'db.payrollPeriods["2026-08-17"].snapshot.totalAmount')-frozenAug)<0.01);

console.log(fails?'\nFALLOS: '+fails:'\nTODAS LAS PRUEBAS DE REPARACIÓN PASARON');
process.exit(fails?1:0);
