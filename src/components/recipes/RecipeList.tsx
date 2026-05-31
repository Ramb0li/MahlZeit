'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, Link, Pencil, Trash2, Clock, Leaf, Archive, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { RecipeForm } from './RecipeForm';
import { ImportRecipeModal } from './ImportRecipeModal';
import { Modal } from '@/components/ui/Modal';
import { isRecipeExcluded } from '@/lib/allergens';
import type { Recipe, Category, TimeLabel, DietType, DietCategory } from '@/types';

const DIET_BADGE: Record<DietType, { label: string; bg: string; color: string }> = {
  vegan:          { label: '🌿 Vegan',         bg: '#f5ece0', color: '#c49a6c' },
  vegetarisch:    { label: '🥗 Vegetarisch',   bg: '#f2e5e0', color: '#b5614a' },
  pescetarisch:   { label: '🐟 Pescetarisch',  bg: '#e8dfd3', color: '#5a4e48' },
  fleischhaltig:  { label: '🥩 Fleischhaltig', bg: '#fce4ec', color: '#c62828' },
  flexitarisch:   { label: '🌾 Flexitarisch',  bg: '#fff3e0', color: '#e65100' },
};

/** Filter-Tabs basierend auf dem neuen dietCategory-Feld */
const DIET_CAT_TABS: { value: DietCategory | 'alle'; label: string }[] = [
  { value: 'alle',        label: 'Alle Rezepte' },
  { value: 'meat',        label: '🥩 Fleischhaltig' },
  { value: 'fish',        label: '🐟 Pescetarisch' },
  { value: 'vegetarian',  label: '🥗 Vegetarisch' },
  { value: 'vegan',       label: '🌿 Vegan' },
];

const CATEGORIES: Category[] = [
  'Eier', 'Reis', 'Pasta', 'Eintopf/Gratin', 'Fisch',
  'Sonstige', 'Asiatisch', 'Ofen', 'Suppen', 'Salat/Bowl',
  'Frühstück', 'Süsses', 'Brot & Aufstrich', 'Snacks',
];

// Chip helpers
const chipActive   = { backgroundColor: '#b5614a', color: '#fff' };
const chipInactive = { backgroundColor: '#efe9df', color: '#5a4e48', border: '1.5px solid #e0d8ce' };
const chipDarkActive = { backgroundColor: '#2c2420', color: '#fff' };

interface RecipeListProps {
  initialRecipes: Recipe[];
  allergiesAndAversions?: string[];
  isPremium?: boolean;
  onRecipesChange?: (recipes: Recipe[]) => void;
}

export function RecipeList({ initialRecipes, allergiesAndAversions = [], isPremium = false, onRecipesChange }: RecipeListProps) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);

  const updateRecipes = (updater: (prev: Recipe[]) => Recipe[]) => {
    setRecipes((prev) => {
      const next = updater(prev);
      onRecipesChange?.(next);
      return next;
    });
  };

  const [search, setSearch]                 = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'Alle'>('Alle');
  const [filterTime, setFilterTime]         = useState<TimeLabel | 'Alle'>('Alle');
  const [filterDietCat, setFilterDietCat]   = useState<DietCategory | 'alle'>('alle');
  const [editRecipe, setEditRecipe]         = useState<Recipe | null>(null);
  const [isCreating, setIsCreating]         = useState(false);
  const [showArchive, setShowArchive]       = useState(false);

  const [archiveId, setArchiveId]   = useState<string | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Category badge colours — warm palette variants
  const categoryColors: Record<Category, { bg: string; color: string }> = {
    'Eier':           { bg: '#fff3e0', color: '#e65100' },
    'Reis':           { bg: '#f5ece0', color: '#c49a6c' },
    'Pasta':          { bg: '#f2e5e0', color: '#b5614a' },
    'Eintopf/Gratin': { bg: '#fce4ec', color: '#c62828' },
    'Fisch':          { bg: '#e3f2fd', color: '#1565c0' },
    'Sonstige':       { bg: '#efe9df', color: '#5a4e48' },
    'Asiatisch':      { bg: '#fce4ec', color: '#ad1457' },
    'Ofen':           { bg: '#ede7f6', color: '#4527a0' },
    'Suppen':         { bg: '#e0f2f1', color: '#00695c' },
    'Salat/Bowl':     { bg: '#e8f5e9', color: '#2e7d32' },
    'Frühstück':      { bg: '#fff8e1', color: '#f57f17' },
    'Süsses':         { bg: '#fce4ec', color: '#880e4f' },
    'Brot & Aufstrich': { bg: '#efebe9', color: '#4e342e' },
    'Snacks':         { bg: '#f3e5f5', color: '#6a1b9a' },
  };

  // ─── filtered lists ───────────────────────────────────────────────────────
  const activeFiltered = useMemo(() => {
    return recipes.filter((r) => {
      if (r.archived) return false;
      if (filterCategory !== 'Alle' && r.category !== filterCategory) return false;
      if (filterTime     !== 'Alle' && r.timeLabel !== filterTime)     return false;
      // dietCategory-Filter (Phase 2)
      if (filterDietCat !== 'alle') {
        // "Pescetarisch"-Tab: zeigt fish + vegetarian + vegan
        if (filterDietCat === 'fish') {
          if (!r.dietCategory || !['fish', 'vegetarian', 'vegan'].includes(r.dietCategory)) return false;
        } else if (filterDietCat === 'vegetarian') {
          if (!r.dietCategory || !['vegetarian', 'vegan'].includes(r.dietCategory)) return false;
        } else {
          if (r.dietCategory !== filterDietCat) return false;
        }
      }
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, search, filterCategory, filterTime, filterDietCat]);

  const archivedFiltered = useMemo(() => {
    return recipes.filter((r) => {
      if (!r.archived) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, search]);

  const archivedCount = recipes.filter((r) => r.archived).length;

  // ─── API actions ──────────────────────────────────────────────────────────
  const handleSave = async (recipe: Recipe) => {
    const isNew  = !recipes.find((r) => r.id === recipe.id);
    const method = isNew ? 'POST' : 'PUT';
    const res    = await fetch('/api/recipes', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    });
    const saved = await res.json();
    if (isNew) {
      updateRecipes((prev) => [...prev, saved]);
    } else {
      updateRecipes((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    }
    setEditRecipe(null);
    setIsCreating(false);
  };

  const handleArchive = async (id: string) => {
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    const archived = { ...recipe, archived: true };
    await fetch('/api/recipes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(archived) });
    updateRecipes((prev) => prev.map((r) => (r.id === id ? archived : r)));
    setArchiveId(null);
  };

  const handleRestore = async (id: string) => {
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    const restored = { ...recipe, archived: false };
    await fetch('/api/recipes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(restored) });
    updateRecipes((prev) => prev.map((r) => (r.id === id ? restored : r)));
  };

  const handlePermanentDelete = async (id: string) => {
    await fetch('/api/recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    updateRecipes((prev) => prev.filter((r) => r.id !== id));
    setDeleteId(null);
  };

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Search + action buttons */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9c8c84' }} />
          <input
            type="text"
            placeholder="Rezept suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3', color: '#2c2420' }}
          />
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-opacity hover:opacity-80 border"
          style={{ borderColor: '#4a7a4e', color: '#4a7a4e', backgroundColor: '#f2f6f2' }}
          title="Rezept von URL oder Screenshot importieren"
        >
          <Link size={15} />
          <span className="hidden sm:inline">Importieren</span>
        </button>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#b5614a', color: '#fff' }}
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Neues Rezept</span>
          <span className="sm:hidden">Neu</span>
        </button>
      </div>

      {/* Filters — only for active recipes */}
      {!showArchive && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['Alle', ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                style={filterCategory === cat ? chipActive : chipInactive}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            {(['Alle', 'schnell', 'mittel', 'aufwändig'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterTime(t)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                style={filterTime === t ? chipDarkActive : chipInactive}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Diet-Kategorie-Tabs (Phase 2) */}
          <div className="flex flex-wrap gap-1.5">
            {DIET_CAT_TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterDietCat(value as DietCategory | 'alle')}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                style={filterDietCat === value ? chipActive : chipInactive}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Count + archive toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: '#9c8c84' }}>
          {showArchive
            ? `${archivedFiltered.length} archivierte Rezepte`
            : `${activeFiltered.length} Rezepte`}
        </p>
        {(archivedCount > 0 || showArchive) && (
          <button
            onClick={() => setShowArchive((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={showArchive
              ? { backgroundColor: '#f5ece0', color: '#c49a6c', border: '1px solid #d4a090' }
              : { border: '1px solid #e0d8ce', color: '#9c8c84' }}
          >
            <Archive size={13} />
            {archivedCount > 0 ? `Archiv (${archivedCount})` : 'Archiv'}
            {showArchive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Active recipes */}
      {!showArchive && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeFiltered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              categoryColors={categoryColors}
              isExcluded={isRecipeExcluded(recipe, allergiesAndAversions)}
              onEdit={() => setEditRecipe(recipe)}
              onArchive={() => setArchiveId(recipe.id)}
            />
          ))}
        </div>
      )}

      {/* Archive view */}
      {showArchive && (
        <>
          {archivedFiltered.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: '#9c8c84' }}>
              {search ? 'Keine archivierten Rezepte gefunden.' : 'Das Archiv ist leer.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {archivedFiltered.map((recipe) => (
                <ArchivedRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  categoryColors={categoryColors}
                  onRestore={() => handleRestore(recipe.id)}
                  onDelete={() => setDeleteId(recipe.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {(isCreating || editRecipe) && (
        <Modal
          open
          onClose={() => { setIsCreating(false); setEditRecipe(null); }}
          title={
            isCreating && editRecipe ? 'Importiertes Rezept überprüfen' :
            isCreating ? 'Neues Rezept' : 'Rezept bearbeiten'
          }
          size="xl"
        >
          <RecipeForm recipe={editRecipe ?? undefined} onSave={handleSave} onCancel={() => { setIsCreating(false); setEditRecipe(null); }} />
        </Modal>
      )}

      {archiveId && (
        <Modal open onClose={() => setArchiveId(null)} title="Rezept archivieren" size="sm">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#5a4e48' }}>
              Das Rezept wird ins Archiv verschoben. Es wird nicht mehr vorgeschlagen und
              erscheint nicht im Menüpicker — kann aber jederzeit wiederhergestellt werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveId(null)} className="px-4 py-2 text-sm font-medium rounded-xl transition-colors" style={{ color: '#5a4e48' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleArchive(archiveId)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#c49a6c' }}
              >
                <Archive size={14} />
                Archivieren
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal open onClose={() => setDeleteId(null)} title="Rezept endgültig löschen" size="sm">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#5a4e48' }}>
              Das Rezept wird <strong>endgültig</strong> gelöscht und kann nicht wiederhergestellt werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium rounded-xl transition-colors" style={{ color: '#5a4e48' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Abbrechen
              </button>
              <button
                onClick={() => handlePermanentDelete(deleteId)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#c62828' }}
              >
                <Trash2 size={14} />
                Endgültig löschen
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import modal */}
      {importOpen && (
        <ImportRecipeModal
          isPremium={isPremium}
          onClose={() => setImportOpen(false)}
          onImported={(recipe) => {
            setImportOpen(false);
            setEditRecipe(recipe);
            setIsCreating(true);
          }}
        />
      )}
    </div>
  );
}

// ─── Active recipe card ──────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: Recipe;
  categoryColors: Record<Category, { bg: string; color: string }>;
  isExcluded?: boolean;
  onEdit: () => void;
  onArchive: () => void;
}

function RecipeCard({ recipe, categoryColors, isExcluded = false, onEdit, onArchive }: RecipeCardProps) {
  const catColor = categoryColors[recipe.category] ?? { bg: '#efe9df', color: '#5a4e48' };
  const hasImage = !!recipe.imageUrl;
  return (
    <div
      className="group rounded-2xl p-4 transition-all cursor-default relative overflow-hidden"
      style={{
        backgroundColor: '#fff9f3',
        border: isExcluded ? '1px solid #e8c5b5' : '1px solid #e0d8ce',
        boxShadow: '0 2px 12px rgba(44,36,32,0.05)',
        opacity: isExcluded ? 0.45 : 1,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#d4a090';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(44,36,32,0.09)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#e0d8ce';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(44,36,32,0.05)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Background food photo — subtle, text stays readable */}
      {hasImage && (
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            backgroundImage: `url(${recipe.imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.13,
            pointerEvents: 'none',
          }}
        />
      )}
      <div className="relative">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm leading-snug" style={{ color: '#2c2420' }}>{recipe.name}</h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#9c8c84' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Bearbeiten"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onArchive}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#c49a6c' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5ece0')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Archivieren"
          >
            <Archive size={13} />
          </button>
        </div>
      </div>

      {recipe.description && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: '#9c8c84' }}>{recipe.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: catColor.bg, color: catColor.color }}>
          {recipe.category}
        </span>
        <span
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
          style={
            recipe.timeLabel === 'schnell' ? { backgroundColor: '#e8f5e9', color: '#2e7d32' } :
            recipe.timeLabel === 'mittel'  ? { backgroundColor: '#fff3e0', color: '#e65100' } :
            { backgroundColor: '#fce4ec', color: '#c62828' }
          }
        >
          <Clock size={10} />
          {recipe.timeMinutes} min
        </span>
        {recipe.isMealprep && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#f5ece0', color: '#c49a6c' }}>
            <Leaf size={10} />
            Mealprep
          </span>
        )}
        {recipe.isSuitableForLunch && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#e3f2fd', color: '#1565c0' }}>
            Mittag
          </span>
        )}
        {recipe.dietType && DIET_BADGE[recipe.dietType] && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: DIET_BADGE[recipe.dietType].bg, color: DIET_BADGE[recipe.dietType].color }}>
            {DIET_BADGE[recipe.dietType].label}
          </span>
        )}
      </div>

      <div className="mt-2">
        <p className="text-xs" style={{ color: '#9c8c84' }}>
          {recipe.ingredients.length} Zutaten · {recipe.basePortions} Portionen
        </p>
      </div>
      </div>{/* /relative */}
    </div>
  );
}

// ─── Archived recipe card ────────────────────────────────────────────────────

interface ArchivedRecipeCardProps {
  recipe: Recipe;
  categoryColors: Record<Category, { bg: string; color: string }>;
  onRestore: () => void;
  onDelete: () => void;
}

function ArchivedRecipeCard({ recipe, onRestore, onDelete }: ArchivedRecipeCardProps) {
  return (
    <div
      className="group relative rounded-2xl p-4 opacity-65 hover:opacity-100 transition-all"
      style={{ backgroundColor: '#f7f4ee', border: '1px solid #e0d8ce' }}
    >
      {/* Archive badge */}
      <div
        className="absolute top-3 right-3 flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold"
        style={{ backgroundColor: '#f5ece0', color: '#c49a6c', border: '1px solid #e0d8ce' }}
      >
        <Archive size={9} />
        Archiv
      </div>

      <div className="pr-16 mb-2">
        <h3 className="font-medium text-sm leading-snug" style={{ color: '#9c8c84' }}>{recipe.name}</h3>
      </div>

      {recipe.description && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: '#9c8c84' }}>{recipe.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#efe9df', color: '#9c8c84' }}>
          {recipe.category}
        </span>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#efe9df', color: '#9c8c84' }}>
          <Clock size={10} />
          {recipe.timeMinutes} min
        </span>
      </div>

      <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #e0d8ce' }}>
        <button
          onClick={onRestore}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ border: '1px solid #e0d8ce', color: '#5a4e48', backgroundColor: '#fff9f3' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#b5614a'; (e.currentTarget as HTMLElement).style.color = '#b5614a'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e0d8ce'; (e.currentTarget as HTMLElement).style.color = '#5a4e48'; }}
        >
          <RotateCcw size={12} />
          Wiederherstellen
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: '#9c8c84' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
          title="Endgültig löschen"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
