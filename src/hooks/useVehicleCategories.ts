import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface CategoryMapping {
  vehicle_type:     string
  display_category: string
  display_order:    number
}

// Default mapping — all 6 shown separately (no template)
const DEFAULT_MAPPING: CategoryMapping[] = [
  { vehicle_type: 'CAR_JEEP',  display_category: 'Car / Jeep',  display_order: 1 },
  { vehicle_type: 'LCV',       display_category: 'LCV',         display_order: 2 },
  { vehicle_type: 'BUS_TRUCK', display_category: 'Bus / Truck', display_order: 3 },
  { vehicle_type: '3_AXLE',    display_category: '3-Axle',      display_order: 4 },
  { vehicle_type: '4_6_AXLE',  display_category: '4-6 Axle',   display_order: 5 },
  { vehicle_type: 'OSV',       display_category: 'OSV',         display_order: 6 },
]

// Returns mapping for a plaza — template if assigned, else default
export function useVehicleCategories(plazaNames: string[]) {
  const [mappings, setMappings] = useState<Record<string, CategoryMapping[]>>({})
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!plazaNames.length) { setMappings({}); return }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Get template assignments for selected plazas
        const { data: ptRows } = await supabase
          .from('plaza_vehicle_template')
          .select('plaza_name, template_id')
          .in('plaza_name', plazaNames)

        const templateIds = [...new Set((ptRows ?? []).map((r: { template_id: string }) => r.template_id).filter(Boolean))]

        // Get mappings for those templates
        let tmplMappings: Record<string, CategoryMapping[]> = {}
        if (templateIds.length > 0) {
          const { data: mappingRows } = await supabase
            .from('vehicle_category_mapping')
            .select('template_id, vehicle_type, display_category, display_order')
            .in('template_id', templateIds)

          for (const r of (mappingRows ?? []) as (CategoryMapping & { template_id: string })[]) {
            if (!tmplMappings[r.template_id]) tmplMappings[r.template_id] = []
            tmplMappings[r.template_id].push({
              vehicle_type:     r.vehicle_type,
              display_category: r.display_category,
              display_order:    r.display_order,
            })
          }
        }

        // Build per-plaza mapping
        const result: Record<string, CategoryMapping[]> = {}
        const plazaTemplateMap: Record<string, string> = {}
        for (const r of (ptRows ?? []) as { plaza_name: string; template_id: string }[]) {
          plazaTemplateMap[r.plaza_name] = r.template_id
        }

        for (const plaza of plazaNames) {
          const tid = plazaTemplateMap[plaza]
          result[plaza] = tid && tmplMappings[tid] ? tmplMappings[tid] : DEFAULT_MAPPING
        }

        if (!cancelled) setMappings(result)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [plazaNames.join(',')])

  // Get the MINIMUM categories — based on the most grouped template among selected plazas
  // This ensures fair comparison across all plazas
  function getMinCategories(): { display_category: string; display_order: number }[] {
    if (!plazaNames.length) return []

    // Get distinct categories per plaza
    const plazaCats = plazaNames.map(plaza => {
      const m = mappings[plaza] ?? DEFAULT_MAPPING
      const cats = [...new Map(m.map(r => [r.display_category, r])).values()]
      return { plaza, cats }
    })

    // Find plaza with fewest categories (most grouped)
    const minPlaza = plazaCats.reduce((min, curr) =>
      curr.cats.length < min.cats.length ? curr : min
    )

    // Use that plaza's category structure
    return minPlaza.cats
      .map(c => ({ display_category: c.display_category, display_order: c.display_order }))
      .sort((a, b) => a.display_order - b.display_order)
  }

  // Get raw vehicle_types for a plaza + display_category
  // minTemplateMapping = the mapping of the most-grouped plaza
  function getRawTypesForCategory(
    plaza: string,
    displayCategory: string,
    minTemplateMapping: CategoryMapping[]
  ): string[] {
    const plazaMapping = mappings[plaza] ?? DEFAULT_MAPPING

    // What raw vehicle_types does the MIN template assign to this display category?
    const rawTypesInMinCat = minTemplateMapping
      .filter(r => r.display_category === displayCategory)
      .map(r => r.vehicle_type)

    // From this plaza's mapping, return all rows whose vehicle_type
    // belongs to the raw types of this min category
    const result = plazaMapping
      .filter(r => rawTypesInMinCat.includes(r.vehicle_type))
      .map(r => r.vehicle_type)

    return result
  }

  // Get the min template mapping (the most grouped plaza's mapping)
  function getMinTemplateMapping(): CategoryMapping[] {
    if (!plazaNames.length) return DEFAULT_MAPPING
    const minPlaza = plazaNames.reduce((minP, p) => {
      const pCats  = new Set((mappings[p]    ?? DEFAULT_MAPPING).map(r => r.display_category))
      const minCats = new Set((mappings[minP] ?? DEFAULT_MAPPING).map(r => r.display_category))
      return pCats.size < minCats.size ? p : minP
    }, plazaNames[0])
    return mappings[minPlaza] ?? DEFAULT_MAPPING
  }

  return { mappings, loading, getMinCategories, getMinTemplateMapping, getRawTypesForCategory }
}
