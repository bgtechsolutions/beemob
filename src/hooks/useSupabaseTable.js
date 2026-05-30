import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseTable(tableName, select = '*', orderField = 'created_at') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: err } = await supabase
        .from(tableName)
        .select(select)
        .order(orderField, { ascending: false })
      if (err) throw err
      setData(result || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tableName, select, orderField])

  useEffect(() => { reload() }, [reload])

  return { data, loading, error, reload }
}
