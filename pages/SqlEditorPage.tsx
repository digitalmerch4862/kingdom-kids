
import React, { useState, useEffect } from 'react';
import { db, formatError } from '../services/db.service';
import { audio } from '../services/audio.service';
import { safeJsonParse } from '../utils/storage';

const SqlEditorPage: React.FC = () => {
  const [query, setQuery] = useState('SELECT * FROM students ORDER BY full_name ASC;');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('km_sql_history');
    setHistory(safeJsonParse<string[]>(saved, []));
  }, []);

  const saveHistory = (newQuery: string) => {
    const updated = [newQuery, ...history.filter(q => q !== newQuery)].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('km_sql_history', JSON.stringify(updated));
  };

  const syncColumnsSql = `
-- EMERGENCY FIX: Add missing columns to 'students' table
ALTER TABLE students ADD COLUMN IF NOT EXISTS consecutive_absences integer DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_status text DEFAULT 'active';
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_followup_sent timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_nickname text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_role text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS batch_year text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_legacy boolean DEFAULT false;
`;

  const seedDemoDataSql = `
-- 1. Insert Sample Students
INSERT INTO students (full_name, age_group, is_enrolled, access_key, student_status, consecutive_absences) VALUES
('ALEXA G.', '10-12', true, 'KK-DEMO-001', 'active', 0),
('LIAM P.', '7-9', true, 'KK-DEMO-002', 'active', 0),
('ZARA M.', '3-6', true, 'KK-DEMO-003', 'active', 0),
('NOAH E.', '3-6', true, 'KK-DEMO-004', 'active', 1),
('MIA S.', '10-12', true, 'KK-DEMO-005', 'active', 0)
ON CONFLICT (access_key) DO NOTHING;

-- 2. Insert Sample Points for Current Month
DO $$
DECLARE
    alexa_id uuid;
    liam_id uuid;
    zara_id uuid;
    noah_id uuid;
    mia_id uuid;
    today date := current_date;
BEGIN
    SELECT id INTO alexa_id FROM students WHERE access_key = 'KK-DEMO-001';
    SELECT id INTO liam_id FROM students WHERE access_key = 'KK-DEMO-002';
    SELECT id INTO zara_id FROM students WHERE access_key = 'KK-DEMO-003';
    SELECT id INTO noah_id FROM students WHERE access_key = 'KK-DEMO-004';
    SELECT id INTO mia_id FROM students WHERE access_key = 'KK-DEMO-005';

    -- Insert Points (Ensure IDs exist before inserting)
    IF alexa_id IS NOT NULL THEN
        INSERT INTO point_ledger (student_id, entry_date, category, points, recorded_by) VALUES
        (alexa_id, today, 'Memory Verse', 50, 'System'),
        (liam_id, today, 'Attendance', 45, 'System'),
        (zara_id, today, 'Activity', 30, 'System'),
        (noah_id, today, 'Recitation', 25, 'System'),
        (mia_id, today, 'Bonus', 20, 'System');
    END IF;
END $$;
`;

  const generateSchedule2026Sql = `
DO $$
DECLARE
   start_date date := GREATEST(CURRENT_DATE, '2024-01-01'::date);
   end_date date := '2026-06-30';
   d date;
   day_idx int;
   title text;
   assign text;
BEGIN
   -- Loop through Sundays
   FOR d IN SELECT generate_series(
              (SELECT date_trunc('week', start_date)::date + 6), -- First Sunday
              end_date, 
              '1 week'::interval)::date 
   LOOP
       -- Check if exists
       IF NOT EXISTS (SELECT 1 FROM teacher_assignments WHERE activity_date = d) THEN
           day_idx := ceil(extract(day from d) / 7.0);
           
           -- Set Title
           IF day_idx = 1 THEN title := 'BIBLE STORIES';
           ELSIF day_idx = 2 THEN title := 'MEMORY VERSE';
           ELSIF day_idx = 3 THEN title := 'GAMES & QUIZ';
           ELSIF day_idx = 4 THEN title := 'ARTS / MADE BY TINY HANDS';
           ELSE title := 'SCRIPTURE QUEST: A FUN BIBLE QUIZ & MEMORY VERSE DAY';
           END IF;

           -- Set Default Assignment for 5th Sunday
           assign := '';
           IF day_idx = 5 THEN assign := 'ALL TEACHERS'; END IF;

           INSERT INTO teacher_assignments (activity_date, activity_type, age_group_3_6, age_group_7_9, teens, security, facilitators)
           VALUES (d, title, assign, assign, assign, '', assign);
       END IF;
   END LOOP;
END $$;
`;

  const quickQueries = [
    { label: '⭐ QUICK FIX: Sync Missing Columns', sql: syncColumnsSql, variant: 'primary' },
    { label: 'Generate Schedule (2024-2026)', sql: generateSchedule2026Sql },
    { label: 'Fix Teacher Board Table', sql: "CREATE TABLE IF NOT EXISTS teacher_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), activity_date date NOT NULL, activity_type text, age_group_3_6 text, age_group_7_9 text, teens text, security text, facilitators text, created_at timestamptz DEFAULT now());" },
    { label: 'Verify Registry', sql: "SELECT * FROM students ORDER BY full_name ASC;" },
    { label: 'Seed Visual Demo Data', sql: seedDemoDataSql },
    { label: 'Wipe All Points (Hard Reset)', sql: "DELETE FROM point_ledger;" },
    { label: 'Points Leaderboard', sql: "SELECT s.full_name, SUM(l.points) as total FROM point_ledger l JOIN students s ON l.student_id = s.id WHERE l.voided = false GROUP BY s.full_name ORDER BY total DESC;" },
    { label: 'Recent Movement', sql: "SELECT s.full_name, a.check_in_time, a.status FROM attendance_sessions a JOIN students s ON a.student_id = s.id ORDER BY a.check_in_time DESC LIMIT 50;" },
    { label: 'Table Stats', sql: "SELECT 'students' as table, count(*) FROM students UNION SELECT 'attendance', count(*) FROM attendance_sessions UNION SELECT 'points', count(*) FROM point_ledger;" },
  ];

  const runQuery = async (customSql?: string) => {
    const sqlToRun = (customSql || query).trim();
    if (customSql) setQuery(customSql);
    
    if (!sqlToRun) return;

    setLoading(true);
    setError('');
    setResults([]);
    audio.playClick();
    
    try {
      const data = await db.runRawSql(sqlToRun);
      setResults(data || []);
      saveHistory(sqlToRun);
      if (data && data.length === 0) {
        setError('Query executed successfully. (0 records returned)');
      }
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    audio.playClick();
    const headers = Object.keys(results[0]);
    const csvRows = [
      headers.join(','),
      ...results.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SQL_Export_${new Date().getTime()}.csv`;
    link.click();
  };

  const fullSchemaSql = `-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  birthday date,
  age_group text NOT NULL,
  access_key text UNIQUE,
  guardian_name text,
  guardian_phone text,
  photo_url text,
  is_enrolled boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  consecutive_absences integer DEFAULT 0,
  student_status text DEFAULT 'active',
  last_followup_sent timestamptz,
  guardian_nickname text,
  current_role text,
  batch_year text,
  is_legacy boolean DEFAULT false
);

-- 2. Face Embeddings Table
CREATE TABLE IF NOT EXISTS face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  embedding jsonb NOT NULL,
  angle text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  check_in_time timestamptz NOT NULL,
  check_out_time timestamptz,
  checkout_mode text,
  checked_in_by text NOT NULL,
  checked_out_by text,
  status text DEFAULT 'OPEN',
  created_at timestamptz DEFAULT now()
);

-- 4. Point Ledger Table
CREATE TABLE IF NOT EXISTS point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  category text NOT NULL,
  points integer NOT NULL,
  notes text,
  recorded_by text NOT NULL,
  voided boolean DEFAULT false,
  void_reason text,
  created_at timestamptz DEFAULT now()
);

-- 5. Story History Table (For Daily Quest)
CREATE TABLE IF NOT EXISTS story_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  topic text NOT NULL,
  completed_at timestamptz DEFAULT now()
);

-- 6. Teacher Assignments Table
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_date date NOT NULL,
  activity_type text,
  age_group_3_6 text,
  age_group_7_9 text,
  teens text,
  security text,
  facilitators text,
  created_at timestamptz DEFAULT now()
);

-- 7. RPC Function for SQL Editor
CREATE OR REPLACE FUNCTION exec_sql(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    IF query_text ILIKE 'select%' THEN
        EXECUTE 'SELECT jsonb_agg(t) FROM (' || query_text || ') t' INTO result;
    ELSE
        EXECUTE query_text;
        result := '[{"status": "success", "message": "Command executed successfully"}]'::jsonb;
    END IF;
    RETURN result;
END;
$$;`;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">SQL Terminal</h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Database Management & Roster Seeding</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => { audio.playClick(); setShowSetup(!showSetup); }}
            className={`text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl border transition-all ${
              showSetup ? 'bg-pink-500 text-white border-pink-500 shadow-xl shadow-pink-100' : 'bg-white text-pink-500 border-pink-100 shadow-sm'
            }`}
          >
            {showSetup ? 'Hide Schema Wizard' : 'Initialize Database'}
          </button>
        </div>
      </div>

      {showSetup && (
        <div className="bg-pink-50 p-8 rounded-[3rem] border border-pink-100 animate-in slide-in-from-top-4 duration-300 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-pink-100 rounded-2xl flex items-center justify-center text-xl shrink-0">🏗️</div>
            <div>
              <h3 className="text-sm font-black text-pink-600 uppercase tracking-widest">Initialization Wizard</h3>
              <p className="text-[10px] text-pink-700/70 font-bold mt-1 uppercase tracking-tight">
                Paste this script into Supabase SQL Editor to create tables and functions.
              </p>
            </div>
          </div>
          <div className="relative">
            <pre className="bg-white p-6 rounded-[2rem] text-[9px] font-mono text-gray-700 border border-pink-100 overflow-x-auto max-h-64 shadow-inner">
              {fullSchemaSql}
            </pre>
            <button 
              onClick={() => {
                audio.playClick();
                navigator.clipboard.writeText(fullSchemaSql);
                alert("Schema copied!");
              }}
              className="absolute top-4 right-4 bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg"
            >
              Copy Script
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quick Presets</h3>
            <div className="space-y-2">
              {quickQueries.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => runQuery(q.sql)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all group ${
                    q.variant === 'primary' 
                      ? 'bg-pink-50 border-pink-200 hover:bg-pink-100' 
                      : 'bg-white border-pink-50 hover:border-pink-200 hover:bg-pink-50'
                  }`}
                >
                  <p className={`text-[10px] font-black uppercase tracking-tight ${
                    q.variant === 'primary' ? 'text-pink-600' : 'text-gray-700 group-hover:text-pink-600'
                  }`}>
                    {q.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {history.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Recent Queries</h3>
              <div className="space-y-2">
                {history.map((h, idx) => (
                  <button
                    key={idx}
                    onClick={() => runQuery(h)}
                    className="w-full text-left p-4 bg-gray-50/50 border border-transparent rounded-2xl hover:border-gray-200 transition-all truncate"
                  >
                    <code className="text-[8px] font-mono text-gray-400">{h}</code>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-pink-50 space-y-6">
            <textarea
              className="w-full h-64 p-8 bg-gray-900 border-none rounded-[2.5rem] font-mono text-xs text-pink-300 outline-none focus:ring-4 focus:ring-pink-100 transition-all shadow-inner resize-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              placeholder="-- Write your SQL here..."
            />
            <div className="flex justify-between items-center">
              <button 
                onClick={() => { audio.playClick(); setQuery(''); setResults([]); setError(''); }}
                className="text-[10px] font-black text-gray-300 hover:text-pink-500 uppercase tracking-widest transition-colors"
              >
                Clear Editor
              </button>
              <button
                onClick={() => runQuery()}
                disabled={loading || !query.trim()}
                className="bg-pink-500 hover:bg-pink-600 text-white px-12 py-5 rounded-[1.5rem] font-black transition-all shadow-2xl shadow-pink-200 uppercase tracking-widest text-[11px] flex items-center gap-3 disabled:opacity-50"
              >
                {loading ? <span className="animate-spin">⌛</span> : '⚡ Run Query'}
              </button>
            </div>
          </div>

          {error && (
            <div className={`p-6 rounded-[2rem] text-[10px] font-black uppercase tracking-widest animate-in shake ${
              error.includes('successfully') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
            }`}>
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="bg-white rounded-[3rem] shadow-sm border border-pink-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="p-8 border-b border-pink-50 flex justify-between items-center bg-gray-50/30">
                <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Query Results ({results.length})</h3>
                <button 
                  onClick={exportCsv}
                  className="bg-white border border-pink-100 text-pink-500 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-pink-50 transition-all shadow-sm"
                >
                  📥 Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="bg-gray-50/50 text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-pink-50">
                      {Object.keys(results[0]).map((h) => (
                        <th key={h} className="px-8 py-5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-50/30 font-medium text-gray-600">
                    {results.map((row, i) => (
                      <tr key={i} className="hover:bg-pink-50/10 transition-colors">
                        {Object.keys(results[0]).map((h) => (
                          <td key={h} className="px-8 py-4 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis font-mono">
                            {typeof row[h] === 'object' ? JSON.stringify(row[h]) : String(row[h])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlEditorPage;
