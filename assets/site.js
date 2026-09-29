(function () {
  const S = window.SITE
  const params = new URLSearchParams(location.search)
  const iter = S.iterations.find((i) => i.id === params.get('iter')) || S.iterations[S.iterations.length - 1]
  const snap = S.snapshots[iter.id]
  const codeById = Object.fromEntries(snap.codes.map((c) => [c.id, c]))
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const chip = (id) => { const c = codeById[id]; return c ? `<span class="chip" style="background:${c.color}">${esc(c.name)}</span>` : '' }
  const q = (iterParam) => (S.iterations.length > 1 ? `iter=${iter.id}&` : '') + iterParam
  const posts = Object.fromEntries(Object.values(S.threads).flatMap((t) => t.posts.map((p) => [p.id, p])))
  const byCount = [...snap.codes].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  const page = document.body.dataset.page
  const tlabel = (id) => (S.study.thread_labels || {})[id] || S.threads[id]?.title || id || ''
  const iterLabel = `Iteration ${S.iterations.indexOf(iter) + 1}`

  document.querySelectorAll('[data-title]').forEach((el) => { el.textContent = S.study.title })
  document.querySelectorAll(`nav a[data-page="${page}"]`).forEach((a) => a.setAttribute('aria-current', 'page'))
  if (params.get('iter')) document.querySelectorAll('nav a').forEach((a) => { a.href = a.getAttribute('href').split('?')[0] + '?iter=' + iter.id })

  function codeList(el, selected, onPick) {
    el.innerHTML = `<input class="field" id="code-search" placeholder="Find a code…" aria-label="Find a code">
      <p class="eyebrow" style="margin:.7rem .45rem .1rem">${snap.codes.length} codes · ${esc(iterLabel)}</p>
      <ul class="codes"><li><button type="button" data-code="" aria-pressed="${!selected}">All passages<span class="n">${snap.segments.length}</span></button></li>
      ${byCount.map((c) => `<li><button type="button" data-code="${c.id}" aria-pressed="${selected === c.id}" title="${esc(c.description || c.name)}"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}<span class="n">${c.count}</span></button></li>`).join('')}</ul>`
    el.querySelector('#code-search').addEventListener('input', (e) => {
      const needle = e.target.value.toLowerCase()
      el.querySelectorAll('button[data-code]').forEach((b) => { b.parentElement.hidden = b.dataset.code && !b.textContent.toLowerCase().includes(needle) })
    })
    el.addEventListener('click', (e) => { const b = e.target.closest('button[data-code]'); if (!b) return
      el.querySelectorAll('button[data-code]').forEach((x) => x.setAttribute('aria-pressed', x === b)); onPick(b.dataset.code) })
  }

  /* ---------------- overview ---------------- */
  if (page === 'overview') {
    const n = S.iterations.indexOf(iter)
    const tabs = `<div class="tabs">${S.iterations.map((i, k) => `<a href="?iter=${i.id}" ${i.id === iter.id ? 'aria-current="page"' : ''}>Iteration ${k + 1}</a>`).join('')}</div>`
    const byName = Object.fromEntries(snap.codes.map((c) => [c.name, c]))
    const name = (nm) => { const c = byName[nm]
      return c ? `<a href="segments.html?${q('code=' + c.id)}"><span class="dot" style="background:${c.color}"></span>${esc(nm)}</a>` : `<span class="gone">${esc(nm)}</span>` }
    const row = (inner, k) => `<li><span class="name">${inner}</span>${k === undefined ? '' : `<span class="n">${k}</span>`}</li>`
    const block = (title, rows) => rows.length ? `<section><h2>${title}<span class="n">${rows.length}</span></h2><ul class="list panel">${rows.join('')}</ul></section>` : ''
    const merges = snap.merges || []
    const mergedAway = new Set(merges.flatMap((m) => [m.source, m.target]))
    const edited = [
      ...merges.map((m) => row(`${esc(m.source)} <span class="op">+</span> ${esc(m.target)} <span class="op">→</span> ${name(m.merged)}`)),
      ...(iter.diff?.renamed || []).filter((r) => !mergedAway.has(r.before)).map((r) => row(`${esc(r.before)} <span class="op">→</span> ${name(r.after)}`)),
      ...(iter.diff?.removed || []).filter((r) => !mergedAway.has(r.name)).map((r) => row(`<span class="gone">${esc(r.name)}</span>`)),
    ]
    const introduced = n ? new Set((snap.introduced || []).map((c) => c.id)) : new Set()
    document.getElementById('content').innerHTML = tabs +
      (iter.label ? `<p class="label">${esc(iter.label)}</p>` : '') +
      block('Merged or edited', edited) +
      block('New codes applied this pass', byCount.filter((c) => introduced.has(c.id)).map((c) => row(name(c.name), c.count))) +
      block(introduced.size ? 'Rest of the codebook' : 'Codebook', byCount.filter((c) => !introduced.has(c.id)).map((c) => row(name(c.name), c.count)))
  }

  /* ---------------- segments ---------------- */
  if (page === 'segments') {
    let code = params.get('code') || '', text = '', threadSel = params.get('thread') || ''
    const list = document.getElementById('list'), count = document.getElementById('count')
    const segs = [...snap.segments].sort((a, b) => iter.threads.indexOf(a.thread) - iter.threads.indexOf(b.thread) || a.post - b.post || a.start - b.start)
    if (iter.threads.length > 1) { const sel = document.createElement('select'); sel.className = 'field'; sel.style.maxWidth = '14rem'; sel.setAttribute('aria-label', 'Source'); sel.innerHTML = `<option value="">All sources</option>${iter.threads.map((t) => `<option value="${t}" ${t === threadSel ? 'selected' : ''}>${esc(tlabel(t))}</option>`).join('')}`; sel.addEventListener('change', () => { threadSel = sel.value; render() }); document.getElementById('q').after(sel) }
    function render() {
      const needle = text.toLowerCase()
      const shown = segs.filter((s) => (!threadSel || s.thread === threadSel) && (!code || s.codes.includes(code)) && (!needle || s.text.toLowerCase().includes(needle) || s.codes.some((c) => codeById[c]?.name.toLowerCase().includes(needle))))
      count.textContent = `${shown.length} of ${segs.length} passages${code ? ` coded “${codeById[code]?.name}”` : ''}`
      list.innerHTML = shown.map((s) => { const p = posts[s.item]
        return `<article class="panel card"><div class="meta">${iter.threads.length > 1 ? `<span class="tag">${esc(tlabel(s.thread))}</span>` : ''}<span class="tag">Post ${s.post}</span><span>${esc(p?.who || '')}${p?.op ? ' · started thread' : ''}</span><span>${esc(p?.date || '')}</span><a href="thread.html?${q('thread=' + s.thread + '&focus=' + s.id)}#seg-${s.id}" style="margin-left:auto">View in thread →</a></div>
          <blockquote>${esc(s.text)}</blockquote><div class="chips">${s.codes.map(chip).join('')}</div></article>` }).join('') || '<p class="empty">No passages match.</p>'
      const url = new URL(location.href); code ? url.searchParams.set('code', code) : url.searchParams.delete('code'); history.replaceState(null, '', url)
    }
    codeList(document.getElementById('side'), code, (c) => { code = c; render() })
    document.getElementById('q').addEventListener('input', (e) => { text = e.target.value; render() })
    render()
  }

  /* ---------------- thread ---------------- */
  if (page === 'thread') {
    const thread = (iter.threads.includes(params.get('thread')) && S.threads[params.get('thread')]) || S.threads[iter.threads[0]]
    const focusId = params.get('focus')
    const segsByPost = {}
    snap.segments.filter((s) => s.thread === thread.id).forEach((s) => (segsByPost[s.item] ||= []).push(s))
    const ttabs = iter.threads.length > 1 ? `<div class="tabs">${iter.threads.map((t) => `<a href="?${q('thread=' + t)}" ${t === thread.id ? 'aria-current="page"' : ''}>${esc(tlabel(t))}</a>`).join('')}</div>` : ''
    document.getElementById('thread-title').innerHTML = `${ttabs}${esc(thread.title)}${thread.url ? ` · <a href="${thread.url}" target="_blank" rel="noopener">original thread ↗</a>` : ''}`
    let onlyCode = ''
    function body(p) {
      const segs = (segsByPost[p.id] || []).filter((s) => s.end <= p.body.length)
      if (!segs.length) return esc(p.body)
      const cuts = [...new Set([0, p.body.length, ...segs.flatMap((s) => [s.start, s.end])])].sort((a, b) => a - b)
      return cuts.slice(0, -1).map((a, i) => { const b = cuts[i + 1], cover = segs.filter((s) => s.start <= a && s.end >= b), t = esc(p.body.slice(a, b))
        if (!cover.length) return t
        const ids = [...new Set(cover.flatMap((s) => s.codes))], color = codeById[ids[0]]?.color || '#d99a2b'
        const dim = onlyCode && !ids.includes(onlyCode)
        const anchor = cover.find((s) => s.start === a)
        return `<mark ${anchor ? `id="seg-${anchor.id}"` : ''} class="${dim ? 'dim' : ''}" data-codes="${ids.join(',')}" style="background:${color}30;box-shadow:inset 0 -2px ${color}">${t}</mark>` }).join('')
    }
    function render() {
      const depthRail = (d) => Array.from({ length: Math.min(d, 8) }, (_, i) => `<span class="rail" style="left:${-(i + 1) * 22 + 10}px"></span>`).join('')
      document.getElementById('list').innerHTML = thread.posts.map((p) => {
        const segs = segsByPost[p.id] || [], ids = [...new Set(segs.flatMap((s) => s.codes))]
        const first = codeById[ids[0]]
        return `<article class="panel post ${segs.some((s) => s.id === focusId) ? 'focus' : ''}" id="post-${p.post}" style="margin-left:${Math.min(p.depth, 8) * 22}px;${first ? `border-left:3px solid ${first.color}` : ''}">${depthRail(p.depth)}
          <div class="meta"><span class="tag">Post ${p.post}</span><b style="color:var(--ink)">${esc(p.who)}</b>${p.op ? '<span class="tag">started thread</span>' : ''}<span>${esc(p.date)}</span>${p.url ? `<a href="${p.url}" target="_blank" rel="noopener" style="margin-left:auto">source ↗</a>` : ''}</div>
          <p>${body(p)}</p>${ids.length ? `<div class="chips" style="margin-top:.5rem">${ids.map(chip).join('')}</div>` : ''}</article>` }).join('')
    }
    codeList(document.getElementById('side'), '', (c) => { onlyCode = c; render() })
    render()
    const tip = document.getElementById('tip')
    document.getElementById('list').addEventListener('mouseover', (e) => { const m = e.target.closest('mark'); if (!m) { tip.hidden = true; return }
      tip.innerHTML = `<p class="eyebrow" style="margin-bottom:.4rem">Codes for this passage</p><div class="chips">${m.dataset.codes.split(',').map(chip).join('')}</div>`
      const r = m.getBoundingClientRect(); tip.hidden = false
      tip.style.left = Math.min(r.left, innerWidth - tip.offsetWidth - 12) + 'px'; tip.style.top = (r.top > 120 ? r.top - tip.offsetHeight - 8 : r.bottom + 8) + 'px' })
    document.getElementById('list').addEventListener('mouseleave', () => { tip.hidden = true })
    if (focusId) setTimeout(() => document.getElementById('seg-' + focusId)?.scrollIntoView({ block: 'center' }), 50)
  }

})()
