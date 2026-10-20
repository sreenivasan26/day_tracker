import { describe, it, expect } from 'vitest'
import {
  CATS, fmtMin, planMin, groupItems, dayTotals, addItem, patchItem, deleteItem, startTimer, stopTimer, runningCount, addEntry, updateEntry, deleteEntry,
  entriesOf, loggedOn, timelineModel, layoutLane, yOf, blockPx, HPX, MIN_BLOCK_PX, mergePlan, buildLog, logFileName, markExported, exportStale, migrateOld, loadDay, blank, dayKey, dayStart, addDays,
} from './dayStore.js'

const NOW = new Date(2026, 9, 21, 22, 5, 0).getTime() // Wed 21 Oct 2026 22:05
const KEY = dayKey(NOW)
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const fi = (n, o = {}) => ({ id: U(n), date: KEY, cat: 'work', title: `Item ${n}`, plan: 90, start: 570, done: false, task_id: null, task_title: null, added_on_phone: false, created_at: '2026-10-21T08:00:00', updated_at: '2026-10-21T08:00:00', ...o })
const fe = (n, item, o = {}) => ({ id: U(100 + n), item_id: U(item), date: KEY, s: 540, e: 600, ts: null, source: 'web', updated_at: '2026-10-21T10:00:00', ...o })
const plan = (items, entries = [], gen = '2026-10-21T22:00:00') => ({ format: 'nt-day-plan', version: 1, generated_at: gen, items, entries })
const withItems = (items, entries = []) => ({ ...blank(), items, entries })

describe('categories and basics', () => {
  it('fixed list', () => { expect(CATS).toEqual(['work', 'meet', 'personal', 'learn']); expect(fmtMin(125)).toBe('2 h 05') })
  it('quick add marks added_on_phone, uuid id, updated_at', () => {
    const { st, item } = addItem(blank(), { title: ' Gym ', cat: 'personal', date: KEY }, NOW)
    expect(item.added_on_phone).toBe(true); expect(item.title).toBe('Gym'); expect(item.id).toMatch(/^[0-9a-f-]{36}$/); expect(item.updated_at).toBe('2026-10-21T22:05:00'); expect(st.lastChangeAt).toBe(NOW)
  })
  it('groups and totals', () => {
    let st = withItems([fi(1), fi(2, { cat: 'learn', plan: null, start: null })], [fe(1, 1, { s: 540, e: 570 })])
    const g = groupItems(st, KEY, NOW)
    expect(g[0]).toMatchObject({ cat: 'work', logged: 30, planned: 90 }); expect(g[3].list.length).toBe(1)
    expect(dayTotals(st, KEY, NOW)).toMatchObject({ logged: 30, plan: 90, over: false })
    st = withItems([fi(1, { plan: 20 })], [fe(1, 1, { s: 540, e: 570 })]); expect(dayTotals(st, KEY, NOW).over).toBe(true)
  })
})

describe('timers and tombstones', () => {
  it('many timers; entry stores minutes and ts', () => {
    let st = withItems([fi(1), fi(2)])
    const t1 = new Date(2026, 9, 21, 10, 0, 30).getTime()
    st = startTimer(startTimer(st, U(1), t1), U(2), t1 + 60000)
    expect(runningCount(st)).toBe(2)
    expect(entriesOf(st, U(1))[0]).toMatchObject({ s: 600, e: null, ts: t1, source: 'phone', date: KEY })
    st = stopTimer(st, U(1), t1 + 31 * 60000)
    expect(entriesOf(st, U(1))[0]).toMatchObject({ s: 600, e: 631, ts: null }); expect(runningCount(st)).toBe(1)
    expect(startTimer(st, U(2), t1 + 99).entries.length).toBe(st.entries.length)
  })
  it('timer stopped on a later day is split per day', () => {
    let st = withItems([fi(1)])
    const t1 = new Date(2026, 9, 21, 23, 30).getTime()
    st = stopTimer(startTimer(st, U(1), t1), U(1), new Date(2026, 9, 22, 0, 20).getTime())
    const es = entriesOf(st, U(1))
    expect(es.map((x) => [x.date, x.s, x.e])).toEqual([[KEY, 1410, 1440], [addDays(KEY, 1), 0, 20]])
  })
  it('deletes record tombstones and updated_at changes on edit', () => {
    let st = withItems([fi(1), fi(2)], [fe(1, 1), fe(2, 2)])
    st = deleteEntry(st, U(102), NOW); expect(st.deleted_entry_ids).toEqual([U(102)])
    st = deleteItem(st, U(1), NOW); expect(st.deleted_item_ids).toEqual([U(1)]); expect(st.entries.length).toBe(0)
    st = patchItem(st, U(2), { done: true }, NOW); expect(st.items[0].updated_at).toBe('2026-10-21T22:05:00')
    st = addEntry(st, U(2), KEY, 60, 120, NOW); const id = st.entries[0].id
    expect(updateEntry(st, id, { e: 90 }, NOW).entries[0].e).toBe(90)
  })
})

describe('Load plan merge rules', () => {
  it('inserts unknown items and web entries', () => {
    const r = mergePlan(blank(), plan([fi(1)], [fe(1, 1)]), NOW)
    expect(r.added).toBe(1); expect(r.state.items[0].added_on_phone).toBe(false); expect(r.state.entries.length).toBe(1); expect(r.state.planLoadedAt).toBe(NOW)
  })
  it('updates web-owned fields but never done or phone entries or running timers', () => {
    const st = withItems([fi(1, { done: true, title: 'Old', plan: 30 })], [fe(1, 1, { id: U(150), source: 'phone', s: 100, e: null, ts: NOW - 5000 })])
    const r = mergePlan(st, plan([fi(1, { title: 'New', plan: 60, cat: 'meet', start: 600, task_id: 't1', task_title: 'Write spec', done: false })]), NOW)
    expect(r.updated).toBe(1)
    expect(r.state.items[0]).toMatchObject({ title: 'New', plan: 60, cat: 'meet', start: 600, task_id: 't1', task_title: 'Write spec', done: true })
    expect(r.state.entries.find((e) => e.id === U(150))).toMatchObject({ s: 100, e: null, ts: NOW - 5000 })
    expect(r.state.items[0].updated_at).toBe('2026-10-21T08:00:00')
  })
  it('removes missing items only without entries and not added on phone', () => {
    const st = withItems([fi(1), fi(2), fi(3, { added_on_phone: true }), fi(4, { date: '2026-01-05' })], [fe(1, 2)])
    const r = mergePlan(st, plan([fi(9)]), NOW)
    expect(r.state.items.map((i) => i.id).sort()).toEqual([U(2), U(3), U(4), U(9)].sort())
    expect(r.removed).toBe(1) // only item 1; item 4 is outside the file's date window
  })
  it('is idempotent and does not re-add items deleted on the phone', () => {
    const p = plan([fi(1), fi(2)], [fe(1, 1)])
    const a = mergePlan(blank(), p, NOW).state
    const b = mergePlan(a, p, NOW + 1000)
    expect(b.added + b.updated + b.removed).toBe(0); expect(b.state.items).toEqual(a.items); expect(b.state.entries).toEqual(a.entries)
    const c = mergePlan(deleteItem(a, U(2), NOW), p, NOW)
    expect(c.state.items.map((i) => i.id)).toEqual([U(1)])
  })
  it('rejects other files', () => {
    expect(() => mergePlan(blank(), { format: 'nt-day-log', version: 1 }, NOW)).toThrow(/not a Day plan/)
  })
})

describe('Export log', () => {
  const st0 = () => ({
    ...withItems([fi(1, { date: addDays(KEY, -2) }), fi(2, { date: addDays(KEY, -1) }), fi(3), fi(4, { date: addDays(KEY, 2) }), fi(5, { date: addDays(KEY, 3) })],
      [fe(1, 1), fe(2, 2), fe(3, 3, { e: null, ts: NOW - 1000, s: 1300 })]),
    deleted_item_ids: [U(77)], deleted_entry_ids: [U(177)], lastChangeAt: NOW,
  })
  it('covers yesterday..today+2 with entries and tombstones', () => {
    const log = buildLog(st0(), NOW)
    expect(log).toMatchObject({ format: 'nt-day-log', version: 1, exported_at: '2026-10-21T22:05:00', deleted_item_ids: [U(77)], deleted_entry_ids: [U(177)] })
    expect(log.items.map((i) => i.id)).toEqual([U(2), U(3), U(4)])
    expect(log.entries.map((e) => e.id)).toEqual([U(102), U(103)])
    expect(log.entries[1]).toMatchObject({ e: null, ts: NOW - 1000 })
  })
  it('file name and stale hint; export keeps data, clears only exported tombstones', () => {
    expect(logFileName(NOW)).toBe('day-log-20261021-220500.json')
    const st = st0(); expect(exportStale(st)).toBe(true)
    const log = buildLog(st, NOW)
    const after = markExported({ ...st, deleted_item_ids: [U(77), U(88)] }, NOW + 5, log)
    expect(after.items.length).toBe(5); expect(after.entries.length).toBe(3)
    expect(after.deleted_item_ids).toEqual([U(88)]); expect(after.deleted_entry_ids).toEqual([])
    expect(exportStale(after)).toBe(false)
    expect(exportStale(patchItem(after, U(3), { done: true }, NOW + 10000))).toBe(true)
  })
})

describe('migration from notes-tasks.day.v1', () => {
  it('converts the old in-memory shape to schema v2 (minutes, uuid ids, codes, splits)', () => {
    const old = {
      items: [
        { id: 'abc', title: 'A', cat: 'Deep work', day: KEY, pstart: '09:00', pend: '10:30', done: true, linked: 'T', entries: [{ id: 'x', s: new Date(2026, 9, 21, 23, 30).getTime(), e: new Date(2026, 9, 22, 0, 10).getTime() }] },
        { id: 'b', title: 'B', cat: 'Admin', day: KEY, pstart: '', pend: '', entries: [{ id: 'y', s: NOW - 60000, e: null }] },
        { id: 'c', title: 'C', cat: 'Learning', day: KEY },
      ],
      suggestions: ['T'],
    }
    const st = migrateOld(old, NOW)
    expect(st.items.map((i) => i.cat)).toEqual(['work', 'work', 'learn'])
    expect(st.items[0]).toMatchObject({ plan: 90, start: 540, done: true, task_title: null, added_on_phone: true }); expect(st.items[0].id).toMatch(/^[0-9a-f-]{36}$/)
    expect(entriesOf(st, st.items[0].id).map((e) => [e.date, e.s, e.e])).toEqual([[KEY, 1410, 1440], [addDays(KEY, 1), 0, 10]])
    expect(entriesOf(st, st.items[1].id)[0]).toMatchObject({ e: null, ts: NOW - 60000 })
  })
  it('migrates the original flat v1 shape via localStorage and keeps the old key', () => {
    const store = {}
    globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v } }
    store['notes-tasks.day.v1'] = JSON.stringify({ items: [{ id: 'q', title: 'Q', cat: 'Meetings', start: '10:00', end: '11:00', logged: 600000, runningSince: null }] })
    const st = loadDay()
    expect(st.items[0]).toMatchObject({ cat: 'meet', plan: 60, start: 600 }); expect(st.entries.length).toBe(1)
    expect(JSON.parse(store['notes-tasks.day.v2']).v).toBe(2); expect(store['notes-tasks.day.v1']).toBeTruthy()
    expect(loadDay().items[0].id).toBe(st.items[0].id)
  })
})

