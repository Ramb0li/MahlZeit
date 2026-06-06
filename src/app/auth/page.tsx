export const dynamic = 'force-dynamic';

import { getLandingContent } from '@/lib/content';
import { AuthInner }         from './AuthInner';

export default async function AuthPage() {
  const { plans } = await getLandingContent();
  return <AuthInner cmsPlans={plans} />;
}
