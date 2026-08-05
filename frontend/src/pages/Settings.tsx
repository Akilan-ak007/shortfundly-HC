import React, { useEffect, useState } from 'react';
import { 
  Key, 
  Lock, 
  Loader2, 
  Info,
  Server,
  Building
} from 'lucide-react';
import { request } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface MailSettings {
  provider: 'SMTP' | 'GMAIL' | 'SENDGRID' | 'SES' | 'MAILGUN';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  defaultFrom: string;
  apiKeys?: {
    sendGridKey?: string;
    mailgunUser?: string;
    mailgunPassword?: string;
    sesUser?: string;
    sesPassword?: string;
    region?: string;
    geminiApiKey?: string;
  };
}

export const Settings: React.FC = () => {
  const { addToast } = useToast();
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'ADMIN';

  const [settings, setSettings] = useState<MailSettings>({
    provider: 'SMTP',
    defaultFrom: 'no-reply@company.com',
    apiKeys: {},
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Company state
  const [companyName, setCompanyName] = useState('');
  const [isCompanySaving, setIsCompanySaving] = useState(false);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Load Settings
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const [res, companyRes] = await Promise.all([
        request('/settings'),
        request('/settings/company').catch(() => ({ name: '' })),
      ]);
      setSettings({
        provider: res.provider,
        smtpHost: res.smtpHost || '',
        smtpPort: res.smtpPort || 587,
        smtpUser: res.smtpUser || '',
        defaultFrom: res.defaultFrom,
        apiKeys: res.apiKeys || {},
      });
      setCompanyName(companyRes.name || '');
    } catch (err: any) {
      addToast('Failed to load settings.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    try {
      await request('/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      addToast('Email credentials saved successfully.', 'success');
      loadSettings();
    } catch (err: any) {
      addToast(err.message || 'Failed to save credentials.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Company Profile
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!companyName.trim()) {
      addToast('Company name is required.', 'error');
      return;
    }

    setIsCompanySaving(true);
    try {
      await request('/settings/company', {
        method: 'PUT',
        body: JSON.stringify({ name: companyName }),
      });
      addToast('Company profile updated successfully.', 'success');
      window.location.reload();
    } catch (err: any) {
      addToast(err.message || 'Failed to update company profile.', 'error');
    } finally {
      setIsCompanySaving(false);
    }
  };

  // Test SMTP connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await request('/settings/test', {
        method: 'POST',
      });
      addToast(res.message, 'success');
    } catch (err: any) {
      addToast(err.message || 'SMTP Connection test failed.', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  // Change Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast('New passwords do not match.', 'warning');
      return;
    }

    setIsPasswordLoading(true);
    try {
      await request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      addToast('Password updated successfully.', 'success');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      addToast(err.message || 'Password update failed.', 'error');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary-500" />
        Configuring system controls...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">System Settings</h2>
        <p className="text-sm text-slate-500 dark:text-dark-400">Configure email delivery adapters, API keys, and update passwords.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side menu tags info */}
        <div className="md:col-span-1 glass border p-5 rounded-2xl h-fit space-y-4 text-xs font-semibold text-slate-500">
          <div className="flex gap-2.5 items-center text-slate-700 dark:text-dark-200">
            <Server className="h-4.5 w-4.5 text-primary-500" />
            <span>Server Connections</span>
          </div>
          <div className="flex gap-2.5 items-center text-slate-700 dark:text-dark-200">
            <Building className="h-4.5 w-4.5 text-primary-500" />
            <span>Company Profile</span>
          </div>
          <div className="flex gap-2.5 items-center text-slate-700 dark:text-dark-200">
            <Lock className="h-4.5 w-4.5 text-primary-500" />
            <span>Profile Security</span>
          </div>

          <div className="bg-slate-100/60 dark:bg-dark-850/60 p-3 rounded-xl leading-relaxed text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-slate-500 mb-1" />
            Provider changes update background dispatch connections. Test connections prior to executing automated campaigns.
          </div>
        </div>

        {/* Right Side Settings detail forms */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Email Settings card */}
          <div className="glass border p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base">Mail Dispatcher Configurations</h3>
              {isAdmin && settings.provider === 'SMTP' && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-500/10"
                >
                  {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Test Connection'}
                </button>
              )}
            </div>

            {!isAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs text-amber-500">
                You are currently logged in as HR Staff. SMTP server credentials modifications are restricted to Admin roles.
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500" htmlFor="settings-provider">Active Provider</label>
                  <select
                    id="settings-provider"
                    className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3 focus:outline-none cursor-pointer"
                    disabled={!isAdmin}
                    value={settings.provider}
                    onChange={(e) => setSettings({ ...settings, provider: e.target.value as any })}
                  >
                    <option value="SMTP">Standard SMTP Relay</option>
                    <option value="GMAIL">Gmail Service</option>
                    <option value="SENDGRID">SendGrid Relay</option>
                    <option value="MAILGUN">Mailgun Server</option>
                    <option value="SES">Amazon SES Endpoint</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500" htmlFor="settings-default-from">Default Sender (From Email)</label>
                  <input
                    id="settings-default-from"
                    type="email"
                    required
                    className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3 focus:outline-none"
                    disabled={!isAdmin}
                    placeholder="hr@acme.com"
                    value={settings.defaultFrom}
                    onChange={(e) => setSettings({ ...settings, defaultFrom: e.target.value })}
                  />
                </div>
              </div>

              {/* Conditional Inputs */}
              {(settings.provider === 'SMTP' || settings.provider === 'GMAIL') && (
                <div className="space-y-4 border-t pt-4 dark:border-dark-800">
                  <div className="grid grid-cols-2 gap-4">
                    {settings.provider === 'SMTP' && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500" htmlFor="settings-smtp-host">SMTP Server Host</label>
                        <input
                          id="settings-smtp-host"
                          type="text"
                          required
                          className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                          disabled={!isAdmin}
                          placeholder="smtp.mailtrap.io"
                          value={settings.smtpHost || ''}
                          onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                        />
                      </div>
                    )}

                    {settings.provider === 'SMTP' && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500" htmlFor="settings-smtp-port">Port Number</label>
                        <input
                          id="settings-smtp-port"
                          type="number"
                          required
                          className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                          disabled={!isAdmin}
                          placeholder="2525"
                          value={settings.smtpPort || ''}
                          onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value ? parseInt(e.target.value) : undefined })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500" htmlFor="settings-smtp-user">SMTP Username / Email</label>
                      <input
                        id="settings-smtp-user"
                        type="text"
                        className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                        disabled={!isAdmin}
                        placeholder="hr-user"
                        value={settings.smtpUser || ''}
                        onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500" htmlFor="settings-smtp-pass">SMTP Password (Leave blank to keep current)</label>
                      <input
                        id="settings-smtp-pass"
                        type="password"
                        className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                        disabled={!isAdmin}
                        placeholder="••••••••"
                        value={settings.smtpPass || ''}
                        onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {settings.provider === 'SENDGRID' && (
                <div className="space-y-1 border-t pt-4 dark:border-dark-800">
                  <label className="text-[10px] text-slate-500" htmlFor="settings-sendgrid-key">SendGrid API Key</label>
                  <input
                    id="settings-sendgrid-key"
                    type="password"
                    required
                    className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                    disabled={!isAdmin}
                    placeholder="SG.xxxxxxxxxxxxxx"
                    value={settings.apiKeys?.sendGridKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      apiKeys: { ...settings.apiKeys, sendGridKey: e.target.value }
                    })}
                  />
                </div>
              )}

              {settings.provider === 'MAILGUN' && (
                <div className="grid grid-cols-2 gap-4 border-t pt-4 dark:border-dark-800">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500" htmlFor="settings-mailgun-user">Mailgun Username</label>
                    <input
                      id="settings-mailgun-user"
                      type="text"
                      required
                      className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                      disabled={!isAdmin}
                      placeholder="postmaster@yourdomain.com"
                      value={settings.apiKeys?.mailgunUser || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        apiKeys: { ...settings.apiKeys, mailgunUser: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500" htmlFor="settings-mailgun-pass">Mailgun Password</label>
                    <input
                      id="settings-mailgun-pass"
                      type="password"
                      required
                      className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                      disabled={!isAdmin}
                      placeholder="••••••••"
                      value={settings.apiKeys?.mailgunPassword || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        apiKeys: { ...settings.apiKeys, mailgunPassword: e.target.value }
                      })}
                    />
                  </div>
                </div>
              )}

              {settings.provider === 'SES' && (
                <div className="space-y-4 border-t pt-4 dark:border-dark-800">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] text-slate-500" htmlFor="settings-ses-user">AWS Access Key ID / User</label>
                      <input
                        id="settings-ses-user"
                        type="text"
                        required
                        className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                        disabled={!isAdmin}
                        value={settings.apiKeys?.sesUser || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          apiKeys: { ...settings.apiKeys, sesUser: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500" htmlFor="settings-ses-region">AWS Region</label>
                      <input
                        id="settings-ses-region"
                        type="text"
                        required
                        className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                        disabled={!isAdmin}
                        placeholder="us-east-1"
                        value={settings.apiKeys?.region || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          apiKeys: { ...settings.apiKeys, region: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500" htmlFor="settings-ses-pass">AWS Secret Password / Key</label>
                    <input
                      id="settings-ses-pass"
                      type="password"
                      required
                      className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                      disabled={!isAdmin}
                      value={settings.apiKeys?.sesPassword || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        apiKeys: { ...settings.apiKeys, sesPassword: e.target.value }
                      })}
                    />
                  </div>
                </div>
              )}

              {/* Gemini API Key input for AI assistance features */}
              <div className="space-y-1 border-t pt-4 dark:border-dark-800">
                <label className="text-[10px] text-slate-500 flex items-center gap-1">
                  Gemini API Key (Optional - for advanced generative AI email campaigns)
                </label>
                <input
                  type="password"
                  className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                  disabled={!isAdmin}
                  placeholder="AI Key (Gemini API Key)"
                  value={settings.apiKeys?.geminiApiKey || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    apiKeys: { ...settings.apiKeys, geminiApiKey: e.target.value }
                  })}
                />
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-4 border-t dark:border-dark-800">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 font-bold text-white px-5 py-2.5 rounded-xl transition-all shadow-md shadow-primary-500/10"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Configurations
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Company Profile Settings card */}
          <div className="glass border p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Building className="h-4.5 w-4.5 text-primary-500" />
              Company Organization Details
            </h3>
            <p className="text-xs text-slate-400">Specify your company profile name. This name is dynamically injected into your certificate boundaries and letters.</p>
            
            <form onSubmit={handleSaveCompany} className="space-y-4 text-xs font-medium">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500" htmlFor="company-name-input">Registered Company Name</label>
                <input
                  id="company-name-input"
                  type="text"
                  required
                  disabled={!isAdmin}
                  className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3 disabled:opacity-60"
                  placeholder="e.g. Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isCompanySaving || !companyName.trim()}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-dark-850 dark:hover:bg-dark-700 text-white font-bold px-4 py-2.5 rounded-xl border transition-all"
                  >
                    {isCompanySaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Company Name
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Profile change password card */}
          <div className="glass border p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Key className="h-4.5 w-4.5 text-primary-500" />
              Update Account Password
            </h3>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs font-medium">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500" htmlFor="password-old">Current Password</label>
                <input
                  id="password-old"
                  type="password"
                  required
                  className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                  placeholder="••••••••"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500" htmlFor="password-new">New Password</label>
                  <input
                    id="password-new"
                    type="password"
                    required
                    className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                    placeholder="••••••••"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500" htmlFor="password-confirm">Confirm New Password</label>
                  <input
                    id="password-confirm"
                    type="password"
                    required
                    className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2 px-3"
                    placeholder="••••••••"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPasswordLoading || !passwordForm.oldPassword || !passwordForm.newPassword}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-dark-850 dark:hover:bg-dark-700 text-white font-bold px-4 py-2.5 rounded-xl border transition-all"
                >
                  {isPasswordLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
