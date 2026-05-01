import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Returns hourly or daily buckets for human vs bot views
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || '30d').toLowerCase();
    const domain = searchParams.get('domain') || '';

    let bucket = 'day';
    let interval = "30 days";
    if (range === '24h') { bucket = 'hour'; interval = '24 hours'; }
    else if (range === '7d')  { bucket = 'day';  interval = '7 days'; }
    else if (range === '30d') { bucket = 'day';  interval = '30 days'; }
    else if (range === '90d') { bucket = 'day';  interval = '90 days'; }

    const params: (string | number)[] = [];
    let where = `created_at >= NOW() - INTERVAL '${interval}'`;
    if (domain) {
      params.push(domain);
      where += ` AND domain = $${params.length}`;
    }

    const series = await pool.query(`
      SELECT
        date_trunc('${bucket}', created_at)              AS ts,
        COUNT(*) FILTER (WHERE is_bot = false)            AS human,
        COUNT(*) FILTER (WHERE is_bot = true)             AS bot,
        COUNT(*) FILTER (WHERE js_verified = true)        AS verified,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))
                 FILTER (WHERE is_bot = false)            AS human_visitors,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))
                 FILTER (WHERE is_bot = true)             AS bot_visitors
      FROM global_pageviews
      WHERE ${where}
      GROUP BY ts
      ORDER BY ts ASC`, params);

    // Fill gaps so the chart has continuous x-axis points
    const filled = fillBuckets(series.rows, bucket, interval);

    return NextResponse.json({
      range,
      bucket,
      points: filled.map(p => ({
        ts:              p.ts.toISOString(),
        human:           Number(p.human || 0),
        bot:             Number(p.bot || 0),
        verified:        Number(p.verified || 0),
        human_visitors:  Number(p.human_visitors || 0),
        bot_visitors:    Number(p.bot_visitors || 0),
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    console.error('API /timeseries Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type Row = { ts: Date | string; human?: unknown; bot?: unknown; verified?: unknown; human_visitors?: unknown; bot_visitors?: unknown };

function fillBuckets(rows: Row[], bucket: string, interval: string) {
  const map = new Map<string, Row>();
  for (const r of rows) {
    const d = new Date(r.ts);
    map.set(d.toISOString(), r);
  }

  const stepMs = bucket === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const intervalMs = parseIntervalToMs(interval);
  const now = new Date();
  const start = bucket === 'hour'
    ? new Date(Math.floor((now.getTime() - intervalMs) / stepMs) * stepMs)
    : startOfDay(new Date(now.getTime() - intervalMs));
  const end = bucket === 'hour'
    ? new Date(Math.floor(now.getTime() / stepMs) * stepMs)
    : startOfDay(now);

  const out: Row[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const d = new Date(t);
    const key = d.toISOString();
    const existing = map.get(key);
    out.push(existing || { ts: d, human: 0, bot: 0, verified: 0, human_visitors: 0, bot_visitors: 0 });
  }
  return out.map(r => ({ ...r, ts: new Date(r.ts) }));
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseIntervalToMs(s: string) {
  const m = s.match(/(\d+)\s*(hours?|days?)/);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  return /hour/.test(m[2]) ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
}
