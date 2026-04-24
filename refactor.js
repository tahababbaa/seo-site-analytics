const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

// 1. Make all route handlers async
server = server.replace(/app\.(get|post)\('([^']+)',\s*(requireAdmin,\s*)?\((req, res)\) => \{/g, "app.$1('$2', $3async (req, res) => {");

// 2. Fix getMeta() and calls
server = server.replace(/function getMeta\(\) \{/g, "async function getMeta() {");
server = server.replace(/return db\.prepare\('SELECT key, value FROM meta'\)\.all\(\)/g, "return (await db.query('SELECT key, value FROM meta')).rows");
server = server.replace(/const m\s*=\s*getMeta\(\);/g, "const m = await getMeta();");
server = server.replace(/const m = getMeta\(\);/g, "const m = await getMeta();");

// 3. Fix db.prepare(...).all()
server = server.replace(/db\.prepare\(([^)]+)\)\.all\(\)/g, "(await db.query($1)).rows");

// 4. Fix db.prepare(...).get()
server = server.replace(/db\.prepare\(([^)]+)\)\.get\(([^)]*)\)/g, "(await db.query($1, [$2])).rows[0]");
// Handle empty args
server = server.replace(/db\.prepare\(([^)]+)\)\.get\(\)/g, "(await db.query($1)).rows[0]");

// 5. Fix db.prepare(...).run()
// This is tricky because run() is often used after preparing a statement:
// const upsert = db.prepare('...');
// upsert.run(a, b);
// We should replace prepared statements with simple query strings.
// Let's replace `const name = db.prepare('SQL');` with `const name = 'SQL';`
server = server.replace(/const (\w+) = db\.prepare\('([^']+)'\);/g, "const $1 = '$2';");

// Then `name.run(a, b)` becomes `await db.query(name, [a, b])`
server = server.replace(/(\w+)\.run\(([^)]+)\)/g, "await db.query($1, [$2])");
server = server.replace(/(\w+)\.run\(\)/g, "await db.query($1)");

// 6. Fix direct db.prepare('...').run()
server = server.replace(/db\.prepare\('([^']+)'\)\.run\(([^)]*)\)/g, "await db.query('$1', [$2])");
server = server.replace(/\[\s*\]/g, "[]"); // fix empty arrays
server = server.replace(/db\.query\('([^']+)',\s*\[\]\)/g, "db.query('$1')");

// 7. Fix transactions
// const tx = db.transaction(() => { ... }); tx();
// Replace with:
// await db.query('BEGIN'); try { ... await db.query('COMMIT'); } catch(e) { await db.query('ROLLBACK'); throw e; }
server = server.replace(/const tx = db\.transaction\(\(\) => \{([\s\S]*?)\}\);\s*tx\(\);/g, 
    "await db.query('BEGIN');\n    try {$1\n        await db.query('COMMIT');\n    } catch (e) {\n        await db.query('ROLLBACK');\n        throw e;\n    }");

// 8. Fix array map/forEach inside transactions containing await
// forEach with await won't work sequentially if we just await inside. We need for...of.
server = server.replace(/texts\.forEach\(\(t, i\) => \{/g, "for (let i = 0; i < texts.length; i++) { let t = texts[i];");
server = server.replace(/headings\.forEach\(\(h, i\) => \{/g, "for (let i = 0; i < headings.length; i++) { let h = headings[i];");
server = server.replace(/types\.forEach\(\(t,\s*i\) => \{/g, "for (let i = 0; i < types.length; i++) { let t = types[i];");
server = server.replace(/strongs\.forEach\(\(s,\s*i\) => \{/g, "for (let i = 0; i < strongs.length; i++) { let s = strongs[i];");
server = server.replace(/questions\.forEach\(\(q,\s*i\) => \{/g, "for (let i = 0; i < questions.length; i++) { let q = questions[i];");
server = server.replace(/positions\.forEach\(\(p,\s*i\) => \{/g, "for (let i = 0; i < positions.length; i++) { let p = positions[i];");
server = server.replace(/existing\.forEach\(eid => \{/g, "for (let eid of existing) {");
server = server.replace(/data\.meta\.forEach\(r => ins\.run\(r\.key, r\.value\)\);/g, "for (let r of data.meta) await db.query(ins, [r.key, r.value]);");
server = server.replace(/data\.breadcrumbs\.forEach\(r => ins\.run\(r\.id, r\.text, r\.href, r\.sort_order\)\);/g, "for (let r of data.breadcrumbs) await db.query(ins, [r.id, r.text, r.href, r.sort_order]);");
server = server.replace(/data\.sections\.forEach\(r => ins\.run\(r\.id, r\.heading, r\.body, r\.sort_order\)\);/g, "for (let r of data.sections) await db.query(ins, [r.id, r.heading, r.body, r.sort_order]);");
server = server.replace(/data\.table1_rows\.forEach\(r => ins\.run\(r\.id, r\.col_type, r\.col_features, r\.col_access, r\.sort_order\)\);/g, "for (let r of data.table1_rows) await db.query(ins, [r.id, r.col_type, r.col_features, r.col_access, r.sort_order]);");
server = server.replace(/data\.table2_rows\.forEach\(r => ins\.run\(r\.id, r\.col_type, r\.col_features, r\.col_duration, r\.sort_order\)\);/g, "for (let r of data.table2_rows) await db.query(ins, [r.id, r.col_type, r.col_features, r.col_duration, r.sort_order]);");
server = server.replace(/data\.tips\.forEach\(r => ins\.run\(r\.id, r\.strong_text, r\.body, r\.sort_order\)\);/g, "for (let r of data.tips) await db.query(ins, [r.id, r.strong_text, r.body, r.sort_order]);");
server = server.replace(/data\.schema_breadcrumbs\.forEach\(r => ins\.run\(r\.id, r\.position, r\.item_id, r\.name\)\);/g, "for (let r of data.schema_breadcrumbs) await db.query(ins, [r.id, r.position, r.item_id, r.name]);");
server = server.replace(/data\.faq_items\.forEach\(r => ins\.run\(r\.id, r\.question, r\.answer, r\.sort_order\)\);/g, "for (let r of data.faq_items) await db.query(ins, [r.id, r.question, r.answer, r.sort_order]);");

// 9. Fix postgres parameterized queries. Postgres uses $1, $2 instead of ?
// We'll write a small wrapper in db.js that converts `?` to `$1`, `$2` so we don't have to rewrite all SQL strings in server.js.

// 10. `bcrypt.compareSync` is fine to keep.

fs.writeFileSync('server-pg.js', server);
console.log('Done refactoring server.js to server-pg.js');
