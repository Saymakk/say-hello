type Props = { variant?: "page" | "modal" };

/** Статичный блок: как устроено хранение переписок. */
export function MessageStorageInfo({ variant = "page" }: Props) {
  const shell =
    variant === "modal"
      ? "mt-0 rounded-lg border-0 bg-transparent p-0"
      : "mt-3 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3";

  return (
    <section className={shell}>
      {variant === "page" && (
        <h2 className="text-[13px] font-medium text-[var(--tg-text)]">Как сохраняются сообщения</h2>
      )}
      <ul
        className={`list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-[var(--tg-text-secondary)] ${variant === "page" ? "mt-2" : "mt-0"}`}
      >
        <li>
          <span className="font-medium text-[var(--tg-text)]">Личные чаты:</span> история хранится в вашем
          браузере (IndexedDB на устройстве). Новая переписка начинается с запроса: собеседник видит ваши
          публичные данные (номер и ник) и может принять или отклонить. После согласия сообщения идут через
          WebRTC либо через сервер. Вы можете заблокировать пользователя — тогда он не сможет писать вам.
        </li>
        <li>
          <span className="font-medium text-[var(--tg-text)]">Шифрование лички (E2E):</span> для пары
          пользователей генерируются ключи ECDH P-256; публичный ключ сохраняется на сервере, приватный —
          только у вас. Если у собеседника тоже опубликован ключ, текст и фото в резервной доставке
          шифруются AES-GCM; на сервере виден лишь шифротекст. При работающем WebRTC содержимое также
          передаётся по защищённому каналу между браузерами.
        </li>
        <li>
          <span className="font-medium text-[var(--tg-text)]">Группы:</span> локальная история хранится в
          IndexedDB на устройстве. Между участниками сообщения передаются как зашифрованные пакеты сигналов
          и попадают в локальный кэш группы после обработки.
        </li>
      </ul>
    </section>
  );
}
