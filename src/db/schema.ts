import {
  pgTable,
  text,
  timestamp,
  uuid,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

/** Минимальный профиль: без ФИО по умолчанию, только технические поля + короткий код для коннекта. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    /** Публичный «ник» для отображения; опционально. */
    displayName: text("display_name"),
    /** Уникальный короткий код для шаринга и QR. */
    shortCode: text("short_code").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("users_short_code_idx").on(t.shortCode)]
);

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })]
);

/**
 * Почтовый ящик для WebRTC-сигналинга (SDP и т.д.) без отдельного Realtime-сервиса.
 * Сообщения чата сюда не пишутся — только технические пакеты для установки P2P.
 */
export const signalPackets = pgTable(
  "signal_packets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Личный канал: получатель. */
    toUserId: uuid("to_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    /** Групповой сигналинг: все участники группы могут читать пакеты по group_id. */
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("signal_to_user_created_idx").on(t.toUserId, t.createdAt),
    index("signal_group_created_idx").on(t.groupId, t.createdAt),
  ]
);

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
