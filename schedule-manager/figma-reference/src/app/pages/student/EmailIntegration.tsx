import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Search, Star, Send, Archive, Trash2, Plus, Paperclip, Bell, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router';

const MOCK_EMAILS = [
  {
    id: 1,
    sender: "Dr. Adebayo Ogunley",
    initials: "DA",
    color: "bg-blue-500",
    subject: "CSC 301: Assignment Submission Extended",
    preview: "Good afternoon class, I am extending the deadline for the final assignment.",
    time: "2 hours ago",
    unread: true,
    hasAttachment: true,
    isStarred: false
  },
  {
    id: 2,
    sender: "Student Affairs Office",
    initials: "SA",
    color: "bg-purple-500",
    subject: "Mid-Semester Break Announcement",
    preview: "Dear Students, This is to inform you that the mid-semester break will commence...",
    time: "5 hours ago",
    unread: false,
    hasAttachment: false,
    isStarred: true
  },
  {
    id: 3,
    sender: "Career Services",
    initials: "CS",
    color: "bg-teal-500",
    subject: "Tech Career Fair 2026 - Registration Open",
    preview: "Hello Daniel, We are excited to announce that registration for the upcoming Tech Career Fair...",
    time: "1 day ago",
    unread: false,
    hasAttachment: true,
    isStarred: true
  },
  {
    id: 4,
    sender: "Library Services",
    initials: "LS",
    color: "bg-indigo-500",
    subject: "Overdue Book Reminder",
    preview: "This is a friendly reminder that you have 1 book that is overdue. Please return it...",
    time: "1 day ago",
    unread: false,
    hasAttachment: false,
    isStarred: false
  },
  {
    id: 5,
    sender: "Prof. Chidinma Nwosu",
    initials: "PC",
    color: "bg-blue-600",
    subject: "CSC 305: Lab Session Rescheduled",
    preview: "Dear students, Due to unforeseen circumstances, tomorrow's lab session has been...",
    time: "2 days ago",
    unread: false,
    hasAttachment: false,
    isStarred: false
  },
  {
    id: 6,
    sender: "IT Support",
    initials: "IS",
    color: "bg-purple-600",
    subject: "Campus Network Maintenance Notice",
    preview: "Please be informed that there will be scheduled network maintenance this weekend...",
    time: "3 days ago",
    unread: false,
    hasAttachment: false,
    isStarred: true
  }
];

export function EmailIntegration() {
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState("inbox");
  const navigate = useNavigate();

  const folders = [
    { id: 'inbox', label: 'Inbox', icon: Mail, count: 12 },
    { id: 'starred', label: 'Starred', icon: Star, count: 3 },
    { id: 'sent', label: 'Sent', icon: Send, count: 45 },
    { id: 'archive', label: 'Archive', icon: Archive, count: 128 },
    { id: 'trash', label: 'Trash', icon: Trash2, count: 8 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[calc(100vh-100px)] flex flex-col space-y-4"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-white/60 backdrop-blur-xl rounded-[24px] px-6 py-4 border border-white/40 shadow-sm">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Search emails..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200 cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
              DA
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">Daniel Adeyemi</p>
              <p className="text-xs text-slate-500">23CK033455</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Sidebar */}
        <div className="w-64 bg-white/60 backdrop-blur-xl rounded-[24px] p-6 border border-white/40 shadow-sm flex flex-col h-full shrink-0">
          <motion.button 
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-medium shadow-[0_8px_20px_rgb(37,99,235,0.2)] transition-colors mb-8"
          >
            <Plus className="w-5 h-5" />
            Compose
          </motion.button>

          <nav className="flex-1 space-y-2">
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                  activeFolder === folder.id 
                    ? 'bg-blue-50 text-blue-600 font-medium' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <folder.icon className={`w-5 h-5 ${activeFolder === folder.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  {folder.label}
                </div>
                {folder.count > 0 && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    activeFolder === folder.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {folder.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-slate-200 mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500 font-medium">Storage</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-indigo-500 rounded-full w-[45%]"></div>
            </div>
            <p className="text-xs text-slate-400">450 MB of 1 GB used</p>
          </div>
        </div>

        {/* Email List */}
        <div className="w-[420px] bg-white/80 backdrop-blur-xl rounded-[24px] border border-white/40 shadow-sm flex flex-col h-full overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 bg-white/50">
            <h2 className="text-lg font-semibold text-slate-800 capitalize">{activeFolder}</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {MOCK_EMAILS.map((email) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedEmail(email)}
                className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                  selectedEmail?.id === email.id 
                    ? 'border-blue-200 bg-blue-50/50 shadow-sm' 
                    : email.unread 
                      ? 'border-transparent bg-white shadow-sm hover:shadow-md' 
                      : 'border-transparent bg-transparent hover:bg-white/60'
                }`}
              >
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${email.color}`}>
                    {email.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className={`text-sm truncate pr-2 ${email.unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {email.sender}
                      </h4>
                      <span className={`text-xs whitespace-nowrap ${email.unread ? 'font-semibold text-blue-600' : 'text-slate-400'}`}>
                        {email.time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate max-w-[220px] ${email.unread ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                        {email.subject}
                      </p>
                      {email.isStarred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1 leading-relaxed">
                      {email.preview}
                    </p>
                    {email.hasAttachment && (
                      <div className="flex items-center gap-1 mt-2 text-slate-400">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Attachment</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Reading Pane */}
        <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-[24px] border border-white/40 shadow-sm overflow-hidden flex flex-col h-full relative min-w-[400px]">
          {selectedEmail ? (
            <div className="h-full flex flex-col absolute inset-0">
              <div className="p-8 border-b border-slate-100 flex-shrink-0">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">{selectedEmail.subject}</h2>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                      <Star className={`w-5 h-5 ${selectedEmail.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Mail className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-lg shadow-sm ${selectedEmail.color}`}>
                      {selectedEmail.initials}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{selectedEmail.sender}</h4>
                      <p className="text-sm text-slate-500">to me</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    {selectedEmail.time}
                  </span>
                </div>
              </div>
              <div className="p-8 flex-1 overflow-y-auto">
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedEmail.preview}
                  {"\n\n"}
                  Hope this email finds you well. As discussed during our last session, there are a few important points we need to cover before the upcoming deadline. Make sure you review the attached document thoroughly, as it contains the updated guidelines and rubrics for submission.
                  {"\n\n"}
                  If you have any questions or require further clarification, please don't hesitate to reach out to me during my office hours or via a follow-up email.
                  {"\n\n"}
                  Best regards,
                  {"\n"}
                  {selectedEmail.sender}
                </p>
                
                {selectedEmail.hasAttachment && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h5 className="text-sm font-semibold text-slate-800 mb-3">Attachments (1)</h5>
                    <div className="inline-flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors bg-white">
                      <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                        <Paperclip className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">document_final.pdf</p>
                        <p className="text-xs text-slate-400">2.4 MB</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 flex-shrink-0">
                <button className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl shadow-sm hover:bg-slate-50 transition-colors">
                  Reply
                </button>
                <button className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl shadow-sm hover:bg-slate-50 transition-colors">
                  Forward
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 absolute inset-0">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Mail className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Select an email to read</h3>
              <p className="text-slate-400 max-w-sm">Choose an email from your list to view its contents, reply, or manage attachments.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}