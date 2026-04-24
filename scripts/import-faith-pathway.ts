/**
 * Import lessons exported by export-faith-pathway.ts into the kingdom-kids Supabase project.
 *
 * Run:  npx tsx scripts/import-faith-pathway.ts
 *
 * Reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from .env (or environment).
 * Idempotent — uses upsert on primary key.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config(); // load .env

const url  = process.env.VITE_SUPABASE_URL;
const key  = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env');
  process.exit(1);
}

const dest = createClient(url, key);

const __dirname = dirname(fileURLToPath(import.meta.url));
const exportPath = join(__dirname, 'faith-pathway-export.json');

if (!existsSync(exportPath)) {
  console.error(`Export file not found: ${exportPath}`);
  console.error('Run export-faith-pathway.ts first.');
  process.exit(1);
}

const { lessons, videos, activities, attachments, progress } = JSON.parse(
  readFileSync(exportPath, 'utf8')
);

async function upsertBatch(table: string, rows: any[], chunkSize = 50) {
  if (!rows.length) { console.log(`  ${table}: 0 rows — skip`); return; }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await dest.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`upsert ${table} [chunk ${i}]: ${error.message}`);
    inserted += chunk.length;
  }
  console.log(`  ${table}: ${inserted} rows upserted`);
}

async function main() {
  console.log('Importing faith-pathway data into kingdom-kids...');
  // Order matters — parent before child
  await upsertBatch('lessons', lessons);
  await upsertBatch('lesson_videos', videos);
  await upsertBatch('lesson_activities', activities);
  await upsertBatch('attachments', attachments);
  await upsertBatch('lesson_progress', progress);
  console.log('Import complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
