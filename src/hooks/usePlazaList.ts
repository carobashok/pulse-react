import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function usePlazaList() {
  const [plazas, setPlazas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      // Load plaza names and corrections in parallel
      const [{ data: plazaData }, { data: corrections }] = await Promise.all([
        supabase.from('monthly_plaza_summary').select('plaza_name').order('plaza_name'),
        supabase.from('plaza_corrections').select('raw_name, canonical_name'),
      ])

      // Build correction map
      const corrMap: Record<string, string> = {}
      for (const r of (corrections ?? []) as { raw_name: string; canonical_name: string }[]) {
        if (r.raw_name && r.canonical_name) {
          corrMap[r.raw_name.toLowerCase().trim()] = r.canonical_name
        }
      }

      // Apply corrections and deduplicate
      const rawNames = (plazaData ?? []).map((r: { plaza_name: string }) => r.plaza_name as string)
      const canonical = rawNames.map(n => corrMap[n.toLowerCase().trim()] ?? n)
      const unique = [...new Set(canonical)].sort()

      setPlazas(unique)
      setLoading(false)
    }
    fetch()
  }, [])

  return { plazas, loading }
}
