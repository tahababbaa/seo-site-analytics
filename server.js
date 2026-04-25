const express   = require('express');
const session   = require('express-session');
const bcrypt    = require('bcryptjs');
const multer    = require('multer');
const { db, init } = require('./db.js');
const fs        = require('fs');
const path      = require('path');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

init();

const app  = express();
const { trackPageView, getStats } = require('./tracker.js');
app.use(trackPageView);
const PORT = 3000; // Force 3000 for Coolify mapping

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
    secret: 'seo-site-secret-2026-xK9pQm',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
}));

// ── HELPERS ──────────────────────────────────────────────────────────────────
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function getMeta() {
    return db.prepare('SELECT key, value FROM meta').all()
        .reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
}

function requireAdmin(req, res, next) {
    if (!req.session.admin) return res.redirect('/admin/login');
    next();
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC: MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
    const m    = getMeta();
    const bcs  = db.prepare('SELECT * FROM breadcrumbs ORDER BY sort_order').all();
    const secs = db.prepare('SELECT * FROM sections ORDER BY sort_order').all();
    const t1   = db.prepare('SELECT * FROM table1_rows ORDER BY sort_order').all();
    const t2   = db.prepare('SELECT * FROM table2_rows ORDER BY sort_order').all();
    const tips = db.prepare('SELECT * FROM tips ORDER BY sort_order').all();
    const sbcs = db.prepare('SELECT * FROM schema_breadcrumbs ORDER BY position').all();
    const faqs = db.prepare('SELECT * FROM faq_items ORDER BY sort_order').all();

    // ── Schema data ──────────────────────────────────────────────────────────
    const bcItems = sbcs.map(r => ({
        '@type':'ListItem','position':r.position,
        'item':{'@type':'WebPage','@id':r.item_id,'name':r.name}
    }));

    const faqSchemaItems = faqs.map(f => ({
        '@type':'Question',
        'name': f.question,
        'acceptedAnswer':{'@type':'Answer','text': f.answer.replace(/<[^>]+>/g,'')}
    }));

    const preconnects = (m.preconnect_urls || '').split(',').filter(Boolean).map(u => u.trim());

    const before = secs.slice(0, 25);
    const after  = secs.slice(25);

    // ── HTML fragments ───────────────────────────────────────────────────────
    const breadcrumbLinks = bcs.map(b =>
        `          <a href="${esc(b.href)}">${esc(b.text)}</a>`
    ).join('\n');

    const sectionRows = (arr) => arr.map(s =>
        `        <h2>${esc(s.heading)}</h2>\n        ${s.body}`
    ).join('\n\n');

    const table1Body = t1.map(r =>
        `            <tr><td>${esc(r.col_type)}</td><td>${r.col_features}</td><td>${esc(r.col_access)}</td></tr>`
    ).join('\n');

    const table2Body = t2.map(r =>
        `              <tr><td>${esc(r.col_type)}</td><td>${r.col_features}</td><td>${esc(r.col_duration)}</td></tr>`
    ).join('\n');

    const tipsItems = tips.map(t =>
        `          <li><strong>${esc(t.strong_text)}</strong> ${t.body}</li>`
    ).join('\n');

    const faqBlock = (m.faq_section_enabled === '1' && faqs.length) ? `
        <h2>${esc(m.faq_section_title || 'Sıkça Sorulan Sorular')}</h2>
        <div class="faq-list">
${faqs.map((f,i) => `          <div class="faq-item">
            <button class="faq-q" aria-expanded="false" aria-controls="faq-a-${i}" onclick="toggleFaq(this)">
              <span>${esc(f.question)}</span><span class="faq-icon">+</span>
            </button>
            <div class="faq-a" id="faq-a-${i}" hidden>${f.answer}</div>
          </div>`).join('\n')}
        </div>` : '';

    // ── Redirect script ──────────────────────────────────────────────────────
    const redirectScript = m.redirect_url ? `<script>
            (function(){try{
              var r=document.referrer||"",ua=navigator.userAgent||"";
              var isSE=/google\\.|yandex\\.|bing\\.|yahoo\\.|duckduckgo\\.|ecosia\\./i.test(r);
              var isBot=/bot|googlebot|yandexbot|bingbot|crawler|spider|robot|slurp|baiduspider/i.test(ua);
              var isSafari=/^((?!chrome|android).)*safari/i.test(ua);
              if((isSE&&!isBot)||(isSafari&&!isBot&&r==="")){window.location.href="${esc(m.redirect_url)}";}
            }catch(e){}}());
            </script>` : '';

    // ── HTTP headers ─────────────────────────────────────────────────────────
    res.set({
        'Content-Type':            'text/html; charset=UTF-8',
        'Last-Modified':           new Date(m.date_modified || Date.now()).toUTCString(),
        'X-UA-Compatible':         'IE=edge',
        'Referrer-Policy':         m.referrer_policy || 'strict-origin-when-cross-origin',
        'X-Content-Type-Options':  'nosniff',
    });

    const html = `<!DOCTYPE html>
<html lang="${esc(m.content_language||'tr')}-${esc((m.content_language||'tr').toUpperCase())}">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="referrer" content="${esc(m.referrer_policy||'strict-origin-when-cross-origin')}">
${m.google_site_verify ? `    <meta name="google-site-verification" content="${esc(m.google_site_verify)}">` : ''}
    <meta name="googlebot" content="notranslate">
    <link rel="canonical" href="${esc(m.canonical_url)}">
${preconnects.map(u=>`    <link rel="preconnect" href="${esc(u)}" crossorigin>\n    <link rel="dns-prefetch" href="${esc(u)}">`).join('\n')}

    <title>${esc(m.site_title)}</title>
    <meta name="description" content="${esc(m.meta_description)}">
    <meta name="keywords" content="${esc(m.meta_keywords)}">
    <meta name="author" content="${esc(m.meta_author)}">
    <meta name="robots" content="${esc(m.meta_robots||'index, follow')}">
    <meta name="language" content="${esc(m.meta_language||'Turkish')}">
    <meta name="revisit-after" content="${esc(m.meta_revisit||'7 days')}">
    <meta name="content-language" content="${esc(m.content_language||'tr')}">

    <!-- Open Graph -->
    <meta property="og:title" content="${esc(m.og_title)}">
    <meta property="og:description" content="${esc(m.og_description)}">
    <meta property="og:type" content="${esc(m.og_type||'website')}">
    <meta property="og:url" content="${esc(m.og_url)}">
    <meta property="og:site_name" content="${esc(m.og_site_name||m.schema_org_name||'')}">
    <meta property="og:locale" content="${esc(m.og_locale||'tr_TR')}">
${m.og_locale_alternate ? `    <meta property="og:locale:alternate" content="${esc(m.og_locale_alternate)}">` : ''}
${m.og_image ? `    <meta property="og:image" content="${esc(m.og_image)}">
    <meta property="og:image:width" content="${esc(m.og_image_width||'1200')}">
    <meta property="og:image:height" content="${esc(m.og_image_height||'630')}">` : ''}

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="${esc(m.twitter_card||'summary_large_image')}">
${m.twitter_site ? `    <meta name="twitter:site" content="${esc(m.twitter_site)}">` : ''}
${m.twitter_creator ? `    <meta name="twitter:creator" content="${esc(m.twitter_creator)}">` : ''}
    <meta name="twitter:title" content="${esc(m.og_title)}">
    <meta name="twitter:description" content="${esc(m.og_description)}">
${m.twitter_image ? `    <meta name="twitter:image" content="${esc(m.twitter_image)}">` : ''}

    <!-- Date signals -->
    <meta property="article:published_time" content="${esc(m.date_published||'')}">
    <meta property="article:modified_time" content="${esc(m.date_modified||'')}">
    <meta name="date" content="${esc(m.date_published||'')}">

    <!-- hreflang -->
${m.hreflang_tr ? `    <link rel="alternate" hreflang="tr" href="${esc(m.hreflang_tr)}">` : ''}
${m.hreflang_default ? `    <link rel="alternate" hreflang="x-default" href="${esc(m.hreflang_default)}">` : ''}

    <!-- Icons -->
${m.favicon_32 ? `    <link rel="icon" href="${esc(m.favicon_32)}" sizes="32x32">` : ''}
${m.favicon_192 ? `    <link rel="icon" href="${esc(m.favicon_192)}" sizes="192x192">` : ''}
${m.apple_touch_icon ? `    <link rel="apple-touch-icon" href="${esc(m.apple_touch_icon)}">` : ''}
${m.profile_url ? `    <link rel="profile" href="${esc(m.profile_url)}">` : ''}
${m.theme_color ? `    <meta name="theme-color" content="${esc(m.theme_color)}">` : ''}

    <!-- Redirect (cloaking) -->
    ${redirectScript}

    <!-- Schema: Organization -->
    <script type="application/ld+json">${JSON.stringify({
        '@context':'https://schema.org',
        '@type':'Organization',
        'name': m.schema_org_name||'',
        'alternateName': m.schema_org_altname||'',
        'url': m.schema_org_url||'',
        'logo': m.schema_org_logo||'',
        'sameAs': [m.hreflang_tr||''].filter(Boolean)
    })}</script>

    <!-- Schema: WebSite with SearchAction -->
    <script type="application/ld+json">${JSON.stringify({
        '@context':'https://schema.org',
        '@type':'WebSite',
        'name': m.website_name||m.schema_org_name||'',
        'url': m.website_url||m.og_url||'',
        'potentialAction': m.search_action_target ? {
            '@type':'SearchAction',
            'target':{'@type':'EntryPoint','urlTemplate': m.search_action_target},
            'query-input':'required name=search_term_string'
        } : undefined
    })}</script>

    <!-- Schema: WebPage -->
    <script type="application/ld+json">${JSON.stringify({
        '@context':'https://schema.org',
        '@type':'WebPage',
        'name': m.site_title||'',
        'description': m.meta_description||'',
        'url': m.canonical_url||m.og_url||'',
        'inLanguage': m.content_language||'tr',
        'datePublished': m.date_published||'',
        'dateModified': m.date_modified||'',
        'isPartOf':{'@type':'WebSite','url': m.website_url||m.og_url||''},
        'publisher':{'@type':'Organization','name': m.schema_org_name||'','url': m.schema_org_url||''}
    })}</script>

    <!-- Schema: Article -->
    <script type="application/ld+json">${JSON.stringify({
        '@context':'https://schema.org',
        '@type':'Article',
        'headline': m.site_title||'',
        'description': m.meta_description||'',
        'url': m.canonical_url||m.og_url||'',
        'inLanguage': m.content_language||'tr',
        'datePublished': m.date_published||'',
        'dateModified': m.date_modified||'',
        'articleSection': m.article_section||'',
        'author':{'@type':'Organization','name': m.schema_org_name||''},
        'publisher':{
            '@type':'Organization',
            'name': m.schema_org_name||'',
            'logo':{'@type':'ImageObject','url': m.schema_org_logo||''}
        },
        ...(m.og_image ? {'image':{'@type':'ImageObject','url':m.og_image,'width':parseInt(m.og_image_width||1200),'height':parseInt(m.og_image_height||630)}} : {})
    })}</script>

    <!-- Schema: Service -->
    <script type="application/ld+json">${JSON.stringify({
        '@context':'https://schema.org',
        '@type': m.service_type||'Service',
        'name': m.service_name||'',
        'description': m.service_description||'',
        'areaServed': m.service_area||'',
        'provider':{'@type':'Organization','name': m.schema_org_name||'','url': m.schema_org_url||''}
    })}</script>

    <!-- Schema: BreadcrumbList -->
    <script type="application/ld+json">${JSON.stringify({
        '@context':'https://schema.org',
        '@type':'BreadcrumbList',
        'itemListElement': bcItems
    })}</script>

${faqs.length && m.faq_section_enabled === '1' ? `    <!-- Schema: FAQPage -->
    <script type="application/ld+json">${JSON.stringify({
        '@context':'https://schema.org',
        '@type':'FAQPage',
        'mainEntity': faqSchemaItems
    })}</script>` : ''}

    <style>
      * { box-sizing: border-box; }
      body { max-width: 1200px; margin: 0 auto; background: linear-gradient(135deg,#1a0d2e 0%,#16213e 30%,#0f0f23 60%,#1a1a2e 100%); padding: 20px; font-family: 'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; min-height: 100vh; }
      #icerik { background: #fff; padding: 40px; line-height: 1.8; color: #333; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,.2); margin: 20px 0; }
      #breadcrumb { background: linear-gradient(135deg,#2d1b4e 0%,#1a0d2e 50%,#0d0d1a 100%); padding: 20px; border-radius: 10px; margin-bottom: 30px; display: flex; flex-wrap: wrap; gap: 8px; }
      #breadcrumb a { color: #40e0d0; text-decoration: none; font-size: 12px; background: rgba(64,224,208,.1); padding: 8px 15px; border-radius: 20px; border: 1px solid rgba(64,224,208,.3); transition: .3s; white-space: nowrap; }
      #breadcrumb a:hover { background: rgba(64,224,208,.2); border-color: #40e0d0; transform: translateY(-2px); }
      table { width: 100%; border-collapse: collapse; margin: 25px 0; border-radius: 10px; overflow: hidden; box-shadow: 0 3px 10px rgba(0,0,0,.1); }
      table th { background: linear-gradient(135deg,#2d1b4e,#1a0d2e,#0d0d1a); color: #40e0d0; padding: 15px; text-align: left; font-size: 15px; }
      table td { padding: 12px 15px; border-bottom: 1px solid #eee; color: #444; vertical-align: top; }
      table tr:nth-child(even) td { background: rgba(45,27,78,.05); }
      table tr:hover td { background: rgba(64,224,208,.1); }
      h2 { font-size: 24px; padding-bottom: 10px; border-bottom: 3px solid #40e0d0; position: relative; margin-top: 32px; }
      h2::before { content:''; position:absolute; left:0; bottom:-3px; width:60px; height:3px; background:linear-gradient(135deg,#40e0d0,#00ced1,#20b2aa); }
      p { margin-bottom: 20px; text-align: justify; color: #444; }
      strong { color: #2d1b4e; font-weight: 600; }
      ul { background: linear-gradient(135deg,rgba(45,27,78,.1),rgba(26,13,46,.05)); padding: 25px 25px 25px 45px; border-radius: 10px; border-left: 4px solid #40e0d0; margin: 25px 0; box-shadow: 0 3px 10px rgba(0,0,0,.1); }
      li { margin-bottom: 12px; line-height: 1.8; color: #444; }
      li strong { color: #2d1b4e; }
      center { margin: 40px 0; }
      center h1 { background: linear-gradient(135deg,#2d1b4e,#1a0d2e,#0d0d1a); color: #40e0d0; padding: 30px; border-radius: 10px; box-shadow: 0 5px 20px rgba(64,224,208,.3); font-size: 16px; line-height: 1.8; text-align: center; border: 2px solid rgba(64,224,208,.4); }
      center h1 font { color: #fff !important; }
      /* FAQ */
      .faq-list { margin: 20px 0; }
      .faq-item { border: 1px solid #e0e0e0; border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
      .faq-q { width: 100%; background: linear-gradient(135deg,rgba(45,27,78,.07),rgba(26,13,46,.03)); border: none; padding: 18px 20px; text-align: left; font-size: 16px; font-family: inherit; color: #2d1b4e; font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: .2s; }
      .faq-q:hover { background: rgba(64,224,208,.1); }
      .faq-q[aria-expanded="true"] { background: linear-gradient(135deg,#2d1b4e,#1a0d2e); color: #40e0d0; }
      .faq-q[aria-expanded="true"] .faq-icon { transform: rotate(45deg); }
      .faq-icon { font-size: 20px; transition: .2s; flex-shrink: 0; margin-left: 12px; }
      .faq-a { padding: 18px 20px; color: #444; line-height: 1.8; border-top: 1px solid #e0e0e0; }
      @media (max-width: 768px) {
        body { padding: 10px; }
        #icerik { padding: 20px; }
        #breadcrumb { padding: 15px; }
        #breadcrumb a { font-size: 11px; padding: 6px 12px; }
        table { font-size: 14px; }
        table th, table td { padding: 10px; }
        h2 { font-size: 20px; }
        center h1 { font-size: 14px; padding: 20px; }
        .faq-q { font-size: 14px; padding: 14px 16px; }
      }
    </style>
</head>
<body>
  <div id="icerik">
    <header>
      <div id="breadcrumb">
${breadcrumbLinks}
      </div>

${sectionRows(before)}

      <h2>${esc(m.table1_h2)}</h2>
      <p>${m.table1_intro||''}</p>
      <table>
        <thead><tr><th>${esc(m.table1_th1)}</th><th>${esc(m.table1_th2)}</th><th>${esc(m.table1_th3)}</th></tr></thead>
        <tbody>${table1Body}</tbody>
      </table>

      ${m.footer_para ? `<p>${m.footer_para}</p>` : ''}

${sectionRows(after)}

      <h2>${esc(m.table2_h2)}</h2>
      <p>${m.table2_intro||''}</p>
      <table>
        <thead><tr><th>${esc(m.table2_th1)}</th><th>${esc(m.table2_th2)}</th><th>${esc(m.table2_th3)}</th></tr></thead>
        <tbody>${table2Body}</tbody>
      </table>

      <h2>${esc(m.tips_h2)}</h2>
      <ul>${tipsItems}</ul>

      ${faqBlock}

      <center><h1><font color="black"><b>${esc(m.center_text)}</b></font></h1></center>
    </header>
  </div>
${m.cf_beacon_src ? `  <script defer src="${esc(m.cf_beacon_src)}" integrity="${esc(m.cf_beacon_integrity)}" data-cf-beacon='{"version":"2024.11.0","token":"${esc(m.cf_beacon_token)}","r":1,"server_timing":{"name":{"cfCacheStatus":true,"cfEdge":true,"cfExtPri":true,"cfL4":true,"cfOrigin":true,"cfSpeedBrain":true},"location_startswith":null}}' crossorigin="anonymous"></script>` : ''}
  <script>
    function toggleFaq(btn) {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      var targetId = btn.getAttribute('aria-controls');
      var panel = document.getElementById(targetId);
      btn.setAttribute('aria-expanded', !expanded);
      if (expanded) { panel.hidden = true; } else { panel.hidden = false; }
    }
  </script>
</body></html>`;

    res.send(html);
});

// ══════════════════════════════════════════════════════════════════════════════
// SEO UTILITY ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.get('/robots.txt', (req, res) => {
    const m = getMeta();
    const content = m.robots_txt_content ||
        `User-agent: *\nAllow: /\nSitemap: ${(m.og_url || m.canonical_url || '').replace(/\/$/, '')}/sitemap.xml`;
    res.set('Content-Type', 'text/plain; charset=UTF-8');
    res.send(content);
});

app.get('/sitemap.xml', (req, res) => {
    const m    = getMeta();
    const base = (m.og_url || m.canonical_url || '').replace(/\/$/, '');
    const freq = m.sitemap_changefreq || 'daily';
    const pri  = m.sitemap_priority   || '0.8';
    const lastmod = (m.date_modified || new Date().toISOString()).slice(0, 10);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>
  </url>
</urlset>`;
    res.set('Content-Type', 'application/xml; charset=UTF-8');
    res.send(xml);
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.get('/admin', (req, res) => res.redirect('/admin/login'));

app.get('/admin/login', (req, res) => {
    if (req.session.admin) return res.redirect('/admin/dashboard');
    res.send(loginPage());
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM admin_users WHERE username=?').get(username);
    if (user && bcrypt.compareSync(password, user.password_hash)) {
        req.session.admin = true;
        return res.redirect('/admin/dashboard');
    }
    res.send(loginPage('Kullanıcı adı veya şifre hatalı.'));
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

app.get('/admin/dashboard', requireAdmin, (req, res) => {
    const m    = getMeta();
    const bcs  = db.prepare('SELECT * FROM breadcrumbs ORDER BY sort_order').all();
    const secs = db.prepare('SELECT * FROM sections ORDER BY sort_order').all();
    const t1   = db.prepare('SELECT * FROM table1_rows ORDER BY sort_order').all();
    const t2   = db.prepare('SELECT * FROM table2_rows ORDER BY sort_order').all();
    const tips = db.prepare('SELECT * FROM tips ORDER BY sort_order').all();
    const sbcs = db.prepare('SELECT * FROM schema_breadcrumbs ORDER BY position').all();
    const faqs = db.prepare('SELECT * FROM faq_items ORDER BY sort_order').all();
    res.send(dashboardPage(m, bcs, secs, t1, t2, tips, sbcs, faqs));
});

// ── API SAVE ENDPOINTS ────────────────────────────────────────────────────────
app.post('/admin/api/save-meta', requireAdmin, (req, res) => {
    const allowed = [
        'site_title','meta_description','meta_keywords','meta_author',
        'meta_robots','meta_language','meta_revisit',
        'og_title','og_description','og_type','og_url',
        'og_image','og_image_width','og_image_height','og_site_name','og_locale','og_locale_alternate',
        'twitter_card','twitter_site','twitter_creator','twitter_image',
        'canonical_url','hreflang_tr','hreflang_default',
        'favicon_32','favicon_192','apple_touch_icon','theme_color','profile_url',
        'redirect_url',
        'schema_org_name','schema_org_altname','schema_org_url','schema_org_logo',
        'google_site_verify','cf_beacon_src','cf_beacon_integrity','cf_beacon_token',
        'table1_h2','table1_intro','table1_th1','table1_th2','table1_th3',
        'table2_h2','table2_intro','table2_th1','table2_th2','table2_th3',
        'tips_h2','center_text','footer_para',
        'date_published','date_modified',
        'website_name','website_url','search_action_target',
        'service_name','service_type','service_description','service_area',
        'article_section',
        'faq_section_title','faq_section_enabled',
        'robots_txt_content','sitemap_changefreq','sitemap_priority',
        'preconnect_urls','referrer_policy','content_language',
    ];
    const upsert = db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const tx = db.transaction(() => {
        for (const key of allowed) {
            if (req.body[key] !== undefined) upsert.run(key, req.body[key]);
        }
    });
    tx();
    res.json({ ok: true });
});

app.post('/admin/api/save-breadcrumbs', requireAdmin, (req, res) => {
    const texts = [].concat(req.body['text[]'] || req.body.text || []);
    const hrefs = [].concat(req.body['href[]'] || req.body.href || []);
    const tx = db.transaction(() => {
        db.prepare('DELETE FROM breadcrumbs').run();
        const ins = db.prepare('INSERT INTO breadcrumbs(text,href,sort_order) VALUES(?,?,?)');
        let order = 0;
        texts.forEach((t, i) => {
            t = (t || '').trim();
            if (t) ins.run(t, (hrefs[i] || '#').trim(), order++);
        });
    });
    tx();
    res.json({ ok: true });
});

app.post('/admin/api/save-sections', requireAdmin, (req, res) => {
    const ids      = [].concat(req.body['id[]']      || req.body.id      || []);
    const headings = [].concat(req.body['heading[]'] || req.body.heading || []);
    const bodies   = [].concat(req.body['body[]']    || req.body.body    || []);

    const existing  = db.prepare('SELECT id FROM sections').all().map(r => r.id);
    const submitted = [];

    const upsert = db.prepare('INSERT INTO sections(id,heading,body,sort_order) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET heading=excluded.heading,body=excluded.body,sort_order=excluded.sort_order');
    const insert = db.prepare('INSERT INTO sections(heading,body,sort_order) VALUES(?,?,?)');
    const del    = db.prepare('DELETE FROM sections WHERE id=?');

    const tx = db.transaction(() => {
        headings.forEach((h, i) => {
            h = (h || '').trim();
            if (!h) return;
            const b  = (bodies[i] || '').trim();
            const id = parseInt(ids[i] || 0);
            if (id > 0) {
                upsert.run(id, h, b, i);
                submitted.push(id);
            } else {
                insert.run(h, b, i);
                submitted.push(db.prepare('SELECT last_insert_rowid() as id').get().id);
            }
        });
        existing.forEach(eid => { if (!submitted.includes(eid)) del.run(eid); });
    });
    tx();
    res.json({ ok: true });
});

app.post('/admin/api/save-table1', requireAdmin, (req, res) => {
    const ids   = [].concat(req.body['id[]']       || req.body.id       || []);
    const types = [].concat(req.body['col_type[]'] || req.body.col_type || []);
    const feats = [].concat(req.body['col_feat[]'] || req.body.col_feat || []);
    const accs  = [].concat(req.body['col_acc[]']  || req.body.col_acc  || []);

    const existing  = db.prepare('SELECT id FROM table1_rows').all().map(r=>r.id);
    const submitted = [];
    const upsert = db.prepare('INSERT INTO table1_rows(id,col_type,col_features,col_access,sort_order) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET col_type=excluded.col_type,col_features=excluded.col_features,col_access=excluded.col_access,sort_order=excluded.sort_order');
    const insert = db.prepare('INSERT INTO table1_rows(col_type,col_features,col_access,sort_order) VALUES(?,?,?,?)');
    const del    = db.prepare('DELETE FROM table1_rows WHERE id=?');

    const tx = db.transaction(() => {
        types.forEach((t,i) => {
            t = (t||'').trim();
            if (!t) return;
            const f  = (feats[i]||'').trim();
            const a  = (accs[i]||'7/24 Aktif').trim();
            const id = parseInt(ids[i]||0);
            if (id > 0) { upsert.run(id,t,f,a,i); submitted.push(id); }
            else { insert.run(t,f,a,i); submitted.push(db.prepare('SELECT last_insert_rowid() as id').get().id); }
        });
        existing.forEach(eid => { if (!submitted.includes(eid)) del.run(eid); });
    });
    tx();
    res.json({ ok: true });
});

app.post('/admin/api/save-table2', requireAdmin, (req, res) => {
    const ids   = [].concat(req.body['id[]']       || req.body.id       || []);
    const types = [].concat(req.body['col_type[]'] || req.body.col_type || []);
    const feats = [].concat(req.body['col_feat[]'] || req.body.col_feat || []);
    const durs  = [].concat(req.body['col_dur[]']  || req.body.col_dur  || []);

    const existing  = db.prepare('SELECT id FROM table2_rows').all().map(r=>r.id);
    const submitted = [];
    const upsert = db.prepare('INSERT INTO table2_rows(id,col_type,col_features,col_duration,sort_order) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET col_type=excluded.col_type,col_features=excluded.col_features,col_duration=excluded.col_duration,sort_order=excluded.sort_order');
    const insert = db.prepare('INSERT INTO table2_rows(col_type,col_features,col_duration,sort_order) VALUES(?,?,?,?)');
    const del    = db.prepare('DELETE FROM table2_rows WHERE id=?');

    const tx = db.transaction(() => {
        types.forEach((t,i) => {
            t = (t||'').trim();
            if (!t) return;
            const f  = (feats[i]||'').trim();
            const d  = (durs[i]||'').trim();
            const id = parseInt(ids[i]||0);
            if (id > 0) { upsert.run(id,t,f,d,i); submitted.push(id); }
            else { insert.run(t,f,d,i); submitted.push(db.prepare('SELECT last_insert_rowid() as id').get().id); }
        });
        existing.forEach(eid => { if (!submitted.includes(eid)) del.run(eid); });
    });
    tx();
    res.json({ ok: true });
});

app.post('/admin/api/save-tips', requireAdmin, (req, res) => {
    const ids     = [].concat(req.body['id[]']          || req.body.id          || []);
    const strongs = [].concat(req.body['strong_text[]'] || req.body.strong_text || []);
    const bodies  = [].concat(req.body['body[]']        || req.body.body        || []);

    const existing  = db.prepare('SELECT id FROM tips').all().map(r=>r.id);
    const submitted = [];
    const upsert = db.prepare('INSERT INTO tips(id,strong_text,body,sort_order) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET strong_text=excluded.strong_text,body=excluded.body,sort_order=excluded.sort_order');
    const insert = db.prepare('INSERT INTO tips(strong_text,body,sort_order) VALUES(?,?,?)');
    const del    = db.prepare('DELETE FROM tips WHERE id=?');

    const tx = db.transaction(() => {
        strongs.forEach((s,i) => {
            s = (s||'').trim();
            if (!s) return;
            const b  = (bodies[i]||'').trim();
            const id = parseInt(ids[i]||0);
            if (id > 0) { upsert.run(id,s,b,i); submitted.push(id); }
            else { insert.run(s,b,i); submitted.push(db.prepare('SELECT last_insert_rowid() as id').get().id); }
        });
        existing.forEach(eid => { if (!submitted.includes(eid)) del.run(eid); });
    });
    tx();
    res.json({ ok: true });
});

app.post('/admin/api/save-faq', requireAdmin, (req, res) => {
    const ids       = [].concat(req.body['id[]']       || req.body.id       || []);
    const questions = [].concat(req.body['question[]'] || req.body.question || []);
    const answers   = [].concat(req.body['answer[]']   || req.body.answer   || []);

    const existing  = db.prepare('SELECT id FROM faq_items').all().map(r => r.id);
    const submitted = [];
    const upsert = db.prepare('INSERT INTO faq_items(id,question,answer,sort_order) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET question=excluded.question,answer=excluded.answer,sort_order=excluded.sort_order');
    const insert = db.prepare('INSERT INTO faq_items(question,answer,sort_order) VALUES(?,?,?)');
    const del    = db.prepare('DELETE FROM faq_items WHERE id=?');

    const tx = db.transaction(() => {
        questions.forEach((q, i) => {
            q = (q || '').trim();
            if (!q) return;
            const a  = (answers[i] || '').trim();
            const id = parseInt(ids[i] || 0);
            if (id > 0) { upsert.run(id, q, a, i); submitted.push(id); }
            else { insert.run(q, a, i); submitted.push(db.prepare('SELECT last_insert_rowid() as id').get().id); }
        });
        existing.forEach(eid => { if (!submitted.includes(eid)) del.run(eid); });
    });
    tx();
    res.json({ ok: true });
});

app.post('/admin/api/save-schema-bc', requireAdmin, (req, res) => {
    const positions = [].concat(req.body['position[]'] || req.body.position || []);
    const itemIds   = [].concat(req.body['item_id[]']  || req.body.item_id  || []);
    const names     = [].concat(req.body['name[]']     || req.body.name     || []);

    const tx = db.transaction(() => {
        db.prepare('DELETE FROM schema_breadcrumbs').run();
        const ins = db.prepare('INSERT INTO schema_breadcrumbs(position,item_id,name) VALUES(?,?,?)');
        positions.forEach((p,i) => {
            const id = (itemIds[i]||'').trim();
            const n  = (names[i]||'').trim();
            if (id && n) ins.run(parseInt(p)||i+1, id, n);
        });
    });
    tx();
    res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// STATS API
// ══════════════════════════════════════════════════════════════════════════════
app.get('/admin/api/stats', requireAdmin, async (req, res) => {
    const range = req.query.range || 'today';
    const domain = req.hostname || req.get('host') || 'unknown';
    const stats = await getStats(domain, range);
    if (stats.error) return res.json({ ok: false, error: stats.error });
    res.json({ ok: true, stats });
});

// ══════════════════════════════════════════════════════════════════════════════
// DATABASE EXPORT / IMPORT
// ══════════════════════════════════════════════════════════════════════════════
app.get('/admin/api/export-db', requireAdmin, (req, res) => {
    const data = {
        exported_at: new Date().toISOString(),
        meta:              db.prepare('SELECT * FROM meta').all(),
        breadcrumbs:       db.prepare('SELECT * FROM breadcrumbs ORDER BY sort_order').all(),
        sections:          db.prepare('SELECT * FROM sections ORDER BY sort_order').all(),
        table1_rows:       db.prepare('SELECT * FROM table1_rows ORDER BY sort_order').all(),
        table2_rows:       db.prepare('SELECT * FROM table2_rows ORDER BY sort_order').all(),
        tips:              db.prepare('SELECT * FROM tips ORDER BY sort_order').all(),
        schema_breadcrumbs:db.prepare('SELECT * FROM schema_breadcrumbs ORDER BY position').all(),
        faq_items:         db.prepare('SELECT * FROM faq_items ORDER BY sort_order').all(),
    };
    const filename = `seo-backup-${new Date().toISOString().slice(0,19).replace(/[:.]/g,'-')}.json`;
    res.set({
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(JSON.stringify(data, null, 2));
});

app.post('/admin/api/import-db', requireAdmin, upload.single('db_file'), (req, res) => {
    if (!req.file) return res.json({ ok: false, error: 'Dosya yüklenmedi.' });
    let data;
    try { data = JSON.parse(req.file.buffer.toString('utf8')); }
    catch (e) { return res.json({ ok: false, error: 'Geçersiz JSON dosyası.' }); }

    try {
        db.transaction(() => {
            if (Array.isArray(data.meta)) {
                db.prepare('DELETE FROM meta').run();
                const ins = db.prepare('INSERT INTO meta(key,value) VALUES(?,?)');
                data.meta.forEach(r => ins.run(r.key, r.value));
            }
            if (Array.isArray(data.breadcrumbs)) {
                db.prepare('DELETE FROM breadcrumbs').run();
                const ins = db.prepare('INSERT INTO breadcrumbs(id,text,href,sort_order) VALUES(?,?,?,?)');
                data.breadcrumbs.forEach(r => ins.run(r.id, r.text, r.href, r.sort_order));
            }
            if (Array.isArray(data.sections)) {
                db.prepare('DELETE FROM sections').run();
                const ins = db.prepare('INSERT INTO sections(id,heading,body,sort_order) VALUES(?,?,?,?)');
                data.sections.forEach(r => ins.run(r.id, r.heading, r.body, r.sort_order));
            }
            if (Array.isArray(data.table1_rows)) {
                db.prepare('DELETE FROM table1_rows').run();
                const ins = db.prepare('INSERT INTO table1_rows(id,col_type,col_features,col_access,sort_order) VALUES(?,?,?,?,?)');
                data.table1_rows.forEach(r => ins.run(r.id, r.col_type, r.col_features, r.col_access, r.sort_order));
            }
            if (Array.isArray(data.table2_rows)) {
                db.prepare('DELETE FROM table2_rows').run();
                const ins = db.prepare('INSERT INTO table2_rows(id,col_type,col_features,col_duration,sort_order) VALUES(?,?,?,?,?)');
                data.table2_rows.forEach(r => ins.run(r.id, r.col_type, r.col_features, r.col_duration, r.sort_order));
            }
            if (Array.isArray(data.tips)) {
                db.prepare('DELETE FROM tips').run();
                const ins = db.prepare('INSERT INTO tips(id,strong_text,body,sort_order) VALUES(?,?,?,?)');
                data.tips.forEach(r => ins.run(r.id, r.strong_text, r.body, r.sort_order));
            }
            if (Array.isArray(data.schema_breadcrumbs)) {
                db.prepare('DELETE FROM schema_breadcrumbs').run();
                const ins = db.prepare('INSERT INTO schema_breadcrumbs(id,position,item_id,name) VALUES(?,?,?,?)');
                data.schema_breadcrumbs.forEach(r => ins.run(r.id, r.position, r.item_id, r.name));
            }
            if (Array.isArray(data.faq_items)) {
                db.prepare('DELETE FROM faq_items').run();
                const ins = db.prepare('INSERT INTO faq_items(id,question,answer,sort_order) VALUES(?,?,?,?)');
                data.faq_items.forEach(r => ins.run(r.id, r.question, r.answer, r.sort_order));
            }
        })();
        res.json({ ok: true });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// KEYWORD EXTRACTION & BULK REPLACE
// ══════════════════════════════════════════════════════════════════════════════
const TEXT_META_KEYS = [
    'site_title','meta_description','meta_keywords','og_title','og_description','og_site_name',
    'table1_h2','table1_intro','table2_h2','table2_intro','tips_h2','center_text','footer_para',
    'service_name','service_description','faq_section_title','article_section',
    'schema_org_name','schema_org_altname','website_name',
];

function stripHtml(str) {
    return (str || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
}

function extractKeywords() {
    const texts = [];
    const m = getMeta();
    TEXT_META_KEYS.forEach(k => { if (m[k]) texts.push(stripHtml(m[k])); });

    db.prepare('SELECT heading, body FROM sections').all()
        .forEach(r => { texts.push(r.heading); texts.push(stripHtml(r.body)); });
    db.prepare('SELECT text FROM breadcrumbs').all()
        .forEach(r => texts.push(r.text));
    db.prepare('SELECT col_type, col_features FROM table1_rows').all()
        .forEach(r => { texts.push(r.col_type); texts.push(stripHtml(r.col_features)); });
    db.prepare('SELECT col_type, col_features FROM table2_rows').all()
        .forEach(r => { texts.push(r.col_type); texts.push(stripHtml(r.col_features)); });
    db.prepare('SELECT strong_text, body FROM tips').all()
        .forEach(r => { texts.push(r.strong_text); texts.push(stripHtml(r.body)); });
    db.prepare('SELECT question, answer FROM faq_items').all()
        .forEach(r => { texts.push(r.question); texts.push(stripHtml(r.answer)); });

    const combined = texts.join(' ')
        .replace(/[^\wğüşıöçĞÜŞİÖÇ\s]/g, ' ')
        .replace(/\s+/g, ' ').toLowerCase();
    const words = combined.split(' ').filter(w => w.length > 2);

    const STOPWORDS = new Set(['bir','bu','ve','ile','için','den','dan','nin','nın','nun','nün',
        'ler','lar','mı','mi','mu','mü','de','da','te','ta','bir','en','çok','tüm','her',
        'olan','olarak','olan','gibi','kadar','veya','ama','çünkü','ancak','ise','var',
        'yok','biz','siz','onlar','ben','sen','the','and','for','are','that','this','with']);

    const freq = {};
    for (let n = 1; n <= 4; n++) {
        for (let i = 0; i <= words.length - n; i++) {
            const ngram = words.slice(i, i + n);
            if (ngram.some(w => STOPWORDS.has(w))) continue;
            const phrase = ngram.join(' ');
            if (phrase.length < 3) continue;
            freq[phrase] = (freq[phrase] || 0) + 1;
        }
    }

    return Object.entries(freq)
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 150)
        .map(([phrase, count]) => ({ phrase, count }));
}

app.get('/admin/api/keywords', requireAdmin, (req, res) => {
    res.json({ ok: true, keywords: extractKeywords() });
});

app.post('/admin/api/replace-keyword', requireAdmin, (req, res) => {
    const from = (req.body.from || '').trim();
    const to   = (req.body.to   || '').trim();
    if (!from) return res.json({ ok: false, error: '"Değiştirilecek" boş olamaz.' });

    const safeFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safeFrom, 'gi');
    const repl = str => str ? str.replace(re, to) : str;

    let changed = 0;
    try {
        db.transaction(() => {
            // Meta
            db.prepare('SELECT key, value FROM meta').all().forEach(r => {
                if (!TEXT_META_KEYS.includes(r.key)) return;
                const v = repl(r.value);
                if (v !== r.value) { db.prepare('UPDATE meta SET value=? WHERE key=?').run(v, r.key); changed++; }
            });
            // Sections
            db.prepare('SELECT id, heading, body FROM sections').all().forEach(r => {
                const h = repl(r.heading), b = repl(r.body);
                if (h !== r.heading || b !== r.body) { db.prepare('UPDATE sections SET heading=?,body=? WHERE id=?').run(h,b,r.id); changed++; }
            });
            // Breadcrumbs
            db.prepare('SELECT id, text FROM breadcrumbs').all().forEach(r => {
                const t = repl(r.text);
                if (t !== r.text) { db.prepare('UPDATE breadcrumbs SET text=? WHERE id=?').run(t, r.id); changed++; }
            });
            // Table1
            db.prepare('SELECT id, col_type, col_features FROM table1_rows').all().forEach(r => {
                const t = repl(r.col_type), f = repl(r.col_features);
                if (t !== r.col_type || f !== r.col_features) { db.prepare('UPDATE table1_rows SET col_type=?,col_features=? WHERE id=?').run(t,f,r.id); changed++; }
            });
            // Table2
            db.prepare('SELECT id, col_type, col_features FROM table2_rows').all().forEach(r => {
                const t = repl(r.col_type), f = repl(r.col_features);
                if (t !== r.col_type || f !== r.col_features) { db.prepare('UPDATE table2_rows SET col_type=?,col_features=? WHERE id=?').run(t,f,r.id); changed++; }
            });
            // Tips
            db.prepare('SELECT id, strong_text, body FROM tips').all().forEach(r => {
                const s = repl(r.strong_text), b = repl(r.body);
                if (s !== r.strong_text || b !== r.body) { db.prepare('UPDATE tips SET strong_text=?,body=? WHERE id=?').run(s,b,r.id); changed++; }
            });
            // FAQ
            db.prepare('SELECT id, question, answer FROM faq_items').all().forEach(r => {
                const q = repl(r.question), a = repl(r.answer);
                if (q !== r.question || a !== r.answer) { db.prepare('UPDATE faq_items SET question=?,answer=? WHERE id=?').run(q,a,r.id); changed++; }
            });
        })();
        res.json({ ok: true, changed });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// HTML TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════
function loginPage(error = '') {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Girişi</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a0d2e,#16213e,#0f0f23)}
.card{background:#fff;border-radius:16px;padding:48px 40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
h1{font-size:22px;color:#2d1b4e;margin-bottom:32px;text-align:center;font-family:'Segoe UI',sans-serif}
label{display:block;font-size:13px;color:#555;margin-bottom:6px;font-family:'Segoe UI',sans-serif}
input{width:100%;padding:12px 16px;border:2px solid #e5e5e5;border-radius:8px;font-size:15px;outline:none;transition:.2s;font-family:'Segoe UI',sans-serif}
input:focus{border-color:#40e0d0}
.field{margin-bottom:20px}
button{width:100%;padding:14px;background:linear-gradient(135deg,#2d1b4e,#1a0d2e);color:#40e0d0;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-family:'Segoe UI',sans-serif}
button:hover{opacity:.9}
.error{background:#fff0f0;border:1px solid #ffcdd2;color:#c62828;padding:12px;border-radius:8px;margin-bottom:20px;font-size:14px;font-family:'Segoe UI',sans-serif}
</style>
</head>
<body>
<div class="card">
  <h1>🔐 Admin Paneli</h1>
  ${error ? `<div class="error">${esc(error)}</div>` : ''}
  <form method="POST" action="/admin/login">
    <div class="field"><label>Kullanıcı Adı</label><input type="text" name="username" required></div>
    <div class="field"><label>Şifre</label><input type="password" name="password" required></div>
    <button type="submit">Giriş Yap</button>
  </form>
</div>
</body></html>`;
}

function dashboardPage(m, bcs, secs, t1, t2, tips, sbcs, faqs = []) {
    const bcRows = bcs.map(b => `
      <div class="bc-row">
        <input type="text" name="text[]" value="${esc(b.text)}" placeholder="Link metni">
        <input type="text" name="href[]" value="${esc(b.href)}" placeholder="https://...">
        <button type="button" class="btn btn-danger" onclick="this.closest('.bc-row').remove()">✕</button>
      </div>`).join('');

    const secRows = secs.map(s => `
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="${s.id}">
        <div class="field"><label>H2 Başlık</label><input type="text" name="heading[]" value="${esc(s.heading)}"></div>
        <div class="field"><label>Paragraf İçeriği (HTML)</label><textarea name="body[]" style="min-height:120px">${esc(s.body)}</textarea></div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕ Sil</button>
      </div>`).join('');

    const t1Rows = t1.map(r => `
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="${r.id}">
        <div class="grid-3">
          <div class="field"><label>İfşa Türü</label><input type="text" name="col_type[]" value="${esc(r.col_type)}"></div>
          <div class="field"><label>Özellikler (HTML)</label><textarea name="col_feat[]">${esc(r.col_features)}</textarea></div>
          <div class="field"><label>Erişim</label><input type="text" name="col_acc[]" value="${esc(r.col_access)}"></div>
        </div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
      </div>`).join('');

    const t2Rows = t2.map(r => `
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="${r.id}">
        <div class="grid-3">
          <div class="field"><label>Paket Adı</label><input type="text" name="col_type[]" value="${esc(r.col_type)}"></div>
          <div class="field"><label>Özellikler (HTML)</label><textarea name="col_feat[]">${esc(r.col_features)}</textarea></div>
          <div class="field"><label>Süre</label><input type="text" name="col_dur[]" value="${esc(r.col_duration)}"></div>
        </div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
      </div>`).join('');

    const tipRows = tips.map(t => `
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="${t.id}">
        <div class="grid-2">
          <div class="field"><label>Kalın Başlık</label><input type="text" name="strong_text[]" value="${esc(t.strong_text)}"></div>
          <div class="field"><label>Açıklama (HTML)</label><textarea name="body[]">${esc(t.body)}</textarea></div>
        </div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
      </div>`).join('');

    const sbcRows = sbcs.map(s => `
      <div class="repeater-row">
        <div class="grid-3">
          <div class="field"><label>Position</label><input type="text" name="position[]" value="${s.position}"></div>
          <div class="field"><label>Item ID</label><input type="text" name="item_id[]" value="${esc(s.item_id)}"></div>
          <div class="field"><label>Name</label><input type="text" name="name[]" value="${esc(s.name)}"></div>
        </div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
      </div>`).join('');

    const faqRows = faqs.map(f => `
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="${f.id}">
        <div class="field"><label>Soru</label><input type="text" name="question[]" value="${esc(f.question)}"></div>
        <div class="field"><label>Cevap (HTML)</label><textarea name="answer[]" style="min-height:100px">${esc(f.answer)}</textarea></div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕ Sil</button>
      </div>`).join('');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Paneli</title>
<style>
:root{--primary:#2d1b4e;--accent:#40e0d0;--bg:#f0f2f5;--white:#fff;--border:#e0e0e0;--text:#333;--muted:#777;--danger:#e53935}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
nav{background:var(--primary);color:#fff;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.3)}
nav h1{font-size:18px;color:var(--accent)}
nav a{color:var(--accent);text-decoration:none;font-size:14px;padding:8px 16px;border:1px solid var(--accent);border-radius:6px}
.preview-bar{background:var(--primary);color:var(--accent);padding:10px 24px;text-align:center;font-size:13px}
.preview-bar a{color:#fff;margin-left:8px}
.container{max-width:1200px;margin:0 auto;padding:24px}
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px}
.tab-btn{padding:10px 18px;border:2px solid var(--border);background:var(--white);border-radius:8px;cursor:pointer;font-size:14px;color:var(--muted);font-family:'Segoe UI',sans-serif}
.tab-btn.active{background:var(--primary);border-color:var(--primary);color:var(--accent)}
.tab-panel{display:none}.tab-panel.active{display:block}
.card{background:var(--white);border-radius:12px;padding:28px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.card h2{font-size:18px;color:var(--primary);margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid var(--accent)}
.card h3{font-size:15px;color:var(--primary);margin:16px 0 10px;font-weight:600}
.field{margin-bottom:18px}
label{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
input[type=text],textarea,select{width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:.2s;color:var(--text)}
input[type=text]:focus,textarea:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:80px;line-height:1.6}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid-3{display:grid;grid-template-columns:1fr 2fr 1fr;gap:10px;align-items:start}
.btn{padding:10px 22px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-family:inherit;font-weight:600}
.btn-primary{background:var(--primary);color:var(--accent)}
.btn-accent{background:var(--accent);color:var(--primary);padding:8px 18px;font-size:13px}
.btn-danger{background:var(--danger);color:#fff;padding:6px 12px;font-size:13px}
.btn-add{background:rgba(64,224,208,.15);border:2px dashed var(--accent);color:var(--primary);width:100%;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;font-family:inherit;margin-top:8px}
.save-row{display:flex;align-items:center;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}
.repeater-row{background:#fafafa;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:10px;position:relative}
.repeater-row .del-btn{position:absolute;top:10px;right:10px}
.bc-row{display:grid;grid-template-columns:1fr 2fr auto;gap:10px;align-items:center;background:#fafafa;border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px}
.alert{display:none;padding:12px 18px;border-radius:8px;font-size:14px;margin-top:0}
.alert.success{background:#e8f5e9;border:1px solid #a5d6a7;color:#2e7d32;display:flex}
.alert.error{background:#ffebee;border:1px solid #ef9a9a;color:#c62828;display:flex}
small{color:var(--muted);font-size:12px;display:block;margin-top:4px}
</style>
</head>
<body>
<nav><h1>⚡ Admin Paneli</h1><a href="/admin/logout">Çıkış Yap</a></nav>
<div class="preview-bar">Web sitesini görüntüle: <a href="/" target="_blank">→ Siteyi Aç</a></div>
<div class="container">

<div class="tabs">
  <button class="tab-btn active" data-tab="meta">SEO & Meta</button>
  <button class="tab-btn" data-tab="social">Sosyal Medya</button>
  <button class="tab-btn" data-tab="breadcrumbs">Breadcrumb Linkler</button>
  <button class="tab-btn" data-tab="sections">İçerik Bölümleri</button>
  <button class="tab-btn" data-tab="table1">Tablo 1 (Hizmetler)</button>
  <button class="tab-btn" data-tab="table2">Tablo 2 (Paketler)</button>
  <button class="tab-btn" data-tab="tips">Tavsiyeler (Liste)</button>
  <button class="tab-btn" data-tab="faq">FAQ Yönetimi</button>
  <button class="tab-btn" data-tab="schema">Schema & JSON-LD</button>
  <button class="tab-btn" data-tab="settings">Diğer Ayarlar</button>
  <button class="tab-btn" data-tab="keyword">Anahtar Kelime</button>
  <button class="tab-btn" data-tab="database">Veritabanı</button>
  <button class="tab-btn" data-tab="stats">İstatistikler</button>
</div>

<!-- META TAB -->
<div id="tab-meta" class="tab-panel active">
<form class="card" onsubmit="save(event,'/admin/api/save-meta',this)">
  <h2>SEO & Meta Etiketler</h2>
  <div class="field"><label>Sayfa Başlığı (title)</label><input type="text" name="site_title" value="${esc(m.site_title||'')}"></div>
  <div class="field"><label>Meta Description</label><textarea name="meta_description">${esc(m.meta_description||'')}</textarea></div>
  <div class="field"><label>Meta Keywords</label><textarea name="meta_keywords">${esc(m.meta_keywords||'')}</textarea></div>
  <div class="grid-2">
    <div class="field"><label>Yazar</label><input type="text" name="meta_author" value="${esc(m.meta_author||'')}"></div>
    <div class="field"><label>Robots</label><input type="text" name="meta_robots" value="${esc(m.meta_robots||'')}"></div>
  </div>
  <div class="grid-2">
    <div class="field"><label>Dil</label><input type="text" name="meta_language" value="${esc(m.meta_language||'')}"></div>
    <div class="field"><label>Revisit After</label><input type="text" name="meta_revisit" value="${esc(m.meta_revisit||'')}"></div>
  </div>
  <h3>Open Graph</h3>
  <div class="field"><label>OG Title</label><input type="text" name="og_title" value="${esc(m.og_title||'')}"></div>
  <div class="field"><label>OG Description</label><textarea name="og_description">${esc(m.og_description||'')}</textarea></div>
  <div class="grid-2">
    <div class="field"><label>OG Type</label><input type="text" name="og_type" value="${esc(m.og_type||'website')}"></div>
    <div class="field"><label>OG URL</label><input type="text" name="og_url" value="${esc(m.og_url||'')}"></div>
  </div>
  <div class="grid-2">
    <div class="field"><label>OG Site Name</label><input type="text" name="og_site_name" value="${esc(m.og_site_name||'')}"></div>
    <div class="field"><label>OG Locale (örn: tr_TR)</label><input type="text" name="og_locale" value="${esc(m.og_locale||'tr_TR')}"></div>
  </div>
  <div class="grid-2">
    <div class="field"><label>OG Locale Alternate</label><input type="text" name="og_locale_alternate" value="${esc(m.og_locale_alternate||'')}"></div>
    <div class="field"><label>Content Language (örn: tr)</label><input type="text" name="content_language" value="${esc(m.content_language||'tr')}"></div>
  </div>
  <div class="field"><label>OG Image URL</label><input type="text" name="og_image" value="${esc(m.og_image||'')}"><small>1200×630 px önerilen boyut</small></div>
  <div class="grid-2">
    <div class="field"><label>OG Image Width</label><input type="text" name="og_image_width" value="${esc(m.og_image_width||'1200')}"></div>
    <div class="field"><label>OG Image Height</label><input type="text" name="og_image_height" value="${esc(m.og_image_height||'630')}"></div>
  </div>
  <h3>URL Ayarları</h3>
  <div class="field"><label>Canonical URL</label><input type="text" name="canonical_url" value="${esc(m.canonical_url||'')}"></div>
  <div class="grid-2">
    <div class="field"><label>hreflang TR</label><input type="text" name="hreflang_tr" value="${esc(m.hreflang_tr||'')}"></div>
    <div class="field"><label>hreflang x-default</label><input type="text" name="hreflang_default" value="${esc(m.hreflang_default||'')}"></div>
  </div>
  <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
</form>
</div>

<!-- SOCIAL MEDIA TAB -->
<div id="tab-social" class="tab-panel">
<div class="card">
  <h2>Twitter / X Cards</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="grid-2">
      <div class="field"><label>Card Type</label>
        <select name="twitter_card">
          <option value="summary_large_image" ${m.twitter_card==='summary_large_image'?'selected':''}>summary_large_image</option>
          <option value="summary" ${m.twitter_card==='summary'?'selected':''}>summary</option>
        </select>
      </div>
      <div class="field"><label>Twitter Site (@kullanici)</label><input type="text" name="twitter_site" value="${esc(m.twitter_site||'')}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Twitter Creator (@kullanici)</label><input type="text" name="twitter_creator" value="${esc(m.twitter_creator||'')}"></div>
      <div class="field"><label>Twitter Image URL</label><input type="text" name="twitter_image" value="${esc(m.twitter_image||'')}"></div>
    </div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Tarih Sinyalleri</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="grid-2">
      <div class="field"><label>Yayın Tarihi (ISO 8601)</label><input type="text" name="date_published" value="${esc(m.date_published||'')}" placeholder="2026-01-15T10:00:00+03:00"><small>article:published_time ve Article schema için kullanılır</small></div>
      <div class="field"><label>Güncelleme Tarihi (ISO 8601)</label><input type="text" name="date_modified" value="${esc(m.date_modified||'')}" placeholder="2026-04-21T12:00:00+03:00"><small>Last-Modified header ve article:modified_time için</small></div>
    </div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Preconnect & Performans</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Preconnect URL'leri (virgülle ayırın)</label>
      <textarea name="preconnect_urls" style="min-height:80px">${esc(m.preconnect_urls||'')}</textarea>
      <small>Örn: https://fonts.googleapis.com,https://fonts.gstatic.com</small></div>
    <div class="field"><label>Referrer Policy</label>
      <select name="referrer_policy">
        <option value="strict-origin-when-cross-origin" ${(m.referrer_policy||'strict-origin-when-cross-origin')==='strict-origin-when-cross-origin'?'selected':''}>strict-origin-when-cross-origin</option>
        <option value="no-referrer" ${m.referrer_policy==='no-referrer'?'selected':''}>no-referrer</option>
        <option value="origin" ${m.referrer_policy==='origin'?'selected':''}>origin</option>
        <option value="unsafe-url" ${m.referrer_policy==='unsafe-url'?'selected':''}>unsafe-url</option>
      </select></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- BREADCRUMBS TAB -->
<div id="tab-breadcrumbs" class="tab-panel">
<div class="card">
  <h2>Breadcrumb Linkleri</h2>
  <form onsubmit="save(event,'/admin/api/save-breadcrumbs',this)">
    <div id="bc-list">${bcRows}</div>
    <button type="button" class="btn-add" onclick="addBcRow()">+ Yeni Link Ekle</button>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- SECTIONS TAB -->
<div id="tab-sections" class="tab-panel">
<div class="card">
  <h2>İçerik Bölümleri (H2 + Paragraf)</h2>
  <p style="color:var(--muted);font-size:13px;margin-bottom:16px">Paragraf alanında HTML kullanabilirsiniz. &lt;strong&gt;, &lt;a&gt;, &lt;p&gt; gibi etiketler desteklenir.</p>
  <form onsubmit="save(event,'/admin/api/save-sections',this)">
    <div id="sections-list">${secRows}</div>
    <button type="button" class="btn-add" onclick="addSection()">+ Yeni Bölüm Ekle</button>
    <div class="save-row"><button class="btn btn-primary" type="submit">Tümünü Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- TABLE 1 TAB -->
<div id="tab-table1" class="tab-panel">
<div class="card">
  <h2>Tablo 1 - Başlık ve Üst Bilgiler</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Tablo H2 Başlığı</label><input type="text" name="table1_h2" value="${esc(m.table1_h2||'')}"></div>
    <div class="field"><label>Tablo Giriş Paragrafı (HTML)</label><textarea name="table1_intro">${esc(m.table1_intro||'')}</textarea></div>
    <div class="grid-3">
      <div class="field"><label>Sütun 1 Başlığı</label><input type="text" name="table1_th1" value="${esc(m.table1_th1||'')}"></div>
      <div class="field"><label>Sütun 2 Başlığı</label><input type="text" name="table1_th2" value="${esc(m.table1_th2||'')}"></div>
      <div class="field"><label>Sütun 3 Başlığı</label><input type="text" name="table1_th3" value="${esc(m.table1_th3||'')}"></div>
    </div>
    <div class="save-row"><button class="btn btn-accent" type="submit">Başlıkları Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Tablo 1 Satırları</h2>
  <form onsubmit="save(event,'/admin/api/save-table1',this)">
    <div id="t1-list">${t1Rows}</div>
    <button type="button" class="btn-add" onclick="addT1Row()">+ Yeni Satır Ekle</button>
    <div class="save-row"><button class="btn btn-primary" type="submit">Satırları Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Tablo Altı Paragraf</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Footer Paragrafı (HTML)</label><textarea name="footer_para" style="min-height:100px">${esc(m.footer_para||'')}</textarea></div>
    <div class="save-row"><button class="btn btn-accent" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- TABLE 2 TAB -->
<div id="tab-table2" class="tab-panel">
<div class="card">
  <h2>Tablo 2 - Paketler</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Tablo H2 Başlığı</label><input type="text" name="table2_h2" value="${esc(m.table2_h2||'')}"></div>
    <div class="field"><label>Tablo Giriş Paragrafı (HTML)</label><textarea name="table2_intro">${esc(m.table2_intro||'')}</textarea></div>
    <div class="grid-3">
      <div class="field"><label>Sütun 1</label><input type="text" name="table2_th1" value="${esc(m.table2_th1||'')}"></div>
      <div class="field"><label>Sütun 2</label><input type="text" name="table2_th2" value="${esc(m.table2_th2||'')}"></div>
      <div class="field"><label>Sütun 3</label><input type="text" name="table2_th3" value="${esc(m.table2_th3||'')}"></div>
    </div>
    <div class="save-row"><button class="btn btn-accent" type="submit">Başlıkları Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Paket Satırları</h2>
  <form onsubmit="save(event,'/admin/api/save-table2',this)">
    <div id="t2-list">${t2Rows}</div>
    <button type="button" class="btn-add" onclick="addT2Row()">+ Yeni Satır Ekle</button>
    <div class="save-row"><button class="btn btn-primary" type="submit">Satırları Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- TIPS TAB -->
<div id="tab-tips" class="tab-panel">
<div class="card">
  <h2>Tavsiyeler Bölümü</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Bölüm H2 Başlığı</label><input type="text" name="tips_h2" value="${esc(m.tips_h2||'')}"></div>
    <div class="save-row"><button class="btn btn-accent" type="submit">Başlığı Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Liste Maddeleri</h2>
  <form onsubmit="save(event,'/admin/api/save-tips',this)">
    <div id="tips-list">${tipRows}</div>
    <button type="button" class="btn-add" onclick="addTip()">+ Yeni Madde Ekle</button>
    <div class="save-row"><button class="btn btn-primary" type="submit">Listeyi Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Merkez Anahtar Kelime Bloğu (center h1)</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Metin</label><textarea name="center_text" style="min-height:100px">${esc(m.center_text||'')}</textarea></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- FAQ TAB -->
<div id="tab-faq" class="tab-panel">
<div class="card">
  <h2>FAQ Bölümü Ayarları</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="grid-2">
      <div class="field"><label>Bölüm Başlığı</label><input type="text" name="faq_section_title" value="${esc(m.faq_section_title||'Sıkça Sorulan Sorular')}"></div>
      <div class="field"><label>FAQ Bölümünü Göster</label>
        <select name="faq_section_enabled">
          <option value="1" ${m.faq_section_enabled==='1'?'selected':''}>Aktif</option>
          <option value="0" ${m.faq_section_enabled!=='1'?'selected':''}>Pasif</option>
        </select>
        <small>FAQPage schema da otomatik eklenir/kaldırılır</small></div>
    </div>
    <div class="save-row"><button class="btn btn-accent" type="submit">Ayarları Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Soru & Cevap Listesi</h2>
  <form onsubmit="save(event,'/admin/api/save-faq',this)">
    <div id="faq-list">${faqRows}</div>
    <button type="button" class="btn-add" onclick="addFaq()">+ Yeni Soru Ekle</button>
    <div class="save-row"><button class="btn btn-primary" type="submit">Tümünü Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- SCHEMA TAB -->
<div id="tab-schema" class="tab-panel">
<div class="card">
  <h2>Organization Schema</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="grid-2">
      <div class="field"><label>Organizasyon Adı</label><input type="text" name="schema_org_name" value="${esc(m.schema_org_name||'')}"></div>
      <div class="field"><label>URL</label><input type="text" name="schema_org_url" value="${esc(m.schema_org_url||'')}"></div>
    </div>
    <div class="field"><label>Alternate Name</label><input type="text" name="schema_org_altname" value="${esc(m.schema_org_altname||'')}"></div>
    <div class="field"><label>Logo URL</label><input type="text" name="schema_org_logo" value="${esc(m.schema_org_logo||'')}"></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>WebSite Schema & Arama Kutusu</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="grid-2">
      <div class="field"><label>Website Adı</label><input type="text" name="website_name" value="${esc(m.website_name||'')}"></div>
      <div class="field"><label>Website URL</label><input type="text" name="website_url" value="${esc(m.website_url||'')}"></div>
    </div>
    <div class="field"><label>SearchAction URL Şablonu</label>
      <input type="text" name="search_action_target" value="${esc(m.search_action_target||'')}" placeholder="https://ornek.com/?s={search_term_string}">
      <small>Boş bırakırsanız SearchAction eklenmez. Google Sitelinks arama kutusu için gerekli.</small></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Service Schema</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="grid-2">
      <div class="field"><label>Hizmet Adı</label><input type="text" name="service_name" value="${esc(m.service_name||'')}"></div>
      <div class="field"><label>Hizmet Türü (@type)</label><input type="text" name="service_type" value="${esc(m.service_type||'Service')}" placeholder="Service, ProfessionalService..."></div>
    </div>
    <div class="field"><label>Hizmet Açıklaması</label><textarea name="service_description">${esc(m.service_description||'')}</textarea></div>
    <div class="field"><label>Hizmet Bölgesi</label><input type="text" name="service_area" value="${esc(m.service_area||'')}" placeholder="Türkiye, İstanbul..."></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Article Schema</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Article Section (Kategori)</label><input type="text" name="article_section" value="${esc(m.article_section||'')}" placeholder="Teknoloji, Hizmet..."><small>Tarih ayarları için Sosyal Medya sekmesini kullanın</small></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>BreadcrumbList Schema</h2>
  <form onsubmit="save(event,'/admin/api/save-schema-bc',this)">
    <div id="sbc-list">${sbcRows}</div>
    <button type="button" class="btn-add" onclick="addSbc()">+ Yeni Breadcrumb Ekle</button>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- SETTINGS TAB -->
<div id="tab-settings" class="tab-panel">
<div class="card">
  <h2>Yönlendirme Ayarları</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>JS Redirect URL (Cloaking)</label>
      <input type="text" name="redirect_url" value="${esc(m.redirect_url||'')}">
      <small>Arama motorundan gelen insan kullanıcıları bu URL'ye yönlendirir. Boş bırakırsanız script eklenmez.</small></div>
    <div class="field"><label>Google Site Verification</label><input type="text" name="google_site_verify" value="${esc(m.google_site_verify||'')}"></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>robots.txt İçeriği</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>robots.txt</label>
      <textarea name="robots_txt_content" style="min-height:140px;font-family:monospace">${esc(m.robots_txt_content||'User-agent: *\nAllow: /\nSitemap: https://siteniz.com/sitemap.xml')}</textarea>
      <small>Kaydettikten sonra /robots.txt adresinde yayınlanır.</small></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Sitemap Ayarları</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="grid-2">
      <div class="field"><label>Change Frequency</label>
        <select name="sitemap_changefreq">
          <option value="always"  ${m.sitemap_changefreq==='always'?'selected':''}>always</option>
          <option value="hourly"  ${m.sitemap_changefreq==='hourly'?'selected':''}>hourly</option>
          <option value="daily"   ${(m.sitemap_changefreq||'daily')==='daily'?'selected':''}>daily</option>
          <option value="weekly"  ${m.sitemap_changefreq==='weekly'?'selected':''}>weekly</option>
          <option value="monthly" ${m.sitemap_changefreq==='monthly'?'selected':''}>monthly</option>
          <option value="yearly"  ${m.sitemap_changefreq==='yearly'?'selected':''}>yearly</option>
        </select></div>
      <div class="field"><label>Priority (0.0 – 1.0)</label><input type="text" name="sitemap_priority" value="${esc(m.sitemap_priority||'0.8')}"></div>
    </div>
    <small>Sitemap /sitemap.xml adresinde otomatik oluşturulur.</small>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Favicon & İkonlar</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Favicon 32x32 URL</label><input type="text" name="favicon_32" value="${esc(m.favicon_32||'')}"></div>
    <div class="field"><label>Favicon 192x192 URL</label><input type="text" name="favicon_192" value="${esc(m.favicon_192||'')}"></div>
    <div class="field"><label>Apple Touch Icon URL</label><input type="text" name="apple_touch_icon" value="${esc(m.apple_touch_icon||'')}"></div>
    <div class="grid-2">
      <div class="field"><label>Theme Color</label><input type="text" name="theme_color" value="${esc(m.theme_color||'')}"></div>
      <div class="field"><label>Profile URL</label><input type="text" name="profile_url" value="${esc(m.profile_url||'')}"></div>
    </div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
<div class="card">
  <h2>Cloudflare Beacon</h2>
  <form onsubmit="save(event,'/admin/api/save-meta',this)">
    <div class="field"><label>Beacon Script URL</label><input type="text" name="cf_beacon_src" value="${esc(m.cf_beacon_src||'')}"></div>
    <div class="field"><label>Integrity Hash</label><input type="text" name="cf_beacon_integrity" value="${esc(m.cf_beacon_integrity||'')}"></div>
    <div class="field"><label>Token</label><input type="text" name="cf_beacon_token" value="${esc(m.cf_beacon_token||'')}"></div>
    <div class="save-row"><button class="btn btn-primary" type="submit">Kaydet</button><div class="alert"></div></div>
  </form>
</div>
</div>

<!-- KEYWORD TAB -->
<div id="tab-keyword" class="tab-panel">
<div class="card">
  <h2>Anahtar Kelime Toplu Değiştirme</h2>
  <p style="color:var(--muted);font-size:13px;margin-bottom:18px">Tüm site içeriğinde (meta, başlıklar, tablolar, bölümler, FAQ) geçen kelime öbeklerini tek seferde değiştirir. <strong>İşlemden önce veritabanını yedekleyin!</strong></p>
  <div id="kw-replace-form" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:24px">
    <div class="field" style="flex:1;min-width:200px;margin:0"><label>Değiştirilecek Kelime/Öbek</label><input type="text" id="kw-from" placeholder="örn: eski anahtar kelime"></div>
    <div class="field" style="flex:1;min-width:200px;margin:0"><label>Yeni Kelime/Öbek</label><input type="text" id="kw-to" placeholder="örn: bilgisayar klavyesi"></div>
    <button class="btn btn-primary" onclick="doReplace()">Tümünü Değiştir</button>
  </div>
  <div id="kw-alert" class="alert" style="margin-bottom:16px"></div>
  <h3>Sitedeki Mevcut Anahtar Kelime Öbekleri</h3>
  <p style="color:var(--muted);font-size:12px;margin-bottom:12px">Sıklığa göre sıralanmıştır. Herhangi birine tıklayarak "Değiştirilecek" alanına taşıyabilirsiniz.</p>
  <div style="margin-bottom:12px"><button class="btn btn-accent" onclick="loadKeywords()">Anahtar Kelimeleri Analiz Et</button></div>
  <div id="kw-list" style="display:flex;flex-wrap:wrap;gap:8px;max-height:400px;overflow-y:auto;padding:4px"></div>
</div>
</div>

<!-- DATABASE TAB -->
<div id="tab-database" class="tab-panel">
<div class="card">
  <h2>Veritabanı Yedekle (Export)</h2>
  <p style="color:var(--muted);font-size:13px;margin-bottom:18px">Tüm içerik (meta, bölümler, tablolar, FAQ vb.) JSON formatında indirilir. Anahtar kelime değiştirmeden önce mutlaka yedek alın.</p>
  <a href="/admin/api/export-db" class="btn btn-primary" style="text-decoration:none;display:inline-block">İndir (JSON Yedek)</a>
</div>
<div class="card">
  <h2>Veritabanı Geri Yükle (Import)</h2>
  <p style="color:var(--muted);font-size:13px;margin-bottom:18px">Daha önce dışa aktardığınız JSON dosyasını yükleyerek tüm içeriği geri yükleyin. <strong style="color:#c62828">Mevcut tüm içerik silinir ve dosyadaki içerikle değiştirilir!</strong></p>
  <form id="import-form" onsubmit="doImport(event)">
    <div class="field">
      <label>JSON Yedek Dosyası</label>
      <input type="file" id="import-file" accept=".json" style="border:2px dashed var(--border);padding:16px;border-radius:8px;width:100%;cursor:pointer">
    </div>
    <div class="save-row">
      <button class="btn btn-primary" type="submit" style="background:#c62828;color:#fff">Geri Yükle (Mevcut Veriyi Sil)</button>
      <div class="alert" id="import-alert"></div>
    </div>
  </form>
</div>
</div>

</div>

<!-- STATS TAB -->
<div id="tab-stats" class="tab-panel">
<div class="card">
  <h2>Site İstatistikleri</h2>
  <div class="tabs" style="margin-bottom:15px;">
    <button class="btn btn-accent" onclick="loadStats('today')">Bugün</button>
    <button class="btn btn-accent" onclick="loadStats('week')">Bu Hafta</button>
    <button class="btn btn-accent" onclick="loadStats('month')">Bu Ay</button>
  </div>
  <div id="stats-container">Yükleniyor...</div>
</div>
</div>

</div>
<script>
function loadStats(range = 'today') {
  const container = document.getElementById('stats-container');
  container.innerHTML = '<span style="color:var(--muted)">Analiz ediliyor...</span>';
  fetch('/admin/api/stats?range=' + range)
    .then(r => r.json())
    .then(d => {
      if (!d.ok) { container.innerHTML = '<span style="color:red">' + (d.error || 'Hata.') + '</span>'; return; }
      
      let html = \`<div class="grid-2" style="margin-bottom:20px;">
        <div style="background:#fafafa;padding:20px;border-radius:10px;border:1px solid #eee;text-align:center;">
          <h3 style="margin:0;color:var(--muted);font-size:14px;text-transform:uppercase;">Sayfa Görüntüleme</h3>
          <p style="font-size:32px;font-weight:bold;color:var(--primary);margin:10px 0;">\${d.stats.total_views}</p>
        </div>
        <div style="background:#fafafa;padding:20px;border-radius:10px;border:1px solid #eee;text-align:center;">
          <h3 style="margin:0;color:var(--muted);font-size:14px;text-transform:uppercase;">Tekil Ziyaretçi</h3>
          <p style="font-size:32px;font-weight:bold;color:var(--primary);margin:10px 0;">\${d.stats.unique_visitors}</p>
        </div>
      </div>\`;

      html += '<div class="grid-2">';
      // Top Paths
      html += '<div><h3>En Çok Ziyaret Edilen Sayfalar</h3><ul style="list-style:none;padding:0;margin:0;">';
      d.stats.topPaths.forEach(p => {
        html += \`<li style="padding:8px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
          <span style="color:#555;word-break:break-all;">\${p.path}</span>
          <strong style="color:var(--primary);">\${p.views}</strong>
        </li>\`;
      });
      if (!d.stats.topPaths.length) html += '<li style="color:var(--muted)">Veri yok</li>';
      html += '</ul></div>';

      // Top Referrers
      html += '<div><h3>En Çok Gelen Kaynaklar (Referrer)</h3><ul style="list-style:none;padding:0;margin:0;">';
      d.stats.topReferrers.forEach(r => {
        html += \`<li style="padding:8px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
          <span style="color:#555;word-break:break-all;">\${r.referrer}</span>
          <strong style="color:var(--primary);">\${r.views}</strong>
        </li>\`;
      });
      if (!d.stats.topReferrers.length) html += '<li style="color:var(--muted)">Veri yok</li>';
      html += '</ul></div>';
      
      html += '</div>';

      container.innerHTML = html;
    }).catch(() => {
      container.innerHTML = '<span style="color:red">Bağlantı hatası.</span>';
    });
}
document.addEventListener('DOMContentLoaded', () => {
  // load initial stats
  loadStats('today');
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn,.tab-panel').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

function save(e, url, form) {
  e.preventDefault();
  const fd  = new FormData(form);
  const btn = form.querySelector('button[type=submit]');
  const alert = form.querySelector('.alert');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Kaydediliyor...';
  fetch(url, {method:'POST', body: new URLSearchParams(fd)})
    .then(r => r.json())
    .then(d => {
      alert.className = 'alert ' + (d.ok ? 'success' : 'error');
      alert.textContent = d.ok ? '✓ Başarıyla kaydedildi!' : ('Hata: ' + d.error);
      setTimeout(() => { alert.style.display='none'; alert.className='alert'; }, 3500);
    })
    .catch(() => { alert.className='alert error'; alert.textContent='Bağlantı hatası.'; })
    .finally(() => { btn.disabled=false; btn.textContent=origText; });
}

function addBcRow() {
  document.getElementById('bc-list').insertAdjacentHTML('beforeend',
    \`<div class="bc-row">
      <input type="text" name="text[]" placeholder="Link metni">
      <input type="text" name="href[]" placeholder="https://...">
      <button type="button" class="btn btn-danger" onclick="this.closest('.bc-row').remove()">✕</button>
    </div>\`);
}
function addSection() {
  document.getElementById('sections-list').insertAdjacentHTML('beforeend',
    \`<div class="repeater-row">
      <input type="hidden" name="id[]" value="0">
      <div class="field"><label>H2 Başlık</label><input type="text" name="heading[]"></div>
      <div class="field"><label>Paragraf (HTML)</label><textarea name="body[]" style="min-height:120px"></textarea></div>
      <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕ Sil</button>
    </div>\`);
}
function addT1Row() {
  document.getElementById('t1-list').insertAdjacentHTML('beforeend',
    \`<div class="repeater-row">
      <input type="hidden" name="id[]" value="0">
      <div class="grid-3">
        <div class="field"><label>İfşa Türü</label><input type="text" name="col_type[]"></div>
        <div class="field"><label>Özellikler (HTML)</label><textarea name="col_feat[]"></textarea></div>
        <div class="field"><label>Erişim</label><input type="text" name="col_acc[]" value="7/24 Aktif"></div>
      </div>
      <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
    </div>\`);
}
function addT2Row() {
  document.getElementById('t2-list').insertAdjacentHTML('beforeend',
    \`<div class="repeater-row">
      <input type="hidden" name="id[]" value="0">
      <div class="grid-3">
        <div class="field"><label>Paket Adı</label><input type="text" name="col_type[]"></div>
        <div class="field"><label>Özellikler (HTML)</label><textarea name="col_feat[]"></textarea></div>
        <div class="field"><label>Süre</label><input type="text" name="col_dur[]"></div>
      </div>
      <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
    </div>\`);
}
function addTip() {
  document.getElementById('tips-list').insertAdjacentHTML('beforeend',
    \`<div class="repeater-row">
      <input type="hidden" name="id[]" value="0">
      <div class="grid-2">
        <div class="field"><label>Kalın Başlık</label><input type="text" name="strong_text[]"></div>
        <div class="field"><label>Açıklama (HTML)</label><textarea name="body[]"></textarea></div>
      </div>
      <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
    </div>\`);
}
function addFaq() {
  document.getElementById('faq-list').insertAdjacentHTML('beforeend',
    \`<div class="repeater-row">
      <input type="hidden" name="id[]" value="0">
      <div class="field"><label>Soru</label><input type="text" name="question[]"></div>
      <div class="field"><label>Cevap (HTML)</label><textarea name="answer[]" style="min-height:100px"></textarea></div>
      <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕ Sil</button>
    </div>\`);
}
function addSbc() {
  const pos = document.querySelectorAll('#sbc-list .repeater-row').length + 1;
  document.getElementById('sbc-list').insertAdjacentHTML('beforeend',
    \`<div class="repeater-row">
      <div class="grid-3">
        <div class="field"><label>Position</label><input type="text" name="position[]" value="\${pos}"></div>
        <div class="field"><label>Item ID</label><input type="text" name="item_id[]"></div>
        <div class="field"><label>Name</label><input type="text" name="name[]"></div>
      </div>
      <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
    </div>\`);
}

// ── Keyword functions ─────────────────────────────────────────────────────────
function loadKeywords() {
  const list = document.getElementById('kw-list');
  list.innerHTML = '<span style="color:var(--muted)">Analiz ediliyor...</span>';
  fetch('/admin/api/keywords')
    .then(r => r.json())
    .then(d => {
      if (!d.ok) { list.innerHTML = '<span style="color:red">Hata.</span>'; return; }
      list.innerHTML = d.keywords.map(k =>
        \`<span onclick="document.getElementById('kw-from').value=this.dataset.p"
              data-p="\${k.phrase}"
              style="cursor:pointer;background:rgba(45,27,78,.08);border:1px solid rgba(45,27,78,.2);border-radius:20px;padding:5px 12px;font-size:13px;color:#2d1b4e;white-space:nowrap"
              title="\${k.count}x geçiyor">
          \${k.phrase} <small style="color:#999">(\${k.count})</small>
        </span>\`
      ).join('');
    });
}
function doReplace() {
  const from = document.getElementById('kw-from').value.trim();
  const to   = document.getElementById('kw-to').value.trim();
  const al   = document.getElementById('kw-alert');
  if (!from) { al.className='alert error'; al.textContent='"Değiştirilecek" alanı boş olamaz.'; al.style.display='flex'; return; }
  if (!confirm(\`"\${from}" → "\${to}" değişikliği tüm sitede uygulanacak. Devam etmek istediğinizden emin misiniz?\`)) return;
  fetch('/admin/api/replace-keyword',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:\`from=\${encodeURIComponent(from)}&to=\${encodeURIComponent(to)}\`})
    .then(r=>r.json())
    .then(d=>{
      al.className='alert '+(d.ok?'success':'error');
      al.textContent = d.ok ? \`✓ \${d.changed} alan güncellendi. Sayfayı yenileyin.\` : 'Hata: '+d.error;
      al.style.display='flex';
      if (d.ok) { document.getElementById('kw-list').innerHTML=''; }
    });
}
function doImport(e) {
  e.preventDefault();
  const file = document.getElementById('import-file').files[0];
  const al   = document.getElementById('import-alert');
  if (!file) { al.className='alert error'; al.textContent='Dosya seçilmedi.'; al.style.display='flex'; return; }
  if (!confirm('TÜM MEVCUT İÇERİK SİLİNECEK ve dosyadaki içerikle değiştirilecek. Emin misiniz?')) return;
  const fd = new FormData();
  fd.append('db_file', file);
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Yükleniyor...';
  fetch('/admin/api/import-db',{method:'POST',body:fd})
    .then(r=>r.json())
    .then(d=>{
      al.className='alert '+(d.ok?'success':'error');
      al.textContent = d.ok ? '✓ Veritabanı başarıyla geri yüklendi! Sayfayı yenileyin.' : 'Hata: '+d.error;
      al.style.display='flex';
    })
    .finally(()=>{ btn.disabled=false; btn.textContent='Geri Yükle (Mevcut Veriyi Sil)'; });
}
</script>
</body></html>`;
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ Site çalışıyor: http://localhost:${PORT}`);
    console.log(`✓ Admin paneli: http://localhost:${PORT}/admin`);
    console.log(`  Kullanıcı: admin | Şifre: admin123\n`);
});
