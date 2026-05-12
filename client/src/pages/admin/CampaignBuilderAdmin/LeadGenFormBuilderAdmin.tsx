/**
 * LeadGenFormBuilderAdmin
 * Multi-step Lead Gen Form builder modal matching the dark builder aesthetic.
 * Dark theme: pageBg #0d0c36, modalSurface #141349, cardSurface #1a1860, cyan #00BEEF
 */

import { useState } from 'react';
import {
  X, FileText, ChevronDown, ChevronRight, Plus, Trash2,
  Loader2, Check, Eye, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const T = {
  pageBg: '#0d0c36',
  modalSurface: '#141349',
  cardSurface: '#1a1860',
  activeState: '#1f1d70',
  border: 'rgba(255,255,255,0.1)',
  cyan: '#00BEEF',
  ink: '#f0f0ff',
  muted: '#a8a8c8',
  hint: '#6b6b8f',
  pink: '#ed135f',
  green: '#00b37a',
  white: '#ffffff',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuestionOption { value: string; key?: string; }
interface FormQuestion {
  id: string;
  type: string;
  label: string;
  key?: string;
  required: boolean;
  options?: QuestionOption[];
}

interface FormData {
  name: string;
  formType: 'MORE_VOLUME' | 'HIGHER_INTENT' | 'RICH_CREATIVE';
  privacyPolicyEnabled: boolean;
  privacyPolicyUrl: string;
  privacyPolicyLinkText: string;
  // Intro / context card
  contextCardEnabled: boolean;
  contextCardTitle: string;
  contextCardContent: string;
  contextCardStyle: 'LIST_STYLE' | 'PARAGRAPH_STYLE';
  // Questions
  questions: FormQuestion[];
  // Thank you page
  thankYouTitle: string;
  thankYouBody: string;
  thankYouWebsiteUrl: string;
  thankYouCtaTitle: string;
  thankYouCtaType: string;
  // Tracking
  trackingParams: { key: string; value: string }[];
  followUpActionUrl: string;
  locale: string;
}

// ─── Predefined question types ────────────────────────────────────────────────
const CONTACT_QUESTION_TYPES = [
  { value: 'EMAIL', label: 'Email', key: 'email' },
  { value: 'PHONE', label: 'Phone Number', key: 'phone_number' },
  { value: 'FULL_NAME', label: 'Full Name', key: 'full_name' },
  { value: 'FIRST_NAME', label: 'First Name', key: 'first_name' },
  { value: 'LAST_NAME', label: 'Last Name', key: 'last_name' },
  { value: 'JOB_TITLE', label: 'Job Title', key: 'job_title' },
  { value: 'COMPANY_NAME', label: 'Company Name', key: 'company_name' },
  { value: 'WORK_EMAIL', label: 'Work Email', key: 'work_email' },
  { value: 'WORK_PHONE', label: 'Work Phone', key: 'work_phone' },
  { value: 'CITY', label: 'City', key: 'city' },
  { value: 'STATE', label: 'State', key: 'state' },
  { value: 'COUNTRY', label: 'Country', key: 'country' },
  { value: 'ZIP', label: 'Zip Code', key: 'zip' },
  { value: 'STREET_ADDRESS', label: 'Street Address', key: 'street_address' },
  { value: 'DATE_OF_BIRTH', label: 'Date of Birth', key: 'date_of_birth' },
  { value: 'GENDER', label: 'Gender', key: 'gender' },
];

const CUSTOM_QUESTION_TYPES = [
  { value: 'CUSTOM', label: 'Short Answer' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'CONDITIONAL', label: 'Conditional' },
  { value: 'APPOINTMENT_SCHEDULING', label: 'Appointment Request' },
  { value: 'STORE_LOOKUP', label: 'Store Lookup' },
];

const CTA_TYPES = [
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'GET_OFFER', label: 'Get Offer' },
  { value: 'GET_QUOTE', label: 'Get Quote' },
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'SUBSCRIBE', label: 'Subscribe' },
  { value: 'VIEW_WEBSITE', label: 'View Website' },
  { value: 'APPLY_NOW', label: 'Apply Now' },
  { value: 'BOOK_NOW', label: 'Book Now' },
  { value: 'CONTACT_US', label: 'Contact Us' },
];

const LOCALES = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'es_ES', label: 'Spanish (Spain)' },
  { value: 'es_LA', label: 'Spanish (Latin America)' },
  { value: 'fr_FR', label: 'French' },
  { value: 'de_DE', label: 'German' },
  { value: 'it_IT', label: 'Italian' },
  { value: 'pt_BR', label: 'Portuguese (Brazil)' },
  { value: 'pt_PT', label: 'Portuguese (Portugal)' },
  { value: 'nl_NL', label: 'Dutch' },
  { value: 'ja_JP', label: 'Japanese' },
  { value: 'ko_KR', label: 'Korean' },
  { value: 'zh_CN', label: 'Chinese (Simplified)' },
  { value: 'zh_TW', label: 'Chinese (Traditional)' },
  { value: 'ar_AR', label: 'Arabic' },
];

// ─── UI Primitives ────────────────────────────────────────────────────────────
function FieldLabel({ children, hint, optional }: { children: React.ReactNode; hint?: string; optional?: boolean }) {
  return (
    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</span>
      {optional && <span style={{ fontSize: 9, color: T.hint, fontWeight: 500 }}>optional</span>}
      {hint && <span style={{ fontSize: 10, color: T.muted }}>{hint}</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength}
      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: T.cardSurface, color: T.ink, border: `1.5px solid ${T.border}`, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }}
      onFocus={e => { e.target.style.borderColor = T.cyan; e.target.style.boxShadow = `0 0 0 3px rgba(0,190,239,0.15)`; }}
      onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function TextareaInput({ value, onChange, placeholder, maxLength, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={rows}
      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: T.cardSurface, color: T.ink, border: `1.5px solid ${T.border}`, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, transition: 'border-color 0.15s, box-shadow 0.15s' }}
      onFocus={e => { e.target.style.borderColor = T.cyan; e.target.style.boxShadow = `0 0 0 3px rgba(0,190,239,0.15)`; }}
      onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: T.cardSurface, color: T.ink, border: `1.5px solid ${T.border}`, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ background: T.cardSurface, color: T.ink }}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div onClick={() => onChange(!value)} style={{ width: 38, height: 21, borderRadius: 999, background: value ? T.cyan : T.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ width: 17, height: 17, borderRadius: '50%', background: T.pageBg, position: 'absolute', top: 2, left: value ? 19 : 2, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
      </div>
      {label && <span style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${T.border}`, marginBottom: 14, overflow: 'hidden', background: T.cardSurface }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: open ? `1px solid ${T.border}` : 'none' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</span>
        <ChevronDown size={15} style={{ color: T.muted, transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
      </div>
      {open && <div style={{ padding: '14px 16px' }}>{children}</div>}
    </div>
  );
}

// ─── Step nav ─────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Form Type' },
  { id: 2, label: 'Intro' },
  { id: 3, label: 'Questions' },
  { id: 4, label: 'Privacy & Review' },
  { id: 5, label: 'Thank You' },
  { id: 6, label: 'Settings' },
];

function genId() { return Math.random().toString(36).slice(2, 9); }

const DEFAULT_FORM: FormData = {
  name: '',
  formType: 'MORE_VOLUME',
  privacyPolicyEnabled: false,
  privacyPolicyUrl: '',
  privacyPolicyLinkText: 'Privacy Policy',
  contextCardEnabled: false,
  contextCardTitle: '',
  contextCardContent: '',
  contextCardStyle: 'PARAGRAPH_STYLE',
  questions: [
    { id: genId(), type: 'EMAIL', label: 'Email', key: 'email', required: true },
    { id: genId(), type: 'FULL_NAME', label: 'Full Name', key: 'full_name', required: true },
  ],
  thankYouTitle: 'Thank you!',
  thankYouBody: 'We\'ll be in touch soon.',
  thankYouWebsiteUrl: '',
  thankYouCtaTitle: 'Visit Website',
  thankYouCtaType: 'VIEW_WEBSITE',
  trackingParams: [],
  followUpActionUrl: '',
  locale: 'en_US',
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  accessToken: string;
  pageId: string;
  pageName?: string;
  onCreated: (form: { id: string; name: string }) => void;
  onClose: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LeadGenFormBuilder({ accessToken, pageId, pageName, onCreated, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>({ ...DEFAULT_FORM });
  const [previewOpen, setPreviewOpen] = useState(false);

  const createMut = trpc.adminMeta.createLeadGenForm.useMutation();
  const isLoading = createMut.isPending;

  const updateData = (patch: Partial<FormData>) => setData(d => ({ ...d, ...patch }));

  const addQuestion = (type: string, label: string, key?: string) => {
    const q: FormQuestion = { id: genId(), type, label, key, required: type !== 'CUSTOM' && type !== 'MULTIPLE_CHOICE', options: type === 'MULTIPLE_CHOICE' ? [{ value: '' }] : undefined };
    updateData({ questions: [...data.questions, q] });
  };

  const updateQuestion = (id: string, patch: Partial<FormQuestion>) => {
    updateData({ questions: data.questions.map(q => q.id === id ? { ...q, ...patch } : q) });
  };

  const removeQuestion = (id: string) => {
    updateData({ questions: data.questions.filter(q => q.id !== id) });
  };

  const handleCreate = async () => {
    if (!data.name.trim()) { toast.error('Form name is required'); return; }
    if (data.questions.length === 0) { toast.error('Add at least one question'); return; }

    try {
      const result = await createMut.mutateAsync({
        accessToken,
        pageId,
        name: data.name,
        formType: data.formType,
        privacyPolicyUrl: data.privacyPolicyEnabled && data.privacyPolicyUrl ? data.privacyPolicyUrl : undefined,
        privacyPolicyLinkText: data.privacyPolicyEnabled ? data.privacyPolicyLinkText : undefined,
        thankYouPage: {
          title: data.thankYouTitle || undefined,
          body: data.thankYouBody || undefined,
          websiteUrl: data.thankYouWebsiteUrl || undefined,
          ctaTitle: data.thankYouCtaTitle || undefined,
          ctaType: data.thankYouCtaType || undefined,
        },
        questions: data.questions.map(q => ({
          type: q.type,
          label: q.label || undefined,
          key: q.key || undefined,
          options: q.options?.filter(o => o.value.trim()).map(o => ({ value: o.value, key: o.key || undefined })),
        })),
        contextCard: data.contextCardEnabled ? {
          title: data.contextCardTitle || undefined,
          content: data.contextCardContent || undefined,
          style: data.contextCardStyle,
        } : undefined,
        locale: data.locale || undefined,
        trackingParameters: data.trackingParams.filter(p => p.key && p.value),
        followUpActionUrl: data.followUpActionUrl || undefined,
      });
      toast.success(`Lead gen form "${result.name}" created (ID: ${result.formId})`);
      onCreated({ id: result.formId, name: result.name });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to create form: ${msg}`);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,12,54,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 900, maxHeight: '92vh', background: T.modalSurface, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: `0 32px 80px rgba(0,190,239,0.1)` }}>

        {/* Header */}
        <div style={{ height: 56, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.pink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} color={T.white} />
            </div>
            <div>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em' }}>Lead Gen Form Builder</span>
              {pageName && <span style={{ fontSize: 11, color: T.muted, marginLeft: 10 }}>Page: {pageName}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setPreviewOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: previewOpen ? T.activeState : 'transparent', color: previewOpen ? T.cyan : T.muted, border: `1.5px solid ${previewOpen ? T.cyan : T.border}`, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
              <Eye size={13} /> Preview
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 6 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Step nav */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0, overflowX: 'auto' }}>
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => setStep(s.id)} style={{
              padding: '10px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: 'transparent', border: 'none', borderBottom: `2.5px solid ${step === s.id ? T.cyan : 'transparent'}`,
              color: step === s.id ? T.cyan : step > s.id ? T.muted : T.hint,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: step > s.id ? T.green : step === s.id ? T.cyan : T.border, color: step > s.id || step === s.id ? T.pageBg : T.hint, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {step > s.id ? <Check size={10} /> : s.id}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: 0 }}>
          {/* Main form area */}
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>

            {/* Step 1: Form Type */}
            {step === 1 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: '0 0 4px' }}>Form Type</h3>
                  <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Configure the basic settings for your instant form.</p>
                </div>
                <Section title="Form Name & Type">
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel>Form Name *</FieldLabel>
                    <TextInput value={data.name} onChange={v => updateData({ name: v })} placeholder="e.g. Spring Campaign Lead Form" maxLength={100} />
                  </div>
                  <div>
                    <FieldLabel hint="Choose how you want to collect leads.">Form Type</FieldLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { value: 'MORE_VOLUME' as const, label: 'More Volume', desc: 'Optimized to reach more people and generate more leads quickly.' },
                        { value: 'HIGHER_INTENT' as const, label: 'Higher Intent', desc: 'Adds a review step so leads can confirm their info before submitting.' },
                        { value: 'RICH_CREATIVE' as const, label: 'Rich Creative', desc: 'Integrates your company\'s images and messaging — About Us, product details, and reviews.' },
                      ].map(ft => (
                        <label key={ft.value} onClick={() => updateData({ formType: ft.value })} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${data.formType === ft.value ? T.cyan : T.border}`, background: data.formType === ft.value ? T.activeState : T.pageBg, transition: 'all 0.15s' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${data.formType === ft.value ? T.cyan : T.border}`, background: data.formType === ft.value ? T.cyan : 'transparent', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {data.formType === ft.value && <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.pageBg }} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: data.formType === ft.value ? T.cyan : T.ink }}>{ft.label}</div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.45 }}>{ft.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </Section>
                <Section title="Locale" defaultOpen={false}>
                  <FieldLabel>Form Language</FieldLabel>
                  <SelectInput value={data.locale} onChange={v => updateData({ locale: v })} options={LOCALES} />
                </Section>
              </div>
            )}

            {/* Step 2: Intro / Context Card */}
            {step === 2 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: '0 0 4px' }}>Intro</h3>
                  <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Add a context card to introduce your form before questions appear.</p>
                </div>
                <Section title="Context Card">
                  <div style={{ marginBottom: 14 }}>
                    <Toggle value={data.contextCardEnabled} onChange={v => updateData({ contextCardEnabled: v })} label="Enable intro context card" />
                  </div>
                  {data.contextCardEnabled && (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel optional>Title</FieldLabel>
                        <TextInput value={data.contextCardTitle} onChange={v => updateData({ contextCardTitle: v })} placeholder="e.g. Why Sign Up?" maxLength={60} />
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel>Content Style</FieldLabel>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[{ value: 'PARAGRAPH_STYLE' as const, label: 'Paragraph' }, { value: 'LIST_STYLE' as const, label: 'Bullet List' }].map(s => (
                            <button key={s.value} onClick={() => updateData({ contextCardStyle: s.value })} style={{
                              flex: 1, padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${data.contextCardStyle === s.value ? T.cyan : T.border}`,
                              background: data.contextCardStyle === s.value ? T.activeState : T.pageBg, color: data.contextCardStyle === s.value ? T.cyan : T.ink,
                              fontSize: 12, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s',
                            }}>{s.label}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <FieldLabel>Content</FieldLabel>
                        <TextareaInput value={data.contextCardContent} onChange={v => updateData({ contextCardContent: v })} placeholder="Describe the benefits of signing up..." maxLength={500} rows={4} />
                      </div>
                    </>
                  )}
                </Section>
              </div>
            )}

            {/* Step 3: Questions */}
            {step === 3 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: '0 0 4px' }}>Questions</h3>
                  <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Build your question list. Contact info fields are pre-filled from Facebook profiles.</p>
                </div>

                {/* Current questions */}
                {data.questions.map((q, qi) => (
                  <div key={q.id} style={{ padding: 14, border: `1.5px solid ${T.border}`, borderRadius: 10, marginBottom: 10, background: T.cardSurface }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: T.cyan, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Q{qi + 1}</span>
                        <span style={{ fontSize: 11, color: T.muted }}>{q.type}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                          <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} style={{ accentColor: T.cyan }} />
                          <span style={{ fontSize: 10, color: T.muted }}>Required</span>
                        </label>
                        {data.questions.length > 1 && (
                          <button onClick={() => removeQuestion(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 4, transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = T.pink)}
                            onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <FieldLabel>Label</FieldLabel>
                      <TextInput value={q.label} onChange={v => updateQuestion(q.id, { label: v })} placeholder="Question label..." maxLength={80} />
                    </div>
                    {(q.type === 'CUSTOM' || q.type === 'MULTIPLE_CHOICE' || q.type === 'CONDITIONAL') && (
                      <div style={{ marginBottom: 10 }}>
                        <FieldLabel optional>Key (for tracking)</FieldLabel>
                        <TextInput value={q.key || ''} onChange={v => updateQuestion(q.id, { key: v })} placeholder="e.g. custom_question_1" />
                      </div>
                    )}
                    {q.type === 'MULTIPLE_CHOICE' && (
                      <div>
                        <FieldLabel>Answer Options</FieldLabel>
                        {(q.options || []).map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: T.cyan, minWidth: 14, fontWeight: 700 }}>•</span>
                            <div style={{ flex: 1 }}>
                              <TextInput value={opt.value} onChange={v => {
                                const opts = [...(q.options || [])];
                                opts[oi] = { ...opts[oi], value: v };
                                updateQuestion(q.id, { options: opts });
                              }} placeholder={`Option ${oi + 1}`} maxLength={80} />
                            </div>
                            {(q.options || []).length > 1 && (
                              <button onClick={() => updateQuestion(q.id, { options: (q.options || []).filter((_, j) => j !== oi) })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 4 }}>
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                        {(q.options || []).length < 10 && (
                          <button onClick={() => updateQuestion(q.id, { options: [...(q.options || []), { value: '' }] })}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: T.cardSurface, color: T.cyan, border: `1.5px dashed ${T.cyan}`, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center', marginTop: 4 }}>
                            <Plus size={11} /> Add Option
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add question buttons */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Add Contact Info Field</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {CONTACT_QUESTION_TYPES.map(t => {
                      const alreadyAdded = data.questions.some(q => q.type === t.value);
                      return (
                        <button key={t.value} onClick={() => !alreadyAdded && addQuestion(t.value, t.label, t.key)} disabled={alreadyAdded}
                          style={{ padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: alreadyAdded ? 'not-allowed' : 'pointer', transition: 'all 0.15s', background: alreadyAdded ? T.activeState : T.cardSurface, color: alreadyAdded ? T.cyan : T.ink, border: `1px solid ${alreadyAdded ? T.cyan : T.border}`, opacity: alreadyAdded ? 0.6 : 1 }}>
                          {alreadyAdded ? <Check size={9} style={{ display: 'inline', marginRight: 3 }} /> : null}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Add Custom Question</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {CUSTOM_QUESTION_TYPES.map(t => (
                      <button key={t.value} onClick={() => addQuestion(t.value, t.label)}
                        style={{ padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: T.cardSurface, color: T.ink, border: `1px solid ${T.border}` }}>
                        <Plus size={9} style={{ display: 'inline', marginRight: 3 }} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Privacy & Review */}
            {step === 4 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: '0 0 4px' }}>Privacy & Review</h3>
                  <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Add a privacy policy link and configure the review step.</p>
                </div>
                <Section title="Privacy Policy">
                  <div style={{ marginBottom: 14 }}>
                    <Toggle value={data.privacyPolicyEnabled} onChange={v => updateData({ privacyPolicyEnabled: v })} label="Include privacy policy link" />
                  </div>
                  {data.privacyPolicyEnabled && (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel>Privacy Policy URL *</FieldLabel>
                        <TextInput value={data.privacyPolicyUrl} onChange={v => updateData({ privacyPolicyUrl: v })} placeholder="https://yoursite.com/privacy" />
                      </div>
                      <div>
                        <FieldLabel optional>Link Text</FieldLabel>
                        <TextInput value={data.privacyPolicyLinkText} onChange={v => updateData({ privacyPolicyLinkText: v })} placeholder="Privacy Policy" maxLength={50} />
                      </div>
                    </>
                  )}
                </Section>
                <Section title="Review Step" defaultOpen={false}>
                  <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, margin: 0 }}>
                    {data.formType === 'HIGHER_INTENT'
                      ? '✓ Higher Intent forms automatically include a review step where leads confirm their information before submitting.'
                      : 'The review step is only available for Higher Intent form type. Switch to Higher Intent in Step 1 to enable it.'}
                  </p>
                </Section>
              </div>
            )}

            {/* Step 5: Thank You Page */}
            {step === 5 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: '0 0 4px' }}>Thank You Page</h3>
                  <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Configure what people see after submitting the form.</p>
                </div>
                <Section title="Thank You Message">
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel optional>Headline</FieldLabel>
                    <TextInput value={data.thankYouTitle} onChange={v => updateData({ thankYouTitle: v })} placeholder="Thank you!" maxLength={60} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel optional>Body Text</FieldLabel>
                    <TextareaInput value={data.thankYouBody} onChange={v => updateData({ thankYouBody: v })} placeholder="We'll be in touch soon." maxLength={200} rows={3} />
                  </div>
                </Section>
                <Section title="Call to Action" defaultOpen={false}>
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel optional>Website URL</FieldLabel>
                    <TextInput value={data.thankYouWebsiteUrl} onChange={v => updateData({ thankYouWebsiteUrl: v })} placeholder="https://yoursite.com" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel optional>CTA Button Type</FieldLabel>
                    <SelectInput value={data.thankYouCtaType} onChange={v => updateData({ thankYouCtaType: v })} options={CTA_TYPES} />
                  </div>
                  <div>
                    <FieldLabel optional>CTA Button Text</FieldLabel>
                    <TextInput value={data.thankYouCtaTitle} onChange={v => updateData({ thankYouCtaTitle: v })} placeholder="Visit Website" maxLength={25} />
                  </div>
                </Section>
              </div>
            )}

            {/* Step 6: Settings */}
            {step === 6 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: '0 0 4px' }}>Settings</h3>
                  <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Configure tracking parameters and follow-up actions.</p>
                </div>
                <Section title="Tracking Parameters">
                  <p style={{ fontSize: 11, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
                    Add custom parameters to track where your leads come from. These are passed along with each lead submission.
                  </p>
                  {data.trackingParams.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <TextInput value={p.key} onChange={v => { const tp = [...data.trackingParams]; tp[i] = { ...tp[i], key: v }; updateData({ trackingParams: tp }); }} placeholder="Key (e.g. campaign)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <TextInput value={p.value} onChange={v => { const tp = [...data.trackingParams]; tp[i] = { ...tp[i], value: v }; updateData({ trackingParams: tp }); }} placeholder="Value (e.g. spring_2025)" />
                      </div>
                      <button onClick={() => updateData({ trackingParams: data.trackingParams.filter((_, j) => j !== i) })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => updateData({ trackingParams: [...data.trackingParams, { key: '', value: '' }] })}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.cardSurface, color: T.cyan, border: `1.5px dashed ${T.cyan}`, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center', marginTop: 4 }}>
                    <Plus size={12} /> Add Parameter
                  </button>
                </Section>
                <Section title="Follow-Up Action" defaultOpen={false}>
                  <FieldLabel optional>Follow-Up URL</FieldLabel>
                  <p style={{ fontSize: 11, color: T.muted, marginBottom: 8, lineHeight: 1.5 }}>Redirect users to this URL after form submission (optional).</p>
                  <TextInput value={data.followUpActionUrl} onChange={v => updateData({ followUpActionUrl: v })} placeholder="https://yoursite.com/thank-you" />
                </Section>

                {/* Summary */}
                <Section title="Form Summary">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Form Name', value: data.name || '—' },
                      { label: 'Form Type', value: data.formType },
                      { label: 'Questions', value: `${data.questions.length} question${data.questions.length !== 1 ? 's' : ''}` },
                      { label: 'Privacy Policy', value: data.privacyPolicyEnabled ? '✓ Included' : '— Not included' },
                      { label: 'Context Card', value: data.contextCardEnabled ? '✓ Enabled' : '— Disabled' },
                      { label: 'Locale', value: LOCALES.find(l => l.value === data.locale)?.label || data.locale },
                    ].map(item => (
                      <div key={item.label} style={{ padding: '10px 12px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}
          </div>

          {/* Preview panel */}
          {previewOpen && (
            <div style={{ width: 220, flexShrink: 0, borderLeft: `1.5px solid ${T.border}`, background: T.pageBg, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={12} style={{ color: T.pink }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: T.pink, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Preview</span>
              </div>
              {/* Phone shell */}
              <div style={{ width: 184, background: '#0a0920', borderRadius: 30, padding: '10px 5px 14px', boxShadow: `0 16px 48px rgba(20,19,73,0.35)`, margin: '0 auto' }}>
                <div style={{ width: 56, height: 6, background: '#0a0920', borderRadius: 10, margin: '0 auto 8px' }} />
                <div style={{ borderRadius: 20, overflow: 'hidden', background: T.white, height: 360, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 20, background: '#141349', display: 'flex', alignItems: 'center', padding: '0 10px' }}>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>9:41</span>
                  </div>
                  <div style={{ background: '#141349', padding: '8px 10px 10px' }}>
                    <span style={{ fontSize: 9, color: T.white, fontWeight: 700, opacity: 0.9 }}>{data.name || 'Your Form'}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
                    {data.contextCardEnabled && data.contextCardTitle && (
                      <div style={{ marginBottom: 10, padding: '8px 9px', background: '#f0f4ff', borderRadius: 6, borderLeft: `3px solid #141349` }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#141349', marginBottom: 3 }}>{data.contextCardTitle}</div>
                        <div style={{ fontSize: 8, color: '#6b6b8f', lineHeight: 1.4 }}>{data.contextCardContent || 'Context card content...'}</div>
                      </div>
                    )}
                    {data.questions.slice(0, 5).map((q, i) => (
                      <div key={q.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#141349', fontWeight: 700, marginBottom: 3, display: 'flex', gap: 2 }}>
                          {q.label || q.type}{q.required && <span style={{ color: T.pink }}>*</span>}
                        </div>
                        <div style={{ height: 22, border: '1px solid #e6e6ee', borderRadius: 5, background: '#fafafa', fontSize: 8, color: '#8a8aa3', padding: '0 8px', display: 'flex', alignItems: 'center', fontStyle: 'italic' }}>
                          {q.type === 'MULTIPLE_CHOICE' ? 'Select an option...' : 'Enter your answer...'}
                        </div>
                      </div>
                    ))}
                    {data.questions.length > 5 && (
                      <div style={{ fontSize: 8, color: '#8a8aa3', fontStyle: 'italic', textAlign: 'center' }}>+{data.questions.length - 5} more questions</div>
                    )}
                    <div style={{ marginTop: 12, padding: '7px 0', background: T.pink, borderRadius: 6, textAlign: 'center' }}>
                      <span style={{ fontSize: 10, color: T.white, fontWeight: 800 }}>Submit</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: T.hint, textAlign: 'center', lineHeight: 1.4 }}>
                Preview shows form structure. Actual appearance may vary.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: `2px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', color: T.ink, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', color: T.muted, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <ArrowLeft size={13} /> Back
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: T.muted }}>Step {step} of {STEPS.length}</span>
            {step < STEPS.length ? (
              <button onClick={() => setStep(s => s + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: T.activeState, color: T.cyan, border: `1.5px solid ${T.cyan}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Next <ArrowRight size={13} />
              </button>
            ) : (
              <button onClick={handleCreate} disabled={isLoading || !data.name.trim()} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px',
                background: isLoading || !data.name.trim() ? T.border : T.pink,
                color: isLoading || !data.name.trim() ? T.hint : T.white,
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: isLoading || !data.name.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !data.name.trim() ? 0.6 : 1,
              }}>
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {isLoading ? 'Creating Form...' : 'Create Lead Gen Form'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
