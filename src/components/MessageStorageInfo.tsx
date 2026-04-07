/** Статичный блок: как устроено хранение переписок. */
export function MessageStorageInfo() {
  return (
    <section className="mt-8 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-5">
      <h2 className="text-[14px] font-medium text-[var(--tg-text)]">Как сохраняются сообщения</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-[var(--tg-text-secondary)]">
        <li>
          <span className="font-medium text-[var(--tg-text)]">Личные чаты:</span> история хранится в вашем
          браузере (IndexedDB на устройстве). Новая переписка начинается с запроса: собеседник видит ваши
          публичные данные (код и ник) и может принять или отклонить. После согласия сообщения идут через
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
          <span className="font-medium text-[var(--tg-text)]">Группы:</span> сообщения и вложения
          хранятся на сервере и доступны всем участникам группы (без сквозного E2E для всей группы).
        </li>
      </ul>
    </section>
  );
}
