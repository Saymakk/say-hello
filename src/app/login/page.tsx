import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--muted)]">
          Загрузка…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
