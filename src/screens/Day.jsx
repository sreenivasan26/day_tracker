import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Square, Plus, ChevronDown, ChevronRight, Link2, X, Clock, Check, Calendar, List, AlignCenter, TriangleAlert, ChevronUp, FileUp, Share2, Repeat, Info } from 'lucide-react'
import '../day.css'
import {
  catLabel, catColor, catBg, loadDay, saveDay, clock, fmtMin, loggedOn, planMin, groupItems, dayTotals, isRunning, runningTimers, entriesOf,
  startTimer, stopTimer, addItem, patchItem, deleteItem, addEntry, updateEntry, deleteEntry, dayKey, longDay, shortDay, stamp,
  timelineModel, T_START, T_END, HPX, yOf, blockPx, hhmmOf, mergePlan, buildLog, logFileName, markExported, exportStale, missedItem, planIsOld,
} from '../lib/dayStore.js'
import { AddItemSheet, AddTimeSheet, ItemSheet, DurText } from './Sheets.jsx'

const MIN = 60000

function Hero({ t }) {
  const { logged, plan, over } = t
  const pct = plan > 0 ? Math.round((logged / plan) * 100) : 0
  return (
    <div className={`card hero2 ${logged === 0 ? 'zero' : ''}`}>
      <div className="top">
        <span className="cap">Logged today</span>
        {over ? <span className="over"><TriangleAlert size={14} className="ic" aria-hidden />+{fmtMin(logged - plan)} over plan</span> : <span className="mut s">Plan {fmtMin(plan)}</span>}
      </div>
      <div className="num"><DurText min={logged} /></div>
      <div className="meter">
        {plan > 0 && <i className={over ? 'wn' : ''} style={{ width: `${Math.min(100, (logged / plan) * 100)}%` }} />}
        {over && <s style={{ left: `${(plan / logged) * 100}%` }} />}
      </div>
      <div className="foot">
        {plan === 0 ? <span>Nothing planned yet</span> : over ? <><span>Plan {fmtMin(plan)}</span><span>White marker = plan</span></> : <><span><b>{pct}%</b> of plan</span><span><b>{fmtMin(plan - logged)}</b> left</span></>}
      </div>
    </div>
  )
}

function Row({ it, entries, now, dkey, onOpen, onDone, onToggle, running, missed }) {
  const run = running
  const logged = loggedOn(entries, dkey, now) / MIN
  const plan = planMin(it)
  const over = plan > 0 && Math.floor(logged) > plan
  return (
    <div className={`ir ${run ? 'run' : ''}`}>
      <button className={`chk ${it.done ? 'on' : ''}`} role="checkbox" aria-checked={it.done} aria-label={`Mark ${it.title} done`} onClick={onDone}><i>{it.done && <Check size={16} className="ic" aria-hidden />}</i></button>
      <button className={`it ${it.done ? 'dn' : ''}`} onClick={onOpen} aria-label={`Open ${it.title}`}>
        <b>{it.title}</b>
        <span className="m">
          <span className="cn2"><i className="dot" style={{ background: catColor(it.cat) }} />{catLabel(it.cat)}</span>
          <span className="tm2">{fmtMin(logged)}{plan > 0 ? ` of ${fmtMin(plan)}` : ''}</span>
          {over && <span className="over"><TriangleAlert size={14} className="ic" aria-hidden />+{fmtMin(logged - plan)} over</span>}
          {missed && <span className="miss"><TriangleAlert size={14} className="ic" aria-hidden />Missed</span>}
          {it.recurring_id && <span className="rpt"><Repeat size={13} className="ic" aria-hidden />Repeats daily</span>}
        </span>
        {it.task_title && <span className="m tk"><Link2 size={13} className="ic" aria-hidden />{it.task_title}</span>}
        {plan > 0 && <span className="pg"><i className={over ? 'wn' : ''} style={{ width: `${Math.min(100, (logged / plan) * 100)}%`, background: catColor(it.cat) }} /></span>}
      </button>
      <button className={`go ${run ? 'stop' : ''} ${it.done && !run ? 'mutedgo' : ''}`} aria-label={`${run ? 'Stop' : it.done ? 'Start again' : 'Start'} ${it.title}`} onClick={onToggle}>
        {run ? <Square size={16} className="ic" fill="currentColor" aria-hidden /> : <Play size={16} className="ic" aria-hidden />}{run ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}

function Block({ b, kind, onOpen }) {
  const h = blockPx(b.e - b.s)
  const it = b.item
  const lab = fmtMin(kind === 'plan' ? it.plan : b.dur)
  const missed = kind === 'plan' && b.missed
  const meta = kind === 'plan' ? `${hhmmOf(it.start)} ${missed ? 'missed, not started' : 'planned'}` : b.running ? `${hhmmOf(Math.floor(b.fullS))} to now` : `${hhmmOf(Math.floor(b.fullS))} to ${hhmmOf(Math.floor(b.fullE))}`
  const aria = kind === 'plan'
    ? `Planned: ${it.title}, ${catLabel(it.cat)}, ${hhmmOf(it.start)} for ${lab}${missed ? ', missed, not started' : ''}${it.recurring_id ? ', repeats daily' : ''}`
    : `Logged: ${it.title}, ${catLabel(it.cat)}, ${meta}, ${lab}${b.ov ? `, ${fmtMin(b.ov)} over plan` : ''}${b.running ? ', running' : ''}`
  const cols = b.cols
  return (
    <button type="button" className={`blk ${kind === 'plan' ? 'pl' : 'lg'} ${b.running ? 'run' : ''} ${missed ? 'miss' : ''} c${Math.min(cols, 3)} ${h >= 40 && cols === 1 ? 'tall' : ''}`} onClick={onOpen} aria-label={aria}
      style={{ top: yOf(b.s), height: h, '--c': missed ? 'var(--color-danger)' : catColor(it.cat), '--bg': catBg(it.cat), left: `${(b.col * 100) / cols}%`, width: `calc(${100 / cols}% - 2px)` }}>
      {missed && cols < 3 && <TriangleAlert size={12} className="ic" aria-hidden />}
      <b>{it.title}</b>
      {kind === 'plan' && it.recurring_id && cols === 1 && <Repeat size={12} className="ic rp" aria-hidden />}
      {cols < 3 && <u>{lab}</u>}
      {h >= 40 && cols === 1 && <span className="bm">{meta}</span>}
      {b.ov > 0 && <i className="ov" style={{ height: Math.min(h - 6, b.ov * HPX) }} />}
    </button>
  )
}

function Timeline({ st, dkey, now, onOpen }) {
  const m = timelineModel(st, dkey, now)
  const totals = dayTotals(st, dkey, now)
  const H = yOf(T_END)
  const hours = []
  for (let h = T_START / 60; h <= T_END / 60; h++) hours.push(h)
  const bodyRef = useRef(null)
  useEffect(() => {
    const el = bodyRef.current?.querySelector('.now')
    if (el) el.scrollIntoView({ block: 'center' })
  }, [])
  return (
    <>
      <div className="strip"><div><b>{fmtMin(totals.logged)}</b><span className="mut">Logged</span></div><div><b>{fmtMin(totals.plan)}</b><span className="mut">Planned</span></div><div><b>{fmtMin(m.unaccounted)}</b><span className="mut">Unlogged</span></div></div>
      {m.unscheduled > 0 && <div className="unsch"><Clock size={18} className="ic" aria-hidden /><span><b>{m.unscheduled} {m.unscheduled === 1 ? 'item' : 'items'}</b> without a start time, not drawn</span></div>}
      <div className="tlh"><span className="sech">Planned</span><span className="sech">Logged</span></div>
      <div className="tl" ref={bodyRef} style={{ height: H }}>
        {hours.map((h) => <div className="hr" key={h} style={{ top: yOf(h * 60) }}><em>{String(h).padStart(2, '0')}:00</em></div>)}
        <div className="lanes">
          <div className="lane" aria-label="Planned blocks">
            {m.plan.map((b) => <Block key={b.key} b={b} kind="plan" onOpen={() => onOpen(b.item.id)} />)}
          </div>
          <div className="lane" aria-label="Logged blocks">
            {m.log.map((b) => <Block key={b.key} b={b} kind="log" onOpen={() => onOpen(b.item.id)} />)}
            {m.gaps.map((g) => {
              const s = Math.max(g.s, T_START), e = Math.min(g.e, T_END)
              const lowest = Math.max(yOf(s), ...m.log.filter((b) => b.e <= g.s + 0.01 && b.e >= g.s - 30).map((b) => yOf(b.s) + blockPx(b.e - b.s)))
              const top = lowest + 2, height = yOf(e) - top - 2
              if (e - s < 20 || height < 16) return null
              return <div key={`g${g.s}`} className="gap" style={{ top, height }}>{fmtMin(g.e - g.s)} unlogged</div>
            })}
          </div>
        </div>
        {m.now != null && <div className="now" style={{ top: yOf(m.now) }}><em>{hhmmOf(Math.floor(m.now))}</em></div>}
      </div>
    </>
  )
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function Day() {
  const [st, setSt] = useState(loadDay)
  const stRef = useRef(st); stRef.current = st
  const [now, setNow] = useState(Date.now())
  const today = dayKey(now)
  const [key, setKey] = useState(today)
  const [view, setView] = useState('list')
  const [closed, setClosed] = useState({})
  const [sheet, setSheet] = useState(null) // {type:'add'|'item'|'time', ...}
  const [quick, setQuick] = useState('')
  const [undo, setUndo] = useState(null)
  const [toast, setToast] = useState(null)
  const [runOpen, setRunOpen] = useState(false)
  const timers = useRef({})
  const fileRef = useRef(null)
  const commit = useCallback((next) => { stRef.current = next; setSt(next); saveDay(next) }, [])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])
  const flash = (setter, v, ms) => { clearTimeout(timers.current[ms]); setter(v); timers.current[ms] = setTimeout(() => setter(null), ms) }
  const withUndo = (label, next) => { flash(setUndo, { label, prev: st }, 5000); commit(next) }
  const restore = () => { commit(undo.prev); setUndo(null) }

  const totals = dayTotals(st, key, now)
  const groups = groupItems(st, key, now).filter((g) => g.list.length)
  const running = runningTimers(st)
  const dayItems = st.items.filter((i) => i.date === key)
  const create = (data, thenLog) => {
    const r = addItem(st, { ...data, added_on_phone: true })
    commit(r.st); setKey(data.date); setSheet(thenLog ? { type: 'time', itemId: r.item.id } : null)
    flash(setToast, `Added to ${catLabel(data.cat)}`, 2600)
  }
  const quickAdd = (e) => {
    e.preventDefault()
    if (!quick.trim()) return
    create({ title: quick, cat: st.lastCat, date: key }); setQuick('')
  }
  const cur = sheet?.type === 'item' ? st.items.find((i) => i.id === sheet.id) : null
  const toggleTimer = (it) => commit((isRunning(st, it.id) ? stopTimer : startTimer)(st, it.id, Date.now()))

  const loadPlan = async (ev) => {
    const f = ev.target.files?.[0]; ev.target.value = ''
    if (!f) return
    try {
      const r = mergePlan(stRef.current, JSON.parse(await f.text()), Date.now())
      commit(r.state)
      flash(setToast, `Plan loaded: ${r.added} added, ${r.updated} updated${r.removed ? `, ${r.removed} removed` : ''}${r.skipped ? `, ${r.skipped} skipped` : ''}${r.old ? '. This plan is more than a day old' : ''}`, r.skipped || r.old ? 6000 : 4000)
    } catch (e) {
      flash(setToast, e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message, 4000)
    }
  }
  const exportLog = async () => {
    const n = Date.now(), log = buildLog(stRef.current, n), name = logFileName(n), text = JSON.stringify(log, null, 2)
    try {
      const file = new File([text], name, { type: 'application/json' })
      if (window.matchMedia?.('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name })
      else download(name, text)
      commit(markExported(stRef.current, n, log))
      flash(setToast, `Exported ${name}`, 4000)
    } catch (e) {
      flash(setToast, e?.name === 'AbortError' ? 'Export cancelled' : 'Export failed', 3000)
    }
  }
  const stale = exportStale(st)

  return (
    <>
      <main className="main">
        <div className="day">
          <div className={`scr pb ${running.length ? '' : 'nobar'}`}>
            <div className="tt">
              <div><h1>{key === today ? 'Today' : shortDay(key)}</h1><p className="sub">{longDay(key)}</p></div>
              <label className="rng" aria-label="Pick a day"><Calendar size={16} className="ic" aria-hidden />{shortDay(key)}<input type="date" value={key} onChange={(e) => e.target.value && setKey(e.target.value)} /></label>
            </div>
            <div className="sync">
              <button className="pillbtn" onClick={() => fileRef.current?.click()}><FileUp size={18} className="ic" aria-hidden />Load plan</button>
              <button className="pillbtn" onClick={exportLog}><Share2 size={18} className="ic" aria-hidden />Export log</button>
              <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={loadPlan} aria-label="Plan file" />
            </div>
            <p className="syncst">{st.planLoadedAt ? `Plan loaded ${stamp(st.planLoadedAt)}` : 'No plan loaded'} · {st.lastExportAt ? `Last export ${stamp(st.lastExportAt)}` : 'Never exported'}</p>
            {planIsOld(st, now) && <div className="oldplan" role="status"><TriangleAlert size={16} className="ic" aria-hidden />The loaded plan is more than a day old. Load a fresh plan from the website.</div>}
            {stale && <div className="stale" role="status"><Info size={16} className="ic" aria-hidden />Changes since the last export. Export before you finish.</div>}
            <div className="seg tg" role="tablist" aria-label="View">
              <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List size={20} className="ic" aria-hidden />List</button>
              <button role="tab" aria-selected={view === 'timeline'} className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}><AlignCenter size={20} className="ic" aria-hidden />Timeline</button>
            </div>
            {view === 'list' || !dayItems.length ? <Hero t={totals} /> : null}
            {dayItems.length === 0 ? (
              <div className="empty">
                <div className="ring"><i><Plus size={26} className="ic" aria-hidden /></i></div>
                <h2>Nothing planned for {key === today ? 'today' : 'this day'}</h2>
                <p>Load the plan from the website, or add what you do. Start a timer when you begin, or log time you already spent.</p>
                <button className="btn" onClick={() => fileRef.current?.click()}><FileUp size={22} className="ic" aria-hidden />Load plan</button>
                <button className="btn sec" onClick={() => setSheet({ type: 'add' })}><Plus size={22} className="ic" aria-hidden />Add an item</button>
                <button className="btn sec" onClick={() => setSheet({ type: 'add', thenLog: true })}><Clock size={22} className="ic" aria-hidden />Log time already spent</button>
              </div>
            ) : view === 'timeline' ? (
              <Timeline st={st} dkey={key} now={now} onOpen={(id) => setSheet({ type: 'item', id })} />
            ) : (
              <>
                <form className="qa" onSubmit={quickAdd}>
                  <Plus size={20} className="ic" aria-hidden />
                  <input aria-label="Add an item" placeholder={`Add an item to ${key === today ? 'today' : shortDay(key)}`} value={quick} onChange={(e) => setQuick(e.target.value)} enterKeyHint="done" />
                  <button type="button" className="dt" onClick={() => { setSheet({ type: 'add', title: quick }); setQuick('') }}>Details</button>
                </form>
                {groups.map(({ cat, list, logged, planned }) => {
                  const shut = closed[cat]
                  return (
                    <section key={cat} aria-label={catLabel(cat)}>
                      <button className="gh" aria-expanded={!shut} onClick={() => setClosed({ ...closed, [cat]: !shut })}>
                        <span className="l">{shut ? <ChevronRight size={18} className="ic" aria-hidden /> : <ChevronDown size={18} className="ic" aria-hidden />}<i className="dot" style={{ background: catColor(cat) }} />{catLabel(cat)} · {list.length}</span>
                        <span>{fmtMin(logged)}{planned > 0 ? ` / ${fmtMin(planned)}` : ''}</span>
                      </button>
                      {!shut && (
                        <div className="glist">
                          {list.map((it) => (
                            <Row key={it.id} it={it} entries={entriesOf(st, it.id)} running={isRunning(st, it.id)} missed={missedItem(st, it, now)} now={now} dkey={key}
                              onOpen={() => setSheet({ type: 'item', id: it.id })}
                              onDone={() => commit(patchItem(st, it.id, { done: !it.done }))}
                              onToggle={() => toggleTimer(it)} />
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })}
              </>
            )}
          </div>

          {running.length > 0 && (
            <div className="runwrap">
              {runOpen && running.length > 1 && (
                <div className="runlist" aria-label="Running timers">
                  {running.map(({ item, entry }) => (
                    <div className="rr" key={entry.id}>
                      <i className="dot" style={{ background: catColor(item.cat) }} /><b>{item.title}</b>
                      <span className="t">{clock(now - (entry.ts || now))}</span>
                      <button className="go stop" style={{ minWidth: 76 }} aria-label={`Stop ${item.title}`} onClick={() => commit(stopTimer(st, item.id, Date.now()))}><Square size={16} className="ic" fill="currentColor" aria-hidden />Stop</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="runbar" role="status">
                <button className="l" onClick={() => setRunOpen(!runOpen)} aria-expanded={runOpen} aria-label={`${running.length} running`}>
                  <span className="n"><span className="rdot" /><i className="dot" style={{ background: catColor(running[0].item.cat) }} /><b>{running[0].item.title}</b>
                    {running.length > 1 && <span>· {running.length} running {runOpen ? <ChevronDown size={14} className="ic" /> : <ChevronUp size={14} className="ic" />}</span>}</span>
                  <span className="tmr">{clock(now - (running[0].entry.ts || now))}</span>
                </button>
                <button className="go stop" aria-label="Stop timer" onClick={() => commit(stopTimer(st, running[0].item.id, Date.now()))}><Square size={18} className="ic" fill="currentColor" aria-hidden />Stop</button>
              </div>
            </div>
          )}
          {toast && <div className="toast" role="status"><Check size={20} className="ic" aria-hidden />{toast}</div>}
          {undo && <div className="toast undo" role="status"><span style={{ flex: 1 }}>{undo.label}</span><button onClick={restore}>Undo</button></div>}
        </div>
      </main>

      <nav className="tabbar t2" aria-label="Main">
        <button className="tab on" aria-current="page" onClick={() => { setView('list'); setKey(today) }}><span className="pill"><Clock size={22} className="ic" aria-hidden />{running.length > 0 && <i className="badge" aria-label={`${running.length} running`}>{running.length}</i>}</span>Today</button>
        <button className="tab" onClick={() => setSheet({ type: 'add' })}><span className="pill"><Plus size={22} className="ic" aria-hidden /></span>Add</button>
      </nav>

      {sheet?.type === 'add' && <AddItemSheet initialTitle={sheet.title || ''} initialCat={st.lastCat} day={key} today={today} onClose={() => setSheet(null)} onSave={(d) => create(d, sheet.thenLog)} />}
      {cur && (
        <ItemSheet item={cur} entries={entriesOf(st, cur.id)} now={now} onClose={() => setSheet(null)}
          onPatch={(p) => commit(patchItem(st, cur.id, p))}
          onToggleDone={() => commit(patchItem(st, cur.id, { done: !cur.done }))}
          onDelete={() => { setSheet(null); withUndo(`Deleted "${cur.title}"`, deleteItem(st, cur.id)) }}
          onAddTime={() => setSheet({ type: 'time', itemId: cur.id, back: cur.id })}
          onEditEntry={(en) => setSheet({ type: 'time', itemId: cur.id, entry: en, back: cur.id })}
          onDeleteEntry={(en) => withUndo('Deleted time entry', deleteEntry(st, en.id))}
          onStopEntry={() => commit(stopTimer(st, cur.id, Date.now()))} />
      )}
      {sheet?.type === 'time' && (
        <AddTimeSheet items={st.items.filter((i) => i.date === key || i.id === sheet.itemId)} itemId={sheet.itemId} entry={sheet.entry} dateKey={key} now={now}
          onClose={() => setSheet(sheet.back ? { type: 'item', id: sheet.back } : null)}
          onSave={(id, date, s, e, eid) => { commit(eid ? updateEntry(st, eid, { s, e }) : addEntry(st, id, date, s, e)); setSheet(sheet.back ? { type: 'item', id: sheet.back } : null); flash(setToast, 'Time saved', 2600) }} />
      )}
    </>
  )
}
