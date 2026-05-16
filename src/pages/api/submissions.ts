import type { APIRoute } from "astro";
import { createSubmission, getDb } from "@/lib/db";
import { json } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  if (!db) {
    return json({ message: "Submissions require a configured Cloudflare D1 database." }, { status: 503 });
  }

  const parsed = parseSubmission(await request.formData());
  if (!parsed.ok || !parsed.payload) {
    return json({ message: "Check the highlighted fields.", errors: parsed.errors }, { status: 400 });
  }

  const id = await createSubmission(db, parsed.payload);
  return json({ id, message: "Submission received. It will stay private until approved." }, { status: 201 });
};
