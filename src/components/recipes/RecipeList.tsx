'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Clock, Leaf } from 'lucide-react';
import { RecipeForm } from './RecipeForm';
import { Modal } from '@/components/ui/Modal';
import type { Recipe, Category, TimeLabel } from '@/types';

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
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'Alle'>('Alle');
  const [filterTime, setFilterTime] = useState<TimeLabel | 'Alle'>('Alle');
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (filterCategory !== 'Alle' && r.category !== filterCategory) return false;
      if (filterTime !== 'Alle' && r.timeLabel !== filterTime) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, search, filterCategory, filterTime]);

  const handleSave = async (recipe: Recipe) => {
    const isNew = !recipes.find((r) => r.id === recipe.id);
    const method = isNew ? 'POST' : 'PUT';
    const res = await fetch('/api/recipes', {
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

  const handleDelete = async (id: string) => {
    await fetch('/api/recipes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    updateRecipes((prev) => prev.filter((r) => r.id !== id));
    setDeleteId(null);
  };

  const categoryColors: Record<Category, string> = {
    'Eier': 'bg-yellow-100 text-yellow-700',
    'Reis': 'bg-amber-100 text-amber-700',
    'Pasta': 'bg-orange-100 text-orange-700',
    'Eintopf/Gratin': 'bg-red-100 text-red-700',
    'Fisch': 'bg-blue-100 text-blue-700',
    'Sonstige': 'bg-gray-100 text-gray-600',
    'Asiatisch': 'bg-rose-100 text-rose-700',
    'Ofen': 'bg-purple-100 text-purple-700',
    'Suppen': 'bg-teal-100 text-teal-700',
    'Salat/Bowl': 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-4">
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

      <p className="text-sm text-gray-500">{filtered.length} Rezepte</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((recipe) => (
          <div
            key={recipe.id}
            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-medium text-gray-900 text-sm leading-snug">{recipe.name}</h3>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => setEditRecipe(recipe)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteId(recipe.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
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
                recipe.timeLabel === 'mittel' ? 'bg-yellow-100 text-yellow-700' :
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
            </div>

            <div className="mt-2">
              <p className="text-xs text-gray-400">
                {recipe.ingredients.length} Zutaten · {recipe.basePortions} Portionen
              </p>
            </div>
          </div>
        ))}
      </div>

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

      {deleteId && (
        <Modal open onClose={() => setDeleteId(null)} title="Rezept löschen" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Möchtest du dieses Rezept wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
