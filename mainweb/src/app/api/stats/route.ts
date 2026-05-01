import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Source classification used everywhere
export const SOURCE_CASE = `
  CASE
    WHEN is_bot = true                                        THEN 'bot'
    WHEN referrer ~* '(?<![a-z])google\\.[a-z]'               THEN 'google'
    WHEN referrer ~* '(?<![a-z])bing\\.com'                   THEN 'bing'
    WHEN referrer ~* '(?<![a-z])yandex\\.[a-z]'               THEN 'yandex'
    WHEN referrer ~* 'duckduckgo\\.com|yahoo\\.com|ecosia\\.org|brave\\.com' THEN 'search_other'
    WHEN referrer IS NULL OR referrer = ''                    THEN 'direct'
    WHEN referrer ~* '(facebook|twitter|x\\.com|instagram|linkedin|t\\.co|reddit|pinterest|tiktok|youtube)\\.' THEN 'social'
    ELSE 'referral'
  END
`;

export async function GET() {
  try {
    const totals = await pool.query(`
      SELECT
        COUNT(*)                                                                              AS total,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'google')                                     AS google,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'bing')                                       AS bing,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'yandex')                                     AS yandex,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'search_other')                               AS search_other,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'direct')                                     AS direct,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'social')                                     AS social,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'referral')                                   AS referral,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'bot')                                        AS bot,
        COUNT(*) FILTER (WHERE js_verified = true)                                            AS verified,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))                                         AS visitors,
        COUNT(DISTINCT COALESCE(session_id, ip_hash)) FILTER (WHERE ${SOURCE_CASE} = 'google') AS google_visitors,
        COUNT(DISTINCT COALESCE(session_id, ip_hash)) FILTER (WHERE ${SOURCE_CASE} = 'bing')   AS bing_visitors,
        COUNT(DISTINCT COALESCE(session_id, ip_hash)) FILTER (WHERE ${SOURCE_CASE} = 'yandex') AS yandex_visitors
      FROM global_pageviews`);

    const domains = await pool.query(`
      SELECT
        domain,
        COUNT(*)                                                  AS total,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'google')         AS google,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'bing')           AS bing,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'yandex')         AS yandex,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'search_other')   AS search_other,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'direct')         AS direct,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'social')         AS social,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'referral')       AS referral,
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'bot')            AS bot,
        COUNT(DISTINCT COALESCE(session_id, ip_hash)) FILTER (WHERE ${SOURCE_CASE} IN ('google','bing','yandex','search_other')) AS search_visitors
      FROM global_pageviews
      GROUP BY domain
      ORDER BY (
        COUNT(*) FILTER (WHERE ${SOURCE_CASE} IN ('google','bing','yandex','search_other'))
      ) DESC, total DESC`);

    const num = (v: unknown) => parseInt(String(v ?? '0'), 10) || 0;
    const t = totals.rows[0] || {};
    const search_total = num(t.google) + num(t.bing) + num(t.yandex) + num(t.search_other);

    return NextResponse.json({
      global: {
        total:           num(t.total),
        visitors:        num(t.visitors),
        // PRIMARY metric — organic search engine clicks
        search_total,
        google:          num(t.google),
        bing:            num(t.bing),
        yandex:          num(t.yandex),
        search_other:    num(t.search_other),
        google_visitors: num(t.google_visitors),
        bing_visitors:   num(t.bing_visitors),
        yandex_visitors: num(t.yandex_visitors),
        // SECONDARY — everything else
        direct:          num(t.direct),
        social:          num(t.social),
        referral:        num(t.referral),
        bot:             num(t.bot),
        verified:        num(t.verified),
      },
      domains: domains.rows.map((r: Record<string, unknown>) => {
        const search = num(r.google) + num(r.bing) + num(r.yandex) + num(r.search_other);
        return {
          domain:          String(r.domain),
          total:           num(r.total),
          search_total:    search,
          google:          num(r.google),
          bing:            num(r.bing),
          yandex:          num(r.yandex),
          search_other:    num(r.search_other),
          search_visitors: num(r.search_visitors),
          direct:          num(r.direct),
          social:          num(r.social),
          referral:        num(r.referral),
          bot:             num(r.bot),
        };
      }),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    console.error('API /stats Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
