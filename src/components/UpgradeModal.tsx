'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

const PLANS = [
  { plan: 'abo',      name: 'Monatsabo', price: 'CHF 4',   per: '/ Monat', desc: 'Monatlich kündbar', featured: false },
  { plan: 'yearly',   name: 'Jahresabo', price: 'CHF 40',  per: '/ Jahr',  desc: '2 Monate gratis',   featured: false },
  { plan: 'lifetime', name: 'Lifetime',  price: 'CHF 129', per: 'einmalig', desc: 'Für immer',        featured: true  },
] as const;

interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const handleCheckout = async (plan: 'abo' | 'yearly' | 'lifetime') => {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler beim Checkout'); return; }
      window.location.href = data.url;
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal open onClose={onClose} title="Jetzt upgraden" size="lg">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: '#5a4e48' }}>
          Schalte alle Funktionen frei: automatischer Menüvorschlag, die gesamte
          Rezeptbibliothek und der KI-Import.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANS.map(({ plan, name, price, per, desc, featured }) => (
            <button
              key={plan}
              onClick={() => handleCheckout(plan)}
              disabled={loading !== null}
              className="flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all"
              style={featured
                ? { borderColor: '#d9543b', backgroundColor: '#fef7f5' }
                : { borderColor: '#e0d8ce', backgroundColor: '#fff9f3' }
              }
            >
              {featured && (
                <span className="text-[10px] font-bold uppercase tracking-wide mb-1.5 px-2 py-0.5 rounded-full" style={{ backgroundColor: '#d9543b', color: '#fff' }}>
                  Beliebt
                </span>
              )}
              <p className="font-semibold text-sm" style={{ color: '#271f1a' }}>{name}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: featured ? '#d9543b' : '#271f1a' }}>{price}</p>
              <p className="text-xs" style={{ color: '#9a8c80' }}>{per} · {desc}</p>
              <span
                className="mt-3 w-full text-center text-xs font-semibold py-1.5 rounded-lg transition-opacity"
                style={{
                  backgroundColor: featured ? '#d9543b' : '#271f1a',
                  color: '#fff',
                  opacity: loading === plan ? 0.6 : 1,
                }}
              >
                {loading === plan ? 'Weiterleitung...' : 'Upgrade'}
              </span>
            </button>
          ))}
        </div>

        {error && <p className="text-xs" style={{ color: '#c62828' }}>{error}</p>}

        <p className="text-xs text-center" style={{ color: '#9c8c84' }}>
          Sichere Zahlung via Stripe · Jederzeit kündbar
        </p>
      </div>
    </Modal>
  );
}
