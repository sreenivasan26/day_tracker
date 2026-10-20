// Day tracker (phone). State follows docs/api-contract.md "v3.2": DayItem / DayEntry schemas, plan file in, day-log file out.
// State: { v:2, items:[DayItem], entries:[DayEntry], deleted_item_ids, deleted_entry_ids, planLoadedAt, lastExportAt, lastChangeAt, lastCat }
// Times in entries are minutes since local midnight; `ts` is the epoch ms a running timer started. ONE localStorage module (this file).
export const DAY_KEY = 'notes-tasks.day.v2'
export const OLD_KEY = 'notes-tasks.day.v1'
export const CATS = ['work', 'meet', 'personal', 'learn']
const LABEL = { work: 'Work', meet: 'Meetings', personal: 'Personal', learn: 'Learning' }
const SLOT = { work: 1, meet: 2, personal: 5, learn: 4 } // mockup Day colours
export const catLabel = (c) => LABEL[c] || 'Work'
export const catColor = (c) => `var(--color-day-${SLOT[c] || 1})`
export const catBg = (c) => `var(--color-day-${SLOT[c] || 1}-bg)`
const MIN = 60000
const DAY_MIN = 1440

export const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const b = new Uint8Array(16); (globalThis.crypto || { getRandomValues: (a) => a.forEach((_, i) => { a[i] = Math.random() * 256 }) }).getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '')

/* ---------- dates and formatting ---------- */
const p2 = (n) => String(n).padStart(2, '0')
export const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` }
export const dayStart = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
export const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n).getTime()) }
export const clockOf = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}` }
export const isoLocal = (ms) => { const d = new Date(ms); return `${dayKey(ms)}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}` }
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const longDay = (key) => { const d = new Date(dayStart(key)); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` }
export const shortDay = (key) => { const d = new Date(dayStart(key)); return `${WD[d.getDay()]} ${d.getDate()}` }
export const stamp = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MON[d.getMonth()]} ${clockOf(ms)}` }
export const fmtMin = (m) => {
  m = Math.max(0, Math.floor(m)); const h = Math.floor(m / 60), r = m % 60
  return h === 0 ? `${r} min` : r === 0 ? `${h} h` : `${h} h ${p2(r)}`
}
export const clock = (ms) => { const s = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(s / 3600)}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}` }
export const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
export const hhmmOf = (m) => (m == null ? '' : `${p2(Math.floor(m / 60))}:${p2(m % 60)}`)

/* ---------- state ---------- */
export const blank = () => ({ v: 2, items: [], entries: [], deleted_item_ids: [], deleted_entry_ids: [], planLoadedAt: null, lastExportAt: null, lastChangeAt: null, lastCat: 'work' })
const touch = (st, now) => ({ ...st, lastChangeAt: now })

export const entriesOf = (st, itemId) => st.entries.filter((e) => e.item_id === itemId)
export const planMin = (it) => (it.plan > 0 ? it.plan : 0)
export const planEnd = (it) => (it.start != null && it.plan > 0 ? it.start + it.plan : null)
export const entStart = (en) => (en.e == null && en.ts ? en.ts : dayStart(en.date) + en.s * MIN)
export const entEnd = (en, now) => (en.e == null ? now : dayStart(en.date) + en.e * MIN)
export const isRunning = (st, id) => st.entries.some((e) => e.item_id === id && e.e == null)
export const runningTimers = (st) =>
  st.entries.filter((e) => e.e == null).map((entry) => ({ entry, item: st.items.find((i) => i.id === entry.item_id) })).filter((x) => x.item)
    .sort((a, b) => entStart(b.entry) - entStart(a.entry))
export const runningCount = (st) => runningTimers(st).length
const overlap = (en, now, d0, d1) => Math.max(0, Math.min(entEnd(en, now), d1) - Math.max(entStart(en), d0))
// logged ms of a set of entries within one calendar day
export const loggedOn = (entries, key, now) => { const d0 = dayStart(key), d1 = dayStart(addDays(key, 1)); return entries.reduce((s, e) => s + overlap(e, now, d0, d1), 0) }
export const totalMs = (entries, now) => entries.reduce((s, e) => s + Math.max(0, entEnd(e, now) - entStart(e)), 0)
export const itemsOn = (st, key) => st.items.filter((i) => i.date === key)

/* ---------- mutations (pure: return a new state) ---------- */
export const addItem = (st, { title, cat, date, plan = null, start = null, added_on_phone = true }, now = Date.now()) => {
  const it = { id: uuid(), date, cat, title: title.trim(), plan, start, done: false, task_id: null, task_title: null, added_on_phone, created_at: isoLocal(now), updated_at: isoLocal(now) }
  return { st: touch({ ...st, items: [...st.items, it], lastCat: cat }, now), item: it }
}
export const patchItem = (st, id, patch, now = Date.now()) => touch({ ...st, items: st.items.map((i) => (i.id === id ? { ...i, ...patch, updated_at: isoLocal(now) } : i)) }, now)
export const deleteItem = (st, id, now = Date.now()) => touch({ ...st, items: st.items.filter((i) => i.id !== id), entries: st.entries.filter((e) => e.item_id !== id), deleted_item_ids: [...new Set([...st.deleted_item_ids, id])] }, now)
const mkEntry = (item_id, date, s, e, extra = {}, now = Date.now()) => ({ id: uuid(), item_id, date, s, e, ts: null, source: 'phone', updated_at: isoLocal(now), ...extra })

// Many timers may run at once; starting one never stops another.
export const startTimer = (st, id, now = Date.now()) => {
  if (isRunning(st, id)) return st
  const date = dayKey(now), s = Math.min(DAY_MIN - 1, Math.floor((now - dayStart(date)) / MIN))
  // starting a timer on a Done item un-ticks it
  const items = st.items.map((i) => (i.id === id && i.done ? { ...i, done: false, updated_at: isoLocal(now) } : i))
  return touch({ ...st, items, entries: [...st.entries, mkEntry(id, date, s, null, { ts: now }, now)] }, now)
}
// Stop: a timer that crossed midnight is split into one entry per day.
export const stopTimer = (st, id, now = Date.now()) => {
  const out = []
  let stopped = false
  for (const en of st.entries) {
    if (en.item_id !== id || en.e != null) { out.push(en); continue }
    stopped = true
    const startMs = entStart(en)
    let key = en.date, first = true
    for (;;) {
      const d0 = dayStart(key), d1 = dayStart(addDays(key, 1))
      const last = now < d1
      const s = first ? en.s : 0
      let e = last ? Math.floor((Math.max(now, d0) - d0) / MIN) : DAY_MIN
      e = Math.min(DAY_MIN, Math.max(e, s + 1))
      out.push(first ? { ...en, e, ts: null, updated_at: isoLocal(now) } : mkEntry(id, key, s, e, {}, now))
      if (last || Math.max(startMs, d0) >= now) break
      key = addDays(key, 1); first = false
    }
  }
  // stopping a timer marks the item Done (done + updated_at are exported, so the web takes it)
  const items = st.items.map((i) => (i.id === id && stopped ? { ...i, done: true, updated_at: isoLocal(now) } : i))
  return touch({ ...st, items, entries: out }, now)
}
export const addEntry = (st, id, date, s, e, now = Date.now()) => touch({ ...st, entries: [...st.entries, mkEntry(id, date, s, e, {}, now)] }, now)
export const updateEntry = (st, eid, patch, now = Date.now()) => touch({ ...st, entries: st.entries.map((x) => (x.id === eid ? { ...x, ...patch, updated_at: isoLocal(now) } : x)) }, now)
export const deleteEntry = (st, eid, now = Date.now()) => touch({ ...st, entries: st.entries.filter((e) => e.id !== eid), deleted_entry_ids: [...new Set([...st.deleted_entry_ids, eid])] }, now)

/* ---------- Today ---------- */
export const groupItems = (st, key, now) =>
  CATS.map((cat) => {
    const list = itemsOn(st, key).filter((i) => i.cat === cat).sort((a, b) => Number(a.done) - Number(b.done) || (a.start ?? 1e9) - (b.start ?? 1e9))
    return { cat, list, logged: list.reduce((s, i) => s + loggedOn(entriesOf(st, i.id), key, now), 0) / MIN, planned: list.reduce((s, i) => s + planMin(i), 0) }
  })
export const dayTotals = (st, key, now) => {
  const list = itemsOn(st, key)
  const logged = list.reduce((s, i) => s + loggedOn(entriesOf(st, i.id), key, now), 0) / MIN
  const plan = list.reduce((s, i) => s + planMin(i), 0)
  return { logged, plan, over: plan > 0 && Math.floor(logged) > plan, count: list.length }
}

/* ---------- Timeline: Planned lane + Logged lane, 06:00 to 23:00 ---------- */
export const T_START = 360
export const T_END = 1380
export const HPX = 56 / 60 // px per minute (56px per hour)
export const MIN_BLOCK_PX = 20
export const BLOCK_GAP_PX = 2
export const yOf = (m) => (m - T_START) * HPX
export const blockPx = (minutes) => Math.max(MIN_BLOCK_PX, minutes * HPX - BLOCK_GAP_PX)
// Side-by-side columns for blocks whose DRAWN boxes overlap (a block is drawn at least MIN_BLOCK_PX tall).
// Input [{ s, e }] minutes -> copies with col and cols. Blocks that do not collide stay full width (cols 1).
export function layoutLane(blocks) {
  const drawnEnd = (b) => Math.max(b.e, b.s + (MIN_BLOCK_PX + BLOCK_GAP_PX) / HPX)
  const sorted = [...blocks].sort((a, b) => a.s - b.s || a.e - b.e)
  const out = []
  let cluster = [], clusterEnd = -1
  const flush = () => {
    const cols = []
    for (const b of cluster) {
      let c = cols.findIndex((end) => end <= b.s)
      if (c < 0) { c = cols.length; cols.push(0) }
      cols[c] = drawnEnd(b); b.col = c
    }
    for (const b of cluster) b.cols = cols.length
    out.push(...cluster); cluster = []
  }
  for (const b of sorted) {
    if (cluster.length && b.s >= clusterEnd) flush()
    cluster.push({ ...b }); clusterEnd = Math.max(clusterEnd, drawnEnd(b))
  }
  if (cluster.length) flush()
  return out
}
export function timelineModel(st, key, now) {
  const d0 = dayStart(key), d1 = dayStart(addDays(key, 1))
  const mins = (ms) => (ms - d0) / MIN
  const isToday = dayKey(now) === key, nowM = mins(now)
  const clamp = (s, e) => ({ vs: Math.max(s, T_START), ve: Math.min(e, T_END) })
  const plan = []
  for (const it of itemsOn(st, key)) {
    if (it.plan > 0 && it.start != null) {
      const { vs, ve } = clamp(it.start, it.start + it.plan)
      if (ve > vs) plan.push({ key: `p${it.id}`, item: it, s: vs, e: ve, fullS: it.start, fullE: it.start + it.plan })
    }
  }
  const ents = st.entries.filter((e) => Math.min(entEnd(e, now), d1) > Math.max(entStart(e), d0) || (e.e == null && e.date === key))
    .sort((a, b) => entStart(a) - entStart(b))
  const cum = {}, log = [], iv = []
  for (const en of ents) {
    const it = st.items.find((i) => i.id === en.item_id)
    if (!it) continue
    const running = en.e == null
    const sM = mins(Math.max(entStart(en), d0)), eM = mins(Math.min(entEnd(en, now), d1))
    const d = Math.max(0, (entEnd(en, now) - entStart(en)) / MIN)
    const before = cum[it.id] || 0
    cum[it.id] = before + d
    const ov = it.plan > 0 && cum[it.id] > it.plan ? Math.min(d, cum[it.id] - Math.max(it.plan, before)) : 0
    const { vs, ve } = clamp(sM, eM)
    iv.push([sM, Math.max(sM, eM), running])
    if (ve > vs || running) log.push({ key: `l${en.id}`, entry: en, item: it, s: vs, e: Math.max(ve, vs), fullS: sM, fullE: eM, dur: d, ov, running })
  }
  const gaps = []
  if (iv.length) {
    let t = iv[0][0]
    for (const [s, e] of iv) { if (s - t >= 20) gaps.push({ s: t, e: s }); t = Math.max(t, e) }
    if (isToday && nowM - t >= 20 && !iv.some((x) => x[2])) gaps.push({ s: t, e: Math.floor(nowM) })
  }
  return {
    plan: layoutLane(plan), log: layoutLane(log), gaps, unaccounted: gaps.reduce((s, g) => s + g.e - g.s, 0),
    unscheduled: itemsOn(st, key).filter((i) => !entriesOf(st, i.id).length && i.start == null).length,
    now: isToday && nowM >= T_START && nowM <= T_END ? nowM : null,
  }
}

/* ---------- Load plan (web -> phone) ---------- */
const WEB_FIELDS = ['date', 'cat', 'title', 'plan', 'start', 'task_id', 'task_title']
const validItem = (i) => i && typeof i.id === 'string' && typeof i.title === 'string' && CATS.includes(i.cat) && /^\d{4}-\d{2}-\d{2}$/.test(i.date || '')
const validEntry = (e) => e && typeof e.id === 'string' && typeof e.item_id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') && Number.isInteger(e.s) && (e.e == null || (Number.isInteger(e.e) && e.e > e.s))

// Returns { state, added, updated, removed }. Throws Error on a file that is not a day plan.
export function mergePlan(st, file, now = Date.now()) {
  if (!file || file.format !== 'nt-day-plan' || file.version !== 1 || !Array.isArray(file.items) || !Array.isArray(file.entries)) throw new Error('This is not a Day plan file (day-plan.json).')
  const gen = Date.parse(file.generated_at) || now
  const from = addDays(dayKey(gen), -1), to = addDays(dayKey(gen), 2)
  const inFile = new Set(file.items.map((i) => i.id))
  const gone = new Set(st.deleted_item_ids), goneE = new Set(st.deleted_entry_ids)
  let added = 0, updated = 0, removed = 0
  let items = st.items.map((it) => {
    const f = file.items.find((x) => x.id === it.id)
    if (!f || !validItem(f)) return it
    if (WEB_FIELDS.every((k) => (f[k] ?? null) === (it[k] ?? null))) return it
    updated++
    const next = { ...it }
    for (const k of WEB_FIELDS) next[k] = f[k] ?? null
    return next // updated_at deliberately untouched: a plan merge must not outrank the phone's own `done` edits
  })
  const have = new Set(items.map((i) => i.id))
  for (const f of file.items) {
    if (!validItem(f) || have.has(f.id) || gone.has(f.id)) continue
    items.push({ plan: null, start: null, done: false, task_id: null, task_title: null, added_on_phone: false, created_at: f.updated_at || isoLocal(now), updated_at: f.updated_at || isoLocal(now), ...f })
    added++
  }
  const hasEntries = new Set(st.entries.map((e) => e.item_id))
  items = items.filter((it) => {
    if (inFile.has(it.id) || hasEntries.has(it.id) || it.added_on_phone || it.date < from || it.date > to) return true
    removed++
    return false
  })
  const ids = new Set(items.map((i) => i.id))
  const eHave = new Set(st.entries.map((e) => e.id))
  const entries = [...st.entries]
  for (const e of file.entries) if (validEntry(e) && ids.has(e.item_id) && !eHave.has(e.id) && !goneE.has(e.id)) entries.push({ ts: null, source: 'web', updated_at: isoLocal(now), ...e })
  return { state: { ...st, items, entries, planLoadedAt: now }, added, updated, removed }
}

/* ---------- Export log (phone -> web) ---------- */
export const logFileName = (now) => { const d = new Date(now); return `day-log-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.json` }
export function buildLog(st, now = Date.now()) {
  const today = dayKey(now), from = addDays(today, -1), to = addDays(today, 2)
  const items = st.items.filter((i) => i.date >= from && i.date <= to)
  const ids = new Set(items.map((i) => i.id))
  return {
    format: 'nt-day-log', version: 1, device: 'iphone', exported_at: isoLocal(now),
    items, entries: st.entries.filter((e) => ids.has(e.item_id)),
    deleted_item_ids: st.deleted_item_ids, deleted_entry_ids: st.deleted_entry_ids,
  }
}
// After a successful export: remember the time; tombstones are cleared; data is never removed.
export const markExported = (st, now, log) => ({
  ...st, lastExportAt: now,
  deleted_item_ids: st.deleted_item_ids.filter((x) => !log.deleted_item_ids.includes(x)),
  deleted_entry_ids: st.deleted_entry_ids.filter((x) => !log.deleted_entry_ids.includes(x)),
})
export const exportStale = (st) => !!st.lastChangeAt && (!st.lastExportAt || st.lastChangeAt > st.lastExportAt)

/* ---------- persistence and migration ---------- */
const CAT_V1 = { Work: 'work', 'Deep work': 'work', Admin: 'work', Meetings: 'meet', Personal: 'personal', Learning: 'learn' }
// Old shape (first builds and the in-memory v2 of the standalone app): items hold their entries as epoch ms.
export function migrateOld(d, now = Date.now()) {
  const st = blank()
  if (!d || !Array.isArray(d.items)) return st
  const today = dayKey(now)
  for (const o of d.items) {
    const id = isUuid(o.id) ? o.id : uuid()
    const date = o.day || today
    const pend = toMin(o.pend ?? o.end), pst = toMin(o.pstart ?? o.start)
    st.items.push({
      id, date, cat: CAT_V1[o.cat] || 'work', title: o.title || 'Item', plan: pst != null && pend != null && pend > pst ? pend - pst : null, start: pst,
      done: !!o.done, task_id: null, task_title: null, added_on_phone: true, created_at: isoLocal(now), updated_at: isoLocal(now),
    })
    let ents = o.entries
    if (!ents) { // v1 flat: logged ms + runningSince
      ents = []
      if (o.logged > 0) ents.push({ s: now - o.logged, e: now })
      if (o.runningSince) ents.push({ s: o.runningSince, e: null })
    }
    for (const en of ents) {
      if (en.e == null) { const k = dayKey(en.s); st.entries.push({ id: uuid(), item_id: id, date: k, s: Math.floor((en.s - dayStart(k)) / MIN), e: null, ts: en.s, source: 'phone', updated_at: isoLocal(now) }); continue }
      let k = dayKey(en.s)
      for (;;) {
        const d0 = dayStart(k), d1 = dayStart(addDays(k, 1))
        const a = Math.max(en.s, d0), b = Math.min(en.e, d1)
        const s = Math.floor((a - d0) / MIN), e = Math.min(DAY_MIN, Math.max(s + 1, Math.round((b - d0) / MIN)))
        if (b > a) st.entries.push({ id: uuid(), item_id: id, date: k, s, e, ts: null, source: 'phone', updated_at: isoLocal(now) })
        if (en.e <= d1) break
        k = addDays(k, 1)
      }
    }
  }
  st.lastCat = CAT_V1[d.lastCat] || 'work'
  st.lastChangeAt = st.items.length ? now : null
  return st
}
export function loadDay() {
  try {
    const raw = JSON.parse(localStorage.getItem(DAY_KEY) || 'null')
    if (raw && Array.isArray(raw.items)) return { ...blank(), ...raw }
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null')
    if (old) { const st = migrateOld(old); saveDay(st); return st }
  } catch { /* fall through */ }
  return blank()
}
export function saveDay(st) {
  try { localStorage.setItem(DAY_KEY, JSON.stringify({ ...st, v: 2 })) } catch { /* storage unavailable */ }
}
