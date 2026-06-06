/**
 * Protected planner page — middleware guards this route.
 */
import { setRequestLocale } from 'next-intl/server';
import { redirect }         from 'next/navigation';
import { getRecipes, getSettings, getConstraints } from '@/lib/data';
import { getSession }                              from '@/lib/auth';
import { getUserByEmail }                          from '@/lib/users';
import { getGroupById }                            from '@/lib/groups';
import { AppShell }                                from '@/components/AppShell';

const VALID_TABS = ['planner', 'recipes', 'shopping', 'settings'] as const;
type Tab = typeof VALID_TABS[number];

interface PageProps {
  params:       Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AppPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/auth`);

  const sp         = await searchParams;
  const rawTab     = sp.tab ?? 'planner';
  const initialTab: Tab = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as Tab)
    : 'planner';

  const user    = await getUserByEmail(session.email);
  const groupId = user?.groupId ?? session.groupId;

  if (!groupId) {
    redirect(`/${locale}/auth?error=no_group`);
  }

  const [recipes, settings, constraints, group] = await Promise.all([
    getRecipes(groupId),
    getSettings(groupId),
    getConstraints(groupId),
    getGroupById(groupId),
  ]);

  const isPremium =
    session.status === 'active' &&
    (session.plan === 'lifetime' || session.plan === 'abo' || session.plan === 'yearly' || session.plan === 'beta');

  const groupRole = user?.groupRole ?? session.groupRole ?? 'member';

  return (
    <AppShell
      recipes={recipes}
      settings={settings}
      constraints={constraints}
      initialTab={initialTab}
      isPremium={isPremium}
      userPlan={session.plan}
      isAdmin={session.isAdmin}
      group={group}
      groupRole={groupRole}
    />
  );
}
