import { useState, useEffect, useCallback } from 'react';
import { coursesAPI } from '../utils/api';

export const useCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await coursesAPI.list();
      setCourses(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
      // Fallback demo courses
      setCourses(DEMO_COURSES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { courses, setCourses, loading, error, reload: load };
};

export const DEMO_COURSES = [
  { id: 1,  title: 'Artificial Intelligence',         code: 'AI',    total_weeks: 12, weeks_done: 0 },
  { id: 2,  title: 'Machine Learning',                code: 'ML',    total_weeks: 12, weeks_done: 0 },
  { id: 3,  title: 'Human Computer Interaction',      code: 'HCI',   total_weeks: 12, weeks_done: 0 },
  { id: 4,  title: 'Computer Vision',                 code: 'CV',    total_weeks: 12, weeks_done: 0 },
  { id: 5,  title: 'Image Processing',                code: 'IP',    total_weeks: 12, weeks_done: 0 },
  { id: 6,  title: 'Blockchain Technology',           code: 'BC',    total_weeks: 12, weeks_done: 0 },
  { id: 7,  title: 'Database Management Systems',     code: 'DBMS',  total_weeks: 12, weeks_done: 0 },
  { id: 8,  title: 'Data Structures & Algorithms',    code: 'DSA',   total_weeks: 12, weeks_done: 0 },
  { id: 9,  title: 'Computer Networks',               code: 'CN',    total_weeks: 12, weeks_done: 0 },
  { id: 10, title: 'Operating Systems',               code: 'OS',    total_weeks: 12, weeks_done: 0 },
  { id: 11, title: 'Cloud Computing',                 code: 'CLOUD', total_weeks:  8, weeks_done: 0 },
  { id: 12, title: 'Deep Learning',                   code: 'DL',    total_weeks: 12, weeks_done: 0 },
];
