import React, { useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import CAGRPage      from './pages/CAGRPage'
import SCFPage       from './pages/SCFPage'
import StretchPage   from './pages/StretchPage'
import AdminPage     from './pages/AdminPage'

type Page = 'dashboard' | 'cagr' | 'scf' | 'stretch' | 'admin'

const NAV = [
  { id: 'dashboard' as Page, label: 'Dashboard',       sub: 'Network overview'    },
  { id: 'cagr'      as Page, label: 'CAGR Analysis',   sub: 'Plaza revenue table' },
  { id: 'scf'       as Page, label: 'SCF & ADT',       sub: 'Seasonal factors'    },
  { id: 'stretch'   as Page, label: 'Stretch Analysis', sub: 'Compare plazas'     },
  { id: 'admin'     as Page, label: 'Admin',            sub: 'Vehicle templates'   },
]

export default function App() {
  const [page, setPage]           = useState<Page>('dashboard')
  const [collapsed, setCollapsed] = useState(false)

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
        <nav style={{ flex: 1, padding: '14px 0' }}>
          {!collapsed && (
            <div style={{ fontSize: 9, fontWeight: 600, color: '#ffffff30', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 20px 8px' }}>Analytics</div>
          )}
          {NAV.map(item => {
            const active = page === item.id
            return (
              <button key={item.id} onClick={() => setPage(item.id)}
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
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#e07b10' : '#ffffff30', flexShrink: 0, display: collapsed ? 'block' : 'block' }} />
                {!collapsed && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#fff' : '#ffffff70', lineHeight: 1.2 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: '#ffffff35', marginTop: 1 }}>{item.sub}</div>
                  </div>
                )}
              </button>
            )
          })}
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
        {page === 'dashboard' && <DashboardPage />}
        {page === 'cagr'      && <CAGRPage />}
        {page === 'scf'       && <SCFPage  />}
        {page === 'stretch'   && <StretchPage />}
        {page === 'admin'     && <AdminPage />}
      </main>
    </div>
  )
}
