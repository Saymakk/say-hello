import {
  pgTable,
  text,
  timestamp,
  uuid,
  primaryKey,
  index,
  uniqueIndex,
  bigint,
  integer,
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
    /** Обновляется heartbeat-запросом для индикатора «онлайн». */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** JWK публичного ключа ECDH P-256 для E2E лички (опционально). */
    publicKeyJwk: text("public_key_jwk"),
    /** Окно редактирования/удаления своих сообщений (минуты), группы и локальная личка. */
    messageEditWindowMinutes: integer("message_edit_window_minutes")
      .notNull()
      .default(30),
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

/** Сообщения в группах на сервере; групповой E2E не реализован — только транспортное шифрование HTTPS. */
export const groupMessages = pgTable(
  "group_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** Data URL изображения (JPEG/PNG/WebP); подпись к фото — в body. */
    imageDataUrl: text("image_data_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [index("group_messages_group_created_idx").on(t.groupId, t.createdAt)]
);

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

/** Кто кого заблокировал: blocked_id не может писать blocker_id. */
export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]
);

/** Разрешённая личная переписка (после принятия запроса). user_a < user_b лексикографически. */
export const dmAllowedPairs = pgTable(
  "dm_allowed_pairs",
  {
    userA: uuid("user_a")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userB: uuid("user_b")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userA, t.userB] })]
);

/** Запрос на начало личной переписки (до принятия). */
export const dmRequests = pgTable(
  "dm_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    firstMessagePreview: text("first_message_preview"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("dm_requests_from_to_unique").on(t.fromUserId, t.toUserId),
    index("dm_requests_to_status_idx").on(t.toUserId, t.status),
    index("dm_requests_from_status_idx").on(t.fromUserId, t.status),
  ]
);

export const webauthnChallenges = pgTable(
  "webauthn_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email"),
    challenge: text("challenge").notNull(),
    kind: text("kind").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("webauthn_challenges_expires_idx").on(t.expiresAt)]
);

export const webauthnCredentials = pgTable(
  "webauthn_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    counter: bigint("counter", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("webauthn_credentials_user_idx").on(t.userId)]
);

export const webauthnLoginCodes = pgTable("webauthn_login_codes", {
  code: text("code").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
