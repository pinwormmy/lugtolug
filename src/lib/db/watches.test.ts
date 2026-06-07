import { describe, expect, it } from "vitest";
import { getEditableWatchBySlugs, listRecentWatches, unpublishWatch, updateWatch } from "@/lib/db/watches";
import type { SourceRow, WatchRow } from "@/lib/db/rows";

function createMockDb(watchRows: WatchRow[], sourceRows: SourceRow[] = []) {
  const prepareCalls: string[] = [];
  const bindCalls: unknown[][] = [];

  const db = {
    prepare(sql: string) {
      prepareCalls.push(sql);
      return {
        bind: (...args: unknown[]) => {
          bindCalls.push(args);
          return {
            all: async () => {
              if (sql.includes("FROM watches")) return { results: watchRows };
              if (sql.includes("FROM watch_sources")) return { results: sourceRows };
              throw new Error(`Unexpected query: ${sql}`);
            },
            first: async () => {
              if (sql.includes("FROM watches")) return watchRows[0] ?? null;
              throw new Error(`Unexpected query: ${sql}`);
            },
            run: async () => ({ meta: { last_row_id: 1 } })
          };
        }
      };
    }
  };

  return { db: db as never, prepareCalls, bindCalls };
}

function watchRow(overrides: Partial<WatchRow>): WatchRow {
  return {
    id: overrides.id ?? 1,
    brand: overrides.brand ?? "Omega",
    model: overrides.model ?? "Speedmaster Professional",
    reference: overrides.reference ?? "310.30.42.50.01.001",
    brand_slug: overrides.brand_slug ?? "omega",
    model_slug: overrides.model_slug ?? "speedmaster-professional",
    reference_slug: overrides.reference_slug ?? "310-30-42-50-01-001",
    lug_to_lug_mm: overrides.lug_to_lug_mm ?? 47.5,
    case_mm: overrides.case_mm ?? 42,
    thickness_mm: overrides.thickness_mm ?? 13.2,
    lug_width_mm: overrides.lug_width_mm ?? 20,
    confidence: overrides.confidence ?? "high",
    status: overrides.status ?? "approved",
    updated_at: overrides.updated_at ?? "2026-05-31T00:00:00.000Z"
  };
}

describe("recent watches", () => {
  it("orders the home feed by latest approval/update time", async () => {
    const { db, prepareCalls } = createMockDb([
      watchRow({
        id: 2,
        brand: "Zenith",
        model: "Chronomaster Sport",
        reference: "03.3114.3600/51.M3100",
        brand_slug: "zenith",
        model_slug: "chronomaster-sport",
        reference_slug: "03-3114-3600-51-m3100",
        updated_at: "2026-06-05T12:00:00.000Z"
      }),
      watchRow({
        id: 1,
        brand: "Audemars Piguet",
        model: "Royal Oak",
        reference: "15510ST.OO.1320ST.03",
        brand_slug: "audemars-piguet",
        model_slug: "royal-oak",
        reference_slug: "15510st-oo-1320st-03",
        updated_at: "2026-06-01T12:00:00.000Z"
      })
    ]);

    const recent = await listRecentWatches(db, 3);

    expect(prepareCalls[0]).toContain("ORDER BY updated_at DESC, id DESC LIMIT ?");
    expect(recent).toHaveLength(3);
    expect(recent[0].brand).toBe("Zenith");
    expect(recent[1].brand).toBe("Audemars Piguet");
  });

  it("resolves editable watches by slugs instead of a public seed id", async () => {
    const { db, prepareCalls } = createMockDb([
      watchRow({
        id: 987,
        brand: "Cartier",
        model: "Santos de Cartier Medium",
        reference: "WSSA0029",
        brand_slug: "cartier",
        model_slug: "santos-de-cartier-medium",
        reference_slug: "wssa0029"
      })
    ]);

    const watch = await getEditableWatchBySlugs(db, "cartier", "santos-de-cartier-medium", "wssa0029");

    expect(prepareCalls[0]).toContain("WHERE brand_slug = ? AND model_slug = ? AND reference_slug = ?");
    expect(watch?.id).toBe(987);
    expect(watch?.reference).toBe("WSSA0029");
  });

  it("keeps admin edits approved when saving changes", async () => {
    const { db, prepareCalls, bindCalls } = createMockDb([
      watchRow({
        id: 42,
        status: "approved"
      })
    ]);

    await updateWatch(db, 42, {
      brand: "Omega",
      model: "Speedmaster Professional",
      reference: "310.30.42.50.01.001",
      lugToLugMm: 47.5,
      caseMm: 42,
      thicknessMm: 13.2,
      lugWidthMm: 20,
      sourceUrl: "https://example.com/watch"
    });

    expect(prepareCalls[0]).toContain("status = ?");
    expect(bindCalls[0]).toContain("approved");
  });

  it("moves a watch to draft when explicitly unpublished", async () => {
    const { db, prepareCalls, bindCalls } = createMockDb([
      watchRow({
        id: 99,
        status: "approved"
      })
    ]);

    await unpublishWatch(db, 99);

    expect(prepareCalls[0]).toContain("SET status = 'draft'");
    expect(bindCalls[0]).toEqual([99]);
  });
});
