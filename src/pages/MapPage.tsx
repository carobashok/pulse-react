import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet'
import { usePlazaMaster } from '../hooks/usePlazaMaster'
import { useConcessionaires } from '../hooks/useConcessionaires'
import { PageHeader, EmptyState } from '../components/UI'
import type { PlazaMaster } from '../hooks/usePlazaMaster'

const COLORS = [
  '#e07b10','#3d7ab5','#16a085','#9b59b6','#c94f4f',
  '#2980b9','#27ae60','#e67e22','#8e44ad','#c0392b',
  '#1abc9c','#f39c12','#2ecc71','#e74c3c','#3498db',
]

// ─── Fit bounds ───────────────────────────────────────────────────────────────

function FitBounds({ plazas, routePoints }: { plazas: PlazaMaster[]; routePoints: [number,number][] }) {
  const map = useMap()
  useEffect(() => {
    const allPoints: [number,number][] = [
      ...plazas.map(p => [p.latitude, p.longitude] as [number,number]),
      ...routePoints,
    ]
    if (!allPoints.length) return
    if (allPoints.length === 1) {
      map.setView(allPoints[0], 10)
    } else {
      map.fitBounds(allPoints, { padding: [40, 40] })
    }
  }, [plazas, routePoints, map])
  return null
}

// ─── Overpass query for NH route ──────────────────────────────────────────────

// Match plaza highway against NH input — handles messy data
function matchesNH(highwayVal: string, nhInput: string): boolean {
  if (!highwayVal || !nhInput) return false
  const num = nhInput.replace(/[^0-9]/g, '').trim()
  if (!num) return false
  const h = highwayVal.trim()
  // Exact matches: "44", "NE-4", "NH-44", "NH 44"
  if (h === num) return true
  if (h.toLowerCase() === `ne-${num}`) return true
  if (h.toLowerCase() === `nh-${num}`) return true
  if (h.toLowerCase() === `nh ${num}`) return true
  // Starts with the number followed by space or end: "44 (old ...)"
  if (new RegExp(`^${num}(\\s|$)`).test(h)) return true
  // Starts with NH-num or NE-num
  if (new RegExp(`^(NH|NE)[- ]?${num}(\\s|$|[^0-9])`, 'i').test(h)) return true
  return false
}

function getNHRoute(plazas: PlazaMaster[], nhInput: string): [number,number][] {
  return plazas
    .filter(p => matchesNH(p.highway ?? '', nhInput))
    .sort((a, b) => a.chainage_km - b.chainage_km)
    .map(p => [p.latitude, p.longitude] as [number, number])
}

// ─── Main page ────────────────────────────────────────────────────────────────

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

  // NH route state
  const [nhInput,        setNhInput]        = useState('')
  const [nhQueried,      setNhQueried]      = useState('')
  const [routePoints,    setRoutePoints]    = useState<[number,number][]>([])
  const [routeError,     setRouteError]     = useState('')

  const highways   = useMemo(() => ['All', ...new Set(plazas.map(p => p.highway).filter(Boolean))].sort(), [plazas])
  const states     = useMemo(() => ['All', ...new Set(plazas.map(p => p.state).filter(Boolean))].sort(), [plazas])
  const spvOptions = getSpvs(concessionaire)

  const concPlazaNames = useMemo(() => {
    if (concessionaire === 'All' && spv === 'All') return null
    return new Set(getPlazas(concessionaire, spv).map(p => p.toLowerCase().trim()))
  }, [concessionaire, spv])

  const displayPlazas = useMemo(() => {
    let list = plazas
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.plaza_name.toLowerCase().includes(q) || p.highway?.toLowerCase().includes(q))
    }
    if (highway !== 'All') list = list.filter(p => p.highway === highway)
    if (state !== 'All')   list = list.filter(p => p.state === state)
    if (concPlazaNames)    list = list.filter(p => concPlazaNames.has(p.plaza_name.toLowerCase().trim()))
    // If NH route active, highlight only plazas on that NH
    return list
  }, [plazas, search, highway, state, concPlazaNames])

  // Plazas on the queried NH
  const nhPlazas = useMemo(() => {
    if (!nhQueried) return new Set<number>()
    return new Set(plazas.filter(p => matchesNH(p.highway ?? '', nhQueried)).map(p => p.id))
  }, [plazas, nhQueried])

  function getColor(plaza: PlazaMaster): string {
    if (nhQueried) return nhPlazas.has(plaza.id) ? '#e07b10' : '#cbd5e1'
    if (filterBy === 'highway')        return COLORS[highways.indexOf(plaza.highway) % COLORS.length]
    if (filterBy === 'state')          return COLORS[states.indexOf(plaza.state) % COLORS.length]
    if (filterBy === 'concessionaire') return '#e07b10'
    return '#3d7ab5'
  }

  const legendItems = useMemo(() => {
    if (nhQueried) return []
    if (filterBy === 'highway') {
      const used = [...new Set(displayPlazas.map(p => p.highway))].sort()
      return used.map(h => ({ label: h, color: COLORS[highways.indexOf(h) % COLORS.length] }))
    }
    if (filterBy === 'state') {
      const used = [...new Set(displayPlazas.map(p => p.state))].sort()
      return used.map(s => ({ label: s, color: COLORS[states.indexOf(s) % COLORS.length] }))
    }
    return []
  }, [filterBy, displayPlazas, highways, states, nhQueried])

  const handleNHSearch = useCallback(() => {
    const num = nhInput.replace(/[^0-9]/g, '').trim()
    if (!num) return
    setRouteError('')
    setNhQueried(nhInput.trim())
    const pts = getNHRoute(plazas, nhInput)
    if (pts.length === 0) {
      setRouteError(`No plazas found for NH-${num} in our database`)
      setRoutePoints([])
    } else {
      setRoutePoints(pts)
    }
  }, [nhInput, plazas])

  function clearRoute() {
    setNhInput('')
    setNhQueried('')
    setRoutePoints([])
    setRouteError('')
  }

  const center: [number,number] = [20.5937, 78.9629]

  if (loading) return <PageWrap><EmptyState message="Loading plaza data…" /></PageWrap>

  return (
    <PageWrap>
      <PageHeader
        title="Plaza Map"
        subtitle={`${displayPlazas.length} plazas with coordinates`}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, padding: '12px 16px', background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 160px' }}>
          <label style={lblS}>Search Plaza / Highway</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type to filter…" style={inpS} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
          <label style={lblS}>Highway</label>
          <select value={highway} onChange={e => { setHighway(e.target.value); if (e.target.value !== 'All') setFilterBy('highway') }} style={selS}>
            {highways.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
          <label style={lblS}>State</label>
          <select value={state} onChange={e => { setState(e.target.value); if (e.target.value !== 'All') setFilterBy('state') }} style={selS}>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={lblS}>Concessionaire</label>
          <select value={concessionaire} onChange={e => { setConcessionaire(e.target.value); setSpv('All'); setFilterBy('concessionaire') }} style={selS}>
            <option value="All">All Concessionaires</option>
            {concessionaires.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <label style={lblS}>SPV / Project</label>
          <select value={spv} onChange={e => setSpv(e.target.value)} style={selS}>
            <option value="All">All SPVs</option>
            {spvOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <label style={lblS}>Color By</label>
          <select value={filterBy} onChange={e => setFilterBy(e.target.value as typeof filterBy)} style={selS}>
            <option value="none">None</option>
            <option value="highway">Highway</option>
            <option value="state">State</option>
            <option value="concessionaire">Concessionaire</option>
          </select>
        </div>
        <button onClick={() => { setSearch(''); setHighway('All'); setState('All'); setConcessionaire('All'); setSpv('All'); setFilterBy('none') }}
          style={{ padding: '6px 12px', background: '#fff', border: '1px solid #dde2ea', borderRadius: 4, color: '#8995a8', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans', alignSelf: 'flex-end' }}>
          Reset
        </button>
      </div>

      {/* NH Route bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, padding: '10px 16px', background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ ...lblS, marginBottom: 0, whiteSpace: 'nowrap' }}>Show NH Route</label>
        <input
          value={nhInput}
          onChange={e => setNhInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNHSearch()}
          placeholder="e.g. 44 or NH-44"
          style={{ ...inpS, width: 140 }}
        />
        <button onClick={handleNHSearch} disabled={!nhInput.trim()}
          style={{ padding: '6px 16px', background: '#1a2540', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans', fontWeight: 600, opacity: !nhInput.trim() ? 0.5 : 1 }}>
          Show Route
        </button>
        {nhQueried && (
          <button onClick={clearRoute}
            style={{ padding: '6px 12px', background: '#fff', border: '1px solid #dde2ea', borderRadius: 4, color: '#c94f4f', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans' }}>
            Clear Route
          </button>
        )}
        {nhQueried && routePoints.length > 0 && (
          <span style={{ fontSize: 11, color: '#16a085', fontWeight: 500 }}>
            ✓ NH-{nhQueried.replace(/[^0-9]/g, '')} route loaded · {nhPlazas.size} plaza{nhPlazas.size !== 1 ? 's' : ''} on this highway
          </span>
        )}
        {routeError && <span style={{ fontSize: 11, color: '#c94f4f' }}>{routeError}</span>}
      </div>

      {/* Map + sidebar */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Map */}
        <div style={{ flex: 1, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e6ed', position: 'relative' }}>
          <MapContainer
            key="plaza-map"
            center={center}
            zoom={5}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <FitBounds plazas={displayPlazas} routePoints={routePoints} />

            {/* NH Route polyline */}
            {routePoints.length > 0 && (
              <Polyline
                positions={routePoints}
                pathOptions={{ color: '#e07b10', weight: 3, opacity: 0.8 }}
              />
            )}

            {/* Plaza markers */}
            {displayPlazas.map(plaza => {
              const onNH    = nhQueried ? nhPlazas.has(plaza.id) : true
              const radius  = selectedPlaza?.id === plaza.id ? 11 : onNH ? 8 : 6
              return (
                <CircleMarker
                  key={plaza.id}
                  center={[plaza.latitude, plaza.longitude]}
                  radius={radius}
                  pathOptions={{
                    fillColor: getColor(plaza),
                    color: selectedPlaza?.id === plaza.id ? '#1a2540' : '#fff',
                    weight: selectedPlaza?.id === plaza.id ? 3 : 1.5,
                    opacity: 1,
                    fillOpacity: nhQueried && !onNH ? 0.4 : 0.9,
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
              )
            })}
          </MapContainer>

          {/* Legend */}
          {(legendItems.length > 0 || nhQueried) && (
            <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, background: 'rgba(255,255,255,0.95)', borderRadius: 4, padding: '8px 12px', fontSize: 11, border: '1px solid #e2e6ed', boxShadow: '0 1px 4px #00000020', maxHeight: 200, overflowY: 'auto' }}>
              {nhQueried && routePoints.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, color: '#1a2540', marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NH Route</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 20, height: 3, background: '#e07b10', borderRadius: 2 }} />
                    <span>NH-{nhQueried.replace(/[^0-9]/g,'')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e07b10' }} />
                    <span>Plaza on this NH</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#cbd5e1' }} />
                    <span style={{ color: '#8995a8' }}>Other plazas</span>
                  </div>
                </>
              )}
              {!nhQueried && legendItems.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ color: '#1a2540' }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plaza list sidebar */}
        <div style={{ width: 240, background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e6ed', fontSize: 11, fontWeight: 600, color: '#1a2540' }}>
            {nhQueried
              ? `${nhPlazas.size} plazas on NH-${nhQueried.replace(/[^0-9]/g,'')}`
              : `${displayPlazas.length} plazas`
            }
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {(nhQueried
              ? displayPlazas.filter(p => nhPlazas.has(p.id)).sort((a,b) => a.chainage_km - b.chainage_km)
              : displayPlazas
            ).map(plaza => (
              <div key={plaza.id}
                onClick={() => setSelectedPlaza(selectedPlaza?.id === plaza.id ? null : plaza)}
                style={{
                  padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5',
                  background: selectedPlaza?.id === plaza.id ? '#fff8f0' : '#fff',
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
const inpS: React.CSSProperties = { background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '6px 10px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none' }
const selS: React.CSSProperties = { background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '6px 28px 6px 10px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238995a8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }
