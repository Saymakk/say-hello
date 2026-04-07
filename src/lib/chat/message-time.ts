/** Локальная полночь для меток «день» в ленте чата. */
export function startOfDayMs(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Ключ одной минуты (локальное время) для склейки метки времени. */
export function minuteKey(ts: number): string {
  const d = new Date(ts);
  return [
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ].join("-");
}

export function groupByMinute<M>(messages: M[], getTime: (m: M) => number): { messages: M[]; timeMs: number }[] {
  const out: { messages: M[]; timeMs: number }[] = [];
  let cur: M[] = [];
  let curKey = "";
  for (const m of messages) {
    const t = getTime(m);
    const k = minuteKey(t);
    if (cur.length === 0) {
      cur = [m];
      curKey = k;
    } else if (k === curKey) {
      cur.push(m);
    } else {
      out.push({ messages: cur, timeMs: getTime(cur[0]!) });
      cur = [m];
      curKey = k;
    }
  }
  if (cur.length) out.push({ messages: cur, timeMs: getTime(cur[0]!) });
  return out;
}

export type ChatRenderItem<M> =
  | { kind: "day"; dayStart: number }
  | { kind: "minuteGroup"; messages: M[]; timeMs: number };

/** Разделители по дням + блоки сообщений с общей меткой времени на минуту. */
export function buildChatRenderItems<M>(messages: M[], getTime: (m: M) => number): ChatRenderItem<M>[] {
  const groups = groupByMinute(messages, getTime);
  const items: ChatRenderItem<M>[] = [];
  let prevDay = -1;
  for (const g of groups) {
    const t0 = getTime(g.messages[0]!);
    const day = startOfDayMs(t0);
    if (day !== prevDay) {
      prevDay = day;
      items.push({ kind: "day", dayStart: day });
    }
    items.push({ kind: "minuteGroup", messages: g.messages, timeMs: g.timeMs });
  }
  return items;
}

export function formatDaySeparatorLabel(dayStartMs: number): string {
  return new Date(dayStartMs).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Время для блока сообщений за ту же минуту (дата — в разделителе дня выше). */
export function formatMinuteGroupLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
