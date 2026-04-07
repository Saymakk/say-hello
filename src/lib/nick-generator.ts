const ADJ_RU = [
  "тихий",
  "быстрый",
  "мягкий",
  "яркий",
  "смелый",
  "умный",
  "добрый",
  "свежий",
  "острый",
  "теплый",
  "смешной",
  "редкий",
  "честный",
  "лёгкий",
];

const NOUN_RU = [
  "бриз",
  "снег",
  "огонь",
  "камень",
  "поток",
  "сокол",
  "лист",
  "шёпот",
  "звезда",
  "пиксель",
  "код",
  "сигнал",
  "мост",
  "берег",
  "вихрь",
];

const ADJ_EN = [
  "swift",
  "quiet",
  "bright",
  "brave",
  "calm",
  "clever",
  "gentle",
  "wild",
  "cosy",
  "sharp",
  "lucky",
  "noble",
];

const NOUN_EN = [
  "river",
  "pixel",
  "signal",
  "bridge",
  "comet",
  "falcon",
  "ember",
  "breeze",
  "cipher",
  "harbor",
  "nova",
  "atlas",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateRandomNick(locale: "ru" | "en"): string {
  if (locale === "en") {
    return `${pick(ADJ_EN)} ${pick(NOUN_EN)}`;
  }
  return `${pick(ADJ_RU)} ${pick(NOUN_RU)}`;
}
