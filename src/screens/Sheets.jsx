import { useState } from 'react'
import { X, Check, Plus, Minus, ChevronDown, Clock, Trash2, Link2 } from 'lucide-react'
import { CATS, catLabel, catColor, clockOf, dayKey, dayStart, addDays, fmtMin, planMin, planEnd, toMin, hhmmOf, shortDay, totalMs, entStart, entEnd } from '../lib/dayStore.js'

const MIN = 60000

export function SheetFrame({ title, onClose, children, foot, titleNode }) {
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet tall" role="dialog" aria-label={title}>
        <div className="grab" />
        <div className="body">
          <div className="row sb2" style={{ marginBottom: 8 }}>
            {titleNode || <h2 style={{ fontSize: 'var(--text-xl)' }}>{title}</h2>}
            <button className="xb" onClick={onClose} aria-label="Close"><X size={20} className="ic" /></button>
          </div>
          {children}
          <div style={{ height: 14 }} />
        </div>
        {foot && <div className="foot">{foot}</div>}
      </div>
    </>
  )
}

export const DurText = ({ min }) => {
  const m = Math.max(0, Math.floor(min)), h = Math.floor(m / 60), r = m % 60
  if (h === 0) return <>{r} <small>min</small></>
  return r === 0 ? <>{h} <small>h</small></> : <>{h} <small>h</small> {String(r).padStart(2, '0')} <small>min</small></>
}

// "HH:MM" pair -> { start, plan } (minutes) for the DayItem schema
export const planFromTimes = (a, b) => {
  const s = toMin(a), e = toMin(b)
  return { start: s, plan: s != null && e != null && e > s ? e - s : null }
}

/* ---------- Add item (phone-created: added_on_phone) ---------- */
export function AddItemSheet({ initialTitle = '', initialCat, day, today, onSave, onClose }) {
  const [title, setTitle] = useState(initialTitle)
  const [cat, setCat] = useState(initialCat)
  const [pstart, setStart] = useState('')
  const [pend, setEnd] = useState('')
  const [which, setWhich] = useState(day === today ? 'today' : day === addDays(today, 1) ? 'tomorrow' : 'pick')
  const [pick, setPick] = useState(day)
  const date = which === 'today' ? today : which === 'tomorrow' ? addDays(today, 1) : pick
  const bad = pstart && pend && toMin(pend) <= toMin(pstart)
  const ok = title.trim() && !bad && date
  return (
    <SheetFrame title="Add item" onClose={onClose} foot={<button className="btn" disabled={!ok} onClick={() => onSave({ title, cat, date, ...planFromTimes(pstart, pend) })}><Plus size={22} className="ic" />Add item</button>}>
      <div className="lbl" style={{ marginTop: 0 }}>What will you do</div>
      <div className="field titlefield"><input autoFocus placeholder="e.g. Prepare notes for team sync" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="lbl">Category (pick one)</div>
      <div className="chips">
        {CATS.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
            <i className="dot" style={{ background: catColor(c) }} />{catLabel(c)}{cat === c && <Check size={16} className="ic" />}
          </button>
        ))}
      </div>
      <div className="lbl">Planned start and end <span className="opt">optional</span></div>
      <div className="two" style={{ marginBottom: 0 }}>
        <div className="field"><input type="time" aria-label="Planned start" value={pstart} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><input type="time" aria-label="Planned end" value={pend} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      {bad && <div className="err-t">End must be after start.</div>}
      <div className="lbl">Day</div>
      <div className="seg s2">
        {[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['pick', 'Pick date']].map(([k, l]) => <button key={k} className={which === k ? 'on' : ''} onClick={() => setWhich(k)}>{l}</button>)}
      </div>
      {which === 'pick' && <div className="field" style={{ marginTop: 10 }}><input type="date" aria-label="Date" value={pick} onChange={(e) => e.target.value && setPick(e.target.value)} /></div>}
    </SheetFrame>
  )
}

/* ---------- Add / edit time (manual entry) ---------- */
export function AddTimeSheet({ items, itemId, entry, dateKey, now, onSave, onClose }) {
  const editing = !!entry
  const today = dayKey(now)
  const [mode, setMode] = useState('range')
  const [id, setId] = useState(itemId || items[0]?.id || '')
  const [date, setDate] = useState(entry ? entry.date : dateKey)
  const nowM = Math.floor((now - dayStart(today)) / MIN)
  const [start, setStart] = useState(entry ? hhmmOf(entry.s) : dateKey === today ? hhmmOf(Math.max(0, nowM - 60)) : '09:00')
  const [end, setEnd] = useState(entry ? hhmmOf(entry.e) : dateKey === today ? hhmmOf(nowM) : '10:00')
  const [dur, setDur] = useState(30)
  const [endedAt, setEndedAt] = useState(date === today ? hhmmOf(nowM) : '18:00')
  let s = null, e = null
  if (mode === 'range') { s = toMin(start); e = toMin(end) } else { e = toMin(endedAt); s = e != null ? e - dur : null }
  const ok = id && date && s != null && e != null && s >= 0 && e > s && e <= 1440
  const item = items.find((i) => i.id === id)
  return (
    <SheetFrame title={editing ? 'Edit time' : 'Add time'} onClose={onClose} foot={<button className="btn" disabled={!ok} onClick={() => onSave(id, date, s, e, entry?.id)}>Save time entry</button>}>
      {!editing && <div className="seg s2"><button className={mode === 'range' ? 'on' : ''} onClick={() => setMode('range')}>Start and end</button><button className={mode === 'dur' ? 'on' : ''} onClick={() => setMode('dur')}>Duration</button></div>}
      <div className="lbl">Item</div>
      <div className="field sel">
        <select aria-label="Item" value={id} disabled={editing} onChange={(e2) => setId(e2.target.value)}>{items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select>
        <ChevronDown size={20} className="ic" />
      </div>
      <div className="lbl">Date</div>
      <div className="field"><input type="date" aria-label="Date" value={date} disabled={editing} onChange={(e2) => e2.target.value && setDate(e2.target.value)} /></div>
      {mode === 'range' ? (
        <>
          <div className="lbl">Time</div>
          <div className="tfs">
            <div className="tf"><span className="cap">Start</span><input type="time" aria-label="Start" value={start} onChange={(e2) => setStart(e2.target.value)} /></div>
            <div className="tf"><span className="cap">End</span><input type="time" aria-label="End" value={end} onChange={(e2) => setEnd(e2.target.value)} /></div>
          </div>
          {ok ? <div className="sum"><Clock size={20} className="ic" /><span>Adds <b>{fmtMin(e - s)}</b> to {item?.title}</span></div> : <div className="err-t">End must be after start, on the same day.</div>}
        </>
      ) : (
        <>
          <div className="lbl">Time spent</div>
          <div className="stp">
            <button className="sbtn" aria-label="Less" onClick={() => setDur(Math.max(5, dur - 5))}><Minus size={22} className="ic" /></button>
            <div className="sv"><DurText min={dur} /></div>
            <button className="sbtn" aria-label="More" onClick={() => setDur(dur + 5)}><Plus size={22} className="ic" /></button>
          </div>
          <div className="chips sg" style={{ marginTop: 12 }}>
            {[[15, '15m'], [30, '30m'], [45, '45m'], [60, '1h'], [120, '2h']].map(([m, l]) => <button key={m} className={`chip dur sug ${dur === m ? 'on' : ''}`} onClick={() => setDur(m)}>{l}</button>)}
          </div>
          <div className="lbl">Ended at</div>
          <div className="field"><input type="time" aria-label="Ended at" value={endedAt} onChange={(e2) => setEndedAt(e2.target.value)} /></div>
          {ok ? <div className="sum"><Clock size={20} className="ic" /><span>Placed on the timeline as <b>{hhmmOf(s)} to {hhmmOf(e)}</b></span></div> : <div className="err-t">The entry must stay within one day.</div>}
        </>
      )}
    </SheetFrame>
  )
}

/* ---------- Item sheet with several entries ---------- */
export function ItemSheet({ item, entries, now, onClose, onPatch, onToggleDone, onDelete, onAddTime, onEditEntry, onDeleteEntry, onStopEntry }) {
  const total = totalMs(entries, now) / MIN
  const plan = planMin(item)
  const started = entries.length > 0
  const left = plan - total
  const [pstart, setS] = useState(hhmmOf(item.start))
  const [pend, setE] = useState(hhmmOf(planEnd(item)))
  const bad = pstart && pend && toMin(pend) <= toMin(pstart)
  const commitPlan = (a, b) => { if (!(a && b && toMin(b) <= toMin(a))) onPatch(planFromTimes(a, b)) }
  const sorted = [...entries].sort((a, b) => entStart(a) - entStart(b))
  return (
    <SheetFrame title={item.title} onClose={onClose} titleNode={<h2 style={{ margin: 0, fontSize: 'var(--text-xl)', minWidth: 0, overflowWrap: 'anywhere' }}>{item.title}</h2>}>
      <div className="mut" style={{ margin: '6px 0 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <i className="dot" style={{ background: catColor(item.cat) }} />{catLabel(item.cat)}
        {started && <span>{plan ? `· planned ${fmtMin(plan)}` : ''}{item.start != null ? ` · starts ${hhmmOf(item.start)}` : ''}</span>}
        <span>· {shortDay(item.date)}</span>
        {item.added_on_phone && <span className="tag">Added on phone</span>}
      </div>
      {item.task_title && <div className="mut" style={{ margin: '0 0 12px', display: 'flex', gap: 8, alignItems: 'center' }}><Link2 size={16} className="ic" aria-hidden />Task: {item.task_title}</div>}
      {!started && (
        <>
          <div className="lbl" style={{ marginTop: 0 }}>Planned start and end <span className="opt">editable until started</span></div>
          <div className="two" style={{ marginBottom: 4 }}>
            <div className="field"><input type="time" aria-label="Planned start" value={pstart} onChange={(e) => { setS(e.target.value); commitPlan(e.target.value, pend) }} /></div>
            <div className="field"><input type="time" aria-label="Planned end" value={pend} onChange={(e) => { setE(e.target.value); commitPlan(pstart, e.target.value) }} /></div>
          </div>
          {bad && <div className="err-t">End must be after start.</div>}
        </>
      )}
      <div className="card hero2" style={{ margin: '12px 0' }}>
        <div className="top"><span className="cap">Logged on this item</span></div>
        <div className="num"><DurText min={total} /></div>
        {plan > 0 && <div className="meter"><i className={left < 0 ? 'wn' : ''} style={{ width: `${Math.min(100, (total / plan) * 100)}%` }} /></div>}
        <div className="foot" style={{ background: 'none', padding: 0 }}><span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>{plan > 0 && <span><b>{fmtMin(Math.abs(left))}</b> {left >= 0 ? 'left of plan' : 'over plan'}</span>}</div>
      </div>
      <div className="gh" style={{ padding: '6px 4px' }}><span>Time entries</span></div>
      {sorted.length === 0 ? <p className="mut" style={{ margin: '0 4px 8px' }}>No time yet. Start the timer or add time manually.</p> : (
        <div className="ents">
          {sorted.map((en) => (
            <div className="ent" key={en.id}>
              <button className="tm" disabled={en.e == null} onClick={() => onEditEntry(en)} aria-label={`Edit entry ${clockOf(entStart(en))}`}>
                <b>{en.date !== item.date ? `${shortDay(en.date)} · ` : ''}{clockOf(entStart(en))} to {en.e == null ? 'now' : clockOf(entEnd(en, now))}</b><span>{en.e == null ? 'Running' : en.source === 'web' ? 'Finished (web)' : 'Finished'}</span>
              </button>
              <span className="amt">{fmtMin((entEnd(en, now) - entStart(en)) / MIN)}</span>
              {en.e == null ? <button className="go stop" style={{ minWidth: 72, height: 40 }} onClick={() => onStopEntry(en)}>Stop</button>
                : <button className="xb" aria-label="Delete entry" onClick={() => onDeleteEntry(en)}><Trash2 size={18} className="ic" /></button>}
            </div>
          ))}
        </div>
      )}
      <button className="btn two" onClick={onAddTime}><Plus size={22} className="ic" />Add time manually</button>
      <button className="btn neutral" onClick={onToggleDone}><Check size={22} className="ic" />{item.done ? 'Mark not done' : 'Mark done (separate from the timer)'}</button>
      <button className="btn dng" onClick={onDelete}><Trash2 size={20} className="ic" />Delete item</button>
    </SheetFrame>
  )
}
