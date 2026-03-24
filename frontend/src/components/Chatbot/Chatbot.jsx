import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, Send, Trash2, Bot, User, Sparkles, BookOpen,
         Lightbulb, HelpCircle, Code, Database, AlertCircle, Info } from 'lucide-react';
import { chatAPI, uploadAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const SUGGESTIONS = [
  { icon:BookOpen,    text:'Explain HCI concepts: Fitts Law and Hick Law' },
  { icon:HelpCircle,  text:'What are the top MCQ topics in Blockchain?' },
  { icon:Lightbulb,   text:'Give me a mnemonic to remember OSI model layers' },
  { icon:Code,        text:'Show Python example for a binary search tree' },
  { icon:Database,    text:'Explain SQL joins with examples' },
  { icon:AlertCircle, text:'What are tricky questions in Computer Vision MCQs?' },
];

const getDemoReply = msg => {
  const m = msg.toLowerCase();
  if (m.includes('hci') || m.includes('fitts') || m.includes('hick'))
    return `## HCI Key Laws\n\n**Fitts' Law**: Time to reach a target = a + b·log₂(2D/W)\n- D = distance, W = target width\n- Larger & closer targets = faster to click\n\n**Hick's Law**: RT = b·log₂(n+1)\n- More choices = longer decision time\n- Simplify menus to speed up UX\n\n### NPTEL Exam Pattern\n- Numerical problems using Fitts' formula\n- Comparing two UI designs using Hick's law\n\n📌 **Exam Tip:** Memorise both formulas — they appear in 2–3 MCQs every semester.`;
  if (m.includes('blockchain'))
    return `## Blockchain — High-Frequency Topics\n\n### Consensus Mechanisms\n| Method | Description |\n|--------|-------------|\n| PoW | Proof of Work — mining (Bitcoin) |\n| PoS | Proof of Stake — validators (Ethereum 2) |\n| PBFT | Byzantine Fault Tolerant — Hyperledger |\n\n### Must-Know Formulas\n\`\`\`\nBlock Hash = SHA-256(prev_hash + data + nonce)\nMerkle Root = Hash(Hash(TX1+TX2) + Hash(TX3+TX4))\n\`\`\`\n\n📌 **Exam Tip:** Merkle trees, hash functions, and 51% attack definition are exam favourites.`;
  if (m.includes('osi') || m.includes('mnemonic'))
    return `## OSI Model Mnemonic\n\n**"All People Seem To Need Data Processing"**\n\n| # | Layer | Mnemonic |\n|---|-------|---------|\n| 7 | Application | **A**ll |\n| 6 | Presentation | **P**eople |\n| 5 | Session | **S**eem |\n| 4 | Transport | **T**o |\n| 3 | Network | **N**eed |\n| 2 | Data Link | **D**ata |\n| 1 | Physical | **P**rocessing |\n\n📌 **Exam Tip:** Know which protocol belongs to which layer — HTTP(7), TCP(4), IP(3), Ethernet(2).`;
  return `## Answer\n\nGreat question about **${msg.slice(0,40)}**!\n\n### Key Points\n- This is a core NPTEL exam topic\n- Understanding both theory and application is important\n- Tricky MCQs often test edge cases\n\n### Study Tips\n1. Review the official lecture transcript for Week 1–3\n2. Practice with 20+ MCQs on this topic\n3. Focus on definitions and formulas\n\n> 💡 Upload your lecture PDFs in the **Upload** section and I'll give you context-specific answers based on your actual course material!\n\n📌 **Exam Tip:** Look for keywords like "which of the following is NOT correct" — these are common trap questions.`;
};

const TypingDots = () => (
  <div className="flex items-end gap-2 mb-4">
    <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0"><Bot className="w-3.5 h-3.5 text-white"/></div>
    <div className="chat-bubble-ai px-4 py-3">
      <div className="flex gap-1 items-center h-5">{[1,2,3].map(i=><div key={i} className="w-2 h-2 rounded-full bg-brand-400 typing-dot"/>)}</div>
    </div>
  </div>
);

const Bubble = ({ msg }) => {
  const isUser = msg.role==='user';
  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser?'flex-row-reverse':''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isUser?'bg-slate-200 dark:bg-slate-700':'bg-brand-500'}`}>
        {isUser?<User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300"/>:<Bot className="w-3.5 h-3.5 text-white"/>}
      </div>
      <div className={`max-w-[82%] px-4 py-3 text-sm ${isUser?'chat-bubble-user':'chat-bubble-ai'}`}>
        {isUser ? <p className="text-white leading-relaxed">{msg.content}</p>
                : <div className="prose-custom text-slate-700 dark:text-slate-300"><ReactMarkdown>{msg.content}</ReactMarkdown></div>}
        <div className={`text-[10px] mt-1.5 ${isUser?'text-white/60 text-right':'text-slate-400'}`}>
          {new Date(msg.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
        </div>
      </div>
    </div>
  );
};

export default function Chatbot() {
  const [messages, setMessages] = useState([{
    role:'assistant', time:Date.now(),
    content:`## Welcome to NPTEL Smart Prep AI! 🎓\n\nI'm your AI tutor with **RAG** — I can answer from your uploaded course materials.\n\n### I can help with:\n- 📚 HCI, Computer Vision, Image Processing, Blockchain & more\n- 🎯 MCQ answers with explanations\n- 💡 Exam tips & mnemonics\n- 📝 Concept clarifications\n\n**Upload your lecture PDFs/audio** for context-aware answers.\n\n*What would you like to learn today?*`
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [hasCtx,  setHasCtx]  = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages, loading]);
  useEffect(() => { uploadAPI.getAll().then(r=>setHasCtx(r.data.length>0)).catch(()=>{}); }, []);

  const send = async text => {
    const content = text || input.trim();
    if (!content) return;
    setInput('');
    setMessages(p => [...p, {role:'user',content,time:Date.now()}]);
    setLoading(true);
    try {
      const history = messages.map(m=>({role:m.role,content:m.content}));
      const r = await chatAPI.send({message:content,history});
      setMessages(p => [...p, {role:'assistant',content:r.data.reply,time:Date.now()}]);
    } catch {
      await new Promise(r=>setTimeout(r,800));
      setMessages(p => [...p, {role:'assistant',content:getDemoReply(content),time:Date.now()}]);
    } finally { setLoading(false); }
  };

  const clear = () => {
    setMessages([{role:'assistant',time:Date.now(),content:'Chat cleared! What would you like to learn? 😊'}]);
    chatAPI.clear().catch(()=>{});
    toast.success('Chat cleared');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 lg:p-6 gap-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 dark:bg-brand-950/30 rounded-xl flex items-center justify-center"><MessageCircle className="w-5 h-5 text-brand-600"/></div>
          <div>
            <h2 className="font-display font-bold text-slate-900 dark:text-white">AI Chatbot</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-xs text-slate-400">Gemini AI</span>
              {hasCtx && <span className="badge bg-brand-50 dark:bg-brand-950/30 text-brand-600 text-[10px]"><Database className="w-2.5 h-2.5"/> RAG active</span>}
            </div>
          </div>
        </div>
        <button onClick={clear} className="btn-ghost p-2 text-red-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>

      {!hasCtx && (
        <div className="flex-shrink-0 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-amber-700 dark:text-amber-300">Upload PDFs or audio in <strong>Upload</strong> for context-aware answers from your own materials.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {messages.map((m,i) => <Bubble key={i} msg={m}/>)}
        {loading && <TypingDots/>}
        <div ref={bottomRef}/>
      </div>

      {messages.length <= 2 && (
        <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTIONS.slice(0,4).map(({icon:Icon,text}) => (
            <button key={text} onClick={() => send(text)} className="card p-3 text-left flex items-center gap-2.5 hover:border-brand-200 dark:hover:border-brand-800 transition-all group">
              <div className="w-7 h-7 bg-brand-50 dark:bg-brand-950/30 rounded-lg flex items-center justify-center flex-shrink-0"><Icon className="w-3.5 h-3.5 text-brand-500"/></div>
              <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">{text}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-shrink-0">
        <div className="flex gap-3 items-end bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#21262d] rounded-2xl p-3 shadow-sm focus-within:border-brand-400 transition-colors">
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Ask anything about NPTEL courses…" rows={1}
            className="flex-1 resize-none bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none max-h-32 leading-relaxed"
            style={{minHeight:'24px'}}/>
          <button onClick={()=>send()} disabled={!input.trim()||loading}
            className="w-9 h-9 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 active:scale-90 shadow-glow">
            {loading?<div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Send className="w-3.5 h-3.5"/>}
          </button>
        </div>
        <p className="text-center text-xs text-slate-400 mt-1.5">
          <Sparkles className="w-3 h-3 inline mr-1 text-brand-400"/>Powered by Google Gemini · {hasCtx?'Using your uploaded materials':'Upload notes for context-aware answers'}
        </p>
      </div>
    </div>
  );
}
