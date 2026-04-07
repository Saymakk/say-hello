import { redirect } from "next/navigation";

/** Список групп перенесён в «Чаты»; прямой заход сюда ведёт туда же. */
export default function GroupsIndexRedirect() {
  redirect("/chats");
}
