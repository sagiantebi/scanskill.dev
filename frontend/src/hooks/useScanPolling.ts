import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchScan } from '../api/client'
import { isTerminal } from '../lib/utils'

export function useScanPolling(jobId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['scan', jobId],
    queryFn: () => fetchScan(jobId),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const d = q.state.data
      if (!d) return 2000
      return isTerminal(d.status) ? false : 2000
    },
  })

  useEffect(() => {
    if (query.data && isTerminal(query.data.status)) {
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    }
  }, [query.data, queryClient])

  return query
}
