import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface Template {
  id: string
  template_name: string
  description: string
}

export interface PlazaTemplate {
  plaza_name: string
  template_id: string | null
}

export function useVehicleTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [plazaMap,  setPlazaMap]  = useState<Record<string, string | null>>({})
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [{ data: tmpl, error: e1 }, { data: pmap, error: e2 }] = await Promise.all([
          supabase.from('vehicle_category_template').select('*').order('template_name'),
          supabase.from('plaza_vehicle_template').select('plaza_name, template_id'),
        ])
        if (e1) throw new Error(e1.message)
        if (e2) throw new Error(e2.message)
        setTemplates((tmpl ?? []) as Template[])
        const map: Record<string, string | null> = {}
        for (const r of (pmap ?? []) as PlazaTemplate[]) map[r.plaza_name] = r.template_id
        setPlazaMap(map)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function assignTemplate(plazaName: string, templateId: string | null): Promise<boolean> {
    if (templateId === null) {
      const { error } = await supabase
        .from('plaza_vehicle_template')
        .delete()
        .eq('plaza_name', plazaName)
      if (error) return false
      setPlazaMap(m => { const n = { ...m }; delete n[plazaName]; return n })
    } else {
      const { error } = await supabase
        .from('plaza_vehicle_template')
        .upsert({ plaza_name: plazaName, template_id: templateId }, { onConflict: 'plaza_name' })
      if (error) return false
      setPlazaMap(m => ({ ...m, [plazaName]: templateId }))
    }
    return true
  }

  return { templates, plazaMap, loading, error, assignTemplate }
}
