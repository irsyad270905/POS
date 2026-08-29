'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Bot, AlertTriangle, Clock, Package, Search, RefreshCw, ShoppingCart, X, Lightbulb, TrendingUp, Layers, Sparkles, CheckCircle2, Plus } from 'lucide-react';
import { useRestock, useDismissRestock, useApproveRestock, useRefreshRestock, useCreateDraft, useSuppliers, useRestockDrafts, type RestockItem } from '@/lib/queries/restock';
import { getCategoryVisual } from '@/lib/categoryVisual';

function priorityConfig(p: string) {
  switch (p) {
    case 'tinggi':
      return { label: 'Tinggi', dot: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', icon: AlertTriangle };
    case 'sedang':
      return { label: 'Sedang', dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d', icon: Clock };
    case 'rendah':
      return { label: 'Rendah', dot: '#10b981', bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', color: '#6ee7b7', icon: Package };
    default:
      return { label: 'Aman', dot: '#64748b', bg: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.2)', color: '#94a3b8', icon: CheckCircle2 };
  }
}

export default function AdminRestockPage() {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RestockItem | null>(null);
  const [editQty, setEditQty] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draftSupplier, setDraftSupplier] = useState<string>('');

  const { data, isLoading, isFetching, refetch } = useRestock(filterPriority === 'all' ? undefined : filterPriority, 30);
  const dismiss = useDismissRestock();
  const approve = useApproveRestock();
  const refresh = useRefreshRestock();
  const createDraft = useCreateDraft();
  const { data: suppliersData } = useSuppliers();
  const { data: draftsData } = useRestockDrafts();

  const suppliers = suppliersData?.data || [];
  const drafts = draftsData?.data || [];

  const filtered = useMemo(() => {
    const list = data?.data || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r) => r.product_name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
  }, [data, search]);

  const needsRestock = (data?.data || []).filter((d) => d.priority !== 'tidak_perlu');
  const summary = data?.summary;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = filtered.filter((r) => r.recommended_qty > 0).map((r) => r.product_id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleIds));
  };

  const handleDismiss = async (item: RestockItem) => {
    const key = (item as RestockItem & { id?: string }).id || item.product_id;
    try {
      await dismiss.mutateAsync(key);
      toast.success(`Rekomendasi ${item.product_name} diabaikan`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleApproveQty = async () => {
    if (!selected) return;
    const qty = Number(editQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Jumlah harus >0');
      return;
    }
    const key = (selected as RestockItem & { id?: string }).id || selected.product_id;
    try {
      await approve.mutateAsync({ id: key, quantity: qty });
      toast.success(`Rekomendasi ${selected.product_name} disetujui: ${qty} ${selected.unit}`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleBulkDraft = async () => {
    const items = filtered.filter((r) => selectedIds.has(r.product_id) && r.recommended_qty > 0);
    if (items.length === 0) {
      toast.error('Pilih minimal 1 produk yang perlu restock');
      return;
    }
    try {
      const payloadItems = items.map((r) => ({ product_id: r.product_id, quantity: r.recommended_qty, product_name: r.product_name }));
      await createDraft.mutateAsync({ supplier_id: draftSupplier || null, batch_id: data?.batch_id, items: payloadItems, notes: `Draft dari AI batch ${data?.batch_id?.slice(0, 8)}` });
      toast.success(`Draft pembelian dibuat: ${items.length} produk`);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSingleDraft = async (item: RestockItem, qtyOverride?: number) => {
    const qty = qtyOverride ?? item.recommended_qty;
    if (qty <= 0) {
      toast.error('Rekomendasi 0, tidak perlu draft');
      return;
    }
    try {
      await createDraft.mutateAsync({
        supplier_id: draftSupplier || null,
        batch_id: data?.batch_id,
        items: [{ product_id: item.product_id, quantity: qty, product_name: item.product_name }],
        notes: `AI restock ${item.product_name}`,
      });
      toast.success(`Draft untuk ${item.product_name} (${qty} ${item.unit}) dibuat`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openDetail = (item: RestockItem) => {
    setSelected(item);
    setEditQty(String(item.recommended_qty));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bot className="h-6 w-6" style={{ color: '#c084fc' }} /> AI Rekomendasi Restock
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Analisis stok + penjualan + lead time + safety stock. Prioritas otomatis.
          </p>
          {data?.generated_at && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Update: {new Date(data.generated_at).toLocaleString('id-ID')} • Batch {data.batch_id.slice(0, 8)} • Periode {data.settings.analysis_period_days} hari
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" className="rounded-xl gap-2 border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }} onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button
            className="rounded-xl gap-2 font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', border: 'none' }}
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <Sparkles className="h-4 w-4" /> {refresh.isPending ? 'Menghitung...' : 'Hitung Ulang AI'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Perlu Segera', value: summary?.tinggi ?? 0, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: AlertTriangle },
          { label: 'Perlu Diperhatikan', value: summary?.sedang ?? 0, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: Clock },
          { label: 'Rendah', value: summary?.rendah ?? 0, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: Package },
          { label: 'Aman', value: summary?.tidak_perlu ?? 0, color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)', icon: CheckCircle2 },
        ].map((c) => (
          <Card key={c.label} className="p-4 rounded-2xl border flex items-center gap-3" style={{ background: 'var(--bg-card)', borderColor: c.border }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <c.icon className="h-5 w-5" style={{ color: c.color }} />
            </div>
            <div>
              <p className="text-2xl font-black" style={{ color: c.color }}>{isLoading ? '—' : c.value}</p>
              <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Draft supplier selector + bulk action */}
      <Card className="p-4 rounded-2xl border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between" style={{ background: 'var(--bg-card)', borderColor: 'rgba(168,85,247,0.15)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Supplier draft:</Label>
            <Select value={draftSupplier} onValueChange={(v) => setDraftSupplier(v || '')}>
              <SelectTrigger className="w-44 h-9 rounded-xl border-0 text-xs" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                <span className="truncate">{draftSupplier ? suppliers.find((s) => s.id === draftSupplier)?.name : 'Otomatis (Umum)'}</span>
              </SelectTrigger>
              <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                <SelectItem value="auto">Otomatis (Umum)</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedIds.size} dipilih</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={selectedIds.size === 0 || createDraft.isPending}
            onClick={handleBulkDraft}
            className="rounded-xl gap-2 font-bold text-white"
            style={{ background: selectedIds.size > 0 ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' : 'var(--bg-surface)', color: selectedIds.size > 0 ? 'white' : 'var(--text-muted)', border: 'none' }}
          >
            <ShoppingCart className="h-4 w-4" /> Buat Draft ({selectedIds.size})
          </Button>
          {drafts.length > 0 && (
            <Badge className="rounded-full" style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)', color: '#c084fc' }}>
              {drafts.length} draft
            </Badge>
          )}
        </div>
      </Card>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <Input placeholder="Cari produk / SKU..." className="pl-10 h-11 rounded-xl border-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v || 'all')}>
          <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl border-0" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
            <span className="truncate">
              {filterPriority === 'all' ? 'Semua Prioritas' : filterPriority === 'tinggi' ? '🔴 Tinggi' : filterPriority === 'sedang' ? '🟠 Sedang' : filterPriority === 'rendah' ? '🟢 Rendah' : 'Aman'}
            </span>
          </SelectTrigger>
          <SelectContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
            <SelectItem value="all">Semua Prioritas</SelectItem>
            <SelectItem value="tinggi">🔴 Tinggi</SelectItem>
            <SelectItem value="sedang">🟠 Sedang</SelectItem>
            <SelectItem value="rendah">🟢 Rendah</SelectItem>
            <SelectItem value="tidak_perlu">Aman / Tidak Perlu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 overflow-hidden rounded-2xl" style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent" style={{ background: 'rgba(168,85,247,0.04)', borderColor: 'var(--border)' }}>
                <TableHead className="w-10 text-center">
                  <input type="checkbox" checked={filtered.filter((r) => r.recommended_qty > 0).length > 0 && filtered.filter((r) => r.recommended_qty > 0).every((r) => selectedIds.has(r.product_id))} onChange={toggleSelectAll} className="rounded" />
                </TableHead>
                <TableHead className="text-xs font-bold uppercase" style={{ color: 'var(--text-secondary)' }}>Produk</TableHead>
                <TableHead className="text-xs font-bold uppercase text-center" style={{ color: 'var(--text-secondary)' }}>Stok</TableHead>
                <TableHead className="text-xs font-bold uppercase text-center" style={{ color: 'var(--text-secondary)' }}>Rata-rata/Hari</TableHead>
                <TableHead className="text-xs font-bold uppercase text-center" style={{ color: 'var(--text-secondary)' }}>Prediksi Habis</TableHead>
                <TableHead className="text-xs font-bold uppercase text-center" style={{ color: 'var(--text-secondary)' }}>Rekomendasi</TableHead>
                <TableHead className="text-xs font-bold uppercase text-center" style={{ color: 'var(--text-secondary)' }}>Prioritas</TableHead>
                <TableHead className="text-xs font-bold uppercase text-center" style={{ color: 'var(--text-secondary)' }}>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-16">
                  <div className="inline-flex p-4 rounded-full mb-3" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid var(--border)' }}><Bot className="h-10 w-10 opacity-40" style={{ color: '#c084fc' }} /></div>
                  <p className="font-bold text-white">Tidak ada rekomendasi</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Coba ubah filter atau hitung ulang AI.</p>
                </TableCell></TableRow>
              ) : (
                filtered.map((r) => {
                  const cfg = priorityConfig(r.priority);
                  const Icon = cfg.icon;
                  const visual = getCategoryVisual(r.category || undefined);
                  const CatIcon = visual.icon;
                  return (
                    <TableRow key={r.product_id} className="group border-b hover:bg-white/[0.02] cursor-pointer" style={{ borderColor: 'var(--border)' }} onClick={() => openDetail(r)}>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(r.product_id)} onChange={() => toggleSelect(r.product_id)} disabled={r.recommended_qty === 0} className="rounded disabled:opacity-30" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: visual.iconBg, border: `1px solid ${visual.iconBorder}` }}>
                            <CatIcon className="h-4 w-4" style={{ color: visual.iconColor }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate text-white">{r.product_name}</p>
                            <p className="text-xs font-mono truncate" style={{ color: '#c084fc' }}>{r.sku} • {r.unit}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-white">{r.stock_current}</span>
                        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>/ min {r.stock_minimum}</span>
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold" style={{ color: r.avg_daily > 2 ? '#c084fc' : 'var(--text-secondary)' }}>
                        {r.avg_daily.toFixed(1)}
                        <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/hr</span>
                        <span className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>7d:{r.avg_daily_7} 30d:{r.avg_daily_30}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: r.days_until_out != null && r.days_until_out <= r.lead_time_days ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.1)', border: `1px solid ${r.days_until_out != null && r.days_until_out <= r.lead_time_days ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`, color: r.days_until_out != null && r.days_until_out <= r.lead_time_days ? '#fca5a5' : 'var(--text-secondary)' }}>
                          {r.days_until_out != null ? `${r.days_until_out} hari` : '—'}
                        </span>
                        <span className="block text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>lead {r.lead_time_days}h • safety {r.safety_stock}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.recommended_qty > 0 ? (
                          <span className="font-black text-sm px-2.5 py-1 rounded-full" style={{ background: cfg.bg, border: cfg.border, color: cfg.color }}>
                            +{r.recommended_qty}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tidak perlu</span>
                        )}
                        <span className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>target {r.target_stock}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: cfg.bg, border: cfg.border, color: cfg.color }}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-bold hover:bg-white/5" style={{ color: '#c084fc' }} onClick={() => openDetail(r)}>Detail</Button>
                          {r.recommended_qty > 0 && (
                            <Button size="sm" className="h-8 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }} onClick={() => handleSingleDraft(r)}>Buat Draft</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Draft list */}
      {drafts.length > 0 && (
        <Card className="p-5 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'rgba(168,85,247,0.12)' }}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4" style={{ color: '#c084fc' }} /> Draft Pembelian Terbaru
          </h3>
          <div className="space-y-2">
            {drafts.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div>
                  <p className="text-xs font-bold text-white">{d.supplier_name || 'Supplier Umum'} • {d.status}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(d.items as unknown as Array<Record<string, unknown>>)?.length || 0} item • {new Date(d.created_at).toLocaleString('id-ID')}</p>
                </div>
                <Badge className="rounded-full text-xs" style={{ background: d.status === 'draft' ? 'rgba(168,85,247,0.12)' : 'rgba(16,185,129,0.12)', border: `1px solid ${d.status === 'draft' ? 'rgba(168,85,247,0.2)' : 'rgba(16,185,129,0.2)'}`, color: d.status === 'draft' ? '#c084fc' : '#6ee7b7' }}>{d.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
          {selected && (() => {
            const cfg = priorityConfig(selected.priority);
            const Icon = cfg.icon;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white font-bold flex items-center gap-2">
                    <Bot className="h-5 w-5" style={{ color: '#c084fc' }} /> Analisis Restock
                  </DialogTitle>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Detail perhitungan sesuai SRS 2.7</p>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <h3 className="font-black text-white flex items-center gap-2">{selected.product_name} <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}>{selected.sku}</span></h3>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Stok saat ini</span><span className="font-bold text-white">{selected.stock_current} {selected.unit}</span></div>
                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Stok minimum</span><span className="font-bold">{selected.stock_minimum}</span></div>
                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Rata-rata 7h / 30h</span><span className="font-bold">{selected.avg_daily_7} / {selected.avg_daily_30} /hr</span></div>
                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Rata-rata tertimbang</span><span className="font-bold" style={{ color: '#c084fc' }}>{selected.avg_daily} /hr</span></div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Lead time</span><span className="font-bold">{selected.lead_time_days} hari</span></div>
                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Safety stock</span><span className="font-bold">{selected.safety_stock} {selected.unit}</span></div>
                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Reorder point</span><span className="font-bold">{selected.reorder_point}</span></div>
                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Prediksi habis</span><span className="font-bold" style={{ color: selected.days_until_out != null && selected.days_until_out <= selected.lead_time_days ? '#fca5a5' : '#6ee7b7' }}>{selected.days_until_out != null ? `±${selected.days_until_out} hari` : '—'}</span></div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Target stok</span>
                      <span className="font-black" style={{ color: '#c084fc' }}>{selected.target_stock} {selected.unit}</span>
                    </div>
                  </div>

                  <div className="rounded-xl p-4 text-center" style={{ background: cfg.bg, border: cfg.border }}>
                    <p className="text-xs font-bold flex items-center justify-center gap-1.5" style={{ color: cfg.color }}><Lightbulb className="h-4 w-4" /> Rekomendasi AI</p>
                    <p className="text-3xl font-black mt-1" style={{ color: cfg.color }}>{selected.recommended_qty > 0 ? `+${selected.recommended_qty} ${selected.unit.toUpperCase()}` : 'TIDAK PERLU'}</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-2" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${cfg.color}40`, color: cfg.color }}>
                      <Icon className="h-3 w-3" /> {cfg.label.toUpperCase()}
                    </span>
                    <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{selected.reason}</p>
                    {selected.insight && selected.insight !== selected.reason && (
                      <p className="text-xs mt-2 p-2 rounded-lg flex gap-2 text-left" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#c084fc' }} /> {selected.insight}
                      </p>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <TrendingUp className="h-3 w-3" /> Terjual 7h: {selected.sold_7} • 30h: {selected.sold_30} {selected.unit}
                    </div>
                  </div>

                  {selected.recommended_qty > 0 && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold shrink-0" style={{ color: 'var(--text-secondary)' }}>Edit qty:</Label>
                      <Input type="number" min={1} value={editQty} onChange={(e) => setEditQty(e.target.value)} className="h-9 rounded-xl border-0 flex-1" style={{ background: 'var(--bg-card)', color: 'white', boxShadow: 'inset 0 0 0 1px var(--border)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{selected.unit}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="ghost" className="flex-1 rounded-xl hover:bg-white/5" style={{ color: 'var(--text-secondary)' }} onClick={() => handleDismiss(selected)} disabled={dismiss.isPending}>
                      <X className="h-4 w-4 mr-1" /> Abaikan
                    </Button>
                    {selected.recommended_qty > 0 ? (
                      <Button className="flex-1 rounded-xl font-bold text-white gap-2" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }} onClick={handleSingleDraft.bind(null, selected, Number(editQty) || selected.recommended_qty)} disabled={createDraft.isPending}>
                        <ShoppingCart className="h-4 w-4" /> Buat Draft
                      </Button>
                    ) : (
                      <Button className="flex-1 rounded-xl font-bold" variant="ghost" disabled style={{ color: 'var(--text-muted)' }}>Tidak perlu aksi</Button>
                    )}
                  </div>

                  {selected.recommended_qty > 0 && Number(editQty) !== selected.recommended_qty && Number(editQty) > 0 && (
                    <Button variant="ghost" className="w-full rounded-xl text-xs" style={{ color: '#c084fc' }} onClick={handleApproveQty} disabled={approve.isPending}>
                      Simpan qty {editQty} & tandai disetujui
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
