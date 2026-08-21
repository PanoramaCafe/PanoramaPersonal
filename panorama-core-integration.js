/* Panorama Personal <-> Panorama Café Core
   Un único estado local sincronizado con Supabase.
   Los cambios remotos se detectan por el contenido real del estado.
*/
(function () {
  const cfg = window.PANORAMA_SUPABASE;
  const STORE = 'panorama_cafe_personal_v1';
  const ROW_ID = 'personal-main';
  const SYNC_DELAY = 100;
  const PULL_INTERVAL = 1000;

  if (!cfg?.url || !cfg?.key) {
    console.warn('Panorama Personal: falta configuración Supabase');
    return;
  }

  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json'
  };

  let pushing = false;
  let applyingRemote = false;
  let pushTimer = null;
  let lastRemoteSignature = null;

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || 'null');
    } catch {
      return null;
    }
  }

  function stateSignature(data) {
    try {
      return JSON.stringify(data);
    } catch {
      return '';
    }
  }

  function applyRemoteState(data, updatedAt) {
    if (!data || typeof data !== 'object') return false;

    const remoteSignature = stateSignature(data);
    if (remoteSignature === stateSignature(readState())) return false;

    applyingRemote = true;
    try {
      db = data;
      localStorage.setItem(STORE, remoteSignature);
      renderAll();

      window.dispatchEvent(new CustomEvent('panorama-core-personal-remote-update', {
        detail: { data, updatedAt }
      }));

      return true;
    } catch (error) {
      console.error('Panorama Personal: no se pudo aplicar el estado remoto', error);
      return false;
    } finally {
      queueMicrotask(() => {
        applyingRemote = false;
      });
    }
  }

  async function publishPayments(data) {
    const payments = Array.isArray(data?.payments) ? data.payments : [];
    const employees = new Map(
      (Array.isArray(data?.employees) ? data.employees : [])
        .map(employee => [String(employee.id), employee])
    );

    for (const payment of payments) {
      if (!payment?.id || !payment?.employeeId || !Number.isFinite(Number(payment.amount))) {
        continue;
      }

      const employee = employees.get(String(payment.employeeId)) || {};
      const body = {
        id: String(payment.id),
        source: 'personal',
        employee_id: String(payment.employeeId),
        employee_name: String(employee.name || ''),
        amount: Number(payment.amount),
        paid_date: String(payment.paidDate || '').slice(0, 10) || null,
        period_start: payment.periodStart || null,
        period_end: payment.periodEnd || null,
        note: payment.note || '',
        account: payment.account || null,
        updated_at: new Date().toISOString()
      };

      const response = await fetch(
        `${cfg.url}/rest/v1/panorama_payroll_payments?on_conflict=id`,
        {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) throw new Error(await response.text());
    }
  }

  async function push() {
    if (pushing || applyingRemote) return;

    const data = readState();
    if (!data) return;

    pushing = true;
    try {
      const response = await fetch(
        `${cfg.url}/rest/v1/panorama_personal_state?id=eq.${encodeURIComponent(ROW_ID)}`,
        {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({ data })
        }
      );

      if (!response.ok) throw new Error(await response.text());

      const row = (await response.json())?.[0];
      lastRemoteSignature = stateSignature(row?.data || data);

      await publishPayments(data);
      window.dispatchEvent(new Event('panorama-core-personal-synced'));
    } catch (error) {
      console.warn('Panorama Personal: no se pudo sincronizar', error);
    } finally {
      pushing = false;
    }
  }

  async function pull() {
    if (pushing) return false;

    try {
      const response = await fetch(
        `${cfg.url}/rest/v1/panorama_personal_state?id=eq.${encodeURIComponent(ROW_ID)}&select=data,updated_at`,
        {
          headers: { ...headers, 'Cache-Control': 'no-cache' },
          cache: 'no-store'
        }
      );

      if (!response.ok) throw new Error(await response.text());

      const row = (await response.json())?.[0];
      if (!row?.data) return false;

      const remoteSignature = stateSignature(row.data);
      if (remoteSignature === lastRemoteSignature) return false;

      lastRemoteSignature = remoteSignature;
      return applyRemoteState(row.data, row.updated_at);
    } catch (error) {
      console.warn('Panorama Personal: no se pudo recibir el estado remoto', error);
      return false;
    }
  }

  function schedulePush() {
    if (applyingRemote) return;

    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, SYNC_DELAY);
  }

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    const result = originalSetItem.apply(this, arguments);

    if (this === localStorage && key === STORE) {
      schedulePush();
    }

    return result;
  };

  window.PanoramaCore = {
    syncNow: push,
    pullNow: pull
  };

  async function start() {
    await pull();
    if (!lastRemoteSignature) await push();

    setInterval(pull, PULL_INTERVAL);
    window.dispatchEvent(new Event('panorama-core-personal-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();