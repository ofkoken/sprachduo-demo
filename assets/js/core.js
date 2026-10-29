(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SprachDuoCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const overlap = (a = [], b = []) => [...new Set(a)].filter(x => b.includes(x));

  function fit(viewer, person, blocked = []) {
    if (viewer.id === person.id || blocked.includes(person.id) || (person.blocked || []).includes(viewer.id)) return null;
    if (viewer.speaks !== person.learns || viewer.learns !== person.speaks) return null;
    const times = overlap(viewer.availability, person.availability);
    const interests = overlap(viewer.interests, person.interests);
    const gap = Math.abs(levels.indexOf(viewer.level) - levels.indexOf(person.level));
    return { person, times, interests, provisional: !viewer.availability?.length,
      score: 40 + Math.min(30, times.length * 5) + Math.max(0, 15 - gap * 5) + Math.min(15, interests.length * 5) };
  }

  function search(viewer, people, options = {}) {
    const { blocked = [], format = 'any', tolerance = 5 } = options;
    return people.map(p => fit(viewer, p, blocked)).filter(Boolean)
      .filter(r => format === 'any' || r.person.format === 'either' || r.person.format === format)
      .filter(r => Math.abs(levels.indexOf(viewer.level) - levels.indexOf(r.person.level)) <= tolerance)
      .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
  }

  function sendRequest(requests, from, to, note, now = Date.now()) {
    const text = String(note).trim();
    if (from === to) throw new Error('Choose another student.');
    if (text.length > 200) throw new Error('Keep your note to 200 characters or fewer.');
    if (requests.some(r => r.from === from && r.to === to && now - r.created < 7 * 86400000)) {
      throw new Error('You already sent this person a request within the last seven days.');
    }
    if (requests.some(r => r.status === 'accepted' && [r.from, r.to].includes(from) && [r.from, r.to].includes(to))) {
      throw new Error('You are already matched. Open your matches instead.');
    }
    return [...requests, { id: 'request-' + now, from, to, note: text, created: now, status: 'pending' }];
  }

  function respond(requests, id, recipient, action) {
    if (!['accepted', 'declined'].includes(action)) throw new Error('Choose Accept or Decline.');
    const request = requests.find(r => r.id === id);
    if (!request || request.to !== recipient || request.status !== 'pending') throw new Error('This request is no longer available.');
    return requests.map(r => r.id === id ? { ...r, status: action } : r);
  }

  function toggleAttendance(joined, event) {
    if (joined.includes(event.id)) return joined.filter(id => id !== event.id);
    if (event.attendees >= event.capacity) throw new Error('This event is full. Try another event.');
    return [...joined, event.id];
  }

  return { levels, overlap, fit, search, sendRequest, respond, toggleAttendance };
}));
