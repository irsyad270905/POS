'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => { fetchCategories() }, [])

  const fetchCategories = async () => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])

    // Get product count per category
    const { data: products } = await supabase.from('products').select('category_id')
    const counts: Record<string, number> = {}
    products?.forEach(p => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1
    })
    setProductCounts(counts)
    setLoading(false)
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Kategori Produk</h1>
          <p className="text-muted-foreground">Kelompokkan produk Anda berdasarkan kategori.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm() }}>
          <DialogTrigger render={
            <Button className="gap-2 shadow-lg shadow-primary/20"><Plus className="h-4 w-4" /> Tambah Kategori</Button>
          } />
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Kategori</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Minuman" autoFocus />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit">{editingId ? 'Simpan' : 'Tambah'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50/50 dark:bg-zinc-800/30">
              <TableHead>Nama Kategori</TableHead>
              <TableHead className="text-center">Jumlah Produk</TableHead>
              <TableHead className="text-center w-[120px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-16">
                  <Tags className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">Belum ada kategori</p>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20">
                  <TableCell className="font-medium text-base">{c.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{productCounts[c.id] || 0} produk</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => { setName(c.name); setEditingId(c.id); setIsOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDelete(c.id, c.name)}>
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
