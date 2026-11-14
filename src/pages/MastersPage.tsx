import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PageHeader, EmptyState } from '../components/UI'

interface Conc { id: number; name: string; is_active: boolean }
interface Spv  { id: number; name: string; concessionaire_id: number; is_active: boolean }

export default function MastersPage() {
  const [concs, setConcs] = useState<Conc[]>([])
  const [spvs,  setSpvs]  = useState<Spv[]>([])
  const [plazaCount, setPlazaCount] = useState<Record<number, number>>({}) // by spv_id
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [newConc, setNewConc] = useState('')
  const [newSpv, setNewSpv]   = useState('')
  const [newSpvConc, setNewSpvConc] = useState('')
  const [editConc, setEditConc] = useState<Record<number, string>>({})
  const [editSpv, setEditSpv]   = useState<Record<number, { name: string; conc: string }>>({})

  async function load() {
    setLoading(true)
    const [c, s, p] = await Promise.all([
      supabase.from('concessionaire_master').select('id, name, is_active').order('name'),
      supabase.from('spv_master').select('id, name, concessionaire_id, is_active').order('name'),
      supabase.from('plaza_master').select('spv_id').not('spv_id', 'is', null),
    ])
    if (c.error || s.error) setMsg({ kind: 'err', text: (c.error ?? s.error)!.message })
    setConcs((c.data ?? []) as Conc[])
    setSpvs((s.data ?? []) as Spv[])
    const counts: Record<number, number> = {}
    ;(p.data ?? []).forEach((r: any) => { counts[r.spv_id] = (counts[r.spv_id] ?? 0) + 1 })
    setPlazaCount(counts)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text })
    if (kind === 'ok') setTimeout(() => setMsg(null), 2500)
  }
  const friendly = (e: { message: string; code?: string }) =>
    e.code === '23505' ? 'Already exists (names are matched ignoring case/spaces).' : e.message

  async function addConc() {
    const name = newConc.trim()
    if (!name) return
    const { data, error } = await supabase.from('concessionaire_master').insert({ name }).select('id')
    if (error) return flash('err', friendly(error))
    if (!data?.length) return flash('err', 'Blocked (check RLS INSERT policy)')
    setNewConc(''); flash('ok', `Added concessionaire "${name}"`); load()
  }

  async function saveConc(c: Conc) {
    const name = (editConc[c.id] ?? c.name).trim()
    if (!name || name === c.name) return
    const { data, error } = await supabase.from('concessionaire_master')
      .update({ name, updated_at: new Date().toISOString() }).eq('id', c.id).select('id')
    if (error) return flash('err', friendly(error))
    if (!data?.length) return flash('err', 'Blocked (check RLS UPDATE policy)')
    setEditConc(e => { const n = { ...e }; delete n[c.id]; return n })
    flash('ok', 'Saved'); load()
  }

  async function addSpv() {
    const name = newSpv.trim()
    if (!name || !newSpvConc) return flash('err', 'Enter SPV name and choose a concessionaire')
    const { data, error } = await supabase.from('spv_master')
      .insert({ name, concessionaire_id: Number(newSpvConc) }).select('id')
    if (error) return flash('err', friendly(error))
    if (!data?.length) return flash('err', 'Blocked (check RLS INSERT policy)')
    setNewSpv(''); flash('ok', `Added SPV "${name}"`); load()
  }

  async function saveSpv(s: Spv) {
    const e = editSpv[s.id]; if (!e) return
    const name = e.name.trim()
    if (!name) return
    const { data, error } = await supabase.from('spv_master')
      .update({ name, concessionaire_id: Number(e.conc), updated_at: new Date().toISOString() })
      .eq('id', s.id).select('id')
    if (error) return flash('err', friendly(error))
    if (!data?.length) return flash('err', 'Blocked (check RLS UPDATE policy)')
    setEditSpv(x => { const n = { ...x }; delete n[s.id]; return n })
    flash('ok', 'Saved'); load()
  }

  const spvCountFor = (cid: number) => spvs.filter(s => s.concessionaire_id === cid).length
  const plazaCountForConc = (cid: number) =>
    spvs.filter(s => s.concessionaire_id === cid).reduce((a, s) => a + (plazaCount[s.id] ?? 0), 0)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <PageHeader title="Concessionaire & SPV Master"
        subtitle="Add or rename concessionaires and SPVs · Assign them to plazas in Plaza Details" />

      {msg && (
        <div style={{
          fontSize: 12, marginBottom: 12, borderRadius: 4, padding: '8px 12px',
          color: msg.kind === 'ok' ? '#16a085' : '#c0392b',
          background: msg.kind === 'ok' ? '#e8f6f3' : '#fdecea',
          border: `1px solid ${msg.kind === 'ok' ? '#b7e4da' : '#f5c6cb'}`,
        }}>{msg.text}</div>
      )}

      {loading && <EmptyState message="Loading…" />}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 16, alignItems: 'start' }}>
          {/* Concessionaires */}
          <div style={card}>
            <div style={cardTitle}>Concessionaires ({concs.length})</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newConc} onChange={e => setNewConc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addConc()}
                placeholder="New concessionaire name" style={inputS} />
              <button onClick={addConc} style={btnS}>Add</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: '2px solid #e2e6ed' }}>
                <th style={thS}>Name</th><th style={thS}>SPVs</th><th style={thS}>Plazas</th><th style={thS}></th>
              </tr></thead>
              <tbody>
                {concs.map(c => {
                  const dirty = editConc[c.id] !== undefined && editConc[c.id].trim() !== c.name
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={editConc[c.id] ?? c.name}
                          onChange={e => setEditConc(x => ({ ...x, [c.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveConc(c)}
                          style={{ ...inputS, ...(dirty ? dirtyS : {}) }} />
                      </td>
                      <td style={tdNum}>{spvCountFor(c.id)}</td>
                      <td style={tdNum}>{plazaCountForConc(c.id)}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {dirty && <button onClick={() => saveConc(c)} style={btnS}>Save</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* SPVs */}
          <div style={card}>
            <div style={cardTitle}>SPVs ({spvs.length})</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input value={newSpv} onChange={e => setNewSpv(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSpv()}
                placeholder="New SPV name" style={{ ...inputS, flex: '2 1 160px' }} />
              <select value={newSpvConc} onChange={e => setNewSpvConc(e.target.value)} style={{ ...inputS, flex: '1 1 160px' }}>
                <option value="">Concessionaire…</option>
                {concs.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              <button onClick={addSpv} style={btnS}>Add</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: '2px solid #e2e6ed' }}>
                <th style={thS}>SPV</th><th style={thS}>Concessionaire</th><th style={thS}>Plazas</th><th style={thS}></th>
              </tr></thead>
              <tbody>
                {spvs.map(s => {
                  const e = editSpv[s.id]
                  const cur = e ?? { name: s.name, conc: String(s.concessionaire_id) }
                  const dirty = !!e && (e.name.trim() !== s.name || e.conc !== String(s.concessionaire_id))
                  const set = (patch: Partial<{ name: string; conc: string }>) =>
                    setEditSpv(x => ({ ...x, [s.id]: { ...cur, ...patch } }))
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={cur.name} onChange={ev => set({ name: ev.target.value })}
                          onKeyDown={ev => ev.key === 'Enter' && saveSpv(s)}
                          style={{ ...inputS, ...(dirty ? dirtyS : {}) }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select value={cur.conc} onChange={ev => set({ conc: ev.target.value })}
                          style={{ ...inputS, ...(dirty ? dirtyS : {}) }}>
                          {concs.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>
                      </td>
                      <td style={tdNum}>{plazaCount[s.id] ?? 0}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {dirty && <button onClick={() => saveSpv(s)} style={btnS}>Save</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, padding: 16 }
const cardTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#1a2540', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }
const inputS: React.CSSProperties = {
  width: '100%', background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4,
  color: '#1a2540', padding: '6px 8px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box',
}
const dirtyS: React.CSSProperties = { background: '#fffbf0', border: '1px solid #e07b10' }
const btnS: React.CSSProperties = {
  padding: '6px 12px', background: '#1a2540', border: 'none', borderRadius: 4, color: '#fff',
  cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans', fontWeight: 600, whiteSpace: 'nowrap',
}
const thS: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left', color: '#a0aabc', fontWeight: 600, fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'DM Sans',
}
const tdNum: React.CSSProperties = { padding: '6px 8px', fontFamily: 'DM Mono', color: '#1a2540', width: 56 }
