/** Обновить списки чатов (лички + группы) после локальных изменений. */
export function notifyInboxAndSidebarRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  window.dispatchEvent(new CustomEvent("say-hello-inbox-refresh"));
}
