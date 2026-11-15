import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { 
  Bot, BookOpen, Calendar, FileText, Layout, Lightbulb, 
  Network, Headphones, SquarePlay, HelpCircle, PenTool,
  MessageSquare, Upload, Mic, Send, Paperclip, ChevronLeft,
  CheckCircle, FileSpreadsheet, FileBox
} from 'lucide-react';

// === Mock Data & Configurations === //

type AITool = {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: string;
  colorClass: string;
  hoverAnimType: 'pulse' | 'flip' | 'slide' | 'breathe' | 'bounce' | 'wave' | 'ripple';
};

const STUDENT_TOOLS: AITool[] = [
  // Virtual Assistants
  { id: 's-va-1', name: 'Student Virtual Assistant', description: 'Your personal AkadVerse assistant for navigation and platform tasks.', icon: Bot, category: 'Virtual Assistant', colorClass: 'text-indigo-500 bg-indigo-50 border-indigo-100', hoverAnimType: 'pulse' },
  { id: 's-va-2', name: 'Study Virtual Assistant', description: 'An AI dedicated to learning support, concepts, and exam prep.', icon: BookOpen, category: 'Virtual Assistant', colorClass: 'text-purple-500 bg-purple-50 border-purple-100', hoverAnimType: 'flip' },
  // Productivity
  { id: 's-p-1', name: 'Workspace Integration AI', description: 'Interact with your docs, sheets, and files using AI.', icon: FileBox, category: 'Productivity AI', colorClass: 'text-blue-500 bg-blue-50 border-blue-100', hoverAnimType: 'slide' },
  { id: 's-p-2', name: 'Schedule Manager AI', description: 'AI planner for managing study time and schedules.', icon: Calendar, category: 'Productivity AI', colorClass: 'text-emerald-500 bg-emerald-50 border-emerald-100', hoverAnimType: 'flip' },
  // Learning Tools
  { id: 's-l-1', name: 'Note Creator', description: 'Generate structured notes from any content.', icon: FileText, category: 'Learning AI Tools', colorClass: 'text-rose-500 bg-rose-50 border-rose-100', hoverAnimType: 'slide' },
  { id: 's-l-2', name: 'Slide Creator', description: 'Create presentation slides automatically.', icon: Layout, category: 'Learning AI Tools', colorClass: 'text-amber-500 bg-amber-50 border-amber-100', hoverAnimType: 'slide' },
  { id: 's-l-3', name: 'Concept Explainer', description: 'Simplify complex academic concepts.', icon: Lightbulb, category: 'Learning AI Tools', colorClass: 'text-yellow-500 bg-yellow-50 border-yellow-100', hoverAnimType: 'pulse' },
  { id: 's-l-4', name: 'External Resource Puller', description: 'Find academic papers and resources.', icon: Network, category: 'Learning AI Tools', colorClass: 'text-cyan-500 bg-cyan-50 border-cyan-100', hoverAnimType: 'pulse' },
  { id: 's-l-5', name: 'Note to Audio Converter', description: 'Turn written notes into podcasts/audio.', icon: Headphones, category: 'Learning AI Tools', colorClass: 'text-fuchsia-500 bg-fuchsia-50 border-fuchsia-100', hoverAnimType: 'wave' },
  { id: 's-l-6', name: 'Note to Animation Converter', description: 'Turn concepts into visual animations.', icon: SquarePlay, category: 'Learning AI Tools', colorClass: 'text-red-500 bg-red-50 border-red-100', hoverAnimType: 'pulse' },
  { id: 's-l-7', name: 'Quiz Generator', description: 'Generate flashcards and quizzes.', icon: HelpCircle, category: 'Learning AI Tools', colorClass: 'text-violet-500 bg-violet-50 border-violet-100', hoverAnimType: 'bounce' },
  { id: 's-l-8', name: 'Practice Question Generator', description: 'Prepare for exams with practice sets.', icon: PenTool, category: 'Learning AI Tools', colorClass: 'text-orange-500 bg-orange-50 border-orange-100', hoverAnimType: 'slide' },
];

const FACULTY_TOOLS: AITool[] = [
  // Virtual Assistants
  { id: 'f-va-1', name: 'Faculty Virtual Assistant', description: 'Helps faculty manage academic workflows and classes.', icon: Bot, category: 'Virtual Assistant', colorClass: 'text-indigo-500 bg-indigo-50 border-indigo-100', hoverAnimType: 'breathe' },
  { id: 'f-va-2', name: 'Teaching Virtual Assistant', description: 'Helps prepare lecture materials and explain topics.', icon: BookOpen, category: 'Virtual Assistant', colorClass: 'text-purple-500 bg-purple-50 border-purple-100', hoverAnimType: 'slide' },
  // Productivity
  { id: 'f-p-1', name: 'Workspace Integration AI', description: 'Interact with your docs, sheets, and files using AI.', icon: FileBox, category: 'Productivity AI', colorClass: 'text-blue-500 bg-blue-50 border-blue-100', hoverAnimType: 'slide' },
  { id: 'f-p-2', name: 'Schedule Manager AI', description: 'AI planner for managing study time and schedules.', icon: Calendar, category: 'Productivity AI', colorClass: 'text-emerald-500 bg-emerald-50 border-emerald-100', hoverAnimType: 'flip' },
  // Teaching AI Tools
  { id: 'f-t-1', name: 'Note Creator', description: 'Generate structured lecture notes.', icon: FileText, category: 'Teaching AI Tools', colorClass: 'text-rose-500 bg-rose-50 border-rose-100', hoverAnimType: 'slide' },
  { id: 'f-t-2', name: 'Slide Creator', description: 'Create presentation slides automatically.', icon: Layout, category: 'Teaching AI Tools', colorClass: 'text-amber-500 bg-amber-50 border-amber-100', hoverAnimType: 'slide' },
  { id: 'f-t-3', name: 'External Resource Puller', description: 'Find academic papers and resources.', icon: Network, category: 'Teaching AI Tools', colorClass: 'text-cyan-500 bg-cyan-50 border-cyan-100', hoverAnimType: 'pulse' },
  { id: 'f-t-4', name: 'Assignment Generator', description: 'Create comprehensive assignments.', icon: FileText, category: 'Teaching AI Tools', colorClass: 'text-teal-500 bg-teal-50 border-teal-100', hoverAnimType: 'slide' },
  { id: 'f-t-5', name: 'Sample Question Generator', description: 'Draft exam and quiz questions.', icon: HelpCircle, category: 'Teaching AI Tools', colorClass: 'text-violet-500 bg-violet-50 border-violet-100', hoverAnimType: 'bounce' },
  // Operational
  { id: 'f-o-1', name: 'Attendance AI', description: 'Helps automate attendance processing.', icon: CheckCircle, category: 'Operational AI', colorClass: 'text-sky-500 bg-sky-50 border-sky-100', hoverAnimType: 'ripple' },
  { id: 'f-o-2', name: 'Test & Grading Upload AI', description: 'Upload grade sheets and process scores.', icon: FileSpreadsheet, category: 'Operational AI', colorClass: 'text-lime-500 bg-lime-50 border-lime-100', hoverAnimType: 'slide' },
];

const SUGGESTED_ACTIONS = ['Generate Quiz', 'Summarize Notes', 'Create Slides', 'Explain Concepts'];

// === Tool Card Component === //

const ToolCard = ({ tool, onClick }: { tool: AITool, onClick: (tool: AITool) => void }) => {
  // Define hover animations based on type
  const getIconAnimation = (type: string) => {
    switch(type) {
      case 'pulse': return { scale: [1, 1.15, 1], transition: { repeat: Infinity, duration: 1.5 } };
      case 'flip': return { rotateY: 180, transition: { duration: 0.6 } };
      case 'slide': return { x: [0, 4, 0], transition: { duration: 0.4 } };
      case 'breathe': return { scale: [1, 1.05, 1], opacity: [1, 0.8, 1], transition: { repeat: Infinity, duration: 2 } };
      case 'bounce': return { y: [0, -6, 0], transition: { duration: 0.5, ease: "easeOut" } };
      case 'wave': return { scaleY: [1, 1.3, 1], transition: { repeat: Infinity, duration: 0.8 } };
      case 'ripple': return { scale: [1, 1.2, 1], opacity: [1, 0.5, 1], transition: { duration: 0.6 } };
      default: return { scale: 1.1 };
    }
  };

  const Icon = tool.icon;

  return (
    <motion.div
      whileHover={{ y: -6, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(tool)}
      className={`group relative bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm cursor-pointer transition-all w-full flex flex-col h-full`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br from-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl`} />
      
      {/* Background Glow */}
      <div className={`absolute -inset-1 opacity-0 group-hover:opacity-20 transition-opacity blur-xl rounded-[2rem] bg-current ${tool.colorClass.split(' ')[0]}`} />

      <div className="relative z-10 flex flex-col h-full">
        <motion.div 
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-sm border ${tool.colorClass}`}
          whileHover={getIconAnimation(tool.hoverAnimType)}
        >
          <Icon className="w-7 h-7" />
        </motion.div>
        
        <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-900 transition-colors">
          {tool.name}
        </h3>
        
        <p className="text-sm font-medium text-slate-500 leading-relaxed mt-auto">
          {tool.description}
        </p>
      </div>
    </motion.div>
  );
};

// === Universal AI Interface === //

const UniversalAIInterface = ({ tool, onBack }: { tool: AITool, onBack: () => void }) => {
  const [messages, setMessages] = useState<{id: string, text: string | React.ReactNode, isAi: boolean}[]>([
    { id: 'init', text: `Hello! I'm your ${tool.name}. How can I assist you today?`, isAi: true }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && !isUploading) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), text: userText, isAi: false }]);
    setIsProcessing(true);

    // Simulate AI thinking and response
    setTimeout(() => {
      setIsProcessing(false);
      let reply: React.ReactNode = "I've processed your request. Here is the generated content based on your input.";
      
      // Special mockup for Note Creator / Slide Creator / Quiz
      if (tool.name.includes('Quiz')) {
        reply = (
          <div className="space-y-3">
            <p>Here is a sample quiz question:</p>
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <p className="font-bold text-slate-800 mb-3">Q: What is the powerhouse of the cell?</p>
              <div className="space-y-2">
                {['Nucleus', 'Ribosome', 'Mitochondria', 'Endoplasmic Reticulum'].map((opt, i) => (
                  <button key={i} className="w-full text-left p-2 rounded-lg border border-slate-100 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
                    {String.fromCharCode(65 + i)}. {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      } else if (tool.name.includes('Slide')) {
        reply = (
          <div className="space-y-3">
            <p>I've structured a 3-slide outline for you:</p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
               {[1, 2, 3].map(i => (
                 <div key={i} className="min-w-[150px] aspect-video bg-white border border-slate-200 rounded-xl shadow-sm p-3 snap-start flex flex-col justify-center">
                   <div className="h-2 w-12 bg-slate-200 rounded mb-2" />
                   <div className="h-1.5 w-full bg-slate-100 rounded mb-1" />
                   <div className="h-1.5 w-3/4 bg-slate-100 rounded" />
                 </div>
               ))}
            </div>
          </div>
        );
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), text: reply, isAi: true }]);
    }, 1500);
  };

  const simulateUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            setMessages(prevMsg => [...prevMsg, { id: Date.now().toString(), text: (
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800">Lecture_Notes.pdf</p>
                  <p className="text-xs text-slate-500">2.4 MB • Uploaded</p>
                </div>
              </div>
            ), isAi: false }]);
          }, 400);
          return 100;
        }
        return prev + 20;
      });
    }, 200);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-[calc(100vh-100px)] max-h-[800px] bg-white rounded-[32px] border border-slate-200/60 shadow-xl overflow-hidden"
    >
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50 backdrop-blur-md sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-slate-200/50 text-slate-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tool.colorClass}`}>
          <tool.icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 leading-tight">{tool.name}</h2>
          <p className="text-xs font-medium text-slate-500">{tool.description}</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-4 ${msg.isAi ? '' : 'flex-row-reverse'}`}
            >
              {msg.isAi && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${tool.colorClass}`}>
                  <tool.icon className="w-4 h-4" />
                </div>
              )}
              <div className={`px-5 py-3.5 rounded-2xl max-w-[80%] text-sm font-medium shadow-sm ${
                msg.isAi 
                  ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm' 
                  : 'bg-indigo-600 text-white rounded-tr-sm shadow-indigo-200'
              }`}>
                {msg.text}
              </div>
            </motion.div>
          ))}

          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${tool.colorClass} relative`}>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin opacity-50" />
                <tool.icon className="w-4 h-4" />
              </div>
              <div className="px-5 py-4 bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto space-y-4">
          
          {/* Smart Suggestions */}
          {messages.length < 3 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {SUGGESTED_ACTIONS.map(action => (
                <motion.button
                  key={action}
                  whileHover={{ y: -2 }}
                  onClick={() => setInput(action)}
                  className="px-4 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-xs font-bold rounded-full border border-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  {action}
                </motion.button>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          <AnimatePresence>
            {isUploading && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 overflow-hidden"
              >
                <div className="flex justify-between text-xs font-bold text-indigo-700 mb-2">
                  <span>Uploading file...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500 rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-3xl p-2 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-300 transition-all shadow-sm">
            <button 
              type="button" 
              onClick={simulateUpload}
              className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-colors shrink-0"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Upload notes or ask the AI to generate material..."
              className="w-full bg-transparent border-none focus:outline-none resize-none min-h-[44px] max-h-32 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400"
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <button 
              type="button"
              onClick={() => setIsRecording(!isRecording)}
              className={`p-3 rounded-2xl transition-all shrink-0 ${isRecording ? 'text-rose-500 bg-rose-50 animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
            >
              <Mic className="w-5 h-5" />
            </button>
            <button 
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl transition-colors shrink-0 shadow-md disabled:shadow-none"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </form>
          <div className="text-center text-[10px] font-medium text-slate-400">
            Supported formats: PDF, DOCX, Slides, Images, Notes
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// === Main AI Studio Component === //

export function AIStudio() {
  const { role } = useAuth();
  const [activeTool, setActiveTool] = useState<AITool | null>(null);

  // Default to student tools if not faculty/admin, though in a real app admin might have their own
  const tools = role === 'faculty' ? FACULTY_TOOLS : STUDENT_TOOLS;

  // Group tools by category
  const categorizedTools = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, AITool[]>);

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header - only show on dashboard */}
        <AnimatePresence mode="wait">
          {!activeTool && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              className="mb-12"
            >
              <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-4">
                <Bot className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
                AI Studio
              </h1>
              <p className="text-lg text-slate-500 font-medium">
                Your powerful {role === 'faculty' ? 'teaching assistant' : 'learning lab'} integrated inside AkadVerse.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {activeTool ? (
            <UniversalAIInterface 
              key="interface" 
              tool={activeTool} 
              onBack={() => setActiveTool(null)} 
            />
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12 pb-24"
            >
              {Object.entries(categorizedTools).map(([category, tools], idx) => (
                <section key={category} className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-200/60 pb-3">
                    <div className="w-8 h-8 bg-slate-200/50 rounded-lg flex items-center justify-center text-slate-500 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">{category}</h2>
                  </div>
                  
                  <div className={`grid gap-6 ${
                    category === 'Virtual Assistant' || category === 'Productivity AI'
                      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2' // Full screen spanning
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  }`}>
                    {tools.map(tool => (
                      <div 
                        key={tool.id} 
                        className={
                          category === 'Virtual Assistant' || category === 'Productivity AI'
                            ? 'min-h-[260px]' // Make them longer vertically as requested
                            : ''
                        }
                      >
                        <ToolCard tool={tool} onClick={setActiveTool} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
