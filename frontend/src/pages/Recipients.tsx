import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Filter, 
  UploadCloud, 
  UserPlus, 
  Trash2, 
  RotateCw, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip
} from 'lucide-react';
import { request } from '../utils/api';
import { useToast } from '../context/ToastContext';

interface Recipient {
  id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  joiningDate: string;
  documentType: string;
  attachmentFileName: string | null;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'BOUNCED';
  errorMsg: string | null;
  retryCount: number;
}

interface ValidationError {
  row: number;
  name?: string;
  email?: string;
  field: string;
  error: string;
  value: any;
}

export const Recipients: React.FC = () => {
  const { addToast } = useToast();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & Search States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [docFilter, setDocFilter] = useState('');

  // Selected checkboxes
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Manual Add Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    position: '',
    department: '',
    joiningDate: '',
    documentType: 'OFFER_LETTER',
    attachmentFileName: '',
  });

  // Validation Error Modal States
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Load Table Data
  const loadRecipients = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '8',
        search,
        status,
        department: deptFilter,
        documentType: docFilter,
      });

      const res = await request(`/recipients?${queryParams.toString()}`);
      setRecipients(res.recipients);
      setTotalPages(res.pagination.pages);
      setDepartments(res.departments);
    } catch (err: any) {
      addToast(err.message || 'Failed to fetch recipients.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecipients();
  }, [page, search, status, deptFilter, docFilter]);

  // Handle Search Input Change (Debounced or Reset Page)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // Checkbox functions
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === recipients.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(recipients.map(r => r.id));
    }
  };

  // Manual Add submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await request('/recipients', {
        method: 'POST',
        body: JSON.stringify(manualForm),
      });

      addToast(res.message || 'Recipient(s) added successfully.', 'success');
      setIsAddOpen(false);
      setManualForm({
        name: '',
        email: '',
        position: '',
        department: '',
        joiningDate: '',
        documentType: 'OFFER_LETTER',
        attachmentFileName: '',
      });
      loadRecipients();
    } catch (err: any) {
      addToast(err.message || 'Failed to create recipient.', 'error');
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action: 'delete' | 'retry') => {
    if (selectedIds.length === 0) return;
    
    if (action === 'delete' && !confirm(`Are you sure you want to delete ${selectedIds.length} recipients?`)) {
      return;
    }

    try {
      const res = await request('/recipients/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds, action }),
      });

      addToast(res.message, 'success');
      setSelectedIds([]);
      loadRecipients();
    } catch (err: any) {
      addToast(err.message || 'Bulk operation failed.', 'error');
    }
  };

  // Clear All Recipients
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all recipients from the database? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      const res = await request('/recipients/clear', {
        method: 'DELETE',
      });
      addToast(res.message || 'All recipients cleared successfully.', 'success');
      setSelectedIds([]);
      setPage(1);
      loadRecipients();
    } catch (err: any) {
      addToast(err.message || 'Failed to clear recipients.', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // Spreadsheet Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (res.status === 422) {
        setValidationErrors(data.errors);
        setIsErrorModalOpen(true);
        addToast('File failed recipient structural validations.', 'warning');
      } else if (!res.ok) {
        addToast(data.error || 'Upload failed.', 'error');
      } else {
        addToast(data.message, 'success');
        setPage(1);
        loadRecipients();
      }
    } catch (err: any) {
      addToast(err.message || 'File upload error.', 'error');
    } finally {
      setIsUploading(false);
      // Reset input value to allow uploading same file again
      e.target.value = '';
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case 'SENT': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'FAILED': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'BOUNCED': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
      case 'SENDING': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Recipient Database</h2>
          <p className="text-sm text-slate-500 dark:text-dark-400">Import spreadsheets and manage individual delivery logs.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* File input wrapper */}
          <label className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 font-semibold text-white text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-primary-500/10">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload CSV/Excel
            <input
              type="file"
              accept=".csv, .xlsx"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>

          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-dark-800 dark:hover:bg-dark-700 font-semibold text-white text-xs rounded-xl transition-all border border-slate-700 dark:border-dark-700 shadow-md shadow-slate-900/10"
          >
            <UserPlus className="h-4 w-4" />
            Add Recipient
          </button>

          <button
            onClick={handleClearAll}
            disabled={isClearing || recipients.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-dark-800 dark:disabled:text-dark-500 disabled:cursor-not-allowed font-semibold text-white text-xs rounded-xl transition-all shadow-md shadow-rose-500/10 disabled:shadow-none"
          >
            {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear All
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl border flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            className="w-full bg-slate-100 dark:bg-dark-800/60 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Search by name, email, or title..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>

        {/* Filters Grid */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-800/60 px-3 py-2 rounded-xl border text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              className="bg-transparent focus:outline-none cursor-pointer"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="SENDING">Sending</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="BOUNCED">Bounced</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-800/60 px-3 py-2 rounded-xl border text-xs">
            <select
              className="bg-transparent focus:outline-none cursor-pointer"
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Document Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-800/60 px-3 py-2 rounded-xl border text-xs">
            <select
              className="bg-transparent focus:outline-none cursor-pointer"
              value={docFilter}
              onChange={(e) => { setDocFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Doc Types</option>
              <option value="OFFER_LETTER">Offer Letter</option>
              <option value="CERTIFICATE">Certificate</option>
              <option value="APPOINTMENT_LETTER">Appointment Letter</option>
              <option value="INTERNSHIP_LETTER">Internship Letter</option>
              <option value="RELIEVING_LETTER">Relieving Letter</option>
              <option value="EXPERIENCE_LETTER">Experience Letter</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk actions status panel */}
      {selectedIds.length > 0 && (
        <div className="bg-primary-500/10 border border-primary-500/20 px-5 py-3 rounded-xl flex items-center justify-between text-xs animate-slide-in">
          <span className="font-semibold text-primary-600 dark:text-primary-400">
            {selectedIds.length} row(s) selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('retry')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Re-queue / Retry
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-650 hover:bg-red-750 text-white rounded-lg font-semibold transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Records
            </button>
          </div>
        </div>
      )}

      {/* Main Table view */}
      <div className="glass border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 dark:bg-dark-800/40 border-b border-slate-200 dark:border-dark-800 text-slate-500 dark:text-dark-400 uppercase tracking-wider font-semibold">
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={recipients.length > 0 && selectedIds.length === recipients.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="p-4">Employee Details</th>
                <th className="p-4">Department & Position</th>
                <th className="p-4">Document Details</th>
                <th className="p-4 w-40">Delivery Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary-500" />
                    Fetching database records...
                  </td>
                </tr>
              ) : recipients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 font-medium">
                    No recipients matched your current filters.
                  </td>
                </tr>
              ) : (
                recipients.map((recipient) => (
                  <tr 
                    key={recipient.id} 
                    className="border-b border-slate-200 dark:border-dark-850 hover:bg-slate-100/30 dark:hover:bg-dark-800/10 transition-colors"
                  >
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(recipient.id)}
                        onChange={() => handleSelectRow(recipient.id)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-dark-100">{recipient.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{recipient.email}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-700 dark:text-dark-200">{recipient.position}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{recipient.department}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-700 dark:text-dark-200">{recipient.documentType.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Paperclip className="h-3 w-3 shrink-0" />
                        {recipient.attachmentFileName || 'Auto-generated filename'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-[10px] font-semibold border rounded-full ${getStatusBadgeClass(recipient.status)}`}>
                          {recipient.status}
                        </span>
                        
                        {/* Display Error Message tooltip if failed */}
                        {recipient.errorMsg && (
                          <div className="group relative">
                            <AlertTriangle className="h-4 w-4 text-red-400 cursor-pointer" />
                            <div className="absolute right-0 bottom-6 z-20 w-56 p-2 bg-slate-900 text-[10px] text-slate-200 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-800">
                              {recipient.errorMsg} (Attempts: {recipient.retryCount}/3)
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Joined: {new Date(recipient.joiningDate).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t dark:border-dark-800 flex justify-between items-center text-xs">
          <span className="text-slate-400">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="p-1.5 border rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 border rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Manual Recipient Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg p-6 bg-slate-50 dark:bg-dark-900 border dark:border-dark-800 rounded-3xl shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div>
              <h3 className="text-lg font-bold">Add Recipient</h3>
              <p className="text-xs text-slate-400">Append a single employee to the queue</p>
            </div>

            <form onSubmit={handleAddSubmit} className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="manual-name">Full Name</label>
                <input
                  id="manual-name"
                  type="text"
                  required
                  placeholder="John Doe"
                  className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2 px-3.5 text-xs"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({...manualForm, name: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="manual-email">Email Address(es)</label>
                <input
                  id="manual-email"
                  type="text"
                  required
                  placeholder="john@company.com, sarah@company.com"
                  className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2 px-3.5 text-xs"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({...manualForm, email: e.target.value})}
                />
                <p className="text-[9px] text-slate-400">Separate multiple emails with commas.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="manual-position">Position / Job Title</label>
                <input
                  id="manual-position"
                  type="text"
                  required
                  placeholder="Software Engineer"
                  className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2 px-3.5 text-xs"
                  value={manualForm.position}
                  onChange={(e) => setManualForm({...manualForm, position: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="manual-dept">Department</label>
                <input
                  id="manual-dept"
                  type="text"
                  required
                  placeholder="Engineering"
                  className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2 px-3.5 text-xs"
                  value={manualForm.department}
                  onChange={(e) => setManualForm({...manualForm, department: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="manual-joining">Joining Date</label>
                <input
                  id="manual-joining"
                  type="date"
                  required
                  className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2 px-3.5 text-xs"
                  value={manualForm.joiningDate}
                  onChange={(e) => setManualForm({...manualForm, joiningDate: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="manual-doc">Document Type</label>
                <select
                  id="manual-doc"
                  className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2.5 px-3.5 text-xs cursor-pointer"
                  value={manualForm.documentType}
                  onChange={(e) => setManualForm({...manualForm, documentType: e.target.value})}
                >
                  <option value="OFFER_LETTER">Offer Letter</option>
                  <option value="CERTIFICATE">Certificate</option>
                  <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                  <option value="INTERNSHIP_LETTER">Internship Letter</option>
                  <option value="RELIEVING_LETTER">Relieving Letter</option>
                  <option value="EXPERIENCE_LETTER">Experience Letter</option>
                </select>
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-slate-500" htmlFor="manual-attachment">Custom Attachment File Name (Optional)</label>
                <input
                  id="manual-attachment"
                  type="text"
                  placeholder="Offer_Letter_John.pdf"
                  className="w-full bg-white dark:bg-dark-950 border dark:border-dark-800 rounded-xl py-2 px-3.5 text-xs"
                  value={manualForm.attachmentFileName}
                  onChange={(e) => setManualForm({...manualForm, attachmentFileName: e.target.value})}
                />
              </div>

              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-dark-800 dark:hover:bg-dark-700 text-xs rounded-xl font-semibold border text-slate-600 dark:text-dark-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/15"
                >
                  Create Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Validation Error modal (Show list of errors before database load) */}
      {isErrorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl p-6 bg-slate-50 dark:bg-dark-900 border dark:border-dark-800 rounded-3xl shadow-2xl flex flex-col gap-4 animate-scale-up max-h-[85vh]">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-500 shrink-0" />
                <div>
                  <h3 className="text-lg font-bold">Spreadsheet Validation Failure</h3>
                  <p className="text-xs text-slate-400">We scanned {validationErrors.length} validation anomalies. Rectify your sheet columns and try again.</p>
                </div>
              </div>
              <button
                onClick={() => setIsErrorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {/* Error table list */}
            <div className="overflow-y-auto border rounded-xl flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-150/80 dark:bg-dark-800/60 border-b font-semibold text-slate-500 dark:text-dark-400">
                    <th className="p-3 w-16 text-center">Row</th>
                    <th className="p-3 w-40">Candidate</th>
                    <th className="p-3 w-32">Faulty Field</th>
                    <th className="p-3">Error Explanation</th>
                    <th className="p-3 w-32">Original Value</th>
                  </tr>
                </thead>
                <tbody>
                  {validationErrors.map((err, index) => (
                    <tr key={index} className="border-b dark:border-dark-800 hover:bg-slate-100/30">
                      <td className="p-3 text-center font-bold text-red-500">{err.row}</td>
                      <td className="p-3 font-semibold">{err.name || err.email || 'N/A'}</td>
                      <td className="p-3 text-amber-500 font-semibold">{err.field}</td>
                      <td className="p-3 text-slate-600 dark:text-dark-300 font-medium">{err.error}</td>
                      <td className="p-3"><code className="bg-slate-200 dark:bg-dark-950 px-2 py-0.5 rounded text-[10px] break-all">{String(err.value || 'None')}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
