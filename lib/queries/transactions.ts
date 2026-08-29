import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { dashboardKeys, productKeys, transactionKeys } from './keys'

export type AdminTransaction = {
  id: string
  invoice_number: string
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_method: string
  amount_paid: number
  change_amount: number
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

export type KasirTransaction = {
  id: string
  invoice_number: string
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_method: string
  amount_paid: number
  change_amount: number
  created_at: string
}

export type TransactionItem = {
  id: string
  product_name: string
  quantity: number
  price_at_time: number
  product_id?: string | null
  transaction_id?: string
}

export type BulkTransactionItem = {
  id: string
  transaction_id: string
  product_id: string | null
  product_name: string
  quantity: number
  price_at_time: number
}

export function useAdminTransactions() {
  return useQuery({
    queryKey: transactionKeys.adminLists(),
    queryFn: async (): Promise<AdminTransaction[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('transactions')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data as unknown as AdminTransaction[]) || []
    },
  })
}

export function useKasirTransactions() {
  return useQuery({
    queryKey: transactionKeys.kasirLists(),
    queryFn: async (): Promise<KasirTransaction[]> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('cashier_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data || []
    },
  })
}

export function useTransactionItems(transactionId: string | null) {
  return useQuery({
    queryKey: transactionId ? transactionKeys.items(transactionId) : ['transactions', 'items', 'disabled'],
    queryFn: async (): Promise<TransactionItem[]> => {
      if (!transactionId) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('transaction_id', transactionId)
      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: !!transactionId,
  })
}

export function useBulkTransactionItems(transactionIds: string[]) {
  const sortedKey = [...transactionIds].sort().join(',')
  return useQuery({
    queryKey: ['transactions', 'items', 'bulk', sortedKey],
    queryFn: async (): Promise<BulkTransactionItem[]> => {
      if (transactionIds.length === 0) return []
      const supabase = createClient()
      // Supabase .in() has limit ~1000, chunk if needed
      const chunkSize = 900
      const chunks: BulkTransactionItem[][] = []
      for (let i = 0; i < transactionIds.length; i += chunkSize) {
        const chunk = transactionIds.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('transaction_items')
          .select('id, transaction_id, product_id, product_name, quantity, price_at_time')
          .in('transaction_id', chunk)
        if (error) throw new Error(error.message)
        chunks.push((data as BulkTransactionItem[]) || [])
      }
      return chunks.flat()
    },
    enabled: transactionIds.length > 0,
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('delete_transaction', { p_transaction_id: id })
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export type CheckoutPayload = {
  items: { product_id: string; quantity: number }[]
  payment_method: string
  amount_paid: number
}

export type CheckoutResult = {
  transaction_id: string
  invoice_number: string
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_method: string
  amount_paid: number
  change_amount: number
  created_at: string
}

export function useCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CheckoutPayload): Promise<CheckoutResult> => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('process_checkout', {
        p_items: payload.items,
        p_payment_method: payload.payment_method,
        p_amount_paid: payload.amount_paid,
      })
      if (error) throw new Error(error.message)
      return {
        transaction_id: data.transaction_id,
        invoice_number: data.invoice_number,
        subtotal: Number(data.subtotal),
        tax_amount: Number(data.tax_amount),
        total_amount: Number(data.total_amount),
        payment_method: data.payment_method,
        amount_paid: Number(data.amount_paid),
        change_amount: Number(data.change_amount),
        created_at: data.created_at,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
