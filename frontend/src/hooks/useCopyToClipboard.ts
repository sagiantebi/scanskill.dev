import { useCallback, useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'error'

export function useCopyToClipboard() {
  const [state, setState] = useState<CopyState>('idle')

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }, [])

  return { copyState: state, copy } as const
}
