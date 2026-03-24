import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE, timeout: 90000 });

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('nptel_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('nptel_user');
    localStorage.removeItem('nptel_token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export const authAPI = {
  login:  d => api.post('/auth/login', d),
  signup: d => api.post('/auth/signup', d),
  me:     () => api.get('/auth/me'),
};
export const coursesAPI = {
  list:   ()     => api.get('/courses/'),
  get:    id     => api.get(`/courses/${id}`),
  create: d      => api.post('/courses/', d),
  update: (id,d) => api.put(`/courses/${id}`, d),
  delete: id     => api.delete(`/courses/${id}`),
};
export const weeksAPI = {
  get:            (cid,w)   => api.get(`/weeks/${cid}/${w}`),
  saveTranscript: (cid,w,d) => api.post(`/weeks/${cid}/${w}/transcript`, d),
  fetchYouTube:   (cid,d)   => api.post(`/weeks/${cid}/youtube`, d),
  generateNotes:  (cid,w,d) => api.post(`/weeks/${cid}/${w}/notes`, d),
  generateMCQs:   (cid,w,d) => api.post(`/weeks/${cid}/${w}/mcqs`, d),
};
export const notesAPI = {
  generate: d  => api.post('/notes/generate', d),
  getAll:   () => api.get('/notes/'),
  delete:   id => api.delete(`/notes/${id}`),
};
export const questionsAPI = {
  generate: d => api.post('/questions/generate', d),
};
export const examAPI = {
  save:    d => api.post('/exam/save', d),
  results: () => api.get('/exam/results'),
  stats:   () => api.get('/exam/stats'),
  clear:   () => api.delete('/exam/results'),
};
export const uploadAPI = {
  uploadPDF:   fd => api.post('/upload/pdf',   fd, { headers: {'Content-Type':'multipart/form-data'}}),
  uploadAudio: fd => api.post('/upload/audio', fd, { headers: {'Content-Type':'multipart/form-data'}}),
  getAll:      () => api.get('/upload/'),
  delete:      id => api.delete(`/upload/${id}`),
};
export const chatAPI = {
  send:    d => api.post('/chat/message', d),
  history: () => api.get('/chat/history'),
  clear:   () => api.delete('/chat/history'),
};
export const progressAPI = {
  get:    () => api.get('/progress/'),
  update: d  => api.post('/progress/update', d),
  reset:  () => api.delete('/progress/'),
};
export const pdfAPI = {
  generate: d        => api.post('/pdf/generate', d, { responseType:'blob' }),
  fromWeek: (cid,w,t)=> api.get(`/pdf/week/${cid}/${w}`, { params:{type:t}, responseType:'blob' }),
};


export default api;
