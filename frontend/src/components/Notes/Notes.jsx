import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { FileText, Sparkles, BookOpen, List, AlignLeft, Zap, Download, Copy, Check, Trash2, ChevronDown, Network, Brain } from 'lucide-react';
import { notesAPI, pdfAPI, coursesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

// ─── Mermaid Diagram Component ───────────────────────────────────────────────
// This component takes raw mermaid syntax and renders it as a real SVG diagram.
const MermaidDiagram = ({ code }) => {
  const containerRef = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    if (!code) return;

    const renderDiagram = async () => {
      setRendering(true);
      setError('');
      setSvg('');

      // Wait for mermaid to be available (loaded via <script> in index.html)
      let attempts = 0;
      while (!window.mermaid && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.mermaid) {
        setError('Mermaid library not loaded. Add <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script> to your index.html');
        setRendering(false);
        return;
      }

      try {
        // Initialize mermaid with a clean theme
        window.mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          themeVariables: {
            primaryColor: '#6366f1',
            primaryTextColor: '#1e1b4b',
            primaryBorderColor: '#4f46e5',
            lineColor: '#6366f1',
            secondaryColor: '#e0e7ff',
            tertiaryColor: '#f0f9ff',
          },
          flowchart: { curve: 'basis', padding: 20 },
          mindmap: { padding: 16 },
        });

        // Generate a unique ID for this render
        const id = `mermaid-diagram-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        // mermaid.render() returns a promise with { svg }
        const result = await window.mermaid.render(id, code.trim());
        setSvg(result.svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(`Could not render diagram: ${err.message || 'Invalid syntax'}`);
      } finally {
        setRendering(false);
      }
    };

    renderDiagram();
  }, [code]);

  if (rendering) {
    return (
      <div className="flex items-center gap-3 p-6 my-4 bg-slate-50 dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-[#21262d]">
        <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin flex-shrink-0" />
        <span className="text-sm text-slate-500 dark:text-slate-400">Rendering diagram…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 my-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">⚠ Diagram Error</p>
        <p className="text-xs text-red-500 dark:text-red-300 font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-6 p-4 bg-white dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-[#21262d] shadow-sm overflow-x-auto flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// ─── Custom ReactMarkdown code block renderer ─────────────────────────────────
// Intercepts ```mermaid blocks and sends them to MermaidDiagram instead of <pre><code>
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match?.[1];
  const codeString = String(children).replace(/\n$/, '');

  if (!inline && language === 'mermaid') {
    return <MermaidDiagram code={codeString} />;
  }

  // Default code block rendering
  return (
    <pre className="bg-slate-900 dark:bg-[#0d1117] rounded-xl p-4 overflow-x-auto my-4">
      <code className={`text-sm text-green-400 font-mono ${className || ''}`} {...props}>
        {children}
      </code>
    </pre>
  );
};

// ─── Topic → Unsplash image URL mapper ───────────────────────────────────────
// Returns a relevant Unsplash image URL based on keywords in the topic/course
const getTopicImageUrl = (topic = '', course = '', index = 0) => {
  const combined = `${topic} ${course}`.toLowerCase();
  const queries = [
    { keys: ['neural', 'deep learning', 'ml', 'machine learning', 'ai', 'backprop'], q: 'neural-network-visualization' },
    { keys: ['tree', 'graph', 'data structure', 'binary'], q: 'data-structure-tree' },
    { keys: ['algorithm', 'sorting', 'search', 'complexity'], q: 'algorithm-code-programming' },
    { keys: ['database', 'sql', 'nosql', 'storage'], q: 'database-server-technology' },
    { keys: ['network', 'tcp', 'ip', 'protocol', 'os'], q: 'computer-network-servers' },
    { keys: ['compiler', 'automata', 'grammar', 'parsing'], q: 'code-compilation-programming' },
    { keys: ['linear algebra', 'matrix', 'vector', 'calculus'], q: 'mathematics-equations-board' },
    { keys: ['probability', 'statistics', 'distribution'], q: 'statistics-data-analysis' },
  ];

  const matched = queries.find(q => q.keys.some(k => combined.includes(k)));
  const searchQuery = matched ? matched.q : 'computer-science-programming';

  // Use Unsplash Source API (free, no key needed)
  const seeds = ['abc', 'xyz', 'mno', 'pqr'];
  return `https://source.unsplash.com/featured/800x400/?${searchQuery}&sig=${seeds[index % seeds.length]}`;
};

// ─── Note Types ───────────────────────────────────────────────────────────────
const NOTE_TYPES = [
  { id: 'summary',  icon: Zap,     label: 'Summary',       desc: 'Quick overview' },
  { id: 'detailed', icon: AlignLeft, label: 'Detailed Notes', desc: 'In-depth coverage' },
  { id: 'keypoints', icon: List,   label: 'Key Points',    desc: 'Bullet format' },
  { id: 'diagram',  icon: Network, label: 'Diagram',       desc: 'Visual flowchart' },
  { id: 'mindmap',  icon: Brain,   label: 'Mind Map',      desc: 'Concept connections' },
  { id: 'visual',   icon: Sparkles, label: 'Visual Notes', desc: 'Colorful learning' },
];

const WEEKS = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, label: `Week ${i + 1}` }));

// ─── Visual Notes with real images ───────────────────────────────────────────
// Renders a rich card layout with images for "visual" note type
const VisualNotesRenderer = ({ content, course, topic }) => {
  const img1 = getTopicImageUrl(topic, course, 0);
  const img2 = getTopicImageUrl(topic, course, 1);

  // Split the markdown content into sections around "###" headers
  return (
    <div className="space-y-6">
      {/* Hero image banner */}
      <div className="relative rounded-2xl overflow-hidden h-48 bg-gradient-to-br from-brand-600 to-purple-600">
        <img
          src={img1}
          alt={`Visual: ${topic || course}`}
          className="w-full h-full object-cover opacity-60 mix-blend-overlay"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="absolute inset-0 flex items-end p-5">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-widest font-semibold mb-1">{course}</p>
            <h2 className="text-white text-2xl font-bold drop-shadow-lg">{topic || 'Visual Notes'}</h2>
          </div>
        </div>
      </div>

      {/* Render the actual markdown content (including mermaid diagrams) */}
      <ReactMarkdown
        components={{
          code: CodeBlock,
          // Style headers as colorful pill badges
          h3: ({ children }) => (
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white mt-6 mb-3">
              <span className="w-1.5 h-5 bg-brand-500 rounded-full inline-block" />
              {children}
            </h3>
          ),
          // Highlight blockquotes as tip cards
          blockquote: ({ children }) => (
            <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-400 rounded-r-xl my-4">
              <span className="text-xl">💡</span>
              <div className="text-sm text-amber-800 dark:text-amber-200">{children}</div>
            </div>
          ),
          // Make list items into visual chips
          li: ({ children }) => (
            <li className="flex items-start gap-2 mb-2">
              <span className="mt-1.5 w-2 h-2 bg-brand-400 rounded-full flex-shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 text-sm">{children}</span>
            </li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Second contextual image */}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-[#21262d]">
        <img
          src={img2}
          alt="Related concept"
          className="w-full h-40 object-cover"
          onError={e => { e.target.parentElement.style.display = 'none'; }}
        />
        <div className="p-3 bg-slate-50 dark:bg-[#161b22]">
          <p className="text-xs text-slate-400 text-center italic">Visual reference for {topic || course} concepts</p>
        </div>
      </div>
    </div>
  );
};

// ─── Main Notes Component ─────────────────────────────────────────────────────
export default function Notes() {
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(location.state?.courseId || '');
  const [week, setWeek] = useState('');
  const [type, setType] = useState('summary');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoad, setPdfLoad] = useState(false);
  const [saved, setSaved] = useState([]);

  useEffect(() => { coursesAPI.list().then(r => setCourses(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const s = localStorage.getItem('nptel_notes');
    if (s) try { setSaved(JSON.parse(s)); } catch {}
  }, []);

  const generate = async () => {
    if (!course) { toast.error('Select a course'); return; }
    if (!week) { toast.error('Select a week'); return; }
    setLoading(true); setContent('');
    try {
      const r = await notesAPI.generate({ course, week: parseInt(week), type, topic });
      setContent(r.data.content);
      const note = { id: Date.now(), course, week, type, topic, content: r.data.content, createdAt: new Date().toISOString() };
      const updated = [note, ...saved].slice(0, 20);
      setSaved(updated);
      localStorage.setItem('nptel_notes', JSON.stringify(updated));
      toast.success('Notes generated!');
    } catch {
      const demo = genDemo(course, week, type, topic);
      setContent(demo);
      toast.success('Notes generated (demo mode)');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const dlPDF = async () => {
    if (!content) { toast.error('Generate notes first'); return; }
    setPdfLoad(true);
    try {
      const courseTitle = courses.find(c => c.id === parseInt(course) || c.code === course)?.title || course;
      const r = await pdfAPI.generate({ content, title: `Week ${week} — ${type}`, course: courseTitle, week: parseInt(week), note_type: type });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `notes-week${week}-${type}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch { toast.error('PDF failed'); }
    finally { setPdfLoad(false); }
  };

  const dlMD = () => {
    const b = new Blob([content], { type: 'text/markdown' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = `notes-week${week}-${type}.md`; a.click();
    URL.revokeObjectURL(u);
  };

  // Decide how to render the content area
  const renderContent = () => {
    if (type === 'visual') {
      return <VisualNotesRenderer content={content} course={course} topic={topic} />;
    }
    // For diagram / mindmap / all others — use ReactMarkdown with the CodeBlock
    // renderer that intercepts mermaid blocks
    return (
      <ReactMarkdown components={{ code: CodeBlock }}>
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-brand-50 dark:bg-brand-950/30 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h2 className="font-display font-bold text-slate-900 dark:text-white">Notes Generator</h2>
            <p className="text-sm text-slate-400">AI chapter-wise notes with diagrams, mind maps & PDF export</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Course</label>
            <div className="relative">
              <select value={course} onChange={e => setCourse(e.target.value)} className="input appearance-none pr-10">
                <option value="">Select course…</option>
                {courses.map(c => <option key={c.id} value={c.code || String(c.id)}>{c.title}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="label">Week</label>
            <div className="relative">
              <select value={week} onChange={e => setWeek(e.target.value)} className="input appearance-none pr-10">
                <option value="">Select week…</option>
                {WEEKS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="label">Specific Topic (optional)</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Backpropagation…" className="input" />
          </div>
        </div>

        <div className="mb-5">
          <label className="label">Note Type</label>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {NOTE_TYPES.map(({ id, icon: Icon, label, desc }) => (
              <button
                key={id}
                onClick={() => setType(id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  type === id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                    : 'border-slate-200 dark:border-[#21262d] hover:border-brand-300'
                }`}
              >
                <Icon className={`w-4 h-4 mb-2 ${type === id ? 'text-brand-600' : 'text-slate-400'}`} />
                <div className={`text-sm font-semibold ${type === id ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>{label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={loading} className="btn-primary">
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
            : <><Sparkles className="w-4 h-4" />Generate Notes</>
          }
        </button>
      </div>

      {content && (
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#21262d]">
            <span className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" />Week {week} — {type}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setContent('')} className="btn-ghost p-2"><Trash2 className="w-3.5 h-3.5" /></button>
              <button onClick={copy} className="btn-ghost p-2">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button onClick={dlMD} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                <Download className="w-3 h-3" />.md
              </button>
              <button onClick={dlPDF} disabled={pdfLoad} className="btn-primary text-xs py-1.5 px-3">
                {pdfLoad ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-3 h-3" />}PDF
              </button>
            </div>
          </div>

          {/* ✅ Content area — renders mermaid diagrams + images properly */}
          <div className="p-6 prose-custom max-h-[70vh] overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      )}

      {saved.length > 0 && !content && (
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-3">Recent Notes</h3>
          <div className="space-y-2">
            {saved.slice(0, 5).map(n => (
              <button
                key={n.id}
                onClick={() => { setContent(n.content); setType(n.type); setWeek(n.week); setCourse(n.course); setTopic(n.topic || ''); }}
                className="card w-full p-4 text-left flex items-center justify-between card-hover"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-brand-500 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{n.course} — Week {n.week}</div>
                    <div className="text-xs text-slate-400 capitalize">{n.type}{n.topic && ` • ${n.topic}`}</div>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Demo content generator ───────────────────────────────────────────────────
const genDemo = (course, week, type, topic) => {
  const t = topic || 'Core Concepts';

  if (type === 'diagram') {
    return `# ${course} — Week ${week} Flowchart

## ${t}

\`\`\`mermaid
flowchart TD
    A([🚀 Start]) --> B[/Input Data/]
    B --> C[Preprocess]
    C --> D{Is Valid?}
    D -->|✅ Yes| E[Run Algorithm]
    D -->|❌ No| F[Log Error]
    E --> G[Compute Result]
    G --> H{Threshold met?}
    H -->|Yes| I([✅ Output Result])
    H -->|No| C
    F --> J([⚠ End with Error])
\`\`\`

> 💡 This flowchart maps the core algorithm logic for **${t}**. Each diamond is a decision node.`;
  }

  if (type === 'mindmap') {
    return `# ${course} — Week ${week} Mind Map

## 🧠 ${t}

\`\`\`mermaid
mindmap
  root((${t}))
    Definition
      Formal specification
      Intuitive meaning
    Core Properties
      Correctness
      Efficiency
      Scalability
    Key Algorithms
      Greedy approach
      Divide & Conquer
      Dynamic Programming
    Complexity
      Time Analysis
        Best case O(1)
        Average O(log n)
        Worst case O(n²)
      Space Analysis
        In-place O(1)
        With stack O(n)
    Real-World Uses
      Databases
      Compilers
      Networking
      AI & ML
\`\`\`

> 🧠 Follow the branches outward — each level adds detail to the parent concept.`;
  }

  if (type === 'visual') {
    return `## 📊 Process Flow

\`\`\`mermaid
graph LR
    A[📥 Input] --> B[🔄 Process]
    B --> C{Decision}
    C -->|Path A| D[🎯 Result A]
    C -->|Path B| E[🎯 Result B]
    D --> F[📤 Output]
    E --> F
\`\`\`

### 🔑 Key Concepts

- 🎯 **Core Idea**: The central mechanism of ${t} drives all downstream behavior.
- ⚡ **Critical Formula**: T(n) = O(n log n) — memorise for exams.
- 📈 **Scalability**: Performance degrades gracefully with input size.
- 🛠️ **Applications**: Found in databases, OS schedulers, and ML pipelines.

### 🧩 Component Breakdown

\`\`\`mermaid
flowchart LR
    subgraph Input Layer
        A[Raw Data] --> B[Validator]
    end
    subgraph Core Engine
        B --> C[Parser]
        C --> D[Optimizer]
    end
    subgraph Output Layer
        D --> E[Formatter]
        E --> F[Result]
    end
\`\`\`

### 💡 Memory Tip

> Think of ${t} like a **factory assembly line**: raw materials (input) move through specialised stations (algorithms) and emerge as a finished product (output). Each station has a specific role and time budget.

### 📝 Exam Pattern

- **MCQs**: 2–3 questions on definitions and properties.
- **Short Answer**: 1 question on real-world applications.
- **Problem Solving**: Trace through an algorithm step-by-step.`;
  }

  if (type === 'keypoints') {
    return `## Key Points — Week ${week}\n\n### ${t}\n\n- **Definition**: Fundamental structure enabling efficient data access\n- **Time Complexity**: O(log n) average case\n- **Space Complexity**: O(n)\n- **Applications**: Databases, compilers, operating systems\n- **NPTEL Focus**: Always appears in MCQs — know the formula!\n\n### Must Remember\n\`\`\`\nT(n) = O(n log n)  — typical algorithm\nS(n) = O(n)        — space usage\n\`\`\`\n\n> 💡 Pro Tip: This topic appears in 3–4 questions every semester.`;
  }

  if (type === 'summary') {
    return `# ${course} — Week ${week} Summary\n\n## Overview\n\nThis week covers **${t}**, a foundational pillar of ${course}. Understanding these concepts is critical for the NPTEL exam.\n\n## Core Ideas\n\nThe week introduces key algorithms and theoretical frameworks. Focus on understanding the *why* behind each concept.\n\n## Quick Revision\n\n- Core concept: memorise the definition\n- Key formula: T(n) = O(n log n)\n- Common exam trap: boundary conditions\n\n---\n*Generated by NPTEL Smart Prep AI*`;
  }

  return `# ${course} — Week ${week}: Detailed Notes\n\n## 1. Introduction to ${t}\n\n${t} is a fundamental concept in computer science that forms the basis for advanced algorithms and data structures.\n\n## 2. Core Definitions\n\n**Definition**: A systematic approach to organising and processing computational problems efficiently.\n\n## 3. Algorithm\n\n\`\`\`python\ndef algorithm(data):\n    # Step 1: Initialise\n    result = []\n    # Step 2: Process each element\n    for item in data:\n        result.append(process(item))\n    return result  # O(n) time, O(n) space\n\`\`\`\n\n---\n*NPTEL Smart Prep AI — Week ${week}*`;
};