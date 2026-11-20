import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface CAGRRow {
  plaza_name: string
  piu: string
  ro: string
  fy: string
  month: string        // will be empty string — RPC returns aggregated data
  month_name: string
  fy_month_ord: number
  days_in_month: number
  total_amount: number
  total_pcu: number
  total_count: number
  months_data: number
}

export interface CAGRSummaryRow {
  plaza_name:          string
  piu:                 string
  ro:                  string
  fy:                  string
  total_amount:        number
  total_pcu:           number
  total_count:         number
  months_data:         number
  section_of_highway:  string
  highway:             string
  concessionaire_name: string
  spv_name:            string
}

export function useCAGR() {
  const [data, setData]       = useState<CAGRSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const { data: rows, error: err } = await supabase
          .rpc('get_cagr_summary')
        if (err) throw new Error(err.message)
        if (!cancelled) setData((rows ?? []) as CAGRSummaryRow[])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}

// Separate hook for Dashboard page — needs month-level data for trend charts
// but only fetches when a specific plaza or filter is selected.
// Applies plaza_corrections: rows stored under a raw name (e.g. "Paranur Toll Plaza MLFF")
// are returned under their canonical name ("Paranur"), so one plaza = one series.
export function useCAGRMonthly(plaza: string) {
  const [data, setData]       = useState<CAGRRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const key = (s: string) => s.toLowerCase().trim()

        // raw name -> canonical name (lookup is skipped, not fatal, if it fails)
        const { data: corr } = await supabase
          .from('plaza_corrections')
          .select('raw_name, canonical_name')
        const toCanonical: Record<string, string> = {}
        const rawByCanonical: Record<string, string[]> = {}
        for (const c of (corr ?? []) as { raw_name: string; canonical_name: string }[]) {
          if (!c.raw_name || !c.canonical_name) continue
          toCanonical[key(c.raw_name)] = c.canonical_name
          const ck = key(c.canonical_name)
          ;(rawByCanonical[ck] ??= []).push(c.raw_name)
        }

        let query = supabase
          .from('monthly_plaza_summary')
          .select('plaza_name,piu,ro,fy,month,month_name,fy_month_ord,days_in_month,total_amount,total_pcu,total_count,months_data')
          .order('fy').order('month').order('plaza_name')

        if (plaza !== 'All') {
          // every raw name that maps to the selected canonical name, plus the name itself
          const names = [...new Set([plaza, ...(rawByCanonical[key(plaza)] ?? [])])]
          query = query.in('plaza_name', names)
        }

        const { data: rows, error: err } = await query
        if (err) throw new Error(err.message)

        // Return every row under its canonical name
        const mapped = ((rows ?? []) as CAGRRow[]).map(r => ({
          ...r,
          plaza_name: toCanonical[key(r.plaza_name)] ?? r.plaza_name,
        }))
        if (!cancelled) setData(mapped)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [plaza])

  return { data, loading, error }
}
