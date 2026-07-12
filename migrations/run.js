/**
 * Migration runner — applies any unapplied .sql files in this directory.
 *
 * Usage:
 *   node migrations/run.js
 *
 * Each .sql file is applied exactly once; applied filenames are stored in
 * the `_migrations` table so re-running is safe.
 */

const fs   = require('fs');
const path = require('path');
const db   = require('../config/db.js');

const MIGRATIONS_DIR = __dirname;

async function run() {
    // Ensure the tracking table exists
    await db.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            filename   VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Fetch already-applied migrations
    const [applied] = await db.query('SELECT filename FROM _migrations');
    const done = new Set(applied.map(r => r.filename));

    // Collect .sql files in sorted order
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let ran = 0;
    for (const file of files) {
        if (done.has(file)) {
            console.log(`  skip  ${file} (already applied)`);
            continue;
        }

        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

        // Split on semicolons so multi-statement files work
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`  apply ${file} …`);
        for (const stmt of statements) {
            await db.query(stmt);
        }

        await db.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
        console.log(`  done  ${file}`);
        ran++;
    }

    if (ran === 0) {
        console.log('Nothing to apply — database is up to date.');
    } else {
        console.log(`\n${ran} migration(s) applied.`);
    }

    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
