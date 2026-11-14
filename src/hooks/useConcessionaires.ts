import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Same shape as before, so CAGRPage / MapPage keep working unchanged.
// Source is now concessionaire_master + spv_master + plaza_master.spv_id
// (previously plaza_concession). `fee_plaza_name` now holds plaza_master.plaza_name.
export interface ConcessionaireRow {
  concessionaire_name: string
  spv_name: string
  fee_plaza_name: string
}

export function useConcessionaires() {
  const [data, setData]       = useState<ConcessionaireRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [conc, spv, plz] = await Promise.all([
        supabase.from('concessionaire_master').select('id, name'),
        supabase.from('spv_master').select('id, name, concessionaire_id'),
        supabase.from('plaza_master').select('plaza_name, spv_id, concessionaire_id').or('spv_id.not.is.null,concessionaire_id.not.is.null'),
      ])

      // With RLS on, a missing read policy returns an error or empty list — make it visible.
      if (conc.error || spv.error || plz.error) {
        console.error('useConcessionaires load error:', conc.error?.message, spv.error?.message, plz.error?.message)
      }

      const concById = new Map<number, string>((conc.data ?? []).map((c: any) => [c.id, c.name]))
      const spvById  = new Map<number, { name: string; concessionaire_id: number }>(
        (spv.data ?? []).map((s: any) => [s.id, { name: s.name, concessionaire_id: s.concessionaire_id }])
      )

      const rows: ConcessionaireRow[] = []
      for (const p of (plz.data ?? []) as { plaza_name: string; spv_id: number | null; concessionaire_id: number | null }[]) {
        const s = p.spv_id != null ? spvById.get(p.spv_id) : undefined
        const cid = p.concessionaire_id ?? s?.concessionaire_id
        if (cid == null) continue
        rows.push({
          concessionaire_name: concById.get(cid) ?? '',
          spv_name: s?.name ?? '',
          fee_plaza_name: p.plaza_name,
        })
      }
      rows.sort((a, b) => a.concessionaire_name.localeCompare(b.concessionaire_name))

      setData(rows)
      setLoading(false)
    }
    load()
  }, [])

  // Distinct concessionaires
  const concessionaires = [...new Set(data.map(r => r.concessionaire_name).filter(Boolean))].sort()

  // SPVs filtered by concessionaire
  function getSpvs(concessionaire: string): string[] {
    const rows = concessionaire === 'All' ? data : data.filter(r => r.concessionaire_name === concessionaire)
    return [...new Set(rows.map(r => r.spv_name).filter(Boolean))].sort()
  }

  // Plaza names filtered by concessionaire + spv
  function getPlazas(concessionaire: string, spv: string): string[] {
    let rows = data
    if (concessionaire !== 'All') rows = rows.filter(r => r.concessionaire_name === concessionaire)
    if (spv !== 'All') rows = rows.filter(r => r.spv_name === spv)
    return [...new Set(rows.map(r => r.fee_plaza_name).filter(Boolean))].sort()
  }

  return { concessionaires, getSpvs, getPlazas, loading }
}
