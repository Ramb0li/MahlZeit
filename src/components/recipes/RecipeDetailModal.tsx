'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Clock, Leaf, ChevronUp, ChevronDown, Star, UtensilsCrossed, Pencil } from 'lucide-react';
import { type Recipe, type Ingredient, type IngredientGroup, type RecipeRating, computeTimeTags } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scaleAmount(amount: number, base: number, current: number): number {
  if (base === 0) return amount;
  const scaled = (amount / base) * current;
  // Sinnvolle Rundung
  if (scaled >= 10) return Math.round(scaled);
  if (scaled >= 1)  return Math.round(scaled * 10) / 10;
  return Math.round(scaled * 100) / 100;
}

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
          <span
            style={{
              fontSize: interactive ? '22px' : '14px',
              opacity: n <= display ? 1 : 0.25,
              transition: 'opacity 0.12s',
              filter: n <= display ? 'none' : 'grayscale(1)',
            }}
          >
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
    <div className="space-y-1">
      {ingredients.map((ing, i) => {
        const scaled = scaleAmount(ing.amount, base, portions);
        return (
          <div key={i} className="flex items-baseline gap-2 text-sm" style={{ color: '#2c2420' }}>
            <span className="text-right font-semibold shrink-0" style={{ minWidth: 56, color: '#5a4e48' }}>
              {ing.amount > 0 ? `${formatAmount(scaled)} ${ing.unit}` : ing.unit || ''}
            </span>
            <span>{ing.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── IngredientSection ────────────────────────────────────────────────────────

function IngredientSection({ recipe, portions }: { recipe: Recipe; portions: number }) {
  // Gruppen bevorzugen; Fallback auf flache Liste
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
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#9c8c84' }}>{g.name}</p>
          <IngredientTable ingredients={g.ingredients} base={recipe.basePortions} portions={portions} />
        </div>
      ))}
    </div>
  );
}

// ─── RatingsSection ───────────────────────────────────────────────────────────

function RatingsSection({ recipeId, isPremium }: { recipeId: string; isPremium: boolean }) {
  const [ratings, setRatings]   = useState<RecipeRating[]>([]);
  const [loading, setLoading]   = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [saving, setSaving]     = useState(false);
  const [notice, setNotice]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/ratings?recipeId=${encodeURIComponent(recipeId)}`);
      if (res.ok) setRatings(await res.json());
    } finally {
      setLoading(false);
    }
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
        setMyRating(0);
        setMyComment('');
        load();
        setTimeout(() => setNotice(''), 3000);
      } else {
        const { error } = await res.json();
        setNotice(error ?? 'Fehler');
      }
    } finally {
      setSaving(false);
    }
  };

  const avg = avgRating(ratings);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <SpoonRating value={Math.round(avg)} />
        <span className="text-sm font-semibold" style={{ color: '#5a4e48' }}>
          {ratings.length === 0
            ? 'Noch keine Bewertungen'
            : `${avg.toFixed(1)} / 5 (${ratings.length} Bewertung${ratings.length !== 1 ? 'en' : ''})`}
        </span>
      </div>

      {/* Existing comments */}
      {ratings.length > 0 && (
        <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
          {[...ratings].reverse().map((r, i) => (
            <div key={i} className="rounded-xl p-3 text-sm" style={{ backgroundColor: '#f7f4ee', border: '1px solid #e0d8ce' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold" style={{ color: '#5a4e48' }}>{emailShort(r.userEmail)}</span>
                <div className="flex items-center gap-2">
                  <SpoonRating value={r.rating} />
                  <span className="text-xs" style={{ color: '#9c8c84' }}>{dateShort(r.createdAt)}</span>
                </div>
              </div>
              {r.comment && <p style={{ color: '#5a4e48' }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Rating form */}
      {isPremium ? (
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#fff9f3', border: '1px solid #e0d8ce' }}>
          <p className="text-sm font-semibold" style={{ color: '#2c2420' }}>Deine Bewertung</p>
          <SpoonRating value={myRating} interactive onChange={setMyRating} />
          <textarea
            placeholder="Optionaler Kommentar..."
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full text-sm rounded-xl px-3 py-2 focus:outline-none resize-none"
            style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff', color: '#2c2420' }}
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
            style={{ backgroundColor: '#b5614a', color: '#fff', opacity: (saving || myRating === 0) ? 0.5 : 1 }}
          >
            {saving ? 'Wird gespeichert...' : 'Bewertung abgeben'}
          </button>
        </div>
      ) : (
        <p className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: '#f5ece0', color: '#c49a6c', border: '1px solid #e8c5a0' }}>
          Nur Premium-Nutzer koennen Rezepte bewerten.
        </p>
      )}

      {loading && <p className="text-xs" style={{ color: '#9c8c84' }}>Lade Bewertungen...</p>}
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
  onStartCooking?: (recipe: Recipe) => void;
}

export function RecipeDetailModal({
  recipe,
  isPremium = false,
  isAdmin = false,
  onClose,
  onEdit,
  onStartCooking,
}: RecipeDetailModalProps) {
  const [portions, setPortions] = useState(recipe.basePortions || 4);
  const [showIngredients, setShowIngredients] = useState(true);
  const [showSteps, setShowSteps] = useState(true);

  // Image slideshow
  const images = [recipe.imageUrl, recipe.imageZutaten, recipe.imageKochen].filter(Boolean) as string[];
  const [imgIndex, setImgIndex] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setImgIndex((i) => (i + 1) % images.length), 3000);
    return () => clearInterval(timer);
  }, [images.length]);

  const hasSteps = (recipe.steps?.length ?? 0) > 0;

  const timeTags = computeTimeTags(recipe.timeMinutes);
  const timeColor =
    timeTags.includes('Schnell (<20min)') ? { bg: '#e8f5e9', color: '#2e7d32' } :
    timeTags.includes('Einfach (<30min)') ? { bg: '#fff3e0', color: '#e65100' } :
    { bg: '#fce4ec', color: '#c62828' };

  // Trap scroll on body while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(44,36,32,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ backgroundColor: '#fff9f3', boxShadow: '0 24px 64px rgba(44,36,32,0.25)' }}
      >
        {/* Hero image — slideshow wenn mehrere Bilder vorhanden */}
        <div className="relative shrink-0 overflow-hidden" style={{ height: 240 }}>
          {images.length > 0 ? (
            <>
              {images.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={recipe.name}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                  style={{ opacity: i === imgIndex ? 1 : 0 }}
                />
              ))}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#f5ece0' }}>
              <UtensilsCrossed size={48} style={{ color: '#d4a090', opacity: 0.5 }} />
            </div>
          )}
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(44,36,32,0.3) 0%, transparent 40%, rgba(44,36,32,0.6) 100%)' }}
          />
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#2c2420' }}
          >
            <X size={18} />
          </button>
          {/* Edit button */}
          {(isAdmin || onEdit) && (
            <button
              onClick={() => onEdit?.(recipe)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#2c2420' }}
              title="Rezept bearbeiten"
            >
              <Pencil size={16} />
            </button>
          )}
          {/* Slideshow dots */}
          {images.length > 1 && (
            <div className="absolute bottom-12 right-4 flex gap-1">
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
          {/* Title overlay */}
          <div className="absolute bottom-4 left-5 right-5">
            <h2 className="text-white font-bold text-2xl leading-tight drop-shadow-md">{recipe.name}</h2>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ backgroundColor: '#efe9df', color: '#5a4e48' }}
              >
                {recipe.category}
              </span>
              <span
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold"
                style={timeColor}
              >
                <Clock size={11} />
                {recipe.timeMinutes} min
              </span>
              {recipe.tags?.includes('Mealprep-geeignet') && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: '#f5ece0', color: '#c49a6c' }}>
                  <Leaf size={11} />
                  Mealprep
                </span>
              )}
              {recipe.source && (
                <span className="text-xs" style={{ color: '#9c8c84' }}>Quelle: {recipe.source}</span>
              )}
            </div>

            {/* Description */}
            {recipe.description && (
              <p className="text-sm leading-relaxed" style={{ color: '#5a4e48' }}>{recipe.description}</p>
            )}

            {/* Portions scaler */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold" style={{ color: '#2c2420' }}>Portionen</span>
              <div className="flex items-center gap-2 rounded-xl px-1" style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff' }}>
                <button
                  onClick={() => setPortions((p) => Math.max(1, p - 1))}
                  className="w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors rounded-l-xl"
                  style={{ color: '#5a4e48' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5ece0')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-sm" style={{ color: '#2c2420' }}>{portions}</span>
                <button
                  onClick={() => setPortions((p) => Math.min(20, p + 1))}
                  className="w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors rounded-r-xl"
                  style={{ color: '#5a4e48' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5ece0')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  +
                </button>
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <button
                onClick={() => setShowIngredients((v) => !v)}
                className="flex items-center justify-between w-full mb-3"
              >
                <h3 className="font-bold text-base" style={{ color: '#2c2420' }}>Zutaten</h3>
                {showIngredients ? <ChevronUp size={18} style={{ color: '#9c8c84' }} /> : <ChevronDown size={18} style={{ color: '#9c8c84' }} />}
              </button>
              {showIngredients && <IngredientSection recipe={recipe} portions={portions} />}
            </div>

            {/* Steps */}
            {hasSteps && (
              <div>
                <button
                  onClick={() => setShowSteps((v) => !v)}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <h3 className="font-bold text-base" style={{ color: '#2c2420' }}>Zubereitung</h3>
                  {showSteps ? <ChevronUp size={18} style={{ color: '#9c8c84' }} /> : <ChevronDown size={18} style={{ color: '#9c8c84' }} />}
                </button>
                {showSteps && (
                  <ol className="space-y-3">
                    {recipe.steps!.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm" style={{ color: '#5a4e48' }}>
                        <span
                          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                          style={{ backgroundColor: '#b5614a', color: '#fff' }}
                        >
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {/* Tips */}
            {recipe.tips && (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f5ece0', border: '1px solid #e8c5a0' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#c49a6c' }}>Tipps</p>
                <p className="text-sm" style={{ color: '#5a4e48' }}>{recipe.tips}</p>
              </div>
            )}

            {/* Jetzt kochen — immer sichtbar, zwischen Zutaten und Bewertungen */}
            {onStartCooking && (
              <button
                onClick={() => onStartCooking(recipe)}
                className="w-full py-3 rounded-2xl font-bold text-base transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: hasSteps ? '#2c2420' : '#9c8c84',
                  color: '#fff',
                  cursor: hasSteps ? 'pointer' : 'default',
                }}
                title={hasSteps ? undefined : 'Keine Zubereitungsschritte hinterlegt'}
              >
                Jetzt kochen
              </button>
            )}

            {/* Ratings */}
            <div>
              <h3 className="font-bold text-base mb-3" style={{ color: '#2c2420' }}>Bewertungen</h3>
              <RatingsSection recipeId={recipe.id} isPremium={isPremium} />
            </div>

            {/* Bottom spacer */}
            <div style={{ height: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
