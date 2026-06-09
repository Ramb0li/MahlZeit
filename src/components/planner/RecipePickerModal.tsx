'use client';
import { useState, useMemo } from 'react';
import { Search, UtensilsCrossed } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { type Recipe, type Category, type DietType, computeTimeTags } from '@/types';
import { getEffectiveDietCategory } from '@/lib/suggestions';

const CATEGORIES: Category[] = [
  'Frühstück', 'Snacks & Vorspeisen', 'Suppen, Eintöpfe & Currys',
  'Salate & Bowls', 'Pasta', 'Reis & Getreide', 'Kartoffelgerichte',
  'Fleisch & Geflügel', 'Fisch & Meeresfrüchte', 'Vegetarische Hauptgerichte',
  'Aufläufe & Gratins', 'Wraps & Sandwiches', 'Desserts & Süsses',
];

export const LEFTOVERS_ID = '__leftovers__';

const chipActive   = { backgroundColor: '#b5614a', color: '#fff' };
const chipInactive = { backgroundColor: '#efe9df', color: '#5a4e48', border: '1.5px solid #e0d8ce' };
const chipDarkActive = { backgroundColor: '#2c2420', color: '#fff' };

interface RecipePickerModalProps {
  recipes: Recipe[];
  mealType: 'breakfast' | 'lunch' | 'dinner';
  dietPreference?: DietType | 'alle';
  onSelect: (recipeId: string) => void;
  onClose: () => void;
}

export function RecipePickerModal({ recipes, mealType, dietPreference, onSelect, onClose }: RecipePickerModalProps) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'Alle'>('Alle');
  const [filterTime, setFilterTime] = useState<'Alle' | 'Schnell (<20min)' | 'Einfach (<30min)'>('Alle');

  const title =
    mealType === 'breakfast' ? 'Frühstück wählen' :
    mealType === 'lunch'     ? 'Mittagessen wählen' :
    'Abendessen wählen';

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (r.archived) return false;
      if (mealType === 'lunch' && !r.tags.includes('Mittagsgericht')) return false;
      if (mealType === 'breakfast' && r.category !== 'Frühstück' && !r.tags.includes('Frühstücksgericht')) return false;
      // Diet preference filter (uses getEffectiveDietCategory für Korrektheit über alle Kategorien)
      if (dietPreference && dietPreference !== 'alle' && dietPreference !== 'fleischhaltig' && dietPreference !== 'flexitarisch') {
        const diet = getEffectiveDietCategory(r);
        if (dietPreference === 'pescetarisch' && diet === 'meat') return false;
        if (dietPreference === 'vegetarisch'  && (diet === 'meat' || diet === 'fish')) return false;
        if (dietPreference === 'vegan'        && diet !== 'vegan') return false;
      }
      if (filterCategory !== 'Alle' && r.category !== filterCategory) return false;
      if (filterTime !== 'Alle' && !computeTimeTags(r.timeMinutes).includes(filterTime)) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, search, filterCategory, filterTime, mealType, dietPreference]);

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9c8c84' }} />
          <input
            type="text"
            placeholder="Rezept suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none"
            style={{ border: '1px solid #e0d8ce', backgroundColor: '#f7f4ee', color: '#2c2420' }}
          />
        </div>

        {/* Category dropdown */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as Category | 'Alle')}
          className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
          style={{ border: '1px solid #e0d8ce', backgroundColor: '#f7f4ee', color: '#2c2420', cursor: 'pointer' }}
        >
          <option value="Alle">Alle Kategorien</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Time chips */}
        <div className="flex gap-1.5">
          {(['Alle', 'Schnell (<20min)', 'Einfach (<30min)'] as const).map((t) => (
            <button key={t} onClick={() => setFilterTime(t)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
              style={filterTime === t ? (t === 'Alle' ? chipActive : chipDarkActive) : chipInactive}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Diet filter banner */}
        {dietPreference && dietPreference !== 'alle' && dietPreference !== 'fleischhaltig' && dietPreference !== 'flexitarisch' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#f2e5e0', border: '1px solid #d4a090', color: '#b5614a' }}>
            <span>🌿</span>
            <span>Gefiltert: <strong>{dietPreference === 'vegan' ? 'Vegan' : dietPreference === 'vegetarisch' ? 'Vegetarisch' : 'Pescetarisch'}</strong></span>
          </div>
        )}

        {/* Recipe list */}
        <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
          <button
            onClick={() => onSelect(LEFTOVERS_ID)}
            className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
            style={{ border: '1.5px dashed #d4a090' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f5ece0'; (e.currentTarget as HTMLElement).style.borderColor = '#b5614a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = '#d4a090'; }}
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: '#f5ece0' }}>
              <UtensilsCrossed size={16} style={{ color: '#c49a6c' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#5a4e48' }}>Reste essen</p>
              <p className="text-xs" style={{ color: '#9c8c84' }}>Vorhandene Reste aufbrauchen</p>
            </div>
          </button>

          {filtered.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: '#9c8c84' }}>Keine Rezepte gefunden</p>
          )}

          {filtered.map((recipe) => {
            const timeTags = computeTimeTags(recipe.timeMinutes);
            const isSchnell = timeTags.includes('Schnell (<20min)');
            const timeStyle = isSchnell
              ? { backgroundColor: '#e8f5e9', color: '#2e7d32' }
              : timeTags.includes('Einfach (<30min)')
                ? { backgroundColor: '#fff3e0', color: '#e65100' }
                : { backgroundColor: '#fce4ec', color: '#c62828' };
            return (
              <button
                key={recipe.id}
                onClick={() => onSelect(recipe.id)}
                className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#b5614a'; (e.currentTarget as HTMLElement).style.backgroundColor = '#f2e5e0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e0d8ce'; (e.currentTarget as HTMLElement).style.backgroundColor = '#fff9f3'; }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#2c2420' }}>{recipe.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9c8c84' }}>{recipe.category}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {recipe.tags.includes('Vegan') && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#f5ece0', color: '#c49a6c' }}>🌿</span>
                  )}
                  {!recipe.tags.includes('Vegan') && recipe.tags.includes('Vegetarisch') && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#f2e5e0', color: '#b5614a' }}>🥗</span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={timeStyle}>
                    {recipe.timeMinutes}min
                  </span>
                  {recipe.tags.includes('Mealprep-geeignet') && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#f5ece0', color: '#c49a6c' }}>MP</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
