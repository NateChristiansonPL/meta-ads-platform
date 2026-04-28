/**
 * Sessions router — save, load, list, and delete named builder sessions.
 * All procedures are protected (require login).
 */

import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { builderSessions } from "../../drizzle/schema";

export const sessionsRouter = router({
  /** List all sessions for the current user, newest first */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: builderSessions.id,
        name: builderSessions.name,
        createdAt: builderSessions.createdAt,
        updatedAt: builderSessions.updatedAt,
      })
      .from(builderSessions)
      .where(eq(builderSessions.userId, ctx.user.id))
      .orderBy(desc(builderSessions.updatedAt));
    return rows;
  }),

  /** Load a single session's full state JSON */
  load: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const rows = await db
        .select()
        .from(builderSessions)
        .where(
          and(
            eq(builderSessions.id, input.id),
            eq(builderSessions.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!rows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }
      return { id: rows[0].id, name: rows[0].name, stateJson: rows[0].stateJson };
    }),

  /** Save (create or overwrite by name) a session */
  save: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        stateJson: z.string().min(2),
        /** If provided, overwrite this existing session ID instead of creating a new one */
        existingId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      if (input.existingId) {
        // Verify ownership then update
        const existing = await db
          .select({ id: builderSessions.id })
          .from(builderSessions)
          .where(
            and(
              eq(builderSessions.id, input.existingId),
              eq(builderSessions.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!existing[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
        }
        await db
          .update(builderSessions)
          .set({ name: input.name, stateJson: input.stateJson })
          .where(eq(builderSessions.id, input.existingId));
        return { id: input.existingId };
      } else {
        const [result] = await db.insert(builderSessions).values({
          userId: ctx.user.id,
          name: input.name,
          stateJson: input.stateJson,
        });
        return { id: (result as { insertId: number }).insertId };
      }
    }),

  /** Delete a session */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const existing = await db
        .select({ id: builderSessions.id })
        .from(builderSessions)
        .where(
          and(
            eq(builderSessions.id, input.id),
            eq(builderSessions.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }
      await db
        .delete(builderSessions)
        .where(eq(builderSessions.id, input.id));
      return { success: true };
    }),
});
