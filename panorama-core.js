(function(){
const cfg=window.PANORAMA_SUPABASE;
if(!cfg) return;
const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',Prefer:'return=representation'};
const api=async(path,opt={})=>{const r=await fetch(cfg.url+'/rest/v1/'+path,{...opt,headers:{...headers,...(opt.headers||{})}});if(!r.ok)throw new Error(await r.text());const t=await r.text();return t?JSON.parse(t):null};
window.PanoramaCore={
 async syncEmployee(employee){
  const payload={full_name:employee.name||employee.full_name,active:employee.active!==false,created_by_app:'personal',updated_by_app:'personal'};
  let rows=null;
  if(employee.coreEmployeeId){
   rows=await api('employees?id=eq.'+encodeURIComponent(employee.coreEmployeeId),{method:'PATCH',body:JSON.stringify(payload)});
  }
  if(!rows?.[0]){
   rows=await api('employees',{method:'POST',body:JSON.stringify(payload)});
  }
  if(rows?.[0]) employee.coreEmployeeId=rows[0].id;
  return rows?.[0]||null;
 },
 async syncEmployees(employees){
  const out=[];
  for(const employee of (employees||[])) out.push(await this.syncEmployee(employee));
  return out;
 },
 async createPayrollRequest(line,period){
  const existing=await api('payroll_payment_requests?employee_id=eq.'+encodeURIComponent(line.coreEmployeeId||line.employeeId)+'&external_payroll_period_id=eq.'+encodeURIComponent(period.id)+'&select=id,status');
  if(existing?.[0]) return existing[0];
  const row={employee_id:line.coreEmployeeId||line.employeeId,external_payroll_period_id:period.id,period_start:period.start,period_end:period.end,amount:Number(line.amount),currency:'MXN',status:'PENDING_PAYMENT',notes:'Generado desde Panorama Personal',created_by_app:'personal',updated_by_app:'personal'};
  const created=await api('payroll_payment_requests',{method:'POST',body:JSON.stringify(row)});
  return created?.[0]||null;
 },
 async syncPayrollPeriod(period){
  if(!period?.snapshot?.employees?.length) return [];
  const out=[];
  for(const line of period.snapshot.employees){
   const employee=(typeof db!=='undefined'?db.employees:[]).find(e=>e.id===line.employeeId);
   if(!employee) continue;
   await this.syncEmployee(employee);
   line.coreEmployeeId=employee.coreEmployeeId;
   out.push(await this.createPayrollRequest({...line,coreEmployeeId:employee.coreEmployeeId},period));
  }
  return out;
 },
 async getPayrollStatus(periodId){return api('payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(periodId)+'&select=id,employee_id,amount,status,financial_payment_confirmations(amount,financial_movement_id,paid_at)')}
};
})();