'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Clock, Leaf, Archive, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { RecipeForm } from './RecipeForm';
import { Modal } from '@/components/ui/Modal';
import type { Recipe, Category, TimeLabel, DietType } from '@/types';

const DIET_OPTIONS: { value: DietType | 'Alle'; label: string }[] = [
  { value: 'Alle',         label: 'Alle' },
  { value: 'vegan',        label: '🌿 Vegan' },
  { value: 'vegetarisch',  label: '🥗 Vegetarisch' },
  { value: 'pescetarisch', label: '🐟 Pescetarisch' },
  { value: 'omnivor',      label: '🍖 Omnivor' },
];

const DIET_BADGE: Record<DietType, { label: string; cls: string }> = {
  vegan:        { label: '🌿 Vegan',         cls: 'bg-emerald-100 text-emerald-700' },
  vegetarisch:  { label: '🥗 Vegetarisch',   cls: 'bg-green-100 text-green-700' },
  pescetarisch: { label: '🐟 Pescetarisch',  cls: 'bg-sky-100 text-sky-700' },
  omnivor:      { label: '🍖 Omnivor',       cls: 'bg-orange-100 text-orange-700' },
};

const CATEGORIES: Category[] = [
  'Eier', 'Reis', 'Pasta', 'Eintopf/Gratin', 'Fisch',
  'Sonstige', 'Asiatisch', 'Ofen', 'Suppen', 'Salat/Bowl',
];

interface RecipeListProps {
  initialRecipes: Recipe[];
  onRecipesChange?: (recipes: Recipe[]) => void;
}

export function RecipeList({ initialRecipes, onRecipesChange }: RecipeListProps) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);

  const updateRecipes = (updater: (prev: Recipe[]) => Recipe[]) => {
    setRecipes((prev) => {
      const next = updater(prev);
      onRecipesChange?.(next);
      return next;
    });
  };

  const [search, setSearch]             = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'Alle'>('Alle');
  const [filterTime, setFilterTime]     = useState<TimeLabel | 'Alle'>('Alle');
  const [filterDiet, setFilterDiet]     = useState<DietType | 'Alle'>('Alle');
  const [editRecipe, setEditRecipe]     = useState<Recipe | null>(null);
  const [isCreating, setIsCreating]     = useState(false);
  const [showArchive, setShowArchive]   = useState(false);

  // Bestätigung: archivieren (id) oder endgültig löschen (id)
  const [archiveId, setArchiveId]       = useState<string | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);

  const categoryColors: Record<Category, string> = {
    'Eier':           'bg-yellow-100 text-yellow-700',
    'Reis':           'bg-amber-100 text-amber-700',
    'Pasta':          'bg-orange-100 text-orange-700',
    'Eintopf/Gratin': 'bg-red-100 text-red-700',
    'Fisch':          'bg-blue-100 text-blue-700',
    'Sonstige':       'bg-gray-100 text-gray-600',
    'Asiatisch':      'bg-rose-100 text-rose-700',
    'Ofen':           'bg-purple-100 text-purple-700',
    'Suppen':         'bg-teal-100 text-teal-700',
    'Salat/Bowl':     'bg-green-100 text-green-700',
  };

  // ─── gefilterte Listen ────────────────────────────────────────────────────

  const activeFiltered = useMemo(() => {
    return recipes.filter((r) => {
      if (r.archived) return false;
      if (filterCategory !== 'Alle' && r.category !== filterCategory) return false;
      if (filterTime    !== 'Alle' && r.timeLabel  !== filterTime)    return false;
      if (filterDiet    !== 'Alle' && r.dietType   !== filterDiet)    return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, search, filterCategory, filterTime, filterDiet]);

  const archivedFiltered = useMemo(() => {
    return recipes.filter((r) => {
      if (!r.archived) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, search]);

  const archivedCount = recipes.filter((r) => r.archived).length;

  // ─── API-Aktionen ─────────────────────────────────────────────────────────

  const handleSave = async (recipe: Recipe) => {
    const isNew   = !recipes.find((r) => r.id === recipe.id);
    const method  = isNew ? 'POST' : 'PUT';
    const res     = await fetch('/api/recipes', {
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

  // Ins Archiv verschieben
  const handleArchive = async (id: string) => {
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    const archived = { ...recipe, archived: true };
    await fetch('/api/recipes', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(archived),
    });
    updateRecipes((prev) => prev.map((r) => (r.id === id ? archived : r)));
    setArchiveId(null);
  };

  // Aus Archiv wiederherstellen
  const handleRestore = async (id: string) => {
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    const restored = { ...recipe, archived: false };
    await fetch('/api/recipes', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(restored),
    });
    updateRecipes((prev) => prev.map((r) => (r.id === id ? restored : r)));
  };

  // Endgültig löschen (nur aus dem Archiv heraus)
  const handlePermanentDelete = async (id: string) => {
    await fetch('/api/recipes', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    });
    updateRecipes((prev) => prev.filter((r) => r.id !== id));
    setDeleteId(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Suchleiste + Buttons */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rezept suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white rounded-xl text-sm font-medium hover:bg-brand-green-dark transition-colors shrink-0"
        >
          <Plus size={16} />
          Neues Rezept
        </button>
      </div>

      {/* Kategorie-Filter (nur bei aktiven Rezepten) */}
      {!showArchive && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['Alle', ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterCategory === cat
                    ? 'bg-brand-green text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
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
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterTime === t
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DIET_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterDiet(value as DietType | 'Alle')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterDiet === value
                    ? 'bg-brand-green text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Zähler + Archiv-Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {showArchive
            ? `${archivedFiltered.length} archivierte Rezepte`
            : `${activeFiltered.length} Rezepte`}
        </p>
        {(archivedCount > 0 || showArchive) && (
          <button
            onClick={() => setShowArchive((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              showArchive
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Archive size={13} />
            {archivedCount > 0 ? `Archiv (${archivedCount})` : 'Archiv'}
            {showArchive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* ── Aktive Rezepte ─────────────────────────────────────────────────── */}
      {!showArchive && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeFiltered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              categoryColors={categoryColors}
              onEdit={() => setEditRecipe(recipe)}
              onArchive={() => setArchiveId(recipe.id)}
            />
          ))}
        </div>
      )}

      {/* ── Archiv-Ansicht ─────────────────────────────────────────────────── */}
      {showArchive && (
        <>
          {archivedFiltered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
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

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {(isCreating || editRecipe) && (
        <Modal
          open
          onClose={() => { setIsCreating(false); setEditRecipe(null); }}
          title={isCreating ? 'Neues Rezept' : 'Rezept bearbeiten'}
          size="xl"
        >
          <RecipeForm
            recipe={editRecipe ?? undefined}
            onSave={handleSave}
            onCancel={() => { setIsCreating(false); setEditRecipe(null); }}
          />
        </Modal>
      )}

      {/* Archivieren-Bestätigung */}
      {archiveId && (
        <Modal open onClose={() => setArchiveId(null)} title="Rezept archivieren" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Das Rezept wird ins Archiv verschoben. Es wird nicht mehr vorgeschlagen und
              erscheint nicht im Menüpicker — kann aber jederzeit wiederhergestellt werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setArchiveId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleArchive(archiveId)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors"
              >
                <Archive size={14} />
                Archivieren
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Endgültig löschen-Bestätigung (nur aus Archiv) */}
      {deleteId && (
        <Modal open onClose={() => setDeleteId(null)} title="Rezept endgültig löschen" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Das Rezept wird <strong>endgültig</strong> gelöscht und kann nicht
              wiederhergestellt werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handlePermanentDelete(deleteId)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
              >
                <Trash2 size={14} />
                Endgültig löschen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Aktive Rezept-Karte ─────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: Recipe;
  categoryColors: Record<Category, string>;
  onEdit: () => void;
  onArchive: () => void;
}

function RecipeCard({ recipe, categoryColors, onEdit, onArchive }: RecipeCardProps) {
  return (
    <div className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-gray-900 text-sm leading-snug">{recipe.name}</h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Bearbeiten"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onArchive}
            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-400 transition-colors"
            title="Archivieren"
          >
            <Archive size={14} />
          </button>
        </div>
      </div>

      {recipe.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{recipe.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[recipe.category]}`}>
          {recipe.category}
        </span>
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
          recipe.timeLabel === 'schnell' ? 'bg-green-100 text-green-700' :
          recipe.timeLabel === 'mittel'  ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          <Clock size={10} />
          {recipe.timeMinutes} min
        </span>
        {recipe.isMealprep && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
            <Leaf size={10} />
            Mealprep
          </span>
        )}
        {recipe.isSuitableForLunch && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">
            Mittag
          </span>
        )}
        {recipe.dietType && DIET_BADGE[recipe.dietType] && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIET_BADGE[recipe.dietType].cls}`}>
            {DIET_BADGE[recipe.dietType].label}
          </span>
        )}
      </div>

      <div className="mt-2">
        <p className="text-xs text-gray-400">
          {recipe.ingredients.length} Zutaten · {recipe.basePortions} Portionen
        </p>
      </div>
    </div>
  );
}

// ─── Archivierte Rezept-Karte ────────────────────────────────────────────────

interface ArchivedRecipeCardProps {
  recipe: Recipe;
  categoryColors: Record<Category, string>;
  onRestore: () => void;
  onDelete: () => void;
}

function ArchivedRecipeCard({ recipe, categoryColors, onRestore, onDelete }: ArchivedRecipeCardProps) {
  return (
    <div className="group relative bg-gray-50 border border-gray-150 rounded-2xl p-4 shadow-sm opacity-70 hover:opacity-100 transition-all">
      {/* Archiv-Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 font-medium">
        <Archive size={9} />
        Archiv
      </div>

      <div className="pr-16 mb-2">
        <h3 className="font-medium text-gray-600 text-sm leading-snug">{recipe.name}</h3>
      </div>

      {recipe.description && (
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">{recipe.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
          {recipe.category}
        </span>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
          <Clock size={10} />
          {recipe.timeMinutes} min
        </span>
      </div>

      {/* Aktionen */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={onRestore}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
        >
          <RotateCcw size={12} />
          Wiederherstellen
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Endgültig löschen"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
