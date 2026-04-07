import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MainHeader } from "@/components/telegram/MainHeader";

export default async function SettingsGuidePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <>
      <MainHeader titleKey="guide.title" subtitleKey="guide.subtitle" />
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-6 md:px-3 md:py-4">
        <div className="mx-auto max-w-xl space-y-5 text-[14px] leading-relaxed text-[var(--tg-text)] md:space-y-4">
          <p>
            <Link href="/settings" className="text-[var(--tg-accent)] hover:underline">
              ← Настройки
            </Link>
          </p>
          <section>
            <h2 className="text-[15px] font-semibold">Контакты и код</h2>
            <p className="mt-1 text-[13px] text-[var(--tg-text-secondary)]">
              Короткий код и QR ведут на страницу добавления. Кнопка «Поделиться контактом»
              открывает системное меню или копирует код и ссылку.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold">Личные сообщения</h2>
            <p className="mt-1 text-[13px] text-[var(--tg-text-secondary)]">
              E2E при наличии ключей у обоих; иначе доставка через сервер. P2P при удачном
              соединении. Свои текстовые сообщения можно править и удалять в течение заданного в
              настройках времени (по умолчанию 30 минут); изменения уходят собеседнику через тот же
              канал сигналов.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold">Группы</h2>
            <p className="mt-1 text-[13px] text-[var(--tg-text-secondary)]">
              Сообщения на сервере (без E2E содержимого группы). Свои сообщения можно редактировать
              и удалять в том же временном окне, что и в личке.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold">Приватность на экране</h2>
            <p className="mt-1 text-[13px] text-[var(--tg-text-secondary)]">
              Режим «Скрыть текст» искажает отображаемый текст и размывает фото; данные в базе и
              IndexedDB не меняются. Снять режим: три раза подряд верно ввести пароль на странице
              настроек.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold">Face ID, Touch ID и пароль</h2>
            <p className="mt-1 text-[13px] text-[var(--tg-text-secondary)]">
              В настройках можно добавить ключ устройства. На экране входа укажите email и нажмите
              вход по биометрии. Пароль можно сменить в настройках. Для продакшена задайте переменные{" "}
              <code className="rounded bg-[var(--tg-search-bg)] px-1 text-[12px]">WEBAUTHN_RP_ID</code>{" "}
              и при необходимости{" "}
              <code className="rounded bg-[var(--tg-search-bg)] px-1 text-[12px]">
                WEBAUTHN_ORIGINS
              </code>
              .
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold">Ник</h2>
            <p className="mt-1 text-[13px] text-[var(--tg-text-secondary)]">
              Кнопка «Сгенерировать ник» подставляет случайное сочетание прилагательного и
              существительного (RU/EN в зависимости от языка интерфейса).
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
