'use client';

import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({ global: { views: 0, visitors: 0 }, domains: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-cyan-500 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-light tracking-tight">Analytics <span className="font-bold text-cyan-400">Dashboard</span></h1>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full group-hover:bg-cyan-500/20 transition duration-700"></div>
            <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-2 font-semibold">Total Page Views</h2>
            <p className="text-6xl font-light text-white">{loading ? '...' : stats.global.views.toLocaleString()}</p>
          </div>
          
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full group-hover:bg-purple-500/20 transition duration-700"></div>
            <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-2 font-semibold">Unique Visitors</h2>
            <p className="text-6xl font-light text-white">{loading ? '...' : stats.global.visitors.toLocaleString()}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-light mb-6 flex items-center gap-3">
            <span className="w-8 h-[1px] bg-cyan-500 block"></span>
            Domain Breakdown
          </h2>
          
          {loading ? (
            <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-2xl text-center text-slate-500">
              Loading tracking data...
            </div>
          ) : stats.domains.length === 0 ? (
            <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-2xl text-center text-slate-500">
              No tracking data available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {stats.domains.map((d: any, i: number) => (
                <div key={i} className="bg-slate-900 border border-slate-800/50 p-6 rounded-xl hover:border-cyan-500/50 transition-colors group">
                  <h3 className="text-lg font-medium text-white mb-4 truncate group-hover:text-cyan-400 transition-colors">{d.domain}</h3>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Views</p>
                      <p className="text-2xl font-light">{d.views.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Visitors</p>
                      <p className="text-2xl font-light">{d.visitors.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
