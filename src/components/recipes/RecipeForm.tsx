'use client';
import { useState, useRef } from 'react';
import { Plus, Trash2, ImagePlus, X } from 'lucide-react';
import type { Recipe, Category, Season, WeatherType, TimeLabel, Ingredient, IngredientGroup, DietType } from '@/types';

const CATEGORIES: Category[] = [
  'Eier', 'Reis', 'Pasta', 'Eintopf/Gratin', 'Fisch',
  'Sonstige', 'Asiatisch', 'Ofen', 'Suppen', 'Salat/Bowl',
  'Frühstück', 'Süsses', 'Brot & Aufstrich', 'Snacks',
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
  const [dietType, setDietType]               = useState<DietType | 'alle'>(recipe?.dietType ?? 'alle');
  const [isMealprep, setIsMealprep]           = useState(recipe?.isMealprep ?? false);
  const [isSuitableForLunch, setIsSuitableForLunch] = useState(recipe?.isSuitableForLunch ?? false);
  const [source, setSource]                   = useState(recipe?.source ?? 'Rezept von Cuiselin');
  const [basePortions, setBasePortions]       = useState(recipe?.basePortions ?? 4);
  const [description, setDescription]         = useState(recipe?.description ?? '');
  const [stepsText, setStepsText]             = useState((recipe?.steps ?? []).join('\n'));
  const [imageUrl, setImageUrl]               = useState(recipe?.imageUrl ?? '');
  const [imageZutaten, setImageZutaten]       = useState(recipe?.imageZutaten ?? '');
  const [imageKochen, setImageKochen]         = useState(recipe?.imageKochen ?? '');
  const imgFertigRef  = useRef<HTMLInputElement | null>(null);
  const imgZutatenRef = useRef<HTMLInputElement | null>(null);
  const imgKochenRef  = useRef<HTMLInputElement | null>(null);

  // Modus: 'flat' = einfache Liste, 'grouped' = Mise-en-Place-Gruppen
  const hasGroups = (recipe?.ingredientGroups?.length ?? 0) > 0;
  const [ingredientMode, setIngredientMode] = useState<'flat' | 'grouped'>(hasGroups ? 'grouped' : 'flat');

  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients ?? [{ name: '', amount: 1, unit: 'Stk', perPortions: 4 }]
  );

  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>(
    recipe?.ingredientGroups?.length
      ? recipe.ingredientGroups
      : [{ name: 'Zutaten', ingredients: [{ name: '', amount: 1, unit: 'g', perPortions: 4 }] }]
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

  // Convert local file to base64 data URL
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Helfer fuer Gruppen-Modus
  const updateGroup = (gi: number, field: 'name', value: string) =>
    setIngredientGroups((prev) => prev.map((g, i) => i === gi ? { ...g, [field]: value } : g));

  const addGroupIngredient = (gi: number) =>
    setIngredientGroups((prev) => prev.map((g, i) =>
      i === gi ? { ...g, ingredients: [...g.ingredients, { name: '', amount: 1, unit: 'g', perPortions: basePortions }] } : g
    ));

  const updateGroupIngredient = (gi: number, ii: number, field: keyof Ingredient, value: string | number) =>
    setIngredientGroups((prev) => prev.map((g, i) =>
      i === gi ? {
        ...g,
        ingredients: g.ingredients.map((ing, j) =>
          j === ii ? { ...ing, [field]: field === 'amount' ? Number(value) : value } : ing
        ),
      } : g
    ));

  const removeGroupIngredient = (gi: number, ii: number) =>
    setIngredientGroups((prev) => prev.map((g, i) =>
      i === gi ? { ...g, ingredients: g.ingredients.filter((_, j) => j !== ii) } : g
    ));

  const addGroup = () =>
    setIngredientGroups((prev) => [...prev, { name: 'Neue Gruppe', ingredients: [{ name: '', amount: 1, unit: 'g', perPortions: basePortions }] }]);

  const removeGroup = (gi: number) =>
    setIngredientGroups((prev) => prev.filter((_, i) => i !== gi));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalIngredients: Ingredient[];
    let finalGroups: IngredientGroup[] | undefined;

    if (ingredientMode === 'grouped') {
      const cleanGroups = ingredientGroups
        .map((g) => ({ ...g, ingredients: g.ingredients.filter((ing) => ing.name.trim()) }))
        .filter((g) => g.ingredients.length > 0);
      finalGroups      = cleanGroups.length ? cleanGroups : undefined;
      // Flache Liste aus allen Gruppen ableiten (fuer Einkaufsliste)
      finalIngredients = cleanGroups.flatMap((g) => g.ingredients);
    } else {
      finalIngredients = ingredients.filter((ing) => ing.name.trim());
      finalGroups      = undefined;
    }

    const r: Recipe = {
      id: recipe?.id ?? generateId(),
      name, category, timeMinutes, timeLabel,
      ingredients: finalIngredients,
      season: seasons.length ? seasons : ['ganzjährig'],
      weatherType, isMealprep, isSuitableForLunch, source, basePortions, description,
      ...(dietType !== 'alle' ? { dietType } : {}),
      imageUrl:     imageUrl     || null,
      imageZutaten: imageZutaten || null,
      imageKochen:  imageKochen  || null,
      steps:        stepsText.split('\n').map(s => s.trim()).filter(Boolean).length
                      ? stepsText.split('\n').map(s => s.trim()).filter(Boolean)
                      : undefined,
      ...(finalGroups ? { ingredientGroups: finalGroups } : {}),
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
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
            {([
              { value: 'alle',          label: '🍽 Alle Rezepte' },
              { value: 'fleischhaltig', label: '🥩 Fleischhaltig' },
              { value: 'flexitarisch',  label: '🌾 Flexitarisch' },
              { value: 'pescetarisch',  label: '🐟 Pescetarisch' },
              { value: 'vegetarisch',   label: '🥗 Vegetarisch' },
              { value: 'vegan',         label: '🌿 Vegan' },
            ] as { value: DietType | 'alle'; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDietType(value)}
                className="py-1.5 px-2 rounded-xl text-xs font-semibold transition-all"
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

        {/* Zubereitungsschritte */}
        <div className="sm:col-span-2">
          <label style={labelStyle}>
            Zubereitungsschritte{' '}
            <span style={{ fontWeight: 400, color: '#9c8c84' }}>(ein Schritt pro Zeile)</span>
          </label>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={5}
            placeholder={'1. Zwiebeln würfeln und in Öl andünsten.\n2. Tomaten hinzugeben und 10 min köcheln lassen.\n3. Mit Salz und Pfeffer abschmecken.'}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
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

      {/* Bilder */}
      <div>
        <label style={labelStyle}>Bilder (bis zu 3)</label>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { label: 'Fertiges Menü',  value: imageUrl,      setter: setImageUrl,      ref: imgFertigRef  },
              { label: 'Zutaten',        value: imageZutaten,  setter: setImageZutaten,  ref: imgZutatenRef },
              { label: 'Kochen',         value: imageKochen,   setter: setImageKochen,   ref: imgKochenRef  },
            ] as { label: string; value: string; setter: (v: string) => void; ref: React.MutableRefObject<HTMLInputElement | null> }[]
          ).map(({ label, value, setter, ref }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <span style={{ fontSize: 12, color: '#9c8c84', fontWeight: 500 }}>{label}</span>
              {/* Preview or upload button */}
              <div
                className="relative rounded-xl overflow-hidden flex items-center justify-center cursor-pointer transition-all"
                style={{
                  height: 80,
                  border: '1.5px dashed #e0d8ce',
                  backgroundColor: '#f7f4ee',
                  backgroundImage: value ? `url(${value})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                onClick={() => ref.current?.click()}
              >
                {value ? (
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded-full p-0.5 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: 'rgba(44,36,32,0.6)', color: '#fff' }}
                    onClick={(e) => { e.stopPropagation(); setter(''); if (ref.current) ref.current.value = ''; }}
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <ImagePlus size={22} style={{ color: '#c49a6c', opacity: 0.7 }} />
                )}
              </div>
              <input
                ref={ref}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, setter)}
              />
              {/* Optional: paste URL directly */}
              <input
                type="text"
                placeholder="oder URL einfügen"
                value={value.startsWith('data:') ? '' : value}
                onChange={(e) => setter(e.target.value)}
                style={{ ...inputStyle, fontSize: 11, padding: '4px 8px' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Zutaten — Modus-Wahl */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label style={{ ...labelStyle, marginBottom: 0 }}>Zutaten (pro {basePortions} Portionen)</label>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #e0d8ce' }}>
            <button
              type="button"
              onClick={() => setIngredientMode('flat')}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={ingredientMode === 'flat' ? chipActive : { ...chipInactive, border: 'none', borderRadius: 0 }}
            >
              Einfache Liste
            </button>
            <button
              type="button"
              onClick={() => setIngredientMode('grouped')}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={ingredientMode === 'grouped' ? chipActive : { ...chipInactive, border: 'none', borderRadius: 0 }}
            >
              Gruppen (Mise-en-Place)
            </button>
          </div>
        </div>

        {/* Flat mode */}
        {ingredientMode === 'flat' && (
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
            <button
              type="button" onClick={addIngredient}
              className="flex items-center gap-1 text-xs font-semibold mt-1 transition-opacity hover:opacity-70"
              style={{ color: '#b5614a' }}
            >
              <Plus size={14} />
              Zutat hinzufügen
            </button>
          </div>
        )}

        {/* Grouped mode */}
        {ingredientMode === 'grouped' && (
          <div className="space-y-4">
            {ingredientGroups.map((group, gi) => (
              <div key={gi} className="rounded-xl p-3" style={{ backgroundColor: '#f7f4ee', border: '1px solid #e0d8ce' }}>
                <div className="flex gap-2 items-center mb-2">
                  <input
                    type="text"
                    placeholder="Gruppenname (z.B. Sauce, Teig, Belag)"
                    value={group.name}
                    onChange={(e) => updateGroup(gi, 'name', e.target.value)}
                    style={{ ...inputStyle, flex: 1, padding: '5px 10px', fontWeight: 600, fontSize: 13 }}
                  />
                  {ingredientGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGroup(gi)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: '#9c8c84' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
                      title="Gruppe entfernen"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {group.ingredients.map((ing, ii) => (
                    <div key={ii} className="flex gap-2 items-center">
                      <input
                        type="text" placeholder="Zutat" value={ing.name}
                        onChange={(e) => updateGroupIngredient(gi, ii, 'name', e.target.value)}
                        style={{ ...inputStyle, flex: 1, padding: '5px 10px' }}
                      />
                      <input
                        type="number" placeholder="Menge" value={ing.amount} min={0} step={0.5}
                        onChange={(e) => updateGroupIngredient(gi, ii, 'amount', e.target.value)}
                        style={{ ...inputStyle, width: '72px', padding: '5px 10px' }}
                      />
                      <input
                        type="text" placeholder="Einheit" value={ing.unit}
                        onChange={(e) => updateGroupIngredient(gi, ii, 'unit', e.target.value)}
                        style={{ ...inputStyle, width: '64px', padding: '5px 10px' }}
                      />
                      <button
                        type="button" onClick={() => removeGroupIngredient(gi, ii)}
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
                <button
                  type="button"
                  onClick={() => addGroupIngredient(gi)}
                  className="flex items-center gap-1 text-xs font-semibold mt-2 transition-opacity hover:opacity-70"
                  style={{ color: '#b5614a' }}
                >
                  <Plus size={13} />
                  Zutat zur Gruppe
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addGroup}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
              style={{ border: '1.5px dashed #b5614a', color: '#b5614a' }}
            >
              <Plus size={14} />
              Neue Gruppe hinzufügen
            </button>
          </div>
        )}
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
