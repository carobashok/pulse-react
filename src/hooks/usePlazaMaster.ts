import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface PlazaMaster {
  id: number
  plaza_name: string
  highway: string
  chainage_km: number
  latitude: number
  longitude: number
  state: string
  direction: string
}

export function usePlazaMaster() {
  const [data, setData]       = useState<PlazaMaster[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from('plaza_master')
        .select('id,plaza_name,highway,chainage_km,latitude,longitude,state,direction')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('highway')
        .order('chainage_km')
      setData((rows ?? []) as PlazaMaster[])
      setLoading(false)
    }
    load()
  }, [])

  return { data, loading }
}
