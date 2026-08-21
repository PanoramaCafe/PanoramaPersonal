/* Panorama Café · Personal → Finanzas
   Puente de pagos de nómina. Se integra desde la app principal.
   Contrato: cada pago conserva un id único para evitar duplicados. */
window.PanoramaPayrollBridge = {
  async publish(payment) {
    if (!payment || !payment.id) throw new Error('Pago inválido');
    const cfg = window.PANORAMA_SUPABASE;
    if (!cfg?.url || !cfg?.anonKey) throw new Error('Supabase no configurado');
    const body = {
      id: payment.id,
      source: 'personal',
      employee_id: payment.employeeId,
      amount: Number(payment.amount || 0),
      paid_date: payment.paidDate,
      period_start: payment.periodStart || null,
      period_end: payment.periodEnd || null,
      note: payment.note || '',
      account: payment.account || null,
      updated_at: new Date().toISOString()
    };
    const r = await fetch(`${cfg.url}/rest/v1/panorama_payroll_payments?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': cfg.anonKey,
        'Authorization': `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    return true;
  }
};
