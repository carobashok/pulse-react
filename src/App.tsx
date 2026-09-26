import React, { useState } from 'react'
import DashboardPage   from './pages/DashboardPage'
import CAGRPage        from './pages/CAGRPage'
import SCFPage         from './pages/SCFPage'
import StretchPage     from './pages/StretchV2Page'
import AdminPage       from './pages/AdminPage'
import MapPage         from './pages/MapPage'
import CoveragePage    from './pages/CoveragePage'
import PlazaNamesPage  from './pages/PlazaNamesPage'

type Page = 'dashboard' | 'cagr' | 'scf' | 'stretch' | 'map' | 'coverage' | 'admin' | 'plazanames'

const NAV = [
  { id: 'dashboard' as Page, label: 'Dashboard',        sub: 'Network overview'    },
  { id: 'cagr'      as Page, label: 'CAGR Analysis',    sub: 'Plaza revenue table' },
  { id: 'scf'       as Page, label: 'SCF & ADT',        sub: 'Seasonal factors'    },
  { id: 'stretch'   as Page, label: 'Stretch Analysis', sub: 'Compare plazas'      },
  { id: 'map'       as Page, label: 'Plaza Map',        sub: 'All toll locations'  },
  { id: 'coverage'  as Page, label: 'Data Coverage',    sub: 'Months available'    },
]

const ADMIN_SUB = [
  { id: 'admin'      as Page, label: 'Vehicle Templates', sub: 'Category grouping'  },
  { id: 'plazanames' as Page, label: 'Plaza Names',       sub: 'Canonical mapping'  },
]

export default function App() {
  const [page,          setPage]          = useState<Page>('dashboard')
  const [collapsed,     setCollapsed]     = useState(false)
  const [adminExpanded, setAdminExpanded] = useState(false)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showPIN,       setShowPIN]       = useState(false)
  const [pinInput,      setPinInput]      = useState('')
  const [pinError,      setPinError]      = useState(false)

  const ADMIN_PIN = '1900'

  const isAdminPage = page === 'admin' || page === 'plazanames'

  function navTo(id: Page) {
    setPage(id)
    if (id === 'admin' || id === 'plazanames') setAdminExpanded(true)
  }

  function handleAdminClick() {
    if (adminUnlocked) {
      setAdminExpanded(e => !e)
    } else {
      setShowPIN(true)
      setPinInput('')
      setPinError(false)
    }
  }

  function handlePINSubmit() {
    if (pinInput === ADMIN_PIN) {
      setAdminUnlocked(true)
      setAdminExpanded(true)
      setShowPIN(false)
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: collapsed ? 60 : 220, minWidth: collapsed ? 60 : 220,
        background: '#1a2540', borderRight: '1px solid #243050',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.18s ease, min-width 0.18s ease', overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: collapsed ? '18px 14px' : '18px 20px', borderBottom: '1px solid #ffffff15', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 4, background: '#e07b10', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12 L5 6 L9 9 L12 3 L14 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>PULSE</div>
              <div style={{ fontSize: 9, color: '#ffffff55', marginTop: 3, letterSpacing: '0.07em', textTransform: 'uppercase' }}>ETC / FASTag Analytics</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 0', overflowY: 'auto' }}>
          {!collapsed && (
            <div style={{ fontSize: 9, fontWeight: 600, color: '#ffffff30', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 20px 8px' }}>Analytics</div>
          )}

          {/* Main nav items */}
          {NAV.map(item => {
            const active = page === item.id
            return (
              <button key={item.id} onClick={() => navTo(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', border: 'none', cursor: 'pointer',
                  background: active ? '#e07b1015' : 'transparent',
                  borderLeft: `3px solid ${active ? '#e07b10' : 'transparent'}`,
                  padding: collapsed ? '11px 0' : '11px 20px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'background 0.1s',
                }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#e07b10' : '#ffffff30', flexShrink: 0 }} />
                {!collapsed && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#fff' : '#ffffff70', lineHeight: 1.2 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: '#ffffff35', marginTop: 1 }}>{item.sub}</div>
                  </div>
                )}
              </button>
            )
          })}

          {/* Admin group */}
          {!collapsed && (
            <div style={{ marginTop: 8, borderTop: '1px solid #ffffff12', paddingTop: 8 }}>
              <button onClick={handleAdminClick}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', border: 'none', cursor: 'pointer',
                  background: isAdminPage ? '#e07b1015' : 'transparent',
                  borderLeft: `3px solid ${isAdminPage ? '#e07b10' : 'transparent'}`,
                  padding: '11px 20px',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isAdminPage ? '#e07b10' : '#ffffff30', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: isAdminPage ? 600 : 400, color: isAdminPage ? '#fff' : '#ffffff70', lineHeight: 1.2 }}>Admin</div>
                    <div style={{ fontSize: 10, color: '#ffffff35', marginTop: 1 }}>Configuration</div>
                  </div>
                </div>
                <span style={{ color: '#ffffff40', fontSize: 10 }}>{adminExpanded ? '▲' : '▼'}</span>
              </button>

              {adminExpanded && ADMIN_SUB.map(item => {
                const active = page === item.id
                return (
                  <button key={item.id} onClick={() => navTo(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', border: 'none', cursor: 'pointer',
                      background: active ? '#e07b1020' : 'transparent',
                      borderLeft: `3px solid ${active ? '#e07b10' : 'transparent'}`,
                      padding: '9px 20px 9px 36px',
                      justifyContent: 'flex-start',
                    }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? '#e07b10' : '#ffffff25', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? '#fff' : '#ffffff60', lineHeight: 1.2 }}>{item.label}</div>
                      <div style={{ fontSize: 9, color: '#ffffff30', marginTop: 1 }}>{item.sub}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Admin collapsed */}
          {collapsed && (
            <button onClick={() => { setAdminExpanded(true); setCollapsed(false) }}
              title="Admin"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', border: 'none', cursor: 'pointer',
                background: isAdminPage ? '#e07b1015' : 'transparent',
                borderLeft: `3px solid ${isAdminPage ? '#e07b10' : 'transparent'}`,
                padding: '11px 0',
              }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isAdminPage ? '#e07b10' : '#ffffff30' }} />
            </button>
          )}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ffffff12', padding: collapsed ? '12px 0' : '12px 20px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: collapsed ? 'center' : 'stretch' }}>
          {!collapsed && <div style={{ fontSize: 10, color: '#ffffff30' }}>IHMCL — National Highways</div>}
          <button onClick={() => setCollapsed(c => !c)} style={{
            background: 'transparent', border: '1px solid #ffffff20', borderRadius: 4,
            color: '#ffffff50', cursor: 'pointer', fontSize: 11, padding: '4px 8px',
            fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', background: '#f4f6f9' }}>
        {page === 'dashboard'  && <DashboardPage />}
        {page === 'cagr'       && <CAGRPage />}
        {page === 'scf'        && <SCFPage  />}
        {page === 'stretch'    && <StretchPage />}
        {page === 'map'        && <MapPage />}
        {page === 'coverage'   && <CoveragePage />}
        {page === 'admin'      && <AdminPage />}
        {page === 'plazanames' && <PlazaNamesPage />}
      </main>

      {/* PIN Modal */}
      {showPIN && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setShowPIN(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 8, padding: '28px 32px',
            width: 300, boxShadow: '0 8px 32px #00000040',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2540', marginBottom: 6 }}>Admin Access</div>
            <div style={{ fontSize: 12, color: '#8995a8', marginBottom: 20 }}>Enter PIN to access admin settings</div>
            <input
              autoFocus
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false) }}
              onKeyDown={e => e.key === 'Enter' && handlePINSubmit()}
              placeholder="Enter 4-digit PIN"
              style={{
                width: '100%', border: `1px solid ${pinError ? '#c94f4f' : '#dde2ea'}`,
                borderRadius: 4, padding: '10px 12px', fontSize: 16,
                fontFamily: 'DM Mono', outline: 'none', marginBottom: 8,
                letterSpacing: '0.3em', textAlign: 'center',
                background: pinError ? '#fff5f5' : '#f4f6f9',
                boxSizing: 'border-box',
              }}
            />
            {pinError && <div style={{ fontSize: 11, color: '#c94f4f', marginBottom: 8, textAlign: 'center' }}>Incorrect PIN — try again</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setShowPIN(false)} style={{
                flex: 1, padding: '9px', background: '#f4f6f9', border: '1px solid #dde2ea',
                borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans', color: '#8995a8',
              }}>Cancel</button>
              <button onClick={handlePINSubmit} style={{
                flex: 1, padding: '9px', background: '#1a2540', border: 'none',
                borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans',
                color: '#fff', fontWeight: 600,
              }}>Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
