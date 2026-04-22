import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Mail, Send, Loader2, Sparkles, CheckCircle,
  ExternalLink, Linkedin, Copy, Check, Users,
  ChevronDown, ChevronUp, RefreshCw, Lock, Settings,
  Paperclip, FileText, Wand2, Info, Download, PenLine
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { cn }       from '@utils/helpers';
import { Badge, Card, CardSurface } from '@components/ui';

const draftKey = (company, email) => `${company}|||${(email || '').toLowerCase()}`;

export default function OutreachManager() {
  const { user }       = useAuth();
  const toast          = useToast();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const searchId       = searchParams.get('searchId');
  // When navigating from a single job's "Send Outreach Email" button,
  // these params narrow the view to just that one company
  const singleCompany    = searchParams.get('company')      || null;
  const singleTo         = searchParams.get('to')           || null;
  const singleTitle      = searchParams.get('jobTitle')     || null;
  // Source-specific job IDs for updating applied status in the right model
  const linkedinJobId    = searchParams.get('linkedinJobId') || null;

  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [smtpStatus,    setSmtpStatus]    = useState(null);
  const [selected,      setSelected]      = useState([]);   // selected company names
  const [selectedEmails, setSelectedEmails] = useState({}); // company -> string[] of selected email addresses
  /** Per-recipient drafts: key = draftKey(company, email) -> { subject, body, emailId } */
  const [emailDrafts,   setEmailDrafts]   = useState({});
  const [activeEditorEmail, setActiveEditorEmail] = useState({}); // company -> email (which tab is being edited)
  const [resumesList,   setResumesList]   = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const draftSaveTimer  = useRef({});
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
  const [jdPasteText,     setJdPasteText]     = useState({}); // company -> full JD pasted by user
  const [showJdPaste,     setShowJdPaste]     = useState({}); // company -> bool
  const [enhancing,       setEnhancing]       = useState({}); // company -> bool
  const [composeMode,     setComposeMode]     = useState({}); // company -> 'generated' | 'manual'

  const isPro = user?.plan === 'pro' || user?.plan === 'team';

  const pickEditorEmail = useCallback((company) => {
    const sel = selectedEmails[company] || [];
    const active = activeEditorEmail[company];
    if (active && sel.includes(active)) return active;
    return sel[0] || '';
  }, [selectedEmails, activeEditorEmail]);

  const currentDraft = useCallback((company) => {
    const email = pickEditorEmail(company);
    if (!email) return null;
    return emailDrafts[draftKey(company, email)] || null;
  }, [emailDrafts, pickEditorEmail]);

  const allSelectedHaveDrafts = useCallback((company) => {
    const emails = selectedEmails[company] || [];
    return emails.length > 0 && emails.every((e) => {
      const d = emailDrafts[draftKey(company, e)];
      return d && String(d.subject || '').trim() && String(d.body || '').trim();
    });
  }, [emailDrafts, selectedEmails]);

  const companyHasAnyDraft = useCallback((company) => {
    const emails = selectedEmails[company] || [];
    return emails.some((e) => {
      const d = emailDrafts[draftKey(company, e)];
      return d && String(d.body || '').trim();
    });
  }, [emailDrafts, selectedEmails]);

  const scheduleDraftSave = (emailId, subject, body, resumeId) => {
    if (!emailId) return;
    const t = draftSaveTimer.current[emailId];
    if (t) clearTimeout(t);
    draftSaveTimer.current[emailId] = setTimeout(async () => {
      try {
        await api.patch(`/outreach/drafts/${emailId}`, { subject, body, resumeId: resumeId || undefined });
      } catch { /* non-blocking */ }
    }, 1200);
  };

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

      // In single-company mode: ensure the company is in the list with the right email.
      // This handles the case where the user navigates from a job detail card that has
      // contacts not yet stored in the recruiter lookup table.
      let companies = [...(contactsRes.data.data.companies || [])];
      if (singleCompany && singleTo) {
        // Parse all emails passed via URL (comma-separated)
        const toEmails = singleTo.split(',').map(e => e.trim()).filter(Boolean);
        const allContacts = toEmails.map(email => ({
          email,
          name:       null,
          title:      null,
          confidence: null,
          source:     'job',
          status:     'unknown',
          linkedin:   null,
        }));
        const primaryEmail = toEmails[0];

        const idx = companies.findIndex(c => c.company === singleCompany);
        if (idx === -1) {
          // Company not in this search — inject a synthetic entry with ALL emails
          companies.unshift({
            company:              singleCompany,
            recruiterEmail:       primaryEmail,
            recruiterName:        null,
            recruiterConfidence:  null,
            recruiterSource:      null,
            recruiterLinkedIn:    null,
            careerPageUrl:        null,
            allRecruiterContacts: allContacts,
            jobs: [{ title: singleTitle || '', url: null, matchScore: null, status: 'found' }],
          });
        } else {
          // Company exists — merge all emails into allRecruiterContacts
          const existing = companies[idx].allRecruiterContacts || [];
          const existingEmails = new Set(existing.map(c => c.email));
          const merged = [
            ...existing,
            ...allContacts.filter(c => !existingEmails.has(c.email)),
          ];
          companies[idx] = {
            ...companies[idx],
            recruiterEmail:       companies[idx].recruiterEmail || primaryEmail,
            allRecruiterContacts: merged,
          };
        }
      }
      const patchedData = { ...contactsRes.data.data, companies };
      setData(patchedData);

      const pr = profileRes.data.data || {};
      const list = pr.resumes || [];
      setResumesList(list);
      const def = list.find((r) => r.isDefault) || list[0];
      if (def?.id) setSelectedResumeId(String(def.id));
      const hasRes = !!(pr.resume?.url || list.length);
      setHasResume(hasRes);
      if (hasRes) setAttachResume(true);

      const withEmail = companies.filter(c => c.recruiterEmail).map(c => c.company);
      // In single-company mode only select that company; else select all with email
      setSelected(singleCompany ? [singleCompany] : withEmail);

      // Initialize per-email selection — all emails selected by default per company
      const emailSel = {};
      companies.forEach(c => {
        const contacts = c.allRecruiterContacts?.length > 0
          ? c.allRecruiterContacts
          : c.recruiterEmail ? [{ email: c.recruiterEmail }] : [];
        emailSel[c.company] = contacts.map(ct => ct.email).filter(Boolean);
      });
      setSelectedEmails(emailSel);
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

  const generateEmail = async (company, opts = {}) => {
    const { onlyEmail, skipCache } = opts;
    const companyData = data.companies.find(c => c.company === company);
    if (!companyData) return;

    const job = companyData.jobs[0];
    const jd = jdPasteText[company]?.trim() || job.description || '';
    const allContacts = companyData.allRecruiterContacts?.length > 0
      ? companyData.allRecruiterContacts
      : companyData.recruiterEmail
        ? [{ email: companyData.recruiterEmail, name: companyData.recruiterName }]
        : [];
    const sel = selectedEmails[company] || [];
    const targets = (onlyEmail
      ? allContacts.filter(c => c.email === onlyEmail)
      : allContacts.filter(c => c.email && sel.includes(c.email))
    );

    if (!targets.length) {
      toast.error('Select at least one recipient email');
      return;
    }

    setGenerating(p => ({ ...p, [company]: true }));
    try {
      let v = 0;
      for (const t of targets) {
        const { data: res } = await api.post('/outreach/generate', {
          company,
          jobTitle:         job.title,
          recruiterName:    companyData.recruiterName,
          jobUrl:           job.url,
          jobDescription:   jd,
          jobId:            job._id || undefined,
          recipientEmail:   t.email,
          recipientName:    t.name || undefined,
          skipCache:        !!skipCache,
          variationIndex:   v,
        });
        const key = draftKey(company, t.email);
        const payload = res.data?.data ?? res.data;
        setEmailDrafts(p => ({
          ...p,
          [key]: {
            subject: payload.subject,
            body:    payload.body,
            emailId: payload.emailId,
          },
        }));
        v += 1;
      }
      const first = targets[0]?.email;
      if (first) setActiveEditorEmail(a => ({ ...a, [company]: first }));
      setComposeMode(p => ({ ...p, [company]: 'generated' }));
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
      if (!allSelectedHaveDrafts(c.company)) await generateEmail(c.company);
    }
  };

  const startManualWrite = (company) => {
    const companyData = data.companies.find(co => co.company === company);
    const job = companyData?.jobs[0];
    const email = pickEditorEmail(company) || (selectedEmails[company] || [])[0];
    if (!email) {
      toast.error('Select a recipient email first');
      return;
    }
    const key = draftKey(company, email);
    setEmailDrafts(p => ({
      ...p,
      [key]: {
        subject: job?.title ? `${job.title} — Application` : '',
        body: '',
        emailId: p[key]?.emailId,
      },
    }));
    setComposeMode(p => ({ ...p, [company]: 'manual' }));
    setExpandedPrev(p => ({ ...p, [company]: true }));
  };

  const enhanceEmail = async (company) => {
    const companyData = data.companies.find(c => c.company === company);
    const email = pickEditorEmail(company);
    const preview = email ? emailDrafts[draftKey(company, email)] : null;
    if (!preview?.body) return;
    const job = companyData?.jobs[0];
    const jd = jdPasteText[company]?.trim() || job?.description || '';

    setEnhancing(p => ({ ...p, [company]: true }));
    try {
      const { data: res } = await api.post('/outreach/enhance', {
        subject:        preview.subject,
        body:           preview.body,
        company,
        jobTitle:       job?.title,
        jobDescription: jd,
      });
      const key = draftKey(company, email);
      const payload = res.data?.data ?? res.data;
      setEmailDrafts(p => ({
        ...p,
        [key]: { ...p[key], subject: payload.subject, body: payload.body, emailId: p[key]?.emailId },
      }));
      setComposeMode(p => ({ ...p, [company]: 'generated' }));
      toast.success('Email enhanced!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Enhancement failed');
    } finally {
      setEnhancing(p => ({ ...p, [company]: false }));
    }
  };

  const optimizeResume = async (company) => {
    const companyData = data.companies.find(c => c.company === company);
    if (!companyData) return;
    const job = companyData.jobs[0];
    const jd = jdPasteText[company]?.trim() || job.description || '';

    setOptimizing(p => ({ ...p, [company]: true }));
    try {
      const body = {
        jobTitle:       job.title,
        jobDescription: jd,
        company,
      };
      if (selectedResumeId) body.resumeId = selectedResumeId;
      const { data: res } = await api.post('/outreach/optimize-resume', body);
      const payload = res.data?.data ?? res.data;
      setOptimizedResumes(p => ({ ...p, [company]: payload }));
      const score = (payload.atsScoreAfter || 0) - (payload.atsScoreBefore || 0);
      setShowComparison(p => ({ ...p, [company]: true }));
      toast.success(`Resume optimized for ${company}! ATS match +${score}%`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Optimization failed');
    } finally {
      setOptimizing(p => ({ ...p, [company]: false }));
    }
  };

  const sendEmail = async (company) => {
    const companyData = data.companies.find(c => c.company === company);
    const allContacts = companyData.allRecruiterContacts?.length > 0
      ? companyData.allRecruiterContacts
      : companyData.recruiterEmail
        ? [{ email: companyData.recruiterEmail, name: companyData.recruiterName }]
        : [];
    const selEmails  = selectedEmails[company] || [];
    const recipients = allContacts
      .filter(c => c.email && selEmails.includes(c.email))
      .map(c => ({ email: c.email, name: c.name || null }));

    if (recipients.length === 0) { toast.error('Select at least one email to send to'); return; }
    if (!allSelectedHaveDrafts(company)) {
      toast.error('Generate or compose a unique email for each selected recipient');
      return;
    }

    setSending(p => ({ ...p, [company]: true }));
    try {
      let resumeBuffer   = undefined;
      let resumeFilename = undefined;

      if (attachResume) {
        try {
          const params = selectedResumeId ? { resumeId: selectedResumeId } : {};
          const { data: pdfRes } = await api.get('/outreach/generate-resume-pdf', { params });
          const pr = pdfRes.data?.data ?? pdfRes.data;
          resumeBuffer   = pr.resumeBuffer;
          resumeFilename = pr.filename;
        } catch { /* backend attaches from library */ }
      }

      const resolvedJobId = companyData.jobs[0]?._id || linkedinJobId || undefined;
      const rid = selectedResumeId || undefined;

      let successCount = 0;
      for (let i = 0; i < recipients.length; i += 1) {
        const { email: to, name: recruiterName } = recipients[i];
        const draft = emailDrafts[draftKey(company, to)];
        if (!draft?.subject?.trim() || !draft.body?.trim()) continue;
        await api.post('/outreach/send', {
          subject:      draft.subject,
          body:         draft.body,
          company,
          jobId:        resolvedJobId,
          to,
          recruiterName,
          emailId:      draft.emailId,
          attachResume: attachResume && !resumeBuffer,
          resumeBuffer,
          resumeFilename,
          resumeId:    rid,
        });
        successCount += 1;
        if (i < recipients.length - 1) await new Promise(r => setTimeout(r, 600));
      }

      setSent(p => ({ ...p, [company]: true }));
      toast.success(`Email sent to ${successCount} recipient${successCount > 1 ? 's' : ''}${resumeBuffer ? ' with resume' : ''}`);
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
      if (!allSelectedHaveDrafts(company.company)) {
        await generateEmail(company.company);
        await new Promise(r => setTimeout(r, 500));
      }
      await sendEmail(company.company);
      successCount += 1;
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

  const toggleEmailSelect = (company, email) => {
    setSelectedEmails(prev => {
      const cur = prev[company] || [];
      return {
        ...prev,
        [company]: cur.includes(email) ? cur.filter(e => e !== email) : [...cur, email],
      };
    });
  };

  const toggleAllEmailsForCompany = (company, allEmails) => {
    setSelectedEmails(prev => {
      const cur = prev[company] || [];
      const allSelected = allEmails.every(e => cur.includes(e));
      return { ...prev, [company]: allSelected ? [] : [...allEmails] };
    });
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

  // In single-company mode, filter to just that company.
  // The company is guaranteed to be in data.companies because fetchData injected it.
  const allCompanies = singleCompany
    ? data.companies.filter(c => c.company === singleCompany)
    : data.companies;
  const withEmail    = allCompanies.filter(c => c.recruiterEmail);
  const withoutEmail = allCompanies.filter(c => !c.recruiterEmail);
  const selectedWithEmail = withEmail.filter(c => selected.includes(c.company));

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {singleCompany && (
              <button
                onClick={() => navigate(-1)}
                className="btn btn-sm btn-secondary flex-shrink-0"
              >
                ← Back
              </button>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
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
            'btn btn-sm flex-shrink-0',
            smtpStatus?.configured ? 'btn-secondary' : 'btn-primary'
          )}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">
            {smtpStatus?.configured ? `Email: ${smtpStatus.default?.email || smtpStatus.accounts?.[0]?.email || 'Configured'}` : 'Setup Email'}
          </span>
          <span className="sm:hidden">
            {smtpStatus?.configured ? 'Email ✓' : 'Setup'}
          </span>
        </button>
      </div>

      {/* SMTP warning */}
      {!smtpStatus?.configured && (
        <CardSurface className="border-amber-300 bg-amber-50">
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
        </CardSurface>
      )}

      {/* Stats + actions — hidden in single-company mode */}
      {!singleCompany && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CardSurface className="text-center">
          <div className="text-2xl font-bold text-gray-900">{data.companies.length}</div>
          <div className="mt-0.5 text-xs text-gray-500">Companies</div>
        </CardSurface>
        <CardSurface className="text-center">
          <div className="text-2xl font-bold text-green-600">{data.withEmail}</div>
          <div className="mt-0.5 text-xs text-gray-500">HR Emails Found</div>
        </CardSurface>
        <CardSurface className="text-center">
          <div className="text-2xl font-bold text-blue-600">{Object.keys(emailDrafts).length}</div>
          <div className="mt-0.5 text-xs text-gray-500">Emails Generated</div>
        </CardSurface>
        <CardSurface className="text-center">
          <div className="text-2xl font-bold text-purple-600">{Object.keys(sent).length}</div>
          <div className="mt-0.5 text-xs text-gray-500">Emails Sent</div>
        </CardSurface>
      </div>
      )}

      {/* Resume attachment toggle */}
      <CardSurface className="py-3">
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
                  ? 'Choose which saved resume to attach (up to 3 in Profile)'
                  : 'Upload a resume in Profile → Resume to enable this'}
              </p>
            </div>
          </div>

          {hasResume && resumesList.length > 0 && (
            <div className="w-full sm:w-auto min-w-[200px]">
              <label className="text-xs font-medium text-gray-600">Select resume</label>
              <select
                className="input mt-1 text-sm"
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
              >
                {resumesList.map((r) => (
                  <option key={r.id || r.originalName} value={r.id || ''}>
                    {(r.name || r.originalName) + (r.isDefault ? ' (default)' : '')}
                  </option>
                ))}
              </select>
            </div>
          )}

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
      </CardSurface>

      {/* Bulk actions — hidden in single-company mode */}
      {!singleCompany && (
      <CardSurface className="border-blue-200 bg-blue-50">
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
      </CardSurface>
      )}

      {/* Companies with emails */}
      {withEmail.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Companies with HR Emails ({withEmail.length})
          </h2>

          {withEmail.map(company => (
            <Card
              key={company.company}
              className={cn(
                'overflow-hidden transition-all',
                selected.includes(company.company) ? 'border-blue-300' : '',
                sent[company.company] ? 'border-green-300 bg-green-50/30' : '',
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
                      <Badge
                        variant={
                          company.recruiterSource === 'hunter'
                            ? 'green'
                            : company.recruiterSource === 'apollo'
                              ? 'blue'
                              : 'gray'
                        }
                        className="text-xs"
                      >
                        {company.recruiterSource === 'hunter'
                          ? '✓ Verified'
                          : company.recruiterSource === 'apollo'
                            ? '✓ Apollo'
                            : 'Pattern'}
                      </Badge>
                      {sent[company.company] && (
                        <Badge variant="green" className="text-xs">
                          ✓ Email Sent
                        </Badge>
                      )}
                    </div>

                    {/* HR Contacts — per-email checkboxes */}
                    {(() => {
                      const contacts = company.allRecruiterContacts?.length > 0
                        ? company.allRecruiterContacts
                        : company.recruiterEmail
                          ? [{ email: company.recruiterEmail, name: company.recruiterName, confidence: company.recruiterConfidence, source: company.recruiterSource, linkedin: company.recruiterLinkedIn }]
                          : [];
                      const allEmails   = contacts.map(c => c.email).filter(Boolean);
                      const selEmails   = selectedEmails[company.company] || [];
                      const selCount    = allEmails.filter(e => selEmails.includes(e)).length;
                      const allSelected = selCount === allEmails.length;
                      return (
                        <div className="mt-1.5 space-y-1">
                          {allEmails.length > 1 && (
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-gray-400">
                                {selCount}/{allEmails.length} selected — click to toggle
                              </span>
                              <button
                                onClick={() => toggleAllEmailsForCompany(company.company, allEmails)}
                                className="text-[10px] text-blue-600 hover:underline font-semibold"
                              >
                                {allSelected ? 'Deselect all' : 'Select all'}
                              </button>
                            </div>
                          )}
                          {contacts.map((contact, ci) => {
                            const isSelected = selEmails.includes(contact.email);
                            return (
                              <div
                                key={ci}
                                onClick={() => toggleEmailSelect(company.company, contact.email)}
                                className={cn(
                                  'flex items-center gap-2 flex-wrap px-2 py-1 rounded-lg border cursor-pointer transition-all select-none',
                                  isSelected
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-gray-50 border-gray-200 opacity-50'
                                )}
                              >
                                {/* Checkbox */}
                                <div className={cn(
                                  'w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                  isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                                )}>
                                  {isSelected && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                  <span className={cn('text-sm font-medium', isSelected ? 'text-blue-600' : 'text-gray-400 line-through')}>{contact.email}</span>
                                  <button
                                    onClick={e => { e.stopPropagation(); copyEmail(contact.email); }}
                                    className="p-0.5 text-gray-400 hover:text-gray-600"
                                  >
                                    {copied === contact.email
                                      ? <Check className="w-3.5 h-3.5 text-green-500" />
                                      : <Copy className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                </div>
                                {contact.name && (
                                  <span className="text-xs text-gray-500">{contact.name}</span>
                                )}
                                {contact.confidence > 0 && (
                                  <Badge
                                    variant={
                                      contact.confidence >= 70
                                        ? 'green'
                                        : contact.confidence >= 40
                                          ? 'amber'
                                          : 'gray'
                                    }
                                    className="text-xs"
                                  >
                                    {contact.confidence}% confidence
                                  </Badge>
                                )}
                                {contact.linkedin && (
                                  <a href={contact.linkedin} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700">
                                    <Linkedin className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Careers page link */}
                    {company.careerPageUrl && (
                      <div className="mt-1">
                        <a
                          href={company.careerPageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          <ExternalLink className="w-3 h-3" /> Careers Page
                        </a>
                      </div>
                    )}

                    {/* Jobs under this company */}
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {company.jobs.slice(0, 3).map(job => (
                        <Badge key={job._id} variant="gray" className="text-xs">
                          {job.title} · {job.matchScore}%
                        </Badge>
                      ))}
                      {company.jobs.length > 3 && (
                        <Badge variant="gray" className="text-xs">
                          +{company.jobs.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!allSelectedHaveDrafts(company.company) ? (
                      <>
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
                        <button
                          onClick={() => startManualWrite(company.company)}
                          className="btn btn-secondary btn-sm"
                        >
                          <PenLine className="w-4 h-4" />
                          Write
                        </button>
                      </>
                    ) : (
                      <>
                        {(() => {
                          const selCount = (selectedEmails[company.company] || []).length;
                          return (
                            <button
                              onClick={() => sendEmail(company.company)}
                              disabled={sending[company.company] || sent[company.company] || selCount === 0}
                              className={cn(
                                'btn btn-sm',
                                sent[company.company] ? 'btn-secondary opacity-60' : 'btn-primary'
                              )}
                              title={selCount === 0 ? 'Select at least one email' : `Send to ${selCount} email${selCount > 1 ? 's' : ''}`}
                            >
                              {sending[company.company]
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : sent[company.company]
                                  ? <><CheckCircle className="w-4 h-4" /> Sent</>
                                  : <><Send className="w-4 h-4" /> Send{selCount > 1 ? ` (${selCount})` : ''}</>
                              }
                            </button>
                          );
                        })()}
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
                {expandedPrev[company.company] && (composeMode[company.company] === 'manual' || companyHasAnyDraft(company.company)) && (
                  <div className="mt-3 ml-8 border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200">
                      {(selectedEmails[company.company] || []).length > 1 && (
                        <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-1">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase mr-1 self-center">To</span>
                          {(selectedEmails[company.company] || []).map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => setActiveEditorEmail((a) => ({ ...a, [company.company]: em }))}
                              className={cn(
                                'text-xs px-2 py-1 rounded-lg border transition-colors',
                                pickEditorEmail(company.company) === em
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                              )}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Row 1: mode label + Enhance / Re-generate */}
                      <div className="px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">
                            {composeMode[company.company] === 'manual' ? 'Compose Email' : 'Email Preview'}
                          </span>
                          {composeMode[company.company] === 'manual' ? (
                            <Badge variant="gray" className="flex items-center gap-1 text-xs">
                              <PenLine className="h-2.5 w-2.5 shrink-0" aria-hidden /> Manual
                            </Badge>
                          ) : (
                            <Badge variant="green" className="flex items-center gap-1 text-xs">
                              <Sparkles className="h-2.5 w-2.5 shrink-0" aria-hidden /> AI Generated
                            </Badge>
                          )}
                          {(attachResume || optimizedResumes[company.company]) && (
                            <Badge variant="blue" className="flex items-center gap-1 text-xs">
                              <Paperclip className="h-2.5 w-2.5 shrink-0" aria-hidden />
                              {optimizedResumes[company.company] ? 'Resume + ATS Analysis' : 'Resume'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => enhanceEmail(company.company)}
                            disabled={enhancing[company.company] || !currentDraft(company.company)?.body}
                            className="btn btn-sm bg-violet-100 text-violet-700 hover:bg-violet-200 border-violet-200 flex items-center gap-1"
                            title="Use AI to enhance and improve this email"
                          >
                            {enhancing[company.company]
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enhancing...</>
                              : <><Wand2 className="w-3.5 h-3.5" /> Enhance <span className="text-violet-500 text-xs">5 cr</span></>
                            }
                          </button>
                          <button
                            onClick={() => generateEmail(company.company, {
                              skipCache: true,
                              onlyEmail: pickEditorEmail(company.company),
                            })}
                            disabled={generating[company.company]}
                            className="btn btn-sm btn-secondary flex items-center gap-1"
                            title="Regenerate variation for this recipient"
                          >
                            {generating[company.company]
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Sparkles className="w-3.5 h-3.5" />
                            }
                            {generating[company.company] ? 'Generating...' : 'Re-generate'}
                          </button>
                        </div>
                      </div>

                      {/* Row 2 (conditional): Pro resume optimise / ATS status */}
                      {(isPro && hasResume && !optimizedResumes[company.company]) && (
                        <div className="px-3 py-1.5 border-t border-gray-200 flex items-center gap-1.5 flex-wrap">
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
                        </div>
                      )}
                      {optimizedResumes[company.company] && (
                        <div className="px-3 py-1.5 border-t border-gray-200 flex items-center gap-2">
                          <Badge variant="purple" className="flex items-center gap-1 text-xs">
                            <Wand2 className="h-3 w-3 shrink-0" aria-hidden /> ATS Optimized
                          </Badge>
                          <button
                            onClick={() => setShowComparison(p => ({ ...p, [company.company]: !p[company.company] }))}
                            className="text-xs text-purple-600 hover:text-purple-800 underline underline-offset-2"
                          >
                            {showComparison[company.company] ? 'Hide' : 'View'} comparison
                          </button>
                        </div>
                      )}
                    </div>

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
                                  <Badge key={i} variant="green" className="text-xs">
                                    + {kw}
                                  </Badge>
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
                      {!currentDraft(company.company) && (
                        <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                          No draft for this recipient yet. Click <strong>Generate</strong> or switch to another address.
                        </p>
                      )}
                      <div>
                        <span className="text-xs text-gray-400">Subject: </span>
                        <input
                          value={currentDraft(company.company)?.subject || ''}
                          onChange={(e) => {
                            const em = pickEditorEmail(company.company);
                            const key = draftKey(company.company, em);
                            setEmailDrafts((p) => {
                              const cur = p[key] || {};
                              const next = { ...cur, subject: e.target.value };
                              scheduleDraftSave(next.emailId, next.subject, next.body, selectedResumeId);
                              return { ...p, [key]: next };
                            });
                          }}
                          className="input mt-1 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">Body: </span>
                        <textarea
                          value={currentDraft(company.company)?.body || ''}
                          onChange={(e) => {
                            const em = pickEditorEmail(company.company);
                            const key = draftKey(company.company, em);
                            setEmailDrafts((p) => {
                              const cur = p[key] || {};
                              const next = { ...cur, body: e.target.value };
                              scheduleDraftSave(next.emailId, next.subject, next.body, selectedResumeId);
                              return { ...p, [key]: next };
                            });
                          }}
                          rows={5}
                          className="input mt-1 resize-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {withoutEmail.map(company => (
              <CardSurface key={company.company} className="py-3 opacity-60">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-400">
                    {company.company[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-700">{company.company}</p>
                    <p className="text-xs text-gray-400">{company.jobs.length} jobs</p>
                  </div>
                </div>
              </CardSurface>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}