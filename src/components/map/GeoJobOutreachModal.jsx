import { useState, useCallback } from 'react';
import { X, Mail, Send, Sparkles, Loader2, CheckCircle, Settings } from 'lucide-react';
import { api } from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { cn } from '@utils/helpers';

export default function GeoJobOutreachModal({ job, jobDocId, onClose }) {
  const toast = useToast();

  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [recruiterName,  setRecruiterName]  = useState('');
  const [preview,        setPreview]        = useState(null);   // { subject, body, emailId }
  const [generating,     setGenerating]     = useState(false);
  const [sending,        setSending]        = useState(false);
  const [sent,           setSent]           = useState(false);
  const [smtpMissing,    setSmtpMissing]    = useState(false);

  const generateEmail = useCallback(async () => {
    if (!job) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/outreach/generate', {
        company:       job.company,
        jobTitle:      job.title,
        recruiterName: recruiterName.trim() || undefined,
        jobUrl:        job.applyUrl || undefined,
        jobId:         jobDocId || undefined,
      });
      setPreview({ subject: data.data.subject, body: data.data.body, emailId: data.data.emailId });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate email');
    } finally {
      setGenerating(false);
    }
  }, [job, jobDocId, recruiterName, toast]);

  const sendEmail = useCallback(async () => {
    if (!preview || !recruiterEmail.trim()) {
      toast.error('Enter the recruiter email and generate the email first');
      return;
    }
    setSending(true);
    try {
      await api.post('/outreach/send', {
        to:            recruiterEmail.trim(),
        subject:       preview.subject,
        body:          preview.body,
        company:       job.company,
        recruiterName: recruiterName.trim() || undefined,
        emailId:       preview.emailId,
        jobId:         jobDocId || undefined,
      });
      setSent(true);
      toast.success(`Email sent to ${recruiterEmail.trim()}`);
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'SMTP_NOT_CONFIGURED' || err.response?.data?.message?.includes('credentials')) {
        setSmtpMissing(true);
      }
      toast.error(err.response?.data?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }, [preview, recruiterEmail, recruiterName, job, jobDocId, toast]);

  if (!job) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              Send Outreach Email
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-medium text-gray-700">{job.title}</span>
              {' · '}
              <span className="text-blue-600 font-medium">{job.company}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* SMTP warning */}
          {smtpMissing && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
              <Mail className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800">Email not configured</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Connect your Gmail in <strong>Profile → Email Setup</strong> to send emails.
                </p>
              </div>
              <a
                href="/profile?tab=smtp"
                className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0"
              >
                <Settings className="w-3 h-3" /> Setup
              </a>
            </div>
          )}

          {/* Sent success */}
          {sent && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Email sent!</p>
                <p className="text-xs text-green-700">Your outreach email has been delivered to {recruiterEmail}</p>
              </div>
            </div>
          )}

          {/* Recruiter details */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Recruiter Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={recruiterEmail}
                onChange={e => setRecruiterEmail(e.target.value)}
                placeholder="hr@company.com"
                className="input text-sm"
                disabled={sent}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Recruiter Name <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={recruiterName}
                onChange={e => setRecruiterName(e.target.value)}
                placeholder="e.g. Sarah Johnson"
                className="input text-sm"
                disabled={sent}
              />
            </div>
          </div>

          {/* Generate button */}
          {!preview && !sent && (
            <button
              onClick={generateEmail}
              disabled={generating}
              className="w-full btn btn-secondary gap-2"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating AI email...</>
                : <><Sparkles className="w-4 h-4" /> Generate AI Email</>
              }
            </button>
          )}

          {/* Email preview (editable) */}
          {preview && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Email Preview</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">AI Generated</span>
                <button
                  onClick={generateEmail}
                  disabled={generating || sent}
                  className="ml-auto text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1"
                >
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Regenerate
                </button>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <span className="text-xs text-gray-400">Subject</span>
                  <input
                    value={preview.subject}
                    onChange={e => setPreview(p => ({ ...p, subject: e.target.value }))}
                    className="input text-sm py-1 mt-1"
                    disabled={sent}
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-400">Body</span>
                  <textarea
                    value={preview.body}
                    onChange={e => setPreview(p => ({ ...p, body: e.target.value }))}
                    rows={6}
                    className="input text-sm mt-1 resize-none"
                    disabled={sent}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
          >
            {sent ? 'Close' : 'Cancel'}
          </button>
          {!sent && (
            <button
              onClick={sendEmail}
              disabled={sending || !preview || !recruiterEmail.trim()}
              className={cn(
                'btn btn-primary btn-sm ml-auto gap-2',
                (!preview || !recruiterEmail.trim()) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {sending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                : <><Send className="w-4 h-4" /> Send Email</>
              }
            </button>
          )}
          {sent && (
            <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Delivered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
