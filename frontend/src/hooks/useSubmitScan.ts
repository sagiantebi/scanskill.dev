import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { submitScan } from '../api/client'
import { parseUrlMode } from '../lib/utils'

export function useSubmitScan(getFields: () => { content: string; urlField: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { content, urlField } = getFields()
      const urlTrim = urlField.trim()
      const contentTrim = content.trim()
      const urlMode = parseUrlMode(urlTrim)

      if (urlTrim && !urlMode) {
        throw new Error('Skill URL must be a valid URL')
      }

      let body: Record<string, string | undefined>
      let notice: string | undefined

      if (urlMode) {
        if (contentTrim.length >= 10) {
          notice = 'URL used as source; text field was ignored.'
        }
        body = { sourceType: 'url', url: urlTrim }
      } else {
        body = { sourceType: 'text', content: contentTrim }
      }

      const data = await submitScan(body)
      return { data, notice }
    },
    onSuccess: ({ data, notice }) => {
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
      navigate(`/scan/${data.jobId}`, {
        state: notice ? { notice } : undefined,
        replace: false,
      })
    },
  })
}
