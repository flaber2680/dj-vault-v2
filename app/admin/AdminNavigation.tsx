import Link from "next/link";
import type { AdminSection } from "@/lib/admin/view-state";

type AdminNavigationProps = {
  active: AdminSection;
  counts: Record<AdminSection, number>;
};

const items: Array<{ id: AdminSection; label: string; index: string }> = [
  { id: "collections", label: "Подборки", index: "01" },
  { id: "users", label: "Пользователи", index: "02" },
  { id: "promo-codes", label: "Промокоды", index: "03" },
  { id: "downloads", label: "Скачивания", index: "04" },
];

export function AdminNavigation({ active, counts }: AdminNavigationProps) {
  return (
    <aside className="admin-rail">
      <a className="admin-rail-brand" href="/admin">
        <strong>DJ VAULT</strong>
        <span>ADMIN</span>
      </a>
      <nav aria-label="Разделы админ-панели">
        {items.map((item) => (
          <a
            className={active === item.id ? "is-active" : undefined}
            href={`/admin?section=${item.id}`}
            key={item.id}
          >
            <span>{item.index}</span>
            <strong>{item.label}</strong>
            <em>{counts[item.id]}</em>
          </a>
        ))}
      </nav>
      <Link className="admin-rail-site" href="/">
        ← На сайт
      </Link>
    </aside>
  );
}
