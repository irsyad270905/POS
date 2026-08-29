'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Tags } from 'lucide-react'
import { useCategoriesWithCounts, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/lib/queries/categories'

export default function AdminCategoriesPage() {
  const { data, isLoading } = useCategoriesWithCounts()
  const categories = data?.categories ?? []
  const productCounts = data?.productCounts ?? {}
  const loading = isLoading

  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')

  const resetForm = () => { setName(''); setEditingId(null) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, name })
        toast.success('Kategori diperbarui')
      } else {
        await createCategory.mutateAsync(name)
        toast.success('Kategori ditambahkan')
      }
      setIsOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (id: string, catName: string) => {
    if (productCounts[id] > 0) {
      toast.error(`Tidak bisa hapus "${catName}" — masih ada ${productCounts[id]} produk terkait`)
      return
    }
    if (!confirm(`Hapus kategori "${catName}"?`)) return
    try {
      await deleteCategory.mutateAsync(id)
      toast.success('Kategori dihapus')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const isSaving = createCategory.isPending || updateCategory.isPending

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
          <DialogContent className="sm:max-w-sm rounded-2xl border-0 shadow-2xl" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
            <DialogHeader>
              <DialogTitle className="text-white font-bold">{editingId ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-[var(--text-secondary)]">Nama Kategori</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Minuman" autoFocus className="rounded-xl h-11 border-0" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} />
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" className="rounded-xl text-slate-200 hover:text-white hover:bg-white/5 border-0" style={{ background: 'var(--bg-card)' }} onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit" className="btn-primary text-white font-bold px-5 rounded-xl" disabled={isSaving}>{isSaving ? 'Menyimpan...' : (editingId ? 'Simpan' : 'Tambah')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden rounded-2xl shadow-lg" style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 0 0 1px var(--border)' }}>
        <Table>
          <TableHeader>
            <TableRow className="border-b hover:bg-transparent" style={{ background: 'rgba(255,107,53,0.04)', borderColor: 'var(--border)' }}>
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
                  <div className="inline-flex p-4 rounded-full mb-3" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid var(--border)' }}>
                    <Tags className="h-14 w-14 text-[var(--text-secondary)] opacity-40" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Kategori Masih Kosong</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Belum ada kategori terdaftar.</p>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id} className="group border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--border)' }}>
                  <TableCell className="font-bold text-base text-slate-100 pl-4">{c.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,107,53,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(255,107,53,0.2)' }}>
                      {productCounts[c.id] || 0} produk
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--info)] hover:text-white hover:bg-[var(--info)]/20 transition-all rounded-lg active:scale-90 border-0"
                        onClick={() => { setName(c.name); setEditingId(c.id); setIsOpen(true) }}
                        title="Edit Kategori"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--danger)] hover:text-white hover:bg-[var(--danger)]/20 transition-all rounded-lg active:scale-90 border-0"
                        onClick={() => handleDelete(c.id, c.name)}
                        title="Hapus Kategori"
                        disabled={deleteCategory.isPending}
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
