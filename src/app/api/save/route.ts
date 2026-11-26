import { db } from "@/db";
import { engineerSaves } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { validProfile } from "@/game/data";
export const dynamic = "force-dynamic";
const device = (r: Request) => {
  const id = r.headers.get("x-device-key") || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  )
    ? id
    : null;
};
export async function GET(r: Request) {
  const id = device(r);
  if (!id)
    return Response.json({ error: "Missing device key" }, { status: 400 });
  const row = await db
    .select({ profile: engineerSaves.profile })
    .from(engineerSaves)
    .where(eq(engineerSaves.deviceId, id))
    .limit(1);
  return Response.json(
    { profile: row[0]?.profile ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PUT(r: Request) {
  const id = device(r);
  if (!id)
    return Response.json({ error: "Missing device key" }, { status: 400 });
  const raw = await r.text();
  if (raw.length > 750000)
    return Response.json({ error: "Save is too large" }, { status: 413 });
  let profile;
  try {
    profile = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid save" }, { status: 400 });
  }
  if (!validProfile(profile))
    return Response.json(
      { error: "Invalid engineering profile" },
      { status: 422 },
    );
  await db
    .insert(engineerSaves)
    .values({ deviceId: id, profile })
    .onConflictDoUpdate({
      target: engineerSaves.deviceId,
      set: { profile, updatedAt: new Date() },
      setWhere: sql`coalesce((${engineerSaves.profile}->>'updated')::numeric, 0) <= ${profile.updated}`,
    });
  return Response.json({ saved: true });
}
export async function DELETE(r: Request) {
  const id = device(r);
  if (!id || r.headers.get("x-confirm-reset") !== "reset")
    return Response.json({ error: "Confirmation required" }, { status: 400 });
  await db.delete(engineerSaves).where(eq(engineerSaves.deviceId, id));
  return Response.json({ reset: true });
}
