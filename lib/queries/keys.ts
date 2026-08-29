export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  kasirLists: () => [...productKeys.all, 'kasir', 'list'] as const,
  categories: () => [...productKeys.all, 'categories'] as const,
} as const

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  withCounts: () => [...categoryKeys.all, 'withCounts'] as const,
} as const

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  adminLists: () => [...transactionKeys.all, 'admin', 'list'] as const,
  kasirLists: () => [...transactionKeys.all, 'kasir', 'list'] as const,
  items: (transactionId: string) => [...transactionKeys.all, 'items', transactionId] as const,
} as const

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
} as const

export const profileKeys = {
  all: ['profile'] as const,
  current: () => [...profileKeys.all, 'current'] as const,
} as const

export const restockKeys = {
  all: ['restock'] as const,
  list: (priority?: string, period?: number) => [...restockKeys.all, 'list', priority || 'all', period ?? 30] as const,
  detail: (id: string) => [...restockKeys.all, 'detail', id] as const,
  drafts: () => [...restockKeys.all, 'drafts'] as const,
  suppliers: () => [...restockKeys.all, 'suppliers'] as const,
} as const
