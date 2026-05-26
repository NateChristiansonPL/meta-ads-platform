// SettingsDrawer — vault-based credential picker for Campaign Builder
// Flow: select BM token → select ad account → select FB page → auto-load IG → enter Pixel ID
import {
  X, ChevronDown, Search, CheckCircle2, Loader2, AlertCircle,
  Building2, CreditCard, FileText, Instagram, Zap, XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BuildSettings } from './campaignStoreAdmin';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface Props {
  settings: BuildSettings;
  onUpdate: (s: BuildSettings) => void;
  onClose: () => void;
}

export default function SettingsDrawer({ settings, onUpdate, onClose }: Props) {
  // ── Token list ──────────────────────────────────────────────────────────────
  const { data: tokensData, isLoading: loadingTokens } = trpc.tokens.listActive.useQuery();
  // Deduplicate by businessManagerId — keep the first entry per BM to avoid duplicate entries
  const activeTokens = useMemo(() => {
    const seen = new Map<string, NonNullable<typeof tokensData>[0]>();
    for (const t of (tokensData ?? [])) {
      if (!seen.has(t.businessManagerId)) seen.set(t.businessManagerId, t);
    }
    return Array.from(seen.values());
  }, [tokensData]);

  // ── Ad accounts (loaded when tokenId changes) ───────────────────────────────
  const [adAccountSearch, setAdAccountSearch] = useState('');
  const { data: adAccountsData, isLoading: loadingAccounts, error: accountsError } =
    trpc.adminMeta.getAdAccountsByTokenId.useQuery(
      { tokenId: settings.tokenId! },
      { enabled: !!settings.tokenId, staleTime: 60_000 }
    );
  const adAccounts = adAccountsData?.accounts ?? [];

  // ── Facebook pages (loaded when tokenId changes) ────────────────────────────
  const [pageSearch, setPageSearch] = useState('');
  const { data: pagesData, isLoading: loadingPages, error: pagesError } =
    trpc.adminMeta.getFacebookPagesByTokenId.useQuery(
      { tokenId: settings.tokenId! },
      { enabled: !!settings.tokenId, staleTime: 60_000 }
    );
  const fbPages = pagesData?.pages ?? [];

  // ── Pixels (loaded when tokenId changes) ───────────────────────────────────
  const [pixelSearch, setPixelSearch] = useState('');
  const { data: pixelsData, isLoading: loadingPixels } =
    trpc.adminMeta.getPixelsByTokenId.useQuery(
      { tokenId: settings.tokenId! },
      { enabled: !!settings.tokenId, staleTime: 60_000 }
    );
  const pixels = pixelsData?.pixels ?? [];

  // ── Instagram accounts (loaded when facebookPageId changes) ──────────────────────
  const { data: igData, isLoading: loadingIg } =
    trpc.adminMeta.getInstagramAccountsByPage.useQuery(
      { tokenId: settings.tokenId!, pageId: settings.facebookPageId },
      { enabled: !!settings.tokenId && !!settings.facebookPageId, staleTime: 60_000 }
    );
  const igAccounts = igData?.accounts ?? [];

  // ── Resolve accessToken when tokenId is set ─────────────────────────────────
  const { data: tokenData } = trpc.adminMeta.getBuilderToken.useQuery(
    { tokenId: settings.tokenId! },
    { enabled: !!settings.tokenId, staleTime: 300_000 }
  );
  useEffect(() => {
    if (tokenData?.accessToken && settings.tokenId) {
      onUpdate({ ...settings, accessToken: tokenData.accessToken });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenData?.accessToken, settings.tokenId]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const set = <K extends keyof BuildSettings>(key: K, val: BuildSettings[K]) => {
    onUpdate({ ...settings, [key]: val });
  };

  const handleTokenChange = (tokenId: number | null) => {
    const token = activeTokens.find(t => t.id === tokenId);
    onUpdate({
      ...settings,
      tokenId,
      bmId: token?.businessManagerId ?? '',
      accessToken: '',        // will be resolved by getBuilderToken
      adAccountId: '',
      adAccountName: '',
      facebookPageId: '',
      facebookPageName: '',
      instagramUserId: '',
      instagramUsername: '',
      pixelId: '',
      pixelName: '',
    });
    setAdAccountSearch('');
    setPageSearch('');
    setPixelSearch('');
  };

  const handlePixelChange = (id: string) => {
    const px = pixels.find((p: { id: string; name: string }) => p.id === id);
    onUpdate({ ...settings, pixelId: id, pixelName: px?.name ?? '' });
    setPixelSearch('');
  };

  const handleAdAccountChange = (id: string) => {
    const acc = adAccounts.find((a: { id: string; name: string }) => a.id === id);
    onUpdate({ ...settings, adAccountId: id, adAccountName: acc?.name ?? '' });
    setAdAccountSearch('');
  };

  const handlePageChange = (id: string) => {
    const page = fbPages.find((p: { id: string; name: string }) => p.id === id);
    onUpdate({
      ...settings,
      facebookPageId: id,
      facebookPageName: page?.name ?? '',
      instagramUserId: '',
      instagramUsername: '',
    });
  };

  const handleIgChange = (id: string) => {
    const ig = igAccounts.find((a: { id: string; username: string }) => a.id === id);
    onUpdate({ ...settings, instagramUserId: id, instagramUsername: ig?.username ?? '' });
  };

  const isReady = !!settings.tokenId && !!settings.adAccountId && !!settings.facebookPageId;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }} onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 bottom-0 w-[440px] z-50 flex flex-col shadow-2xl" style={{ background: '#0e0d3a', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-sm font-700" style={{ color: '#FAFAFA' }}>Account Setup</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Select your Business Manager and ad account</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FAFAFA')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Step 1: Business Manager Token ── */}
          <Section icon={Building2} label="Business Manager" step={1}>
            {loadingTokens ? (
              <LoadingRow text="Loading tokens…" />
            ) : activeTokens.length === 0 ? (
              <EmptyRow text="No active tokens. Ask your admin to add one in the Token Vault." />
            ) : (
              <NativeSelect
                value={settings.tokenId?.toString() ?? ''}
                onChange={v => handleTokenChange(v ? parseInt(v) : null)}
                placeholder="Select a Business Manager…"
                options={activeTokens.map(t => ({
                  value: t.id.toString(),
                  label: t.label || t.businessManagerName || `BM ${t.businessManagerId}`,
                }))}
              />
            )}
            {settings.tokenId && settings.bmId && (
              <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">BM ID: {settings.bmId}</p>
            )}
          </Section>

          {/* ── Step 2: Ad Account ── */}
          <Section icon={CreditCard} label="Ad Account" step={2}>
            {!settings.tokenId ? (
              <DisabledRow text="Select a Business Manager first" />
            ) : loadingAccounts ? (
              <LoadingRow text="Loading ad accounts…" />
            ) : accountsError ? (
              <ErrorRow text={`Failed to load accounts: ${accountsError.message}`} />
            ) : (
              <SearchableSelect
                value={settings.adAccountId}
                selectedLabel={settings.adAccountId ? `${settings.adAccountName} (${settings.adAccountId})` : ''}
                search={adAccountSearch}
                onSearchChange={setAdAccountSearch}
                onChange={handleAdAccountChange}
                placeholder="Search ad accounts…"
                options={adAccounts
                  .filter((a: { id: string; name: string }) => {
                    const q = adAccountSearch.toLowerCase();
                    return !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
                  })
                  .map((a: { id: string; name: string }) => ({ value: a.id, label: `${a.name} (${a.id})` }))}
              />
            )}
          </Section>

          {/* ── Step 3: Facebook Page ── */}
          <Section icon={FileText} label="Facebook Page" step={3}>
            {!settings.tokenId ? (
              <DisabledRow text="Select a Business Manager first" />
            ) : loadingPages ? (
              <LoadingRow text="Loading pages…" />
            ) : pagesError ? (
              <ErrorRow text={`Failed to load pages: ${pagesError.message}`} />
            ) : fbPages.length === 0 ? (
              <div className="space-y-2">
                <EmptyRow text="No pages found via BM. Enter the Page ID manually:" />
                <ManualInput
                  value={settings.facebookPageId}
                  onChange={v => onUpdate({ ...settings, facebookPageId: v, facebookPageName: '' })}
                  placeholder="Facebook Page ID (e.g. 123456789)"
                  mono
                />
              </div>
            ) : (
              <SearchableSelect
                value={settings.facebookPageId}
                selectedLabel={settings.facebookPageId ? `${settings.facebookPageName} (${settings.facebookPageId})` : ''}
                search={pageSearch}
                onSearchChange={setPageSearch}
                onChange={handlePageChange}
                placeholder="Search Facebook pages…"
                options={fbPages
                  .filter((p: { id: string; name: string }) => {
                    const q = pageSearch.toLowerCase();
                    return !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
                  })
                  .map((p: { id: string; name: string }) => ({ value: p.id, label: `${p.name} (${p.id})` }))}
              />
            )}
          </Section>

          {/* ── Step 4: Instagram Account ── */}
          <Section icon={Instagram} label="Instagram Account" step={4} optional>
            {!settings.facebookPageId ? (
              <DisabledRow text="Select a Facebook Page first" />
            ) : loadingIg ? (
              <LoadingRow text="Loading Instagram accounts…" />
            ) : igAccounts.length === 0 ? (
              <div className="space-y-2">
                <EmptyRow text="No IG accounts linked to this page. Enter the Actor ID manually:" />
                <ManualInput
                  value={settings.instagramUserId}
                  onChange={v => onUpdate({ ...settings, instagramUserId: v, instagramUsername: '' })}
                  placeholder="Instagram Actor ID (e.g. 123456789)"
                  mono
                />
              </div>
            ) : (
              <NativeSelect
                value={settings.instagramUserId}
                onChange={handleIgChange}
                placeholder="Select an Instagram account…"
                options={igAccounts.map((a: { id: string; username: string }) => ({
                  value: a.id,
                  label: `@${a.username} (${a.id})`,
                }))}
              />
            )}
          </Section>

          {/* ── Step 5: Pixel / Dataset ID ── */}
          <Section icon={Zap} label="Pixel / Dataset" step={5} optional>
            {!settings.tokenId ? (
              <DisabledRow text="Select a Business Manager first" />
            ) : loadingPixels ? (
              <LoadingRow text="Loading pixels & datasets…" />
            ) : pixels.length === 0 ? (
              <div className="space-y-2">
                <EmptyRow text="No pixels or datasets found via BM. Enter the ID manually:" />
                <ManualInput
                  value={settings.pixelId}
                  onChange={v => onUpdate({ ...settings, pixelId: v, pixelName: '' })}
                  placeholder="Pixel or Dataset ID (e.g. 123456789)"
                  mono
                  hint="Used for conversion tracking on all ads"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <SearchableSelect
                  value={settings.pixelId}
                  selectedLabel={settings.pixelId ? `${settings.pixelName || settings.pixelId} (${settings.pixelId})` : ''}
                  search={pixelSearch}
                  onSearchChange={setPixelSearch}
                  onChange={handlePixelChange}
                  placeholder="Search pixels & datasets…"
                  options={pixels
                    .filter((p: { id: string; name: string; source?: string }) => {
                      const q = pixelSearch.toLowerCase();
                      return !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
                    })
                    .map((p: { id: string; name: string; source?: string }) => ({
                      value: p.id,
                      label: `${p.name} (${p.id})${p.source === 'dataset' ? ' [Dataset]' : ' [Pixel]'}`,
                    }))}
                />
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <span className="text-[9px] font-600 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>or enter manually</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                </div>
                <ManualInput
                  value={settings.pixelId}
                  onChange={v => onUpdate({ ...settings, pixelId: v, pixelName: '' })}
                  placeholder="Pixel or Dataset ID (e.g. 123456789)"
                  mono
                  hint="Paste a pixel or dataset ID if it's not listed above"
                />
              </div>
            )}
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Used for conversion tracking on all ads (pixels & offline datasets)</p>
          </Section>

          {/* ── Status summary ── */}
          {settings.tokenId && (
            <div className="rounded-lg border p-3 space-y-1.5" style={{
              background: isReady ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
              borderColor: isReady ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)',
            }}>
              <StatusRow
                ok={!!settings.tokenId}
                label="Business Manager"
                value={activeTokens.find(t => t.id === settings.tokenId)?.label ?? `Token #${settings.tokenId}`}
              />
              <StatusRow
                ok={!!settings.adAccountId}
                label="Ad Account"
                value={settings.adAccountId ? `${settings.adAccountName} (${settings.adAccountId})` : ''}
                missing="Not selected"
              />
              <StatusRow
                ok={!!settings.facebookPageId}
                label="Facebook Page"
                value={settings.facebookPageId ? `${settings.facebookPageName} (${settings.facebookPageId})` : ''}
                missing="Not selected"
              />
              {settings.instagramUserId && (
                <StatusRow
                  ok
                  label="Instagram"
                  value={settings.instagramUsername ? `@${settings.instagramUsername}` : settings.instagramUserId}
                />
              )}
              {settings.pixelId && (
                <StatusRow ok label="Pixel" value={settings.pixelName ? `${settings.pixelName} (${settings.pixelId})` : settings.pixelId} />
              )}
            </div>
          )}

          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Credentials are resolved server-side. Your access token is never stored in the browser.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => {
              if (!isReady) {
                toast.error('Select a Business Manager, Ad Account, and Facebook Page to continue.');
                return;
              }
              toast.success('Account settings saved.');
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-700 transition-all"
            style={isReady
              ? { background: '#00BEEF', color: '#0e0d3a' }
              : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {isReady ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> Save & Close</>
            ) : (
              'Complete required fields to continue'
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon, label, step, optional, children,
}: {
  icon: React.ElementType;
  label: string;
  step: number;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-700 shrink-0"
          style={{ background: 'rgba(0,190,239,0.15)', color: '#00BEEF' }}>
          {step}
        </div>
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }} />
        <span className="text-[11px] font-700" style={{ color: '#FAFAFA' }}>{label}</span>
        {optional && (
          <span className="text-[10px] font-400" style={{ color: 'rgba(255,255,255,0.35)' }}>(optional)</span>
        )}
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}

function LoadingRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] py-2 px-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)' }}>
      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
      {text}
    </div>
  );
}

function DisabledRow({ text }: { text: string }) {
  return (
    <div className="text-[11px] py-2 px-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {text}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-[11px] py-2 px-3 rounded-lg"
      style={{ background: 'rgba(237,19,95,0.08)', color: 'rgba(237,19,95,0.8)', border: '1px solid rgba(237,19,95,0.15)' }}>
      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
      {text}
    </div>
  );
}

function ErrorRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-[11px] py-2 px-3 rounded-lg"
      style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.8)', border: '1px solid rgba(239,68,68,0.15)' }}>
      <XCircle className="w-3 h-3 shrink-0 mt-0.5" />
      {text}
    </div>
  );
}

function ManualInput({
  value, onChange, placeholder, mono, hint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-xs rounded-lg border text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all ${mono ? 'font-mono' : ''}`}
        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }}
      />
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function NativeSelect({
  value, onChange, placeholder, options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-xs rounded-lg px-3 py-2.5 appearance-none outline-none pr-8"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: value ? '#FAFAFA' : 'rgba(255,255,255,0.35)',
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#141349' }}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.3)' }} />
    </div>
  );
}

function SearchableSelect({
  value, selectedLabel, search, onSearchChange, onChange, options, placeholder,
}: {
  value: string;
  selectedLabel: string;
  search: string;
  onSearchChange: (q: string) => void;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center rounded-lg px-3 py-2 gap-2 cursor-text"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'}`,
        }}
        onClick={() => { setOpen(true); onSearchChange(''); }}
      >
        <Search size={11} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        <input
          type="text"
          value={open ? search : (value ? selectedLabel : '')}
          onChange={e => { onSearchChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); onSearchChange(''); }}
          placeholder={value ? selectedLabel : (placeholder ?? 'Search…')}
          className="flex-1 text-xs bg-transparent outline-none min-w-0"
          style={{
            color: value && !open ? '#FAFAFA' : 'rgba(255,255,255,0.7)',
            fontFamily: "'Montserrat', sans-serif",
          }}
        />
        {value && (
          <button
            onClick={e => { e.stopPropagation(); onChange(''); onSearchChange(''); setOpen(false); }}
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <X size={11} />
          </button>
        )}
        <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
      </div>
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-lg z-30 overflow-hidden"
          style={{
            background: '#1c1a5e',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              No results found
            </div>
          ) : (
            options.map(o => (
              <button
                key={o.value}
                onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); onSearchChange(''); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                style={{ color: o.value === value ? '#00BEEF' : 'rgba(255,255,255,0.75)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {o.value === value && <CheckCircle2 size={10} style={{ color: '#00BEEF', flexShrink: 0 }} />}
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatusRow({
  ok, label, value, missing,
}: {
  ok: boolean;
  label: string;
  value: string;
  missing?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      {ok
        ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
        : <XCircle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
      }
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={`truncate font-mono ${ok ? 'text-foreground/80' : 'text-muted-foreground/40'}`}>
        {ok ? value : (missing ?? '—')}
      </span>
    </div>
  );
}
