import { useEffect, useState } from 'react';
import { api } from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { Loader2, Plus, Trash2, FileCode } from 'lucide-react';
import { CardSurface } from '@components/ui';

export default function AdminResumeTemplates() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('Default LaTeX');
  const [description, setDescription] = useState('');
  const [templateCode, setTemplateCode] = useState(
    '% {{MACROS}} = packages + \\resume* commands. {{RESUME_HEADER}} = name block. {{RESUME_SECTIONS}} = rest.\n'
    + '\\documentclass[letterpaper,11pt]{article}\n{{MACROS}}\n\\begin{document}\n{{RESUME_HEADER}}\n\\vspace{1em}\n{{RESUME_SECTIONS}}\n\\end{document}',
  );
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/resume-templates');
      setList(data.data || []);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !templateCode.trim()) {
      toast.error('Name and LaTeX code are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/resume-templates', {
        name: name.trim(),
        description: description.trim(),
        templateCode,
        isActive: true,
      });
      toast.success('Template saved');
      setName(''); setDescription(''); setTemplateCode(
        '% {{MACROS}} + split layout\n\\documentclass[letterpaper,11pt]{article}\n{{MACROS}}\n\\begin{document}\n{{RESUME_HEADER}}\n\\vspace{1em}\n{{RESUME_SECTIONS}}\n\\end{document}',
      );
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/admin/resume-templates/${id}`);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileCode className="h-7 w-7 text-violet-600" aria-hidden />
          Resume templates (LaTeX)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          <strong>One whole-document block:</strong>{' '}
          <code className="rounded bg-gray-100 px-1">{'{{BODY}}'}</code> = name/contact + all sections (same look as the
          built-in PDF-style layout).{' '}
          <strong>For your own layout:</strong> use{' '}
          <code className="rounded bg-gray-100 px-1">{'{{RESUME_HEADER}}'}</code> (name block only) and{' '}
          <code className="rounded bg-gray-100 px-1">{'{{RESUME_SECTIONS}}'}</code> (Education / Experience / …) around
          your own LaTeX. Optional{' '}
          <code className="rounded bg-gray-100 px-1">{'{{MACROS}}'}</code> before{' '}
          <code className="rounded bg-gray-100 px-1">{'\\begin{document}'}</code> pulls in packages +{' '}
          <code className="rounded bg-gray-100 px-1">\resumeSubheading</code> etc.; if you omit it, it is auto-inserted
          when you use HEADER/SECTIONS only. Do not mix{' '}
          <code className="rounded bg-gray-100 px-1">{'{{BODY}}'}</code> with SECTIONS. Spacing in placeholders is
          ignored. Or leave the document body empty for auto-insert. Only one active template.
        </p>
      </div>

      <CardSurface className="space-y-3">
        <h2 className="font-semibold text-gray-900">Add template</h2>
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <textarea
          className="input min-h-[200px] font-mono text-xs"
          value={templateCode}
          onChange={(e) => setTemplateCode(e.target.value)}
        />
        <button type="button" disabled={saving} onClick={create} className="btn btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Save as active
        </button>
      </CardSurface>

      <CardSurface>
        <h2 className="font-semibold text-gray-900 mb-3">Saved templates</h2>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        ) : list.length === 0 ? (
          <p className="text-sm text-gray-500">No templates yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((t) => (
              <li key={t._id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.description}</p>
                  <p className="text-xs mt-1">
                    {t.isActive ? <span className="text-green-600 font-semibold">Active</span> : <span className="text-gray-400">Inactive</span>}
                    {' · '}
                    {new Date(t.updatedAt).toLocaleString()}
                  </p>
                </div>
                <button type="button" onClick={() => remove(t._id)} className="btn btn-danger btn-sm flex items-center gap-1 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardSurface>
    </div>
  );
}
