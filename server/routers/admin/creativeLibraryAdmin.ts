/**
 * Creative Library Admin Router — Persistent creative library per ad account.
 * Auto-saves creative rows to DB, shared across all build modes.
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { creativeLibrary } from "../../../drizzle/schema";

export const creativeLibraryAdminRouter = router({
  /**
   * Get all creative library entries for a given ad account.
   */
  getByAccount: protectedProcedure
    .input(z.object({ adAccountId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(creativeLibrary)
        .where(eq(creativeLibrary.adAccountId, input.adAccountId));
      return rows.map(r => ({
        id: r.id,
        rowId: r.rowId,
        creativeId: r.creativeId,
        adType: r.adType,
        rowData: r.rowData,
        updatedAt: r.updatedAt,
      }));
    }),

  /**
   * Upsert (create or update) a batch of creative rows for an ad account.
   * Uses the unique (adAccountId, rowId) constraint for upsert.
   */
  upsertBatch: protectedProcedure
    .input(z.object({
      adAccountId: z.string().min(1),
      rows: z.array(z.object({
        rowId: z.string().min(1),
        creativeId: z.string().optional().default(""),
        adType: z.string().default("static"),
        rowData: z.string(), // JSON-serialized CreativeRow
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database unavailable" };

      // Process each row as an upsert (INSERT ... ON DUPLICATE KEY UPDATE)
      for (const row of input.rows) {
        await db
          .insert(creativeLibrary)
          .values({
            adAccountId: input.adAccountId,
            rowId: row.rowId,
            creativeId: row.creativeId || null,
            adType: row.adType,
            rowData: row.rowData,
          })
          .onDuplicateKeyUpdate({
            set: {
              creativeId: row.creativeId || null,
              adType: row.adType,
              rowData: row.rowData,
            },
          });
      }

      return { success: true, count: input.rows.length };
    }),

  /**
   * Delete specific creative rows from the library by rowId.
   */
  deleteRows: protectedProcedure
    .input(z.object({
      adAccountId: z.string().min(1),
      rowIds: z.array(z.string().min(1)),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database unavailable" };

      for (const rowId of input.rowIds) {
        await db
          .delete(creativeLibrary)
          .where(
            and(
              eq(creativeLibrary.adAccountId, input.adAccountId),
              eq(creativeLibrary.rowId, rowId)
            )
          );
      }

      return { success: true, deleted: input.rowIds.length };
    }),
});
