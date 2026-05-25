import type { APIRoute } from "astro";
import { getAdminSession } from "@/lib/auth";
import { createSubmission, getDb, isSubmissionRateLimited, recordSubmissionRateLimit } from "@/lib/db";
import { json } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  if (!db) {
    return json({ message: "Submissions require a configured Cloudflare D1 database." }, { status: 503 });
  }

  const form = await request.formData();
  const honeypot = String(form.get("website") ?? "").trim();
  if (honeypot) {
    return json({ message: "Check the highlighted fields.", errors: { website: "Leave this field blank." } }, { status: 400 });
  }

  const parsed = parseSubmission(form);
  if (!parsed.ok || !parsed.payload) {
    return json({ message: "Check the highlighted fields.", errors: parsed.errors }, { status: 400 });
  }

  const adminSession = await getAdminSession(db, request);
  if (!adminSession) {
    const rateLimit = await isSubmissionRateLimited(db, request);
    if (rateLimit.limited) {
      const isDailyLimit = rateLimit.reason === "daily";
      return json(
        {
          message: isDailyLimit
            ? "You have reached the 24-hour submission limit. Please try again tomorrow."
            : "Please wait a few minutes before submitting again.",
          errors: { general: isDailyLimit ? "Daily submission limit reached." : "Try again later." }
        },
        {
          status: 429,
          headers: rateLimit.retryAfterSeconds ? { "Retry-After": String(rateLimit.retryAfterSeconds) } : undefined
        }
      );
    }
  }

  const id = await createSubmission(db, parsed.payload);
  if (!adminSession) {
    await recordSubmissionRateLimit(db, request);
  }
  return json({ id, message: "Submission received. It will stay private until approved." }, { status: 201 });
};
