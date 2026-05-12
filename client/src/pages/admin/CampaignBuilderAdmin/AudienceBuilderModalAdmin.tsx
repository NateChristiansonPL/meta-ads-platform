/**
 * AudienceBuilderModalAdmin
 * Full-featured Custom & Lookalike Audience builder modal.
 * Matches the dark builder aesthetic: pageBg #0d0c36, cyan #00BEEF accent.
 */

import { useState, useEffect } from 'react';
import { X, Users, Globe, Smartphone, FileText, Zap, ChevronDown, Plus, Check, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
};

type AudienceType = 'custom' | 'lookalike';
type CustomSubtype = 'WEBSITE' | 'ENGAGEMENT' | 'APP' | 'CUSTOM';
type EngagementType = 'PAGE' | 'INSTAGRAM_PROFILE' | 'VIDEO' | 'LEAD_FORM' | 'INSTANT_EXPERIENCE' | 'EVENTS' | 'SHOPPING';

interface Props {
  accessToken: string;
  adAccountId: string;
  pixelId?: string;
  facebookPageId?: string;
  onCreated: (audience: { id: string; name: string }) => void;
  onClose: () => void;
}

const ENGAGEMENT_SOURCES: { value: EngagementType; label: string; icon: React.ReactNode; description: string; needsPage: boolean; needsIG: boolean; needsCatalog: boolean }[] = [
  { value: 'PAGE', label: 'Facebook Page', icon: <Globe size={14} />, description: 'People who engaged with your Facebook Page', needsPage: true, needsIG: false, needsCatalog: false },
  { value: 'INSTAGRAM_PROFILE', label: 'Instagram Profile', icon: <Zap size={14} />, description: 'People who engaged with your Instagram profile', needsPage: false, needsIG: true, needsCatalog: false },
  { value: 'VIDEO', label: 'Video', icon: <FileText size={14} />, description: 'People who watched your videos', needsPage: true, needsIG: false, needsCatalog: false },
  { value: 'LEAD_FORM', label: 'Lead Form', icon: <FileText size={14} />, description: 'People who opened or submitted your lead forms', needsPage: true, needsIG: false, needsCatalog: false },
  { value: 'INSTANT_EXPERIENCE', label: 'Instant Experience', icon: <Smartphone size={14} />, description: 'People who opened your Instant Experiences', needsPage: true, needsIG: false, needsCatalog: false },
  { value: 'EVENTS', label: 'Facebook Events', icon: <Globe size={14} />, description: 'People who interacted with your Facebook Events', needsPage: true, needsIG: false, needsCatalog: false },
  { value: 'SHOPPING', label: 'Shopping', icon: <Globe size={14} />, description: 'People who interacted with your shop or catalog', needsPage: false, needsIG: false, needsCatalog: true },
];

const PAGE_ENGAGEMENT_ACTIONS = [
  { value: 'PAGE_ENGAGED', label: 'Everyone who engaged with your Page' },
  { value: 'PAGE_VISITED', label: 'Anyone who visited your Page' },
  { value: 'PAGE_LIKED', label: 'People who liked your Page' },
  { value: 'PAGE_MESSAGED', label: 'People who sent a message to your Page' },
  { value: 'PAGE_CTA_CLICKED', label: 'People who clicked any call-to-action button' },
  { value: 'PAGE_OR_POST_SAVE', label: 'People who saved your Page or any post' },
];

const IG_ENGAGEMENT_ACTIONS = [
  { value: 'IG_ACCOUNT_VISITED', label: 'Everyone who visited your profile' },
  { value: 'IG_ENGAGED_WITH_ANY_POST', label: 'People who engaged with any post or ad' },
  { value: 'IG_AD_SAVED', label: 'People who saved any post or ad' },
  { value: 'IG_MESSAGED', label: 'People who sent a message to your account' },
];

const LEAD_FORM_ACTIONS = [
  { value: 'LEAD_GENERATION_FORM_OPENED', label: 'People who opened the form' },
  { value: 'LEAD_GENERATION_FORM_SUBMITTED', label: 'People who submitted the form' },
];

const EVENT_ACTIONS = [
  { value: 'EVENT_RSVP', label: 'People who responded Going or Interested' },
  { value: 'EVENT_INTERESTED', label: 'People who responded Interested' },
  { value: 'EVENT_GOING', label: 'People who responded Going' },
  { value: 'EVENT_ENGAGED', label: 'People who engaged with the event' },
];

const SHOPPING_ACTIONS = [
  { value: 'IG_SHOPPING_PRODUCT_VIEWED', label: 'People who viewed products' },
  { value: 'IG_SHOPPING_PRODUCT_SAVED', label: 'People who saved products' },
  { value: 'IG_SHOPPING_CHECKOUT_INITIATED', label: 'People who initiated checkout' },
  { value: 'IG_SHOPPING_PURCHASED', label: 'People who purchased' },
];

const COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' }, { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' }, { code: 'ES', name: 'Spain' }, { code: 'NL', name: 'Netherlands' },
  { code: 'BR', name: 'Brazil' }, { code: 'MX', name: 'Mexico' }, { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' }, { code: 'IN', name: 'India' }, { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'ZA', name: 'South Africa' },
];

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</span>
      {hint && <span style={{ fontSize: 10, color: T.muted, marginLeft: 6 }}>{hint}</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
        background: T.cardSurface, color: T.ink, border: `1.5px solid ${T.border}`, outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s', boxSizing: 'border-box',
      }}
      onFocus={e => { e.target.style.borderColor = T.cyan; e.target.style.boxShadow = `0 0 0 3px rgba(0,190,239,0.15)`; }}
      onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
        background: T.cardSurface, color: T.ink, border: `1.5px solid ${T.border}`, outline: 'none',
        cursor: 'pointer', boxSizing: 'border-box',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value} style={{ background: T.cardSurface, color: T.ink }}>{o.label}</option>)}
    </select>
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

export default function AudienceBuilderModal({ accessToken, adAccountId, pixelId, facebookPageId, onCreated, onClose }: Props) {
  const [audienceType, setAudienceType] = useState<AudienceType>('custom');
  const [step, setStep] = useState(1);

  // Custom audience fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subtype, setSubtype] = useState<CustomSubtype>('WEBSITE');
  const [retentionDays, setRetentionDays] = useState(30);
  const [engagementType, setEngagementType] = useState<EngagementType>('PAGE');
  const [engagementAction, setEngagementAction] = useState('PAGE_ENGAGED');
  const [selectedPageId, setSelectedPageId] = useState(facebookPageId || '');
  const [selectedIGId, setSelectedIGId] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState('');

  // LAL fields
  const [lalSourceId, setLalSourceId] = useState('');
  const [lalSourceName, setLalSourceName] = useState('');
  const [lalCountry, setLalCountry] = useState('US');
  const [lalRatio, setLalRatio] = useState(0.01);

  // Data queries
  const { data: pagesData } = trpc.adminMeta.getAccessiblePages.useQuery(
    { accessToken },
    { enabled: !!accessToken, staleTime: 5 * 60 * 1000 }
  );
  const pages = pagesData?.pages ?? [];

  const { data: igData } = trpc.adminMeta.getPageInstagramAccounts.useQuery(
    { accessToken, pageId: selectedPageId },
    { enabled: !!accessToken && !!selectedPageId && engagementType === 'INSTAGRAM_PROFILE', staleTime: 5 * 60 * 1000 }
  );
  const igAccounts = igData?.accounts ?? [];

  const { data: eventsData } = trpc.adminMeta.getPageEvents.useQuery(
    { accessToken, pageId: selectedPageId },
    { enabled: !!accessToken && !!selectedPageId && engagementType === 'EVENTS', staleTime: 5 * 60 * 1000 }
  );
  const events = eventsData?.events ?? [];

  const { data: ieData } = trpc.adminMeta.getPageInstantExperiences.useQuery(
    { accessToken, pageId: selectedPageId },
    { enabled: !!accessToken && !!selectedPageId && engagementType === 'INSTANT_EXPERIENCE', staleTime: 5 * 60 * 1000 }
  );
  const instantExperiences = ieData?.experiences ?? [];

  const { data: catalogsData } = trpc.adminMeta.getAdAccountCatalogs.useQuery(
    { accessToken, adAccountId },
    { enabled: !!accessToken && !!adAccountId && engagementType === 'SHOPPING', staleTime: 5 * 60 * 1000 }
  );
  const catalogs = catalogsData?.catalogs ?? [];

  const { data: audiencesData } = trpc.adminMeta.getCustomAudiences.useQuery(
    { accessToken, adAccountId },
    { enabled: !!accessToken && !!adAccountId && audienceType === 'lookalike', staleTime: 5 * 60 * 1000 }
  );
  const existingAudiences = audiencesData?.audiences ?? [];

  const { data: leadFormsData } = trpc.adminMeta.getLeadGenForms.useQuery(
    { accessToken, pageId: selectedPageId },
    { enabled: !!accessToken && !!selectedPageId && engagementType === 'LEAD_FORM', staleTime: 5 * 60 * 1000 }
  );
  const leadForms = leadFormsData?.forms ?? [];

  // Set default page
  useEffect(() => {
    if (!selectedPageId && pages.length > 0) setSelectedPageId(pages[0].id);
  }, [pages, selectedPageId]);

  // Set default object ID based on engagement type
  useEffect(() => {
    if (engagementType === 'PAGE') setSelectedObjectId(selectedPageId);
    else if (engagementType === 'INSTAGRAM_PROFILE') setSelectedObjectId(selectedIGId || igAccounts[0]?.id || '');
    else if (engagementType === 'EVENTS') setSelectedObjectId(events[0]?.id || '');
    else if (engagementType === 'INSTANT_EXPERIENCE') setSelectedObjectId(instantExperiences[0]?.id || '');
    else if (engagementType === 'SHOPPING') setSelectedObjectId(catalogs[0]?.id || '');
    else if (engagementType === 'LEAD_FORM') setSelectedObjectId(leadForms[0]?.id || '');
    else if (engagementType === 'VIDEO') setSelectedObjectId(selectedPageId);
  }, [engagementType, selectedPageId, selectedIGId, igAccounts, events, instantExperiences, catalogs, leadForms]);

  const createCustomMut = trpc.adminMeta.createCustomAudience.useMutation();
  const createLALMut = trpc.adminMeta.createLookalikeAudience.useMutation();

  const isLoading = createCustomMut.isPending || createLALMut.isPending;

  const getEngagementActions = () => {
    switch (engagementType) {
      case 'PAGE': return PAGE_ENGAGEMENT_ACTIONS;
      case 'INSTAGRAM_PROFILE': return IG_ENGAGEMENT_ACTIONS;
      case 'LEAD_FORM': return LEAD_FORM_ACTIONS;
      case 'EVENTS': return EVENT_ACTIONS;
      case 'SHOPPING': return SHOPPING_ACTIONS;
      default: return PAGE_ENGAGEMENT_ACTIONS;
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Please enter an audience name'); return; }

    try {
      if (audienceType === 'lookalike') {
        if (!lalSourceId) { toast.error('Please select a source audience'); return; }
        const result = await createLALMut.mutateAsync({
          accessToken, adAccountId, name, description: description || undefined,
          originAudienceId: lalSourceId, country: lalCountry, ratio: lalRatio,
        });
        toast.success(`Lookalike audience "${result.name}" created (ID: ${result.audienceId})`);
        onCreated({ id: result.audienceId, name: result.name });
      } else {
        const result = await createCustomMut.mutateAsync({
          accessToken, adAccountId, name, description: description || undefined,
          subtype, retentionDays,
          pixelId: subtype === 'WEBSITE' ? pixelId : undefined,
          engagementType: subtype === 'ENGAGEMENT' ? engagementType : undefined,
          engagementAction: subtype === 'ENGAGEMENT' ? engagementAction : undefined,
          engagementObjectId: subtype === 'ENGAGEMENT' ? selectedObjectId : undefined,
        });
        toast.success(`Custom audience "${result.name}" created (ID: ${result.audienceId})`);
        onCreated({ id: result.audienceId, name: result.name });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to create audience: ${msg}`);
    }
  };

  const engagementSource = ENGAGEMENT_SOURCES.find(s => s.value === engagementType);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,12,54,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 780, maxHeight: '90vh', background: T.modalSurface, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: `0 32px 80px rgba(0,190,239,0.1)` }}>

        {/* Header */}
        <div style={{ height: 56, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color={T.pageBg} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em' }}>Audience Builder</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Type selector */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          {(['custom', 'lookalike'] as AudienceType[]).map(t => (
            <button key={t} onClick={() => setAudienceType(t)} style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              background: audienceType === t ? T.activeState : 'transparent',
              color: audienceType === t ? T.cyan : T.muted,
              border: `1.5px solid ${audienceType === t ? T.cyan : T.border}`,
            }}>
              {t === 'custom' ? 'Custom Audience' : 'Lookalike Audience (LAL)'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Audience Name & Description */}
          <Section title="Audience Details">
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Audience Name *</FieldLabel>
              <TextInput value={name} onChange={setName} placeholder="e.g. Website Visitors - 30 Days" maxLength={200} />
            </div>
            <div>
              <FieldLabel hint="optional">Description</FieldLabel>
              <TextInput value={description} onChange={setDescription} placeholder="Brief description of this audience..." maxLength={500} />
            </div>
          </Section>

          {audienceType === 'custom' && (
            <>
              {/* Audience Source */}
              <Section title="Audience Source">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    { value: 'WEBSITE' as CustomSubtype, label: 'Website', icon: <Globe size={14} />, desc: 'Pixel-based visitors' },
                    { value: 'ENGAGEMENT' as CustomSubtype, label: 'Engagement', icon: <Zap size={14} />, desc: 'Social interactions' },
                    { value: 'APP' as CustomSubtype, label: 'App Activity', icon: <Smartphone size={14} />, desc: 'Mobile app events' },
                    { value: 'CUSTOM' as CustomSubtype, label: 'Customer List', icon: <Users size={14} />, desc: 'Upload your list' },
                  ].map(s => (
                    <button key={s.value} onClick={() => setSubtype(s.value)} style={{
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      background: subtype === s.value ? T.activeState : T.cardSurface,
                      border: `1.5px solid ${subtype === s.value ? T.cyan : T.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: subtype === s.value ? T.cyan : T.muted }}>{s.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: subtype === s.value ? T.cyan : T.ink }}>{s.label}</span>
                        {subtype === s.value && <Check size={12} style={{ color: T.cyan, marginLeft: 'auto' }} />}
                      </div>
                      <div style={{ fontSize: 10, color: T.muted }}>{s.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Website source */}
                {subtype === 'WEBSITE' && (
                  <div>
                    {pixelId ? (
                      <div style={{ padding: '10px 14px', background: T.activeState, borderRadius: 8, border: `1px solid ${T.cyan}`, marginBottom: 14 }}>
                        <span style={{ fontSize: 11, color: T.cyan, fontWeight: 600 }}>✓ Using pixel: {pixelId}</span>
                      </div>
                    ) : (
                      <div style={{ padding: '10px 14px', background: 'rgba(237,19,95,0.1)', borderRadius: 8, border: '1px solid rgba(237,19,95,0.3)', marginBottom: 14 }}>
                        <span style={{ fontSize: 11, color: '#ed135f', fontWeight: 600 }}>⚠ No pixel configured in settings. Website audiences require a pixel ID.</span>
                      </div>
                    )}
                    <div>
                      <FieldLabel>Retention Window</FieldLabel>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="range" min={1} max={180} value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                          style={{ flex: 1, accentColor: T.cyan }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.cyan, minWidth: 60 }}>{retentionDays} days</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Engagement source */}
                {subtype === 'ENGAGEMENT' && (
                  <div>
                    <div style={{ marginBottom: 14 }}>
                      <FieldLabel>Engagement Source</FieldLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {ENGAGEMENT_SOURCES.map(s => (
                          <button key={s.value} onClick={() => { setEngagementType(s.value); setEngagementAction(getEngagementActions()[0]?.value || ''); }} style={{
                            padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                            background: engagementType === s.value ? T.activeState : T.pageBg,
                            border: `1.5px solid ${engagementType === s.value ? T.cyan : T.border}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ color: engagementType === s.value ? T.cyan : T.muted }}>{s.icon}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: engagementType === s.value ? T.cyan : T.ink }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: 9, color: T.muted, lineHeight: 1.3 }}>{s.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Page selector */}
                    {engagementSource?.needsPage && (
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel>Facebook Page</FieldLabel>
                        {pages.length > 0 ? (
                          <SelectInput value={selectedPageId} onChange={v => { setSelectedPageId(v); if (engagementType === 'PAGE') setSelectedObjectId(v); }}
                            options={pages.map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }))} />
                        ) : (
                          <div style={{ fontSize: 11, color: T.muted, padding: '8px 12px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            No pages found. Ensure your access token has page permissions.
                          </div>
                        )}
                      </div>
                    )}

                    {/* IG account selector */}
                    {engagementType === 'INSTAGRAM_PROFILE' && (
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel>Instagram Account</FieldLabel>
                        {igAccounts.length > 0 ? (
                          <SelectInput value={selectedObjectId} onChange={v => setSelectedObjectId(v)}
                            options={igAccounts.map((a: { id: string; username: string }) => ({ value: a.id, label: `@${a.username}` }))} />
                        ) : (
                          <div style={{ fontSize: 11, color: T.muted, padding: '8px 12px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            {selectedPageId ? 'No Instagram accounts connected to this page.' : 'Select a page first.'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Events selector */}
                    {engagementType === 'EVENTS' && (
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel>Facebook Event</FieldLabel>
                        {events.length > 0 ? (
                          <SelectInput value={selectedObjectId} onChange={setSelectedObjectId}
                            options={events.map((ev: { id: string; name: string }) => ({ value: ev.id, label: ev.name }))} />
                        ) : (
                          <div style={{ fontSize: 11, color: T.muted, padding: '8px 12px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            {selectedPageId ? 'No events found for this page.' : 'Select a page first.'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Instant Experience selector */}
                    {engagementType === 'INSTANT_EXPERIENCE' && (
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel>Instant Experience</FieldLabel>
                        {instantExperiences.length > 0 ? (
                          <SelectInput value={selectedObjectId} onChange={setSelectedObjectId}
                            options={instantExperiences.map((ie: { id: string; name: string }) => ({ value: ie.id, label: ie.name }))} />
                        ) : (
                          <div style={{ fontSize: 11, color: T.muted, padding: '8px 12px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            {selectedPageId ? 'No instant experiences found.' : 'Select a page first.'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Lead form selector */}
                    {engagementType === 'LEAD_FORM' && (
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel>Lead Form</FieldLabel>
                        {leadForms.length > 0 ? (
                          <SelectInput value={selectedObjectId} onChange={setSelectedObjectId}
                            options={leadForms.map(f => ({ value: f.id, label: f.name }))} />
                        ) : (
                          <div style={{ fontSize: 11, color: T.muted, padding: '8px 12px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            {selectedPageId ? 'No lead forms found for this page.' : 'Select a page first.'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Shopping catalog selector */}
                    {engagementType === 'SHOPPING' && (
                      <div style={{ marginBottom: 14 }}>
                        <FieldLabel>Product Catalog</FieldLabel>
                        {catalogs.length > 0 ? (
                          <SelectInput value={selectedObjectId} onChange={setSelectedObjectId}
                            options={catalogs.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))} />
                        ) : (
                          <div style={{ fontSize: 11, color: T.muted, padding: '8px 12px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            No product catalogs found for this ad account.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Engagement action */}
                    <div style={{ marginBottom: 14 }}>
                      <FieldLabel>Engagement Action</FieldLabel>
                      <SelectInput value={engagementAction} onChange={setEngagementAction}
                        options={getEngagementActions()} />
                    </div>

                    {/* Retention */}
                    <div>
                      <FieldLabel>Retention Window</FieldLabel>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="range" min={1} max={365} value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                          style={{ flex: 1, accentColor: T.cyan }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.cyan, minWidth: 60 }}>{retentionDays} days</span>
                      </div>
                    </div>
                  </div>
                )}

                {subtype === 'APP' && (
                  <div style={{ padding: '12px 14px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <p style={{ fontSize: 12, color: T.muted, margin: 0, lineHeight: 1.5 }}>
                      App activity audiences require an app registered in your Meta Business Manager. Configure the app ID and events in Meta Events Manager, then use the Meta Ads Manager to create app-based audiences directly.
                    </p>
                  </div>
                )}

                {subtype === 'CUSTOM' && (
                  <div style={{ padding: '12px 14px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <p style={{ fontSize: 12, color: T.muted, margin: 0, lineHeight: 1.5 }}>
                      Customer list audiences are created by uploading a CSV/TXT file of customer data (emails, phone numbers, etc.) directly in Meta Ads Manager. This builder will create an empty audience shell — upload your list in Meta Ads Manager after creation.
                    </p>
                  </div>
                )}
              </Section>
            </>
          )}

          {audienceType === 'lookalike' && (
            <Section title="Lookalike Configuration">
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Source Audience *</FieldLabel>
                <p style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Select an existing custom audience as the seed for your lookalike.</p>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 8, background: T.pageBg }}>
                  {existingAudiences.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: 11, color: T.muted, fontStyle: 'italic' }}>
                      No custom audiences found. Create a custom audience first.
                    </div>
                  ) : (
                    existingAudiences.filter((a: { subtype?: string }) => a.subtype !== 'LOOKALIKE').map((aud: { id: string; name: string; subtype?: string; approximateCount?: number }) => (
                      <button key={aud.id} onClick={() => { setLalSourceId(aud.id); setLalSourceName(aud.name); }} style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px', background: lalSourceId === aud.id ? T.activeState : 'transparent',
                        border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.15s',
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: lalSourceId === aud.id ? T.cyan : T.ink }}>{aud.name}</div>
                          <div style={{ fontSize: 10, color: T.muted }}>{aud.subtype} {aud.approximateCount ? `• ~${(aud.approximateCount / 1000).toFixed(0)}K` : ''}</div>
                        </div>
                        {lalSourceId === aud.id && <Check size={14} style={{ color: T.cyan, flexShrink: 0 }} />}
                      </button>
                    ))
                  )}
                </div>
                {lalSourceId && (
                  <div style={{ marginTop: 8, padding: '6px 12px', background: T.activeState, borderRadius: 6, border: `1px solid ${T.cyan}` }}>
                    <span style={{ fontSize: 11, color: T.cyan, fontWeight: 600 }}>✓ Source: {lalSourceName}</span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Target Country</FieldLabel>
                <SelectInput value={lalCountry} onChange={setLalCountry}
                  options={COUNTRIES.map(c => ({ value: c.code, label: `${c.name} (${c.code})` }))} />
              </div>

              <div>
                <FieldLabel>Audience Size</FieldLabel>
                <p style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
                  Percentage of the country's population. Smaller = more similar to source, larger = broader reach.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={1} max={20} step={1} value={Math.round(lalRatio * 100)} onChange={e => setLalRatio(Number(e.target.value) / 100)}
                    style={{ flex: 1, accentColor: T.cyan }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.cyan, minWidth: 50 }}>{Math.round(lalRatio * 100)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: T.hint }}>1% — Most Similar</span>
                  <span style={{ fontSize: 9, color: T.hint }}>20% — Broadest</span>
                </div>
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: `2px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'transparent', color: T.ink,
            border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            Cancel
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {name && (
              <span style={{ fontSize: 11, color: T.muted, fontStyle: 'italic' }}>
                Creating: "{name}"
              </span>
            )}
            <button onClick={handleCreate} disabled={isLoading || !name.trim()} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px',
              background: isLoading || !name.trim() ? T.border : T.cyan,
              color: isLoading || !name.trim() ? T.hint : T.pageBg,
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: isLoading || !name.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', opacity: isLoading || !name.trim() ? 0.6 : 1,
            }}>
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isLoading ? 'Creating...' : audienceType === 'lookalike' ? 'Create Lookalike' : 'Create Audience'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
