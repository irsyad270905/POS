'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRestock } from '@/lib/queries/restock';
import { Bot, AlertTriangle, Clock, Package, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import Link from 'next/link';

function priorityBadge(priority: string) {
  switch (priority) {
    case 'tinggi':
      return { label: 'Tinggi', bg: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' };
    case 'sedang':
      return { label: 'Sedang', bg: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' };
    case 'rendah':
      return { label: 'Rendah', bg: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)' };
    default:
      return { label: 'Aman', bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' };
  }
}

export default function RestockWidget() {
  const { data, isLoading, isFetching, refetch } = useRestock('all', 30);

  const summary = data?.summary;
  const top = (data?.data || []).filter((d) => d.priority !== 'tidak_perlu').slice(0, 3);

  return (
    <Card className="border overflow-hidden rounded-2xl" style={{ background: 'var(--bg-card)', borderColor: 'rgba(168,85,247,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(168,85,247,0.12)', background: 'rgba(168,85,247,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.25)' }}>
            <Bot className="h-5 w-5" style={{ color: '#c084fc' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" style={{ color: '#c084fc' }} />
              AI Rekomendasi Restock
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isLoading ? 'Menganalisis...' : data ? `${summary?.tinggi ?? 0} perlu segera • ${summary?.sedang ?? 0} perlu diperhatikan` : 'Belum ada data'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/5" onClick={() => refetch()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} style={{ color: '#c084fc' }} />
          </Button>
          <Link href="/admin/restock">
            <Button size="sm" className="h-8 rounded-xl text-xs font-bold gap-1.5" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', color: 'white', border: 'none' }}>
              Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="py-10 flex flex-col items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#c084fc', borderTopColor: 'transparent' }} />
            <span className="text-xs">Menghitung rekomendasi...</span>
          </div>
        ) : top.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2 text-center" style={{ color: 'var(--text-secondary)' }}>
            <Package className="h-8 w-8 opacity-30" style={{ color: '#c084fc' }} />
            <p className="text-sm font-semibold text-white">Stok Aman</p>
            <p className="text-xs max-w-[280px]" style={{ color: 'var(--text-muted)' }}>
              Tidak ada produk yang perlu restock saat ini. AI akan memperbarui saat ada transaksi baru.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Summary pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                <AlertTriangle className="h-3 w-3" /> {summary?.tinggi ?? 0} Tinggi
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }}>
                <Clock className="h-3 w-3" /> {summary?.sedang ?? 0} Sedang
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
                <Package className="h-3 w-3" /> {summary?.rendah ?? 0} Rendah
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(168,85,247,0.06)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                <div className="col-span-5">Produk</div>
                <div className="col-span-2 text-center">Stok</div>
                <div className="col-span-2 text-center">Habis</div>
                <div className="col-span-3 text-right">Rekomendasi</div>
              </div>
              {top.map((r) => {
                const badge = priorityBadge(r.priority);
                return (
                  <Link key={r.product_id} href="/admin/restock" className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-white/[0.03] transition-colors border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="col-span-5 min-w-0">
                      <p className="text-xs font-bold truncate text-white">{r.product_name}</p>
                      <p className="text-[10px] font-mono truncate" style={{ color: '#c084fc' }}>{r.sku}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-xs font-bold" style={{ color: r.priority === 'tinggi' ? '#fca5a5' : 'var(--text-primary)' }}>{r.stock_current}</span>
                      <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>{r.unit}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-xs font-bold" style={{ color: r.days_until_out != null && r.days_until_out <= (r.lead_time_days || 3) ? '#fca5a5' : 'var(--text-secondary)' }}>
                        {r.days_until_out != null ? `${r.days_until_out} hr` : '—'}
                      </span>
                    </div>
                    <div className="col-span-3 text-right flex items-center justify-end gap-2">
                      <span className="text-xs font-black" style={{ color: r.priority === 'tinggi' ? '#fca5a5' : '#6ee7b7' }}>
                        {r.recommended_qty > 0 ? `+${r.recommended_qty}` : '—'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: badge.bg, color: badge.color, border: badge.border }}>
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {data && data.data.length > 3 && (
              <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                +{data.data.filter((d) => d.priority !== 'tidak_perlu').length - 3} produk lain perlu perhatian
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
