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
}

type FieldKey = 'highway' | 'section_of_highway' | 'state' | 'latitude' | 'longitude'

const EDITABLE_FIELDS: FieldKey[] = ['latitude', 'longitude', 'highway', 'section_of_highway', 'state']

interface EditRow {
  latitude: string
  longitude: string
  highway: string
  section_of_highway: string
  state: string
}

function toEditRow(p: Plaza): EditRow {
  return {
    latitude: p.latitude ?? '' as any,
    longitude: p.longitude ?? '' as any,
    highway: p.highway ?? '',
    section_of_highway: p.section_of_highway ?? '',
    state: p.state ?? '',
  }
}

export default function PlazaDetailsPage() {
  const [plazas,  setPlazas]  = useState<Plaza[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'missing_geo' | 'complete'>('all')
  const [saving,  setSaving]  = useState<Record<number, boolean>>({})
  const [saved,   setSaved]   = useState<Record<number, boolean>>({})
  const [errors,  setErrors]  = useState<Record<number, string>>({})
  const [editVal, setEditVal] = useState<Record<number, EditRow>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('plaza_master')
        .select('id, plaza_name, highway, section_of_highway, chainage_km, latitude, longitude, state, direction')
        .order('plaza_name')
      setPlazas((data ?? []) as Plaza[])
      setLoading(false)
    }
    load()
  }, [])

  const hasMissingGeo = (p: Plaza) => p.latitude == null || p.longitude == null

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
    if (filterMode === 'missing_geo') list = list.filter(p => hasMissingGeo(p))
    if (filterMode === 'complete')    list = list.filter(p => !hasMissingGeo(p))
    return list
  }, [plazas, search, filterMode])

  const missingCount  = plazas.filter(p => hasMissingGeo(p)).length
  const completeCount = plazas.length - missingCount

  function getRow(p: Plaza): EditRow {
    return editVal[p.id] ?? toEditRow(p)
  }

  function isDirty(p: Plaza): boolean {
    const cur = getRow(p)
    const orig = toEditRow(p)
    return EDITABLE_FIELDS.some(f => String(cur[f]) !== String(orig[f]))
  }

  function updateField(id: number, field: FieldKey, value: string) {
    setEditVal(ev => ({
      ...ev,
      [id]: { ...(ev[id] ?? toEditRow(plazas.find(p => p.id === id)!)), [field]: value }
    }))
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
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('plaza_master')
      .update(payload)
      .eq('id', p.id)

    setSaving(s => ({ ...s, [p.id]: false }))
    if (!error) {
      setPlazas(list => list.map(x => x.id === p.id ? { ...x, ...payload } : x))
      setEditVal(ev => { const n = { ...ev }; delete n[p.id]; return n })
      setSaved(s => ({ ...s, [p.id]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [p.id]: false })), 2000)
    } else {
      setErrors(e => ({ ...e, [p.id]: error.message }))
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
        subtitle="Update coordinates, highway, section & state · Plaza names come from the ingestion pipeline and are read-only here"
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Plazas',   value: plazas.length,  color: '#1a2540', key: 'all'          },
          { label: 'Missing Lat/Long', value: missingCount, color: '#e07b10', key: 'missing_geo'  },
          { label: 'Complete',       value: completeCount,  color: '#16a085', key: 'complete'      },
        ].map(s => (
          <div key={s.key}
            onClick={() => setFilterMode(f => f === s.key ? 'all' : s.key as typeof filterMode)}
            style={{
              background: filterMode === s.key ? s.color : '#fff',
              border: `1px solid ${s.color}40`, borderRadius: 6,
              padding: '8px 16px', minWidth: 140, cursor: 'pointer',
            }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: filterMode === s.key ? '#fff' : '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono', color: filterMode === s.key ? '#fff' : s.color }}>{s.value}</div>
          </div>
        ))}
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
