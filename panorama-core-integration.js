/* Panorama Personal -> Panorama Café Core
   Prueba mínima: sincronizar empleados existentes al abrir la aplicación.
   Sin estado compartido, colas, polling, nómina ni pagos. */
(async function () {
  const cfg = window.PANORAMA_SUPABASE;
  if (!cfg?.url || !cfg?.key) return;

  const headers = {
    apikey: cfg.key,
    Authorization: 'Bearer ' + cfg.key,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  async function syncEmployee(employee) {
    const name = String(employee?.name || employee?.full_name || '').trim();
    if (!name) return null;

    const url = cfg.url + '/rest/v1/employees?full_name=eq.' + encodeURIComponent(name) + '&select=id,full_name';
    const existingResponse = await fetch(url, { headers });
    if (!existingResponse.ok) throw new Error(await existingResponse.text());
    const existing = await existingResponse.json();

    if (existing?.[0]) {
      employee.coreEmployeeId = existing[0].id;
      return existing[0];
    }

    const createResponse = await fetch(cfg.url + '/rest/v1/employees', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        full_name: name,
        active: employee.active !== false,
        created_by_app: 'personal',
        updated_by_app: 'personal'
      })
    });

    if (!createResponse.ok) throw new Error(await createResponse.text());
    const created = await createResponse.json();
    if (created?.[0]) employee.coreEmployeeId = created[0].id;
    return created?.[0] || null;
  }

  try {
    for (const employee of (db?.employees || [])) await syncEmployee(employee);
    if (typeof save === 'function') save();
    console.info('Panorama Core: empleados sincronizados');
  } catch (error) {
    console.error('Panorama Core: prueba mínima falló', error);
  }
})();
