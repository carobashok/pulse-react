import React, { useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { usePlazaMaster } from '../hooks/usePlazaMaster'
import { useConcessionaires } from '../hooks/useConcessionaires'
import { PageHeader, EmptyState } from '../components/UI'
import { useEffect } from 'react'
import type { PlazaMaster } from '../hooks/usePlazaMaster'

const COLORS = [
  '#e07b10','#3d7ab5','#16a085','#9b59b6','#c94f4f',
  '#2980b9','#27ae60','#e67e22','#8e44ad','#c0392b',
  '#1abc9c','#f39c12','#2ecc71','#e74c3c','#3498db',
]

function FitBounds({ plazas }: { plazas: PlazaMaster[] }) {
  const map = useMap()
  useEffect(() => {
    if (!plazas.length) return
    if (plazas.length === 1) {
      map.setView([plazas[0].latitude, plazas[0].longitude], 10)
    } else {
      map.fitBounds(
        plazas.map(p => [p.latitude, p.longitude] as [number,number]),
        { padding: [40, 40] }
      )
    }
  }, [plazas, map])
  return null
}

export default function MapPage() {
  const { data: plazas, loading } = usePlazaMaster()
  const { concessionaires, getSpvs, getPlazas } = useConcessionaires()

  const [filterBy,       setFilterBy]       = useState<'none'|'highway'|'state'|'concessionaire'>('none')
  const [concessionaire, setConcessionaire] = useState('All')
  const [spv,            setSpv]            = useState('All')
  const [highway,        setHighway]        = useState('All')
  const [state,          setState]          = useState('All')
  const [search,         setSearch]         = useState('')
  const [selectedPlaza,  setSelectedPlaza]  = useState<PlazaMaster | null>(null)

  // Derived filter options
  const highways = useMemo(() => ['All', ...new Set(plazas.map(p => p.highway).filter(Boolean))].sort(), [plazas])
  const states   = useMemo(() => ['All', ...new Set(plazas.map(p => p.state).filter(Boolean))].sort(), [plazas])
  const spvOptions = getSpvs(concessionaire)

  // Concessionaire plaza names
  const concPlazaNames = useMemo(() => {
    if (concessionaire === 'All' && spv === 'All') return null
    return new Set(getPlazas(concessionaire, spv).map(p => p.toLowerCase().trim()))
  }, [concessionaire, spv])

  // Filtered plazas for display
  const displayPlazas = useMemo(() => {
    let list = plazas
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.plaza_name.toLowerCase().includes(q) || p.highway?.toLowerCase().includes(q))
    }
    if (highway !== 'All') list = list.filter(p => p.highway === highway)
    if (state !== 'All')   list = list.filter(p => p.state === state)
    if (concPlazaNames)    list = list.filter(p => concPlazaNames.has(p.plaza_name.toLowerCase().trim()))
    return list
  }, [plazas, search, highway, state, concPlazaNames])

  // Color assignment based on filter mode
  function getColor(plaza: PlazaMaster): string {
    if (filterBy === 'highway') {
      const idx = highways.indexOf(plaza.highway)
      return COLORS[idx % COLORS.length]
    }
    if (filterBy === 'state') {
      const idx = states.indexOf(plaza.state)
      return COLORS[idx % COLORS.length]
    }
    if (filterBy === 'concessionaire') {
      // All selected plazas same color since already filtered
      return '#e07b10'
    }
    return '#3d7ab5'
  }

  // Legend items
  const legendItems = useMemo(() => {
    if (filterBy === 'highway') {
      const used = [...new Set(displayPlazas.map(p => p.highway))].sort()
      return used.map(h => ({ label: h, color: COLORS[highways.indexOf(h) % COLORS.length] }))
    }
    if (filterBy === 'state') {
      const used = [...new Set(displayPlazas.map(p => p.state))].sort()
      return used.map(s => ({ label: s, color: COLORS[states.indexOf(s) % COLORS.length] }))
    }
    return []
  }, [filterBy, displayPlazas, highways, states])

  const center: [number,number] = [20.5937, 78.9629] // India center

  if (loading) return <PageWrap><EmptyState message="Loading plaza data…" /></PageWrap>

  return (
    <PageWrap>
      <PageHeader
        title="Plaza Map"
        subtitle={`${displayPlazas.length} plazas with coordinates`}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '12px 16px', background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, alignItems: 'flex-end' }}>
        {/* Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 200px' }}>
          <label style={lblS}>Search Plaza / Highway</label>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Type to filter…"
            style={{ background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '6px 10px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none' }} />
        </div>

        {/* Highway */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <label style={lblS}>Highway</label>
          <select value={highway} onChange={e => { setHighway(e.target.value); if (e.target.value !== 'All') setFilterBy('highway') }} style={selS}>
            {highways.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>

        {/* State */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <label style={lblS}>State</label>
          <select value={state} onChange={e => { setState(e.target.value); if (e.target.value !== 'All') setFilterBy('state') }} style={selS}>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Concessionaire */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={lblS}>Concessionaire</label>
          <select value={concessionaire} onChange={e => { setConcessionaire(e.target.value); setSpv('All'); setFilterBy('concessionaire') }} style={selS}>
            <option value="All">All Concessionaires</option>
            {concessionaires.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* SPV */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={lblS}>SPV / Project</label>
          <select value={spv} onChange={e => setSpv(e.target.value)} style={selS}>
            <option value="All">All SPVs</option>
            {spvOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Color by */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <label style={lblS}>Color By</label>
          <select value={filterBy} onChange={e => setFilterBy(e.target.value as typeof filterBy)} style={selS}>
            <option value="none">None</option>
            <option value="highway">Highway</option>
            <option value="state">State</option>
            <option value="concessionaire">Concessionaire</option>
          </select>
        </div>

        {/* Reset */}
        <button onClick={() => { setSearch(''); setHighway('All'); setState('All'); setConcessionaire('All'); setSpv('All'); setFilterBy('none') }}
          style={{ padding: '6px 12px', background: '#fff', border: '1px solid #dde2ea', borderRadius: 4, color: '#8995a8', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans', alignSelf: 'flex-end' }}>
          Reset
        </button>
      </div>

      {/* Map + sidebar */}
      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 260px)', minHeight: 500 }}>
        {/* Map */}
        <div style={{ flex: 1, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e6ed', position: 'relative' }}>
          <MapContainer
            key={displayPlazas.map(p => p.id).join(',')}
            center={center}
            zoom={5}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <FitBounds plazas={displayPlazas} />
            {displayPlazas.map(plaza => (
              <CircleMarker
                key={plaza.id}
                center={[plaza.latitude, plaza.longitude]}
                radius={selectedPlaza?.id === plaza.id ? 10 : 7}
                pathOptions={{
                  fillColor: getColor(plaza),
                  color: selectedPlaza?.id === plaza.id ? '#1a2540' : '#fff',
                  weight: selectedPlaza?.id === plaza.id ? 3 : 1.5,
                  opacity: 1,
                  fillOpacity: 0.85,
                }}
                eventHandlers={{ click: () => setSelectedPlaza(plaza) }}
              >
                <Popup>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: '#1a2540', marginBottom: 6, fontSize: 13 }}>{plaza.plaza_name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', color: '#8995a8', fontSize: 11 }}>
                      <span>Highway</span><span style={{ color: '#1a2540', fontWeight: 500 }}>{plaza.highway}</span>
                      <span>Chainage</span><span style={{ color: '#1a2540', fontWeight: 500 }}>Km {plaza.chainage_km}</span>
                      <span>State</span><span style={{ color: '#1a2540', fontWeight: 500 }}>{plaza.state}</span>
                      <span>Direction</span><span style={{ color: '#1a2540', fontWeight: 500 }}>{plaza.direction}</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Legend */}
          {legendItems.length > 0 && (
            <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, background: 'rgba(255,255,255,0.95)', borderRadius: 4, padding: '8px 12px', fontSize: 11, border: '1px solid #e2e6ed', boxShadow: '0 1px 4px #00000020', maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, color: '#1a2540', marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {filterBy === 'highway' ? 'Highway' : 'State'}
              </div>
              {legendItems.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ color: '#1a2540' }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plaza list sidebar */}
        <div style={{ width: 260, background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e6ed', fontSize: 11, fontWeight: 600, color: '#1a2540' }}>
            {displayPlazas.length} Plazas
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {displayPlazas.map(plaza => (
              <div key={plaza.id}
                onClick={() => setSelectedPlaza(selectedPlaza?.id === plaza.id ? null : plaza)}
                style={{
                  padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5',
                  background: selectedPlaza?.id === plaza.id ? '#f0f4ff' : '#fff',
                  borderLeft: `3px solid ${selectedPlaza?.id === plaza.id ? getColor(plaza) : 'transparent'}`,
                }}
                onMouseEnter={e => { if (selectedPlaza?.id !== plaza.id) e.currentTarget.style.background = '#f8f9fb' }}
                onMouseLeave={e => { if (selectedPlaza?.id !== plaza.id) e.currentTarget.style.background = '#fff' }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a2540', marginBottom: 2 }}>{plaza.plaza_name}</div>
                <div style={{ fontSize: 10, color: '#8995a8' }}>{plaza.highway} · Km {plaza.chainage_km} · {plaza.state}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWrap>
  )
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column' }}>{children}</div>
}

const lblS: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.07em' }
const selS: React.CSSProperties = { background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '6px 28px 6px 10px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238995a8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }
