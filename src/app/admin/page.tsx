import { redirect }           from 'next/navigation';
import { getSession, ADMIN_EMAIL } from '@/lib/auth';
import { getAllUsers }         from '@/lib/users';
import AdminPanel             from './AdminPanel';

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) redirect('/app');

  const users = await getAllUsers();
  const safe  = users.map(({ passwordHash: _pw, ...u }) => u);

  return <AdminPanel initialUsers={safe} />;
}
