import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloudUpload, File, CheckCircle, Clock, CircleAlert, Trash2, Calendar, FileText } from 'lucide-react';

type TimetableType = 'School Timetable' | 'Exam Timetable' | 'Mid-Semester Timetable';
type Status = 'Draft' | 'Final';

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: TimetableType;
  status: Status;
  date: string;
}

export function TimetableUpload() {
  const [activeTab, setActiveTab] = useState<TimetableType>('School Timetable');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Status>('Draft');
  
  // Handlers for drag-and-drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => setIsDragging(false);
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };
  
  const handleFiles = (newFiles: File[]) => {
    const newUploads: UploadedFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: activeTab,
      status: uploadStatus,
      date: new Date().toLocaleDateString()
    }));
    
    setFiles(prev => [...newUploads, ...prev]);
  };
  
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };
  
  const toggleStatus = (id: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, status: f.status === 'Draft' ? 'Final' : 'Draft' };
      }
      return f;
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            Timetable Management
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Upload and manage the entire school's academic schedules, including mid-semester and final exams.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl overflow-hidden">
          
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-200">
            {(['School Timetable', 'Exam Timetable', 'Mid-Semester Timetable'] as TimetableType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-4 px-6 text-sm font-bold whitespace-nowrap transition-colors relative
                  ${activeTab === tab ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                `}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* Upload Area */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">Upload {activeTab}</h2>
                <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setUploadStatus('Draft')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${
                      uploadStatus === 'Draft' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Save as Draft
                  </button>
                  <button 
                    onClick={() => setUploadStatus('Final')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${
                      uploadStatus === 'Final' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Publish Final
                  </button>
                </div>
              </div>

              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-200 relative
                  ${isDragging 
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50'
                  }
                `}
              >
                <input 
                  type="file" 
                  multiple 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileInput}
                  accept=".pdf,.csv,.xlsx,.xls"
                />
                
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 pointer-events-none">
                  <CloudUpload className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 pointer-events-none">
                  Drag & Drop files here
                </h3>
                <p className="text-slate-500 font-medium text-sm max-w-sm mx-auto pointer-events-none">
                  Support for PDF, CSV, and Excel formats. Files will be uploaded as <strong className={uploadStatus === 'Draft' ? 'text-amber-600' : 'text-emerald-600'}>{uploadStatus}</strong>.
                </p>
                <button className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors pointer-events-none">
                  Browse Files
                </button>
              </div>
            </div>

            {/* Recent Uploads List */}
            {files.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Recent Uploads</h3>
                <AnimatePresence>
                  {files.map(file => (
                    <motion.div 
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 flex items-center gap-2">
                            {file.name}
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                              {file.type}
                            </span>
                          </p>
                          <p className="text-sm font-medium text-slate-500 mt-0.5 flex items-center gap-3">
                            <span>{file.size}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                            <span>Uploaded {file.date}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 ml-16 sm:ml-0">
                        {/* Status Toggle */}
                        <button 
                          onClick={() => toggleStatus(file.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                            file.status === 'Draft' 
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {file.status === 'Draft' ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          {file.status}
                        </button>

                        <button 
                          onClick={() => removeFile(file.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete File"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            
            {files.length === 0 && (
              <div className="text-center py-8">
                <CircleAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No schedules uploaded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
