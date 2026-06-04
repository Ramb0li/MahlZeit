'use client';
import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Link, Pencil, Trash2, Clock, Archive, RotateCcw, ChevronDown, ChevronUp, Heart } from 'lucide-react';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
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

const DIET_FILTERS = [
  { key: 'meat',       icon: '🥩', label: 'Fleischhaltig', color: '#d9543b', bg: '#fce4dc' },
  { key: 'fish',       icon: '🐟', label: 'Pescetarisch',  color: '#1565c0', bg: '#deeafb' },
  { key: 'vegetarian', icon: '🌿', label: 'Vegetarisch',   color: '#2e7d32', bg: '#e4f3e5' },
  { key: 'vegan',      icon: '🌱', label: 'Vegan',         color: '#558b2f', bg: '#ecf4df' },
] as const;

type DietFilterKey = typeof DIET_FILTERS[number]['key'];

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
  const [filterDiet, setFilterDiet]         = useState<DietFilterKey | null>(null);
  const [showFavorites, setShowFavorites]   = useState(false);
  const [favorites, setFavorites]           = useState<Set<string>>(new Set());
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

  useEffect(() => {
    fetch('/api/favorites')
      .then(r => r.json())
      .then((ids: string[]) => setFavorites(new Set(ids)))
      .catch(() => {/* Favoriten nicht kritisch */});
  }, []);

  const toggleFavorite = async (recipeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nowFavorited = !favorites.has(recipeId);
    setFavorites(prev => {
      const next = new Set(prev);
      if (nowFavorited) next.add(recipeId); else next.delete(recipeId);
      return next;
    });
    try {
      await fetch('/api/favorites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, favorited: nowFavorited }),
      });
    } catch {
      setFavorites(prev => {
        const next = new Set(prev);
        if (nowFavorited) next.delete(recipeId); else next.add(recipeId);
        return next;
      });
    }
  };

  const toggleTag = (tag: string) => {
    setFilterTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const activeFiltered = useMemo(() => {
    return recipes.filter((r) => {
      if (r.archived) return false;
      if (showFavorites && !favorites.has(r.id)) return false;
      if (!showFavorites && filterCategory !== 'Alle' && r.category !== filterCategory) return false;
      if (filterTags.length > 0) {
        const recipeTags = [...(r.tags ?? []), ...computeTimeTags(r.timeMinutes)];
        if (!filterTags.every(t => recipeTags.includes(t))) return false;
      }
      if (filterDiet && r.dietCategory !== filterDiet) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (isRecipeExcluded(r, allergiesAndAversions)) return false;
      return true;
    });
  }, [recipes, search, filterCategory, filterTags, filterDiet, allergiesAndAversions, showFavorites, favorites]);

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

      {/* Page title */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#9a8c80' }}>Bibliothek</p>
          <h1 className="mz-view-title" style={{ marginBottom: 0 }}>Rezepte</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)} className="mz-btn-soft" title="Rezept importieren">
            <Link size={15} />
            <span className="mz-hide-sm">Importieren</span>
          </button>
          <button onClick={() => setIsCreating(true)} className="mz-btn-primary">
            <Plus size={15} />
            <span className="mz-hide-sm">Rezept hinzufügen</span>
          </button>
        </div>
      </div>

      {/* Search + diet icons + import */}
      <div className="mz-rfilters">
        <div className="mz-search-box" style={{ flex: 1 }}>
          <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Rezepte & Tags suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Diet filter icon buttons */}
        <div className="flex items-center gap-1">
          {DIET_FILTERS.map(({ key, icon, label, color, bg }) => {
            const active = filterDiet === key;
            return (
              <button
                key={key}
                onClick={() => setFilterDiet(active ? null : key)}
                title={label}
                className="w-8 h-8 rounded-full flex items-center justify-center text-base transition-all"
                style={active
                  ? { backgroundColor: bg, outline: `2px solid ${color}`, outlineOffset: 1 }
                  : { backgroundColor: '#efe9df' }
                }
              >
                {icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      {!showArchive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Category scroll */}
          <div className="mz-catscroll">
            <button
              onClick={() => { setShowFavorites(true); setFilterCategory('Alle'); }}
              className={`mz-chip${showFavorites ? ' on' : ''}`}
              style={showFavorites ? { background: '#e53935', color: '#fff', borderColor: '#e53935' } : {}}
            >
              <Heart size={11} fill={showFavorites ? 'currentColor' : 'none'} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Favoriten{favorites.size > 0 ? ` (${favorites.size})` : ''}
            </button>
            <button
              onClick={() => { setShowFavorites(false); setFilterCategory('Alle'); }}
              className={`mz-chip${!showFavorites && filterCategory === 'Alle' ? ' on' : ''}`}
            >
              Alle
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => { setShowFavorites(false); setFilterCategory(c); }}
                className={`mz-chip${!showFavorites && filterCategory === c ? ' on' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Tag chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Schnell (<20min)', 'Einfach (<30min)', ...(Object.values(TAG_GROUPS).flat())].map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={`mz-chip${filterTags.includes(tag) ? ' on' : ''}`}
                style={{ fontSize: 12, padding: '5px 10px' }}
              >
                {tag}
              </button>
            ))}
            {filterTags.length > 0 && (
              <button onClick={() => setFilterTags([])} className="mz-btn-soft" style={{ fontSize: 12, padding: '5px 10px' }}>
                Zurücksetzen
              </button>
            )}
          </div>
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
        <div className="mz-rgrid">
          {activeFiltered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              favorited={favorites.has(recipe.id)}
              onView={() => onViewRecipe?.(recipe)}
              onEdit={() => setEditRecipe(recipe)}
              onArchive={() => setArchiveId(recipe.id)}
              onToggleFavorite={(e) => toggleFavorite(recipe.id, e)}
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
          <RecipeForm recipe={editRecipe ?? undefined} onSave={handleSave} onCancel={() => { setIsCreating(false); setEditRecipe(null); }} uploadEndpoint="/api/upload" />
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
  favorited: boolean;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

function RecipeCard({ recipe, favorited, onView, onEdit, onArchive, onToggleFavorite }: RecipeCardProps) {
  const keyTags = (recipe.tags ?? []).filter(t =>
    ['Vegetarisch', 'Vegan', 'Mealprep-geeignet', 'Kinderfreundlich'].includes(t)
  ).slice(0, 2);

  return (
    <button className="mz-rcard" onClick={onView} style={{ textAlign: 'left' }}>
      <div className="mz-rcard-img">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt={recipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <PhotoSlot category={recipe.category} />
        )}
        {recipe.timeMinutes && (
          <span className="mz-rcard-time">
            <Clock size={10} />{recipe.timeMinutes} min
          </span>
        )}
        <button
          onClick={onToggleFavorite}
          style={{
            position: 'absolute', top: 8, left: 8,
            width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: favorited ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.55)',
            color: favorited ? '#e53935' : '#9c8c84',
            opacity: favorited ? 1 : 0,
            transition: '.15s',
          }}
          className="mz-fav-btn"
          title={favorited ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        >
          <Heart size={13} fill={favorited ? 'currentColor' : 'none'} />
        </button>
        <div
          style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, opacity: 0, transition: '.15s' }}
          className="group-hover:opacity-100"
          onClick={e => e.stopPropagation()}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        >
          <button onClick={onEdit} className="mz-detail-close" style={{ width: 28, height: 28 }} title="Bearbeiten">
            <Pencil size={11} />
          </button>
          <button onClick={onArchive} className="mz-detail-close" style={{ width: 28, height: 28 }} title="Archivieren">
            <Archive size={11} />
          </button>
        </div>
      </div>
      <div className="mz-rcard-body">
        <span className="mz-rcard-cat">{recipe.category}</span>
        <span className="mz-rcard-name mz-clamp2">{recipe.name}</span>
        <div className="mz-rcard-tags">
          {keyTags.map(tag => (
            <span key={tag} className="mz-chip" style={{ fontSize: 11, padding: '3px 8px', cursor: 'default' }}>{tag}</span>
          ))}
          {recipe.description && keyTags.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {recipe.description}
            </span>
          )}
        </div>
      </div>
    </button>
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
