'use client';

import { useState }  from 'react';
import { useRouter } from 'next/navigation';
import type { AppUser } from '@/lib/users';

type SafeUser = Omit<AppUser, 'passwordHash'>;

const PLAN_LABEL: Record<string, string> = {
  trial:    '7-Tage Test',
  lifetime: 'Lifetime',
  abo:      'Monatsabo',
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  active:   { bg: '#e8f5e9', color: '#2e7d32' },
  inactive: { bg: '#fce4ec', color: '#c62828' },
  pending:  { bg: '#fff3e0', color: '#e65100' },
};

interface Props {
  initialUsers: SafeUser[];
}

export default function AdminPanel({ initialUsers }: Props) {
  const [users,    setUsers]    = useState<SafeUser[]>(initialUsers);
  const [loading,  setLoading]  = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState<string | null>(null);
  const router = useRouter();

  const patch = async (email: string, status: 'active' | 'inactive') => {
    setLoading(email + status);
    await fetch('/api/admin/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, status }),
    });
    setUsers((prev) => prev.map((u) => u.email === email ? { ...u, status } : u));
    setLoading(null);
  };

  const del = async (email: string) => {
    setLoading(email + 'del');
    await fetch('/api/admin/users', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    setUsers((prev) => prev.filter((u) => u.email !== email));
    setConfirm(null);
    setLoading(null);
  };

  const exportCsv = () => {
    const header = 'Vorname,Nachname,E-Mail,Plan,Status,Registriert,Zugang bis';
    const rows   = users.map((u) =>
      [u.firstName, u.lastName, u.email, u.plan, u.status,
       u.registeredAt.slice(0, 10), u.accessUntil?.slice(0, 10) ?? ''].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `mahlzeit-nutzer-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f4ee', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-fraunces font-black text-2xl" style={{ color: '#2c2420' }}>
              🍽 MahlZeit — Admin
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#9c8c84' }}>
              {users.length} registrierte Nutzer
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' }}
            >
              ↓ CSV Export
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#fce4ec', color: '#c62828', border: '1px solid #ffcdd2' }}
            >
              Abmelden
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Aktiv',    value: users.filter((u) => u.status === 'active').length,   color: '#2e7d32', bg: '#e8f5e9' },
            { label: 'Ausstehend', value: users.filter((u) => u.status === 'pending').length, color: '#e65100', bg: '#fff3e0' },
            { label: 'Inaktiv', value: users.filter((u) => u.status === 'inactive').length,  color: '#c62828', bg: '#fce4ec' },
            { label: 'Lifetime', value: users.filter((u) => u.plan === 'lifetime').length,   color: '#b5614a', bg: '#f2e5e0' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-2xl p-4" style={{ backgroundColor: bg }}>
              <div className="text-2xl font-black" style={{ color }}>{value}</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#efe9df', borderBottom: '1px solid #e0d8ce' }}>
                {['Name', 'E-Mail', 'Plan', 'Status', 'Registriert', 'Zugang bis', 'Aktionen'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs" style={{ color: '#9c8c84' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#9c8c84' }}>
                    Noch keine Nutzer registriert.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const sc = STATUS_COLOR[u.status] ?? STATUS_COLOR.inactive;
                return (
                  <tr key={u.email} style={{ borderBottom: '1px solid #f0ede8' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#2c2420' }}>
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#5a4e48' }}>{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#f2e5e0', color: '#b5614a' }}>
                        {PLAN_LABEL[u.plan] ?? u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={sc}>
                        {u.status === 'active' ? 'Aktiv' : u.status === 'pending' ? 'Ausstehend' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#9c8c84' }}>
                      {u.registeredAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#9c8c84' }}>
                      {u.accessUntil ? u.accessUntil.slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {u.status === 'active' ? (
                          <button
                            onClick={() => patch(u.email, 'inactive')}
                            disabled={!!loading}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                            style={{ backgroundColor: '#fce4ec', color: '#c62828' }}
                          >
                            {loading === u.email + 'inactive' ? '…' : 'Deaktivieren'}
                          </button>
                        ) : (
                          <button
                            onClick={() => patch(u.email, 'active')}
                            disabled={!!loading}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                            style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}
                          >
                            {loading === u.email + 'active' ? '…' : 'Aktivieren'}
                          </button>
                        )}
                        <button
                          onClick={() => setConfirm(u.email)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                          style={{ backgroundColor: '#f7f4ee', color: '#9c8c84', border: '1px solid #e0d8ce' }}
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Delete confirm modal */}
        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(44,36,32,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: '#fff9f3' }}>
              <h3 className="font-semibold mb-2" style={{ color: '#2c2420' }}>Nutzer löschen?</h3>
              <p className="text-sm mb-5" style={{ color: '#5a4e48' }}>
                <strong>{confirm}</strong> wird <strong>endgültig</strong> gelöscht und kann nicht wiederhergestellt werden.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ color: '#5a4e48' }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => del(confirm)}
                  disabled={!!loading}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: '#c62828' }}
                >
                  {loading ? '…' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
