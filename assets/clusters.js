(function () {
  const S = window.SITE
  const last = S.iterations[S.iterations.length - 1]
  const codes = Object.fromEntries(S.snapshots[last.id].codes.map((c) => [c.id, c]))
  const params = new URLSearchParams(location.search)
  const edit = params.has('edit')
  let view = params.get('view') === 'list' ? 'list' : 'tree'
  const collapsed = new Set()
  const KEY = 'clusters-draft'
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  let T = JSON.parse(JSON.stringify(window.CLUSTERS))
  if (edit) { try { const d = localStorage.getItem(KEY); if (d) T = JSON.parse(d) } catch (e) {} }

  document.querySelectorAll('[data-title]').forEach((el) => { el.textContent = S.study.title })
  document.querySelectorAll('nav a[data-page="clusters"]').forEach((a) => a.setAttribute('aria-current', 'page'))

  const total = (ids) => ids.reduce((n, id) => n + (codes[id]?.count || 0), 0)
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(T)) } catch (e) {} render() }

  function treeSvg() {
    const RH = 24, CX = 0, CW = 340, KX = 380, KW = 230, LX = 650, PAD = 14, LH = 16
    const ctx = document.createElement('canvas').getContext('2d')
    const family = getComputedStyle(document.body).fontFamily
    const wrap = (text, px, max) => { ctx.font = `700 ${px}px ${family}`
      const lines = []; let line = ''
      text.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w
        if (line && ctx.measureText(t).width > max) { lines.push(line); line = w } else line = t })
      if (line) lines.push(line); return lines }
    const label = (n) => n.name + (n.more ? ` (${n.more})` : '')
    const need = (lines) => Math.ceil((lines.length * LH + 10) / RH)
    const rows = [], nodes = [], edges = []
    const pad = (start, k) => { while (rows.length - start < k) rows.push(0) }
    T.categories.forEach((c, ci) => {
      const cKey = 'c' + ci, kids = [], cStart = rows.length
      const cLines = wrap(label({ name: c.name, more: collapsed.has(cKey) ? c.concepts.length : 0 }), 13, CW - 28)
      if (collapsed.has(cKey)) { pad(cStart, need(cLines)); nodes.push({ kind: 'cat', key: cKey, lines: cLines, y: (cStart + rows.length - 1) / 2 }); rows.push(0); return }
      c.concepts.forEach((k, ki) => {
        const kKey = cKey + 'k' + ki, kStart = rows.length
        const kLines = wrap(label({ name: k.name, more: collapsed.has(kKey) ? k.codes.length : 0 }), 12, KW - 26)
        if (collapsed.has(kKey) || !k.codes.length) rows.push(0)
        else [...k.codes].sort((a, b) => (codes[b]?.count || 0) - (codes[a]?.count || 0)).forEach((id) => { rows.push(0)
          nodes.push({ kind: 'code', id, y: rows.length - 1 }); edges.push([kKey, rows.length - 1]) })
        pad(kStart, need(kLines))
        const y = (kStart + rows.length - 1) / 2
        nodes.push({ kind: 'con', key: kKey, lines: kLines, y }); kids.push(y); edges.push([cKey, y, kKey])
      })
      pad(cStart, need(cLines))
      nodes.push({ kind: 'cat', key: cKey, lines: cLines, y: (kids[0] + kids[kids.length - 1]) / 2 })
      rows.push(0) // gap between categories
    })
    const Y = (r) => PAD + r * RH + RH / 2
    const pos = Object.fromEntries(nodes.filter((n) => n.key).map((n) => [n.key, n]))
    const curve = (x1, y1, x2, y2) => { const m = (x1 + x2) / 2; return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}` }
    const paths = edges.map(([from, y, to]) => { const p = pos[from], x1 = p.kind === 'cat' ? CX + CW : KX + KW, x2 = to ? KX : LX - 6
      return `<path d="${curve(x1, Y(p.y), x2, Y(y))}" fill="none" stroke="#c4cdc7" stroke-width="1.2"/>` }).join('')
    const box = (n, x, w, cls) => { const hgt = n.lines.length * LH + 10, top = Y(n.y) - hgt / 2
      return `<g class="node ${cls}" data-key="${n.key}" tabindex="0" role="button" aria-label="${esc(n.lines.join(' '))}">
      <rect x="${x}" y="${top}" width="${w}" height="${hgt}" rx="8"/><text x="${x + 12}" y="${top + 5 + LH / 2 + 4.5}">${n.lines.map((l, i) => `<tspan x="${x + 12}" dy="${i ? LH : 0}">${esc(l)}</tspan>`).join('')}</text></g>` }
    const body = nodes.map((n) => {
      if (n.kind === 'cat') return box(n, CX, CW, 'cat-node')
      if (n.kind === 'con') return box(n, KX, KW, 'con-node')
      const c = codes[n.id]; if (!c) return ''
      return `<a href="segments.html?code=${n.id}"><circle cx="${LX}" cy="${Y(n.y)}" r="4.5" fill="${c.color}"/><text class="leaf" x="${LX + 12}" y="${Y(n.y) + 4.5}">${esc(c.name)}<tspan class="leaf-n"> ${c.count}</tspan></text></a>` }).join('')
    const h = PAD * 2 + rows.length * RH
    return `<div class="tree-wrap panel"><svg class="tree" width="1270" height="${h}" viewBox="0 0 1270 ${h}">${paths}${body}</svg></div>`
  }

  function render() {
    const placed = new Set(T.categories.flatMap((c) => c.concepts.flatMap((k) => k.codes)))
    const loose = Object.keys(codes).filter((id) => !placed.has(id))
    const options = (cur) => T.categories.map((c, ci) => `<optgroup label="${esc(c.name)}">${c.concepts.map((k, ki) =>
      `<option value="${ci}:${ki}" ${cur === `${ci}:${ki}` ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</optgroup>`).join('') +
      `<option value="loose" ${cur === 'loose' ? 'selected' : ''}>Unclustered</option>`
    const codeRow = (id, cur) => { const c = codes[id]; if (!c) return ''
      return `<li><span class="name"><a href="segments.html?code=${id}"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</a></span>
        ${edit ? `<select class="move" data-id="${id}" data-from="${cur}" aria-label="Move code">${options(cur)}</select>` : ''}<span class="n">${c.count}</span></li>` }
    const btn = (act, label, data) => edit ? `<button type="button" class="mini" data-act="${act}" ${data}>${label}</button>` : ''
    const toggle = `<div class="tabs view-tabs"><a href="#" data-view="tree" ${view === 'tree' ? 'aria-current="page"' : ''}>Tree</a><a href="#" data-view="list" ${view === 'list' ? 'aria-current="page"' : ''}>List</a></div>`
    if (view === 'tree') { document.getElementById('tree').innerHTML = toggle + treeSvg() + (loose.length ? `<p class="count">${loose.length} unclustered</p>` : ''); return }
    document.getElementById('tree').innerHTML = toggle +
      (edit ? `<div class="toolbar"><button type="button" class="btn" data-act="add-cat">Add category</button><button type="button" class="btn" data-act="download">Save clusters.js</button><button type="button" class="btn" data-act="reset">Reset to file</button></div>` : '') +
      T.categories.map((c, ci) => { const ids = c.concepts.flatMap((k) => k.codes)
        return `<section class="cat"><h2 class="cat-h">${esc(c.name)}<span class="n">${c.concepts.length} concepts · ${ids.length} codes · ${total(ids)}</span>
          ${btn('ren-cat', 'Rename', `data-ci="${ci}"`)}${btn('add-con', 'Add concept', `data-ci="${ci}"`)}${btn('del-cat', 'Delete', `data-ci="${ci}"`)}</h2>
          ${c.concepts.map((k, ki) => `<div class="concept panel"><h3>${esc(k.name)}<span class="n">${k.codes.length} · ${total(k.codes)}</span>
            ${btn('ren-con', 'Rename', `data-ci="${ci}" data-ki="${ki}"`)}${btn('del-con', 'Delete', `data-ci="${ci}" data-ki="${ki}"`)}</h3>
            <ul class="list">${[...k.codes].sort((a, b) => (codes[b]?.count || 0) - (codes[a]?.count || 0)).map((id) => codeRow(id, `${ci}:${ki}`)).join('')}</ul></div>`).join('')}
        </section>` }).join('') +
      (loose.length ? `<section class="cat"><h2 class="cat-h">Unclustered<span class="n">${loose.length}</span></h2><div class="concept panel"><ul class="list">${loose.map((id) => codeRow(id, 'loose')).join('')}</ul></div></section>` : '')
  }

  document.getElementById('tree').addEventListener('change', (e) => { const s = e.target.closest('select.move'); if (!s) return
    const id = s.dataset.id, from = s.dataset.from, to = s.value
    if (from !== 'loose') { const [ci, ki] = from.split(':').map(Number); T.categories[ci].concepts[ki].codes = T.categories[ci].concepts[ki].codes.filter((x) => x !== id) }
    if (to !== 'loose') { const [ci, ki] = to.split(':').map(Number); T.categories[ci].concepts[ki].codes.push(id) }
    save() })
  document.getElementById('tree').addEventListener('click', (e) => {
    const v = e.target.closest('[data-view]')
    if (v) { e.preventDefault(); view = v.dataset.view; const u = new URL(location.href); view === 'list' ? u.searchParams.set('view', 'list') : u.searchParams.delete('view'); history.replaceState(null, '', u); render(); return }
    const g = e.target.closest('g.node')
    if (g) { const k = g.dataset.key; collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k); render(); return }
    const b = e.target.closest('button[data-act]'); if (!b) return
    const ci = Number(b.dataset.ci), ki = Number(b.dataset.ki), act = b.dataset.act
    if (act === 'add-cat') { const n = prompt('Category name'); if (n) T.categories.push({ name: n.trim(), concepts: [{ name: 'New concept', codes: [] }] }) }
    if (act === 'ren-cat') { const n = prompt('Category name', T.categories[ci].name); if (n) T.categories[ci].name = n.trim() }
    if (act === 'del-cat') T.categories.splice(ci, 1)
    if (act === 'add-con') { const n = prompt('Concept name'); if (n) T.categories[ci].concepts.push({ name: n.trim(), codes: [] }) }
    if (act === 'ren-con') { const n = prompt('Concept name', T.categories[ci].concepts[ki].name); if (n) T.categories[ci].concepts[ki].name = n.trim() }
    if (act === 'del-con') T.categories[ci].concepts.splice(ki, 1)
    if (act === 'reset') { try { localStorage.removeItem(KEY) } catch (e) {} T = JSON.parse(JSON.stringify(window.CLUSTERS)) }
    if (act === 'download') { const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(['window.CLUSTERS = ' + JSON.stringify(T, null, 1) + ';\n'], { type: 'text/javascript' }))
      a.download = 'clusters.js'; a.click(); return }
    save() })
  render()
})()
