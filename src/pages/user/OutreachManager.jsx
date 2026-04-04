import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Mail, Send, Loader2, Sparkles, CheckCircle,
  ExternalLink, Linkedin, Copy, Check, Users,
  ChevronDown, ChevronUp, RefreshCw, Lock, Settings,
  Paperclip, FileText, Wand2, Info, Download
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { cn }       from '@utils/helpers';

export default function OutreachManager() {
  const { user }       = useAuth();
  const toast          = useToast();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const searchId       = searchParams.get('searchId');
  // When navigating from a single job's "Send Outreach Email" button,
  // these params narrow the view to just that one company
  const singleCompany  = searchParams.get('company')  || null;
  const singleTo       = searchParams.get('to')       || null;
  const singleTitle    = searchParams.get('jobTitle')  || null;

  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [smtpStatus,    setSmtpStatus]    = useState(null);
  const [selected,      setSelected]      = useState([]);   // selected company names
  const [previews,      setPreviews]      = useState({});   // company -> {subject, body}
  const [generating,    setGenerating]    = useState({});   // company -> bool
  const [sending,       setSending]       = useState({});   // company -> bool
  const [sent,          setSent]          = useState({});   // company -> bool
  const [sendingAll,    setSendingAll]    = useState(false);
  const [findingEmails,   setFindingEmails]   = useState(false);
  const [expandedPrev,    setExpandedPrev]    = useState({});   // company -> bool
  const [copied,          setCopied]          = useState('');
  const [attachResume,    setAttachResume]     = useState(false);
  const [optimizedResumes, setOptimizedResumes] = useState({}); // company -> full result obj
  const [optimizing,      setOptimizing]      = useState({}); // company -> bool
  const [hasResume,       setHasResume]        = useState(false);
  const [showComparison,  setShowComparison]  = useState({}); // company -> bool
  const [resumePasteText, setResumePasteText] = useState({}); // company -> pasted resume text
  const [showPasteBox,    setShowPasteBox]    = useState({}); // company -> bool
  const [jdPasteText,     setJdPasteText]     = useState({}); // company -> full JD pasted by user
  const [showJdPaste,     setShowJdPaste]     = useState({}); // company -> bool

  const isPro = user?.plan === 'pro' || user?.plan === 'team';

  // If searchId is missing or not a valid ObjectId, resolve to the latest search
  const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id || '');

  useEffect(() => {
    if (!searchId || !isValidObjectId(searchId)) {
      // Resolve to latest search ID then re-navigate
      api.get('/search/history?limit=1')
        .then(({ data }) => {
          const id = data.data?.[0]?._id;
          if (id) {
            const params = new URLSearchParams(window.location.search);
            params.set('searchId', id);
            navigate(`/outreach-manager?${params.toString()}`, { replace: true });
          } else {
            navigate('/results');
          }
        })
        .catch(() => navigate('/results'));
      return;
    }
    fetchData();
    checkSMTP();
  }, [searchId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contactsRes, profileRes] = await Promise.all([
        api.get(`/recruiters/by-search/${searchId}`),
        api.get('/profile').catch(() => ({ data: { data: {} } })),
      ]);
      setData(contactsRes.data.data);
      const hasRes = !!profileRes.data.data?.resume?.url;
      setHasResume(hasRes);
      if (hasRes) setAttachResume(true); // auto-enable if resume is uploaded
      const withEmail = contactsRes.data.data.companies
        .filter(c => c.recruiterEmail)
        .map(c => c.company);
      // In single-company mode only select that company; else select all with email
      setSelected(singleCompany ? [singleCompany] : withEmail);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const checkSMTP = async () => {
    try {
      const { data } = await api.get('/profile/smtp/status');
      setSmtpStatus(data.data);
    } catch { setSmtpStatus({ configured: false }); }
  };

  const findMissingEmails = async () => {
    if (!isPro) { toast.error('Pro feature'); return; }
    setFindingEmails(true);
    try {
      const { data } = await api.post('/recruiters/find-all', { searchId });
      toast.success(`Found emails for ${data.data.updated} more companies!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setFindingEmails(false);
    }
  };

  const generateEmail = async (company) => {
    const companyData = data.companies.find(c => c.company === company);
    if (!companyData) return;

    const job = companyData.jobs[0];
    setGenerating(p => ({ ...p, [company]: true }));

    try {
      const { data: res } = await api.post('/outreach/generate', {
        company,
        jobTitle:      job.title,
        recruiterName: companyData.recruiterName,
        jobUrl:        job.url,
      });
      setPreviews(p => ({ ...p, [company]: { subject: res.data.subject, body: res.data.body, emailId: res.data.emailId } }));
      setExpandedPrev(p => ({ ...p, [company]: true }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally {
      setGenerating(p => ({ ...p, [company]: false }));
    }
  };

  const generateAll = async () => {
    const companies = data.companies.filter(c => c.recruiterEmail && selected.includes(c.company));
    for (const c of companies) {
      if (!previews[c.company]) await generateEmail(c.company);
    }
  };

  // ── Optimize resume keywords for a specific company (Pro) ────────
  const optimizeResume = async (company) => {
    const companyData = data.companies.find(c => c.company === company);
    if (!companyData) return;
    const job = companyData.jobs[0];

    // Use pasted JD if available (more complete than stored description)
    const jd = jdPasteText[company]?.trim() || job.description || '';

    setOptimizing(p => ({ ...p, [company]: true }));
    try {
      const { data: res } = await api.post('/outreach/optimize-resume', {
        jobTitle:       job.title,
        jobDescription: jd,
        company,
        resumeText:     resumePasteText[company] || undefined,
      });
      setOptimizedResumes(p => ({ ...p, [company]: res.data }));
      const score = (res.data.atsScoreAfter || 0) - (res.data.atsScoreBefore || 0);
      setShowComparison(p => ({ ...p, [company]: true })); // auto-open comparison
      toast.success(`Resume optimized for ${company}! ATS match +${score}%`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Optimization failed';
      toast.error(msg);
      // Auto-open the paste box so user can provide resume text manually
      setShowPasteBox(p => ({ ...p, [company]: true }));
    } finally {
      setOptimizing(p => ({ ...p, [company]: false }));
    }
  };

  const sendEmail = async (company) => {
    if (!smtpStatus?.configured) {
      toast.error('Configure your email first');
      return;
    }

    const companyData = data.companies.find(c => c.company === company);
    const preview     = previews[company];

    if (!preview) {
      toast.error('Generate email first');
      return;
    }

    setSending(p => ({ ...p, [company]: true }));
    try {
      const optimized = optimizedResumes[company];
      // If ATS-optimized PDF exists, send it; otherwise send original via backend download
      const hasOptimizedBuffer = !!(optimized?.resumeBuffer);
      await api.post('/outreach/send', {
        to:             companyData.recruiterEmail,
        subject:        preview.subject,
        body:           preview.body,
        company,
        recruiterName:  companyData.recruiterName,
        emailId:        preview.emailId,
        jobId:          companyData.jobs[0]?._id,
        attachResume:   !hasOptimizedBuffer && attachResume,  // let backend fetch original
        resumeBuffer:   hasOptimizedBuffer ? optimized.resumeBuffer : undefined,
        resumeFilename: hasOptimizedBuffer ? (optimized.filename || 'resume-optimized.pdf') : undefined,
      });
      setSent(p => ({ ...p, [company]: true }));
      const wasAttached = attachResume && hasResume;
      toast.success(`Email sent to ${companyData.recruiterEmail}${wasAttached ? ' 📎 resume attached' : ''}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Send failed');
    } finally {
      setSending(p => ({ ...p, [company]: false }));
    }
  };

  const sendAll = async () => {
    if (!smtpStatus?.configured) {
      toast.error('Configure your email first in Settings → Email Setup');
      return;
    }

    const toSend = data.companies.filter(c =>
      c.recruiterEmail &&
      selected.includes(c.company) &&
      !sent[c.company]
    );

    if (toSend.length === 0) {
      toast.error('No emails to send. Generate emails first.');
      return;
    }

    if (!confirm(`Send ${toSend.length} emails? This uses ${toSend.length * 7} credits (AI + send).`)) return;

    setSendingAll(true);
    let successCount = 0;

    for (const company of toSend) {
      // Generate if not already done
      if (!previews[company.company]) {
        await generateEmail(company.company);
        await new Promise(r => setTimeout(r, 500));
      }
      await sendEmail(company.company);
      successCount++;
      await new Promise(r => setTimeout(r, 1000));
    }

    setSendingAll(false);
    toast.success(`${successCount} emails sent!`);
  };

  const toggleSelect = (company) => {
    setSelected(prev =>
      prev.includes(company) ? prev.filter(c => c !== company) : [...prev, company]
    );
  };

  const selectAll = () => {
    setSelected(data.companies.filter(c => c.recruiterEmail).map(c => c.company));
  };

  const copyEmail = async (email) => {
    await navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-12">
      <p className="text-gray-500">No data found. Go back to results.</p>
    </div>
  );

  // In single-company mode, show only the requested company
  const allCompanies  = singleCompany
    ? data.companies.filter(c => c.company === singleCompany)
    : data.companies;
  const withEmail    = allCompanies.filter(c => c.recruiterEmail);
  const withoutEmail = allCompanies.filter(c => !c.recruiterEmail);
  const selectedWithEmail = withEmail.filter(c => selected.includes(c.company));

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {singleCompany && (
              <button
                onClick={() => navigate(-1)}
                className="btn btn-sm btn-secondary"
              >
                ← Back
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">
              {singleCompany ? `Outreach — ${singleCompany}` : 'Outreach Manager'}
            </h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {singleCompany
              ? `Single company outreach`
              : `${data.totalJobs} jobs from ${data.companies.length} companies · `}
            {!singleCompany && <span className="text-green-600 font-medium">{data.withEmail} HR emails found</span>}
          </p>
        </div>
        <button
          onClick={() => navigate('/profile?tab=smtp')}
          className={cn(
            'btn btn-sm',
            smtpStatus?.configured ? 'btn-secondary' : 'btn-primary'
          )}
        >
          <Settings className="w-4 h-4" />
          {smtpStatus?.configured ? `Email: ${smtpStatus.default?.email || smtpStatus.accounts?.[0]?.email || 'Configured'}` : 'Setup Email'}
        </button>
      </div>

      {/* SMTP warning */}
      {!smtpStatus?.configured && (
        <div className="card card-body bg-amber-50 border-amber-300">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Email not configured</p>
              <p className="text-sm text-amber-700 mt-0.5">
                You need to connect your Gmail to send outreach emails.
                Go to <strong>Profile → Email Setup</strong> to add your Gmail app password.
              </p>
            </div>
            <button
              onClick={() => navigate('/profile?tab=smtp')}
              className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0"
            >
              Setup Now
            </button>
          </div>
        </div>
      )}

      {/* Stats + actions — hidden in single-company mode */}
      {!singleCompany && (
      <div className="grid grid-cols-4 gap-3">
        <div className="card card-body text-center">
          <div className="text-2xl font-bold text-gray-900">{data.companies.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Companies</div>
        </div>
        <div className="card card-body text-center">
          <div className="text-2xl font-bold text-green-600">{data.withEmail}</div>
          <div className="text-xs text-gray-500 mt-0.5">HR Emails Found</div>
        </div>
        <div className="card card-body text-center">
          <div className="text-2xl font-bold text-blue-600">{Object.keys(previews).length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Emails Generated</div>
        </div>
        <div className="card card-body text-center">
          <div className="text-2xl font-bold text-purple-600">{Object.keys(sent).length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Emails Sent</div>
        </div>
      </div>
      )}

      {/* Resume attachment toggle */}
      <div className="card card-body py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAttachResume(v => !v)}
              disabled={!hasResume}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                attachResume && hasResume ? 'bg-blue-600' : 'bg-gray-300',
                !hasResume && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                attachResume && hasResume ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-gray-500" />
                Attach Resume to every email
              </p>
              <p className="text-xs text-gray-500">
                {hasResume
                  ? 'Your uploaded resume PDF will be attached'
                  : 'Upload a resume in Profile → Resume to enable this'}
              </p>
            </div>
          </div>

          {isPro && hasResume && (
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <p className="text-xs text-purple-700 font-medium">
                Pro: "Optimize Keywords" button available per company below — 3 credits each
              </p>
            </div>
          )}

          {!hasResume && (
            <a href="/profile?tab=resume" className="btn btn-sm btn-secondary flex-shrink-0">
              Upload Resume
            </a>
          )}
        </div>
      </div>

      {/* Bulk actions — hidden in single-company mode */}
      {!singleCompany && (
      <div className="card card-body bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-blue-800">
              {selectedWithEmail.length} companies selected
            </p>
            <p className="text-sm text-blue-600">
              Est. cost: {selectedWithEmail.length * 7} credits (5 AI + 2 send per email)
              {attachResume && hasResume && ' · Resume attached'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={selectAll} className="btn btn-sm btn-secondary">
              Select All
            </button>
            <button
              onClick={generateAll}
              disabled={selectedWithEmail.length === 0}
              className="btn btn-sm btn-secondary"
            >
              <Sparkles className="w-4 h-4" />
              Generate All
            </button>
            <button
              onClick={sendAll}
              disabled={sendingAll || selectedWithEmail.length === 0 || !smtpStatus?.configured}
              className="btn btn-sm btn-primary"
            >
              {sendingAll
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                : <><Send className="w-4 h-4" /> Send to All Selected</>
              }
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Companies with emails */}
      {withEmail.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Companies with HR Emails ({withEmail.length})
          </h2>

          {withEmail.map(company => (
            <div
              key={company.company}
              className={cn(
                'card overflow-hidden transition-all',
                selected.includes(company.company) ? 'border-blue-300' : '',
                sent[company.company] ? 'border-green-300 bg-green-50/30' : ''
              )}
            >
              {/* Company header */}
              <div className="p-4">
                <div className="flex items-start gap-3">

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(company.company)}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                      selected.includes(company.company)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300 hover:border-blue-400'
                    )}
                  >
                    {selected.includes(company.company) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Company avatar */}
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {company.company[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{company.company}</h3>
                      <span className={cn(
                        'badge text-xs',
                        company.recruiterSource === 'hunter' ? 'badge-green' :
                        company.recruiterSource === 'apollo' ? 'badge-blue' : 'badge-gray'
                      )}>
                        {company.recruiterSource === 'hunter' ? '✓ Verified' :
                         company.recruiterSource === 'apollo' ? '✓ Apollo' : 'Pattern'}
                      </span>
                      {sent[company.company] && (
                        <span className="badge badge-green text-xs">✓ Email Sent</span>
                      )}
                    </div>

                    {/* HR Contact info */}
                    <div className="mt-1 flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-blue-600 font-medium">{company.recruiterEmail}</span>
                        <button
                          onClick={() => copyEmail(company.recruiterEmail)}
                          className="p-0.5 text-gray-400 hover:text-gray-600"
                        >
                          {copied === company.recruiterEmail
                            ? <Check className="w-3.5 h-3.5 text-green-500" />
                            : <Copy className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>

                      {company.recruiterName && (
                        <span className="text-sm text-gray-500">{company.recruiterName}</span>
                      )}

                      {company.recruiterConfidence && (
                        <span className={cn(
                          'badge text-xs',
                          company.recruiterConfidence >= 70 ? 'badge-green' :
                          company.recruiterConfidence >= 40 ? 'badge-amber' : 'badge-gray'
                        )}>
                          {company.recruiterConfidence}% confidence
                        </span>
                      )}
                    </div>

                    {/* Links */}
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {company.recruiterLinkedIn && (
                        <a
                          href={company.recruiterLinkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          <Linkedin className="w-3 h-3" /> LinkedIn Profile
                        </a>
                      )}
                      {company.careerPageUrl && (
                        <a
                          href={company.careerPageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          <ExternalLink className="w-3 h-3" /> Careers Page
                        </a>
                      )}
                    </div>

                    {/* Jobs under this company */}
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {company.jobs.slice(0, 3).map(job => (
                        <span key={job._id} className="badge badge-gray text-xs">
                          {job.title} · {job.matchScore}%
                        </span>
                      ))}
                      {company.jobs.length > 3 && (
                        <span className="badge badge-gray text-xs">+{company.jobs.length - 3} more</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!previews[company.company] ? (
                      <button
                        onClick={() => generateEmail(company.company)}
                        disabled={generating[company.company]}
                        className="btn btn-secondary btn-sm"
                      >
                        {generating[company.company]
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Sparkles className="w-4 h-4" />
                        }
                        Generate
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => sendEmail(company.company)}
                          disabled={sending[company.company] || sent[company.company] || !smtpStatus?.configured}
                          className={cn(
                            'btn btn-sm',
                            sent[company.company] ? 'btn-secondary opacity-60' : 'btn-primary'
                          )}
                        >
                          {sending[company.company]
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : sent[company.company]
                              ? <><CheckCircle className="w-4 h-4" /> Sent</>
                              : <><Send className="w-4 h-4" /> Send</>
                          }
                        </button>
                        <button
                          onClick={() => setExpandedPrev(p => ({ ...p, [company.company]: !p[company.company] }))}
                          className="btn btn-secondary btn-sm"
                        >
                          {expandedPrev[company.company] ? 'Hide' : 'Preview'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Email preview */}
                {previews[company.company] && expandedPrev[company.company] && (
                  <div className="mt-3 ml-8 border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">Email Preview</span>
                        <span className="badge badge-green text-xs">AI Generated</span>
                        {(attachResume || optimizedResumes[company.company]) && (
                          <span className="badge badge-blue text-xs flex items-center gap-1">
                            <Paperclip className="w-2.5 h-2.5" />
                            {optimizedResumes[company.company] ? 'Resume + ATS Analysis' : 'Resume'}
                          </span>
                        )}
                      </div>

                      {/* Pro: Optimize Keywords button */}
                      {isPro && hasResume && !optimizedResumes[company.company] && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => optimizeResume(company.company)}
                            disabled={optimizing[company.company]}
                            className="btn btn-sm bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200 flex items-center gap-1"
                          >
                            {optimizing[company.company]
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Optimizing...</>
                              : <><Wand2 className="w-3.5 h-3.5" /> Optimize Resume <span className="text-purple-500 text-xs">3 cr</span></>
                            }
                          </button>
                          <button
                            onClick={() => setShowPasteBox(p => ({ ...p, [company.company]: !p[company.company] }))}
                            className="text-xs text-gray-400 hover:text-purple-600 underline underline-offset-2"
                            title="Paste your resume text for better extraction (use if auto-extraction is incomplete)"
                          >
                            {showPasteBox[company.company] ? 'Hide text' : 'Paste resume text'}
                          </button>
                        </div>
                      )}
                      {optimizedResumes[company.company] && (
                        <div className="flex items-center gap-2">
                          <span className="badge bg-purple-100 text-purple-700 text-xs flex items-center gap-1">
                            <Wand2 className="w-3 h-3" /> ATS Optimized
                          </span>
                          <button
                            onClick={() => setShowComparison(p => ({ ...p, [company.company]: !p[company.company] }))}
                            className="text-xs text-purple-600 hover:text-purple-800 underline underline-offset-2"
                          >
                            {showComparison[company.company] ? 'Hide' : 'View'} comparison
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Paste resume text box — for when PDF auto-extraction is incomplete */}
                    {showPasteBox[company.company] && !optimizedResumes[company.company] && (
                      <div className="px-3 py-3 bg-purple-50 border-b border-purple-100">
                        <p className="text-xs font-semibold text-purple-800 mb-1 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> Paste Your Full Resume Text
                        </p>
                        <p className="text-xs text-purple-600 mb-2">
                          If the comparison shows incomplete resume content, paste your full resume text here — it will be used for accurate AI optimization.
                        </p>
                        <textarea
                          className="w-full text-xs font-mono border border-purple-200 rounded p-2 focus:outline-none focus:border-purple-400 bg-white resize-none"
                          rows={12}
                          placeholder="Paste your complete resume text here (Ctrl+A, Ctrl+C from your resume document)..."
                          value={resumePasteText[company.company] || ''}
                          onChange={e => setResumePasteText(p => ({ ...p, [company.company]: e.target.value }))}
                        />
                        <p className="text-xs text-purple-400 mt-1">
                          {resumePasteText[company.company]?.length || 0} characters pasted
                          {resumePasteText[company.company]?.length > 200 && ' ✓ Ready to optimize'}
                        </p>
                      </div>
                    )}

                    {/* Resume optimization result panel */}
                    {optimizedResumes[company.company] && (() => {
                      const opt    = optimizedResumes[company.company];
                      const before = opt.atsScoreBefore || 0;
                      const after  = opt.atsScoreAfter  || 0;
                      const gain   = after - before;

                      const downloadFile = (b64, filename, mime) => {
                        const bytes = atob(b64);
                        const arr   = new Uint8Array(bytes.length);
                        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                        const blob = new Blob([arr], { type: mime });
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        a.href = url; a.download = filename; a.click();
                        URL.revokeObjectURL(url);
                      };

                      const downloadPdf  = () => opt.resumeBuffer     && downloadFile(opt.resumeBuffer,     opt.filename     || 'optimized-resume.pdf',  'application/pdf');
                      const downloadDocx = () => opt.resumeDocxBuffer && downloadFile(opt.resumeDocxBuffer, opt.docxFilename || 'optimized-resume.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

                      return (
                        <div className="border-b border-purple-100">
                          {/* Score + actions bar */}
                          <div className="px-3 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <div className="text-xs text-gray-400 mb-0.5">Before</div>
                                <div className="flex items-center gap-1">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${before}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-gray-600">{before}%</span>
                                </div>
                              </div>
                              <span className="text-gray-300">→</span>
                              <div className="text-center">
                                <div className="text-xs text-gray-400 mb-0.5">After</div>
                                <div className="flex items-center gap-1">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${after}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-green-600">{after}%</span>
                                </div>
                              </div>
                              {gain > 0 && (
                                <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                                  +{gain}% ATS
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={downloadPdf}
                                className="btn btn-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                                title="Download optimized resume PDF"
                              >
                                <Download className="w-3.5 h-3.5" /> Save PDF
                              </button>
                              {opt.hasDocx && opt.resumeDocxBuffer && (
                                <button
                                  onClick={downloadDocx}
                                  className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
                                  title="Download exact-layout DOCX (upload your .docx in Profile to enable)"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Save DOCX
                                </button>
                              )}
                              <button
                                onClick={() => setShowComparison(p => ({ ...p, [company.company]: !p[company.company] }))}
                                className="btn btn-sm btn-secondary"
                              >
                                {showComparison[company.company] ? 'Hide' : 'View'} Changes
                              </button>
                              <button
                                onClick={() => setOptimizedResumes(p => { const n = {...p}; delete n[company.company]; return n; })}
                                className="text-xs text-gray-400 hover:text-red-500"
                              >
                                Reset
                              </button>
                            </div>
                          </div>

                          {/* Added keywords */}
                          {opt.keywordsAdded?.length > 0 && (
                            <div className="px-3 py-2 bg-green-50 border-b border-green-100">
                              <p className="text-xs font-semibold text-green-800 mb-1.5">
                                Keywords Added ({opt.keywordsAdded.length})
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {opt.keywordsAdded.map((kw, i) => (
                                  <span key={i} className="badge bg-green-100 text-green-700 text-xs border border-green-200">+ {kw}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Layout preservation notice */}
                          <div className="px-3 py-1.5 bg-green-50 border-b border-green-100 flex items-center gap-2">
                            <FileText className="w-3 h-3 text-green-600 flex-shrink-0" />
                            <p className="text-xs text-green-700">
                              <strong>Optimized resume ready</strong> — all keyword changes applied.
                              {opt.hasDocx
                                ? <> Save as <strong>DOCX</strong> (exact layout preserved) or PDF.</>
                                : <> Upload your <strong>.docx</strong> in Profile → Resume for exact-layout output.</>
                              }
                            </p>
                          </div>

                          {/* Changes list modal */}
                          {showComparison[company.company] && (
                            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowComparison(p => ({ ...p, [company.company]: false })); }}>
                              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
                                {/* Modal header */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
                                  <div className="flex items-center gap-3">
                                    <Wand2 className="w-5 h-5 text-purple-600" />
                                    <div>
                                      <h3 className="font-semibold text-gray-900">ATS Changes — {company.company}</h3>
                                      <p className="text-xs text-gray-500">
                                        ATS score: {before}% → <strong className="text-green-600">{after}%</strong>
                                        {gain > 0 && <span className="ml-1 text-green-600 font-semibold">(+{gain}% improvement)</span>}
                                        <span className="ml-2 text-green-600">· Keywords applied</span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={downloadPdf} className="btn btn-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-1">
                                      <Download className="w-4 h-4" /> Save PDF
                                    </button>
                                    {opt.hasDocx && opt.resumeDocxBuffer && (
                                      <button onClick={downloadDocx} className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                                        <FileText className="w-4 h-4" /> Save DOCX
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setShowComparison(p => ({ ...p, [company.company]: false }))}
                                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>

                                {/* Diff list */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                  {opt.textReplacements?.length > 0 ? (
                                    <>
                                      <p className="text-xs text-gray-500 mb-3">
                                        {opt.textReplacements.length} change{opt.textReplacements.length > 1 ? 's' : ''} applied to your resume:
                                      </p>
                                      {opt.textReplacements.map((r, i) => (
                                        <div key={i} className="rounded-lg border border-gray-200 overflow-hidden text-sm">
                                          <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border-b border-red-100">
                                            <span className="text-red-500 font-bold mt-0.5 flex-shrink-0">−</span>
                                            <span className="text-red-700 line-through">{r.find}</span>
                                          </div>
                                          <div className="flex items-start gap-2 px-3 py-2 bg-green-50">
                                            <span className="text-green-600 font-bold mt-0.5 flex-shrink-0">+</span>
                                            <span className="text-green-800 font-medium">{r.replace}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </>
                                  ) : (
                                    <p className="text-sm text-gray-500 text-center py-8">No specific text changes to show.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="p-3 space-y-2">
                      <div>
                        <span className="text-xs text-gray-400">Subject: </span>
                        <input
                          value={previews[company.company].subject}
                          onChange={e => setPreviews(p => ({ ...p, [company.company]: { ...p[company.company], subject: e.target.value } }))}
                          className="input text-sm py-1 mt-1"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">Body: </span>
                        <textarea
                          value={previews[company.company].body}
                          onChange={e => setPreviews(p => ({ ...p, [company.company]: { ...p[company.company], body: e.target.value } }))}
                          rows={5}
                          className="input text-sm mt-1 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Companies without emails */}
      {withoutEmail.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-gray-400 flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-300" />
              No HR Email Found ({withoutEmail.length})
            </h2>
            {isPro && (
              <button
                onClick={findMissingEmails}
                disabled={findingEmails}
                className="btn btn-secondary btn-sm"
              >
                {findingEmails
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding...</>
                  : <><RefreshCw className="w-4 h-4" /> Find Missing Emails</>
                }
              </button>
            )}
            {!isPro && (
              <a href="/billing" className="btn btn-primary btn-sm">
                <Lock className="w-3 h-3" /> Upgrade to Find More
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {withoutEmail.map(company => (
              <div key={company.company} className="card card-body py-3 opacity-60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-sm flex-shrink-0">
                    {company.company[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{company.company}</p>
                    <p className="text-xs text-gray-400">{company.jobs.length} jobs</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}