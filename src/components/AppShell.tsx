'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, BookOpen, ShoppingCart, Settings, Users, LogOut } from 'lucide-react';
import { WeekPlanner } from '@/components/planner/WeekPlanner';
import { RecipeList } from '@/components/recipes/RecipeList';
import { ShoppingListView } from '@/components/shopping/ShoppingListView';
import { SettingsView } from '@/components/settings/SettingsView';
import { GroupNameOnboarding } from '@/components/groups/GroupNameOnboarding';
import { OnboardingWizard } from '@/components/groups/OnboardingWizard';
import { getTheme } from '@/lib/themes';
import type { Recipe, AppSettings, DayConstraint } from '@/types';
import type { Group, GroupRole } from '@/lib/groups';

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

  const theme = getTheme(settings.theme);
  // Onboarding-Wizard nur für echte Erstregistrierungen (nameSet === false).
  // NICHT bei onboardingDone-Check, da bestehende User das Feld nicht haben → Regression.
  const showFullOnboarding = group && groupRole === 'owner' && !group.nameSet;

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
          {/* Brand */}
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

          <div className="hidden sm:flex items-center gap-3">
            <nav
              className="flex items-center gap-0.5 rounded-2xl p-1"
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
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#4a7a4e', color: '#fff', textDecoration: 'none' }}
                title="Admin-Bereich"
              >
                ★ Admin
              </Link>
            )}
            {/* Abmelden – Phase 6 */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ border: `1px solid ${theme.borderColor}`, color: theme.pageSubtext }}
              title="Abmelden"
            >
              <LogOut size={14} />
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 md:overflow-hidden">
        {/* Group Banner — über jedem Tab */}
        {group?.nameSet && (
          <div className="mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl" style={{
            backgroundColor: theme.todayAccent + '15',
            border: `1px solid ${theme.todayAccent}30`,
          }}>
            <Users size={16} style={{ color: theme.todayAccent }} />
            <span className="text-sm font-bold" style={{ color: theme.todayAccent }}>
              {group.name}
            </span>
            {groupRole === 'member' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{
                backgroundColor: theme.todayAccent + '20', color: theme.todayAccent,
              }}>
                Mitglied
              </span>
            )}
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="md:h-[calc(100vh-180px)]">
            <WeekPlanner recipes={recipes} settings={settings} constraints={constraints} />
          </div>
        )}
        {activeTab === 'recipes' && (
          <RecipeList
            initialRecipes={recipes}
            allergiesAndAversions={settings.allergiesAndAversions ?? []}
            isPremium={isPremium}
            onRecipesChange={setRecipes}
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
          {/* Mobile Logout */}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-colors"
            style={{ color: theme.pageSubtext }}
          >
            <LogOut size={20} />
            Abmelden
          </button>
        </div>
      </nav>

      {/* Onboarding-Wizard — nur für Erstregistrierungen (group.nameSet === false) */}
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
    </div>
  );
}
