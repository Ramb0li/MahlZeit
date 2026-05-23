'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Recipe, Category, Season, WeatherType, TimeLabel, Ingredient, DietType } from '@/types';

const CATEGORIES: Category[] = [
  'Eier', 'Reis', 'Pasta', 'Eintopf/Gratin', 'Fisch',
  'Sonstige', 'Asiatisch', 'Ofen', 'Suppen', 'Salat/Bowl',
];

const SEASONS: Season[] = ['Frühling', 'Sommer', 'Herbst', 'Winter', 'ganzjährig'];

function generateId(): string {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface RecipeFormProps {
  recipe?: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function RecipeForm({ recipe, onSave, onCancel }: RecipeFormProps) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [category, setCategory] = useState<Category>(recipe?.category ?? 'Sonstige');
  const [timeMinutes, setTimeMinutes] = useState(recipe?.timeMinutes ?? 30);
  const [weatherType, setWeatherType] = useState<WeatherType>(recipe?.weatherType ?? 'neutral');
  const [seasons, setSeasons] = useState<Season[]>(recipe?.season ?? ['ganzjährig']);
  const [dietType, setDietType] = useState<DietType>(recipe?.dietType ?? 'vegan');
  const [isMealprep, setIsMealprep] = useState(recipe?.isMealprep ?? false);
  const [isSuitableForLunch, setIsSuitableForLunch] = useState(recipe?.isSuitableForLunch ?? false);
  const [source, setSource] = useState(recipe?.source ?? 'eigenes Rezept');
  const [basePortions, setBasePortions] = useState(recipe?.basePortions ?? 4);
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients ?? [{ name: '', amount: 1, unit: 'Stk', perPortions: 4 }]
  );

  const timeLabel: TimeLabel =
    timeMinutes < 20 ? 'schnell' : timeMinutes <= 40 ? 'mittel' : 'aufwändig';

  const toggleSeason = (s: Season) => {
    if (s === 'ganzjährig') { setSeasons(['ganzjährig']); return; }
    setSeasons((prev) => {
      const withoutAll = prev.filter((x) => x !== 'ganzjährig');
      return prev.includes(s)
        ? withoutAll.filter((x) => x !== s)
        : [...withoutAll, s];
    });
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { name: '', amount: 1, unit: 'g', perPortions: basePortions }]);
  };

  const updateIngredient = (i: number, field: keyof Ingredient, value: string | number) => {
    setIngredients((prev) => prev.map((ing, idx) =>
      idx === i ? { ...ing, [field]: field === 'amount' ? Number(value) : value } : ing
    ));
  };

  const removeIngredient = (i: number) => {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r: Recipe = {
      id: recipe?.id ?? generateId(),
      name,
      category,
      timeMinutes,
      timeLabel,
      ingredients: ingredients.filter((ing) => ing.name.trim()),
      season: seasons.length ? seasons : ['ganzjährig'],
      weatherType,
      isMealprep,
      isSuitableForLunch,
      source,
      basePortions,
      description,
      dietType,
    };
    onSave(r);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
            placeholder="z.B. Linsen-Bolognese"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zeitaufwand: {timeMinutes} min
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
              timeLabel === 'schnell' ? 'bg-green-100 text-green-700' :
              timeLabel === 'mittel' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {timeLabel}
            </span>
          </label>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={timeMinutes}
            onChange={(e) => setTimeMinutes(Number(e.target.value))}
            className="w-full accent-brand-green"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Ernährungsweise</label>
          <div className="flex gap-2">
            {([
              { value: 'vegan',        label: '🌿 Vegan',         cls: 'bg-emerald-500 border-emerald-500' },
              { value: 'vegetarisch',  label: '🥗 Vegetarisch',   cls: 'bg-green-500 border-green-500' },
              { value: 'pescetarisch', label: '🐟 Pescetarisch',  cls: 'bg-sky-500 border-sky-500' },
              { value: 'omnivor',      label: '🍖 Omnivor',       cls: 'bg-orange-500 border-orange-500' },
            ] as { value: DietType; label: string; cls: string }[]).map(({ value, label, cls }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDietType(value)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  dietType === value ? `${cls} text-white` : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wettertyp</label>
          <div className="flex gap-2">
            {(['kalt', 'neutral', 'warm'] as WeatherType[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeatherType(w)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  weatherType === w
                    ? w === 'kalt' ? 'bg-blue-500 text-white border-blue-500' :
                      w === 'warm' ? 'bg-orange-500 text-white border-orange-500' :
                      'bg-gray-500 text-white border-gray-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {w === 'kalt' ? '❄️ Kalt' : w === 'warm' ? '☀️ Warm' : '🌤 Neutral'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Saison</label>
          <div className="flex flex-wrap gap-1.5">
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSeason(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  seasons.includes(s)
                    ? 'bg-brand-green text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grundportionen</label>
          <input
            type="number"
            min={1}
            max={12}
            value={basePortions}
            onChange={(e) => setBasePortions(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quelle</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green resize-none"
          />
        </div>

        <div className="sm:col-span-2 flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isMealprep}
              onChange={(e) => setIsMealprep(e.target.checked)}
              className="rounded accent-brand-green"
            />
            <span className="text-sm text-gray-700">Mealprep-geeignet</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSuitableForLunch}
              onChange={(e) => setIsSuitableForLunch(e.target.checked)}
              className="rounded accent-brand-green"
            />
            <span className="text-sm text-gray-700">Für Mittagessen geeignet</span>
          </label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Zutaten (pro {basePortions} Portionen)</label>
          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-1 text-xs text-brand-green hover:text-brand-green-dark font-medium"
          >
            <Plus size={14} />
            Zutat hinzufügen
          </button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Zutat"
                value={ing.name}
                onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
              <input
                type="number"
                placeholder="Menge"
                value={ing.amount}
                min={0}
                step={0.5}
                onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
              <input
                type="text"
                placeholder="Einheit"
                value={ing.unit}
                onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                className="w-16 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
              <button
                type="button"
                onClick={() => removeIngredient(i)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-brand-green hover:bg-brand-green-dark rounded-xl transition-colors"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}
