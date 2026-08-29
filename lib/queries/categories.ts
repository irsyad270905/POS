import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { categoryKeys, productKeys } from './keys'

export type Category = { id: string; name: string; created_at: string }

type CategoriesWithCounts = {
  categories: Category[]
  productCounts: Record<string, number>
}

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: async (): Promise<Category[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw new Error(error.message)
      return data || []
    },
  })
}

export function useCategoriesWithCounts() {
  return useQuery({
    queryKey: categoryKeys.withCounts(),
    queryFn: async (): Promise<CategoriesWithCounts> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw new Error(error.message)

      const { data: products, error: prodError } = await supabase.from('products').select('category_id')
      if (prodError) throw new Error(prodError.message)

      const counts: Record<string, number> = {}
      products?.forEach((p) => {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1
      })

      return {
        categories: data || [],
        productCounts: counts,
      }
    },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient()
      const { data, error } = await supabase.from('categories').insert([{ name }]).select().single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase.from('categories').update({ name }).eq('id', id).select().single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}
