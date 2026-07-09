import { defineMiddleware } from "astro:middleware";
import { getDb } from "@/lib/db";
import { recordVisit } from "@/lib/db/visitors";

export const onRequest = defineMiddleware(async (context, next) => {
  // Record before rendering so the visitor counts on the page include this visit.
  if (isPageView(context.request, context.url)) {
    await recordVisit(getDb(context.locals), context.cookies, context.request);
  }
  return next();
});

function isPageView(request: Request, url: URL): boolean {
  if (request.method !== "GET") return false;
  if (url.pathname.startsWith("/api/")) return false;
  return request.headers.get("accept")?.includes("text/html") ?? false;
}
