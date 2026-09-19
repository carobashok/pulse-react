import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function usePlazaList() {
  const [plazas, setPlazas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      // Use monthly_plaza_summary for canonical names (already corrected)
      const { data } = await supabase
        .from('monthly_plaza_summary')
        .select('plaza_name')
        .order('plaza_name')
      const unique = [...new Set((data ?? []).map((r: { plaza_name: string }) => r.plaza_name as string))]
      setPlazas(unique)
      setLoading(false)
    }
    fetch()
  }, [])

  return { plazas, loading }
}
