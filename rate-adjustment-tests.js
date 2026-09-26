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

// Caso real: Andrea a $30, se sube a $35 SIN pulsar "Guardar" primero.
const K=ctx();
run(K,'db.employees.push({id:"andrea",name:"Andrea",rate:30,pin:"1111",active:true})');
run(K,'db.sessions.push({id:"s1",employeeId:"andrea",entrada:"2020-06-10T09:00:00.000Z",salida:"2020-06-10T13:00:00.000Z",rateAtEntry:30})');
// Simula: el admin abre "Editar trabajador", escribe 35 en el campo, y da clic directo en el botón de ajuste (sin Guardar)
run(K,'document.getElementById("empRate").value="35"');
t('antes del clic, la tarifa guardada en la base sigue siendo 30 (aún no se toca nada)',run(K,'db.employees[0].rate')===30);
run(K,'applyEmployeeRateThenAdjust("andrea")');
t('al abrir el ajuste, la tarifa ya quedó en 35 (no en 30)',run(K,'db.employees[0].rate')===35);
run(K,'document.getElementById("rateEffectiveDate").value="2020-06-01"');
run(K,'applyRateAdjustment("andrea")');
t('la jornada quedó con rateAtEntry=35, no 30',run(K,'db.sessions[0].rateAtEntry')===35);
t('el pago de la jornada se recalculó con 35 (4h x 35 = 140)',Math.abs(run(K,'sessionPay(db.sessions[0])')-140)<0.01);

// Caso: la jornada ya pertenece a una semana revisada -> debe generar ajuste, no cambiar la nómina congelada sola
const A=ctx();
run(A,'db.employees.push({id:"andrea",name:"Andrea",rate:30,pin:"1111",active:true})');
run(A,'db.sessions.push({id:"s1",employeeId:"andrea",entrada:"2020-06-10T09:00:00.000Z",salida:"2020-06-10T13:00:00.000Z",rateAtEntry:30})');
run(A,'db.payrollPeriods["2020-06-08"]={id:"2020-06-08",start:"2020-06-08",end:"2020-06-14",status:"reviewed",reviewedAt:new Date().toISOString(),snapshot:buildPayrollSnapshot(new Date("2020-06-08T00:00:00"),new Date("2020-06-15T00:00:00"))}');
const frozenBefore=run(A,'db.payrollPeriods["2020-06-08"].snapshot.totalAmount');
run(A,'document.getElementById("empRate").value="35"');
run(A,'applyEmployeeRateThenAdjust("andrea")');
run(A,'document.getElementById("rateEffectiveDate").value="2020-06-01"');
run(A,'applyRateAdjustment("andrea")');
t('la jornada en vivo ya paga con 35',Math.abs(run(A,'sessionPay(db.sessions[0])')-140)<0.01);
t('pero la nómina de la semana YA REVISADA no cambió sola',Math.abs(run(A,'db.payrollPeriods["2020-06-08"].snapshot.totalAmount')-frozenBefore)<0.01);
t('se generó un ajuste pendiente por el cambio de tarifa retroactivo',run(A,'allPendingAdjustments().length')===1);
t('el saldo pendiente de esa jornada sigue anclado a lo revisado (120), no a lo nuevo (140)',Math.abs(run(A,'sessionOutstanding(db.sessions[0])')-frozenBefore)<0.01);

console.log(fails?'\nFALLOS: '+fails:'\nTODAS LAS PRUEBAS DE TARIFA RETROACTIVA PASARON');
process.exit(fails?1:0);
