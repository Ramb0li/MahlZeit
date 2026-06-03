'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CalendarDays, BookOpen, ShoppingCart, Settings, LogOut } from 'lucide-react';
import { WeekPlanner } from '@/components/planner/WeekPlanner';
import { RecipeList } from '@/components/recipes/RecipeList';
import { RecipeDetailModal } from '@/components/recipes/RecipeDetailModal';
import { CookingGuide } from '@/components/recipes/CookingGuide';
import { ShoppingListView } from '@/components/shopping/ShoppingListView';
import { SettingsView } from '@/components/settings/SettingsView';
import { OnboardingWizard } from '@/components/groups/OnboardingWizard';
import { Wordmark } from '@/components/ui/Wordmark';
import { toDataTheme } from '@/lib/themes';
import type { Recipe, AppSettings, DayConstraint } from '@/types';
import type { Group, GroupRole } from '@/lib/groups';

type Tab = 'planner' | 'recipes' | 'shopping' | 'settings';
export type { Tab };

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
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
  isPremium?: boolean;
  isAdmin?: boolean;
  group?: Group | null;
  groupRole?: GroupRole;
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/auth';
}

export function AppShell({
  recipes: initialRecipes,
  settings: initialSettings,
  constraints: initialConstraints,
  initialTab,
  isPremium = false,
  isAdmin = false,
  group: initialGroup = null,
  groupRole = 'member',
}: AppShellProps) {
  const [activeTab, setActiveTab]     = useState<Tab>(initialTab ?? 'planner');
  const [recipes, setRecipes]         = useState<Recipe[]>(initialRecipes);
  const [settings, setSettings]       = useState<AppSettings>(initialSettings);
  const [constraints, setConstraints] = useState<DayConstraint[]>(initialConstraints);
  const [group, setGroup]             = useState<Group | null>(initialGroup);

  const [detailRecipe,      setDetailRecipe]      = useState<Recipe | null>(null);
  const [cookingRecipe,     setCookingRecipe]      = useState<Recipe | null>(null);
  const [pendingEditRecipe, setPendingEditRecipe]  = useState<Recipe | null>(null);

  // Theme via data-theme Attribut setzen (CSS übernimmt die Farben)
  useEffect(() => {
    const dt = toDataTheme(settings.theme);
    document.documentElement.setAttribute('data-theme', dt);
    try { localStorage.setItem('mz-theme', dt); } catch {}
  }, [settings.theme]);

  const showFullOnboarding = group && groupRole === 'owner' && !group.nameSet;

  return (
    <div className="mz-app mz-app-bg">
      <header className="mz-header">
        <div className="mz-header-brand">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Wordmark size={20} />
          </Link>
        </div>

        <nav className="mz-topnav">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`mz-topnav-btn${activeTab === id ? ' on' : ''}`}
            >
              <Icon size={16} />
              <span className="mz-hide-sm">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mz-header-r">
          {isAdmin && (
            <Link
              href="/admin"
              style={{ background: 'var(--sage)', color: '#fff', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
            >
              ★ Admin
            </Link>
          )}
          <button className="mz-logout" onClick={handleLogout}>
            <LogOut size={14} />
            <span className="mz-hide-sm">Abmelden</span>
          </button>
        </div>
      </header>

      <main className="mz-main">
        {group?.nameSet && (
          <div className="mz-group-banner">
            <div className="mz-group-ava" style={{ fontSize: 12, fontWeight: 800 }}>
              {group.name.slice(0, 1).toUpperCase()}
            </div>
            <span style={{ fontWeight: 700 }}>{group.name}</span>
            {groupRole === 'member' && (
              <span className="mz-group-tag">Mitglied</span>
            )}
            {groupRole === 'owner' && (
              <span className="mz-group-tag">Eigentümer</span>
            )}
          </div>
        )}

        {activeTab === 'planner' && (
          <WeekPlanner
            recipes={recipes}
            settings={settings}
            constraints={constraints}
            onViewRecipe={setDetailRecipe}
          />
        )}
        {activeTab === 'recipes' && (
          <RecipeList
            initialRecipes={recipes}
            allergiesAndAversions={settings.allergiesAndAversions ?? []}
            isPremium={isPremium}
            onRecipesChange={setRecipes}
            onViewRecipe={setDetailRecipe}
            requestEditRecipe={pendingEditRecipe}
            onEditRequestConsumed={() => setPendingEditRecipe(null)}
          />
        )}
        {activeTab === 'shopping' && (
          <ShoppingListView />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            initialSettings={settings}
            initialConstraints={constraints}
            isPremium={isPremium}
            group={group}
            groupRole={groupRole}
            onSettingsChange={setSettings}
            onConstraintsChange={setConstraints}
            onGroupChange={setGroup}
          />
        )}
      </main>

      <nav className="mz-botnav">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`mz-botnav-btn${activeTab === id ? ' on' : ''}`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
        <button className="mz-botnav-btn" onClick={handleLogout}>
          <LogOut size={20} />
          Abmelden
        </button>
      </nav>

      {showFullOnboarding && group && (
        <OnboardingWizard
          currentGroupName={group.name}
          currentSettings={settings}
          onComplete={(updatedGroup, updatedSettings) => {
            setGroup(updatedGroup);
            setSettings(updatedSettings);
          }}
        />
      )}

      {detailRecipe && (
        <RecipeDetailModal
          recipe={detailRecipe}
          isPremium={isPremium}
          isAdmin={isAdmin}
          onClose={() => setDetailRecipe(null)}
          onEdit={(r) => {
            setDetailRecipe(null);
            setActiveTab('recipes');
            setPendingEditRecipe(r);
          }}
          onStartCooking={(r) => {
            setDetailRecipe(null);
            setCookingRecipe(r);
          }}
        />
      )}

      {cookingRecipe && (
        <CookingGuide
          recipe={cookingRecipe}
          onClose={() => setCookingRecipe(null)}
          onFinished={() => {
            setCookingRecipe(null);
            setDetailRecipe(cookingRecipe);
          }}
        />
      )}
    </div>
  );
}
