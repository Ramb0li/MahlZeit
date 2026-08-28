/**
 * Gemeinsame UI-Konstanten für Allergien & Abneigungen.
 * Wird von SettingsView und OnboardingWizard genutzt, damit beide Listen synchron bleiben.
 * (Nicht zu verwechseln mit den EU-Pflichtallergen-Keywords in `allergens.ts`.)
 */

export interface AllergenOption {
  id: string;
  label: string;
  emoji: string;
}

export const ALLERGENS: readonly AllergenOption[] = [
  { id: 'gluten',       label: 'Gluten',       emoji: '🌾' },
  { id: 'weizen',       label: 'Weizen',        emoji: '🌾' },
  { id: 'laktose',      label: 'Laktose',       emoji: '🥛' },
  { id: 'milch',        label: 'Milch',         emoji: '🍼' },
  { id: 'ei',           label: 'Ei',            emoji: '🥚' },
  { id: 'fisch',        label: 'Fisch',         emoji: '🐟' },
  { id: 'schalentiere', label: 'Schalentiere',  emoji: '🦐' },
  { id: 'erdnüsse',     label: 'Erdnüsse',      emoji: '🥜' },
  { id: 'haselnüsse',   label: 'Haselnüsse',    emoji: '🌰' },
  { id: 'walnüsse',     label: 'Walnüsse',      emoji: '🌰' },
  // Sammelkategorie: deckt zusaetzlich Mandeln, Cashew, Pistazien, Pekan,
  // Macadamia und Paranuss ab. Ohne sie liess sich eine Nussallergie hier gar
  // nicht vollstaendig angeben.
  { id: 'schalenfrüchte', label: 'Schalenfrüchte (Mandeln, Cashew …)', emoji: '🌰' },
  { id: 'soja',         label: 'Soja',          emoji: '🫘' },
  { id: 'sesam',        label: 'Sesam',         emoji: '🌻' },
  { id: 'sellerie',     label: 'Sellerie',      emoji: '🥬' },
  { id: 'senf',         label: 'Senf',          emoji: '🟡' },
  { id: 'lupinen',      label: 'Lupinen',       emoji: '🌿' },
  { id: 'alkohol',      label: 'Alkohol',       emoji: '🍷' },
  { id: 'fruktose',     label: 'Fruktose',      emoji: '🍬' },
  { id: 'sorbit',       label: 'Sorbit',        emoji: '🍬' },
] as const;

export const PRESET_AVERSIONS: readonly string[] = [
  'Schweinefleisch', 'Fisch', 'Ersatzprodukte', 'Koriander', 'Rosenkohl', 'Pilze',
];
