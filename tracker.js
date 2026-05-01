const { Pool } = require('pg');
const crypto   = require('crypto');
const { db }   = require('./db.js');

// ═══════════════════════════════════════════════════════════════════════════
// PostgreSQL pool (cross-domain analytics) — only used if DATABASE_URL set
// ═══════════════════════════════════════════════════════════════════════════
const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : null;

if (pool) {
    pool.query(`
        CREATE TABLE IF NOT EXISTS global_pageviews (
            id SERIAL PRIMARY KEY,
            domain VARCHAR(255) NOT NULL,
            path VARCHAR(500) NOT NULL,
            ip VARCHAR(64),
            ip_hash VARCHAR(64) NOT NULL,
            user_agent TEXT,
            referrer TEXT,
            accept_lang TEXT,
            session_id VARCHAR(64),
            is_bot BOOLEAN DEFAULT FALSE,
            bot_reason VARCHAR(50),
            js_verified BOOLEAN DEFAULT FALSE,
            verified_at TIMESTAMPTZ,
            response_time_ms INTEGER,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_gp_domain      ON global_pageviews(domain);
        CREATE INDEX IF NOT EXISTS idx_gp_created     ON global_pageviews(created_at);
        CREATE INDEX IF NOT EXISTS idx_gp_session     ON global_pageviews(session_id);
        CREATE INDEX IF NOT EXISTS idx_gp_bot         ON global_pageviews(is_bot);
    `).then(async () => {
        // Add columns if upgrading from older schema
        const cols = ['ip VARCHAR(64)','accept_lang TEXT','session_id VARCHAR(64)',
                      'is_bot BOOLEAN DEFAULT FALSE','bot_reason VARCHAR(50)',
                      'js_verified BOOLEAN DEFAULT FALSE','verified_at TIMESTAMPTZ',
                      'response_time_ms INTEGER'];
        for (const col of cols) {
            const name = col.split(' ')[0];
            await pool.query(`ALTER TABLE global_pageviews ADD COLUMN IF NOT EXISTS ${col}`).catch(()=>{});
        }
    }).catch(err => console.error('Tracking DB Init Error:', err.message));
}

// ═══════════════════════════════════════════════════════════════════════════
// Bot detection
// ═══════════════════════════════════════════════════════════════════════════
const BOT_REGEX = /bot|crawler|spider|crawl|googlebot|bingbot|yandexbot|baiduspider|slurp|ahrefs|semrush|mj12|dotbot|petalbot|amazonbot|applebot|facebookexternalhit|twitterbot|pinterestbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|chatgpt|gptbot|claude|anthropic|ccbot|perplexity|youbot|barkrowler|bytespider|coccocbot|datadog|deepl|duckduckbot|exabot|googleother|gigablast|grapeshot|headlesschrome|httrack|lighthouse|mediapartners|monitor|opensite|panscient|prerender|qwant|rambler|rogerbot|sapphire|seekport|seokicks|serendeputybot|serpstat|simplepie|sistrix|sogou|special_archiver|tineye|trendiction|uptime|wbsearchbot|webmeup|wget|curl|libwww|python-requests|python-urllib|node-fetch|axios|java\/|go-http-client|okhttp|ruby|perl|phantomjs|selenium|puppeteer|playwright|nightmare|nikto|sqlmap|nmap|masscan|zgrab|fetcher|scraper|index|preview/i;

const STATIC_RE  = /\.(css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|webp|webm|mp4|pdf|map|txt|xml)$/i;
const SKIP_PATHS = /^\/(admin|__track|favicon|robots\.txt|sitemap\.xml|api\/)/;

function detectBot(req) {
    const ua = (req.headers['user-agent'] || '').trim();
    if (!ua)                              return { isBot: true, reason: 'no-user-agent' };
    if (ua.length < 20)                   return { isBot: true, reason: 'short-ua' };
    if (BOT_REGEX.test(ua))               return { isBot: true, reason: 'ua-pattern' };
    if (!req.headers['accept'])           return { isBot: true, reason: 'no-accept-header' };
    if (!req.headers['accept-language'])  return { isBot: true, reason: 'no-accept-language' };
    return { isBot: false, reason: '' };
}

function getRealIp(req) {
    return (req.headers['cf-connecting-ip'] ||
            req.headers['x-real-ip'] ||
            (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
            req.ip || req.socket?.remoteAddress || '').toString().trim();
}

function getOrSetSession(req, res) {
    const m = (req.headers.cookie || '').match(/_sid=([a-f0-9]{32})/);
    if (m) return m[1];
    const sid = crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `_sid=${sid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
    return sid;
}

function hashIp(ip) {
    return crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// Middleware: track every public request (HTML pages only)
// ═══════════════════════════════════════════════════════════════════════════
function trackPageView(req, res, next) {
    if (SKIP_PATHS.test(req.path) || STATIC_RE.test(req.path)) return next();

    const start    = Date.now();
    const domain   = req.hostname || req.get('host') || 'unknown';
    const ip       = getRealIp(req);
    const ua       = (req.headers['user-agent']     || '').slice(0, 500);
    const referrer = (req.headers['referer'] || req.headers['referrer'] || '').slice(0, 500);
    const lang     = (req.headers['accept-language']|| '').slice(0, 100);
    const { isBot, reason } = detectBot(req);
    const sid      = getOrSetSession(req, res);
    const ipHash   = hashIp(ip);

    res.on('finish', () => {
        const rt = Date.now() - start;

        // Local SQLite (per-site detail)
        try {
            db.prepare(`INSERT INTO requests(ip,method,path,status,user_agent,referer,accept_lang,host,is_bot,bot_reason,session_id,response_time_ms)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
                ip, req.method, req.path.slice(0,500), res.statusCode,
                ua, referrer, lang, domain, isBot ? 1 : 0, reason, sid, rt);

            const v = db.prepare('SELECT request_count FROM visitors WHERE session_id=?').get(sid);
            if (v) {
                db.prepare(`UPDATE visitors SET last_seen=CURRENT_TIMESTAMP, request_count=request_count+1
                    ${isBot ? ", is_bot=1, bot_reason=COALESCE(NULLIF(bot_reason,''),?)" : ''}
                    WHERE session_id=?`).run(...(isBot ? [reason, sid] : [sid]));
            } else {
                db.prepare(`INSERT INTO visitors(session_id,ip,user_agent,is_bot,bot_reason,referer)
                    VALUES(?,?,?,?,?,?)`).run(sid, ip, ua, isBot ? 1 : 0, reason, referrer);
            }
        } catch (e) { /* silent */ }

        // PostgreSQL (cross-site)
        if (pool) {
            pool.query(
                `INSERT INTO global_pageviews(domain,path,ip,ip_hash,user_agent,referrer,accept_lang,session_id,is_bot,bot_reason,response_time_ms)
                 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [domain, req.path.slice(0,500), ip, ipHash, ua, referrer, lang, sid, isBot, reason, rt]
            ).catch(()=>{});
        }
    });

    next();
}

// ═══════════════════════════════════════════════════════════════════════════
// JS verification beacon — proves a real browser executed JavaScript
// ═══════════════════════════════════════════════════════════════════════════
function jsVerify(req, res) {
    const sid = (req.headers.cookie || '').match(/_sid=([a-f0-9]{32})/)?.[1];
    if (sid) {
        try {
            db.prepare('UPDATE visitors SET js_verified=1, verified_at=CURRENT_TIMESTAMP WHERE session_id=? AND js_verified=0').run(sid);
            db.prepare('UPDATE requests SET js_verified=1 WHERE session_id=?').run(sid);
        } catch(e) {}
        if (pool) {
            pool.query('UPDATE global_pageviews SET js_verified=true, verified_at=CURRENT_TIMESTAMP WHERE session_id=$1 AND js_verified=false', [sid]).catch(()=>{});
        }
    }
    res.set({ 'Cache-Control': 'no-store', 'Content-Type': 'image/gif' })
       .status(200)
       .send(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Stats query — aggregated for the analytics dashboard (cross-site)
// ═══════════════════════════════════════════════════════════════════════════
async function getStats(domain, range) {
    if (!pool) return { error: 'Veritabanı yapılandırılmadı (DATABASE_URL eksik).' };
    let dateCond = '';
    if (range === 'today')  dateCond = 'AND created_at >= CURRENT_DATE';
    if (range === 'week')   dateCond = "AND created_at >= NOW() - INTERVAL '7 days'";
    if (range === 'month')  dateCond = "AND created_at >= NOW() - INTERVAL '30 days'";

    try {
        const r = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE is_bot = false) AS human_views,
                COUNT(*) FILTER (WHERE is_bot = true)  AS bot_views,
                COUNT(*) FILTER (WHERE js_verified = true) AS verified_views,
                COUNT(DISTINCT session_id) FILTER (WHERE is_bot = false) AS human_visitors,
                COUNT(DISTINCT session_id) FILTER (WHERE is_bot = true)  AS bot_visitors,
                COUNT(DISTINCT session_id) FILTER (WHERE js_verified = true) AS verified_visitors,
                COUNT(*) AS total_views,
                COUNT(DISTINCT session_id) AS total_visitors
             FROM global_pageviews WHERE domain=$1 ${dateCond}`, [domain]);

        const top = await pool.query(`
            SELECT path, COUNT(*) AS views FROM global_pageviews
             WHERE domain=$1 ${dateCond} AND is_bot=false
             GROUP BY path ORDER BY views DESC LIMIT 10`, [domain]);

        const refs = await pool.query(`
            SELECT referrer, COUNT(*) AS views FROM global_pageviews
             WHERE domain=$1 ${dateCond} AND referrer != '' AND is_bot=false
             GROUP BY referrer ORDER BY views DESC LIMIT 10`, [domain]);

        const row = r.rows[0];
        return {
            human_views:       parseInt(row.human_views || 0),
            bot_views:         parseInt(row.bot_views || 0),
            verified_views:    parseInt(row.verified_views || 0),
            human_visitors:    parseInt(row.human_visitors || 0),
            bot_visitors:      parseInt(row.bot_visitors || 0),
            verified_visitors: parseInt(row.verified_visitors || 0),
            total_views:       parseInt(row.total_views || 0),
            unique_visitors:   parseInt(row.total_visitors || 0),
            topPaths:          top.rows,
            topReferrers:      refs.rows,
        };
    } catch (e) {
        console.error('Stats query error:', e);
        return { error: 'İstatistikler alınırken bir hata oluştu.' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Local stats (per-site, detailed) — for the new admin UI
// ═══════════════════════════════════════════════════════════════════════════
function getLocalStats(range = 'all') {
    let where = '';
    if (range === 'today')  where = " WHERE ts >= datetime('now','start of day')";
    if (range === 'week')   where = " WHERE ts >= datetime('now','-7 days')";
    if (range === 'month')  where = " WHERE ts >= datetime('now','-30 days')";

    const totals = db.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS bot,
        SUM(CASE WHEN is_bot=0 THEN 1 ELSE 0 END) AS human,
        SUM(CASE WHEN js_verified=1 THEN 1 ELSE 0 END) AS verified
        FROM requests${where}`).get() || {};

    const visTotals = db.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS bot,
        SUM(CASE WHEN is_bot=0 THEN 1 ELSE 0 END) AS human,
        SUM(CASE WHEN js_verified=1 THEN 1 ELSE 0 END) AS verified
        FROM visitors`).get() || {};

    const recent = db.prepare(`SELECT
        id, ts, ip, method, path, status, is_bot, bot_reason, js_verified,
        substr(user_agent,1,200) AS user_agent, response_time_ms
        FROM requests${where} ORDER BY ts DESC LIMIT 100`).all();

    const topIps = db.prepare(`SELECT
        ip, COUNT(*) AS cnt,
        SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS bot_cnt,
        MAX(js_verified) AS verified
        FROM requests${where} GROUP BY ip ORDER BY cnt DESC LIMIT 30`).all();

    const topUas = db.prepare(`SELECT
        substr(user_agent,1,200) AS user_agent, COUNT(*) AS cnt,
        MAX(is_bot) AS is_bot
        FROM requests${where} WHERE user_agent != ''
        GROUP BY user_agent ORDER BY cnt DESC LIMIT 30`).all();

    const topPaths = db.prepare(`SELECT path, COUNT(*) AS cnt
        FROM requests${where} ${where?'AND':'WHERE'} is_bot=0
        GROUP BY path ORDER BY cnt DESC LIMIT 20`).all();

    const botReasons = db.prepare(`SELECT bot_reason, COUNT(*) AS cnt
        FROM requests${where} ${where?'AND':'WHERE'} is_bot=1
        GROUP BY bot_reason ORDER BY cnt DESC`).all();

    return {
        range,
        requests: {
            total:   totals.total   || 0,
            bot:     totals.bot     || 0,
            human:   totals.human   || 0,
            verified:totals.verified|| 0,
        },
        visitors: {
            total:   visTotals.total   || 0,
            bot:     visTotals.bot     || 0,
            human:   visTotals.human   || 0,
            verified:visTotals.verified|| 0,
        },
        recent, topIps, topUas, topPaths, botReasons
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Reset all tracking data (local + global)
// ═══════════════════════════════════════════════════════════════════════════
async function resetAll() {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM requests').run();
            db.prepare('DELETE FROM visitors').run();
            db.prepare("DELETE FROM sqlite_sequence WHERE name='requests'").run();
        })();
    } catch(e) { console.error('Reset local err:', e.message); }

    if (pool) {
        try { await pool.query('TRUNCATE global_pageviews RESTART IDENTITY'); }
        catch(e) { console.error('Reset pg err:', e.message); }
    }
}

module.exports = { trackPageView, getStats, jsVerify, getLocalStats, resetAll };
