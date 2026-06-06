'use client';
import { useState, useEffect } from 'react';
import { useTranslations }     from 'next-intl';
import { Link, useRouter }     from '@/i18n/navigation';
import { CalendarDays, BookOpen, ShoppingCart, Settings, LogOut, Package } from 'lucide-react';
import { WeekPlanner } from '@/components/planner/WeekPlanner';
import { RecipeList } from '@/components/recipes/RecipeList';
import { RecipeDetailModal } from '@/components/recipes/RecipeDetailModal';
import { CookingGuide } from '@/components/recipes/CookingGuide';
import { ShoppingListView } from '@/components/shopping/ShoppingListView';
import { PantryView }      from '@/components/pantry/PantryView';
import { SettingsView } from '@/components/settings/SettingsView';
import { OnboardingWizard } from '@/components/groups/OnboardingWizard';
import { Wordmark } from '@/components/ui/Wordmark';
import { toDataTheme } from '@/lib/themes';
import type { Recipe, AppSettings, DayConstraint } from '@/types';
import type { Group, GroupRole } from '@/lib/groups';

type Tab = 'planner' | 'recipes' | 'shopping' | 'pantry' | 'settings';
export type { Tab };

const TAB_DEFS: { id: Tab; labelKey: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
  { id: 'planner',  labelKey: 'tabPlanner',  icon: CalendarDays },
  { id: 'shopping', labelKey: 'tabShopping', icon: ShoppingCart },
  { id: 'pantry',   labelKey: 'tabPantry',   icon: Package      },
  { id: 'recipes',  labelKey: 'tabRecipes',  icon: BookOpen     },
  { id: 'settings', labelKey: 'tabSettings', icon: Settings     },
];

interface AppShellProps {
  recipes: Recipe[];
  settings: AppSettings;
  constraints: DayConstraint[];
  initialTab?: Tab;
  isPremium?: boolean;
  userPlan?: string;
  isAdmin?: boolean;
  group?: Group | null;
  groupRole?: GroupRole;
}

export function AppShell({
  recipes: initialRecipes,
  settings: initialSettings,
  constraints: initialConstraints,
  initialTab,
  isPremium = false,
  userPlan = 'trial',
  isAdmin = false,
  group: initialGroup = null,
  groupRole = 'member',
}: AppShellProps) {
  const t      = useTranslations('AppShell');
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/auth');
  };

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
          {TAB_DEFS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`mz-topnav-btn${activeTab === id ? ' on' : ''}`}
            >
              <Icon size={16} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <span className="mz-hide-sm">{t(labelKey as any)}</span>
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
            <span className="mz-hide-sm">{t('logout')}</span>
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
              <span className="mz-group-tag">{t('roleMember')}</span>
            )}
            {groupRole === 'owner' && (
              <span className="mz-group-tag">{t('roleOwner')}</span>
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
        {activeTab === 'pantry' && (
          <PantryView />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            initialSettings={settings}
            initialConstraints={constraints}
            isPremium={isPremium}
            userPlan={userPlan}
            group={group}
            groupRole={groupRole}
            onSettingsChange={setSettings}
            onConstraintsChange={setConstraints}
            onGroupChange={setGroup}
          />
        )}
      </main>

      <nav className="mz-botnav">
        {TAB_DEFS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`mz-botnav-btn${activeTab === id ? ' on' : ''}`}
          >
            <Icon size={20} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {t(labelKey as any)}
          </button>
        ))}
        <button className="mz-botnav-btn" onClick={handleLogout}>
          <LogOut size={20} />
          {t('logout')}
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
