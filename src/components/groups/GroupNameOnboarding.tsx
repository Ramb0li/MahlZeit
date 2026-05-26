'use client';
import { useState } from 'react';
import { Users, ArrowRight, Loader2 } from 'lucide-react';
import type { Group } from '@/lib/groups';

interface Props {
  currentName: string;
  onSaved: (group: Group) => void;
}

/**
 * Blocking onboarding modal — only owners see it on their first login until
 * they choose a group name. Members never see this (their group already has a name).
 */
export function GroupNameOnboarding({ currentName, onSaved }: Props) {
  const [name, setName]       = useState(currentName === 'Meine Familie' ? '' : currentName);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Bitte einen Namen mit mindestens 2 Zeichen.'); return; }
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/groups/rename', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      onSaved(data as Group);
    } finally { setLoading(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(44,36,32,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ backgroundColor: '#4a7a4e' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <Users size={20} style={{ color: '#fff' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Willkommen bei MahlZeit!</h2>
              <p className="text-xs" style={{ color: '#c8e0c8' }}>Letzter Schritt vor dem Start</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: '#5a4e48' }}>
              Wie soll deine Familie heissen? Der Name wird über dem Menüplan, den
              Rezepten und der Einkaufsliste angezeigt — und kommt auf Einladungen
              an Familienmitglieder.
            </p>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#9c8c84' }}>
              Familienname
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              autoFocus
              maxLength={60}
              placeholder="z.B. Familie Muster"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{ border: '1.5px solid #c8d8c8', backgroundColor: '#f2f6f2', color: '#2c2420' }}
            />
            {error && (
              <p className="text-xs mt-2" style={{ color: '#c62828' }}>{error}</p>
            )}
            <p className="text-[11px] mt-2" style={{ color: '#9c8c84' }}>
              Du kannst den Namen später jederzeit in den Einstellungen ändern.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || name.trim().length < 2}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ backgroundColor: '#4a7a4e', color: '#fff' }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {loading ? 'Wird gespeichert…' : 'Loslegen'}
          </button>
        </form>
      </div>
    </div>
  );
}
