'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, UtensilsCrossed } from 'lucide-react';
import type { Recipe, Ingredient, IngredientGroup } from '@/types';
import { scaleDisplayAmount } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Hebt Timer-Patterns (z.B. "3 Min.", "ca. 2 Min.") gruen hervor */
function highlightTimers(text: string): React.ReactNode[] {
  const parts = text.split(/(\d+\s*(?:–|-)\s*\d+\s*Min\.|\d+\s*Min\.)/gi);
  return parts.map((part, i) =>
    /\d+.*Min\./i.test(part)
      ? <span key={i} style={{ color: '#7bc67e', fontWeight: 700 }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

function formatAmount(amount: number): string {
  if (amount === 0) return '';
  return amount % 1 === 0 ? String(amount) : String(amount).replace('.', ',');
}

/** Zutaten einer Liste auf die gewählte Portionenzahl skalieren (gleiche Werte wie Rezeptdetail). */
function scaleList(list: Ingredient[], basePortions: number, portions: number): Ingredient[] {
  return list.map((i) => ({ ...i, amount: scaleDisplayAmount(i.amount, basePortions, portions) }));
}

/** Prüft, ob ein Zutatenname (per Wort-Präfix) im Schritttext vorkommt — tolerant für Plural/Komposita. */
function nameInStep(stepLower: string, name: string): boolean {
  const words = name.toLowerCase().replace(/[^a-zäöüß\s-]/g, ' ').split(/[\s-]+/).filter(w => w.length >= 4);
  return words.some(w => stepLower.includes(w.slice(0, Math.min(5, w.length))));
}

/** Im Schritt genannte Zutaten (dedupliziert) — für die Schritt-Zutatenliste. */
function ingredientsForStep(stepText: string, all: Ingredient[]): Ingredient[] {
  const s = stepText.toLowerCase();
  const seen = new Set<string>();
  const out: Ingredient[] = [];
  for (const ing of all) {
    const key = ing.name.toLowerCase();
    if (seen.has(key)) continue;
    if (nameInStep(s, ing.name)) { seen.add(key); out.push(ing); }
  }
  return out;
}

// ─── Ingredient Card (small) ─────────────────────────────────────────────────

function IngredientCard({ name, ingredients }: { name: string; ingredients: Ingredient[] }) {
  return (
    <div
      className="rounded-2xl p-4 mb-6"
      style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{name}</p>
      <div className="space-y-1.5">
        {ingredients.map((ing, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <span className="shrink-0 font-semibold" style={{ color: '#7bc67e', minWidth: 64 }}>
              {ing.amount > 0 ? `${formatAmount(ing.amount)} ${ing.unit}` : ing.unit || ''}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{ing.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CookingGuideProps {
  recipe: Recipe;
  /** Gewählte Portionenzahl aus dem Rezeptdetail; Fallback: Rezept-Basisportionen. */
  portions?: number;
  onClose: () => void;
  onFinished?: () => void;
}

export function CookingGuide({ recipe, portions, onClose, onFinished }: CookingGuideProps) {
  const steps = recipe.steps ?? [];
  const basePortions   = recipe.basePortions || 1;
  const cookPortions   = portions ?? recipe.basePortions ?? 4;
  const totalPages = steps.length + 2; // 0=Mise, 1..N=Schritte, last=Abschluss
  const lastPage   = totalPages - 1;

  const [page, setPage]         = useState(0);
  const [done, setDone]         = useState<Set<number>>(new Set());

  // Ingredient groups — bevorzuge strukturierte Gruppen, Fallback flach
  const groups: IngredientGroup[] = recipe.ingredientGroups?.length
    ? recipe.ingredientGroups
    : [{ name: 'Zutaten', ingredients: recipe.ingredients }];

  // Zutatenkarte fuer einen Schritt: wenn #groups == #steps → passende Gruppe
  function groupForStep(stepIndex: number): IngredientGroup | null {
    if (groups.length === steps.length) return groups[stepIndex] ?? null;
    return null;
  }

  const goNext = useCallback(() => {
    setPage((p) => {
      const next = Math.min(p + 1, lastPage);
      if (p > 0 && p < lastPage) {
        setDone((d) => new Set(Array.from(d).concat(p))); // markiere aktuellen Schritt als erledigt
      }
      return next;
    });
  }, [lastPage]);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(0, p - 1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Bildschirm anlassen (Wake Lock): verhindert Standby/Bildschirmschoner während des Kochens.
  // Re-Acquire nach Tab-Wechsel (Wake Lock wird beim Verstecken automatisch freigegeben).
  // Graceful no-op auf Browsern ohne Unterstützung (z.B. iOS < 16.4).
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await nav.wakeLock!.request('screen');
      } catch { /* z.B. im Hintergrund oder vom System abgelehnt */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible' && !cancelled) acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  // ── Page content ──
  const isMisePage    = page === 0;
  const isFinishPage  = page === lastPage;
  const stepIndex     = page - 1; // 0-based index into steps[]
  const currentStep   = isMisePage || isFinishPage ? null : steps[stepIndex];
  // Zutaten für den aktuellen Schritt: bevorzugt eine 1:1 zugeordnete Gruppe,
  // sonst aus dem Schritttext erkannt. Mengen auf die gewählten Portionen skaliert.
  const alignedGroup  = currentStep != null ? groupForStep(stepIndex) : null;
  const rawStepIngredients = currentStep == null ? []
    : alignedGroup ? alignedGroup.ingredients
    : ingredientsForStep(currentStep, recipe.ingredients);
  const stepIngredients = scaleList(rawStepIngredients, basePortions, cookPortions);
  const stepIngredientsLabel = alignedGroup?.name ?? 'Für diesen Schritt';

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ backgroundColor: '#1a1614' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' }}
        >
          <X size={20} />
        </button>
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {recipe.name}
        </p>
        {/* Timer icon placeholder (future) */}
        <div style={{ width: 40 }} />
      </div>

      {/* Hero image (Mise + Finish pages) */}
      {(isMisePage || isFinishPage) && recipe.imageUrl && (
        <div className="shrink-0 mx-5 mt-2 rounded-2xl overflow-hidden" style={{ height: 200 }}>
          <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
        </div>
      )}
      {(isMisePage || isFinishPage) && !recipe.imageUrl && (
        <div className="shrink-0 mx-5 mt-2 rounded-2xl flex items-center justify-center" style={{ height: 120, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <UtensilsCrossed size={40} style={{ color: 'rgba(255,255,255,0.2)' }} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-2">

        {/* Mise-en-Place */}
        {isMisePage && (
          <>
            <h1 className="text-xl font-bold leading-tight mb-6" style={{ color: '#fff' }}>
              Mise-en-Place
            </h1>
            <div className="space-y-4">
              {groups.map((g, gi) => (
                <IngredientCard key={gi} name={g.name} ingredients={scaleList(g.ingredients, basePortions, cookPortions)} />
              ))}
            </div>
          </>
        )}

        {/* Step page */}
        {!isMisePage && !isFinishPage && currentStep && (
          <>
            {stepIngredients.length > 0 && (
              <IngredientCard name={stepIngredientsLabel} ingredients={stepIngredients} />
            )}
            <p className="text-xl font-semibold leading-relaxed" style={{ color: '#fff' }}>
              {highlightTimers(currentStep)}
            </p>
          </>
        )}

        {/* Finish page */}
        {isFinishPage && (
          <div className="text-center pt-4">
            <p className="text-3xl font-black tracking-tight leading-tight mb-3" style={{ color: '#fff', fontFamily: 'serif' }}>
              Mhmm,<br />en Guete!
            </p>
            <p className="text-base mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Wir wünschen dir einen guten Appetit.
            </p>
            <button
              onClick={() => { onFinished?.(); onClose(); }}
              className="px-8 py-3 rounded-2xl font-bold text-base transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#b5614a', color: '#fff' }}
            >
              Fertig & Bewerten
            </button>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="shrink-0 px-5 pb-8 pt-4">
        {/* Page dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4 flex-wrap">
          {Array.from({ length: totalPages }, (_, i) => {
            const isDone     = done.has(i);
            const isCurrent  = page === i;
            const isFinish   = i === lastPage;

            return (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="flex items-center justify-center rounded-full font-bold text-xs transition-all"
                style={{
                  width:  isCurrent ? 36 : 28,
                  height: isCurrent ? 36 : 28,
                  backgroundColor: isCurrent
                    ? '#fff'
                    : isDone
                    ? '#7bc67e'
                    : 'rgba(255,255,255,0.12)',
                  color: isCurrent ? '#1a1614' : isDone ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: isCurrent ? '2px solid #fff' : 'none',
                }}
              >
                {isDone && !isCurrent ? (
                  <Check size={12} />
                ) : isFinish ? (
                  <UtensilsCrossed size={12} />
                ) : i === 0 ? (
                  'M'
                ) : (
                  i
                )}
              </button>
            );
          })}
        </div>

        {/* Prev / Next arrows */}
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={page === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-opacity"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: page === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)',
            }}
          >
            <ChevronLeft size={18} />
            Zurück
          </button>

          {!isFinishPage ? (
            <button
              onClick={goNext}
              className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#fff', color: '#1a1614' }}
            >
              {page === 0 ? 'Los gehts' : 'Weiter'}
              <ChevronRight size={18} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
