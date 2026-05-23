'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, BookOpen, ShoppingCart, Settings } from 'lucide-react';
import { WeekPlanner } from '@/components/planner/WeekPlanner';
import { RecipeList } from '@/components/recipes/RecipeList';
import { ShoppingListView } from '@/components/shopping/ShoppingListView';
import { SettingsView } from '@/components/settings/SettingsView';
import { getTheme } from '@/lib/themes';
import type { Recipe, AppSettings, DayConstraint } from '@/types';

type Tab = 'planner' | 'recipes' | 'shopping' | 'settings';
export type { Tab };

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { id: 'planner',  label: 'Menüplan',     icon: CalendarDays },
  { id: 'recipes',  label: 'Rezepte',       icon: BookOpen     },
  { id: 'shopping', label: 'Einkauf',       icon: ShoppingCart },
  { id: 'settings', label: 'Einstellungen', icon: Settings     },
];

interface AppShellProps {
  recipes: Recipe[];
  settings: AppSettings;
  constraints: DayConstraint[];
  initialTab?: Tab;
}

export function AppShell({ recipes: initialRecipes, settings: initialSettings, constraints: initialConstraints, initialTab }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'planner');
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [constraints, setConstraints] = useState<DayConstraint[]>(initialConstraints);

  const theme = getTheme(settings.theme);

  return (
    <div
      className="flex flex-col min-h-screen max-w-screen-xl mx-auto"
      style={{ backgroundColor: theme.pageBg, color: theme.pageText }}
    >
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: theme.headerBg + 'EC',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderColor: theme.borderColor,
          height: '56px',
        }}
      >
        <div className="flex items-center justify-between px-5 h-full">
          {/* Brand — links back to landing page */}
          <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: theme.todayAccent + '22', border: `1px solid ${theme.borderColor}` }}
            >
              <span className="text-base leading-none">🍽</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span
                className="font-fraunces font-black text-[17px] tracking-tight leading-none"
                style={{ color: theme.pageText }}
              >
                Mahl<span style={{ color: '#b5614a' }}>Zeit</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: theme.pageSubtext }}>
                Planer
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav
            className="hidden sm:flex items-center gap-0.5 rounded-2xl p-1"
            style={{ backgroundColor: theme.navBg }}
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
                style={activeTab === id
                  ? { backgroundColor: theme.navActiveBg, color: theme.navActiveText }
                  : { color: theme.navInactiveText }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 md:overflow-hidden">
        {activeTab === 'planner' && (
          <div className="md:h-[calc(100vh-140px)]">
            <WeekPlanner recipes={recipes} settings={settings} constraints={constraints} />
          </div>
        )}
        {activeTab === 'recipes' && (
          <RecipeList initialRecipes={recipes} onRecipesChange={setRecipes} />
        )}
        {activeTab === 'shopping' && (
          <ShoppingListView />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            initialSettings={settings}
            initialConstraints={constraints}
            onSettingsChange={setSettings}
            onConstraintsChange={setConstraints}
          />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="sm:hidden sticky bottom-0 border-t"
        style={{
          backgroundColor: theme.headerBg,
          borderColor: theme.borderColor,
          boxShadow: '0 -1px 12px rgba(44,36,32,0.08)',
        }}
      >
        <div className="flex">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-colors"
              style={{ color: activeTab === id ? theme.todayAccent : theme.pageSubtext }}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
