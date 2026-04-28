/**
 * LeadGenFormModal — UI shell for building Meta Lead Gen Forms
 * Full API wiring (save to Meta, pull existing forms) is a backend task.
 * Design: dark modal, multi-page form builder with field drag-and-drop ordering.
 */

import { useState } from 'react';
import { X, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, FileText, Image, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { LeadGenForm, LeadGenFormField, LeadGenFormPage } from '@/lib/campaignStore';
import { genId } from '@/lib/campaignStore';
import { toast } from 'sonner';

interface Props {
  form: LeadGenForm;
  onChange: (form: LeadGenForm) => void;
  onClose: () => void;
}

const FIELD_TYPES: { value: LeadGenFormField['type']; label: string; group: string }[] = [
  { value: 'FULL_NAME',      label: 'Full Name',      group: 'Contact' },
  { value: 'EMAIL',          label: 'Email',          group: 'Contact' },
  { value: 'PHONE_NUMBER',   label: 'Phone Number',   group: 'Contact' },
  { value: 'STREET_ADDRESS', label: 'Street Address', group: 'Address' },
  { value: 'CITY',           label: 'City',           group: 'Address' },
  { value: 'STATE',          label: 'State',          group: 'Address' },
  { value: 'ZIP',            label: 'ZIP Code',       group: 'Address' },
  { value: 'COUNTRY',        label: 'Country',        group: 'Address' },
  { value: 'CUSTOM',         label: 'Custom Question', group: 'Custom' },
];

const PAGE_TYPES: { value: LeadGenFormPage['type']; label: string; desc: string }[] = [
  { value: 'INTRO',        label: 'Intro Screen',    desc: 'Optional welcome page before questions' },
  { value: 'QUESTIONS',    label: 'Questions',       desc: 'Form fields the user fills out' },
  { value: 'CONFIRMATION', label: 'Thank You',       desc: 'Shown after form submission' },
];

function FieldRow({ field, onUpdate, onRemove }: {
  field: LeadGenFormField;
  onUpdate: (f: LeadGenFormField) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded border border-border group hover:border-primary/30 transition-colors">
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 cursor-grab" />
      <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
        <select
          value={field.type}
          onChange={e => onUpdate({ ...field, type: e.target.value as LeadGenFormField['type'] })}
          className="cell-input appearance-none"
        >
          {FIELD_TYPES.map(ft => (
            <option key={ft.value} value={ft.value}>{ft.label}</option>
          ))}
        </select>
        <input
          value={field.label}
          onChange={e => onUpdate({ ...field, label: e.target.value })}
          placeholder={field.type === 'CUSTOM' ? 'Question text...' : 'Label (optional override)'}
          className="cell-input"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={field.required}
            onChange={e => onUpdate({ ...field, required: e.target.checked })}
            className="w-3 h-3 rounded accent-primary"
          />
          Required
        </label>
      </div>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PageSection({ page, onUpdate }: {
  page: LeadGenFormPage;
  onUpdate: (p: LeadGenFormPage) => void;
}) {
  const [open, setOpen] = useState(true);
  const meta = PAGE_TYPES.find(pt => pt.value === page.type);

  return (
    <div className="border border-border rounded overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 transition-colors text-left"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          page.type === 'INTRO' ? 'bg-blue-400' :
          page.type === 'QUESTIONS' ? 'bg-indigo-400' : 'bg-emerald-400'
        }`} />
        <span className="text-[12px] font-700 text-foreground">{meta?.label}</span>
        <span className="text-[11px] text-muted-foreground">{meta?.desc}</span>
        <div className="ml-auto">
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="p-4 space-y-3 bg-surface-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Headline</label>
              <input
                value={page.headline}
                onChange={e => onUpdate({ ...page, headline: e.target.value })}
                placeholder={page.type === 'INTRO' ? 'Welcome headline...' : page.type === 'QUESTIONS' ? 'Tell us about yourself' : 'Thank you!'}
                className="cell-input w-full text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Description</label>
              <input
                value={page.description}
                onChange={e => onUpdate({ ...page, description: e.target.value })}
                placeholder="Supporting copy..."
                className="cell-input w-full text-xs"
              />
            </div>
          </div>
          {page.type !== 'QUESTIONS' && (
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1">
                <Image className="w-3 h-3" /> Image URL (optional)
              </label>
              <input
                value={page.imageUrl || ''}
                onChange={e => onUpdate({ ...page, imageUrl: e.target.value })}
                placeholder="https://... or image hash"
                className="cell-input w-full text-xs font-mono"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeadGenFormModal({ form, onChange, onClose }: Props) {
  const set = <K extends keyof LeadGenForm>(key: K, val: LeadGenForm[K]) => {
    onChange({ ...form, [key]: val });
  };

  const addField = () => {
    const newField: LeadGenFormField = {
      id: genId(),
      type: 'EMAIL',
      label: '',
      required: true,
    };
    set('fields', [...form.fields, newField]);
  };

  const updateField = (id: string, updated: LeadGenFormField) => {
    set('fields', form.fields.map(f => f.id === id ? updated : f));
  };

  const removeField = (id: string) => {
    set('fields', form.fields.filter(f => f.id !== id));
  };

  const updatePage = (idx: number, updated: LeadGenFormPage) => {
    const next = [...form.pages];
    next[idx] = updated;
    set('pages', next);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Form name is required.'); return; }
    if (form.fields.length === 0) { toast.error('Add at least one form field.'); return; }
    toast.success('Lead gen form saved to build. Will be created on Meta at launch.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col bg-surface-1 border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-surface-2 flex-shrink-0">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-[14px] font-700 text-foreground">Lead Gen Form Builder</h2>
            <p className="text-[11px] text-muted-foreground">Form will be created on Meta at launch time</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* API notice */}
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300/90">
              This form will be created via the Meta Lead Ads API when you launch the build. You can also pull existing forms from your page once backend is connected.
            </p>
          </div>

          {/* Form basics */}
          <div className="space-y-3">
            <h3 className="text-[12px] font-700 text-foreground">Form Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Form Name <span className="text-primary">*</span></label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Brand — Lead Form Q3 2025"
                  className="cell-input w-full text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Form Type</label>
                <div className="flex gap-1.5">
                  {(['MORE_VOLUME', 'HIGHER_INTENT'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => set('formType', t)}
                      className={`flex-1 py-1.5 rounded text-[11px] font-700 border transition-all ${
                        form.formType === t
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-surface-2 text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {t === 'MORE_VOLUME' ? 'More Volume' : 'Higher Intent'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Privacy Policy URL <span className="text-primary">*</span></label>
                <input
                  value={form.privacyPolicyUrl}
                  onChange={e => set('privacyPolicyUrl', e.target.value)}
                  placeholder="https://yourdomain.com/privacy"
                  className="cell-input w-full text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Thank You Redirect URL (optional)</label>
                <input
                  value={form.thankYouCtaUrl || ''}
                  onChange={e => set('thankYouCtaUrl', e.target.value)}
                  placeholder="https://yourdomain.com/thank-you"
                  className="cell-input w-full text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Pages */}
          <div className="space-y-3">
            <h3 className="text-[12px] font-700 text-foreground">Form Pages</h3>
            <div className="space-y-2">
              {form.pages.map((page, idx) => (
                <PageSection key={page.id} page={page} onUpdate={p => updatePage(idx, p)} />
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-700 text-foreground">Form Fields</h3>
              <button
                onClick={addField}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-[11px] font-600 text-primary border border-primary/30 transition-all"
              >
                <Plus className="w-3 h-3" /> Add Field
              </button>
            </div>
            {form.fields.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-muted-foreground border border-dashed border-border rounded-lg">
                No fields yet — click Add Field to get started
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2 px-3 text-[9px] text-muted-foreground font-700 tracking-wider uppercase">
                  <span className="pl-5">Field Type</span>
                  <span>Label / Question</span>
                  <span>Required</span>
                </div>
                {form.fields.map(field => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    onUpdate={updated => updateField(field.id, updated)}
                    onRemove={() => removeField(field.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Validation summary */}
          <div className="space-y-1.5">
            {[
              { ok: !!form.name.trim(), label: 'Form name set' },
              { ok: form.fields.length > 0, label: 'At least one field added' },
              { ok: !!form.privacyPolicyUrl.trim(), label: 'Privacy policy URL set' },
            ].map(({ ok, label }) => (
              <div key={label} className={`flex items-center gap-2 text-[11px] ${ok ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded text-[12px] font-600 text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded bg-primary text-primary-foreground text-[12px] font-700 hover:bg-primary/90 transition-all">
            Save Form to Build
          </button>
        </div>
      </div>
    </div>
  );
}
