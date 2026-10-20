import { describe, it, expect } from 'vitest'
import { startTimer, stopTimer, addEntry, updateEntry, patchItem, buildLog, timelineModel, layoutLane, yOf, blockPx, HPX, MIN_BLOCK_PX, blank, dayKey } from './dayStore.js'

const NOW = new Date(2026, 9, 20, 19, 10, 0).getTime()
const KEY = dayKey(NOW)
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const mkItem = (n, title, cat, start, plan) => ({ id: U(n), date: KEY, cat, title, plan, start, done: false, task_id: null, task_title: null, added_on_phone: false, created_at: '', updated_at: '' })
const en = (n, item, s, e, o = {}) => ({ id: U(100 + n), item_id: U(item), date: KEY, s, e, ts: null, source: 'phone', updated_at: '', ...o })
const hm = (h, m) => h * 60 + m

// Overlap in drawn pixels: two blocks collide when their boxes intersect vertically.
const box = (b) => ({ top: yOf(b.s), bottom: yOf(b.s) + blockPx(b.e - b.s) })
const collide = (a, b) => box(a).top < box(b).bottom && box(b).top < box(a).bottom
function expectNoOverlap(lane) {
  for (let i = 0; i < lane.length; i++) for (let j = i + 1; j < lane.length; j++) {
    const a = lane[i], b = lane[j]
    if (collide(a, b)) { expect(a.col, `${a.key} vs ${b.key}`).not.toBe(b.col); expect(a.cols).toBeGreaterThan(1) }
  }
}

describe('lane layout (U43: no label over label)', () => {
  const items = [
    mkItem(1, 'Prep for team sync', 'meet', hm(18, 55), 4), mkItem(2, 'Team sync', 'meet', hm(19, 0), 20),
    mkItem(3, 'Study block', 'learn', hm(17, 25), 30), mkItem(4, 'Review block', 'learn', hm(18, 0), 20), mkItem(5, 'Exercise', 'personal', hm(16, 40), 50),
    mkItem(6, 'T1', 'work', null, null), mkItem(7, 'T2', 'work', null, null), mkItem(8, 'T3', 'work', null, null),
  ]
  const entries = [
    en(1, 1, hm(18, 55), hm(18, 59)), en(2, 2, hm(19, 0), hm(19, 20)), en(3, 3, hm(17, 25), hm(17, 55)), en(4, 4, hm(18, 0), hm(18, 20)), en(5, 5, hm(16, 40), hm(17, 22)),
    en(6, 6, hm(18, 40), null, { ts: NOW - 30 * 60000 }), en(7, 7, hm(18, 50), null, { ts: NOW - 20 * 60000 }), en(8, 8, hm(19, 0), null, { ts: NOW - 10 * 60000 }),
  ]
  const m = timelineModel({ ...blank(), items, entries }, KEY, NOW)

  it('a 4 minute block is drawn 20px tall and shares columns with the next block', () => {
    expect(blockPx(4)).toBe(MIN_BLOCK_PX)
    const prep = m.plan.find((b) => b.item.id === U(1)), conn = m.plan.find((b) => b.item.id === U(2))
    expect(prep.cols).toBe(2); expect(conn.cols).toBe(2); expect(prep.col).not.toBe(conn.col)
    const lp = m.log.find((b) => b.item.id === U(1)), lc = m.log.find((b) => b.item.id === U(2))
    expect(lp.col).not.toBe(lc.col)
  })
  it('no two drawn boxes overlap in the same column, in either lane', () => { expectNoOverlap(m.plan); expectNoOverlap(m.log) })
  it('blocks that do not collide stay full width', () => {
    for (const id of [U(3), U(5)]) expect(m.log.find((b) => b.item.id === id).cols).toBe(1) // logged 16:40-17:22 and 17:25-17:55 do not collide
    expect(m.plan.find((b) => b.item.id === U(5)).col).not.toBe(m.plan.find((b) => b.item.id === U(3)).col) // planned 16:40-17:30 vs 17:25 do
  })
  it('three overlapping running timers get three columns and grow to now', () => {
    const run = m.log.filter((b) => b.running)
    expect(run.length).toBe(3); expect(new Set(run.map((b) => b.col)).size).toBe(3); expect(run.every((b) => b.cols >= 3)).toBe(true)
    expect(run.every((b) => Math.abs(b.fullE - (19 * 60 + 10)) < 0.01)).toBe(true)
  })
  it('has a now line; exercise logged within its plan has no overrun cap', () => {
    expect(m.now).toBeCloseTo(19 * 60 + 10)
    expect(m.log.find((b) => b.item.id === U(5)).ov).toBe(0)
  })
})

describe('layoutLane unit', () => {
  it('min height and columns', () => {
    const out = layoutLane([{ s: 600, e: 604 }, { s: 610, e: 640 }, { s: 603, e: 700 }])
    expect(blockPx(1)).toBe(20); expect(blockPx(60)).toBeCloseTo(60 * HPX - 2)
    expect(out.every((b) => b.cols === 3)).toBe(true); expect(new Set(out.map((b) => b.col)).size).toBe(3)
    expect(out.find((b) => b.s === 603).col).not.toBe(out.find((b) => b.s === 600).col)
  })
  it('overrun cap and gaps', () => {
    const m = timelineModel({ ...blank(), items: [mkItem(1, 'A', 'work', hm(9, 0), 30)], entries: [en(1, 1, hm(9, 0), hm(9, 20)), en(2, 1, hm(9, 20), hm(10, 0)), en(3, 1, hm(11, 0), hm(11, 10))] }, KEY, NOW)
    expect(m.log[1].ov).toBe(30); expect(m.log[0].ov).toBe(0)
    expect(m.gaps[0]).toMatchObject({ s: hm(10, 0), e: hm(11, 0) })
  })
})

describe('Done follows the timer', () => {
  const base = () => ({ ...blank(), items: [mkItem(1, 'A', 'work', hm(9, 0), 30)] })
  it('stop marks done and stamps updated_at; start un-ticks', () => {
    let st = startTimer(base(), U(1), NOW)
    expect(st.items[0].done).toBe(false)
    st = stopTimer(st, U(1), NOW + 600000)
    expect(st.items[0].done).toBe(true); expect(st.items[0].updated_at).toBe('2026-10-20T19:20:00')
    st = startTimer(st, U(1), NOW + 900000)
    expect(st.items[0].done).toBe(false); expect(st.items[0].updated_at).toBe('2026-10-20T19:25:00')
  })
  it('stopping an item with no running timer does not tick it', () => {
    expect(stopTimer(base(), U(1), NOW).items[0].done).toBe(false)
  })
  it('manual tick works with logged time; manual entries leave done alone', () => {
    let st = addEntry(base(), U(1), KEY, 540, 570, NOW)
    expect(st.items[0].done).toBe(false)
    st = patchItem(st, U(1), { done: true }, NOW); expect(st.items[0].done).toBe(true)
    st = addEntry(st, U(1), KEY, 600, 620, NOW); st = updateEntry(st, st.entries[0].id, { e: 575 }, NOW); expect(st.items[0].done).toBe(true)
    st = patchItem(st, U(1), { done: false }, NOW); expect(st.items[0].done).toBe(false)
  })
  it('export carries done and updated_at', () => {
    const st = stopTimer(startTimer(base(), U(1), NOW), U(1), NOW + 60000)
    const it = buildLog(st, NOW + 60000).items[0]
    expect(it).toMatchObject({ done: true, updated_at: '2026-10-20T19:11:00' })
  })
})
