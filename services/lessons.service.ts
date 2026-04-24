/**
 * Faith Pathway — lesson CRUD, featured-lesson management, and progress tracking.
 * All calls use the existing kingdom-kids Supabase client (services/supabase.ts).
 */

import { supabase } from './supabase';
import type {
  Lesson,
  LessonActivity,
  LessonVideo,
  LessonAttachment,
  LessonProgress,
  FeaturedLesson,
  LessonStatus,
} from '../types';
import { currentWeekStart } from '../utils/featuredWeek';

// ── helpers ──────────────────────────────────────────────────────────────────

function handleError(error: any, ctx: string): never {
  const msg = error?.message ?? JSON.stringify(error);
  throw new Error(`[lessons.service] ${ctx}: ${msg}`);
}

// ── lessons ──────────────────────────────────────────────────────────────────

export async function listLessons(statusFilter?: LessonStatus): Promise<Lesson[]> {
  let q = supabase
    .from('lessons')
    .select('*, videos:lesson_videos(*), activities:lesson_activities(*)')
    .order('created_at', { ascending: false });
  if (statusFilter) q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) handleError(error, 'listLessons');
  return data as Lesson[];
}

export async function getLesson(id: string): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .select(`
      *,
      activities:lesson_activities(*),
      videos:lesson_videos(*),
      attachments:attachments(*)
    `)
    .eq('id', id)
    .single();
  if (error) handleError(error, 'getLesson');
  return data as Lesson;
}

export async function upsertLesson(
  lesson: Partial<Lesson>,
  activities?: Partial<LessonActivity>[],
  videos?: Partial<LessonVideo>[],
  attachments?: Partial<LessonAttachment>[]
): Promise<Lesson> {
  const { id, activities: _a, videos: _v, attachments: _at, progress: _p, ...payload } = lesson as any;
  const isNew = !id || id === 'new';
  const body = isNew
    ? { ...payload, updated_at: new Date().toISOString() }
    : { id, ...payload, updated_at: new Date().toISOString() };

  const { data: saved, error: lErr } = await supabase
    .from('lessons')
    .upsert(body)
    .select()
    .single();
  if (lErr) handleError(lErr, 'upsertLesson');
  const lessonId = (saved as any).id;

  if (activities !== undefined) {
    await supabase.from('lesson_activities').delete().eq('lesson_id', lessonId);
    if (activities.length > 0) {
      const rows = activities.map(({ id: _, lesson_id: __, ...rest }, i) => ({
        ...rest, lesson_id: lessonId, sort_order: i,
      }));
      const { error } = await supabase.from('lesson_activities').insert(rows);
      if (error) handleError(error, 'upsertLesson.activities');
    }
  }

  if (videos !== undefined) {
    await supabase.from('lesson_videos').delete().eq('lesson_id', lessonId);
    if (videos.length > 0) {
      const rows = videos.map(({ id: _, lesson_id: __, ...rest }, i) => ({
        ...rest, lesson_id: lessonId, sort_order: i,
      }));
      const { error } = await supabase.from('lesson_videos').insert(rows);
      if (error) handleError(error, 'upsertLesson.videos');
    }
  }

  if (attachments !== undefined) {
    await supabase.from('attachments').delete().eq('lesson_id', lessonId);
    if (attachments.length > 0) {
      const rows = attachments.map(({ id: _, lesson_id: __, ...rest }) => ({
        ...rest, lesson_id: lessonId,
      }));
      const { error } = await supabase.from('attachments').insert(rows);
      if (error) handleError(error, 'upsertLesson.attachments');
    }
  }

  return saved as Lesson;
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) handleError(error, 'deleteLesson');
}

// ── progress ─────────────────────────────────────────────────────────────────

export async function getLessonProgress(lessonId: string, teacherId: string): Promise<LessonProgress | null> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('teacher_id', teacherId)
    .maybeSingle();
  if (error) handleError(error, 'getLessonProgress');
  return data as LessonProgress | null;
}

export async function toggleLessonProgress(lessonId: string, teacherId: string): Promise<LessonProgress> {
  const existing = await getLessonProgress(lessonId, teacherId);
  const nextCompleted = !(existing?.completed ?? false);
  const ts = nextCompleted ? new Date().toISOString() : null;

  if (existing) {
    const { data, error } = await supabase
      .from('lesson_progress')
      .update({ completed: nextCompleted, completed_at: ts })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) handleError(error, 'toggleLessonProgress.update');
    return data as LessonProgress;
  } else {
    const { data, error } = await supabase
      .from('lesson_progress')
      .insert({ lesson_id: lessonId, teacher_id: teacherId, completed: nextCompleted, completed_at: ts })
      .select()
      .single();
    if (error) handleError(error, 'toggleLessonProgress.insert');
    return data as LessonProgress;
  }
}

// ── featured lessons ──────────────────────────────────────────────────────────

export async function getFeaturedLesson(weekStart?: string): Promise<FeaturedLesson | null> {
  const ws = weekStart ?? currentWeekStart();
  const { data, error } = await supabase
    .from('featured_lessons')
    .select('*, lesson:lessons(*)')
    .eq('week_start', ws)
    .maybeSingle();
  if (error) handleError(error, 'getFeaturedLesson');
  return data as FeaturedLesson | null;
}

export async function setFeaturedLesson(lessonId: string, weekStart: string, createdBy: string): Promise<FeaturedLesson> {
  const { data, error } = await supabase
    .from('featured_lessons')
    .upsert({ lesson_id: lessonId, week_start: weekStart, created_by: createdBy }, { onConflict: 'week_start' })
    .select('*, lesson:lessons(*)')
    .single();
  if (error) handleError(error, 'setFeaturedLesson');
  return data as FeaturedLesson;
}

export async function listFeaturedLessons(limit = 12): Promise<FeaturedLesson[]> {
  const { data, error } = await supabase
    .from('featured_lessons')
    .select('*, lesson:lessons(*)')
    .order('week_start', { ascending: false })
    .limit(limit);
  if (error) handleError(error, 'listFeaturedLessons');
  return data as FeaturedLesson[];
}

// ── attachments (storage) ────────────────────────────────────────────────────

export async function uploadLessonAsset(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('lesson-assets').upload(path, file);
  if (error) handleError(error, 'uploadLessonAsset');
  return path;
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('lesson-assets')
    .createSignedUrl(storagePath, 3600);
  if (error) handleError(error, 'getSignedUrl');
  return data!.signedUrl;
}
