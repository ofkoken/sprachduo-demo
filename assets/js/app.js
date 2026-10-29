(() => {
  'use strict';
  const D = window.SprachDuoData, C = window.SprachDuoCore;
  const KEY = 'sprachduo-class-prototype-v1';
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const defaults = () => ({ profile: clone(D.viewer), blocked: [], reports: [], joined: [], events: [],
    requests: [{ id: 'incoming-marta', from: 'marta', to: 'me', note: 'Hi! I can help with German and would love to practise English. Wednesday evenings work for me.', created: Date.now() - 3600000, status: 'pending' },
      { id: 'incoming-felix', from: 'felix', to: 'me', note: 'Would you like to try a short conversation after class?', created: Date.now() - 7200000, status: 'pending' }] });
  let state;
  try {
    state = JSON.parse(localStorage.getItem(KEY));
    if (!state?.profile || !Array.isArray(state.requests) || !Array.isArray(state.blocked) || !Array.isArray(state.joined) || !Array.isArray(state.events) || !Array.isArray(state.reports)) state = defaults();
  } catch { state = defaults(); }
  let toastTimer;
  function announce(message, error = false) {
    const node = $('#status'); node.textContent = message; node.classList.toggle('error', error); node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 6500);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { announce('Changes work in this page, but browser storage is unavailable. They may not survive navigation.', true); }
  }
  function run(fn) { try { fn(); } catch (error) { announce(error.message, true); } }
  const initials = name => name.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  const person = id => id === 'me' ? state.profile : D.people.find(p => p.id === id);
  const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const periods = ['Morning', 'Midday', 'Evening'];
  const timesText = times => times.length ? times.map(t => { const [d, p] = t.split('-'); return shortDays[Number(d)] + ' ' + periods[Number(p)].toLowerCase(); }).join(' · ') : 'Availability not added yet';
  const bands = p => `<div class="duo"><div class="language"><small>OFFERS</small><strong>${esc(p.speaks)} · ${esc(p.speakLevel || 'Fluent')}</strong></div><div class="language practice"><small>PRACTISES</small><strong>${esc(p.learns)} · ${esc(p.level)}</strong></div></div>`;
  const dateLabel = date => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00'));
  const events = () => [...D.events, ...state.events];
  const avatar = $('.profile-avatar'); avatar.textContent = initials(state.profile.name);

  $('.menu-toggle').addEventListener('click', event => {
    const open = event.currentTarget.getAttribute('aria-expanded') !== 'true';
    event.currentTarget.setAttribute('aria-expanded', String(open)); $('#main-nav').classList.toggle('open', open);
  });
  $('#reset-demo').addEventListener('click', () => {
    if (window.confirm('Reset the sample profiles, requests and events on this device?')) {
      state = defaults(); save(); location.href = 'index.html';
    }
  });

  function partnerCard(result) {
    const p = result.person;
    return `<article class="card partner-card"><div class="partner-heading"><span class="avatar">${esc(p.initials)}</span><div><h3>${esc(p.name)}</h3><p class="small muted">HFU student</p></div><span class="fit">${result.score}% fit${result.provisional ? '<small>Provisional</small>' : ''}</span></div>${bands(p)}<p>${esc(p.goal)}</p><p class="small forest">${esc(timesText(result.times))}</p><a class="button secondary" href="profile.html?id=${encodeURIComponent(p.id)}">View profile</a></article>`;
  }
  function eventCard(e, compact = false) {
    const joined = state.joined.includes(e.id), count = e.attendees + (joined ? 1 : 0);
    return `<article class="card event-card"><div class="section-heading"><p class="eyebrow">${esc(dateLabel(e.date))} · ${esc(e.time)}</p>${joined ? '<span class="tag">You’re going</span>' : ''}</div><h${compact ? '3' : '2'}>${esc(e.title)}</h${compact ? '3' : '2'}><p>${esc(e.language)} · ${esc(e.place)}</p>${compact ? `<a class="text-link" href="events.html#event-${encodeURIComponent(e.id)}">See event →</a>` : `<p>${esc(e.description)}</p><p class="small muted">${count} of ${e.capacity} places taken</p><button class="button ${joined ? 'secondary' : ''}" type="button" data-join="${esc(e.id)}" ${!joined && count >= e.capacity ? 'disabled' : ''}>${joined ? 'Leave event' : count >= e.capacity ? 'Event full' : 'Join this event'}</button>`}</article>`;
  }
  if ($('#home-events')) $('#home-events').innerHTML = events().slice(0, 3).map(e => eventCard(e, true)).join('');

  function renderFind() {
    const form = $('#filter-form'), data = new FormData(form);
    const query = { ...state.profile, speaks: data.get('speaks'), learns: data.get('learns'), level: data.get('level') };
    const options = { blocked: state.blocked, format: data.get('format'), tolerance: Number(data.get('tolerance')) };
    let results = C.search(query, D.people, options), near = false;
    if (!results.length && options.tolerance < 5) {
      results = C.search(query, D.people, { ...options, tolerance: options.tolerance + 1 }); near = results.length > 0;
    }
    $('#results-title').textContent = `${results.length} ${near ? 'near matches' : 'compatible partners'}`;
    $('#results').innerHTML = (near ? '<p class="callout full-width">No exact level match. These results widen the level range by one step.</p>' : '') + (results.length ? results.map(partnerCard).join('') : `<div class="empty-state full-width"><h3>No compatible partners yet.</h3><p>Try another language pair or meeting format. A group event is another way to start.</p><a class="button secondary" href="events.html">Explore events</a></div>`);
  }
  if ($('#filter-form')) {
    const form = $('#filter-form'), query = new URLSearchParams(location.search);
    for (const field of ['speaks', 'learns', 'level']) {
      const value = query.get(field) || state.profile[field];
      if ([...form.elements[field].options].some(o => o.value === value)) form.elements[field].value = value;
    }
    form.addEventListener('submit', e => { e.preventDefault(); renderFind(); closeFilters(); });
    $('#reset-filters').addEventListener('click', () => { form.reset(); for (const key of ['speaks', 'learns', 'level']) form.elements[key].value = state.profile[key]; renderFind(); });
    $('#open-filters').addEventListener('click', () => { $('#filters').classList.add('visible'); $('#open-filters').setAttribute('aria-expanded', 'true'); $('#close-filters').focus(); });
    $('#close-filters').addEventListener('click', closeFilters);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#filters').classList.contains('visible')) closeFilters(); });
    $('#filters').addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !matchMedia('(max-width: 850px)').matches || !$('#filters').classList.contains('visible')) return;
      const items = [...$('#filters').querySelectorAll('a,button,input,select')].filter(el => !el.disabled);
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); }
    });
    renderFind();
  }
  function closeFilters() { $('#filters').classList.remove('visible'); $('#open-filters').setAttribute('aria-expanded', 'false'); if (matchMedia('(max-width: 850px)').matches) $('#open-filters').focus(); }

  function availabilityGrid(selected, editable = false, other = []) {
    let out = '<div class="availability-grid" role="group" aria-label="Weekly availability"><span></span>' + shortDays.map(d => `<span class="day-label">${d}</span>`).join('');
    for (let p = 0; p < 3; p++) {
      out += `<span class="period-label">${periods[p]}</span>`;
      for (let d = 0; d < 7; d++) {
        const id = `${d}-${p}`, on = selected.includes(id), shared = on && other.includes(id);
        const label = `${shortDays[d]} ${periods[p]}`;
        out += editable ? `<label class="time-option"><input type="checkbox" name="availability" value="${id}" ${on ? 'checked' : ''}><span aria-hidden="true">✓</span><span class="sr-only">${label}</span></label>` : `<span class="time-cell ${shared ? 'shared' : on ? 'available' : ''}" title="${label}: ${shared ? 'both available' : on ? 'partner available' : 'unavailable'}"><span aria-hidden="true">${shared ? '✓' : on ? '·' : ''}</span><span class="sr-only">${label}: ${shared ? 'both available' : on ? 'partner available' : 'unavailable'}</span></span>`;
      }
    }
    return out + '</div>';
  }

  if ($('#partner-profile')) {
    const p = person(new URLSearchParams(location.search).get('id'));
    const root = $('#partner-profile');
    if (!p || p.id === 'me' || state.blocked.includes(p.id)) root.innerHTML = '<h1>Profile unavailable.</h1><p>This profile may have been blocked or the link is incomplete.</p><a href="find.html">Back to partners</a>';
    else {
      const match = C.fit(state.profile, p, state.blocked);
      const previous = state.requests.find(r => r.from === 'me' && r.to === p.id && r.status === 'pending');
      root.innerHTML = `<a class="text-link" href="find.html">← Back to partners</a><div class="profile-heading"><span class="avatar large">${esc(p.initials)}</span><div><p class="eyebrow">HFU student</p><h1>${esc(p.name)}</h1></div>${match ? `<span class="tag">${match.score}% fit${match.provisional ? ' · provisional' : ''}</span>` : '<span class="tag warm">Different language goals</span>'}</div><div class="profile-layout"><div class="form-stack">${bands(p)}<section class="card"><h2>A little about ${esc(p.name.split(' ')[0])}</h2><p>${esc(p.goal)}</p><div class="tags">${p.interests.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div></section><section class="card"><h2>Your shared availability</h2>${availabilityGrid(p.availability, false, state.profile.availability)}<p class="small muted">Green ✓ = both free. Light green = partner free.</p><p class="small forest">${esc(timesText(match?.times || []))}</p></section></div><aside class="card request-form"><h2>Start with a hello.</h2><p>A short note helps the other student understand what you’d like to practise.</p>${previous ? '<p class="tag">Request pending</p><a class="button secondary" href="requests.html?tab=sent">View sent requests</a>' : `<form id="request-form" class="form-stack"><label>Optional note<textarea name="note" rows="4" maxlength="200" placeholder="Introduce yourself and suggest a shared time."></textarea></label><span class="small muted" id="note-count">0 / 200 characters</span><button class="button" type="submit">Send tandem request</button></form>`}<p class="small muted">You can chat after acceptance. Either person can decline.</p><button class="text-button" type="button" id="block-person">Block this profile</button><details><summary>Report this profile</summary><form id="report-form" class="form-stack"><label>Reason<select name="reason"><option>Unwanted contact</option><option>Inappropriate content</option><option>Other concern</option></select></label><label>Optional details<textarea name="details" maxlength="300" rows="3"></textarea></label><button class="button secondary" type="submit">Save local report &amp; hide profile</button><p class="small muted">Demo report stays on this device; it is not sent to a moderator.</p></form></details></aside></div><section class="callout section"><h2>Start small. Keep it equal.</h2><p>Try forty minutes, split equally between ${esc(p.speaks)} and ${esc(p.learns)}. Meet in public and choose your next shared slot before leaving.</p></section>`;
      $('#request-form')?.addEventListener('submit', e => { e.preventDefault(); run(() => {
        if (!match) throw new Error('Update your profile to a reciprocal language pair before sending a request.');
        if (!state.profile.availability.length) throw new Error('Add your availability in My profile before sending a request.');
        state.requests = C.sendRequest(state.requests, 'me', p.id, new FormData(e.currentTarget).get('note')); save(); location.href = 'requests.html?tab=sent';
      }); });
      $('#request-form textarea')?.addEventListener('input', e => { $('#note-count').textContent = e.target.value.length + ' / 200 characters'; });
      $('#block-person').addEventListener('click', () => { state.blocked = [...new Set([...state.blocked, p.id])]; save(); location.href = 'find.html'; });
      $('#report-form').addEventListener('submit', e => { e.preventDefault(); const f = new FormData(e.currentTarget); state.reports.push({ person: p.id, reason: f.get('reason'), details: f.get('details') }); state.blocked = [...new Set([...state.blocked, p.id])]; save(); location.href = 'find.html'; });
    }
  }

  if ($('#profile-form')) {
    const form = $('#profile-form');
    for (const key of ['name', 'email', 'speaks', 'learns', 'level', 'goal']) form.elements[key].value = state.profile[key];
    for (const input of form.querySelectorAll('[name="interests"]')) input.checked = state.profile.interests.includes(input.value);
    $('#availability-editor').innerHTML = availabilityGrid(state.profile.availability, true);
    if (state.blocked.length) {
      const area = document.createElement('section'); area.className = 'card';
      area.innerHTML = '<h2>Hidden profiles</h2>' + state.blocked.map(id => `<p>${esc(person(id)?.name || id)} <button type="button" class="text-button" data-unblock="${esc(id)}">Unblock</button></p>`).join(''); form.append(area);
      area.addEventListener('click', e => { const b = e.target.closest('[data-unblock]'); if (b) { state.blocked = state.blocked.filter(id => id !== b.dataset.unblock); save(); b.closest('p').remove(); announce('Profile unblocked.'); } });
    }
    form.addEventListener('submit', e => { e.preventDefault(); run(() => {
      const f = new FormData(form);
      if (!String(f.get('name')).trim() || !String(f.get('goal')).trim()) throw new Error('Add your name and a short learning goal.');
      if (f.get('speaks') === f.get('learns')) throw new Error('Choose two different languages for your tandem.');
      state.profile = { ...state.profile, name: String(f.get('name')).trim(), email: String(f.get('email')).trim(), speaks: f.get('speaks'), learns: f.get('learns'), level: f.get('level'), goal: String(f.get('goal')).trim(), interests: f.getAll('interests'), availability: f.getAll('availability') };
      save(); avatar.textContent = initials(state.profile.name); $('#profile-result').innerHTML = 'Profile saved on this device. <a href="find.html">Find compatible partners →</a>'; announce('Profile saved. Your partner scores have been updated.');
    }); });
  }

  let activeTab = ['received', 'sent', 'matches'].includes(new URLSearchParams(location.search).get('tab')) ? new URLSearchParams(location.search).get('tab') : 'received';
  function renderRequests() {
    const all = state.requests.filter(r => !state.blocked.includes(r.from) && !state.blocked.includes(r.to));
    const groups = { received: all.filter(r => r.to === 'me' && r.status === 'pending'), sent: all.filter(r => r.from === 'me' && r.status !== 'accepted'), matches: all.filter(r => r.status === 'accepted') };
    document.querySelectorAll('[data-tab]').forEach(b => { const selected = b.dataset.tab === activeTab; b.setAttribute('aria-selected', selected); b.tabIndex = selected ? 0 : -1; b.textContent = `${b.dataset.tab[0].toUpperCase() + b.dataset.tab.slice(1)} (${groups[b.dataset.tab].length})`; });
    $('#request-panel').setAttribute('aria-labelledby', activeTab + '-tab');
    $('#request-panel').innerHTML = groups[activeTab].length ? groups[activeTab].map(r => {
      const p = person(r.from === 'me' ? r.to : r.from); if (!p) return '';
      if (activeTab === 'matches') return `<article class="card"><div class="partner-heading"><span class="avatar">${esc(p.initials)}</span><h2>You and ${esc(p.name)}</h2><span class="tag">Accepted</span></div><div class="split-bar"><span>20 min ${esc(state.profile.learns)}</span><span>20 min ${esc(state.profile.speaks)}</span></div><div class="two-grid section"><div><h3>Don’t leave the next meeting to chance.</h3><p>Shared times: ${esc(timesText(C.overlap(state.profile.availability, p.availability)))}</p><form data-meeting="${esc(r.id)}" class="form-stack"><label>Propose a date<input type="date" name="date" required value="${esc(r.meeting?.date || '')}"></label><label>Time<input type="time" name="time" required value="${esc(r.meeting?.time || '18:00')}"></label><label>Public meeting point<input name="place" required maxlength="120" value="${esc(r.meeting?.place || 'Campus café')}"></label><button class="button secondary" type="submit">Save meeting proposal</button></form>${r.meeting ? `<p class="meeting-saved">Proposal saved: ${esc(dateLabel(r.meeting.date))} at ${esc(r.meeting.time)}, ${esc(r.meeting.place)}. Agree it with your partner.</p>` : ''}</div><div><h3>Demo conversation</h3><p class="small muted">Messages stay on this device and are not delivered to another student.</p><div class="messages">${(r.messages || []).map(m => `<p>${esc(m)}</p>`).join('') || '<p class="muted">Say hello and suggest an easy first topic.</p>'}</div><form data-message="${esc(r.id)}" class="form-stack"><label>Message<textarea name="message" maxlength="500" required rows="3"></textarea></label><button class="button" type="submit">Add demo message</button></form></div></div></article>`;
      return `<article class="card"><div class="partner-heading"><span class="avatar">${esc(p.initials)}</span><div><h2>${esc(p.name)}</h2><p class="small muted">Offers ${esc(p.speaks)} · Practises ${esc(p.learns)}</p></div>${activeTab === 'received' ? `<div class="actions"><button class="button" data-respond="${esc(r.id)}" data-action="accepted">Accept</button><button class="button secondary" data-respond="${esc(r.id)}" data-action="declined">Decline</button></div>` : `<span class="tag ${r.status === 'declined' ? 'warm' : ''}">${esc(r.status)}</span>`}</div><p class="request-note">${esc(r.note || 'No note added.')}</p><a class="text-link" href="profile.html?id=${encodeURIComponent(p.id)}">View profile →</a></article>`;
    }).join('') : `<div class="empty-state"><h2>${activeTab === 'matches' ? 'Your next tandem starts here.' : 'Nothing here yet.'}</h2><p>${activeTab === 'matches' ? 'Accept a request or wait for a partner to accept yours.' : 'Explore partners and start a conversation.'}</p><a class="button secondary" href="find.html">Find a partner</a></div>`;
  }
  if ($('#request-panel')) {
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderRequests(); }));
    $('.request-tabs').addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const tabs = [...document.querySelectorAll('[data-tab]')], current = tabs.indexOf(document.activeElement); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; activeTab = tabs[next].dataset.tab; renderRequests(); tabs[next].focus(); });
    $('#request-panel').addEventListener('click', e => { const b = e.target.closest('[data-respond]'); if (b) run(() => { state.requests = C.respond(state.requests, b.dataset.respond, 'me', b.dataset.action); save(); if (b.dataset.action === 'accepted') activeTab = 'matches'; renderRequests(); announce(b.dataset.action === 'accepted' ? 'Tandem accepted. Plan your first meeting.' : 'Request declined. No message was sent.'); }); });
    $('#request-panel').addEventListener('submit', e => { e.preventDefault(); run(() => { const form = e.target, data = new FormData(form), id = form.dataset.meeting || form.dataset.message, r = state.requests.find(r => r.id === id && r.status === 'accepted'); if (!r) throw new Error('This match is unavailable.'); if (form.dataset.meeting) { r.meeting = { date: data.get('date'), time: data.get('time'), place: String(data.get('place')).trim() }; } else { const message = String(data.get('message')).trim(); if (!message) throw new Error('Add a message first.'); r.messages = [...(r.messages || []), message]; } save(); renderRequests(); announce(form.dataset.meeting ? 'Meeting proposal saved locally.' : 'Demo message added on this device.'); }); });
    renderRequests();
  }

  function renderEvents() { $('#event-list').innerHTML = events().map(e => `<div id="event-${esc(e.id)}">${eventCard(e)}</div>`).join(''); }
  if ($('#event-list')) {
    renderEvents(); $('#event-list').addEventListener('click', e => { const button = e.target.closest('[data-join]'); if (button) run(() => { const event = events().find(x => x.id === button.dataset.join); const wasJoined = state.joined.includes(event.id); state.joined = C.toggleAttendance(state.joined, event); save(); renderEvents(); announce(wasJoined ? 'You left the sample event.' : 'You joined the sample event. The host welcomes newcomers.'); }); });
    $('#event-form').addEventListener('submit', e => { e.preventDefault(); const f = new FormData(e.target); state.events.push({ id: 'event-' + Date.now(), title: String(f.get('title')).trim(), language: String(f.get('language')).trim(), date: f.get('date'), time: f.get('time'), place: String(f.get('place')).trim(), capacity: Number(f.get('capacity')), attendees: 0, description: 'Newcomers are welcome. The host helps everyone find a conversation partner.' }); save(); renderEvents(); e.target.reset(); announce('Sample event created on this device.'); });
  }

  $('#register-form')?.addEventListener('submit', e => { e.preventDefault(); run(() => {
    const f = new FormData(e.currentTarget); if (!String(f.get('name')).trim()) throw new Error('Add your name first.'); if (f.get('speaks') === f.get('learns')) throw new Error('Choose two different languages.');
    state.profile = { ...state.profile, name: String(f.get('name')).trim(), email: String(f.get('email')).trim(), speaks: f.get('speaks'), learns: f.get('learns'), level: f.get('level'), availability: [] }; save(); location.href = 'my-profile.html';
  }); });
  $('#login-form')?.addEventListener('submit', e => {
    e.preventDefault(); const email = String(new FormData(e.currentTarget).get('email')).trim().toLowerCase();
    if (email !== state.profile.email.toLowerCase()) { $('#login-result').textContent = 'Use the email in your local demo profile, or create a new demo profile.'; return; }
    location.href = 'my-profile.html';
  });
  $('#recovery-form')?.addEventListener('submit', e => { e.preventDefault(); $('#recovery-result').textContent = 'If an account exists for this address, the real service would send recovery instructions. This prototype sends no email.'; });
})();
