/**
 * Export all lessons + related rows from the old kk-faith-pathway Supabase project
 * and write them to scripts/faith-pathway-export.json.
 *
 * Run:  npx tsx scripts/export-faith-pathway.ts
 *
 * Old project URL / key are hard-coded here (read-only anon key — safe to commit).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const OLD_URL  = 'https://wfjhmimqntryohnrmuxc.supabase.co';
const OLD_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmamhtaW1xbnRyeW9obnJtdXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDI0NjYsImV4cCI6MjA4NDcxODQ2Nn0.TanfHQNv9EE6pZPQ5GxCY6Af2cdVfId3SN6KLx7H-U4';

const src = createClient(OLD_URL, OLD_KEY);

async function fetchAll<T>(table: string, select = '*'): Promise<T[]> {
  const { data, error } = await src.from(table).select(select).order('created_at', { ascending: true });
  if (error) throw new Error(`fetch ${table}: ${error.message}`);
  return (data ?? []) as T[];
}

async function main() {
  console.log('Exporting faith-pathway data...');

  const [lessons, videos, activities, attachments, progress] = await Promise.all([
    fetchAll('lessons'),
    fetchAll('lesson_videos'),
    fetchAll('lesson_activities'),
    fetchAll('attachments'),
    fetchAll('lesson_progress'),
  ]);

  const payload = { lessons, videos, activities, attachments, progress, exportedAt: new Date().toISOString() };

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, 'faith-pathway-export.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Done.`);
  console.log(`  lessons:    ${lessons.length}`);
  console.log(`  videos:     ${videos.length}`);
  console.log(`  activities: ${activities.length}`);
  console.log(`  attachments:${attachments.length}`);
  console.log(`  progress:   ${progress.length}`);
  console.log(`Written → ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
