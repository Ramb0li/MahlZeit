export const dynamic = 'force-dynamic';

import { setRequestLocale } from 'next-intl/server';
import { getLandingContent } from '@/lib/content';
import { AuthInner }         from './AuthInner';

interface Props { params: Promise<{ locale: string }> }

export default async function AuthPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { plans } = await getLandingContent();
  return <AuthInner cmsPlans={plans} />;
}
