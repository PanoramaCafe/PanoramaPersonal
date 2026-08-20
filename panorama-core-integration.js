/* Panorama Core integration: Personal */
(async()=>{
  const cfg=window.PANORAMA_SUPABASE;
  if(!cfg){console.warn('Panorama Core: missing config');return;}
  const api=cfg.url+'/rest/v1/';
  const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
  async function request(path,opts={}){
    const response=await fetch(api+path,{...opts,headers:{...headers,...opts.headers}});
    const body=await response.text();
    if(!response.ok)throw new Error(body||response.statusText);
    return body?JSON.parse(body):null;
  }
  function requestKey(periodId,employeeId){return 'personal:'+periodId+':'+employeeId;}
  window.PanoramaCore={
    async syncEmployee(employee){
      const payload={full_name:employee.name||employee.full_name,active:employee.active!==false,created_by_app:'personal',updated_by_app:'personal'};
      if(employee.coreEmployeeId){
        const rows=await request('employees?id=eq.'+encodeURIComponent(employee.coreEmployeeId),{method:'PATCH',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});
        if(rows?.[0])return rows[0];
      }
      const rows=await request('employees',{method:'POST',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});
      if(!rows?.[0])throw new Error('No se pudo crear el empleado en Panorama Core.');
      employee.coreEmployeeId=rows[0].id;
      return rows[0];
    },
    async createPayrollRequest(employee,amount,periodStart,periodEnd,periodId){
      const externalId=requestKey(periodId,employee.id);
      const existing=await request('payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(externalId)+'&select=*');
      if(existing?.[0])return existing[0];
      const coreEmployee=await this.syncEmployee(employee);
      const payload={employee_id:coreEmployee.id,external_payroll_period_id:externalId,period_start:periodStart,period_end:periodEnd,amount:Number(amount),currency:'MXN',status:'PENDING_PAYMENT',created_by_app:'personal',updated_by_app:'personal'};
      try{
        const rows=await request('payroll_payment_requests',{method:'POST',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});
        return rows?.[0];
      }catch(error){
        const raced=await request('payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(externalId)+'&select=*');
        if(raced?.[0])return raced[0];
        throw error;
      }
    },
    async syncFinalizedPeriod(period){
      const created=[];
      for(const item of period.snapshot.employees){
        const employee=period.localEmployees.find(e=>e.id===item.employeeId);
        if(!employee)continue;
        const row=await this.createPayrollRequest(employee,item.amount,period.start,period.end,period.id);
        created.push({employeeId:item.employeeId,requestId:row?.id,status:row?.status});
      }
      return created;
    },
    paymentStatus(periodId,employeeId){
      return request('payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(requestKey(periodId,employeeId))+'&select=id,status,paid_at');
    }
  };
  window.dispatchEvent(new CustomEvent('panorama-core-personal-ready'));
})();