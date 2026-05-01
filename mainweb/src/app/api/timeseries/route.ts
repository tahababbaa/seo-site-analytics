import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { SOURCE_CASE } from '../stats/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Returns hourly or daily buckets — separate series for each traffic source
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range  = (searchParams.get('range') || '30d').toLowerCase();
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
        date_trunc('${bucket}', created_at)                              AS ts,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'google')                AS google,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'bing')                  AS bing,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'yandex')                AS yandex,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'search_other')          AS search_other,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'direct')                AS direct,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'social')                AS social,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'referral')              AS referral,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'bot')                   AS bot
      FROM global_pageviews
      WHERE ${where}
      GROUP BY ts
      ORDER BY ts ASC`, params);

    const filled = fillBuckets(series.rows, bucket, interval);

    return NextResponse.json({
      range,
      bucket,
      points: filled.map(p => ({
        ts:           new Date(p.ts).toISOString(),
        google:       Number(p.google || 0),
        bing:         Number(p.bing || 0),
        yandex:       Number(p.yandex || 0),
        search_other: Number(p.search_other || 0),
        direct:       Number(p.direct || 0),
        social:       Number(p.social || 0),
        referral:     Number(p.referral || 0),
        bot:          Number(p.bot || 0),
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    console.error('API /timeseries Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type Row = { ts: Date | string; [k: string]: unknown };

function fillBuckets(rows: Row[], bucket: string, interval: string): Row[] {
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
    out.push(map.get(key) || { ts: d, google:0, bing:0, yandex:0, search_other:0, direct:0, social:0, referral:0, bot:0 });
  }
  return out;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function parseIntervalToMs(s: string) {
  const m = s.match(/(\d+)\s*(hours?|days?)/);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  return /hour/.test(m[2]) ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
}
