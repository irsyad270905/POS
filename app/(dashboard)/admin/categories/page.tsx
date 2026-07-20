'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Tags } from 'lucide-react'

type Category = { id: string; name: string; created_at: string }

export default function AdminCategoriesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [productCounts, setProductCounts] = useState<Record<string, number>>({})

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])

    const { data: products } = await supabase.from('products').select('category_id')
    const counts: Record<string, number> = {}
    products?.forEach(p => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1
    })
    setProductCounts(counts)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    let active = true
    setTimeout(() => {
      if (active) fetchCategories()
    }, 0)
    return () => { active = false }
  }, [fetchCategories])

  const resetForm = () => { setName(''); setEditingId(null) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      const { error } = await supabase.from('categories').update({ name }).eq('id', editingId)
      if (error) { toast.error(error.message); return }
      toast.success('Kategori diperbarui')
    } else {
      const { error } = await supabase.from('categories').insert([{ name }])
      if (error) { toast.error(error.message); return }
      toast.success('Kategori ditambahkan')
    }
    setIsOpen(false); fetchCategories()
  }

  const handleDelete = async (id: string, catName: string) => {
    if (productCounts[id] > 0) {
      toast.error(`Tidak bisa hapus "${catName}" — masih ada ${productCounts[id]} produk terkait`)
      return
    }
    if (!confirm(`Hapus kategori "${catName}"?`)) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Kategori dihapus'); fetchCategories() }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Kategori Produk</h1>
          <p className="text-sm text-[var(--text-secondary)]">Kelompokkan produk Anda berdasarkan kategori.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm() }}>
          <DialogTrigger render={
            <Button className="gap-2 shadow-lg btn-primary text-white transition-all active:scale-95 border-0 rounded-xl px-4 h-11 text-sm font-bold">
              <Plus className="h-4 w-4" /> Tambah Kategori
            </Button>
          } />
          <DialogContent className="sm:max-w-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white font-bold">{editingId ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-[var(--text-secondary)]">Nama Kategori</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Minuman" autoFocus className="bg-[var(--bg-base)] border-[var(--border)] rounded-xl" />
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" className="border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-slate-200 rounded-xl" onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit" className="btn-primary text-white font-bold px-5 rounded-xl">{editingId ? 'Simpan' : 'Tambah'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-[var(--border)] shadow-md overflow-hidden bg-[var(--bg-card)]/50 backdrop-blur-sm rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--bg-card)] border-b border-[var(--border)]">
              <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Nama Kategori</TableHead>
              <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-center">Jumlah Produk</TableHead>
              <TableHead className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-center w-[120px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-[var(--text-secondary)] font-semibold">Memuat...</TableCell></TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-16">
                  <div className="inline-flex p-4 rounded-full bg-slate-800/30 border border-slate-700/30 shadow-inner mb-3">
                    <Tags className="h-14 w-14 text-[var(--text-secondary)] opacity-40" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Kategori Masih Kosong</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Belum ada kategori terdaftar.</p>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id} className="group hover:bg-[var(--bg-card-hover)]/30 transition-colors border-b border-[var(--border)] even:bg-[var(--bg-card)]/10">
                  <TableCell className="font-bold text-base text-slate-100 pl-4">{c.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-xs font-semibold px-2.5 py-0.5 rounded-lg">
                      {productCounts[c.id] || 0} produk
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--info)] hover:text-white hover:bg-[var(--info)]/20 transition-all rounded-lg active:scale-90 border border-transparent hover:border-[var(--info)]/30"
                        onClick={() => { setName(c.name); setEditingId(c.id); setIsOpen(true) }}
                        title="Edit Kategori"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--danger)] hover:text-white hover:bg-[var(--danger)]/20 transition-all rounded-lg active:scale-90 border border-transparent hover:border-[var(--danger)]/30"
                        onClick={() => handleDelete(c.id, c.name)}
                        title="Hapus Kategori"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
