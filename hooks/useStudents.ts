import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db.service';
import { Student, UserSession, AgeGroup } from '../types';

interface FetchStudentsOptions {
  bypassGroupFilter?: boolean;
  groupFilter?: AgeGroup;
}

export const useStudents = (user: UserSession | null, options: FetchStudentsOptions = {}) => {
  const { bypassGroupFilter = false, groupFilter } = options;
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFacilitator = user?.role === 'FACILITATOR' || user?.role === 'ADMIN';
  const shouldBypass = bypassGroupFilter || (isFacilitator && !groupFilter);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      setError(null);
      try {
        let fetchedStudents = await db.getStudents();

        if (!shouldBypass && groupFilter) {
          fetchedStudents = fetchedStudents.filter(s => s.ageGroup === groupFilter);
        }

        setStudents(fetchedStudents);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch students');
        console.error('Error fetching students:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [shouldBypass, groupFilter]);

  const studentsIndex = useMemo(() => {
    return students.map(s => ({
      id: s.id,
      fullName: s.fullName,
      ageGroup: s.ageGroup,
      searchText: `${s.fullName.toLowerCase()} — ${s.ageGroup.toLowerCase()} group`.normalize('NFD')
    }));
  }, [students]);

  return {
    students,
    studentsIndex,
    loading,
    error,
    canAccessGlobal: isFacilitator,
    shouldBypass
  };
};

export default useStudents;
