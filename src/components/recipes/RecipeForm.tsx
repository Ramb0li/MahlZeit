'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Recipe, Category, Season, WeatherType, TimeLabel, Ingredient, DietType } from '@/types';

const CATEGORIES: Category[] = [
  'Eier', 'Reis', 'Pasta', 'Eintopf/Gratin', 'Fisch',
  'Sonstige', 'Asiatisch', 'Ofen', 'Suppen', 'Salat/Bowl',
];

const SEASONS: Season[] = ['Frühling', 'Sommer', 'Herbst', 'Winter', 'ganzjährig'];

// Shared input style
const inputStyle = {
  border: '1px solid #e0d8ce',
  backgroundColor: '#f7f4ee',
  color: '#2c2420',
  borderRadius: '12px',
  padding: '8px 12px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
} as const;

function generateId(): string {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface RecipeFormProps {
  recipe?: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function RecipeForm({ recipe, onSave, onCancel }: RecipeFormProps) {
  const [name, setName]                       = useState(recipe?.name ?? '');
  const [category, setCategory]               = useState<Category>(recipe?.category ?? 'Sonstige');
  const [timeMinutes, setTimeMinutes]         = useState(recipe?.timeMinutes ?? 30);
  const [weatherType, setWeatherType]         = useState<WeatherType>(recipe?.weatherType ?? 'neutral');
  const [seasons, setSeasons]                 = useState<Season[]>(recipe?.season ?? ['ganzjährig']);
  const [dietType, setDietType]               = useState<DietType>(recipe?.dietType ?? 'vegan');
  const [isMealprep, setIsMealprep]           = useState(recipe?.isMealprep ?? false);
  const [isSuitableForLunch, setIsSuitableForLunch] = useState(recipe?.isSuitableForLunch ?? false);
  const [source, setSource]                   = useState(recipe?.source ?? 'eigenes Rezept');
  const [basePortions, setBasePortions]       = useState(recipe?.basePortions ?? 4);
  const [description, setDescription]         = useState(recipe?.description ?? '');
  const [ingredients, setIngredients]         = useState<Ingredient[]>(
    recipe?.ingredients ?? [{ name: '', amount: 1, unit: 'Stk', perPortions: 4 }]
  );

  const timeLabel: TimeLabel =
    timeMinutes < 20 ? 'schnell' : timeMinutes <= 40 ? 'mittel' : 'aufwändig';

  const toggleSeason = (s: Season) => {
    if (s === 'ganzjährig') { setSeasons(['ganzjährig']); return; }
    setSeasons((prev) => {
      const withoutAll = prev.filter((x) => x !== 'ganzjährig');
      return prev.includes(s) ? withoutAll.filter((x) => x !== s) : [...withoutAll, s];
    });
  };

  const addIngredient = () =>
    setIngredients((prev) => [...prev, { name: '', amount: 1, unit: 'g', perPortions: basePortions }]);

  const updateIngredient = (i: number, field: keyof Ingredient, value: string | number) =>
    setIngredients((prev) => prev.map((ing, idx) =>
      idx === i ? { ...ing, [field]: field === 'amount' ? Number(value) : value } : ing
    ));

  const removeIngredient = (i: number) =>
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r: Recipe = {
      id: recipe?.id ?? generateId(),
      name, category, timeMinutes, timeLabel,
      ingredients: ingredients.filter((ing) => ing.name.trim()),
      season: seasons.length ? seasons : ['ganzjährig'],
      weatherType, isMealprep, isSuitableForLunch, source, basePortions, description, dietType,
    };
    onSave(r);
  };

  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#5a4e48', marginBottom: '4px' } as const;
  const chipActive   = { backgroundColor: '#b5614a', color: '#fff', border: '1.5px solid #b5614a' } as const;
  const chipInactive = { backgroundColor: '#efe9df', color: '#5a4e48', border: '1.5px solid #e0d8ce' } as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Name */}
        <div className="sm:col-span-2">
          <label style={labelStyle}>Name *</label>
          <input
            required type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="z.B. Linsen-Bolognese"
          />
        </div>

        {/* Kategorie */}
        <div>
          <label style={labelStyle}>Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Zeit */}
        <div>
          <label style={labelStyle}>
            Zeitaufwand: {timeMinutes} min{' '}
            <span
              className="ml-1 text-xs px-2 py-0.5 rounded-full font-semibold"
              style={
                timeLabel === 'schnell' ? { backgroundColor: '#e8f5e9', color: '#2e7d32' } :
                timeLabel === 'mittel'  ? { backgroundColor: '#fff3e0', color: '#e65100' } :
                { backgroundColor: '#fce4ec', color: '#c62828' }
              }
            >
              {timeLabel}
            </span>
          </label>
          <input
            type="range" min={10} max={120} step={5} value={timeMinutes}
            onChange={(e) => setTimeMinutes(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: '#b5614a' }}
          />
        </div>

        {/* Ernährungsweise */}
        <div className="sm:col-span-2">
          <label style={labelStyle}>Ernährungsweise</label>
          <div className="flex gap-2">
            {([
              { value: 'vegan',        label: '🌿 Vegan' },
              { value: 'vegetarisch',  label: '🥗 Vegetarisch' },
              { value: 'pescetarisch', label: '🐟 Pescetarisch' },
            ] as { value: DietType; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDietType(value)}
                className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={dietType === value ? chipActive : chipInactive}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Wettertyp */}
        <div>
          <label style={labelStyle}>Wettertyp</label>
          <div className="flex gap-2">
            {(['kalt', 'neutral', 'warm'] as WeatherType[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeatherType(w)}
                className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={weatherType === w
                  ? (w === 'kalt' ? { backgroundColor: '#1565c0', color: '#fff', border: '1.5px solid #1565c0' } :
                     w === 'warm' ? { backgroundColor: '#b5614a', color: '#fff', border: '1.5px solid #b5614a' } :
                     { backgroundColor: '#2c2420', color: '#fff', border: '1.5px solid #2c2420' })
                  : chipInactive
                }
              >
                {w === 'kalt' ? '❄️ Kalt' : w === 'warm' ? '☀️ Warm' : '🌤 Neutral'}
              </button>
            ))}
          </div>
        </div>

        {/* Saison */}
        <div>
          <label style={labelStyle}>Saison</label>
          <div className="flex flex-wrap gap-1.5">
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSeason(s)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                style={seasons.includes(s) ? chipActive : chipInactive}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Portionen */}
        <div>
          <label style={labelStyle}>Grundportionen</label>
          <input
            type="number" min={1} max={12} value={basePortions}
            onChange={(e) => setBasePortions(Number(e.target.value))}
            style={inputStyle}
          />
        </div>

        {/* Quelle */}
        <div>
          <label style={labelStyle}>Quelle</label>
          <input
            type="text" value={source}
            onChange={(e) => setSource(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Beschreibung */}
        <div className="sm:col-span-2">
          <label style={labelStyle}>Beschreibung</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

        {/* Checkboxen */}
        <div className="sm:col-span-2 flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox" checked={isMealprep}
              onChange={(e) => setIsMealprep(e.target.checked)}
              style={{ accentColor: '#b5614a' }}
            />
            <span className="text-sm" style={{ color: '#5a4e48' }}>Mealprep-geeignet</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox" checked={isSuitableForLunch}
              onChange={(e) => setIsSuitableForLunch(e.target.checked)}
              style={{ accentColor: '#b5614a' }}
            />
            <span className="text-sm" style={{ color: '#5a4e48' }}>Für Mittagessen geeignet</span>
          </label>
        </div>
      </div>

      {/* Zutaten */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label style={{ ...labelStyle, marginBottom: 0 }}>Zutaten (pro {basePortions} Portionen)</label>
          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: '#b5614a' }}
          >
            <Plus size={14} />
            Zutat hinzufügen
          </button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text" placeholder="Zutat" value={ing.name}
                onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                style={{ ...inputStyle, flex: 1, padding: '6px 10px' }}
              />
              <input
                type="number" placeholder="Menge" value={ing.amount} min={0} step={0.5}
                onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                style={{ ...inputStyle, width: '72px', padding: '6px 10px' }}
              />
              <input
                type="text" placeholder="Einheit" value={ing.unit}
                onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                style={{ ...inputStyle, width: '64px', padding: '6px 10px' }}
              />
              <button
                type="button" onClick={() => removeIngredient(i)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#9c8c84' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors"
          style={{ color: '#5a4e48' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#b5614a' }}
        >
          Speichern
        </button>
      </div>
    </form>
  );
}
