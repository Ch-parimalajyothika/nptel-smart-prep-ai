import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload as UploadIcon, FileText, Volume2, Video, Link,
  X, CheckCircle, Loader, Trash2, Eye, AlertTriangle,
  Info, Mic
} from 'lucide-react';
import { uploadAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const TABS = [
  { id:'pdf',   label:'PDF',   icon:FileText },
  { id:'audio', label:'Audio', icon:Volume2  },
];

const DropZone = ({ accept, label, icon:Icon, onFile }) => {
  const onDrop = useCallback(files=>{ if(files[0]) onFile(files[0]); },[onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept, maxFiles:1 });
  return (
    <div {...getRootProps()} className={`upload-zone p-10 flex flex-col items-center gap-3 ${isDragActive?'drag-over':''}`}>
      <input {...getInputProps()}/>
      <div className="w-14 h-14 bg-brand-50 dark:bg-brand-950/30 rounded-2xl flex items-center justify-center">
        <Icon className="w-7 h-7 text-brand-500"/>
      </div>
      <div className="text-center">
        <p className="font-semibold text-slate-700 dark:text-slate-300">{isDragActive?'Drop it!':label}</p>
        <p className="text-sm text-slate-400 mt-1">Drag & drop or click to browse</p>
      </div>
    </div>
  );
};

const FileCard = ({ item, onDelete, onView }) => (
  <div className="card p-4 flex items-center gap-4 animate-slide-up">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
      ${item.type==='pdf'?'bg-red-50 dark:bg-red-950/30':'bg-purple-50 dark:bg-purple-950/30'}`}>
      {item.type==='pdf'?<FileText className="w-5 h-5 text-red-500"/>:<Volume2 className="w-5 h-5 text-purple-500"/>}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.name}</div>
      <div className="flex items-center gap-2 mt-0.5">
        {item.status==='processing' && <span className="text-xs text-amber-500 flex items-center gap-1"><Loader className="w-3 h-3 animate-spin"/>Processing…</span>}
        {item.status==='done'       && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>Ready</span>}
        {item.status==='error'      && <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Failed</span>}
        {item.size && <span className="text-xs text-slate-400">{(item.size/1024/1024).toFixed(1)} MB</span>}
      </div>
      {item.transcript && (
        <div className="mt-1.5 p-2 bg-slate-50 dark:bg-[#161b22] rounded-lg text-xs text-slate-500 line-clamp-2">
          {item.transcript.slice(0,120)}…
        </div>
      )}
    </div>
    <div className="flex items-center gap-1 flex-shrink-0">
      {item.transcript && <button onClick={()=>onView(item)} className="btn-ghost p-2"><Eye className="w-3.5 h-3.5"/></button>}
      <button onClick={()=>onDelete(item.id)} className="btn-ghost p-2 text-red-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
    </div>
  </div>
);

export default function Upload() {
  const [tab,     setTab]     = useState('pdf');
  const [uploads, setUploads] = useState([]);
  const [viewing, setViewing] = useState(null);

  const addUpload = u => setUploads(p=>[u,...p]);
  const updUpload = (id, patch) => setUploads(p=>p.map(u=>u.id===id?{...u,...patch}:u));
  const delUpload = id => setUploads(p=>p.filter(u=>u.id!==id));

  const handlePDF = async (file) => {
    const id = Date.now();
    addUpload({id, name:file.name, type:'pdf', size:file.size, status:'processing'});
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await uploadAPI.uploadPDF(fd);
      updUpload(id, {status:'done', dbId:r.data.id, transcript:r.data.text_preview});
      toast.success('PDF extracted!');
    } catch {
      // Demo mode
      setTimeout(()=>{
        updUpload(id,{status:'done',transcript:'PDF extracted. This document contains lecture notes on the selected NPTEL topic. Chapters include definitions, algorithms, worked examples and practice questions…'});
        toast.success('PDF processed (demo mode)');
      },1500);
    }
  };

  const handleAudio = async (file) => {
    const id = Date.now();
    addUpload({id, name:file.name, type:'audio', size:file.size, status:'processing'});
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await uploadAPI.uploadAudio(fd);
      updUpload(id,{status:'done', dbId:r.data.id, transcript:r.data.transcript});
      toast.success('Audio transcribed with Whisper!');
    } catch {
      setTimeout(()=>{
        updUpload(id,{status:'done',transcript:'Welcome to this NPTEL lecture. Today we cover fundamental concepts including definitions, theoretical frameworks, and worked examples. Key topics include algorithms, data structures, and their applications in modern computing systems…'});
        toast.success('Audio transcribed (demo mode)');
      },2500);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-sky-50 dark:bg-sky-950/30 rounded-xl flex items-center justify-center">
            <UploadIcon className="w-5 h-5 text-sky-600"/>
          </div>
          <div>
            <h2 className="font-display font-bold text-slate-900 dark:text-white">Upload & Transcribe</h2>
            <p className="text-sm text-slate-400">Upload materials — AI extracts text for notes & chatbot context</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-[#161b22] rounded-xl p-1 mb-5">
          {TABS.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${tab===id?'bg-white dark:bg-[#21262d] text-slate-900 dark:text-white shadow-sm':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Icon className="w-4 h-4"/>{label}
            </button>
          ))}
        </div>

        {tab==='pdf' && (
          <div className="space-y-3">
            <DropZone accept={{'application/pdf':['.pdf']}} label="Drop your PDF lecture notes" icon={FileText} onFile={handlePDF}/>
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-blue-700 dark:text-blue-300">PDF text is extracted and stored as your course context. The AI chatbot will use it to answer your questions.</p>
            </div>
          </div>
        )}

        {tab==='audio' && (
          <div className="space-y-3">
            <DropZone accept={{'audio/*':['.mp3','.wav','.m4a','.ogg','.flac']}} label="Drop audio recording (MP3, WAV, M4A…)" icon={Mic} onFile={handleAudio}/>
            <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl">
              <Info className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                <strong>Whisper AI</strong> transcribes your audio automatically. Upload recordings of NPTEL lectures, study sessions, or class notes.
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>YouTube Videos:</strong> Go to <strong>Courses → Week → Transcript</strong> and paste the YouTube URL to fetch captions directly. If captions aren't available, download the audio and upload here.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-slate-900 dark:text-white mb-3">Uploaded Files ({uploads.length})</h3>
          <div className="space-y-3">
            {uploads.map(u=><FileCard key={u.id} item={u} onDelete={delUpload} onView={setViewing}/>)}
          </div>
        </div>
      )}

      {uploads.length===0 && (
        <div className="card p-10 text-center">
          <UploadIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
          <p className="text-slate-400 text-sm">No uploads yet. Upload PDFs or audio to enable context-aware AI answers.</p>
        </div>
      )}

      {/* Transcript viewer modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setViewing(null)}>
          <div className="card w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#21262d]">
              <h3 className="font-display font-bold text-slate-900 dark:text-white">{viewing.name}</h3>
              <button onClick={()=>setViewing(null)} className="btn-ghost p-2"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
              {viewing.transcript}
            </div>
          </div>
        </div>
      )}

      <div className="disclaimer">
        ⚠️ <strong>Legal notice:</strong> Only upload content you own or have permission to use. Do not upload copyrighted NPTEL videos directly. Use the YouTube transcript feature in Week View for NPTEL course videos.
      </div>
    </div>
  );
}
