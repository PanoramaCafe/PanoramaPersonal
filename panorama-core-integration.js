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

  function injectLayoutStyles() {
    if (document.getElementById('panorama-layout-styles')) return;
    const style = document.createElement('style');
    style.id = 'panorama-layout-styles';
    style.textContent = `
      .clock-workspace{display:grid;grid-template-columns:minmax(360px,1fr) minmax(280px,.72fr);gap:14px;align-items:stretch}
      .clock-workspace>.card{margin-top:0}.clock-workspace>.clock-home{max-width:none;margin:0}
      .clock-workspace .pinpad,.clock-workspace .keypad{max-width:360px}
      .clock-workspace .working-person{width:100%;padding:12px 14px}
      .clock-workspace #workingNowList{display:flex;flex-direction:column;gap:8px}
      .clock-workspace .working-empty{flex:1;display:flex;align-items:center;justify-content:center;min-height:180px;text-align:center}

      .admin-shell{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.72fr);gap:14px;align-items:start}
      .admin-shell>.card{margin-top:0}.admin-main,.admin-side{display:flex;flex-direction:column;gap:14px}.admin-main>.card,.admin-side>.card{margin-top:0}
      .admin-section{border:1px solid var(--line);border-radius:16px;background:var(--card);overflow:hidden}
      .admin-section+.admin-section{margin-top:10px}
      .admin-section summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 17px;cursor:pointer;font-weight:900}
      .admin-section summary::-webkit-details-marker{display:none}.admin-section summary::after{content:'⌄';font-size:18px;color:var(--muted);transition:transform .15s}
      .admin-section[open] summary::after{transform:rotate(180deg)}
      .admin-section summary small{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-top:2px}
      .admin-section-body{padding:0 17px 17px}.admin-section-body>.card{border:0;box-shadow:none;padding:0;margin:0;background:transparent}
      .admin-primary-actions{display:flex;justify-content:flex-end;margin-bottom:10px}
      .admin-side .card h2,.admin-main .card h2{font-size:18px}
      @media(max-width:900px){.admin-shell{grid-template-columns:1fr}.admin-main,.admin-side{gap:14px}}
      @media(max-width:800px){.clock-workspace{grid-template-columns:1fr}.clock-workspace>.card{margin-top:14px}.clock-workspace>.clock-home{margin-top:0}}
    `;
    document.head.appendChild(style);
  }

  function arrangeClockLayout() {
    const reloj = document.getElementById('reloj');
    const clockCard = reloj?.querySelector('.clock-home');
    const workingCard = document.getElementById('workingNowList')?.closest('.card');
    if (!reloj || !clockCard || !workingCard || reloj.querySelector('.clock-workspace')) return;
    const workspace = document.createElement('div');
    workspace.className = 'clock-workspace';
    reloj.insertBefore(workspace, clockCard);
    workspace.append(clockCard, workingCard);
  }

  function cardByHeading(root, text) {
    return [...root.querySelectorAll(':scope > .card')].find(card => card.querySelector('h2')?.textContent.includes(text));
  }

  function wrapAdminSection(card, title, subtitle, open = false) {
    if (!card || card.parentElement?.classList.contains('admin-section-body')) return null;
    const section = document.createElement('details');
    section.className = 'admin-section';
    section.open = open;
    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${title}<small>${subtitle}</small></span>`;
    const body = document.createElement('div');
    body.className = 'admin-section-body';
    card.replaceWith(section);
    body.appendChild(card);
    section.append(summary, body);
    return section;
  }

  function arrangeAdminLayout() {
    const admin = document.getElementById('admin');
    if (!admin || admin.querySelector('.admin-shell')) return;
    const cards = [...admin.querySelectorAll(':scope > .card')];
    if (!cards.length) return;

    const shell = document.createElement('div');
    shell.className = 'admin-shell';
    const main = document.createElement('div'); main.className = 'admin-main';
    const side = document.createElement('div'); side.className = 'admin-side';
    shell.append(main, side);

    const summary = cardByHeading(admin, 'Resumen de nómina');
    const workers = cardByHeading(admin, 'Trabajadores');
    const review = cardByHeading(admin, 'Revisión de nómina');
    const payments = cardByHeading(admin, 'Pagos');

    if (summary) main.appendChild(summary);
    if (workers) main.appendChild(workers);
    if (payments) side.appendChild(payments);
    if (review) side.appendChild(wrapAdminSection(review, '📋 Revisión de nómina', 'Horas, alertas y cierre semanal', false));

    for (const card of [...admin.querySelectorAll(':scope > .card')]) {
      const heading = card.querySelector('h2')?.textContent.trim() || 'Opciones';
      side.appendChild(wrapAdminSection(card, `⚙️ ${heading}`, 'Opciones y herramientas adicionales', false));
    }

    if (workers) {
      const addButton = workers.querySelector('button.primary');
      if (addButton && !workers.querySelector('.admin-primary-actions')) {
        const actions = document.createElement('div');
        actions.className = 'admin-primary-actions';
        addButton.parentElement?.insertBefore(actions, addButton.parentElement.firstChild);
        actions.appendChild(addButton);
      }
    }

    admin.appendChild(shell);
  }

  injectLayoutStyles();
  arrangeClockLayout();
  arrangeAdminLayout();

  if (!cfg?.url || !cfg?.key) {
    console.warn('Panorama Personal: falta configuración Supabase');
    return;
  }

  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' };
  let pushing = false, applyingRemote = false, pushTimer = null, lastRemoteSignature = null;

  function readState() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } }
  function stateSignature(data) { try { return JSON.stringify(data); } catch { return ''; } }

  function applyRemoteState(data, updatedAt) {
    if (!data || typeof data !== 'object') return false;
    const remoteSignature = stateSignature(data);
    if (remoteSignature === stateSignature(readState())) return false;
    applyingRemote = true;
    try {
      db = data;
      localStorage.setItem(STORE, remoteSignature);
      renderAll();
      window.dispatchEvent(new CustomEvent('panorama-core-personal-remote-update', { detail: { data, updatedAt } }));
      return true;
    } catch (error) {
      console.error('Panorama Personal: no se pudo aplicar el estado remoto', error);
      return false;
    } finally { queueMicrotask(() => { applyingRemote = false; }); }
  }

  async function publishPayments(data) {
    const payments = Array.isArray(data?.payments) ? data.payments : [];
    const employees = new Map((Array.isArray(data?.employees) ? data.employees : []).map(employee => [String(employee.id), employee]));
    for (const payment of payments) {
      if (!payment?.id || !payment?.employeeId || !Number.isFinite(Number(payment.amount))) continue;
      const employee = employees.get(String(payment.employeeId)) || {};
      const body = {
        id: String(payment.id), source: 'personal', employee_id: String(payment.employeeId), employee_name: String(employee.name || ''), amount: Number(payment.amount),
        paid_date: String(payment.paidDate || '').slice(0, 10) || null, period_start: payment.periodStart || null, period_end: payment.periodEnd || null,
        note: payment.note || '', account: payment.account || null, updated_at: new Date().toISOString()
      };
      const response = await fetch(`${cfg.url}/rest/v1/panorama_payroll_payments?on_conflict=id`, {
        method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
    }
  }

  async function push() {
    if (pushing || applyingRemote) return;
    const data = readState(); if (!data) return;
    pushing = true;
    try {
      const response = await fetch(`${cfg.url}/rest/v1/panorama_personal_state?id=eq.${encodeURIComponent(ROW_ID)}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ data })
      });
      if (!response.ok) throw new Error(await response.text());
      const row = (await response.json())?.[0];
      lastRemoteSignature = stateSignature(row?.data || data);
      await publishPayments(data);
      window.dispatchEvent(new Event('panorama-core-personal-synced'));
    } catch (error) { console.warn('Panorama Personal: no se pudo sincronizar', error); }
    finally { pushing = false; }
  }

  async function pull() {
    if (pushing) return false;
    try {
      const response = await fetch(`${cfg.url}/rest/v1/panorama_personal_state?id=eq.${encodeURIComponent(ROW_ID)}&select=data,updated_at`, {
        headers: { ...headers, 'Cache-Control': 'no-cache' }, cache: 'no-store'
      });
      if (!response.ok) throw new Error(await response.text());
      const row = (await response.json())?.[0]; if (!row?.data) return false;
      const remoteSignature = stateSignature(row.data);
      if (remoteSignature === lastRemoteSignature) return false;
      lastRemoteSignature = remoteSignature;
      return applyRemoteState(row.data, row.updated_at);
    } catch (error) { console.warn('Panorama Personal: no se pudo recibir el estado remoto', error); return false; }
  }

  function schedulePush() { if (!applyingRemote) { clearTimeout(pushTimer); pushTimer = setTimeout(push, SYNC_DELAY); } }
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) { const result = originalSetItem.apply(this, arguments); if (this === localStorage && key === STORE) schedulePush(); return result; };
  window.PanoramaCore = { syncNow: push, pullNow: pull };

  async function start() {
    injectLayoutStyles(); arrangeClockLayout(); arrangeAdminLayout();
    await pull(); if (!lastRemoteSignature) await push();
    setInterval(pull, PULL_INTERVAL);
    window.dispatchEvent(new Event('panorama-core-personal-ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();