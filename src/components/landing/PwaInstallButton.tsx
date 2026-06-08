'use client';
import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

type Platform = 'android' | 'ios' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallButton() {
  const [platform, setPlatform]             = useState<Platform>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled]           = useState(false);
  const [showIOSGuide, setShowIOSGuide]     = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }
    setPlatform(detectPlatform());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Nicht anzeigen wenn: bereits installiert, Desktop, oder Android ohne Install-Event
  if (installed) return null;
  if (platform === 'other') return null;
  if (platform === 'android' && !deferredPrompt) return null;

  const handleClick = async () => {
    if (platform === 'ios') {
      setShowIOSGuide(true);
      return;
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="mz-btn-soft lg"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 22px',
          fontSize: 15,
        }}
      >
        {platform === 'ios' ? <Share size={16} /> : <Download size={16} />}
        App installieren
      </button>

      {/* iOS-Anleitung Overlay */}
      {showIOSGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(44,36,32,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 16,
          }}
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            style={{
              width: '100%',
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '24px 20px',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon-192.png" alt="MahlZeit" width={44} height={44} style={{ borderRadius: 10 }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0 }}>MahlZeit installieren</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>mahlzeit.o-v-k.ch</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                style={{ color: 'var(--muted)', padding: 4, lineHeight: 1 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Schritte */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                {
                  n: '1',
                  text: (
                    <>
                      Tippe auf das{' '}
                      <strong>Teilen-Symbol</strong>
                      {' '}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        backgroundColor: 'var(--accent)',
                        borderRadius: 6,
                        verticalAlign: 'middle',
                      }}>
                        <Share size={13} color="#fff" />
                      </span>
                      {' '}in der Safari-Menüleiste unten.
                    </>
                  ),
                },
                {
                  n: '2',
                  text: <>Scrolle nach unten und tippe auf <strong>"Zum Home-Bildschirm"</strong>.</>,
                },
                {
                  n: '3',
                  text: <>Tippe oben rechts auf <strong>"Hinzufügen"</strong> — fertig.</>,
                },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                  }}>
                    {step.n}
                  </span>
                  <p style={{ fontSize: 14, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>
                    {step.text}
                  </p>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
              Die App wird ohne Werbung und ohne App Store direkt auf deinem Gerät gespeichert.
            </p>
          </div>
          {/* Pfeil nach unten zur Toolbar */}
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: '10px solid var(--card)',
          }} />
        </div>
      )}
    </>
  );
}
