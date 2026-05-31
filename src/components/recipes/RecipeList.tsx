'use client';
import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Link, Pencil, Trash2, Clock, Archive, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { RecipeForm } from './RecipeForm';
import { ImportRecipeModal } from './ImportRecipeModal';
import { Modal } from '@/components/ui/Modal';
import { isRecipeExcluded } from '@/lib/allergens';
import { type Recipe, type Category, TAG_GROUPS, computeTimeTags } from '@/types';

const CATEGORIES: Category[] = [
  'Frühstück', 'Snacks & Vorspeisen', 'Suppen, Eintöpfe & Currys',
  'Salate & Bowls', 'Pasta', 'Reis & Getreide', 'Kartoffelgerichte',
  'Fleisch & Geflügel', 'Fisch & Meeresfrüchte', 'Vegetarische Hauptgerichte',
  'Aufläufe & Gratins', 'Wraps & Sandwiches', 'Desserts & Süsses',
];

const CAT_COLORS: Record<Category, { bg: string; color: string }> = {
  'Frühstück':                  { bg: '#fff8e1', color: '#f57f17' },
  'Snacks & Vorspeisen':        { bg: '#f3e5f5', color: '#6a1b9a' },
  'Suppen, Eintöpfe & Currys':  { bg: '#e0f2f1', color: '#00695c' },
  'Salate & Bowls':             { bg: '#e8f5e9', color: '#2e7d32' },
  'Pasta':                      { bg: '#f2e5e0', color: '#b5614a' },
  'Reis & Getreide':            { bg: '#f5ece0', color: '#c49a6c' },
  'Kartoffelgerichte':          { bg: '#fdf3e7', color: '#bf6000' },
  'Fleisch & Geflügel':         { bg: '#fce4ec', color: '#c62828' },
  'Fisch & Meeresfrüchte':      { bg: '#e3f2fd', color: '#1565c0' },
  'Vegetarische Hauptgerichte': { bg: '#f1f8e9', color: '#558b2f' },
  'Aufläufe & Gratins':         { bg: '#ede7f6', color: '#4527a0' },
  'Wraps & Sandwiches':         { bg: '#fbe9e7', color: '#bf360c' },
  'Desserts & Süsses':          { bg: '#fce4ec', color: '#880e4f' },
};

const chipActive   = { backgroundColor: '#b5614a', color: '#fff' };
const chipInactive = { backgroundColor: '#efe9df', color: '#5a4e48', border: '1.5px solid #e0d8ce' };
const chipTagActive = { backgroundColor: '#4a7a4e', color: '#fff' };

interface RecipeListProps {
  initialRecipes: Recipe[];
  allergiesAndAversions?: string[];
  isPremium?: boolean;
  onRecipesChange?: (recipes: Recipe[]) => void;
  onViewRecipe?: (recipe: Recipe) => void;
  requestEditRecipe?: Recipe | null;
  onEditRequestConsumed?: () => void;
}

export function RecipeList({ initialRecipes, allergiesAndAversions = [], isPremium = false, onRecipesChange, onViewRecipe, requestEditRecipe, onEditRequestConsumed }: RecipeListProps) {
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
  const [filterTags, setFilterTags]         = useState<string[]>([]);
  const [editRecipe, setEditRecipe]         = useState<Recipe | null>(null);
  const [isCreating, setIsCreating]         = useState(false);
  const [showArchive, setShowArchive]       = useState(false);
  const [archiveId, setArchiveId]           = useState<string | null>(null);
  const [deleteId, setDeleteId]             = useState<string | null>(null);
  const [importOpen, setImportOpen]         = useState(false);

  useEffect(() => {
    if (!requestEditRecipe) return;
    setEditRecipe(requestEditRecipe);
    setIsCreating(false);
    setShowArchive(false);
    onEditRequestConsumed?.();
  }, [requestEditRecipe]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = (tag: string) => {
    setFilterTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const activeFiltered = useMemo(() => {
    return recipes.filter((r) => {
      if (r.archived) return false;
      if (filterCategory !== 'Alle' && r.category !== filterCategory) return false;
      if (filterTags.length > 0) {
        const recipeTags = [...(r.tags ?? []), ...computeTimeTags(r.timeMinutes)];
        if (!filterTags.every(t => recipeTags.includes(t))) return false;
      }
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (isRecipeExcluded(r, allergiesAndAversions)) return false;
      return true;
    });
  }, [recipes, search, filterCategory, filterTags, allergiesAndAversions]);

  const archivedFiltered = useMemo(() => {
    return recipes.filter((r) => {
      if (!r.archived) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, search]);

  const archivedCount = recipes.filter((r) => r.archived).length;

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

      {/* Filters */}
      {!showArchive && (
        <div className="space-y-2">
          {/* Category dropdown */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as Category | 'Alle')}
            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3', color: '#2c2420', cursor: 'pointer' }}
          >
            <option value="Alle">Alle Kategorien</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Zeit chips (computed) */}
          <div className="flex flex-wrap gap-1.5">
            {['Schnell (<20min)', 'Einfach (<30min)'].map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                style={filterTags.includes(tag) ? { backgroundColor: '#2c2420', color: '#fff' } : chipInactive}
              >
                ⏱ {tag}
              </button>
            ))}
          </div>

          {/* Tag groups */}
          {(Object.entries(TAG_GROUPS) as [string, readonly string[]][]).map(([group, tags]) => (
            <div key={group} className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide w-full" style={{ color: '#9c8c84' }}>{group}</span>
              {tags.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                  style={filterTags.includes(tag) ? chipTagActive : chipInactive}
                >
                  {tag}
                </button>
              ))}
            </div>
          ))}

          {filterTags.length > 0 && (
            <button
              onClick={() => setFilterTags([])}
              className="text-xs px-2 py-0.5 rounded-full transition-all"
              style={{ color: '#b5614a', border: '1px solid #b5614a' }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeFiltered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onView={() => onViewRecipe?.(recipe)}
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
              Das Rezept wird ins Archiv verschoben und nicht mehr vorgeschlagen.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveId(null)} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ color: '#5a4e48' }}>Abbrechen</button>
              <button onClick={() => handleArchive(archiveId)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white" style={{ backgroundColor: '#c49a6c' }}>
                <Archive size={14} />Archivieren
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal open onClose={() => setDeleteId(null)} title="Rezept endgültig löschen" size="sm">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#5a4e48' }}>Das Rezept wird <strong>endgültig</strong> gelöscht.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium rounded-xl" style={{ color: '#5a4e48' }}>Abbrechen</button>
              <button onClick={() => handlePermanentDelete(deleteId)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white" style={{ backgroundColor: '#c62828' }}>
                <Trash2 size={14} />Endgültig löschen
              </button>
            </div>
          </div>
        </Modal>
      )}

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
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

function RecipeCard({ recipe, onView, onEdit, onArchive }: RecipeCardProps) {
  const catColor = CAT_COLORS[recipe.category] ?? { bg: '#efe9df', color: '#5a4e48' };
  const timeTags = computeTimeTags(recipe.timeMinutes);
  const isSchnell = timeTags.includes('Schnell (<20min)');
  const timeStyle = isSchnell
    ? { backgroundColor: '#e8f5e9', color: '#2e7d32' }
    : timeTags.includes('Einfach (<30min)')
      ? { backgroundColor: '#fff3e0', color: '#e65100' }
      : { backgroundColor: '#fce4ec', color: '#c62828' };

  const keyTags = (recipe.tags ?? []).filter(t =>
    ['Vegetarisch', 'Vegan', 'Mealprep-geeignet'].includes(t)
  ).slice(0, 2);

  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all cursor-pointer flex flex-col"
      style={{
        backgroundColor: '#fff9f3',
        border: '1px solid #e0d8ce',
        boxShadow: '0 2px 12px rgba(44,36,32,0.05)',
      }}
      onClick={onView}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#b5614a';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(44,36,32,0.12)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#e0d8ce';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(44,36,32,0.05)';
      }}
    >
      <div className="relative overflow-hidden shrink-0" style={{ aspectRatio: '4 / 3' }}>
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: catColor.bg }}>
            <span style={{ fontSize: 40, opacity: 0.35 }}>🍽</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80" style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#2c2420' }} title="Bearbeiten">
            <Pencil size={12} />
          </button>
          <button onClick={onArchive} className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80" style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#c49a6c' }} title="Archivieren">
            <Archive size={12} />
          </button>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col gap-2">
        <h3 className="font-bold text-sm leading-snug" style={{ color: '#2c2420' }}>{recipe.name}</h3>
        <div className="flex flex-wrap gap-1">
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: catColor.bg, color: catColor.color }}>
            {recipe.category}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold" style={timeStyle}>
            <Clock size={9} />{recipe.timeMinutes} min
          </span>
          {keyTags.map(tag => (
            <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#f1f8e9', color: '#558b2f' }}>
              {tag}
            </span>
          ))}
        </div>
        {recipe.description && (
          <p className="text-xs line-clamp-2 mt-auto" style={{ color: '#9c8c84' }}>{recipe.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Archived recipe card ────────────────────────────────────────────────────

interface ArchivedRecipeCardProps {
  recipe: Recipe;
  onRestore: () => void;
  onDelete: () => void;
}

function ArchivedRecipeCard({ recipe, onRestore, onDelete }: ArchivedRecipeCardProps) {
  return (
    <div className="group relative rounded-2xl p-4 opacity-65 hover:opacity-100 transition-all" style={{ backgroundColor: '#f7f4ee', border: '1px solid #e0d8ce' }}>
      <div className="absolute top-3 right-3 flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold" style={{ backgroundColor: '#f5ece0', color: '#c49a6c', border: '1px solid #e0d8ce' }}>
        <Archive size={9} />Archiv
      </div>
      <div className="pr-16 mb-2">
        <h3 className="font-medium text-sm leading-snug" style={{ color: '#9c8c84' }}>{recipe.name}</h3>
      </div>
      {recipe.description && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: '#9c8c84' }}>{recipe.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#efe9df', color: '#9c8c84' }}>{recipe.category}</span>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#efe9df', color: '#9c8c84' }}>
          <Clock size={10} />{recipe.timeMinutes} min
        </span>
      </div>
      <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #e0d8ce' }}>
        <button onClick={onRestore} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold" style={{ border: '1px solid #e0d8ce', color: '#5a4e48', backgroundColor: '#fff9f3' }}>
          <RotateCcw size={12} />Wiederherstellen
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg" style={{ color: '#9c8c84' }} title="Endgültig löschen">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
