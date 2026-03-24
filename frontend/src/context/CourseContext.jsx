import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { coursesAPI } from '../utils/api';

const CourseContext = createContext(null);

export const CourseProvider = ({ children }) => {
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(null); // currently viewed course

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await coursesAPI.list();
      setCourses(res.data);
    } catch { /* silently fail — user sees empty state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('nptel_token');
    if (token) fetchCourses();
  }, [fetchCourses]);

  const addCourse = async (data) => {
    const res = await coursesAPI.create(data);
    setCourses(prev => [...prev, res.data]);
    return res.data;
  };

  const removeCourse = async (id) => {
    await coursesAPI.delete(id);
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  return (
    <CourseContext.Provider value={{ courses, loading, fetchCourses, addCourse, removeCourse, selected, setSelected }}>
      {children}
    </CourseContext.Provider>
  );
};

export const useCourses = () => useContext(CourseContext);
