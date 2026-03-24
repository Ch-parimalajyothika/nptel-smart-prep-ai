import axios from 'axios';

// ✅ Backend URL
const API_BASE = "https://nptel-smart-prep-ai.onrender.com/api";

// ✅ Axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 90000
});

// ✅ REQUEST INTERCEPTOR (Attach JWT)
api.interceptors.request.use(
  (cfg) => {
    const token = localStorage.getItem('nptel_token');

    if (token) {
      cfg.headers.Authorization = `Bearer ${token}`; // ✅ FIXED
    }

    console.log("🚀 API CALL:", cfg.baseURL + cfg.url); // DEBUG

    return cfg;
  },
  (error) => Promise.reject(error)
);

// ✅ RESPONSE INTERCEPTOR (Handle 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("❌ API ERROR:", error?.response || error.message);

    if (error.response?.status === 401) {
      localStorage.removeItem('nptel_user');
      localStorage.removeItem('nptel_token');

      // ✅ FIX FOR GITHUB PAGES
      window.location.href = '/#/login';
    }

    return Promise.reject(error);
  }
);

// ================= AUTH =================
export const authAPI = {
  login:  (data) => api.post('/auth/login', data),
  signup: (data) => api.post('/auth/signup', data),
  me:     ()     => api.get('/auth/me'),
};

// ================= COURSES =================
export const coursesAPI = {
  list:   ()         => api.get('/courses/'),
  get:    (id)       => api.get(`/courses/${id}`),
  create: (data)     => api.post('/courses/', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  delete: (id)       => api.delete(`/courses/${id}`),
};

// ================= WEEKS =================
export const weeksAPI = {
  get:            (cid, w)   => api.get(`/weeks/${cid}/${w}`),
  saveTranscript: (cid, w,d) => api.post(`/weeks/${cid}/${w}/transcript`, d),
  fetchYouTube:   (cid, d)   => api.post(`/weeks/${cid}/youtube`, d),
  generateNotes:  (cid, w,d) => api.post(`/weeks/${cid}/${w}/notes`, d),
  generateMCQs:   (cid, w,d) => api.post(`/weeks/${cid}/${w}/mcqs`, d),
};

// ================= NOTES =================
export const notesAPI = {
  generate: (data) => api.post('/notes/generate', data),
  getAll:   ()     => api.get('/notes/'),
  delete:   (id)   => api.delete(`/notes/${id}`),
};

// ================= QUESTIONS =================
export const questionsAPI = {
  generate: (data) => api.post('/questions/generate', data),
};

// ================= EXAM =================
export const examAPI = {
  save:    (data) => api.post('/exam/save', data),
  results: ()     => api.get('/exam/results'),
  stats:   ()     => api.get('/exam/stats'),
  clear:   ()     => api.delete('/exam/results'),
};

// ================= UPLOAD =================
export const uploadAPI = {
  uploadPDF:   (fd) => api.post('/upload/pdf', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadAudio: (fd) => api.post('/upload/audio', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAll:      ()   => api.get('/upload/'),
  delete:      (id) => api.delete(`/upload/${id}`),
};

// ================= CHAT =================
export const chatAPI = {
  send:    (data) => api.post('/chat/message', data),
  history: ()     => api.get('/chat/history'),
  clear:   ()     => api.delete('/chat/history'),
};

// ================= PROGRESS =================
export const progressAPI = {
  get:    ()     => api.get('/progress/'),
  update: (data) => api.post('/progress/update', data),
  reset:  ()     => api.delete('/progress/'),
};

// ================= PDF =================
export const pdfAPI = {
  generate: (data) => api.post('/pdf/generate', data, {
    responseType: 'blob'
  }),
  fromWeek: (cid, w, t) => api.get(`/pdf/week/${cid}/${w}`, {
    params: { type: t },
    responseType: 'blob'
  }),
};

export default api;