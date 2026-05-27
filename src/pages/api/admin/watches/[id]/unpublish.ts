import type { APIRoute } from "astro";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { getDb, getWatchById, unpublishWatch } from "@/lib/db";
import { redirect } from "@/lib/http";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const session = await requireAdmin(db, request);
  await assertCsrf(session, request);

  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || !(await getWatchById(db, id))) {
    return redirect("/watches");
  }

  await unpublishWatch(db, id);
  return redirect(`/admin/watches/${id}?unpublished=1`);
};
