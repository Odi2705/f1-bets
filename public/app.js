// ─── Constants ────────────────────────────────────────────────────────────────

const DRIVERS = [
  { name: 'Albon',      team: 'williams' },
  { name: 'Alonso',     team: 'astonmartin' },
  { name: 'Antonelli',  team: 'mercedes' },
  { name: 'Bearman',    team: 'haas' },
  { name: 'Bortoleto',  team: 'sauber' },
  { name: 'Colapinto',  team: 'alpine' },
  { name: 'Doohan',     team: 'alpine' },
  { name: 'Gasly',      team: 'alpine' },
  { name: 'Hadjar',     team: 'rb' },
  { name: 'Hamilton',   team: 'ferrari' },
  { name: 'Hülkenberg', team: 'sauber' },
  { name: 'Lawson',     team: 'redbull' },
  { name: 'Leclerc',    team: 'ferrari' },
  { name: 'Lindblad',   team: 'williams' },
  { name: 'Norris',     team: 'mclaren' },
  { name: 'Ocon',       team: 'haas' },
  { name: 'Piastri',    team: 'mclaren' },
  { name: 'Russell',    team: 'mercedes' },
  { name: 'Sainz',      team: 'williams' },
  { name: 'Stroll',     team: 'astonmartin' },
  { name: 'Tsunoda',    team: 'rb' },
  { name: 'Verstappen', team: 'redbull' },
];

const TEAM_COLORS = {
  redbull:     '#3671C6',
  ferrari:     '#E8002D',
  mercedes:    '#00D2BE',
  mclaren:     '#FF8000',
  astonmartin: '#229971',
  alpine:      '#d946ef',
  sauber:      '#52E252',
  rb:          '#6692FF',
  haas:        '#ababab',
  williams:    '#64C4FF',
};

const EVENT_LABELS = { qualify: 'Classificação', sprint: 'Sprint', race: 'Corrida' };

const ADMIN_TOKEN = localStorage.getItem('f1_admin_token') || '';

// ─── State ────────────────────────────────────────────────────────────────────

let currentUser = null;
let currentView = 'login';

// ─── API Helper ───────────────────────────────────────────────────────────────

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
  return data;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function navigate(view, params = {}) {
  currentView = view;
  updateNavTabs(view);
  const content = document.getElementById('content');
  content.innerHTML = '<div class="flex justify-center mt-10"><div class="spinner"></div></div>';
  switch (view) {
    case 'login':        renderLogin(); break;
    case 'home':         renderHome(); break;
    case 'apostar':      renderApostar(params.eventId); break;
    case 'resultados':   renderResultados(params.weekendId, params.eventId); break;
    case 'classificacao': renderClassificacao(); break;
    case 'admin':        renderAdmin(); break;
    default:             renderHome();
  }
}

function updateNavTabs(view) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const map = {
    home: 0, apostar: 1, resultados: 2, classificacao: 3,
  };
  const idx = map[view];
  if (idx !== undefined) {
    const tabs = document.querySelectorAll('.nav-tab');
    if (tabs[idx]) tabs[idx].classList.add('active');
  }
}

function logout() {
  if (!confirm('Sair?')) return;
  currentUser = null;
  localStorage.removeItem('f1_user');
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('user-badge').textContent = '';
  navigate('login');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function countdown(iso) {
  const diff = new Date(iso) - Date.now();
  if (diff <= 0) return 'Encerrado';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)} dias`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function driverColorStyle(name) {
  const d = DRIVERS.find(x => x.name.toLowerCase() === name.toLowerCase());
  const color = d ? TEAM_COLORS[d.team] : '#6b7280';
  return `color:${color};font-weight:600`;
}

function driverOptions(selected = '') {
  return DRIVERS.map(d =>
    `<option value="${d.name}" ${d.name === selected ? 'selected' : ''}>${d.name}</option>`
  ).join('');
}

function isOpen(event) {
  return event.allow_late_bets === 1 || new Date(event.deadline) > new Date();
}

// ─── Login View ───────────────────────────────────────────────────────────────

function renderLogin() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="min-h-screen flex flex-col items-center justify-center p-6">
      <div class="mb-8 text-center">
        <div class="text-5xl font-black text-[#e10600] tracking-tight">F1</div>
        <div class="text-xl font-bold text-gray-800">Bolão 2026</div>
        <div class="text-sm text-gray-500 mt-1">Selecione seu nome</div>
      </div>
      <div class="grid grid-cols-2 gap-3 w-full max-w-xs" id="participant-grid">
        <div class="col-span-2 flex justify-center"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  api('/events/participants').then(participants => {
    const grid = document.getElementById('participant-grid');
    grid.innerHTML = participants.map(p => `
      <button onclick="selectUser(${p.id}, '${p.name}')"
        class="w-full py-4 rounded-xl font-bold text-white text-lg"
        style="background:#15151e">
        ${p.name}
      </button>
    `).join('');
  });
}

function selectUser(id, name) {
  currentUser = { id, name };
  localStorage.setItem('f1_user', JSON.stringify(currentUser));
  document.getElementById('user-badge').textContent = name;
  document.getElementById('bottom-nav').classList.remove('hidden');
  navigate('home');
}

// ─── Home View ────────────────────────────────────────────────────────────────

async function renderHome() {
  const content = document.getElementById('content');
  try {
    const events = await api('/events/next');

    if (events.length === 0) {
      content.innerHTML = `
        <div class="p-6 text-center text-gray-500">
          <p class="text-xl font-bold mt-8">Nenhuma etapa aberta</p>
          <p class="mt-2">Aguardando próxima classificação.</p>
        </div>`;
      return;
    }

    let html = `<div class="p-4 space-y-3">
      <h2 class="font-bold text-lg text-gray-700 mt-2">Apostas Abertas</h2>`;

    for (const ev of events) {
      const open = isOpen(ev);
      const deadlineStr = formatDate(ev.deadline);
      const countStr = open && new Date(ev.deadline) > new Date() ? countdown(ev.deadline) : '';
      const badge = ev.allow_late_bets && new Date(ev.deadline) < new Date()
        ? '<span class="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-bold">Exceção</span>'
        : '';

      html += `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div class="flex items-start justify-between">
            <div>
              <div class="font-bold text-gray-900">${ev.weekend_name} ${badge}</div>
              <div class="text-sm text-gray-500 mt-0.5">${EVENT_LABELS[ev.type]}</div>
              <div class="text-xs text-gray-400 mt-1">Prazo: ${deadlineStr}</div>
              ${countStr ? `<div class="text-xs font-bold text-orange-500 mt-0.5">⏱ ${countStr}</div>` : ''}
            </div>
            <button onclick="navigate('apostar', {eventId: ${ev.id}})"
              class="btn-red text-white px-4 py-2 rounded-lg text-sm font-bold ml-3 flex-shrink-0">
              Apostar
            </button>
          </div>
        </div>`;
    }

    html += `</div>`;
    content.innerHTML = html;

  } catch (e) {
    content.innerHTML = `<div class="p-6 text-red-600">${e.message}</div>`;
  }
}

// ─── Apostar (Bet) View ───────────────────────────────────────────────────────

async function renderApostar(eventId) {
  const content = document.getElementById('content');
  try {
    // Show event picker if no eventId
    if (!eventId) {
      const events = await api('/events/next');
      if (events.length === 0) {
        content.innerHTML = `<div class="p-6 text-center text-gray-500">Nenhuma etapa disponível para apostas.</div>`;
        return;
      }
      let html = `<div class="p-4 space-y-3"><h2 class="font-bold text-lg text-gray-700 mt-2">Escolha a etapa</h2>`;
      for (const ev of events) {
        html += `
          <button onclick="navigate('apostar', {eventId: ${ev.id}})"
            class="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left">
            <div class="font-bold">${ev.weekend_name}</div>
            <div class="text-sm text-gray-500">${EVENT_LABELS[ev.type]} · Prazo: ${formatDate(ev.deadline)}</div>
          </button>`;
      }
      html += `</div>`;
      content.innerHTML = html;
      return;
    }

    const [event, myBets] = await Promise.all([
      api(`/events/${eventId}`),
      api(`/bets/event/${eventId}/participant/${currentUser.id}`),
    ]);

    const positions = event.type === 'race' ? 10 : 3;
    const open = isOpen(event);

    const betMap = Object.fromEntries(myBets.map(b => [b.position, b.driver]));

    let html = `
      <div class="p-4">
        <button onclick="navigate('apostar')" class="text-sm text-gray-500 mb-4 flex items-center gap-1">
          ← Voltar
        </button>
        <div class="section-header rounded-t-xl mb-0">
          ${event.weekend_name} — ${EVENT_LABELS[event.type]}
        </div>
        <div class="bg-white rounded-b-xl shadow-sm border border-gray-100 p-4 mb-4">
          <p class="text-xs text-gray-400">Prazo: ${formatDate(event.deadline)}</p>
          <p class="text-sm font-semibold mt-1">Apostador: <span class="text-[#e10600]">${currentUser.name}</span></p>
        </div>`;

    if (!open) {
      html += `<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-600 font-bold">
        Prazo encerrado para esta etapa.
      </div>`;
      if (myBets.length > 0) {
        html += `<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
          <h3 class="font-bold text-gray-700 mb-3">Suas apostas</h3>`;
        for (let i = 1; i <= positions; i++) {
          const d = betMap[i] || '—';
          html += `<div class="flex justify-between py-2 border-b border-gray-100">
            <span class="font-bold text-gray-500">P${i}</span>
            <span style="${driverColorStyle(d)}">${d}</span>
          </div>`;
        }
        html += `</div>`;
      }
      content.innerHTML = html + `</div>`;
      return;
    }

    html += `<form id="bet-form" class="space-y-3">`;
    for (let i = 1; i <= positions; i++) {
      const existing = betMap[i] || '';
      html += `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 flex-shrink-0">${i}</div>
          <select name="pos_${i}" class="flex-1 p-2 border border-gray-200 rounded-lg text-sm bg-white" required>
            <option value="">— Selecione —</option>
            ${driverOptions(existing)}
          </select>
        </div>`;
    }
    html += `
      <button type="submit"
        class="btn-red w-full text-white py-4 rounded-xl font-bold text-base mt-2">
        Salvar Apostas
      </button>
    </form></div>`;

    content.innerHTML = html;

    document.getElementById('bet-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const bets = [];
      for (let i = 1; i <= positions; i++) {
        const driver = fd.get(`pos_${i}`);
        if (driver) bets.push({ position: i, driver });
      }
      if (bets.length !== positions) {
        alert('Preencha todas as posições antes de salvar.');
        return;
      }
      try {
        await api('/bets', 'POST', { participant_id: currentUser.id, event_id: eventId, bets });
        showToast('Apostas salvas com sucesso!');
        navigate('home');
      } catch (err) {
        alert(err.message);
      }
    });

  } catch (e) {
    content.innerHTML = `<div class="p-6 text-red-600">${e.message}</div>`;
  }
}

// ─── Resultados View ──────────────────────────────────────────────────────────

async function renderResultados(weekendId, eventId) {
  const content = document.getElementById('content');
  try {
    if (!weekendId) {
      // Show list of completed weekends
      const events = await api('/events');
      const completed = events.filter(e => e.completed === 1);
      if (completed.length === 0) {
        content.innerHTML = `<div class="p-6 text-center text-gray-500 mt-8">Nenhum resultado disponível ainda.</div>`;
        return;
      }
      // Group by weekend
      const byWeekend = {};
      for (const ev of completed) {
        if (!byWeekend[ev.weekend_id]) byWeekend[ev.weekend_id] = { name: ev.weekend_name, round: ev.round, events: [] };
        byWeekend[ev.weekend_id].events.push(ev);
      }
      let html = `<div class="p-4 space-y-3"><h2 class="font-bold text-lg text-gray-700 mt-2">Etapas com Resultado</h2>`;
      for (const [wid, w] of Object.entries(byWeekend)) {
        html += `
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div class="font-bold text-gray-900 mb-2">R${w.round} · ${w.name}</div>
            <div class="flex gap-2 flex-wrap">`;
        for (const ev of w.events) {
          html += `<button onclick="navigate('resultados', {weekendId: '${wid}', eventId: ${ev.id}})"
            class="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full text-sm font-medium">
            ${EVENT_LABELS[ev.type]}
          </button>`;
        }
        html += `</div></div>`;
      }
      html += `</div>`;
      content.innerHTML = html;
      return;
    }

    // Show specific event comparison
    const data = await api(`/standings/event/${eventId}`);
    const { event, results, participants } = data;

    const maxPos = results.length;
    const label = EVENT_LABELS[event.type];

    let html = `
      <div class="p-4">
        <button onclick="navigate('resultados')" class="text-sm text-gray-500 mb-3 flex items-center gap-1">← Voltar</button>
        <div class="section-header">${event.weekend_name} — ${label}</div>
        <div class="table-scroll mt-0">
          <table>
            <thead>
              <tr>
                <th class="row-num">#</th>
                ${participants.map(p => `<th>${p.name}</th>`).join('')}
                <th style="background:#f0f0f0">Resultado</th>
                ${participants.map(p => `<th>${p.name}</th>`).join('')}
              </tr>
            </thead>
            <tbody>`;

    for (let pos = 1; pos <= maxPos; pos++) {
      const result = results.find(r => r.position === pos);
      html += `<tr>
        <td class="row-num">${pos}</td>`;

      // Bet cells
      for (const p of participants) {
        const bet = p.bets.find(b => b.position === pos);
        if (!bet) {
          html += `<td class="cell-empty">—</td>`;
        } else {
          const cls = { exact: 'cell-exact', other: 'cell-other', wrong: 'cell-wrong' }[bet.status] || 'cell-empty';
          html += `<td class="${cls}">${bet.driver}</td>`;
        }
      }

      // Result cell
      const dStyle = result ? `style="${driverColorStyle(result.driver)}"` : '';
      html += `<td style="background:#f9f9c0;font-weight:700" ${dStyle.replace('style=', 'data-x=')}>
        <span ${dStyle}>${result?.driver ?? ''}</span>
      </td>`;

      // Points cells
      for (const p of participants) {
        const bet = p.bets.find(b => b.position === pos);
        html += `<td>${bet ? bet.points : ''}</td>`;
      }

      html += `</tr>`;
    }

    // Total row
    html += `<tr style="background:#f3f4f6;font-weight:800">
      <td class="row-num">Total</td>
      ${participants.map(() => '<td></td>').join('')}
      <td></td>
      ${participants.map(p => `<td>${p.total}</td>`).join('')}
    </tr>`;

    html += `</tbody></table></div>

      <div class="mt-4 flex gap-2 flex-wrap text-xs">
        <span class="cell-exact px-2 py-1 rounded">✓ Exato</span>
        <span class="cell-other px-2 py-1 rounded">Piloto presente, posição errada</span>
        <span class="cell-wrong px-2 py-1 rounded">Piloto ausente</span>
        <span class="cell-empty px-2 py-1 rounded">Sem aposta</span>
      </div>
    </div>`;

    content.innerHTML = html;

    // Render weekend event tabs above
    try {
      const allEvents = await api(`/events/weekend/${event.weekend_id}`);
      const completedEvs = allEvents.filter(e => e.completed);
      if (completedEvs.length > 1) {
        const tabs = completedEvs.map(ev =>
          `<button onclick="navigate('resultados',{weekendId:'${event.weekend_id}',eventId:${ev.id}})"
            class="px-3 py-1 rounded-full text-sm font-medium ${ev.id === event.id ? 'bg-[#e10600] text-white' : 'bg-gray-100'}">
            ${EVENT_LABELS[ev.type]}
          </button>`
        ).join('');
        const insertAfter = content.querySelector('.section-header');
        const tabDiv = document.createElement('div');
        tabDiv.className = 'flex gap-2 flex-wrap p-2 bg-white border-b border-gray-100';
        tabDiv.innerHTML = tabs;
        insertAfter.insertAdjacentElement('afterend', tabDiv);
      }
    } catch (_) { /* ignore */ }

  } catch (e) {
    content.innerHTML = `<div class="p-6 text-red-600">${e.message}</div>`;
  }
}

// ─── Classificação (Standings) View ──────────────────────────────────────────

async function renderClassificacao() {
  const content = document.getElementById('content');
  try {
    const { participants, rows, totals } = await api('/standings');

    let html = `
      <div class="p-4">
        <div class="section-header rounded-t-xl">Total — Temporada 2026</div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th style="text-align:left;padding-left:6px">Circuito</th>
                ${participants.map(p => `<th>${p.name}</th>`).join('')}
              </tr>
            </thead>
            <tbody>`;

    const lastRound = Math.max(...rows.map(r => r.round));
    for (const row of rows) {
      html += `<tr>
        <td style="text-align:left;padding-left:6px;white-space:normal;min-width:100px">${row.name}</td>`;
      for (const p of participants) {
        const pts = row[p.id];
        const isLast = row.round === lastRound;
        let cls = '';
        if (!isLast) {
          cls = pts > 0 ? 'pts-green' : 'pts-red';
        }
        html += `<td class="${cls}">${pts}</td>`;
      }
      html += `</tr>`;
    }

    // Total row
    const maxTotal = Math.max(...participants.map(p => totals[p.id]));
    html += `<tr style="background:#FFEB00;font-weight:800">
      <td style="text-align:left;padding-left:6px">Total</td>
      ${participants.map(p => {
        const t = totals[p.id];
        const style = t === maxTotal && t > 0 ? 'background:#16a34a;color:white' : '';
        return `<td style="${style}">${t}</td>`;
      }).join('')}
    </tr>`;

    html += `</tbody></table></div>
      <div class="mt-3 flex gap-2 text-xs flex-wrap">
        <span class="pts-green px-2 py-1 rounded">Pontos marcados</span>
        <span class="pts-red px-2 py-1 rounded">Zero pontos</span>
      </div>
    </div>`;

    content.innerHTML = html;

  } catch (e) {
    content.innerHTML = `<div class="p-6 text-red-600">${e.message}</div>`;
  }
}

// ─── Admin View ───────────────────────────────────────────────────────────────

async function renderAdmin() {
  const content = document.getElementById('content');

  // Prompt for token if not set
  let token = localStorage.getItem('f1_admin_token');
  if (!token) {
    token = prompt('Token de administrador:');
    if (!token) { navigate('home'); return; }
    localStorage.setItem('f1_admin_token', token);
  }

  try {
    const weekends = await apiFetch('/admin/weekends', 'GET', null, token);

    let html = `
      <div class="p-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-lg">Painel Admin</h2>
          <button onclick="adminLogout()" class="text-xs text-gray-400">Sair do admin</button>
        </div>
        <div class="space-y-3">`;

    for (const w of weekends) {
      html += `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div class="font-bold">R${w.round} · ${w.name}</div>
          <div class="text-xs text-gray-400 mb-3">${w.completed_events}/${w.total_events} etapas concluídas</div>
          <div id="events-${w.id}" class="space-y-2"></div>
          <button onclick="loadAdminEvents(${w.id}, '${token}')"
            class="text-xs text-blue-600 mt-1">Gerenciar eventos →</button>
        </div>`;
    }

    html += `</div></div>`;
    content.innerHTML = html;

  } catch (e) {
    if (e.message.includes('401') || e.message.includes('Unauthorized')) {
      localStorage.removeItem('f1_admin_token');
      alert('Token inválido.');
      navigate('home');
    } else {
      content.innerHTML = `<div class="p-6 text-red-600">${e.message}</div>`;
    }
  }
}

async function loadAdminEvents(weekendId, token) {
  const container = document.getElementById(`events-${weekendId}`);
  container.innerHTML = '<div class="spinner w-5 h-5 mt-2"></div>';
  try {
    const events = await apiFetch(`/events/weekend/${weekendId}`, 'GET', null, token);
    container.innerHTML = events.map(ev => `
      <div class="border border-gray-100 rounded-lg p-2 text-sm">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-medium">${EVENT_LABELS[ev.type]}</span>
            <span class="ml-2 text-xs ${ev.completed ? 'text-green-600' : 'text-gray-400'}">
              ${ev.completed ? '✓ Concluído' : 'Pendente'}
            </span>
            ${ev.allow_late_bets ? '<span class="ml-1 text-xs text-yellow-600">Aberta</span>' : ''}
          </div>
          <div class="flex gap-1 flex-wrap justify-end">
            ${!ev.completed ? `
              <button onclick="adminFetchResults(${ev.id}, '${token}')"
                class="btn-red text-white px-2 py-1 rounded text-xs">API</button>
              <button onclick="adminManualResults(${ev.id}, '${ev.type}', '${token}')"
                class="bg-gray-700 text-white px-2 py-1 rounded text-xs">Manual</button>` : ''}
            ${ev.allow_late_bets ?
              `<button onclick="adminClose(${ev.id}, '${token}', ${weekendId})"
                class="bg-yellow-500 text-white px-2 py-1 rounded text-xs">Fechar</button>` :
              `<button onclick="adminOpen(${ev.id}, '${token}', ${weekendId})"
                class="bg-blue-600 text-white px-2 py-1 rounded text-xs">Abrir</button>`}
          </div>
        </div>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = `<span class="text-red-500 text-xs">${e.message}</span>`;
  }
}

async function adminFetchResults(eventId, token) {
  if (!confirm('Buscar resultados da API F1?')) return;
  try {
    const r = await apiFetch(`/admin/fetch-results/${eventId}`, 'POST', null, token);
    showToast(`Resultados obtidos: ${r.results.length} posições`);
    renderAdmin();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

function adminManualResults(eventId, type, token) {
  const maxPos = type === 'race' ? 10 : 3;
  const drivers = prompt(`Cole os ${maxPos} pilotos separados por vírgula\n(ex: Russell, Antonelli, Leclerc...)`);
  if (!drivers) return;
  const list = drivers.split(',').map(d => d.trim()).filter(Boolean);
  if (list.length !== maxPos) { alert(`Precisa de exatamente ${maxPos} pilotos.`); return; }
  const results = list.map((driver, i) => ({ position: i + 1, driver }));
  apiFetch(`/admin/set-results/${eventId}`, 'POST', { results }, token)
    .then(() => { showToast('Resultados salvos!'); renderAdmin(); })
    .catch(e => alert('Erro: ' + e.message));
}

async function adminOpen(eventId, token, weekendId) {
  await apiFetch(`/admin/events/${eventId}/reopen`, 'PUT', null, token);
  showToast('Apostas abertas');
  loadAdminEvents(weekendId, token);
}

async function adminClose(eventId, token, weekendId) {
  await apiFetch(`/admin/events/${eventId}/close`, 'PUT', null, token);
  showToast('Apostas encerradas');
  loadAdminEvents(weekendId, token);
}

function adminLogout() {
  localStorage.removeItem('f1_admin_token');
  navigate('home');
}

async function apiFetch(path, method = 'GET', body = null, token = '') {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm z-50 shadow-lg';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Check URL for admin
  if (window.location.search.includes('admin')) {
    navigate('admin');
    return;
  }

  const saved = localStorage.getItem('f1_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    document.getElementById('user-badge').textContent = currentUser.name;
    document.getElementById('bottom-nav').classList.remove('hidden');
    navigate('home');
  } else {
    navigate('login');
  }
});
