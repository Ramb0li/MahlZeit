import { redirect }                from 'next/navigation';
import { getSession, ADMIN_EMAIL }  from '@/lib/auth';
import { getAllUsers }              from '@/lib/users';
import { getAllGroups }             from '@/lib/groups';
import { getTemplateRecipes }      from '@/lib/data';
import AdminPanel                  from './AdminPanel';

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) redirect('/app');

  const [users, groups, recipes] = await Promise.all([
    getAllUsers(),
    getAllGroups(),
    getTemplateRecipes(),
  ]);
  const safe = users.map(({ passwordHash: _pw, ...u }) => u);

  return (
    <AdminPanel
      initialUsers={safe}
      adminEmail={ADMIN_EMAIL}
      groups={groups}
      initialRecipes={recipes}
    />
  );
}
