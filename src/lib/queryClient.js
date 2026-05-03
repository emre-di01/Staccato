import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,   // 3 Minuten: Daten gelten als frisch
      gcTime:    1000 * 60 * 10,  // 10 Minuten: Cache bleibt im Speicher
      retry: 1,
      refetchOnWindowFocus: false, // kein Re-fetch beim Tab-Wechsel
    },
  },
})
