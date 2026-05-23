import { getRecipes, getSettings, getConstraints } from '@/lib/data';
import { AppShell } from '@/components/AppShell';

export default async function HomePage() {
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
    />
  );
}
