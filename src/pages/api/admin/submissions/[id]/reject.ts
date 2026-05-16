import type { APIRoute } from "astro";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { getDb, rejectSubmission } from "@/lib/db";
import { redirect } from "@/lib/http";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const session = await requireAdmin(db, request);
  await assertCsrf(session, request);
  const form = await request.formData();
  await rejectSubmission(db, Number(params.id), String(form.get("reviewerNote") ?? ""));
  return redirect("/admin/submissions?rejected=1");
};
