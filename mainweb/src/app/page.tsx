'use client';

import { useEffect, useMemo, useState } from 'react';
import LineWaveChart from './components/LineWaveChart';

type DomainStat = {
  domain: string;
  views: number; visitors: number;
  human_views: number; bot_views: number; verified_views: number;
  human_visitors: number; bot_visitors: number;
};
type Stats = {
  global: {
    views: number; visitors: number;
    human_views: number; bot_views: number; verified_views: number;
    human_visitors: number; bot_visitors: number; verified_visitors: number;
  };
  domains: DomainStat[];
};
type SeriesPoint = {
  ts: string;
  human: number; bot: number; verified: number;
  human_visitors: number; bot_visitors: number;
};
type Breakdown = {
  topIps: { ip: string; cnt: number; bot_cnt: number; verified: boolean }[];
  topUas: { user_agent: string; cnt: number; is_bot: boolean }[];
  topPaths: { domain: string; path: string; cnt: number }[];
  topReferrers: { referrer: string; cnt: number }[];
  botReasons: { bot_reason: string; cnt: number }[];
  hourlyHeatmap: { dow: number; hour: number; human: number; bot: number }[];
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
  const [domain,    setDomain]    = useState('');   // empty = all
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [tab,       setTab]       = useState<'sources' | 'agents' | 'pages' | 'reasons'>('sources');

  // Load all data when range/domain changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ range });
    if (domain) qs.set('domain', domain);
    Promise.all([
      fetch('/api/stats',                          { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/timeseries?${qs.toString()}`,    { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/breakdown?${qs.toString()}`,     { cache: 'no-store' }).then(r => r.json()),
    ]).then(([s, t, b]) => {
      if (cancelled) return;
      if (s.error || t.error || b.error) {
        setError(s.error || t.error || b.error); setLoading(false); return;
      }
      setStats(s);
      setSeries(t.points || []);
      setBreakdown(b);
      setLoading(false);
    }).catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [range, domain]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => {
      const qs = new URLSearchParams({ range });
      if (domain) qs.set('domain', domain);
      Promise.all([
        fetch('/api/stats',                          { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/timeseries?${qs.toString()}`,    { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/breakdown?${qs.toString()}`,     { cache: 'no-store' }).then(r => r.json()),
      ]).then(([s, t, b]) => {
        if (s.error || t.error || b.error) return;
        setStats(s); setSeries(t.points || []); setBreakdown(b);
      }).catch(()=>{});
    }, 30000);
    return () => clearInterval(id);
  }, [range, domain]);

  // ── Derived values ────────────────────────────────────────────────────────
  const xLabels = useMemo(() => series.map(p => fmtTick(p.ts, range)), [series, range]);
  const lineSeries = useMemo(() => ([
    { label: 'Bot İstekleri',     color: '#ef4444', values: series.map(p => p.bot) },
    { label: 'İnsan (Aday)',      color: '#06b6d4', values: series.map(p => p.human) },
    { label: 'JS Doğrulanmış',    color: '#10b981', values: series.map(p => p.verified) },
  ]), [series]);
  const visitorSeries = useMemo(() => ([
    { label: 'Bot Ziyaretçi',     color: '#f97316', values: series.map(p => p.bot_visitors) },
    { label: 'İnsan Ziyaretçi',   color: '#a78bfa', values: series.map(p => p.human_visitors) },
  ]), [series]);

  const humanRatio = stats && stats.global.views > 0
    ? Math.round((stats.global.human_views / stats.global.views) * 100) : 0;
  const verifiedRatio = stats && stats.global.human_views > 0
    ? Math.round((stats.global.verified_views / stats.global.human_views) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 selection:bg-cyan-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight">
              Analytics <span className="font-bold text-cyan-400">Dashboard</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Bot/İnsan ayrımıyla detaylı trafik analizi · 30 saniyede bir otomatik güncellenir
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">Tüm Siteler</option>
              {stats?.domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
            </select>
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
              {RANGES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    range === r.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >{r.label}</button>
              ))}
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
            Hata: {error}
          </div>
        )}

        {/* Stat cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Toplam İstek" value={stats?.global.views} accent="cyan"
            sub={`${stats?.global.visitors.toLocaleString() ?? 0} tekil oturum`} loading={loading} />
          <StatCard label="İnsan İstekleri (aday)" value={stats?.global.human_views} accent="violet"
            sub={`${stats?.global.human_visitors.toLocaleString() ?? 0} tekil insan oturumu`} loading={loading} />
          <StatCard label="Bot İstekleri" value={stats?.global.bot_views} accent="rose"
            sub={`${stats?.global.bot_visitors.toLocaleString() ?? 0} bot oturumu`} loading={loading} />
          <StatCard label="✓ JS Doğrulanmış (Kesin İnsan)" value={stats?.global.verified_views} accent="emerald"
            sub={`${stats?.global.verified_visitors.toLocaleString() ?? 0} doğrulanmış oturum`} loading={loading} />
        </section>

        {/* Ratio bar */}
        {stats && stats.global.views > 0 && (
          <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-slate-300">Trafik Kompozisyonu (toplam {stats.global.views.toLocaleString()} istek)</span>
              <span className="text-slate-400">
                <span className="text-emerald-400 font-bold">%{verifiedRatio}</span> insan trafiğinin JS ile kesin doğrulandı
              </span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500" style={{ width: `${pct(stats.global.verified_views, stats.global.views)}%` }} title={`Verified: ${stats.global.verified_views}`} />
              <div className="bg-cyan-500"    style={{ width: `${pct(stats.global.human_views - stats.global.verified_views, stats.global.views)}%` }} title={`Human (unverified): ${stats.global.human_views - stats.global.verified_views}`} />
              <div className="bg-rose-500"    style={{ width: `${pct(stats.global.bot_views, stats.global.views)}%` }} title={`Bot: ${stats.global.bot_views}`} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-slate-400">
              <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 align-middle"></span>JS Doğrulanmış (kesin insan)</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-cyan-500 mr-2 align-middle"></span>İnsan (aday, JS kanıtsız)</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-2 align-middle"></span>Bot</span>
            </div>
          </section>
        )}

        {/* Time series chart */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <header className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium flex items-center gap-3">
              <span className="w-8 h-[2px] bg-cyan-500 block"></span>
              Zaman Serisi · İstekler
            </h2>
            <span className="text-xs text-slate-500">{rangeDescription(range)}</span>
          </header>
          {loading ? <SkeletonChart /> : (
            series.length === 0
              ? <EmptyState text="Bu aralıkta veri yok." />
              : <LineWaveChart labels={xLabels} series={lineSeries} height={320} />
          )}
        </section>

        {/* Visitor chart */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <header className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium flex items-center gap-3">
              <span className="w-8 h-[2px] bg-violet-500 block"></span>
              Zaman Serisi · Tekil Ziyaretçiler
            </h2>
            <span className="text-xs text-slate-500">{rangeDescription(range)}</span>
          </header>
          {loading ? <SkeletonChart /> : (
            series.length === 0
              ? <EmptyState text="Bu aralıkta veri yok." />
              : <LineWaveChart labels={xLabels} series={visitorSeries} height={280} />
          )}
        </section>

        {/* Domain breakdown */}
        <section>
          <h2 className="text-lg font-medium flex items-center gap-3 mb-4">
            <span className="w-8 h-[2px] bg-emerald-500 block"></span>
            Domain Dağılımı (bot / insan ayırımı)
          </h2>
          {loading ? <SkeletonGrid /> : (
            !stats || stats.domains.length === 0
              ? <EmptyState text="Henüz veri yok." />
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.domains.map(d => <DomainCard key={d.domain} d={d} />)}
                </div>
              )
          )}
        </section>

        {/* Hourly Heatmap */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-medium flex items-center gap-3 mb-4">
            <span className="w-8 h-[2px] bg-fuchsia-500 block"></span>
            Saat × Gün Aktivite Isı Haritası (insan trafiği)
          </h2>
          {loading || !breakdown ? <SkeletonChart /> : <Heatmap data={breakdown.hourlyHeatmap} />}
        </section>

        {/* Detail tables */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-lg font-medium flex items-center gap-3">
              <span className="w-8 h-[2px] bg-amber-500 block"></span>
              Detay Tablolar
            </h2>
            <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1 flex-wrap">
              {(['sources','agents','pages','reasons'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    tab === t ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}>
                  {tabLabel(t)}
                </button>
              ))}
            </div>
          </header>
          {!breakdown
            ? <SkeletonChart />
            : (
              <>
                {tab === 'sources'  && <IpsTable rows={breakdown.topIps} />}
                {tab === 'agents'   && <UasTable rows={breakdown.topUas} />}
                {tab === 'pages'    && <PathsTable rows={breakdown.topPaths} refs={breakdown.topReferrers} />}
                {tab === 'reasons'  && <ReasonsTable rows={breakdown.botReasons} />}
              </>
            )}
        </section>

        <footer className="text-center text-xs text-slate-600 py-6">
          {humanRatio}% insan oranı · 30 saniyede bir güncellenir · {new Date().toLocaleString('tr-TR')}
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
function rangeDescription(r: string) {
  if (r === '24h') return 'Saatlik bucket';
  return 'Günlük bucket';
}
function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}
function tabLabel(t: string) {
  return ({ sources:'Top IP', agents:'User-Agent', pages:'Sayfalar & Kaynaklar', reasons:'Bot Sebepleri' } as Record<string,string>)[t] || t;
}

// ─── Components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, loading }: { label: string; value?: number; sub?: string; accent: 'cyan'|'violet'|'rose'|'emerald'; loading: boolean }) {
  const colors = {
    cyan:    'from-cyan-500/10  text-cyan-300',
    violet:  'from-violet-500/10 text-violet-300',
    rose:    'from-rose-500/10  text-rose-300',
    emerald: 'from-emerald-500/10 text-emerald-300',
  } as const;
  return (
    <div className={`bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br ${colors[accent].split(' ')[0]} to-transparent`}>
      <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2 font-semibold">{label}</h3>
      <p className={`text-4xl font-light ${colors[accent].split(' ')[1]}`}>
        {loading ? '—' : (value ?? 0).toLocaleString()}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-2">{sub}</p>}
    </div>
  );
}

function DomainCard({ d }: { d: DomainStat }) {
  const total = d.views || 1;
  const humanPct = (d.human_views / total) * 100;
  const botPct   = (d.bot_views / total) * 100;
  const verPct   = (d.verified_views / total) * 100;
  return (
    <div className="bg-slate-900 border border-slate-800/50 p-5 rounded-xl hover:border-cyan-500/40 transition-colors">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="text-base font-semibold text-white truncate">{d.domain}</h3>
        <span className="text-xs text-slate-500">{d.views.toLocaleString()} istek</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex mb-3">
        <div className="bg-emerald-500" style={{ width: `${verPct}%` }} />
        <div className="bg-cyan-500"    style={{ width: `${humanPct - verPct}%` }} />
        <div className="bg-rose-500"    style={{ width: `${botPct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-slate-500">İnsan</p>
          <p className="text-cyan-300 font-semibold text-base">{d.human_views.toLocaleString()}</p>
          <p className="text-slate-600">{d.human_visitors} oturum</p>
        </div>
        <div>
          <p className="text-slate-500">Bot</p>
          <p className="text-rose-300 font-semibold text-base">{d.bot_views.toLocaleString()}</p>
          <p className="text-slate-600">{d.bot_visitors} oturum</p>
        </div>
        <div>
          <p className="text-slate-500">✓ JS Doğr.</p>
          <p className="text-emerald-300 font-semibold text-base">{d.verified_views.toLocaleString()}</p>
          <p className="text-slate-600">{Math.round(verPct)}%</p>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ data }: { data: Breakdown['hourlyHeatmap'] }) {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let max = 0;
  for (const c of data) {
    if (c.dow >= 0 && c.dow < 7 && c.hour >= 0 && c.hour < 24) {
      grid[c.dow][c.hour] = c.human;
      if (c.human > max) max = c.human;
    }
  }
  const dayNames = ['Paz','Pzt','Sal','Çar','Per','Cum','Cts'];
  if (max === 0) return <EmptyState text="Henüz insan trafiği yok." />;
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
                  <td key={h}
                      title={`${dayNames[dow]} ${h}:00 · ${v} istek`}
                      style={{
                        background: v ? `rgba(217, 70, 239, ${0.12 + intensity * 0.8})` : 'rgba(30, 41, 59, 0.6)',
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
          <span key={i} style={{ width: 16, height: 16, borderRadius: 4, background: `rgba(217, 70, 239, ${0.12 + (i/5) * 0.8})` }} />
        ))}
        <span>Çok ({max} istek/saat)</span>
      </div>
    </div>
  );
}

function IpsTable({ rows }: { rows: Breakdown['topIps'] }) {
  if (!rows.length) return <EmptyState text="Veri yok." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500 uppercase tracking-wider">
          <tr><th className="py-2">IP / Hash</th><th className="text-right">Toplam</th><th className="text-right">Bot</th><th>Etiket</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r,i)=>{
            const onlyBot = r.bot_cnt > 0 && r.bot_cnt === r.cnt;
            const mixed   = r.bot_cnt > 0 && r.bot_cnt < r.cnt;
            return (
              <tr key={i} className="hover:bg-slate-800/30">
                <td className="py-2 font-mono text-xs text-slate-200">{r.ip}</td>
                <td className="text-right font-semibold">{r.cnt.toLocaleString()}</td>
                <td className="text-right text-rose-400">{r.bot_cnt.toLocaleString()}</td>
                <td>
                  {r.verified ? <Badge color="emerald" text="✓ İNSAN (JS doğr.)" />
                  : onlyBot ? <Badge color="rose" text="🤖 BOT" />
                  : mixed   ? <Badge color="amber" text="KARIŞIK" />
                  :           <Badge color="cyan" text="İNSAN (aday)" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UasTable({ rows }: { rows: Breakdown['topUas'] }) {
  if (!rows.length) return <EmptyState text="Veri yok." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500 uppercase tracking-wider">
          <tr><th className="py-2">User-Agent</th><th className="text-right">Sayı</th><th>Etiket</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r,i)=>(
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="py-2 font-mono text-xs text-slate-300 max-w-2xl truncate" title={r.user_agent}>{r.user_agent}</td>
              <td className="text-right font-semibold">{r.cnt.toLocaleString()}</td>
              <td>{r.is_bot ? <Badge color="rose" text="🤖 BOT" /> : <Badge color="emerald" text="İNSAN" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PathsTable({ rows, refs }: { rows: Breakdown['topPaths']; refs: Breakdown['topReferrers'] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm text-slate-400 mb-2 uppercase tracking-wider">En Çok Ziyaret Edilen (insan)</h3>
        {rows.length === 0 ? <EmptyState text="Veri yok." /> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-800">
              {rows.map((r,i)=>(
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="py-2 text-xs text-cyan-400 font-mono">{r.domain}</td>
                  <td className="py-2 text-xs text-slate-300 font-mono truncate max-w-xs">{r.path}</td>
                  <td className="py-2 text-right font-semibold">{r.cnt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <h3 className="text-sm text-slate-400 mb-2 uppercase tracking-wider">Yönlendiren Kaynaklar</h3>
        {refs.length === 0 ? <EmptyState text="Doğrudan ziyaret veya veri yok." /> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-800">
              {refs.map((r,i)=>(
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="py-2 text-xs text-slate-300 font-mono truncate max-w-md" title={r.referrer}>{r.referrer}</td>
                  <td className="py-2 text-right font-semibold">{r.cnt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ReasonsTable({ rows }: { rows: Breakdown['botReasons'] }) {
  if (!rows.length) return <EmptyState text="Bot algılanmadı." />;
  return (
    <div>
      <p className="text-sm text-slate-400 mb-3">Botların hangi kurala takıldığının dağılımı:</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500 uppercase tracking-wider">
          <tr><th className="py-2">Tespit Sebebi</th><th className="text-right">Sayı</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r,i)=>(
            <tr key={i}>
              <td className="py-2"><code className="bg-rose-500/10 text-rose-300 px-2 py-1 rounded text-xs">{r.bot_reason}</code></td>
              <td className="text-right font-semibold text-rose-300">{r.cnt.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        <div key={i} className="h-36 bg-slate-800/40 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
