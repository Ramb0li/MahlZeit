'use client';
import { Sparkles, ChevronRight } from 'lucide-react';

interface UpgradeBannerProps {
  onClick: () => void;
}

export function UpgradeBanner({ onClick }: UpgradeBannerProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backgroundColor: '#d9543b',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      <Sparkles size={15} style={{ flexShrink: 0 }} />
      <span>
        Starte jetzt mit deinem persönlichen Menüplaner und schalte alle Funktionen frei für CHF&nbsp;4.–/Monat
      </span>
      <ChevronRight size={15} style={{ flexShrink: 0 }} />
    </button>
  );
}
