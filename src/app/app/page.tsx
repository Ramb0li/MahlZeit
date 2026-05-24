/**
 * Protected planner page — middleware already guards this route.
 * After login/register the user lands here.
 */
import { getRecipes, getSettings, getConstraints } from '@/lib/data';
import { getSession }                              from '@/lib/auth';
import { AppShell }                                from '@/components/AppShell';
import { redirect }                                from 'next/navigation';

const VALID_TABS = ['planner', 'recipes', 'shopping', 'settings'] as const;
type Tab = typeof VALID_TABS[number];

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AppPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/auth');

  const params     = await searchParams;
  const rawTab     = params.tab ?? 'planner';
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
