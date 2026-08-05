import React, { useEffect, useState, useRef } from 'react';
import { 
  FileText, 
  Mail, 
  Plus, 
  Trash2, 
  Sparkles, 
  Save, 
  Info,
  ChevronRight,
  Loader2,
  UploadCloud
} from 'lucide-react';
import { request } from '../utils/api';
import { useToast } from '../context/ToastContext';

interface DocTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
  designMetadata: any;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  signature: string | null;
}

export const Templates: React.FC = () => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'docs' | 'emails'>('docs');
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Edit selection
  const [selectedDoc, setSelectedDoc] = useState<DocTemplate | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailTemplate | null>(null);

  // AI Modal States
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRole, setAiRole] = useState('Software Engineer');
  const [aiCompany, setAiCompany] = useState('Acme Corp');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  // Ref to track body inputs for cursor variable insertion
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const docContentRef = useRef<HTMLTextAreaElement>(null);

  // Load Data
  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const [docs, emails] = await Promise.all([
        request('/templates/doc'),
        request('/templates/email'),
      ]);
      setDocTemplates(docs);
      setEmailTemplates(emails);
      
      if (docs.length > 0) setSelectedDoc(docs[0]);
      if (emails.length > 0) setSelectedEmail(emails[0]);
    } catch (err: any) {
      addToast('Failed to fetch templates.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Insert Variable helper
  const insertVariable = (ref: React.RefObject<HTMLTextAreaElement | null>, variable: string) => {
    const textarea = ref.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const updatedText = `${before}{{${variable}}}${after}`;
    
    if (activeTab === 'docs' && selectedDoc) {
      setSelectedDoc({ ...selectedDoc, content: updatedText });
    } else if (activeTab === 'emails' && selectedEmail) {
      setSelectedEmail({ ...selectedEmail, body: updatedText });
    }

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
    }, 50);
  };

  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDoc) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast('File size exceeds the 10MB limit.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingBg(true);
    try {
      const response = await fetch('/api/templates/upload-bg', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed.');
      }

      const res = await response.json();
      
      const currentMetadata = selectedDoc.designMetadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        backgroundImageUrl: res.fileUrl,
        backgroundPdfUrl: file.name.toLowerCase().endsWith('.pdf') ? res.fileUrl : undefined,
        backgroundPdfPath: file.name.toLowerCase().endsWith('.pdf') ? res.filePath : undefined,
      };

      setSelectedDoc({
        ...selectedDoc,
        designMetadata: updatedMetadata,
      });

      addToast('Background template uploaded. Click Save Changes to save.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to upload background template.', 'error');
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleRemoveBackground = () => {
    if (!selectedDoc) return;
    setSelectedDoc({
      ...selectedDoc,
      designMetadata: {},
    });
    addToast('Background template removed. Click Save Changes to save.', 'info');
  };

  // Save Document Template
  const handleSaveDoc = async () => {
    if (!selectedDoc) return;
    try {
      const isNew = !selectedDoc.id.includes('-'); // Simple check if temporary ID
      const method = isNew ? 'POST' : 'PUT';
      const path = isNew ? '/templates/doc' : `/templates/doc/${selectedDoc.id}`;

      await request(path, {
        method,
        body: JSON.stringify({
          name: selectedDoc.name,
          type: selectedDoc.type,
          content: selectedDoc.content,
          designMetadata: selectedDoc.designMetadata || {},
        }),
      });

      addToast('Document template saved successfully.', 'success');
      loadTemplates();
    } catch (err: any) {
      addToast(err.message || 'Failed to save template.', 'error');
    }
  };

  // Save Email Template
  const handleSaveEmail = async () => {
    if (!selectedEmail) return;
    try {
      const isNew = !selectedEmail.id; // Check if temporary
      const method = isNew ? 'POST' : 'PUT';
      const path = isNew ? '/templates/email' : `/templates/email/${selectedEmail.id}`;

      await request(path, {
        method,
        body: JSON.stringify(selectedEmail),
      });

      addToast('Email template saved successfully.', 'success');
      loadTemplates();
    } catch (err: any) {
      addToast(err.message || 'Failed to save email template.', 'error');
    }
  };

  // Add Temporary layouts
  const handleNewDoc = () => {
    const newTpl: DocTemplate = {
      id: `new-${Date.now()}`,
      name: 'Untitled Document Template',
      type: 'OFFER_LETTER',
      content: 'Write template contents here. Use placeholders: {{Name}}, {{Position}}, {{Department}}, {{JoiningDate}}, {{Company}}.',
      designMetadata: {},
    };
    setSelectedDoc(newTpl);
  };

  const handleNewEmail = () => {
    const newTpl: EmailTemplate = {
      id: '',
      name: 'Untitled Email Template',
      subject: 'Welcome to {{Company}}!',
      body: 'Dear {{Name}},\n\nCongratulations on joining {{Company}} as {{Position}}.',
      signature: 'Warm Regards,\nHR Team\n{{Company}}',
    };
    setSelectedEmail(newTpl);
  };

  // Delete Template actions
  const handleDeleteTemplate = async (id: string, type: 'doc' | 'email') => {
    if (!confirm(`Are you sure you want to delete this template?`)) return;
    try {
      const path = type === 'doc' ? `/templates/doc/${id}` : `/templates/email/${id}`;
      await request(path, { method: 'DELETE' });
      addToast('Template deleted successfully.', 'success');
      loadTemplates();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete template.', 'error');
    }
  };

  // AI Generative Functions
  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsAiGenerating(true);
    try {
      const res = await request('/templates/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          prompt: aiPrompt,
          position: aiRole,
          company: aiCompany,
        }),
      });

      if (selectedEmail) {
        setSelectedEmail({ ...selectedEmail, body: res.body });
      }
      addToast('AI generated welcoming copy successfully.', 'success');
      setIsAiOpen(false);
      setAiPrompt('');
    } catch (err: any) {
      addToast(err.message || 'AI generation failed.', 'error');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAiSuggestSubjects = async () => {
    setIsAiSuggesting(true);
    try {
      const res = await request('/templates/ai/suggest-subject', {
        method: 'POST',
        body: JSON.stringify({
          position: aiRole,
          company: aiCompany,
        }),
      });
      setAiSuggestions(res.suggestions);
    } catch (err: any) {
      addToast('Failed to fetch AI subject suggestions.', 'error');
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const selectSuggestedSubject = (subject: string) => {
    if (selectedEmail) {
      setSelectedEmail({ ...selectedEmail, subject });
      addToast('Subject updated to AI selection.', 'info');
    }
  };

  const docTypes = [
    { label: 'Offer Letter', value: 'OFFER_LETTER' },
    { label: 'Certificate', value: 'CERTIFICATE' },
    { label: 'Appointment Letter', value: 'APPOINTMENT_LETTER' },
    { label: 'Internship Letter', value: 'INTERNSHIP_LETTER' },
    { label: 'Relieving Letter', value: 'RELIEVING_LETTER' },
    { label: 'Experience Letter', value: 'EXPERIENCE_LETTER' },
  ];

  const placeholderVars = ['Name', 'Position', 'Department', 'JoiningDate', 'Company'];

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary-500" />
        Configuring template panels...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Template Workspace</h2>
          <p className="text-sm text-slate-500 dark:text-dark-400">Design dynamic text layouts for PDF compiles and email bodies.</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-200/60 dark:bg-dark-900 p-1 rounded-xl border w-fit text-xs">
          <button
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'docs' ? 'bg-white dark:bg-dark-800 shadow-sm text-primary-500' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <FileText className="h-4 w-4" />
            PDF Documents
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'emails' ? 'bg-white dark:bg-dark-800 shadow-sm text-primary-500' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Mail className="h-4 w-4" />
            Email Layouts
          </button>
        </div>
      </div>

      {/* Main Workspace grid split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column list sidecar */}
        <div className="glass border p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Available Templates</h3>
            <button
              onClick={activeTab === 'docs' ? handleNewDoc : handleNewEmail}
              className="p-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg"
              title="Create new template"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[60vh] pr-1">
            {activeTab === 'docs' ? (
              docTemplates.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No doc templates created yet.</p>
              ) : (
                docTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedDoc(tpl)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${selectedDoc?.id === tpl.id ? 'bg-primary-500/10 border-primary-500 text-primary-600' : 'hover:bg-slate-100 dark:hover:bg-dark-800'}`}
                  >
                    <span className="truncate">{tpl.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id, 'doc'); }}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )
            ) : (
              emailTemplates.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No email templates created yet.</p>
              ) : (
                emailTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedEmail(tpl)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${selectedEmail?.id === tpl.id ? 'bg-primary-500/10 border-primary-500 text-primary-600' : 'hover:bg-slate-100 dark:hover:bg-dark-800'}`}
                  >
                    <span className="truncate">{tpl.name}</span>
                    {tpl.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id, 'email'); }}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </div>

        {/* Right column detailed editor */}
        <div className="md:col-span-2 glass border p-6 rounded-2xl space-y-6">
          {activeTab === 'docs' && selectedDoc ? (
            /* PDF Document Editor Form */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-primary-500" />
                  PDF Canvas Composer
                </h3>
                <button
                  onClick={handleSaveDoc}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-semibold shadow-md shadow-primary-500/15"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500" htmlFor="doc-template-name">Template Name</label>
                  <input
                    id="doc-template-name"
                    type="text"
                    className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3 text-xs"
                    value={selectedDoc.name}
                    onChange={(e) => setSelectedDoc({ ...selectedDoc, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500" htmlFor="doc-template-type">Document Layout Format</label>
                  <select
                    id="doc-template-type"
                    className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3 text-xs cursor-pointer"
                    value={selectedDoc.type}
                    onChange={(e) => setSelectedDoc({ ...selectedDoc, type: e.target.value })}
                  >
                    {docTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Background Upload */}
              <div className="bg-slate-100/60 dark:bg-dark-850/60 p-4 rounded-xl border border-slate-200 dark:border-dark-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company Background Template</span>
                  {selectedDoc.designMetadata?.backgroundImageUrl && (
                    <button
                      onClick={handleRemoveBackground}
                      className="text-[10px] text-red-500 hover:text-red-650 font-semibold transition-colors"
                    >
                      Remove Background
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all border border-slate-700">
                    <UploadCloud className="h-3.5 w-3.5" />
                    {isUploadingBg ? 'Uploading...' : 'Upload PDF/Image'}
                    <input
                      type="file"
                      accept=".pdf, .png, .jpg, .jpeg"
                      className="hidden"
                      onChange={handleBackgroundUpload}
                      disabled={isUploadingBg}
                    />
                  </label>
                  
                  <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                    {selectedDoc.designMetadata?.backgroundImageUrl
                      ? selectedDoc.designMetadata.backgroundImageUrl.split('/').pop()
                      : 'No custom background template uploaded (falls back to default style).'}
                  </span>
                </div>
              </div>

              {/* Variable Injector */}
              <div className="bg-slate-100/60 dark:bg-dark-850/60 p-3 rounded-xl flex flex-wrap gap-2 items-center text-[10px] border border-slate-200 dark:border-dark-800">
                <span className="font-bold text-slate-500">Insert Variable at cursor:</span>
                {placeholderVars.map(v => (
                  <button
                    key={v}
                    onClick={() => insertVariable(docContentRef, v)}
                    className="px-2.5 py-1 bg-white dark:bg-dark-800 hover:bg-primary-500/10 hover:text-primary-500 dark:hover:bg-primary-950/20 border border-slate-350 dark:border-dark-700 rounded-md font-semibold font-mono"
                  >
                    {`{`}{`{`}{v}{`}`}{`}`}
                  </button>
                ))}
              </div>

              {/* Template Editor Box */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="doc-template-content">Document Layout Canvas Text Content</label>
                <textarea
                  id="doc-template-content"
                  ref={docContentRef}
                  className="w-full h-80 bg-slate-100 dark:bg-dark-850 rounded-xl py-3 px-4 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={selectedDoc.content}
                  onChange={(e) => setSelectedDoc({ ...selectedDoc, content: e.target.value })}
                />
              </div>

              <div className="flex gap-2 items-start bg-blue-500/10 border border-blue-500/20 p-3.5 rounded-xl text-xs text-blue-500 dark:text-blue-400">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>The layout composer creates PDF compiles. Offer Letters/Letters render in standard vertical (portrait) with logo head; Certificates render in horizontal landscape with gold/dark nested borders and signatures.</p>
              </div>
            </div>
          ) : activeTab === 'emails' && selectedEmail ? (
            /* Email Template Editor Form */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Mail className="h-4.5 w-4.5 text-primary-500" />
                  Email copywriter
                </h3>
                
                <div className="flex gap-2">
                  {/* AI trigger */}
                  <button
                    onClick={() => {
                      setAiRole(selectedEmail.name.includes('Welcome') ? 'Software Engineer' : 'Team Member');
                      setIsAiOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-purple-500/15"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Writer Helper
                  </button>

                  <button
                    onClick={handleSaveEmail}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-semibold shadow-md shadow-primary-500/15"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="email-template-name">Template Name</label>
                <input
                  id="email-template-name"
                  type="text"
                  className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3 text-xs"
                  placeholder="e.g. Standard Welcoming Campaign"
                  value={selectedEmail.name}
                  onChange={(e) => setSelectedEmail({ ...selectedEmail, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="email-template-subject">Subject Line</label>
                <input
                  id="email-template-subject"
                  type="text"
                  className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3 text-xs"
                  placeholder="Subject line details"
                  value={selectedEmail.subject}
                  onChange={(e) => setSelectedEmail({ ...selectedEmail, subject: e.target.value })}
                />
              </div>

              {/* Variable Injector */}
              <div className="bg-slate-100/60 dark:bg-dark-850/60 p-3 rounded-xl flex flex-wrap gap-2 items-center text-[10px] border border-slate-200 dark:border-dark-800">
                <span className="font-bold text-slate-500">Insert Variable at cursor:</span>
                {placeholderVars.map(v => (
                  <button
                    key={v}
                    onClick={() => insertVariable(bodyRef, v)}
                    className="px-2.5 py-1 bg-white dark:bg-dark-800 hover:bg-primary-500/10 hover:text-primary-500 dark:hover:bg-primary-950/20 border border-slate-350 dark:border-dark-700 rounded-md font-semibold font-mono"
                  >
                    {`{`}{`{`}{v}{`}`}{`}`}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="email-template-body">Email Message Body</label>
                <textarea
                  id="email-template-body"
                  ref={bodyRef}
                  className="w-full h-56 bg-slate-100 dark:bg-dark-850 rounded-xl py-3 px-4 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={selectedEmail.body}
                  onChange={(e) => setSelectedEmail({ ...selectedEmail, body: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="email-template-signature">Default Signature</label>
                <textarea
                  id="email-template-signature"
                  className="w-full h-20 bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3 text-xs leading-normal"
                  placeholder="e.g. Best Regards,\nHR Team"
                  value={selectedEmail.signature || ''}
                  onChange={(e) => setSelectedEmail({ ...selectedEmail, signature: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-20 font-medium">Select a template on the left panel or click plus to compose.</p>
          )}
        </div>
      </div>

      {/* AI helper writer modal */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg p-6 bg-slate-50 dark:bg-dark-900 border dark:border-dark-800 rounded-3xl shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-500 shrink-0" />
              <div>
                <h3 className="text-lg font-bold">AI Copywriter Assistant</h3>
                <p className="text-xs text-slate-400">Generate structured email components</p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500" htmlFor="ai-role">Candidate Position</label>
                  <input
                    id="ai-role"
                    type="text"
                    className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2 px-3"
                    value={aiRole}
                    onChange={(e) => setAiRole(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500" htmlFor="ai-company">Company Context</label>
                  <input
                    id="ai-company"
                    type="text"
                    className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2 px-3"
                    value={aiCompany}
                    onChange={(e) => setAiCompany(e.target.value)}
                  />
                </div>
              </div>

              {/* Subject Suggestion Row */}
              <div className="space-y-2 border-t pt-3 dark:border-dark-800">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">AI Subject line ideas:</span>
                  <button
                    onClick={handleAiSuggestSubjects}
                    disabled={isAiSuggesting}
                    className="text-[10px] font-bold text-primary-500 hover:underline"
                  >
                    {isAiSuggesting ? 'Thinking...' : 'Get Subject Ideas'}
                  </button>
                </div>
                
                {aiSuggestions.length > 0 && (
                  <div className="space-y-1">
                    {aiSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectSuggestedSubject(s)}
                        className="p-2 border dark:border-dark-850 rounded-lg hover:border-primary-500 cursor-pointer flex justify-between items-center text-[11px] font-semibold hover:bg-primary-500/5 transition-colors"
                      >
                        <span className="truncate pr-2">{s}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Body Generation Prompt */}
              <div className="space-y-2 border-t pt-3 dark:border-dark-800">
                <label className="text-[10px] text-slate-500" htmlFor="ai-prompt">Instructions for Email Body (optional style/length)</label>
                <textarea
                  id="ai-prompt"
                  className="w-full h-20 bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl p-3 focus:outline-none"
                  placeholder="e.g. Write a warm welcoming email, mention we will send their onboarding schedule, keep it under 3 paragraphs."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAiOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-dark-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={isAiGenerating || !aiPrompt}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-500/10"
                >
                  {isAiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Write Welcome Body'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
