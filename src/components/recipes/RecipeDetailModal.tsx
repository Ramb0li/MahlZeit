'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Pencil, UtensilsCrossed } from 'lucide-react';
import { type Recipe, type Ingredient, type IngredientGroup, type RecipeRating, type EuAllergen, TAG_GROUPS } from '@/types';
import { scaleDisplayAmount } from '@/lib/utils';

// ─── Diet display mapping ─────────────────────────────────────────────────────

const DIET_LABEL: Record<string, string> = {
  meat:       '🥩 Fleischhaltig',
  fish:       '🐟 Pescetarisch',
  vegetarian: '🌿 Vegetarisch',
  vegan:      '🌱 Vegan',
};

// ─── Allergen display labels ─────────────────────────────────────────────────

const EU_ALLERGEN_LABELS: Record<EuAllergen, string> = {
  gluten:          'Gluten',
  krebstiere:      'Krebstiere',
  ei:              'Ei',
  fisch:           'Fisch',
  erdnuesse:       'Erdnüsse',
  soja:            'Soja',
  milch:           'Milch',
  schalenfruechte: 'Schalenfrüchte',
  sellerie:        'Sellerie',
  senf:            'Senf',
  sesam:           'Sesam',
  sulfite:         'Sulfite',
  lupinen:         'Lupinen',
  weichtiere:      'Weichtiere',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  if (amount === 0) return '';
  return amount % 1 === 0 ? String(amount) : String(amount).replace('.', ',');
}

function avgRating(ratings: RecipeRating[]): number {
  if (!ratings.length) return 0;
  return ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
}

function emailShort(email: string): string {
  const [local] = email.split('@');
  return local.length > 8 ? local.slice(0, 6) + '...' : local;
}

function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─── SpoonRating ──────────────────────────────────────────────────────────────

function SpoonRating({ value, max = 5, interactive = false, onChange }: {
  value: number;
  max?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const display = interactive && hovered ? hovered : value;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => interactive && setHovered(n)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={interactive ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
          style={{ background: 'none', border: 'none', padding: 0 }}
          aria-label={`${n} Loeffel`}
        >
          <span style={{
            fontSize: interactive ? '22px' : '14px',
            opacity: n <= display ? 1 : 0.25,
            transition: 'opacity 0.12s',
            filter: n <= display ? 'none' : 'grayscale(1)',
          }}>
            🥄
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── IngredientTable ──────────────────────────────────────────────────────────

function IngredientTable({ ingredients, base, portions }: {
  ingredients: Ingredient[];
  base: number;
  portions: number;
}) {
  return (
    <div className="space-y-1.5">
      {ingredients.map((ing, i) => {
        const scaled = scaleDisplayAmount(ing.amount, base, portions);
        return (
          <div key={i} className="flex items-baseline gap-2 text-sm">
            <span className="text-right font-medium shrink-0" style={{ minWidth: 60, color: '#9a8c80', fontSize: 13 }}>
              {ing.amount > 0 ? `${formatAmount(scaled)} ${ing.unit}` : ing.unit || ''}
            </span>
            <span style={{ color: '#271f1a', fontSize: 13 }}>{ing.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── IngredientSection ────────────────────────────────────────────────────────

function IngredientSection({ recipe, portions }: { recipe: Recipe; portions: number }) {
  const groups: IngredientGroup[] = recipe.ingredientGroups?.length
    ? recipe.ingredientGroups
    : [{ name: 'Zutaten', ingredients: recipe.ingredients }];

  if (groups.length === 1) {
    return <IngredientTable ingredients={groups[0].ingredients} base={recipe.basePortions} portions={portions} />;
  }

  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <div key={gi}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#9a8c80' }}>{g.name}</p>
          <IngredientTable ingredients={g.ingredients} base={recipe.basePortions} portions={portions} />
        </div>
      ))}
    </div>
  );
}

// ─── RatingsSection ───────────────────────────────────────────────────────────

function RatingsSection({ recipeId, isPremium }: { recipeId: string; isPremium: boolean }) {
  const [ratings, setRatings]     = useState<RecipeRating[]>([]);
  const [loading, setLoading]     = useState(true);
  const [myRating, setMyRating]   = useState(0);
  const [myComment, setMyComment] = useState('');
  const [saving, setSaving]       = useState(false);
  const [notice, setNotice]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/ratings?recipeId=${encodeURIComponent(recipeId)}`);
      if (res.ok) setRatings(await res.json());
    } finally { setLoading(false); }
  }, [recipeId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (myRating === 0) { setNotice('Bitte waehle eine Bewertung.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/recipes/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, rating: myRating, comment: myComment }),
      });
      if (res.ok) {
        setNotice('Bewertung gespeichert!');
        setMyRating(0); setMyComment(''); load();
        setTimeout(() => setNotice(''), 3000);
      } else {
        const { error } = await res.json();
        setNotice(error ?? 'Fehler');
      }
    } finally { setSaving(false); }
  };

  const avg = avgRating(ratings);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SpoonRating value={Math.round(avg)} />
        <span className="text-sm font-semibold" style={{ color: '#5a4e48' }}>
          {ratings.length === 0
            ? 'Noch keine Bewertungen'
            : `${avg.toFixed(1)} / 5 (${ratings.length} Bewertung${ratings.length !== 1 ? 'en' : ''})`}
        </span>
      </div>

      {ratings.length > 0 && (
        <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
          {[...ratings].reverse().map((r, i) => (
            <div key={i} className="rounded-xl p-3 text-sm" style={{ backgroundColor: '#f7f4ee', border: '1px solid #e0d8ce' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold" style={{ color: '#5a4e48' }}>{r.userName ?? emailShort(r.userEmail)}</span>
                <div className="flex items-center gap-2">
                  <SpoonRating value={r.rating} />
                  <span className="text-xs" style={{ color: '#9a8c80' }}>{dateShort(r.createdAt)}</span>
                </div>
              </div>
              {r.comment && <p style={{ color: '#5a4e48' }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {isPremium ? (
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#fff9f3', border: '1px solid #e0d8ce' }}>
          <p className="text-sm font-semibold" style={{ color: '#271f1a' }}>Deine Bewertung</p>
          <SpoonRating value={myRating} interactive onChange={setMyRating} />
          <textarea
            placeholder="Optionaler Kommentar..."
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            rows={2} maxLength={500}
            className="w-full text-sm rounded-xl px-3 py-2 focus:outline-none resize-none"
            style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff', color: '#271f1a' }}
          />
          {notice && (
            <p className="text-xs font-semibold" style={{ color: notice.includes('gespeichert') ? '#4a7a4e' : '#c62828' }}>
              {notice}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving || myRating === 0}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
            style={{ backgroundColor: '#d9543b', color: '#fff', opacity: (saving || myRating === 0) ? 0.5 : 1 }}
          >
            {saving ? 'Wird gespeichert...' : 'Bewertung abgeben'}
          </button>
        </div>
      ) : (
        <p className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: '#f5ece0', color: '#c49a6c', border: '1px solid #e8c5a0' }}>
          Nur Premium-Nutzer koennen Rezepte bewerten.
        </p>
      )}

      {loading && <p className="text-xs" style={{ color: '#9a8c80' }}>Lade Bewertungen...</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RecipeDetailModalProps {
  recipe: Recipe;
  isPremium?: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onEdit?: (recipe: Recipe) => void;
  onStartCooking?: (recipe: Recipe, portions: number) => void;
  /** Wenn gesetzt: Modal wurde aus einem Menüplan-Slot geöffnet → Portionen speicherbar */
  portionContext?: { initialPortions: number };
  onSavePortions?: (portions: number) => void | Promise<void>;
}

export function RecipeDetailModal({
  recipe,
  isPremium = false,
  isAdmin = false,
  onClose,
  onEdit,
  onStartCooking,
  portionContext,
  onSavePortions,
}: RecipeDetailModalProps) {
  const [portions, setPortions] = useState(portionContext?.initialPortions ?? recipe.basePortions ?? 4);
  const [savingPortions, setSavingPortions] = useState(false);

  // Image slideshow
  const images = [recipe.imageUrl, recipe.imageZutaten, recipe.imageKochen].filter(Boolean) as string[];
  const [imgIndex, setImgIndex] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setImgIndex((i) => (i + 1) % images.length), 3000);
    return () => clearInterval(timer);
  }, [images.length]);

  const hasSteps = (recipe.steps?.length ?? 0) > 0;

  // Trap scroll on body while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(39,31,26,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ backgroundColor: '#fff', boxShadow: '0 24px 64px rgba(39,31,26,0.28)' }}
      >
        {/* ── Hero image ─────────────────────────────────────────────────── */}
        <div className="relative shrink-0 overflow-hidden" style={{ height: 'clamp(240px, 50vw, 320px)' }}>
          {images.length > 0 ? (
            images.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={recipe.name}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                style={{ opacity: i === imgIndex ? 1 : 0 }}
              />
            ))
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#f0ebe3' }}>
              <UtensilsCrossed size={48} style={{ color: '#d4a090', opacity: 0.5 }} />
            </div>
          )}

          {/* Gradient */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(39,31,26,0.25) 0%, transparent 35%, rgba(39,31,26,0.65) 100%)' }}
          />

          {/* Category + title overlay */}
          <div className="absolute bottom-4 left-5 right-16">
            <span
              className="inline-block text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)' }}
            >
              {recipe.category}
            </span>
            <h2 className="font-bold text-xl leading-tight text-white drop-shadow">{recipe.name}</h2>
          </div>

          {/* Edit top-left */}
          {(isAdmin || onEdit) && (
            <button
              onClick={() => onEdit?.(recipe)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.88)', color: '#271f1a' }}
              title="Rezept bearbeiten"
            >
              <Pencil size={14} />
            </button>
          )}

          {/* X top-right */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.88)', color: '#271f1a' }}
            aria-label="Schliessen"
          >
            <X size={16} />
          </button>

          {/* Slideshow dots */}
          {images.length > 1 && (
            <div className="absolute bottom-4 right-4 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImgIndex(i)}
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{ backgroundColor: i === imgIndex ? '#fff' : 'rgba(255,255,255,0.5)' }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* Chips row */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full"
                style={{ border: '1px solid #e0d8ce', color: '#5a4e48' }}
              >
                {recipe.activeTimeMinutes
                  ? `⏱ ${recipe.activeTimeMinutes} Min aktiv · ${recipe.timeMinutes} Min gesamt`
                  : `⏱ ${recipe.timeMinutes} Min`}
              </span>
              {recipe.dietCategory && DIET_LABEL[recipe.dietCategory] && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full"
                  style={{ border: '1px solid #e0d8ce', color: '#5a4e48' }}
                >
                  {DIET_LABEL[recipe.dietCategory]}
                </span>
              )}
              {recipe.tags
                .filter(t => (TAG_GROUPS.Saison as readonly string[]).includes(t))
                .map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full"
                    style={{ border: '1px solid #e0d8ce', color: '#5a4e48' }}>
                    ♾ {t}
                  </span>
                ))}
              {recipe.source && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full"
                  style={{ border: '1px solid #e0d8ce', color: '#9a8c80' }}
                >
                  @{recipe.source}
                </span>
              )}
            </div>

            {/* Allergene */}
            {recipe.allergens !== undefined && (
              <div className="flex flex-wrap items-center gap-1.5">
                {recipe.allergens.length === 0 ? (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}
                  >
                    Keine bekannten Allergene
                  </span>
                ) : (
                  <>
                    <span className="text-xs font-semibold" style={{ color: '#9a8c80' }}>Enthält:</span>
                    {recipe.allergens.map(a => (
                      <span
                        key={a}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: '#fef3f2', color: '#c0392b', border: '1px solid #fecaca' }}
                      >
                        {EU_ALLERGEN_LABELS[a]}
                      </span>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Description */}
            {recipe.description && (
              <p className="text-sm leading-relaxed" style={{ color: '#5a4e48' }}>{recipe.description}</p>
            )}

            {/* Nährwerte */}
            {recipe.nutrition && (
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f7f4ee', border: '1px solid #e0d8ce' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: '#5a4e48' }}>Pro Portion</span>
                  <span className="text-xs" style={{ color: '#b0a090' }}>Richtwerte</span>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { label: 'kcal',          value: recipe.nutrition.kcal,    unit: '' },
                    { label: 'Eiweiss',        value: recipe.nutrition.protein, unit: 'g' },
                    { label: 'Fett',           value: recipe.nutrition.fat,     unit: 'g' },
                    { label: 'Kohlenhydr.',    value: recipe.nutrition.carbs,   unit: 'g' },
                    { label: 'Ballaststoffe',  value: recipe.nutrition.fiber,   unit: 'g' },
                  ].map(({ label, value, unit }) => (
                    <div key={label}>
                      <div className="text-sm font-bold" style={{ color: '#271f1a' }}>{value}{unit}</div>
                      <div className="text-[10px] leading-tight" style={{ color: '#9a8c80' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Portions scaler */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold" style={{ color: '#271f1a' }}>Zutaten</span>
              <div className="flex items-center gap-1 rounded-full px-1" style={{ border: '1px solid #e0d8ce', backgroundColor: '#faf7f2' }}>
                <button
                  onClick={() => setPortions((p) => Math.max(1, p - 1))}
                  className="w-7 h-7 flex items-center justify-center text-base font-bold rounded-full transition-colors"
                  style={{ color: '#5a4e48' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0ebe3')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  −
                </button>
                <span className="text-xs font-semibold px-1" style={{ color: '#271f1a', minWidth: 52, textAlign: 'center' }}>
                  {portions} Port.
                </span>
                <button
                  onClick={() => setPortions((p) => Math.min(20, p + 1))}
                  className="w-7 h-7 flex items-center justify-center text-base font-bold rounded-full transition-colors"
                  style={{ color: '#5a4e48' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0ebe3')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  +
                </button>
              </div>
            </div>

            {/* Two-column: Zutaten + Zubereitung */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Left: Zutaten */}
              <div>
                <IngredientSection recipe={recipe} portions={portions} />
              </div>

              {/* Right: Zubereitung */}
              {hasSteps && (
                <div>
                  <h3 className="text-sm font-bold mb-3" style={{ color: '#271f1a' }}>Zubereitung</h3>
                  <ol className="space-y-3">
                    {recipe.steps!.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span
                          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                          style={{ backgroundColor: '#d9543b', color: '#fff' }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm leading-relaxed" style={{ color: '#5a4e48' }}>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Tips */}
            {recipe.tips && (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#faf5ee', border: '1px solid #e8c5a0' }}>
                <p className="text-sm" style={{ color: '#5a4e48' }}>
                  <span style={{ color: '#d9543b', fontWeight: 700, marginRight: 6 }}>✱</span>
                  {recipe.tips}
                </p>
              </div>
            )}

            {/* Ratings */}
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: '#271f1a' }}>Bewertungen</h3>
              <RatingsSection recipeId={recipe.id} isPremium={isPremium} />
            </div>

            <div style={{ height: 4 }} />
          </div>
        </div>

        {/* ── Sticky footer ──────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: '1px solid #e0d8ce', backgroundColor: '#fff' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-sm font-semibold transition-colors"
            style={{ border: '1.5px solid #e0d8ce', color: '#5a4e48', backgroundColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f7f4ee')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Schliessen
          </button>
          {portionContext && onSavePortions && (
            <button
              onClick={async () => {
                setSavingPortions(true);
                try { await onSavePortions(portions); } finally { setSavingPortions(false); }
              }}
              disabled={savingPortions}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#d9543b', color: '#fff', opacity: savingPortions ? 0.6 : 1 }}
            >
              {savingPortions ? 'Speichern…' : `${portions} Portionen speichern`}
            </button>
          )}
          {onStartCooking && (
            <button
              onClick={() => onStartCooking(recipe, portions)}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-85"
              style={{
                backgroundColor: hasSteps ? '#d9543b' : '#9a8c80',
                color: '#fff',
                cursor: hasSteps ? 'pointer' : 'default',
              }}
              title={hasSteps ? undefined : 'Keine Zubereitungsschritte hinterlegt'}
            >
              <UtensilsCrossed size={14} />
              Jetzt kochen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
