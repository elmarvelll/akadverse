import { motion } from 'motion/react';
import { Mail, Send, File, Plus, Search, ChevronRight, User, Users, Building } from 'lucide-react';
import { useState } from 'react';

export function FacultyEmail() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [isComposing, setIsComposing] = useState(false);

  const emails = [
    { sender: 'Dr. Adewale', subject: 'Assignment Feedback', preview: 'Here is the feedback for your recent submission...', time: '2 hours ago', unread: true },
    { sender: 'Department Admin', subject: 'Faculty Meeting Reminder', preview: 'Please remember the mandatory faculty meeting tomorrow at 10 AM.', time: 'Yesterday', unread: false },
    { sender: 'Student: Daniel Adeyemi', subject: 'Question regarding Chapter 4', preview: 'Dear Professor, I had a question about the recent lecture on data structures.', time: 'Oct 12', unread: false },
  ];

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col pb-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Academic Email</h1>
          <p className="text-slate-500 mt-2 font-medium">Communicate with students, classes, and the department.</p>
        </div>
        <button 
          onClick={() => setIsComposing(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Compose
        </button>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200/60 p-4 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center justify-between w-full p-3 rounded-xl font-medium transition-colors ${activeTab === 'inbox' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <div className="flex items-center gap-3"><Mail className="w-5 h-5" /> Inbox</div>
            {activeTab === 'inbox' && <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">2</span>}
          </button>
          <button 
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-colors ${activeTab === 'sent' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <Send className="w-5 h-5" /> Sent Mail
          </button>
          <button 
            onClick={() => setActiveTab('drafts')}
            className={`flex items-center justify-between w-full p-3 rounded-xl font-medium transition-colors ${activeTab === 'drafts' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <div className="flex items-center gap-3"><File className="w-5 h-5" /> Drafts</div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col h-full bg-white relative">
          {isComposing ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800">New Message</h3>
                <button onClick={() => setIsComposing(false)} className="text-slate-400 hover:text-slate-600 text-sm font-medium">Cancel</button>
              </div>
              <div className="p-6 space-y-4 flex-1">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="text-slate-400 font-medium w-12">To:</span>
                  <input type="text" placeholder="Select student, course, or department..." className="flex-1 outline-none text-slate-800" />
                  <div className="flex gap-2">
                    <button className="p-1.5 rounded bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" title="Individual Student"><User className="w-4 h-4" /></button>
                    <button className="p-1.5 rounded bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" title="Entire Class"><Users className="w-4 h-4" /></button>
                    <button className="p-1.5 rounded bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" title="Department"><Building className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="text-slate-400 font-medium w-12">Subject:</span>
                  <input type="text" placeholder="Enter subject..." className="flex-1 outline-none text-slate-800 font-medium" />
                </div>
                <textarea 
                  className="w-full h-64 outline-none resize-none text-slate-700 leading-relaxed mt-4" 
                  placeholder="Write your message here..."
                ></textarea>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsComposing(false)} className="px-5 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-200 transition-colors">Save Draft</button>
                <button className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
                  <Send className="w-4 h-4" /> Send
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white z-10">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Search emails..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {emails.map((email, i) => (
                  <div key={i} className={`flex items-start gap-4 p-4 border-b border-slate-100 cursor-pointer transition-colors ${email.unread ? 'bg-indigo-50/30 hover:bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                      {email.sender[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm ${email.unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{email.sender}</span>
                        <span className={`text-xs ${email.unread ? 'font-bold text-indigo-600' : 'font-medium text-slate-400'}`}>{email.time}</span>
                      </div>
                      <h4 className={`text-sm mb-1 truncate ${email.unread ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>{email.subject}</h4>
                      <p className="text-sm text-slate-500 truncate">{email.preview}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}