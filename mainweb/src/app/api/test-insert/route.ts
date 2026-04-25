import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const result = await pool.query(`
      INSERT INTO global_pageviews (domain, path, ip_hash, user_agent, referrer) 
      VALUES ('twitterifsa.us', '/test', 'fakehash123', 'testagent', 'https://google.com')
      RETURNING id;
    `);
    return NextResponse.json({ success: true, insertedId: result.rows[0].id });
  } catch (error) {
    console.error('API /test Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
