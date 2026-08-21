/* Panorama Café · Personal → Finanzas
   Puente directo de pagos de nómina.
   Cada pago conserva un id único para que Finanzas pueda reconocerlo una sola vez. */
(function(){
  function config(){
    const cfg=window.PANORAMA_SUPABASE||{};
    const key=cfg.key||cfg.anonKey;
    if(!cfg.url||!key) throw new Error('Supabase no configurado');
    return {url:cfg.url,key};
  }
  function cleanDate(value){
    if(!value) return new Date().toISOString().slice(0,10);
    return String(value).slice(0,10);
  }
  window.PanoramaPayrollBridge={
    async publish(payment){
      if(!payment||!payment.id) throw new Error('Pago inválido');
      const cfg=config();
      const amount=Number(payment.amount||0);
      if(!Number.isFinite(amount)||amount<0) throw new Error('Monto inválido');
      const body={
        id:String(payment.id),
        source:'personal',
        employee_id:String(payment.employeeId||''),
        employee_name:String(payment.employeeName||payment.name||''),
        amount,
        paid_date:cleanDate(payment.paidDate),
        period_start:payment.periodStart?cleanDate(payment.periodStart):null,
        period_end:payment.periodEnd?cleanDate(payment.periodEnd):null,
        note:String(payment.note||''),
        account:payment.account?String(payment.account):null,
        updated_at:new Date().toISOString()
      };
      if(!body.employee_id) throw new Error('Empleado inválido');
      const r=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?on_conflict=id',{
        method:'POST',
        headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(body)
      });
      if(!r.ok) throw new Error((await r.text())||r.statusText);
      return {ok:true,id:body.id};
    },
    async list(){
      const cfg=config();
      const r=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?select=*&order=paid_date.desc,created_at.desc',{headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key}});
      if(!r.ok) throw new Error((await r.text())||r.statusText);
      return r.json();
    }
  };
})();