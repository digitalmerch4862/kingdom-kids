import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, Check } from 'lucide-react';
import {
  listLessons, getLesson, upsertLesson, deleteLesson
} from '../services/lessons.service';
import {
  generateFullLesson, categorizeLessonTitle, generateLessonSummary
} from '../services/gemini-lesson.service';
import type {
  Lesson, LessonStatus, LessonContentStructure, LessonSubSection,
  LessonActivity, LessonVideo, LessonAttachment
} from '../types';
import YouTubePicker from '../components/faith-pathway/YouTubePicker';
import DrivePicker from '../components/faith-pathway/DrivePicker';

// ── helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 11); }

const PERMANENT_TITLES = ['BIBLE TEXT', 'MEMORY VERSE', 'BIG PICTURE', 'TEACH THE STORY', 'GOSPEL CONNECTION', 'DISCUSSION', 'CRAFTS'];

const CATEGORIES = ['PENTATEUCH', 'HISTORY', 'POETRY', 'THE PROPHETS', 'THE GOSPELS', 'ACTS & EPISTLES', 'REVELATION'];

const DEFAULT_STRUCTURE: LessonContentStructure = {
  read:   [{ id: 'tpl-r1', title: 'BIBLE TEXT', content: '' }, { id: 'tpl-r2', title: 'MEMORY VERSE', content: '' }],
  teach:  [{ id: 'tpl-t1', title: 'BIG PICTURE', content: '' }, { id: 'tpl-t2', title: 'TEACH THE STORY', content: '' }, { id: 'tpl-t3', title: 'GOSPEL CONNECTION', content: '' }],
  engage: [{ id: 'tpl-e1', title: 'DISCUSSION', content: '' }, { id: 'tpl-e2', title: 'CRAFTS', content: '' }],
};

function serializeToMarkdown(s: LessonContentStructure): string {
  const block = (heading: string, items: LessonSubSection[]) =>
    `# ${heading}\n\n` + items.map(i => `## ${i.title}\n${i.content}`).join('\n\n');
  return [block('Read', s.read), block('Teach', s.teach), block('Engage', s.engage)].join('\n\n');
}

// ── SubSectionCard ────────────────────────────────────────────────────────────

const SubSectionCard: React.FC<{
  sub: LessonSubSection;
  onUpdate: (u: Partial<LessonSubSection>) => void;
  onDelete: () => void;
  placeholder: string;
}> = ({ sub, onUpdate, onDelete, placeholder }) => {
  const [ref, setRef] = useState('');
  const [fetching, setFetching] = useState(false);
  const isPermanent = PERMANENT_TITLES.includes(sub.title.toUpperCase());
  const isBible = ['BIBLE TEXT', 'SCRIPTURE'].includes(sub.title.toUpperCase());

  const fetchBible = async () => {
    const q = ref.trim();
    if (!q) return alert('Enter a reference (e.g. Genesis 1-2 or John 3:16)');
    setFetching(true);
    try {
      const sanitized = q.replace(/–|—/g, '-').replace(/\s+/g, '+');
      const res = await fetch(`https://bible-api.com/${sanitized}`);
      if (!res.ok) throw new Error(`Bible API error (${res.status})`);
      const data = await res.json();
      if (data.text) onUpdate({ content: data.text.trim() });
      else throw new Error('No text returned');
    } catch (e: any) {
      alert(e.message ?? 'Failed to fetch Bible text');
    } finally { setFetching(false); }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-[30px] relative shadow-sm border-2 border-transparent hover:border-pink-50 transition-all flex flex-col min-h-[160px]">
      {!isPermanent && (
        <button onClick={onDelete} className="absolute top-4 right-6 text-gray-300 hover:text-red-500 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-600 select-none">{sub.title}</div>

      {isBible && (
        <div className="mb-4 flex flex-col gap-2">
          <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-xs focus:border-[#EF4E92] outline-none font-medium" placeholder="Reference (e.g. Genesis 1-2)" value={ref} onChange={e => setRef(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchBible()} />
          <button onClick={fetchBible} disabled={fetching} className="w-full h-10 bg-[#003882] text-white rounded-xl flex items-center justify-center gap-2 hover:bg-[#003882]/90 disabled:opacity-50 transition-all font-black uppercase tracking-widest text-[9px]">
            {fetching ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Fetch Verses'}
          </button>
        </div>
      )}

      <textarea rows={4} placeholder={placeholder} className="w-full bg-transparent border-none text-sm leading-relaxed outline-none resize-none text-gray-600 font-medium flex-1" value={sub.content} onChange={e => onUpdate({ content: e.target.value })} />
    </div>
  );
};

// ── SectionHeader ─────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-3 mb-4 md:mb-6">
    <div className="h-5 md:h-6 w-1 md:w-1.5 bg-[#EF4E92] rounded-full" />
    <h3 className="font-black text-lg md:text-xl tracking-tight uppercase text-[#003882]">{title}</h3>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

const FaithPathwayAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title: '', summary: '', content: '', category: 'HISTORY', series: '', grade_min: 1, grade_max: 5, tags: [], status: 'DRAFT',
  });
  const [structure, setStructure] = useState<LessonContentStructure>({ read: [], teach: [], engage: [] });
  const [activities, setActivities] = useState<Partial<LessonActivity>[]>([]);
  const [videos, setVideos] = useState<Partial<LessonVideo>[]>([]);
  const [attachments, setAttachments] = useState<Partial<LessonAttachment>[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiStep, setAiStep] = useState<'questions' | 'preview'>('questions');
  const [aiGoal, setAiGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'updated' | 'alpha_asc' | 'alpha_desc'>('alpha_asc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [showYouTubePicker, setShowYouTubePicker] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const fetchLessons = async () => {
    try {
      const data = await listLessons();
      setLessons(data);
      setError(null);
    } catch (e: any) { setError(`Failed to load lessons: ${e.message}`); }
  };

  useEffect(() => { fetchLessons(); }, []);

  const filteredLessons = useMemo(() => {
    let result = [...lessons];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.title.toLowerCase().includes(q) || l.category.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortOrder === 'updated') return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      if (sortOrder === 'alpha_asc') return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
      return b.title.localeCompare(a.title, undefined, { numeric: true, sensitivity: 'base' });
    });
    return result;
  }, [lessons, searchQuery, sortOrder]);

  const handleEdit = async (id: string) => {
    setError(null);
    try {
      const full = await getLesson(id);
      setEditingId(id);
      setFormData(full);
      // Re-parse from markdown to structure
      const md = full.content ?? '';
      const mainParts = md.split(/^# /m).filter(p => p.trim());
      const newStruct: LessonContentStructure = { read: [], teach: [], engage: [] };
      const keys: (keyof LessonContentStructure)[] = ['read', 'teach', 'engage'];
      mainParts.forEach((part, i) => {
        const bucket = keys[i];
        if (!bucket) return;
        const body = part.slice(part.indexOf('\n') + 1);
        const subs = body.split(/^## /m).filter(p => p.trim());
        newStruct[bucket] = subs.map(s => {
          const lines = s.split('\n');
          return { id: uid(), title: lines[0].trim(), content: lines.slice(1).join('\n').trim() };
        });
      });
      setStructure(newStruct);
      setActivities(full.activities ?? []);
      setVideos(full.videos ?? []);
      setAttachments(full.attachments ?? []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) { setError(`Error loading lesson: ${e.message}`); }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({ title: '', summary: '', content: '', category: 'HISTORY', series: '', grade_min: 1, grade_max: 5, tags: [], status: 'DRAFT' });
    setStructure({
      read:   DEFAULT_STRUCTURE.read.map(i => ({ ...i, id: uid() })),
      teach:  DEFAULT_STRUCTURE.teach.map(i => ({ ...i, id: uid() })),
      engage: DEFAULT_STRUCTURE.engage.map(i => ({ ...i, id: uid() })),
    });
    setActivities([]); setVideos([]); setAttachments([]);
    setAiGoal(''); setAiStep('questions'); setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const pwd = window.prompt('Security clearance required. Enter Master Code:');
    if (pwd === null) return;
    if (pwd !== '6244') { alert('Access Denied.'); return; }
    if (!window.confirm('Permanently delete this lesson? Cannot be undone.')) return;
    setLoading(true);
    try {
      await deleteLesson(id);
      if (editingId === id) setEditingId(null);
      await fetchLessons();
    } catch (e: any) { alert('Delete failed: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleSave = async (status: LessonStatus) => {
    if (!formData.title) return alert('Lesson Title is required.');
    setLoading(true); setError(null);
    try {
      const { activities: _a, videos: _v, attachments: _at, progress: _p, ...rest } = formData as any;
      const payload: Partial<Lesson> = { ...rest, content: serializeToMarkdown(structure), status };
      if (editingId !== 'new') payload.id = editingId!;
      await upsertLesson(payload, activities as any, videos as any, attachments as any);
      alert(`Lesson ${status === 'PUBLISHED' ? 'published' : 'saved'} successfully!`);
      setEditingId(null);
      fetchLessons();
    } catch (e: any) { setError(`Save failed: ${e.message}`); alert('Save Failed: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleAiGenerate = async () => {
    if (!aiGoal.trim()) return alert('Please describe your lesson objective.');
    setIsGenerating(true);
    try {
      const result = await generateFullLesson(aiGoal, lessons.map(l => l.title).join(', '));
      if (result) {
        setStructure({
          read:   [{ id: uid(), title: 'BIBLE TEXT', content: result.scripture }, { id: uid(), title: 'MEMORY VERSE', content: '' }],
          teach:  [{ id: uid(), title: 'BIG PICTURE', content: result.objective }, { id: uid(), title: 'TEACH THE STORY', content: result.the_lesson.join('\n\n') }, { id: uid(), title: 'GOSPEL CONNECTION', content: result.gospel_connection }],
          engage: [{ id: uid(), title: 'DISCUSSION', content: result.the_hook }, { id: uid(), title: 'CRAFTS', content: result.group_activity }],
        });
        setFormData(prev => ({ ...prev, title: result.title, summary: `${result.objective} Scripture: ${result.scripture}` }));
        setAiStep('preview');
      } else { alert('AI generation not available (stub mode).'); }
    } catch { alert('AI Generation failed.'); }
    finally { setIsGenerating(false); }
  };

  const handleAutoCategorize = async () => {
    if (!formData.title) return alert('Enter a Lesson Title first.');
    setIsCategorizing(true);
    try { setFormData(p => ({ ...p, category: '' })); const cat = await categorizeLessonTitle(formData.title!); setFormData(p => ({ ...p, category: cat })); }
    finally { setIsCategorizing(false); }
  };

  const handleAutoSummarize = async () => {
    if (!formData.title) return alert('Enter a Mission Name first.');
    setIsSummarizing(true);
    try {
      const result = await generateLessonSummary(formData.title!, serializeToMarkdown(structure));
      if (result) setFormData(p => ({ ...p, summary: result }));
      else alert('AI summary not available (stub mode).');
    } finally { setIsSummarizing(false); }
  };

  const addSub = (box: keyof LessonContentStructure) =>
    setStructure(p => ({ ...p, [box]: [...p[box], { id: uid(), title: 'New Label', content: '' }] }));
  const updateSub = (box: keyof LessonContentStructure, id: string, u: Partial<LessonSubSection>) =>
    setStructure(p => ({ ...p, [box]: p[box].map(s => s.id === id ? { ...s, ...u } : s) }));
  const deleteSub = (box: keyof LessonContentStructure, id: string) =>
    setStructure(p => ({ ...p, [box]: p[box].filter(s => s.id !== id) }));

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* AI Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[48px] p-8 md:p-12 shadow-2xl space-y-8 relative">
            <button onClick={() => setIsAiModalOpen(false)} className="absolute top-8 right-10 text-gray-300 hover:text-black">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div><h2 className="text-3xl font-black text-[#003882] tracking-tighter uppercase">AI Lesson Architect</h2>
              <p className="text-gray-400 font-medium">{aiStep === 'questions' ? 'Define your objective.' : 'Review generated draft.'}</p>
            </div>
            {aiStep === 'questions' ? (
              <div className="space-y-6">
                <textarea rows={6} className="w-full bg-[#F8FAFC] border-2 border-transparent focus:border-[#EF4E92] rounded-[32px] px-8 py-7 outline-none font-medium resize-none text-gray-800 leading-relaxed" placeholder="Tell the Architect what you want to teach today..." value={aiGoal} onChange={e => setAiGoal(e.target.value)} />
                <button onClick={handleAiGenerate} disabled={isGenerating} className="w-full bg-[#EF4E92] text-white rounded-full py-5 font-black uppercase tracking-widest shadow-lg hover:bg-[#EF4E92]/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                  {isGenerating ? 'Architecting...' : 'Start Building'}
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-gray-50 rounded-[32px] p-6 border border-gray-100">
                  <h4 className="font-black text-indigo-900 mb-2 uppercase text-[10px] tracking-[0.2em]">Live Preview</h4>
                  <p className="font-black text-lg text-gray-800">{formData.title}</p>
                  <p className="text-sm text-gray-400 mt-2 italic">{formData.summary}</p>
                </div>
                <button onClick={() => setIsAiModalOpen(false)} className="w-full bg-[#EF4E92] text-white rounded-full py-5 font-black uppercase tracking-widest shadow-lg">Use Selected</button>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 md:px-10 py-4 md:py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#EF4E92] w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-pink-200">K</div>
          <div>
            <h1 className="text-xs md:text-sm font-black tracking-tight text-gray-900 uppercase">KK Admin</h1>
            <p className="hidden md:block text-[10px] text-gray-400 font-bold tracking-widest uppercase">FAITH PATHWAY</p>
          </div>
        </div>
        <button onClick={() => navigate('/')} className="text-[10px] md:text-xs font-black uppercase text-[#EF4E92] tracking-widest hover:text-[#EF4E92]/80 transition-colors">Back to Dashboard</button>
      </header>

      {error && <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">{error}</div>}

      <div className="max-w-[1600px] mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        {/* Sidebar — lesson list */}
        <div className={`lg:col-span-3 space-y-6 ${editingId ? 'hidden lg:block' : 'block'}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-black text-2xl md:text-3xl tracking-tighter text-[#003882]">Lessons</h2>
            <button onClick={handleNew} className="bg-[#EF4E92] text-white px-5 py-2.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-[#EF4E92]/90 transition-all">+ NEW</button>
          </div>

          <div className="flex gap-2 relative z-30">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
              <input className="w-full bg-white border border-gray-100 rounded-xl pl-9 pr-3 py-3 text-[10px] font-black uppercase tracking-widest text-gray-600 outline-none focus:border-[#EF4E92] transition-all" placeholder="SEARCH..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button onClick={() => setIsSortMenuOpen(o => !o)} className="bg-white border border-gray-100 rounded-xl px-3 flex items-center justify-center text-gray-400 hover:text-[#EF4E92] hover:border-pink-100 transition-all">
              <ArrowUpDown size={16} />
            </button>
            {isSortMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 flex flex-col gap-1 z-40">
                {([['updated', 'Recently Updated'], ['alpha_asc', 'Title (A-Z)'], ['alpha_desc', 'Title (Z-A)']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => { setSortOrder(val); setIsSortMenuOpen(false); }}
                    className={`px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-between ${sortOrder === val ? 'bg-pink-50 text-[#EF4E92]' : 'text-gray-400 hover:bg-gray-50'}`}>
                    <span>{label}</span>{sortOrder === val && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 overflow-y-auto lg:max-h-[calc(100vh-280px)] pr-2">
            {filteredLessons.map(l => (
              <div key={l.id} onClick={() => handleEdit(l.id)}
                className={`p-4 md:p-5 rounded-[28px] border transition-all cursor-pointer relative flex flex-col group ${editingId === l.id ? 'border-pink-500 bg-pink-50/30' : 'border-gray-50 bg-white hover:border-gray-200 shadow-sm'}`}>
                <button onClick={e => handleDelete(e, l.id)} className="absolute top-3 right-3 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 z-20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
                <h3 className="font-bold text-sm line-clamp-1 text-gray-800 mb-1 pr-10">{l.title || 'Untitled'}</h3>
                {l.summary && <p className="text-[10px] text-gray-500 line-clamp-2 italic mb-3 leading-relaxed">{l.summary}</p>}
                <div className="flex items-center justify-between mt-auto">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{l.category}</p>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${l.status === 'PUBLISHED' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{l.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor panel */}
        <div className={`lg:col-span-9 ${!editingId ? 'hidden lg:block' : 'block'}`}>
          {!editingId ? (
            <div className="h-[70vh] flex flex-col items-center justify-center bg-white rounded-[64px] border border-gray-100 text-gray-300 p-12 text-center shadow-sm">
              <svg className="w-20 h-20 opacity-10 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <p className="font-black uppercase tracking-[0.3em] text-[10px]">Select or Create a lesson</p>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
              {/* Sticky toolbar */}
              <div className="bg-white/95 backdrop-blur-md p-3 md:p-4 rounded-full border border-gray-100 shadow-xl flex flex-wrap items-center justify-between sticky top-[92px] z-40 gap-3">
                <h2 className="font-black text-md md:text-xl px-4 text-[#003882] truncate max-w-[200px]">{formData.title || 'Draft Lesson'}</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 text-[10px] font-black uppercase text-gray-400 hover:text-black tracking-widest">DISCARD</button>
                  <button onClick={() => setIsAiModalOpen(true)} className="px-5 py-3 bg-[#EF4E92] rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg hover:scale-[1.02] transition-transform">AI ARCHITECT</button>
                  <button onClick={() => handleSave('DRAFT')} disabled={loading} className="px-6 py-3 bg-[#003882] rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50">DRAFT</button>
                  <button onClick={() => handleSave('PUBLISHED')} disabled={loading} className="px-8 py-3 bg-[#EF4E92] rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50">PUBLISH</button>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <SectionHeader title="Mission Name" />
                  <input placeholder="Mission Name..." className="w-full bg-white border border-gray-100 rounded-[28px] px-6 py-5 font-black text-xl text-gray-800 outline-none shadow-sm focus:border-pink-300 transition-all" value={formData.title ?? ''} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-3">
                  <SectionHeader title="Classification" />
                  <div className="flex items-center gap-3">
                    <select className="w-full bg-white border border-gray-100 rounded-[28px] px-6 py-5 text-xs font-black appearance-none outline-none shadow-sm focus:border-pink-300 transition-all cursor-pointer" value={formData.category ?? 'HISTORY'} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handleAutoCategorize} disabled={isCategorizing} className="shrink-0 w-14 h-14 bg-white border border-gray-100 rounded-full flex items-center justify-center font-black text-[#EF4E92] shadow-sm hover:scale-110 active:scale-95 transition-all" title="AI Classification">
                      {isCategorizing ? <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /> : 'AI'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-3">
                <SectionHeader title="Mission Briefing (Summary)" />
                <div className="flex flex-col md:flex-row gap-4">
                  <textarea placeholder="Brief overview..." className="flex-1 bg-white border border-gray-100 rounded-[32px] px-8 py-6 font-medium text-sm text-gray-600 outline-none shadow-sm focus:border-pink-300 transition-all resize-none min-h-[120px] leading-relaxed italic" value={formData.summary ?? ''} onChange={e => setFormData(p => ({ ...p, summary: e.target.value }))} />
                  <button onClick={handleAutoSummarize} disabled={isSummarizing} className="shrink-0 md:w-16 h-16 md:h-auto bg-white border-2 border-dashed border-gray-100 rounded-[32px] flex flex-col items-center justify-center font-black text-[#EF4E92] shadow-sm hover:scale-105 active:scale-95 transition-all p-4 gap-2" title="AI Mission Briefing">
                    {isSummarizing ? <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /> : <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span className="text-[8px] uppercase tracking-widest hidden md:block">AI Brief</span>
                    </>}
                  </button>
                </div>
              </div>

              {/* Lesson body */}
              <div className="space-y-6">
                <SectionHeader title="Lesson Body" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  {(['read', 'teach', 'engage'] as const).map(col => (
                    <div key={col} className="bg-gray-50/60 rounded-[48px] p-6 md:p-8 flex flex-col min-h-[500px] border border-gray-100/50">
                      <div className="flex items-center justify-between mb-6 px-3">
                        <h4 className="font-black text-[10px] md:text-xs text-[#003882] uppercase tracking-[0.2em]">{col}</h4>
                        <button onClick={() => addSub(col)} className="text-gray-300 hover:text-[#EF4E92] transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </button>
                      </div>
                      <div className="space-y-4">
                        {structure[col].map(sub => (
                          <SubSectionCard key={sub.id} sub={sub} onUpdate={u => updateSub(col, sub.id, u)} onDelete={() => deleteSub(col, sub.id)} placeholder={`Content for ${sub.title}...`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activities */}
              <div className="space-y-6">
                <SectionHeader title="Interactive Activities" />
                <button onClick={() => setActivities(a => [...a, { title: '', instructions: '', supplies: [], duration_minutes: 15 }])} className="bg-[#EF4E92] text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#EF4E92]/90 transition-all flex items-center gap-2">
                  + ADD ACTIVITY
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {activities.map((act, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-sm space-y-4 relative">
                      <button onClick={() => setActivities(a => a.filter((_, i) => i !== idx))} className="absolute top-8 right-8 text-gray-300 hover:text-red-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <input placeholder="Activity Title" className="text-lg font-black w-full bg-gray-50 rounded-xl px-5 py-3 outline-none" value={act.title ?? ''} onChange={e => { const n = [...activities]; n[idx] = { ...n[idx], title: e.target.value }; setActivities(n); }} />
                      <textarea placeholder="Step-by-step instructions..." className="w-full bg-gray-50 rounded-xl p-5 text-xs min-h-[120px] resize-none outline-none font-medium leading-relaxed" value={act.instructions ?? ''} onChange={e => { const n = [...activities]; n[idx] = { ...n[idx], instructions: e.target.value }; setActivities(n); }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Videos */}
              <div className="space-y-6">
                <SectionHeader title="Videos & Media" />
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setVideos(v => [...v, { title: '', url: '', provider: 'youtube' }])} className="bg-[#003882] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">+ ADD VIDEO</button>
                  <button onClick={() => setShowYouTubePicker(true)} className="bg-red-500 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                    BROWSE CHANNEL
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {videos.map((vid, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-sm space-y-4 relative">
                      <button onClick={() => setVideos(v => v.filter((_, i) => i !== idx))} className="absolute top-8 right-8 text-gray-300 hover:text-red-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <input placeholder="Video Title" className="text-xs font-bold w-full bg-gray-50 rounded-xl px-5 py-3 outline-none" value={vid.title ?? ''} onChange={e => { const n = [...videos]; n[idx] = { ...n[idx], title: e.target.value }; setVideos(n); }} />
                      <input placeholder="YouTube or Vimeo URL" className="text-xs font-medium w-full bg-gray-50 rounded-xl px-5 py-3 outline-none text-blue-600" value={vid.url ?? ''} onChange={e => { const n = [...videos]; n[idx] = { ...n[idx], url: e.target.value }; setVideos(n); }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-6">
                <SectionHeader title="Resources & Downloads" />
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setAttachments(a => [...a, { name: '', storage_path: '' }])} className="bg-[#EF4E92] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">+ ADD RESOURCE</button>
                  <button onClick={() => setShowDrivePicker(true)} className="bg-[#0F9D58] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 87.3 78" fill="currentColor"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066da"/><path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.5 1.2L3.5 31.5h27.1L43.65 25z" fill="#00ac47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60.1l5.8 11.6 7.65 12.2z" fill="#ea4335"/><path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2L43.65 25z" fill="#00832d"/><path d="M60.1 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.45 1.2h50.9c1.55 0 3.1-.4 4.45-1.2L60.1 53z" fill="#2684fc"/><path d="M73.4 26.5l-8.55-14.8c-.8-1.35-1.95-2.5-3.3-3.3L43.65 25l16.45 28H87.2c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#ffba00"/></svg>
                    BROWSE PRINTABLES
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-sm space-y-4 relative">
                      <button onClick={() => setAttachments(a => a.filter((_, i) => i !== idx))} className="absolute top-8 right-8 text-gray-300 hover:text-red-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <input placeholder="Resource Name (e.g. Coloring Sheet)" className="text-xs font-bold w-full bg-gray-50 rounded-xl px-5 py-3 outline-none" value={att.name ?? ''} onChange={e => { const n = [...attachments]; n[idx] = { ...n[idx], name: e.target.value }; setAttachments(n); }} />
                      <input placeholder="URL to PDF/Image" className="text-xs font-medium w-full bg-gray-50 rounded-xl px-5 py-3 outline-none text-blue-600" value={att.storage_path ?? ''} onChange={e => { const n = [...attachments]; n[idx] = { ...n[idx], storage_path: e.target.value }; setAttachments(n); }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showYouTubePicker && (
        <YouTubePicker
          onSelect={video => setVideos(v => [...v, { title: video.title, url: video.url, provider: video.provider }])}
          onClose={() => setShowYouTubePicker(false)}
        />
      )}
      {showDrivePicker && (
        <DrivePicker
          onSelect={file => setAttachments(a => [...a, { name: file.name, storage_path: file.storage_path }])}
          onClose={() => setShowDrivePicker(false)}
        />
      )}
    </div>
  );
};

export default FaithPathwayAdminPage;
