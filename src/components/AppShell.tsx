'use client';
import { useState } from 'react';
import { CalendarDays, BookOpen, ShoppingCart, Settings } from 'lucide-react';
import { WeekPlanner } from '@/components/planner/WeekPlanner';
import { RecipeList } from '@/components/recipes/RecipeList';
import { ShoppingListView } from '@/components/shopping/ShoppingListView';
import { SettingsView } from '@/components/settings/SettingsView';
import { getTheme } from '@/lib/themes';
import type { Recipe, AppSettings, DayConstraint } from '@/types';

type Tab = 'planner' | 'recipes' | 'shopping' | 'settings';

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
}

export function AppShell({ recipes: initialRecipes, settings: initialSettings, constraints: initialConstraints }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('planner');
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
        className="sticky top-0 z-40 border-b shadow-sm"
        style={{
          backgroundColor: theme.headerBg + 'F5',
          backdropFilter: 'blur(12px)',
          borderColor: theme.borderColor,
        }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: theme.todayAccent }}
            >
              <span className="text-base leading-none">🍽</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-base tracking-tight" style={{ color: theme.pageText }}>MahlZeit</span>
              <span className="text-[10px] font-bold uppercase tracking-widest -mt-0.5" style={{ color: theme.pageSubtext }}>Planer</span>
            </div>
          </div>

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
                  ? { backgroundColor: theme.navActiveBg, color: theme.navActiveText, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
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
        className="sm:hidden sticky bottom-0 border-t shadow-lg"
        style={{ backgroundColor: theme.headerBg, borderColor: theme.borderColor }}
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
