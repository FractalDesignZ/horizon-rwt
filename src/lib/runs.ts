import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export const listRuns = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      name: string;
      well_id: string;
      source: string;
      metrics: string;
      created_at: string;
    }>`
      select id, name, well_id, source, metrics, created_at
      from rwt_runs
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
  });

export const saveRun = createServerFn({ method: "POST" })
  .validator((input: {
    name: string;
    wellId: string;
    source: string;
    metrics: Record<string, unknown>;
  }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const metrics = JSON.stringify(data.metrics);
    await sql`
      insert into rwt_runs (id, user_id, name, well_id, source, metrics)
      values (
        ${id},
        ${context.userId},
        ${data.name},
        ${data.wellId},
        ${data.source},
        ${metrics}
      )
    `;
    return { id };
  });
