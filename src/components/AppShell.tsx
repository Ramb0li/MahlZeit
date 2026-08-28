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
import { UpgradeBanner } from '@/components/UpgradeBanner';
import { UpgradeModal } from '@/components/UpgradeModal';
import { Wordmark } from '@/components/ui/Wordmark';
import { toDataTheme } from '@/lib/themes';
import { calculatePortions } from '@/lib/utils';
import type { Recipe, AppSettings, DayConstraint, MealSlot } from '@/types';
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
  /** Freemium-Sperre: Trial abgelaufen oder Gruppe verwaist */
  locked?: boolean;
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
  locked = false,
}: AppShellProps) {
  const t      = useTranslations('AppShell');
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/auth');
  };

  const [activeTab, setActiveTab]     = useState<Tab>(initialTab ?? 'planner');
  const [recipes, setRecipes]         = useState<Recipe[]>(initialRecipes);
  const [settings, setSettings]       = useState<AppSettings>(initialSettings);
  const [constraints, setConstraints] = useState<DayConstraint[]>(initialConstraints);
  const [group, setGroup]             = useState<Group | null>(initialGroup);

  const [upgradeOpen,       setUpgradeOpen]       = useState(false);
  const [detailRecipe,      setDetailRecipe]      = useState<Recipe | null>(null);
  const [cookingRecipe,     setCookingRecipe]      = useState<Recipe | null>(null);
  const [cookingPortions,   setCookingPortions]    = useState<number | undefined>(undefined);
  const [pendingEditRecipe, setPendingEditRecipe]  = useState<Recipe | null>(null);

  // Menüplan-Kontext, wenn das Detail-Modal aus einem Slot geöffnet wurde (Portionen speicherbar)
  const [detailPortionCtx, setDetailPortionCtx] = useState<
    { weekId: string; dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner'; slot: MealSlot } | null
  >(null);
  const [plannerRefreshKey, setPlannerRefreshKey] = useState(0);

  const viewRecipeOnly = (r: Recipe) => { setDetailPortionCtx(null); setDetailRecipe(r); };
  const closeDetail    = () => { setDetailRecipe(null); setDetailPortionCtx(null); };
  const handleOpenMeal = (ctx: { recipe: Recipe; weekId: string; dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner'; slot: MealSlot }) => {
    setDetailPortionCtx({ weekId: ctx.weekId, dayIndex: ctx.dayIndex, mealType: ctx.mealType, slot: ctx.slot });
    setDetailRecipe(ctx.recipe);
  };

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

      {locked && <UpgradeBanner onClick={() => setUpgradeOpen(true)} />}

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
            onViewRecipe={viewRecipeOnly}
            onOpenMeal={handleOpenMeal}
            plannerRefreshKey={plannerRefreshKey}
            locked={locked}
            onLockedAction={() => setUpgradeOpen(true)}
          />
        )}
        {activeTab === 'recipes' && (
          <RecipeList
            initialRecipes={recipes}
            allergiesAndAversions={settings.allergiesAndAversions ?? []}
            isPremium={isPremium}
            onRecipesChange={setRecipes}
            onViewRecipe={viewRecipeOnly}
            requestEditRecipe={pendingEditRecipe}
            onEditRequestConsumed={() => setPendingEditRecipe(null)}
            locked={locked}
            onLockedAction={() => setUpgradeOpen(true)}
          />
        )}
        {activeTab === 'shopping' && (
          <ShoppingListView weekStartDay={(settings.weekSwitchDay ?? 1) as 0|1|2|3|4|5|6} />
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
            {t(labelKey as any)}
          </button>
        ))}
        <button className="mz-botnav-btn" onClick={handleLogout}>
          <LogOut size={20} />
          {t('logout')}
        </button>
      </nav>

      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}

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
          key={`${detailRecipe.id}${detailPortionCtx ? `-${detailPortionCtx.dayIndex}-${detailPortionCtx.mealType}` : ''}`}
          recipe={detailRecipe}
          isPremium={isPremium}
          isAdmin={isAdmin}
          onClose={closeDetail}
          onEdit={(r) => {
            closeDetail();
            setActiveTab('recipes');
            setPendingEditRecipe(r);
          }}
          onStartCooking={(r, p) => {
            closeDetail();
            setCookingPortions(p);
            setCookingRecipe(r);
          }}
          portionContext={detailPortionCtx
            ? { initialPortions: detailPortionCtx.slot.portionOverride ?? Math.max(1, Math.round(calculatePortions(settings.household).totalPortions)) }
            : undefined}
          onSavePortions={detailPortionCtx ? async (p) => {
            const { weekId, dayIndex, mealType, slot } = detailPortionCtx;
            await fetch('/api/weekplan', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ weekId, day: dayIndex, mealType, slot: { ...slot, portionOverride: p } }),
            });
            closeDetail();
            setPlannerRefreshKey((k) => k + 1);
          } : undefined}
        />
      )}

      {cookingRecipe && (
        <CookingGuide
          recipe={cookingRecipe}
          portions={cookingPortions}
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
