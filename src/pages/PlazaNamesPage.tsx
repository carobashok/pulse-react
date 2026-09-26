import React, { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PageHeader, EmptyState } from '../components/UI'

interface Correction {
  id: number
  raw_name: string
  canonical_name: string
}

export default function PlazaNamesPage() {
  const [corrections,  setCorrections]  = useState<Correction[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterMode,   setFilterMode]   = useState<'all' | 'mapped' | 'unmapped'>('all')
  const [saving,       setSaving]       = useState<Record<number, boolean>>({})
  const [saved,        setSaved]        = useState<Record<number, boolean>>({})
  const [editVal,      setEditVal]      = useState<Record<number, string>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('plaza_corrections')
        .select('id, raw_name, canonical_name')
        .order('raw_name')
      setCorrections((data ?? []) as Correction[])
      setLoading(false)
    }
    load()
  }, [])

  // Canonical names — plazas that are their own canonical (no mapping)
  const canonicalNames = useMemo(() =>
    [...new Set(corrections.map(r => r.canonical_name))].sort()
  , [corrections])

  const isMapped = (r: Correction) => r.raw_name.toLowerCase().trim() !== r.canonical_name.toLowerCase().trim()

  const display = useMemo(() => {
    let list = corrections
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.raw_name.toLowerCase().includes(q) || r.canonical_name.toLowerCase().includes(q))
    }
    if (filterMode === 'mapped')   list = list.filter(r => isMapped(r))
    if (filterMode === 'unmapped') list = list.filter(r => !isMapped(r))
    return list
  }, [corrections, search, filterMode])

  const mappedCount   = corrections.filter(r => isMapped(r)).length
  const unmappedCount = corrections.length - mappedCount

  async function handleSave(row: Correction) {
    const newCanonical = (editVal[row.id] ?? row.canonical_name).trim()
    if (!newCanonical) return
    setSaving(s => ({ ...s, [row.id]: true }))
    const { error } = await supabase
      .from('plaza_corrections')
      .update({ canonical_name: newCanonical })
      .eq('id', row.id)
    setSaving(s => ({ ...s, [row.id]: false }))
    if (!error) {
      setCorrections(c => c.map(r => r.id === row.id ? { ...r, canonical_name: newCanonical } : r))
      setEditVal(e => { const n = { ...e }; delete n[row.id]; return n })
      setSaved(s => ({ ...s, [row.id]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [row.id]: false })), 2000)
    }
  }

  function handleReset(row: Correction) {
    setEditVal(e => ({ ...e, [row.id]: row.raw_name }))
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <PageHeader
        title="Plaza Name Mapping"
        subtitle="Map raw plaza names to canonical names · Use to merge renamed or MLFF plazas"
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Plazas',  value: corrections.length, color: '#1a2540', key: 'all'      },
          { label: 'Mapped',        value: mappedCount,         color: '#16a085', key: 'mapped'   },
          { label: 'Not Mapped',    value: unmappedCount,       color: '#8995a8', key: 'unmapped' },
        ].map(s => (
          <div key={s.key}
            onClick={() => setFilterMode(f => f === s.key ? 'all' : s.key as typeof filterMode)}
            style={{
              background: filterMode === s.key ? s.color : '#fff',
              border: `1px solid ${s.color}40`, borderRadius: 6,
              padding: '8px 16px', minWidth: 120, cursor: 'pointer',
            }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: filterMode === s.key ? '#fff' : '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono', color: filterMode === s.key ? '#fff' : s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search plaza name…"
          style={{ background: '#fff', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '7px 12px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none', width: '100%', maxWidth: 400 }} />
        <span style={{ fontSize: 11, color: '#8995a8', marginLeft: 12 }}>
          Showing {display.length} of {corrections.length}
        </span>
      </div>

      {/* Info */}
      <div style={{ fontSize: 11, color: '#8995a8', marginBottom: 12, background: '#f8f9fb', border: '1px solid #e2e6ed', borderRadius: 4, padding: '8px 12px' }}>
        💡 Type any name in the <strong>Canonical Name</strong> column — existing plaza name, or a brand new name like <em>"Samakhiali Combined"</em>. Data from all plazas with the same canonical name will be summed together.
      </div>

      {loading && <EmptyState message="Loading…" />}

      {!loading && (
        <div style={{ background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: '#f8f9fb', borderBottom: '2px solid #e2e6ed' }}>
                  <th style={thS}>Raw Name (in database)</th>
                  <th style={thS}>Canonical Name (shown to users)</th>
                  <th style={{ ...thS, width: 120 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {display.map((row, ri) => {
                  const currentVal = editVal[row.id] ?? row.canonical_name
                  const isDirty    = currentVal !== row.canonical_name
                  const isSaving_  = saving[row.id]
                  const isSaved_   = saved[row.id]
                  const mapped     = isMapped(row)

                  return (
                    <tr key={row.id} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f0f2f5' }}>
                      {/* Raw name */}
                      <td style={{ padding: '8px 16px', color: '#1a2540', fontWeight: 500 }}>
                        {row.raw_name}
                        {mapped && (
                          <span style={{ marginLeft: 8, fontSize: 10, color: '#16a085', background: '#d1fae5', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>mapped</span>
                        )}
                      </td>

                      {/* Canonical name input */}
                      <td style={{ padding: '6px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            value={currentVal}
                            onChange={e => setEditVal(ev => ({ ...ev, [row.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleSave(row)}
                            style={{
                              flex: 1, background: isDirty ? '#fffbf0' : '#f4f6f9',
                              border: `1px solid ${isDirty ? '#e07b10' : '#dde2ea'}`,
                              borderRadius: 4, color: '#1a2540', padding: '5px 10px',
                              fontSize: 12, fontFamily: 'DM Sans', outline: 'none',
                            }}
                          />
                          {isDirty && (
                            <>
                              <button onClick={() => handleSave(row)} disabled={isSaving_}
                                style={{ padding: '4px 10px', background: '#1a2540', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans', fontWeight: 600 }}>
                                {isSaving_ ? '…' : 'Save'}
                              </button>
                              <button onClick={() => handleReset(row)}
                                style={{ padding: '4px 8px', background: '#fff', border: '1px solid #dde2ea', borderRadius: 4, color: '#8995a8', cursor: 'pointer', fontSize: 11 }}>
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '6px 16px', textAlign: 'center', fontSize: 11, fontFamily: 'DM Mono', whiteSpace: 'nowrap' }}>
                        {isSaved_ && <span style={{ color: '#16a085', fontWeight: 600 }}>✓ Saved</span>}
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

const thS: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left',
  color: '#a0aabc', fontWeight: 600, fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  whiteSpace: 'nowrap', fontFamily: 'DM Sans',
}
