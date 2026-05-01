'use client';

import { useEffect, useMemo, useState } from 'react';
import LineWaveChart from './components/LineWaveChart';

type DomainStat = {
  domain: string;
  total: number;
  search_total: number; google: number; bing: number; yandex: number; search_other: number;
  search_visitors: number;
  direct: number; social: number; referral: number; bot: number;
};
type Stats = {
  global: {
    total: number; visitors: number;
    search_total: number; google: number; bing: number; yandex: number; search_other: number;
    google_visitors: number; bing_visitors: number; yandex_visitors: number;
    direct: number; social: number; referral: number; bot: number; verified: number;
  };
  domains: DomainStat[];
};
type SeriesPoint = {
  ts: string;
  google: number; bing: number; yandex: number; search_other: number;
  direct: number; social: number; referral: number; bot: number;
};
type Breakdown = {
  searchLandings:  { domain: string; path: string; source: string; cnt: number }[];
  searchReferrers: { referrer: string; source: string; cnt: number }[];
  otherReferrers:  { referrer: string; source: string; cnt: number }[];
  topPaths:        { domain: string; path: string; cnt: number; search_cnt: number }[];
  ipBreakdown:     { ip: string; cnt: number; search_cnt: number; bot_cnt: number; verified: boolean }[];
  hourlyHeatmap:   { dow: number; hour: number; search: number; direct: number }[];
};

const RANGES = [
  { id: '24h', label: 'Son 24 Saat' },
  { id: '7d',  label: 'Son 7 Gün' },
  { id: '30d', label: 'Son 30 Gün' },
  { id: '90d', label: 'Son 90 Gün' },
];

export default function Dashboard() {
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [series,    setSeries]    = useState<SeriesPoint[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [range,     setRange]     = useState('30d');
  const [domain,    setDomain]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showOther, setShowOther] = useState(false);

  function load() {
    const qs = new URLSearchParams({ range });
    if (domain) qs.set('domain', domain);
    return Promise.all([
      fetch('/api/stats',                       { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/timeseries?${qs.toString()}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/breakdown?${qs.toString()}`,  { cache: 'no-store' }).then(r => r.json()),
    ]);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    load().then(([s, t, b]) => {
      if (cancelled) return;
      if (s.error || t.error || b.error) {
        setError(s.error || t.error || b.error); setLoading(false); return;
      }
      setStats(s); setSeries(t.points || []); setBreakdown(b); setLoading(false);
    }).catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [range, domain]);

  useEffect(() => {
    const id = setInterval(() => {
      load().then(([s, t, b]) => {
        if (s.error || t.error || b.error) return;
        setStats(s); setSeries(t.points || []); setBreakdown(b);
      }).catch(()=>{});
    }, 30000);
    return () => clearInterval(id);
  }, [range, domain]);

  // ── Series ─────────────────────────────────────────────────────────────
  const xLabels = useMemo(() => series.map(p => fmtTick(p.ts, range)), [series, range]);

  // PRIMARY chart: Google / Bing / Yandex / Other search
  const searchSeries = useMemo(() => ([
    { label: 'Google',  color: '#4285F4', values: series.map(p => p.google) },
    { label: 'Bing',    color: '#00A4EF', values: series.map(p => p.bing) },
    { label: 'Yandex',  color: '#FFCC00', values: series.map(p => p.yandex) },
    { label: 'Diğer Arama (DDG/Yahoo/Brave)', color: '#a78bfa', values: series.map(p => p.search_other) },
  ]), [series]);

  // SECONDARY chart: other traffic
  const otherSeries = useMemo(() => ([
    { label: 'Direkt',   color: '#06b6d4', values: series.map(p => p.direct) },
    { label: 'Sosyal',   color: '#10b981', values: series.map(p => p.social) },
    { label: 'Referans', color: '#f59e0b', values: series.map(p => p.referral) },
    { label: 'Bot',      color: '#ef4444', values: series.map(p => p.bot) },
  ]), [series]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 selection:bg-cyan-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight">
              Search Engine <span className="font-bold text-cyan-400">Analytics</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Birincil metrik: Google, Bing, Yandex'ten gelen organik tıklamalar · 30 sn'de bir güncellenir
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={domain} onChange={e => setDomain(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">Tüm Siteler</option>
              {stats?.domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
            </select>
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
              {RANGES.map(r => (
                <button
                  key={r.id} onClick={() => setRange(r.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    range === r.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}>{r.label}</button>
              ))}
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
            Hata: {error}
          </div>
        )}

        {/* PRIMARY: SEARCH ENGINE CLICKS */}
        <section className="bg-gradient-to-br from-cyan-950/40 via-slate-900/50 to-slate-900/50 border border-cyan-500/20 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-block bg-cyan-500/20 text-cyan-300 text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full">
              ⭐ Birincil Metrik · Organik Arama Tıklamaları
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div className="md:col-span-2 bg-slate-950/50 border border-cyan-500/30 p-6 rounded-xl">
              <p className="text-xs uppercase tracking-widest text-cyan-400 mb-2">Toplam Arama Tıklaması</p>
              <p className="text-6xl font-light text-white">
                {loading ? '—' : (stats?.global.search_total ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                {stats ? `${(stats.global.google_visitors + stats.global.bing_visitors + stats.global.yandex_visitors).toLocaleString()} tekil ziyaretçi` : ''}
              </p>
            </div>
            <SearchEngineCard label="Google"  value={stats?.global.google}       visitors={stats?.global.google_visitors}  color="#4285F4" loading={loading} />
            <SearchEngineCard label="Bing"    value={stats?.global.bing}         visitors={stats?.global.bing_visitors}    color="#00A4EF" loading={loading} />
            <SearchEngineCard label="Yandex"  value={stats?.global.yandex}       visitors={stats?.global.yandex_visitors}  color="#FFCC00" loading={loading} />
          </div>
        </section>

        {/* PRIMARY chart */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <header className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium flex items-center gap-3">
              <span className="w-8 h-[2px] bg-cyan-500 block"></span>
              Arama Motoru Tıklamaları · Zaman Serisi
            </h2>
            <span className="text-xs text-slate-500">{rangeDescription(range)}</span>
          </header>
          {loading ? <SkeletonChart /> : (
            stats && stats.global.search_total === 0
              ? <EmptyState text="Bu aralıkta arama motorundan tıklama yok. Search Console'a sitemap göndererek başlatabilirsin." />
              : <LineWaveChart labels={xLabels} series={searchSeries} height={320} />
          )}
        </section>

        {/* PRIMARY: per-domain search performance */}
        <section>
          <h2 className="text-lg font-medium flex items-center gap-3 mb-4">
            <span className="w-8 h-[2px] bg-cyan-500 block"></span>
            Domain Bazında Arama Performansı
          </h2>
          {loading ? <SkeletonGrid /> : (
            !stats || stats.domains.length === 0
              ? <EmptyState text="Henüz veri yok." />
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.domains.map(d => <DomainSearchCard key={d.domain} d={d} />)}
                </div>
              )
          )}
        </section>

        {/* PRIMARY: top landing pages from search */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-medium flex items-center gap-3 mb-4">
            <span className="w-8 h-[2px] bg-cyan-500 block"></span>
            Aramadan En Çok Tıklanan Sayfalar
          </h2>
          {loading || !breakdown ? <SkeletonChart /> : <SearchLandingsTable rows={breakdown.searchLandings} />}
        </section>

        {/* PRIMARY: search referer URLs */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-medium flex items-center gap-3 mb-4">
            <span className="w-8 h-[2px] bg-cyan-500 block"></span>
            Tam Arama Motoru Yönlendirici URL'leri
          </h2>
          <p className="text-xs text-slate-500 mb-4">Bazıları sorgu kelimesini içerebilir (özellikle Yandex/Bing).</p>
          {loading || !breakdown ? <SkeletonChart /> : <ReferrersTable rows={breakdown.searchReferrers} />}
        </section>

        {/* PRIMARY: hourly heatmap */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-medium flex items-center gap-3 mb-4">
            <span className="w-8 h-[2px] bg-fuchsia-500 block"></span>
            Saat × Gün Aktivite · Sadece Arama Tıklamaları
          </h2>
          {loading || !breakdown ? <SkeletonChart /> : <Heatmap data={breakdown.hourlyHeatmap.map(h => ({ ...h, value: h.search }))} />}
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* SECONDARY: filtered out (other traffic)                         */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="border-t border-slate-800 pt-6">
          <button
            onClick={() => setShowOther(!showOther)}
            className="w-full flex items-center justify-between bg-slate-900/30 border border-slate-800 rounded-xl px-5 py-4 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="text-slate-500 text-2xl">{showOther ? '▾' : '▸'}</span>
              <div>
                <h2 className="text-base font-medium text-slate-300">Diğer Trafik (Filtrelenmiş)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direkt ziyaret · Sosyal · Referans linkler · Bot taramaları — birincil rapora dahil değil
                </p>
              </div>
            </div>
            {stats && (
              <div className="flex gap-3 text-xs text-slate-400 flex-wrap">
                <span><span className="text-cyan-400 font-bold">{stats.global.direct}</span> direkt</span>
                <span><span className="text-emerald-400 font-bold">{stats.global.social}</span> sosyal</span>
                <span><span className="text-amber-400 font-bold">{stats.global.referral}</span> referans</span>
                <span><span className="text-rose-400 font-bold">{stats.global.bot}</span> bot</span>
              </div>
            )}
          </button>

          {showOther && (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SmallStat label="Direkt Ziyaret"     value={stats?.global.direct}   color="cyan"    desc="Referrer yok / yer imi / direkt yazma" />
                <SmallStat label="Sosyal"             value={stats?.global.social}   color="emerald" desc="Twitter/X, Facebook, IG, Reddit, vb." />
                <SmallStat label="Diğer Referans"     value={stats?.global.referral} color="amber"   desc="Başka sitelerden gelen linkler" />
                <SmallStat label="Bot Taraması"       value={stats?.global.bot}      color="rose"    desc="UA pattern + header eksikliği" />
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-medium mb-3 text-slate-300">Diğer Trafik · Zaman Serisi</h3>
                {loading ? <SkeletonChart /> : <LineWaveChart labels={xLabels} series={otherSeries} height={260} />}
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-medium mb-3 text-slate-300">Sosyal & Referans Yönlendirici URL'ler</h3>
                {breakdown && breakdown.otherReferrers.length > 0
                  ? <ReferrersTable rows={breakdown.otherReferrers} />
                  : <EmptyState text="Diğer kaynaklardan kayıt yok." />}
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-medium mb-3 text-slate-300">Top IP'ler (tüm trafik)</h3>
                {breakdown ? <IpsTable rows={breakdown.ipBreakdown} /> : <SkeletonChart />}
              </div>
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-slate-600 py-6">
          {stats ? `${stats.global.search_total} arama tıklaması · ${stats.global.total} toplam istek` : ''}
          · {new Date().toLocaleString('tr-TR')}
        </footer>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmtTick(iso: string, range: string) {
  const d = new Date(iso);
  if (range === '24h') return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}
function rangeDescription(r: string) { return r === '24h' ? 'Saatlik bucket' : 'Günlük bucket'; }

// ─── Components ─────────────────────────────────────────────────────────────
function SearchEngineCard({ label, value, visitors, color, loading }: { label: string; value?: number; visitors?: number; color: string; loading: boolean }) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }}></span>
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{label}</p>
      </div>
      <p className="text-3xl font-light text-white">{loading ? '—' : (value ?? 0).toLocaleString()}</p>
      <p className="text-xs text-slate-500 mt-1">{visitors !== undefined ? `${visitors} ziyaretçi` : ''}</p>
    </div>
  );
}

function SmallStat({ label, value, desc, color }: { label: string; value?: number; desc?: string; color: 'cyan'|'emerald'|'amber'|'rose' }) {
  const colorMap = { cyan:'text-cyan-300', emerald:'text-emerald-300', amber:'text-amber-300', rose:'text-rose-300' } as const;
  return (
    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
      <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-light ${colorMap[color]}`}>{(value ?? 0).toLocaleString()}</p>
      {desc && <p className="text-[11px] text-slate-600 mt-1 leading-tight">{desc}</p>}
    </div>
  );
}

function DomainSearchCard({ d }: { d: DomainStat }) {
  const search = d.search_total || 0;
  const max = Math.max(d.google, d.bing, d.yandex, d.search_other, 1);
  return (
    <div className="bg-slate-900 border border-slate-800/50 p-5 rounded-xl hover:border-cyan-500/40 transition-colors">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="text-base font-semibold text-white truncate">{d.domain}</h3>
        <span className="text-xs text-slate-500">{search} arama / {d.total} toplam</span>
      </div>
      <div className="space-y-2 mb-3">
        <Bar label="Google"  value={d.google}       max={max} color="#4285F4" />
        <Bar label="Bing"    value={d.bing}         max={max} color="#00A4EF" />
        <Bar label="Yandex"  value={d.yandex}       max={max} color="#FFCC00" />
        <Bar label="Diğer"   value={d.search_other} max={max} color="#a78bfa" />
      </div>
      <div className="flex justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
        <span>{d.search_visitors} arama ziyaretçisi</span>
        <span className="text-rose-400">{d.bot} bot</span>
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span><span className="font-mono">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${(value/max)*100}%`, background: color }}></div>
      </div>
    </div>
  );
}

function SearchLandingsTable({ rows }: { rows: Breakdown['searchLandings'] }) {
  if (!rows.length) return <EmptyState text="Aramadan henüz tıklama yok." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500 uppercase tracking-wider">
          <tr><th className="py-2">Domain</th><th>Sayfa</th><th>Kaynak</th><th className="text-right">Tıklama</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r,i) => (
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="py-2 text-cyan-400 font-mono text-xs">{r.domain}</td>
              <td className="py-2 text-xs text-slate-300 font-mono truncate max-w-md">{r.path}</td>
              <td className="py-2"><SourceBadge source={r.source} /></td>
              <td className="py-2 text-right font-semibold">{r.cnt.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferrersTable({ rows }: { rows: { referrer: string; source: string; cnt: number }[] }) {
  if (!rows.length) return <EmptyState text="Veri yok." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500 uppercase tracking-wider">
          <tr><th className="py-2">Yönlendirici URL</th><th>Kaynak</th><th className="text-right">Sayı</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r,i) => (
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="py-2 text-xs text-slate-300 font-mono truncate max-w-2xl" title={r.referrer}>{r.referrer}</td>
              <td className="py-2"><SourceBadge source={r.source} /></td>
              <td className="py-2 text-right font-semibold">{r.cnt.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IpsTable({ rows }: { rows: Breakdown['ipBreakdown'] }) {
  if (!rows.length) return <EmptyState text="Veri yok." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="py-2">IP / Hash</th>
            <th className="text-right">Toplam</th>
            <th className="text-right">Aramadan</th>
            <th className="text-right">Bot</th>
            <th>Etiket</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r,i)=>{
            const pureBot = r.bot_cnt > 0 && r.bot_cnt === r.cnt;
            const fromSearch = r.search_cnt > 0;
            return (
              <tr key={i} className="hover:bg-slate-800/30">
                <td className="py-2 font-mono text-xs text-slate-200">{r.ip}</td>
                <td className="text-right font-semibold">{r.cnt.toLocaleString()}</td>
                <td className="text-right text-cyan-300">{r.search_cnt.toLocaleString()}</td>
                <td className="text-right text-rose-400">{r.bot_cnt.toLocaleString()}</td>
                <td>
                  {r.verified   ? <Badge color="emerald" text="✓ İNSAN (JS)" /> :
                   fromSearch   ? <Badge color="cyan"    text="ARAMA TIKLAMASI" /> :
                   pureBot      ? <Badge color="rose"    text="🤖 BOT" /> :
                                  <Badge color="amber"   text="DİĞER" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Heatmap({ data }: { data: { dow: number; hour: number; value: number }[] }) {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let max = 0;
  for (const c of data) {
    if (c.dow >= 0 && c.dow < 7 && c.hour >= 0 && c.hour < 24) {
      grid[c.dow][c.hour] = c.value;
      if (c.value > max) max = c.value;
    }
  }
  const dayNames = ['Paz','Pzt','Sal','Çar','Per','Cum','Cts'];
  if (max === 0) return <EmptyState text="Aramadan tıklama yok." />;
  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: '3px' }}>
        <thead>
          <tr>
            <th className="w-10"></th>
            {Array.from({length:24},(_,h)=>(
              <th key={h} className="text-[10px] text-slate-500 font-normal w-6">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, dow) => (
            <tr key={dow}>
              <th className="text-xs text-slate-400 font-normal text-right pr-2">{dayNames[dow]}</th>
              {row.map((v, h) => {
                const intensity = Math.sqrt(v / max);
                return (
                  <td key={h} title={`${dayNames[dow]} ${h}:00 · ${v} tıklama`}
                      style={{
                        background: v ? `rgba(6, 182, 212, ${0.12 + intensity * 0.8})` : 'rgba(30, 41, 59, 0.6)',
                        width: 22, height: 22, borderRadius: 4,
                      }} />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
        <span>Az</span>
        {Array.from({length:6},(_,i)=>(
          <span key={i} style={{ width: 16, height: 16, borderRadius: 4, background: `rgba(6, 182, 212, ${0.12 + (i/5) * 0.8})` }} />
        ))}
        <span>Çok ({max} tıklama/saat)</span>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    google:       { color: '#4285F4', bg: 'rgba(66, 133, 244, 0.15)', label: 'Google' },
    bing:         { color: '#00A4EF', bg: 'rgba(0, 164, 239, 0.15)',  label: 'Bing'   },
    yandex:       { color: '#FFCC00', bg: 'rgba(255, 204, 0, 0.15)',  label: 'Yandex' },
    search_other: { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)', label: 'Diğer Arama' },
    direct:       { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)',   label: 'Direkt' },
    social:       { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)',  label: 'Sosyal' },
    referral:     { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)',  label: 'Referans' },
    bot:          { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)',   label: 'Bot' },
  };
  const m = map[source] || { color:'#94a3b8', bg:'rgba(148,163,184,0.15)', label: source };
  return (
    <span className="inline-block px-2 py-0.5 text-xs rounded font-semibold" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}

function Badge({ color, text }: { color: 'emerald'|'rose'|'cyan'|'amber'; text: string }) {
  const map = {
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    rose:    'bg-rose-500/15 text-rose-300 border-rose-500/30',
    cyan:    'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    amber:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  } as const;
  return <span className={`inline-block px-2 py-0.5 text-xs rounded border ${map[color]}`}>{text}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center text-slate-500 py-10 border border-dashed border-slate-800 rounded-xl">{text}</div>;
}

function SkeletonChart() {
  return <div className="h-64 bg-slate-800/40 rounded-xl animate-pulse" />;
}
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({length:5}).map((_,i)=>(
        <div key={i} className="h-44 bg-slate-800/40 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
