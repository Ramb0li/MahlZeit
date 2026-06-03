export const dynamic = 'force-dynamic';

import { NextResponse }                                       from 'next/server';
import { getSession, ADMIN_EMAIL }                           from '@/lib/auth';
import { getAllGroups }                                      from '@/lib/groups';
import type { Recipe }                                       from '@/types';
import { getGroupCustomRecipes, getRecipes, saveRecipes,
         getTemplateRecipes, saveTemplateRecipes }           from '@/lib/data';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

/** GET — returns all user-created recipes across all groups */
export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const groups = await getAllGroups();
  const rows: { groupId: string; groupName: string; recipe: object }[] = [];

  await Promise.all(
    groups.map(async (group) => {
      const recipes = await getGroupCustomRecipes(group.id);
      for (const recipe of recipes) {
        rows.push({ groupId: group.id, groupName: group.name, recipe });
      }
    }),
  );

  return NextResponse.json(rows);
}

/** PUT — admin edits a user recipe within its group */
export async function PUT(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { groupId, recipe } = await request.json() as { groupId?: string; recipe?: Recipe };
  if (!groupId || !recipe?.id)
    return NextResponse.json({ error: 'groupId und recipe erforderlich.' }, { status: 400 });

  const groupRecipes = await getGroupCustomRecipes(groupId);
  if (!groupRecipes.some((r) => r.id === recipe.id))
    return NextResponse.json({ error: 'Rezept nicht gefunden.' }, { status: 404 });

  const allGroup = await getRecipes(groupId);
  await saveRecipes(allGroup.map((r) => r.id === recipe.id ? recipe : r), groupId);

  return NextResponse.json({ ok: true, recipe });
}

/** DELETE — admin removes a user recipe from a group */
export async function DELETE(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { groupId, recipeId } = await request.json() as { groupId?: string; recipeId?: string };
  if (!groupId || !recipeId)
    return NextResponse.json({ error: 'groupId und recipeId erforderlich.' }, { status: 400 });

  const all      = await getRecipes(groupId);
  const filtered = all.filter((r) => r.id !== recipeId);
  if (filtered.length === all.length)
    return NextResponse.json({ error: 'Rezept nicht gefunden.' }, { status: 404 });

  await saveRecipes(filtered, groupId);
  return NextResponse.json({ ok: true });
}

/** POST — admin promotes a user recipe to the global template list */
export async function POST(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { groupId, recipeId } = await request.json() as { groupId?: string; recipeId?: string };
  if (!groupId || !recipeId)
    return NextResponse.json({ error: 'groupId und recipeId erforderlich.' }, { status: 400 });

  // Find the recipe in the group's custom recipes
  const groupRecipes = await getGroupCustomRecipes(groupId);
  const recipe       = groupRecipes.find((r) => r.id === recipeId);
  if (!recipe)
    return NextResponse.json({ error: 'Rezept nicht gefunden.' }, { status: 404 });

  // Add to global templates (check for ID collision first)
  const templates = await getTemplateRecipes();
  if (templates.some((t) => t.id === recipeId)) {
    // Already exists as template — update it
    await saveTemplateRecipes(templates.map((t) => t.id === recipeId ? recipe : t));
  } else {
    await saveTemplateRecipes([...templates, recipe]);
  }

  // Remove from group custom recipes so it's served from templates
  const allGroup = await getRecipes(groupId);
  await saveRecipes(allGroup.filter((r) => r.id !== recipeId), groupId);

  return NextResponse.json({ ok: true, recipe });
}
