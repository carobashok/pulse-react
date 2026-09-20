import React, { useMemo, useState } from 'react'
import { usePlazaList } from '../hooks/usePlazaList'
import { useVehicleTemplates } from '../hooks/useVehicleTemplates'
import { PageHeader, EmptyState } from '../components/UI'

const TEMPLATE_COLORS: Record<string, string> = {
  '3-Category': '#9b59b6',
  '4-Category': '#3d7ab5',
}

function templateColor(name: string): string {
  return TEMPLATE_COLORS[name] ?? '#8995a8'
}

export default function AdminPage() {
  const { plazas, loading: plLoading } = usePlazaList()
  const { templates, plazaMap, loading: tmplLoading, assignTemplate } = useVehicleTemplates()

  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('all') // 'all' | 'mapped' | 'unmapped' | templateId
  const [saving,    setSaving]    = useState<Record<string, boolean>>({})
  const [saved,     setSaved]     = useState<Record<string, boolean>>({})
  const [error,     setError]     = useState<Record<string, string>>({})

  const loading = plLoading || tmplLoading

  // Filter plazas
  const displayPlazas = useMemo(() => {
    let list = plazas
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.toLowerCase().includes(q))
    }
    if (filter === 'mapped')   list = list.filter(p => plazaMap[p] != null)
    if (filter === 'unmapped') list = list.filter(p => plazaMap[p] == null)
    if (filter !== 'all' && filter !== 'mapped' && filter !== 'unmapped') {
      list = list.filter(p => plazaMap[p] === filter)
    }
    return list
  }, [plazas, search, filter, plazaMap])

  // Stats
  const mappedCount   = plazas.filter(p => plazaMap[p] != null).length
  const unmappedCount = plazas.length - mappedCount

  async function handleAssign(plaza: string, templateId: string | null) {
    setSaving(s => ({ ...s, [plaza]: true }))
    setSaved(s => ({ ...s, [plaza]: false }))
    setError(e => ({ ...e, [plaza]: '' }))
    const ok = await assignTemplate(plaza, templateId)
    setSaving(s => ({ ...s, [plaza]: false }))
    if (ok) {
      setSaved(s => ({ ...s, [plaza]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [plaza]: false })), 2000)
    } else {
      setError(e => ({ ...e, [plaza]: 'Save failed' }))
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
      <PageHeader
        title="Admin — Vehicle Category Templates"
        subtitle="Assign a vehicle grouping template to each plaza · Plazas with no template show all 6 categories"
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Plazas',   value: plazas.length,  color: '#1a2540', filter: 'all'     },
          { label: 'Mapped',         value: mappedCount,    color: '#16a085', filter: 'mapped'  },
          { label: 'Not Mapped',     value: unmappedCount,  color: '#e07b10', filter: 'unmapped'},
          ...templates.map(t => ({
            label: t.template_name,
            value: plazas.filter(p => plazaMap[p] === t.id).length,
            color: templateColor(t.template_name),
            filter: t.id,
          }))
        ].map(s => (
          <div key={s.filter}
            onClick={() => setFilter(f => f === s.filter ? 'all' : s.filter)}
            style={{
              background: filter === s.filter ? s.color : '#fff',
              border: `1px solid ${s.color}`,
              borderRadius: 6, padding: '10px 16px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: filter === s.filter ? '#fff' : s.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono', color: filter === s.filter ? '#fff' : '#1a2540' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Template legend */}
      <div style={{ background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Templates</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 11, color: '#8995a8' }}>No template assigned →</span>
            <span style={{ fontSize: 11, color: '#1a2540', marginLeft: 6, fontWeight: 500 }}>Car/Jeep · LCV · Bus/Truck · 3-Axle · 4-6 Axle · OSV (all 6 shown)</span>
          </div>
          {templates.map(t => (
            <div key={t.id}>
              <span style={{ fontSize: 11, color: templateColor(t.template_name), fontWeight: 600 }}>{t.template_name} →</span>
              <span style={{ fontSize: 11, color: '#1a2540', marginLeft: 6 }}>{t.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search plaza name…"
          style={{
            width: '100%', maxWidth: 400,
            background: '#fff', border: '1px solid #dde2ea', borderRadius: 4,
            color: '#1a2540', padding: '7px 12px', fontSize: 13,
            fontFamily: 'DM Sans', outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: '#8995a8', marginLeft: 12 }}>
          Showing {displayPlazas.length} of {plazas.length} plazas
        </span>
      </div>

      {/* Table */}
      {loading
        ? <EmptyState message="Loading…" />
        : (
          <div style={{ background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ borderBottom: '2px solid #e2e6ed', background: '#f8f9fb' }}>
                    <th style={thS}>Plaza</th>
                    <th style={{ ...thS, width: 260 }}>Template</th>
                    <th style={{ ...thS, width: 80 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPlazas.map((plaza, ri) => {
                    const currentTemplateId = plazaMap[plaza] ?? null
                    const currentTemplate   = templates.find(t => t.id === currentTemplateId)
                    const isSaving = saving[plaza]
                    const isSaved  = saved[plaza]
                    const hasError = error[plaza]

                    return (
                      <tr key={plaza} style={{
                        background: ri % 2 === 0 ? '#fff' : '#fafbfc',
                        borderBottom: '1px solid #f0f2f5',
                      }}>
                        {/* Plaza name */}
                        <td style={{ padding: '9px 16px', fontWeight: 500, color: '#1a2540' }}>
                          {plaza}
                          {currentTemplate && (
                            <span style={{
                              marginLeft: 8, fontSize: 10, fontWeight: 600,
                              color: templateColor(currentTemplate.template_name),
                              background: templateColor(currentTemplate.template_name) + '15',
                              padding: '1px 6px', borderRadius: 3,
                            }}>{currentTemplate.template_name}</span>
                          )}
                        </td>

                        {/* Template selector */}
                        <td style={{ padding: '7px 16px' }}>
                          <select
                            value={currentTemplateId ?? ''}
                            onChange={e => handleAssign(plaza, e.target.value || null)}
                            disabled={isSaving}
                            style={{
                              width: '100%',
                              background: '#f4f6f9', border: '1px solid #dde2ea',
                              borderRadius: 4, color: '#1a2540',
                              padding: '5px 28px 5px 10px', fontSize: 12,
                              fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer',
                              appearance: 'none',
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238995a8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
                              opacity: isSaving ? 0.6 : 1,
                            }}
                          >
                            <option value="">— No template (show all 6) —</option>
                            {templates.map(t => (
                              <option key={t.id} value={t.id}>{t.template_name} — {t.description}</option>
                            ))}
                          </select>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '7px 16px', textAlign: 'center', fontSize: 11, fontFamily: 'DM Mono', whiteSpace: 'nowrap' }}>
                          {isSaving && <span style={{ color: '#8995a8' }}>Saving…</span>}
                          {isSaved  && <span style={{ color: '#16a085', fontWeight: 600 }}>✓ Saved</span>}
                          {hasError && <span style={{ color: '#c94f4f' }}>{hasError}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div>
  )
}

const thS: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left',
  color: '#a0aabc', fontWeight: 600, fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  whiteSpace: 'nowrap', fontFamily: 'DM Sans',
}
