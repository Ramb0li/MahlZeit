import { getRecipes, getSettings, getConstraints } from '@/lib/data';
import { AppShell } from '@/components/AppShell';

const VALID_TABS = ['planner', 'recipes', 'shopping', 'settings'] as const;
type Tab = typeof VALID_TABS[number];

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function PlannerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawTab = params.tab ?? 'planner';
  const initialTab: Tab = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as Tab)
    : 'planner';

  const [recipes, settings, constraints] = await Promise.all([
    getRecipes(),
    getSettings(),
    getConstraints(),
  ]);

  return (
    <AppShell
      recipes={recipes}
      settings={settings}
      constraints={constraints}
      initialTab={initialTab}
    />
  );
}
