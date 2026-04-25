import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { domain, path, ip_hash, user_agent, referrer } = data;

    if (!domain || !path || !ip_hash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO global_pageviews (domain, path, ip_hash, user_agent, referrer) VALUES ($1, $2, $3, $4, $5)`,
      [domain, path, ip_hash, user_agent || '', referrer || '']
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /track Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
