import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
      const { data: rows } = await supabase
        .from('plaza_concession')
        .select('concessionaire_name, spv_name, fee_plaza_name')
        .order('concessionaire_name')
      setData((rows ?? []) as ConcessionaireRow[])
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

  // Plaza names filtered by concessionaire + spv (matched against monthly_plaza_summary names)
  function getPlazas(concessionaire: string, spv: string): string[] {
    let rows = data
    if (concessionaire !== 'All') rows = rows.filter(r => r.concessionaire_name === concessionaire)
    if (spv !== 'All') rows = rows.filter(r => r.spv_name === spv)
    return [...new Set(rows.map(r => r.fee_plaza_name).filter(Boolean))].sort()
  }

  return { concessionaires, getSpvs, getPlazas, loading }
}
