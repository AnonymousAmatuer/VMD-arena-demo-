import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { Profile } from "@/game/data";
export const engineerSaves = pgTable("vmd_engineer_saves", {
  deviceId: uuid("device_id").primaryKey(),
  profile: jsonb("profile").$type<Profile>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
