'use client';
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { Recipe, Category, TimeLabel } from '@/types';

const CATEGORIES: Category[] = [
  'Eier', 'Reis', 'Pasta', 'Eintopf/Gratin', 'Fisch',
  'Sonstige', 'Asiatisch', 'Ofen', 'Suppen', 'Salat/Bowl',
];

interface RecipePickerModalProps {
  recipes: Recipe[];
  mealType: 'lunch' | 'dinner';
  onSelect: (recipeId: string) => void;
  onClose: () => void;
}

export function RecipePickerModal({ recipes, mealType, onSelect, onClose }: RecipePickerModalProps) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'Alle'>('Alle');
  const [filterTime, setFilterTime] = useState<TimeLabel | 'Alle'>('Alle');

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (mealType === 'lunch' && !r.isSuitableForLunch) return false;
      if (filterCategory !== 'Alle' && r.category !== filterCategory) return false;
      if (filterTime !== 'Alle' && r.timeLabel !== filterTime) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, search, filterCategory, filterTime, mealType]);

  return (
    <Modal
      open
      onClose={onClose}
      title={mealType === 'lunch' ? 'Mittagessen wählen' : 'Abendessen wählen'}
      size="lg"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rezept suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
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

        <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">Keine Rezepte gefunden</p>
          )}
          {filtered.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => onSelect(recipe.id)}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-brand-green hover:bg-brand-green-50 text-left transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 group-hover:text-brand-green-dark truncate">
                  {recipe.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{recipe.category}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  recipe.timeLabel === 'schnell' ? 'bg-green-100 text-green-700' :
                  recipe.timeLabel === 'mittel' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {recipe.timeMinutes}min
                </span>
                {recipe.isMealprep && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">MP</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
