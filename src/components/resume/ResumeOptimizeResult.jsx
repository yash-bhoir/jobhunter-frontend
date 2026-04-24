import { useState, useEffect, useMemo, useRef } from 'react';
import { Download, FileText, Wand2, X, Eye, Edit3, RotateCcw, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { Badge } from '@components/ui';

function makeBlobUrl(b64, mime) {
  if (!b64) return null;
  try {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: mime }));
  } catch { return null; }
}

function downloadBlob(b64, filename, mime) {
  const url = makeBlobUrl(b64, mime);
  if (!url) return;
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ResumeOptimizeResult({ opt, company, onReset }) {
  const toast = useToast();
  const [open,        setOpen]        = useState(false);
  const [tab,         setTab]         = useState('preview'); // 'preview' | 'edit' | 'changes'
  const [editedText,  setEditedText]  = useState('');
  const [rerendering, setRerendering] = useState(false);
  const [renderedB64, setRenderedB64] = useState(null);  // base64 of re-rendered PDF
  const iframeRef = useRef(null);

  const before = opt.atsScoreBefore || 0;
  const after  = opt.atsScoreAfter  || 0;
  const gain   = after - before;

  // Active PDF buffer: use re-rendered if available, else original
  const activePdfB64 = renderedB64 || opt.resumeBuffer;

  // Blob URL for PDF iframe preview — revoked when component unmounts or b64 changes
  const pdfBlobUrl = useMemo(() => {
    return makeBlobUrl(activePdfB64, 'application/pdf');
  }, [activePdfB64]);

  useEffect(() => () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); }, [pdfBlobUrl]);

  // Seed editable text when modal opens
  useEffect(() => {
    if (open && !editedText && opt.updatedResumeText) {
      setEditedText(opt.updatedResumeText);
    }
  }, [open]);

  const downloadPdf  = () => downloadBlob(activePdfB64,   opt.filename     || 'optimized-resume.pdf',  'application/pdf');
  const downloadDocx = () => downloadBlob(opt.resumeDocxBuffer, opt.docxFilename || 'optimized-resume.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  const rerenderPdf = async () => {
    if (!editedText.trim()) return;
    setRerendering(true);
    try {
      const body = { text: editedText };
      if (opt.usedTemplate?._id) { body.templateId = opt.usedTemplate._id; body.sections = opt.sections; }
      const { data: res } = await api.post('/outreach/render-resume-pdf', body);
      const payload = res.data?.data ?? res.data;
      setRenderedB64(payload.resumeBuffer);
      setTab('preview');
      toast.success('PDF updated with your edits');
    } catch {
      toast.error('Re-render failed');
    } finally {
      setRerendering(false);
    }
  };

  return (
    <>
      {/* ── Inline result bar ── */}
      <div className="px-3 py-2 border-t border-purple-100 bg-purple-50 flex items-center justify-between gap-3 flex-wrap">
        {/* Scores */}
        <div className="flex items-center gap-3">
          <ScoreBar label="Before" pct={before} color="bg-red-400" />
          <span className="text-gray-300 text-sm">→</span>
          <ScoreBar label="After"  pct={after}  color="bg-green-500" textColor="text-green-600" />
          {gain > 0 && (
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded px-2 py-0.5">+{gain}% ATS</span>
          )}
          {opt.fitScore > 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${opt.fitScore >= 75 ? 'text-green-700 bg-green-50 border-green-200' : opt.fitScore >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
              Fit {opt.fitScore}%
            </span>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setOpen(true)}
            className="btn btn-sm bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Preview & Edit
          </button>
          <button onClick={downloadPdf}
            className="btn btn-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          {opt.hasDocx && opt.resumeDocxBuffer && (
            <button onClick={downloadDocx}
              className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> DOCX
            </button>
          )}
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-red-500 px-1">Reset</button>
        </div>
      </div>

      {/* ── Keywords bar ── */}
      {opt.keywordsAdded?.length > 0 && (
        <div className="px-3 py-1.5 bg-green-50 border-t border-green-100 flex flex-wrap gap-1">
          <span className="text-xs font-semibold text-green-800 mr-1">Keywords added:</span>
          {opt.keywordsAdded.slice(0, 8).map((kw, i) => (
            <Badge key={i} variant="green" className="text-xs">+ {kw}</Badge>
          ))}
          {opt.keywordsAdded.length > 8 && (
            <span className="text-xs text-green-600">+{opt.keywordsAdded.length - 8} more</span>
          )}
        </div>
      )}

      {/* ── Full-screen modal ── */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full flex flex-col"
            style={{ maxWidth: 1100, height: '92vh' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Wand2 className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Optimized Resume — {company}</h3>
                  <p className="text-xs text-gray-500">
                    ATS: {before}% → <strong className="text-green-600">{after}%</strong>
                    {gain > 0 && <span className="ml-1 text-green-600">(+{gain}%)</span>}
                    {opt.level && <span className="ml-2 text-purple-600 capitalize">· {opt.level} level</span>}
                    {opt.usedTemplate && <span className="ml-2 text-indigo-600">· {opt.usedTemplate.name}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadPdf}
                  className="btn btn-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  {renderedB64 ? 'Download Edited PDF' : 'Download PDF'}
                </button>
                {opt.hasDocx && opt.resumeDocxBuffer && (
                  <button onClick={downloadDocx}
                    className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                    <FileText className="w-4 h-4" /> DOCX
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-xl">×</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-5 flex-shrink-0 gap-1">
              {[
                { id: 'preview', icon: <Eye className="w-3.5 h-3.5" />, label: 'Preview' },
                { id: 'edit',    icon: <Edit3 className="w-3.5 h-3.5" />, label: 'Edit Text' },
                { id: 'changes', icon: <RotateCcw className="w-3.5 h-3.5" />, label: `Changes (${opt.textReplacements?.length || 0})` },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px
                    ${tab === t.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  {t.icon}{t.label}
                </button>
              ))}
              {/* Gap analysis */}
              {opt.gapAnalysis?.length > 0 && (
                <div className="ml-auto flex items-center gap-1.5 py-1.5">
                  <span className="text-xs text-amber-600 font-medium">
                    {opt.gapAnalysis.length} gap{opt.gapAnalysis.length > 1 ? 's' : ''} identified
                  </span>
                </div>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">

              {/* Preview tab */}
              {tab === 'preview' && (
                <div className="h-full flex flex-col">
                  {pdfBlobUrl ? (
                    <iframe ref={iframeRef} src={pdfBlobUrl} className="flex-1 w-full border-0"
                      title="Optimized Resume Preview" />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                      PDF preview not available
                    </div>
                  )}
                </div>
              )}

              {/* Edit tab */}
              {tab === 'edit' && (
                <div className="h-full flex flex-col">
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-3">
                    <p className="text-xs text-amber-700">
                      Edit the resume text below, then click <strong>Regenerate PDF</strong> to update the preview.
                    </p>
                    <button onClick={rerenderPdf} disabled={rerendering}
                      className="btn btn-sm bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1 flex-shrink-0">
                      {rerendering
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                        : <><RotateCcw className="w-3.5 h-3.5" /> Regenerate PDF</>}
                    </button>
                  </div>
                  <textarea
                    value={editedText}
                    onChange={e => setEditedText(e.target.value)}
                    className="flex-1 w-full p-4 font-mono text-xs text-gray-800 bg-gray-50 resize-none focus:outline-none focus:bg-white transition-colors border-0"
                    spellCheck={false}
                    placeholder="Resume text will appear here..."
                  />
                </div>
              )}

              {/* Changes tab */}
              {tab === 'changes' && (
                <div className="h-full overflow-y-auto p-5 space-y-3">
                  {/* Gap analysis */}
                  {opt.gapAnalysis?.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-xs font-semibold text-amber-800 mb-2">Skills / Experience Gaps</p>
                      <div className="flex flex-wrap gap-1.5">
                        {opt.gapAnalysis.map((g, i) => (
                          <span key={i} className="text-xs bg-amber-100 text-amber-800 border border-amber-200 rounded px-2 py-0.5">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Changes made summary */}
                  {opt.changesMade?.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-800 mb-2">Key Changes</p>
                      <ul className="space-y-1">
                        {opt.changesMade.map((c, i) => (
                          <li key={i} className="text-xs text-blue-700 flex gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Diff list */}
                  {opt.textReplacements?.length > 0 ? (
                    <>
                      <p className="text-xs text-gray-500">
                        {opt.textReplacements.length} text replacement{opt.textReplacements.length > 1 ? 's' : ''} applied:
                      </p>
                      {opt.textReplacements.map((r, i) => (
                        <div key={i} className="rounded-lg border border-gray-200 overflow-hidden text-xs">
                          <div className="flex gap-2 px-3 py-2 bg-red-50 border-b border-red-100">
                            <span className="text-red-500 font-bold flex-shrink-0">−</span>
                            <span className="text-red-700 line-through">{r.find}</span>
                          </div>
                          <div className="flex gap-2 px-3 py-2 bg-green-50">
                            <span className="text-green-600 font-bold flex-shrink-0">+</span>
                            <span className="text-green-800 font-medium">{r.replace}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">No text replacements recorded.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ScoreBar({ label, pct, color, textColor = 'text-gray-600' }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="flex items-center gap-1">
        <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
      </div>
    </div>
  );
}
