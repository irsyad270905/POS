import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { profileKeys } from './keys'

export type Profile = {
  role: string | null
  full_name: string | null
  email?: string
}

export function useCurrentProfile() {
  return useQuery({
    queryKey: profileKeys.current(),
    queryFn: async (): Promise<Profile | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (error) throw new Error(error.message)
      return {
        role: data.role,
        full_name: data.full_name || user.email?.split('@')[0] || 'User',
        email: user.email ?? undefined,
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
