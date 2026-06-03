/**
 * Protected planner page — middleware already guards this route.
 * After login/register the user lands here.
 */
import { getRecipes, getSettings, getConstraints } from '@/lib/data';
import { getSession }                              from '@/lib/auth';
import { getUserByEmail }                          from '@/lib/users';
import { getGroupById }                            from '@/lib/groups';
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

  // Frische Daten aus User-Store holen — groupId kann sich nach Session-Issue ändern
  const user    = await getUserByEmail(session.email);
  const groupId = user?.groupId ?? session.groupId;

  if (!groupId) {
    // User hat noch keine Gruppe (z.B. alter Account vor dem Gruppen-Rollout).
    // → Zurück zum /auth Login, damit das neue JWT mit groupId generiert wird.
    redirect('/auth?error=no_group');
  }

  const [recipes, settings, constraints, group] = await Promise.all([
    getRecipes(groupId),
    getSettings(groupId),
    getConstraints(groupId),
    getGroupById(groupId),
  ]);

  const isPremium =
    session.status === 'active' &&
    (session.plan === 'lifetime' || session.plan === 'abo' || session.plan === 'beta');

  const groupRole = user?.groupRole ?? session.groupRole ?? 'member';

  return (
    <AppShell
      recipes={recipes}
      settings={settings}
      constraints={constraints}
      initialTab={initialTab}
      isPremium={isPremium}
      isAdmin={session.isAdmin}
      group={group}
      groupRole={groupRole}
    />
  );
}
