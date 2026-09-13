'use client';
import {useEffect, useState} from 'react';
import {csvCell, customerWhatsappUrl} from '@/lib/crm';

type LeadRow = {
  id: string;
  submission_id: string;
  deleted_at: string | null;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  primary_profile: string;
  status: string;
  whatsapp_consent: boolean;
  scores: Record<string, number>;
};

type PaymentRow = {
  id: string;
  submission_id: string;
  customer_name: string;
  email: string;
  phone: string;
  plan_type: 'plan' | 'consultation';
  plan: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  created_at: string;
  paid_at: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  razorpay_subscription_id: string | null;
};

type Summary = {
  total: number;
  new: number;
  reviewed: number;
  whatsapp: number;
  days: {label: string; count: number}[];
  profiles: {name: string; count: number}[];
  paidCustomers: number;
  pendingPayments: number;
  failedPayments: number;
  paidRevenue: number;
  conversion: number;
  planBreakdown: {
    plan: {paid: number; revenue: number};
    consultation: {paid: number; revenue: number};
  };
};

type View = 'overview' | 'leads' | 'customers' | 'recovery' | 'acquisition';

type LeadFilter = 'all' | 'new' | 'reviewed' | 'deleted';
type PaymentPlanFilter = 'all' | 'plan' | 'consultation';

const views: {id: View; icon: string; label: string; sub: string}[] = [
  {id: 'overview', icon: '▦', label: 'Overview', sub: 'Business performance at a glance'},
  {id: 'leads', icon: '◉', label: 'All users', sub: 'Everyone who submitted an assessment — paid and unpaid'},
  {id: 'customers', icon: '✓', label: 'Paid clients', sub: 'Successful purchases and client follow-up'},
  {id: 'recovery', icon: '↗', label: 'Recovery', sub: 'Follow-up and payment recovery'},
  {id: 'acquisition', icon: '⌁', label: 'Acquisition', sub: 'Sources and campaigns'}
];

const money = (value: number | null | undefined) => {
  const amount = Number(value || 0);
  return `₹${Math.round(amount / 100).toLocaleString('en-IN')}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {dateStyle: 'medium', timeZone: 'Asia/Kolkata'}).format(new Date(value));

const statusClass = (status: PaymentRow['status']) =>
  status === 'paid' ? 'green' : status === 'pending' ? 'amber' : 'red';

const formatPhone = (phone?: string) => String(phone || '').replace(/\D/g, '');

const paymentMessage = (planType: 'plan' | 'consultation', name: string) =>
  planType === 'plan'
    ? `Hi ${name}, this is Skin Quotient team. We received your payment for the Personalized Skin Plan. Let's get you started.`
    : `Hi ${name}, this is Skin Quotient team. We received your payment for your Skin Consultation. Let's schedule your consultation.`;

const whatsappUrlFor = (record: Pick<PaymentRow, 'phone' | 'customer_name' | 'plan_type'>) => {
  return customerWhatsappUrl(record.phone, paymentMessage(record.plan_type, record.customer_name || 'there'));
};

async function request(path: string, input?: unknown) {
  const res = await fetch('/api/' + path, {
    cache: 'no-store',
    ...(input === undefined
      ? {}
      : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)})
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to load records.');
  return data;
}

export default function Crm({email, onSignOut, canManageCustomers = false}: {email: string; onSignOut: () => Promise<void>; canManageCustomers?: boolean}) {
  const [view, setView] = useState<View>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [leadFilter, setLeadFilter] = useState<LeadFilter>('all');
  const [planFilter, setPlanFilter] = useState<PaymentPlanFilter>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  const [mutating, setMutating] = useState(false);
  const [notice, setNotice] = useState('');
  async function changeTrash(submissionId: string, name: string, deleted: boolean) {
    if (deleted && !window.confirm(`Move ${name} to Trash? This removes this assessment and its purchases from active client lists. Payment history is retained, and you can restore the client from All users → Trash.`)) return;
    setMutating(true); setError(''); setNotice('');
    try {
      await request('staff/customer-trash', {submissionId, deleted});
      setNotice(deleted ? `${name} moved to Trash.` : `${name} restored.`);
      setPage(0); setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update client.'); }
    finally { setMutating(false); }
  }

  const selected = views.find(v => v.id === view)!;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setBusy(true);
      setError('');
      setLeads([]);
      setPayments([]);

      try {
        if (view === 'overview' || view === 'leads') {
          const leadParams = new URLSearchParams({
            page: String(view === 'leads' ? page : 0),
            q: view === 'leads' ? search : '',
            status: view === 'leads' ? leadFilter : 'all'
          });

          const [summaryData, leadData] = await Promise.all([
            request('staff/summary'),
            request(`staff/assessments?${leadParams.toString()}`)
          ]);

          if (!active) return;
          setSummary(summaryData as Summary);
          setLeads((leadData.assessments as LeadRow[]) || []);
          setTotal(leadData.total || 0);
          return;
        }

        if (view === 'customers') {
          const paymentParams = new URLSearchParams({
            page: String(page),
            q: search,
            status: 'paid',
            plan: planFilter
          });

          const [summaryData, paymentData] = await Promise.all([
            request('staff/summary'),
            request(`staff/payments?${paymentParams.toString()}`)
          ]);

          if (!active) return;
          setSummary(summaryData as Summary);
          setPayments((paymentData.payments as PaymentRow[]) || []);
          setTotal(paymentData.total || 0);
          return;
        }

        const summaryData = await request('staff/summary');
        if (active) {
          setSummary(summaryData as Summary);
          setLeads([]);
          setTotal(0);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'Unable to load dashboard.');
        }
      } finally {
        if (active) setBusy(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [view, page, search, leadFilter, planFilter, revision]);

  const table = (rows: LeadRow[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Contact</th>
            <th>Quotient</th>
            <th>Status</th>
            <th>WhatsApp consent</th>
            <th>Captured</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>
                  <div>{row.email}</div>
                  <div className="card-meta">{row.phone}</div>
                </td>
                <td>
                  <span className="badge gray">{row.primary_profile.toUpperCase()}</span>
                </td>
                <td>
                  <span className={row.status === 'reviewed' ? 'badge green' : 'badge amber'}>
                    {row.status === 'reviewed' ? 'Reviewed' : 'New'}
                  </span>
                </td>
                <td>{row.whatsapp_consent ? 'Opted in' : 'Not opted in'}</td>
                <td>{formatDate(row.created_at)}</td>
                <td>
                  {canManageCustomers ? <button className={row.deleted_at ? 'btn' : 'btn danger'} disabled={busy || mutating} onClick={() => void changeTrash(row.submission_id, row.name, !row.deleted_at)}>{row.deleted_at ? 'Restore' : 'Delete'}</button> : 'Owner access required'}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>
                <div className="empty">
                  <strong>{busy ? 'Loading records…' : leadFilter === 'deleted' ? 'Trash is empty' : 'No users to display'}</strong>
                  <span>{error ? 'Records could not be loaded.' : search || leadFilter !== 'all' ? 'Try another search or filter.' : 'New quiz submissions will appear here.'}</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const paymentTable = (rows: PaymentRow[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Payment date</th>
            <th>Phone</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.customer_name}</strong>
                  <div className="card-meta">{row.email}</div>
                </td>
                <td>{row.plan}</td>
                <td>
                  <span className={`badge ${statusClass(row.status)}`}>{row.status.toUpperCase()}</span>
                </td>
                <td>{money(row.amount)} {row.currency}</td>
                <td>{formatDate(row.paid_at || row.created_at)}</td>
                <td>
                  <div>{formatPhone(row.phone)}</div>
                </td>
                <td>
                  <div className="client-actions">
                    {whatsappUrlFor(row) ? <a className="btn whatsapp" href={whatsappUrlFor(row)!} target="_blank" rel="noopener noreferrer" aria-label={`Open WhatsApp chat with ${row.customer_name}`}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.46 0 .1 5.36 .1 11.95c0 2.1 .55 4.16 1.6 5.97L0 24l6.25-1.64a11.94 11.94 0 0 0 5.79 1.48h.01c6.59 0 11.95-5.36 11.95-11.95a11.87 11.87 0 0 0-3.48-8.41ZM12.05 21.82a9.92 9.92 0 0 1-5.07-1.39l-.36-.21-3.71.97.99-3.62-.24-.38a9.91 9.91 0 0 1-1.52-5.24c0-5.48 4.45-9.93 9.93-9.93A9.87 9.87 0 0 1 22 11.9c0 5.48-4.46 9.92-9.95 9.92Zm5.45-7.43c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.08 4.5.71.31 1.27.49 1.71.62.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.34Z"/></svg>
                      WhatsApp
                    </a> : <span className="card-meta">No valid mobile number</span>}
                    {canManageCustomers && <button className="btn danger" disabled={busy || mutating} onClick={() => void changeTrash(row.submission_id, row.customer_name, true)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>
                <div className="empty">
                  <strong>{busy ? 'Loading payment records…' : 'No payment records to display'}</strong>
                  <span>
                    {error ? 'Records could not be loaded.' : search || planFilter !== 'all' ? 'Try a different search or filter.' : 'Clients appear here after server-verified payment.'}
                  </span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const exportPage = () => {
    if (view === 'customers') {
      if (!payments.length) return;
      const data = [
        ['Customer', 'Email', 'Phone', 'Plan', 'Status', 'Amount', 'Currency', 'Payment date'],
        ...payments.map(row => [
          row.customer_name,
          row.email,
          row.phone,
          row.plan,
          row.status,
          String(row.amount),
          row.currency,
          row.paid_at || row.created_at
        ])
      ];
      const blob = new Blob(['\uFEFF' + data.map(item => item.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `skin-quotient-payments-page-${page + 1}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    if (!leads.length) return;
    const data = [
      ['Name', 'Email', 'Phone', 'Quotient', 'Status', 'WhatsApp consent', 'Captured'],
      ...leads.map(r => [r.name, r.email, r.phone, r.primary_profile, r.status, r.whatsapp_consent ? 'Yes' : 'No', r.created_at])
    ];
    const blob = new Blob(['\uFEFF' + data.map(item => item.map(csvCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skin-quotient-leads-page-${page + 1}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const recentLeadCount = leads.slice(0, 5);
  const topProfile = summary?.profiles.reduce((best, item) => (item.count > best.count ? item : best), {name: '—', count: 0});

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-main">skin quotient</div>
          <div className="brand-sub">ADMIN / GROWTH OS</div>
        </div>
        <nav className="nav" aria-label="CRM sections">
          {views.map(v => (
            <button
              key={v.id}
              className={view === v.id ? 'active' : ''}
              aria-current={view === v.id ? 'page' : undefined}
              onClick={() => {
                setView(v.id);
                setQuery(''); setSearch(''); setNotice(''); setLeadFilter('all'); setPlanFilter('all');
                setPage(0);
              }}
            >
              <span className="ico" aria-hidden="true">
                {v.icon}
              </span>
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="status">
            <span className="dot" /> {error ? 'Connection needs attention' : busy ? 'Connecting…' : 'Secure database connected'}
          </div>
          <div className="staff-email">{email}</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="greeting">Skin Quotient · Staff workspace</div>
            <div className="page-title">{selected.label}</div>
            <div className="page-sub">{selected.sub}</div>
          </div>
          <div className="top-actions">
            {(view === 'leads' || view === 'overview' || view === 'customers') && (
              <button className="btn" disabled={busy || !((view === 'customers' ? payments.length : leads.length) > 0)} onClick={exportPage}>
                Export page CSV
              </button>
            )}
            <button className="btn" disabled={busy} onClick={() => setRevision(v => v + 1)}>
              Refresh
            </button>
            <button className="btn" onClick={() => void onSignOut().catch(e => setError(e.message))}>
              Sign out
            </button>
          </div>
        </header>

        <div className="content">
          <div role="status" aria-live="polite">
            {notice && <div className="crm-notice">{notice}</div>}
            {error && <div className="crm-error">{error} <button className="btn" onClick={() => setRevision(v => v + 1)}>Retry</button></div>}
          </div>

          {view === 'overview' && (
            <section className="view active">
              <div className="grid-kpi">
                {[
                  ['All users', summary?.total ?? '—', 'Captured profiles', '◉', 'green'],
                  ['Paid customers', summary?.paidCustomers ?? '—', 'Completed paid plans', '✓', 'green'],
                  ['Pending payments', summary?.pendingPayments ?? '—', 'Created but not paid', '◌', 'amber'],
                  ['Revenue', summary?.paidRevenue ? money(summary.paidRevenue) : '—', 'From paid status', '₹', 'purple'],
                  ['Payment conversion', `${summary?.conversion ?? '—'}%`, 'Paid / leads', '%', 'green'],
                  ['Failed payments', summary?.failedPayments ?? '—', 'Payment errors', '✕', ''],
                  [
                    'Skin plan paid',
                    summary?.planBreakdown?.plan?.paid ?? '—',
                    summary ? `Revenue ${money(summary.planBreakdown.plan.revenue)}` : 'Revenue —',
                    'SP',
                    'green'
                  ],
                  [
                    'Consultation paid',
                    summary?.planBreakdown?.consultation?.paid ?? '—',
                    summary ? `Revenue ${money(summary.planBreakdown.consultation.revenue)}` : 'Revenue —',
                    'SC',
                    'green'
                  ]
                ].map(([label, value, foot, icon, tone]) => (
                  <div className={`kpi ${tone}`} key={String(label)}>
                    <div className="kpi-top">
                      <div className="kpi-label">{label}</div>
                      <div className="kpi-icon" aria-hidden="true">
                        {icon}
                      </div>
                    </div>
                    <div className="kpi-value">{String(value)}</div>
                    <div className="kpi-foot">{foot}</div>
                  </div>
                ))}
              </div>

              <div className="section-grid">
                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Lead review funnel</div>
                      <div className="card-meta">All records you have permission to access</div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="funnel">
                      {[
                        ['Captured', summary?.total],
                        ['Reviewed', summary?.reviewed],
                        ['New', summary?.new],
                        ['WhatsApp opt-ins', summary?.whatsapp]
                      ].map(([label, n]) => (
                        <div className="f-row" key={String(label)}>
                          <div className="f-label">{label}</div>
                          <div className="bar">
                            <span style={{width: summary ? Math.min(100, (Number(n) / Math.max(summary.total, 1)) * 100) + '%' : '0%'}} />
                          </div>
                          <div className="f-num">{n ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Plan breakdown</div>
                      <div className="card-meta">Paid customers and revenue by plan</div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="source-list">
                      <div className="source-row">
                        <div className="source-name">Personalized Skin Plan</div>
                        <div className="source-bar">
                          <span
                            style={{width: `${summary?.paidCustomers ? Math.min(100, ((summary.planBreakdown.plan.paid / Math.max(summary.paidCustomers, 1)) * 100)) : 0}%`}}
                          />
                        </div>
                        <div>{summary ? `${summary.planBreakdown.plan.paid} · ${money(summary.planBreakdown.plan.revenue)}` : '—'}</div>
                      </div>
                      <div className="source-row">
                        <div className="source-name">Skin Consultation</div>
                        <div className="source-bar">
                          <span
                            style={{width: `${summary?.paidCustomers ? Math.min(100, ((summary.planBreakdown.consultation.paid / Math.max(summary.paidCustomers, 1)) * 100)) : 0}%`}}
                          />
                        </div>
                        <div>{summary ? `${summary.planBreakdown.consultation.paid} · ${money(summary.planBreakdown.consultation.revenue)}` : '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="section-grid">
                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Recent leads</div>
                      <button className="btn" onClick={() => setView('leads')}>View all</button>
                    </div>
                  </div>
                  {table(recentLeadCount)}
                </div>
                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Traffic profile</div>
                      <div className="card-meta">Top quotient: {topProfile?.count ? topProfile.name.toUpperCase() : '—'}</div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="source-list">
                      {summary?.profiles.map(p => (
                        <div className="source-row" key={p.name}>
                          <div className="source-name">{p.name}</div>
                          <div className="source-bar">
                            <span style={{width: `${Math.min(100, (p.count / Math.max(summary.total, 1)) * 100)}%`}} />
                          </div>
                          <div>{p.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {view === 'leads' && (
            <section className="view active">
              <div className="toolbar">
                <div>
                  <div className="card-title">{leadFilter === 'deleted' ? 'Trash' : 'All users'}</div>
                  <div className="card-meta">{busy ? 'Loading…' : total + ' matching profiles'} · 25 per page</div>
                </div>
                <form
                  className="filters"
                  onSubmit={event => {
                    event.preventDefault();
                    setSearch(query);
                    setPage(0);
                  }}
                >
                  <input
                    className="input"
                    aria-label="Search name, email or phone"
                    placeholder="Search name, email or phone"
                    value={query}
                    maxLength={100}
                    onChange={e => setQuery(e.target.value)}
                  />
                  <button className="btn" disabled={busy}>Search</button>
                  <select
                    className="select"
                    aria-label="Lead status"
                    value={leadFilter}
                    onChange={e => {
                      setLeadFilter(e.target.value as LeadFilter);
                      setPage(0);
                    }}
                  >
                    <option value="all">All statuses</option>
                    <option value="new">New</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="deleted">Trash</option>
                  </select>
                </form>
              </div>
              <div className="card table-card">{table(leads)}</div>
              <div className="pagination">
                <button className="btn" disabled={busy || page === 0} onClick={() => setPage(p => p - 1)}>
                  Previous
                </button>
                <span>Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}</span>
                <button className="btn" disabled={busy || (page + 1) * 25 >= total} onClick={() => setPage(p => p + 1)}>
                  Next
                </button>
              </div>
            </section>
          )}

          {view === 'customers' && (
            <section className="view active">
              <div className="toolbar">
                <div>
                  <div className="card-title">Paid clients</div>
                  <div className="card-meta">{busy ? 'Loading…' : total + ' paid purchases'} · 25 per page</div>
                </div>
                <form
                  className="filters"
                  onSubmit={event => {
                    event.preventDefault();
                    setSearch(query);
                    setPage(0);
                  }}
                >
                  <input
                    className="input"
                    aria-label="Search customer name, email, or phone"
                    placeholder="Search customer name, email, or phone"
                    value={query}
                    maxLength={100}
                    onChange={e => setQuery(e.target.value)}
                  />
                  <select
                    className="select"
                    aria-label="Plan filter"
                    value={planFilter}
                    onChange={e => {
                      setPlanFilter(e.target.value as PaymentPlanFilter);
                      setPage(0);
                    }}
                  >
                    <option value="all">All plans</option>
                    <option value="plan">Personalized Skin Plan</option>
                    <option value="consultation">Skin Consultation</option>
                  </select>
                  <button className="btn" disabled={busy}>Search</button>
                </form>
              </div>
              <div className="card table-card">{paymentTable(payments)}</div>
              <div className="pagination">
                <button className="btn" disabled={busy || page === 0} onClick={() => setPage(p => p - 1)}>
                  Previous
                </button>
                <span>Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}</span>
                <button className="btn" disabled={busy || (page + 1) * 25 >= total} onClick={() => setPage(p => p + 1)}>
                  Next
                </button>
              </div>
            </section>
          )}

          {view === 'recovery' && (
            <section className="view active">
              <div className="toolbar">
                <div className="card-title">Payment recovery</div>
                <div className="card-meta">Follow up on verified payment activity</div>
              </div>
              <div className="card">
                <div className="empty">
                  <strong>Payment recovery is not active</strong>Use Paid clients to open WhatsApp chats for onboarding and consultation follow-up.
                </div>
              </div>
            </section>
          )}

          {view === 'acquisition' && (
            <section className="view active">
              <div className="subnav">
                <span className="badge gray">Sources & campaigns</span>
              </div>
              <section className="section-grid">
                <div className="card">
                  <div className="card-head">
                    <div className="card-title">UTM source performance</div>
                  </div>
                  <div className="empty">
                    <strong>Attribution is not connected yet</strong>Source and campaign results will appear once tracking is enabled.
                  </div>
                </div>
                <div className="card">
                  <div className="card-head">
                    <div className="card-title">Tracking status</div>
                  </div>
                  <div className="card-body">
                    <p className="tracking-note">Assessment leads are saved securely. Visitor analytics, advertising spend and campaign attribution are not currently collected.</p>
                  </div>
                </div>
              </section>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
