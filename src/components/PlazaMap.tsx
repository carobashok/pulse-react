import React, { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import type { PlazaMaster } from '../hooks/usePlazaMaster'

const PLAZA_COLORS = ['#e07b10', '#3d7ab5', '#16a085', '#9b59b6', '#c94f4f']

// Auto-fit bounds when plazas change
function FitBounds({ plazas }: { plazas: PlazaMaster[] }) {
  const map = useMap()
  useEffect(() => {
    if (!plazas.length) return
    if (plazas.length === 1) {
      map.setView([plazas[0].latitude, plazas[0].longitude], 10)
    } else {
      const bounds = plazas.map(p => [p.latitude, p.longitude] as [number, number])
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [plazas, map])
  return null
}

interface Props {
  plazas: PlazaMaster[]
  highlightPlazas: string[]
  height?: number
}

export default function PlazaMap({ plazas, highlightPlazas, height = 340 }: Props) {
  if (!plazas.length) return null

  const center: [number, number] = [
    plazas.reduce((s, p) => s + p.latitude, 0) / plazas.length,
    plazas.reduce((s, p) => s + p.longitude, 0) / plazas.length,
  ]

  return (
    <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e6ed', position: 'relative' }}>
      <MapContainer
        key={plazas.map(p => p.id).join(',')}
        center={center}
        zoom={7}
        style={{ height, width: '100%', zIndex: 0 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds plazas={plazas} />
        {plazas.map(plaza => {
          const selIdx  = highlightPlazas.findIndex(
            n => n.toLowerCase().trim() === plaza.plaza_name.toLowerCase().trim()
          )
          const isSelected = selIdx !== -1
          const color  = isSelected ? PLAZA_COLORS[selIdx % PLAZA_COLORS.length] : '#94a3b8'
          const radius = isSelected ? 9 : 5

          return (
            <CircleMarker
              key={plaza.id}
              center={[plaza.latitude, plaza.longitude]}
              radius={radius}
              pathOptions={{
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, color: '#1a2540', marginBottom: 4 }}>{plaza.plaza_name}</div>
                  <div style={{ color: '#8995a8', fontSize: 11 }}>{plaza.highway} · Km {plaza.chainage_km}</div>
                  <div style={{ color: '#8995a8', fontSize: 11 }}>{plaza.state} · {plaza.direction}</div>
                  {isSelected && (
                    <div style={{ marginTop: 6, color, fontWeight: 600, fontSize: 11 }}>● Selected</div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', borderRadius: 4,
        padding: '6px 10px', fontSize: 11, border: '1px solid #e2e6ed',
        boxShadow: '0 1px 4px #00000020', pointerEvents: 'none',
      }}>
        {highlightPlazas.map((p, i) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: PLAZA_COLORS[i % PLAZA_COLORS.length], flexShrink: 0 }} />
            <span style={{ color: '#1a2540', fontWeight: 500 }}>{p}</span>
          </div>
        ))}
        {plazas.some(p => !highlightPlazas.some(h => h.toLowerCase().trim() === p.plaza_name.toLowerCase().trim())) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
            <span style={{ color: '#8995a8' }}>Other plazas</span>
          </div>
        )}
      </div>
    </div>
  )
}
