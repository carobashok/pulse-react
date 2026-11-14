import React, { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PageHeader, EmptyState } from '../components/UI'

interface Plaza {
  id: number
  plaza_name: string
  highway: string | null
  section_of_highway: string | null
  chainage_km: number | null
  latitude: number | null
  longitude: number | null
  state: string | null
  direction: string | null
  spv_id: number | null
}

interface ConcMaster { id: number; name: string }
interface SpvMaster { id: number; name: string; concessionaire_id: number }

type FieldKey = 'highway' | 'section_of_highway' | 'state' | 'latitude' | 'longitude' | 'spv_id'

const EDITABLE_FIELDS: FieldKey[] = ['latitude', 'longitude', 'highway', 'section_of_highway', 'state', 'spv_id']

interface EditRow {
  latitude: string
  longitude: string
  highway: string
  section_of_highway: string
  state: string
  spv_id: string   // '' = none
  conc_id: string  // UI-only helper (not saved); '' = none
}

function toEditRow(p: Plaza, spvs: SpvMaster[] = []): EditRow {
  const spv = p.spv_id != null ? spvs.find(s => s.id === p.spv_id) : undefined
  return {
    latitude: p.latitude ?? '' as any,
    longitude: p.longitude ?? '' as any,
    highway: p.highway ?? '',
    section_of_highway: p.section_of_highway ?? '',
    state: p.state ?? '',
    spv_id: p.spv_id != null ? String(p.spv_id) : '',
    conc_id: spv ? String(spv.concessionaire_id) : '',
  }
}

export default function PlazaDetailsPage() {
  const [plazas,  setPlazas]  = useState<Plaza[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'state' | 'highway' | 'section' | 'geo' | 'spv'>('all')
  const [saving,  setSaving]  = useState<Record<number, boolean>>({})
  const [saved,   setSaved]   = useState<Record<number, boolean>>({})
  const [errors,  setErrors]  = useState<Record<number, string>>({})
  const [editVal, setEditVal] = useState<Record<number, EditRow>>({})
  const [concs, setConcs] = useState<ConcMaster[]>([])
  const [spvs,  setSpvs]  = useState<SpvMaster[]>([])
  const [masterError, setMasterError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [pz, cm, sm] = await Promise.all([
        supabase.from('plaza_master')
          .select('id, plaza_name, highway, section_of_highway, chainage_km, latitude, longitude, state, direction, spv_id')
          .order('plaza_name'),
        supabase.from('concessionaire_master').select('id, name').order('name'),
        supabase.from('spv_master').select('id, name, concessionaire_id').order('name'),
      ])
      setPlazas((pz.data ?? []) as Plaza[])
      setConcs((cm.data ?? []) as ConcMaster[])
      setSpvs((sm.data ?? []) as SpvMaster[])
      if (cm.error || sm.error) setMasterError((cm.error ?? sm.error)!.message)
      else if ((cm.data ?? []).length === 0 || (sm.data ?? []).length === 0)
        setMasterError('Concessionaire/SPV lists are empty — check that SELECT policies exist for anon on concessionaire_master and spv_master.')
      setLoading(false)
    }
    load()
  }, [])

  const isBlank = (v: string | null | undefined) => v == null || String(v).trim() === ''
  const hasMissingGeo = (p: Plaza) => p.latitude == null || p.longitude == null

  const missingBy: Record<'state' | 'highway' | 'section' | 'geo' | 'spv', (p: Plaza) => boolean> = {
    state:   p => isBlank(p.state),
    highway: p => isBlank(p.highway),
    section: p => isBlank(p.section_of_highway),
    geo:     p => hasMissingGeo(p),
    spv:     p => p.spv_id == null,
  }

  const display = useMemo(() => {
    let list = plazas
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.plaza_name.toLowerCase().includes(q) ||
        (p.highway ?? '').toLowerCase().includes(q) ||
        (p.state ?? '').toLowerCase().includes(q) ||
        (p.section_of_highway ?? '').toLowerCase().includes(q)
      )
    }
    if (filterMode !== 'all') list = list.filter(missingBy[filterMode])
    return list
  }, [plazas, search, filterMode])

  const tileCount = (k: 'state' | 'highway' | 'section' | 'geo' | 'spv') => {
    const missing = plazas.filter(missingBy[k]).length
    return { missing, complete: plazas.length - missing }
  }

  function getRow(p: Plaza): EditRow {
    return editVal[p.id] ?? toEditRow(p, spvs)
  }

  function isDirty(p: Plaza): boolean {
    const cur = getRow(p)
    const orig = toEditRow(p, spvs)
    return EDITABLE_FIELDS.some(f => String(cur[f]) !== String(orig[f]))
  }

  function setRowFields(id: number, patch: Partial<EditRow>) {
    setEditVal(ev => ({
      ...ev,
      [id]: { ...(ev[id] ?? toEditRow(plazas.find(p => p.id === id)!, spvs)), ...patch }
    }))
  }

  function updateField(id: number, field: FieldKey, value: string) {
    setRowFields(id, { [field]: value } as Partial<EditRow>)
  }

  function handleConcChange(p: Plaza, concId: string) {
    const cur = getRow(p)
    const spvStillValid = cur.spv_id !== '' && spvs.some(s => String(s.id) === cur.spv_id && String(s.concessionaire_id) === concId)
    setRowFields(p.id, { conc_id: concId, spv_id: spvStillValid ? cur.spv_id : '' })
  }

  function handleSpvChange(p: Plaza, spvId: string) {
    const spv = spvs.find(s => String(s.id) === spvId)
    setRowFields(p.id, { spv_id: spvId, conc_id: spv ? String(spv.concessionaire_id) : getRow(p).conc_id })
  }

  function validate(row: EditRow): string | null {
    if (row.latitude !== '' && isNaN(Number(row.latitude)))  return 'Invalid latitude'
    if (row.longitude !== '' && isNaN(Number(row.longitude))) return 'Invalid longitude'
    if (row.latitude !== '' && (Number(row.latitude) < -90 || Number(row.latitude) > 90)) return 'Latitude out of range'
    if (row.longitude !== '' && (Number(row.longitude) < -180 || Number(row.longitude) > 180)) return 'Longitude out of range'
    return null
  }

  async function handleSave(p: Plaza) {
    const row = getRow(p)
    const errMsg = validate(row)
    if (errMsg) {
      setErrors(e => ({ ...e, [p.id]: errMsg }))
      return
    }
    setErrors(e => { const n = { ...e }; delete n[p.id]; return n })
    setSaving(s => ({ ...s, [p.id]: true }))

    const payload = {
      latitude: row.latitude === '' ? null : Number(row.latitude),
      longitude: row.longitude === '' ? null : Number(row.longitude),
      highway: row.highway.trim() || null,
      section_of_highway: row.section_of_highway.trim() || null,
      state: row.state.trim() || null,
      spv_id: row.spv_id === '' ? null : Number(row.spv_id),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('plaza_master')
      .update(payload)
      .eq('id', p.id)
      .select('id')

    setSaving(s => ({ ...s, [p.id]: false }))
    if (error) {
      setErrors(e => ({ ...e, [p.id]: error.message }))
    } else if (!data || data.length === 0) {
      // RLS can silently match zero rows instead of throwing — surface it explicitly
      setErrors(e => ({ ...e, [p.id]: 'Blocked (check RLS policy)' }))
    } else {
      setPlazas(list => list.map(x => x.id === p.id ? { ...x, ...payload } : x))
      setEditVal(ev => { const n = { ...ev }; delete n[p.id]; return n })
      setSaved(s => ({ ...s, [p.id]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [p.id]: false })), 2000)
    }
  }

  function handleReset(id: number) {
    setEditVal(ev => { const n = { ...ev }; delete n[id]; return n })
    setErrors(e => { const n = { ...e }; delete n[id]; return n })
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300 }}>
      <PageHeader
        title="Plaza Details"
        subtitle="Update coordinates, highway, section, state, concessionaire & SPV · Plaza names come from the ingestion pipeline and are read-only here"
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div
          onClick={() => setFilterMode('all')}
          style={{
            background: filterMode === 'all' ? '#1a2540' : '#fff',
            border: '1px solid #1a254040', borderRadius: 6,
            padding: '8px 16px', minWidth: 130, cursor: 'pointer',
          }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: filterMode === 'all' ? '#fff' : '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total Plazas</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono', color: filterMode === 'all' ? '#fff' : '#1a2540' }}>{plazas.length}</div>
        </div>

        {([
          { key: 'state',   label: 'State'          },
          { key: 'highway', label: 'Highway'        },
          { key: 'section', label: 'Section'        },
          { key: 'geo',     label: 'Lat / Long'     },
          { key: 'spv',     label: 'SPV'            },
        ] as const).map(t => {
          const { missing, complete } = tileCount(t.key)
          const active = filterMode === t.key
          const done   = missing === 0
          const accent = done ? '#16a085' : '#e07b10'
          return (
            <div key={t.key}
              onClick={() => setFilterMode(f => f === t.key ? 'all' : t.key)}
              title={`Click to show plazas with missing ${t.label.toLowerCase()}`}
              style={{
                background: active ? accent : '#fff',
                border: `1px solid ${accent}40`, borderRadius: 6,
                padding: '8px 16px', minWidth: 150, cursor: 'pointer',
              }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: active ? '#fff' : '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Missing {t.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono', color: active ? '#fff' : accent }}>{missing}</span>
                <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: active ? '#ffffffcc' : '#16a085' }}>{complete} complete</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search plaza, highway, section or state…"
          style={{ background: '#fff', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '7px 12px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none', width: '100%', maxWidth: 400 }} />
        <span style={{ fontSize: 11, color: '#8995a8', marginLeft: 12 }}>
          Showing {display.length} of {plazas.length}
        </span>
      </div>

      {/* Info */}
      <div style={{ fontSize: 11, color: '#8995a8', marginBottom: 12, background: '#f8f9fb', border: '1px solid #e2e6ed', borderRadius: 4, padding: '8px 12px' }}>
        💡 Edit any field below and press <strong>Enter</strong> or click <strong>Save</strong> to commit. Latitude must be between -90 and 90, longitude between -180 and 180. Leave a field blank to clear it.
      </div>

      {masterError && (
        <div style={{ fontSize: 11, color: '#c0392b', marginBottom: 12, background: '#fdecea', border: '1px solid #f5c6cb', borderRadius: 4, padding: '8px 12px' }}>
          ⚠ {masterError}
        </div>
      )}

      {loading && <EmptyState message="Loading…" />}

      {!loading && (
        <div style={{ background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: '#f8f9fb', borderBottom: '2px solid #e2e6ed' }}>
                  <th style={thS}>Plaza Name</th>
                  <th style={{ ...thS, width: 110 }}>Latitude</th>
                  <th style={{ ...thS, width: 110 }}>Longitude</th>
                  <th style={{ ...thS, width: 140 }}>Highway</th>
                  <th style={thS}>Section of Highway</th>
                  <th style={{ ...thS, width: 130 }}>State</th>
                  <th style={{ ...thS, width: 200 }}>Concessionaire</th>
                  <th style={{ ...thS, width: 200 }}>SPV</th>
                  <th style={{ ...thS, width: 140 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {display.map((p, ri) => {
                  const row      = getRow(p)
                  const dirty    = isDirty(p)
                  const isSaving_ = saving[p.id]
                  const isSaved_  = saved[p.id]
                  const errMsg   = errors[p.id]
                  const missing  = hasMissingGeo(p)

                  return (
                    <tr key={p.id} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f0f2f5' }}>
                      {/* Plaza name — read-only */}
                      <td style={{ padding: '8px 16px', color: '#1a2540', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {p.plaza_name}
                        {missing && (
                          <span style={{ marginLeft: 8, fontSize: 10, color: '#e07b10', background: '#fef3e2', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>no geo</span>
                        )}
                      </td>

                      {/* Latitude */}
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          value={row.latitude}
                          onChange={e => updateField(p.id, 'latitude', e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSave(p)}
                          placeholder="—"
                          style={cellInputStyle(dirty)}
                        />
                      </td>

                      {/* Longitude */}
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          value={row.longitude}
                          onChange={e => updateField(p.id, 'longitude', e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSave(p)}
                          placeholder="—"
                          style={cellInputStyle(dirty)}
                        />
                      </td>

                      {/* Highway */}
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          value={row.highway}
                          onChange={e => updateField(p.id, 'highway', e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSave(p)}
                          placeholder="—"
                          style={cellInputStyle(dirty)}
                        />
                      </td>

                      {/* Section of highway */}
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          value={row.section_of_highway}
                          onChange={e => updateField(p.id, 'section_of_highway', e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSave(p)}
                          placeholder="—"
                          style={cellInputStyle(dirty)}
                        />
                      </td>

                      {/* State */}
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          value={row.state}
                          onChange={e => updateField(p.id, 'state', e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSave(p)}
                          placeholder="—"
                          style={cellInputStyle(dirty)}
                        />
                      </td>

                      {/* Concessionaire */}
                      <td style={{ padding: '6px 8px' }}>
                        <select value={row.conc_id} onChange={e => handleConcChange(p, e.target.value)}
                          style={cellInputStyle(dirty)}>
                          <option value="">—</option>
                          {concs.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>
                      </td>

                      {/* SPV (filtered by concessionaire) */}
                      <td style={{ padding: '6px 8px' }}>
                        <select value={row.spv_id} onChange={e => handleSpvChange(p, e.target.value)}
                          style={cellInputStyle(dirty)}>
                          <option value="">—</option>
                          {spvs
                            .filter(s => row.conc_id === '' || String(s.concessionaire_id) === row.conc_id)
                            .map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                        </select>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '6px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {dirty && !isSaved_ && (
                            <>
                              <button onClick={() => handleSave(p)} disabled={isSaving_}
                                style={{ padding: '4px 10px', background: '#1a2540', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans', fontWeight: 600 }}>
                                {isSaving_ ? '…' : 'Save'}
                              </button>
                              <button onClick={() => handleReset(p.id)}
                                style={{ padding: '4px 8px', background: '#fff', border: '1px solid #dde2ea', borderRadius: 4, color: '#8995a8', cursor: 'pointer', fontSize: 11 }}>
                                ✕
                              </button>
                            </>
                          )}
                          {isSaved_ && <span style={{ color: '#16a085', fontWeight: 600, fontSize: 11, fontFamily: 'DM Mono' }}>✓ Saved</span>}
                          {errMsg && <span style={{ color: '#c0392b', fontWeight: 600, fontSize: 10 }}>{errMsg}</span>}
                        </div>
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

function cellInputStyle(dirty: boolean): React.CSSProperties {
  return {
    width: '100%', background: dirty ? '#fffbf0' : '#f4f6f9',
    border: `1px solid ${dirty ? '#e07b10' : '#dde2ea'}`,
    borderRadius: 4, color: '#1a2540', padding: '5px 8px',
    fontSize: 12, fontFamily: 'DM Sans', outline: 'none',
    boxSizing: 'border-box',
  }
}

const thS: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left',
  color: '#a0aabc', fontWeight: 600, fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  whiteSpace: 'nowrap', fontFamily: 'DM Sans',
}
