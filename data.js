import { requireSupabase } from './supabase.js';

export async function getProfile(userId) {
  const db = requireSupabase();
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function getClasses() {
  const db = requireSupabase();
  const { data, error } = await db.from('classes').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function getSubjects(classId = null) {
  const db = requireSupabase();
  let query = db.from('class_subjects').select('id,class_id,subject_id,subjects(id,name),classes(name)').order('created_at');
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getStudentsForClass(classId) {
  const db = requireSupabase();
  const { data: enrollments, error: enrollmentError } = await db
    .from('enrollments').select('student_id').eq('class_id', classId);
  if (enrollmentError) throw enrollmentError;
  const ids = (enrollments || []).map((row) => row.student_id);
  if (!ids.length) return [];
  const { data, error } = await db.from('students').select('*').in('id', ids).order('full_name');
  if (error) throw error;
  return data || [];
}

export async function getStudentClassMap() {
  const db = requireSupabase();
  const { data, error } = await db.from('enrollments').select('student_id,class_id,classes(name)');
  if (error) throw error;
  return new Map((data || []).map((item) => [item.student_id, { id: item.class_id, name: item.classes?.name || 'Turma' }]));
}

export async function getClassSubjectRows() {
  const db = requireSupabase();
  const { data, error } = await db.from('class_subjects')
    .select('id,class_id,subject_id,classes(name),subjects(name)').order('created_at');
  if (error) throw error;
  return data || [];
}
