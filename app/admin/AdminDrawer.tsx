import type { ReactNode } from "react";

type AdminDrawerProps = {
  closeHref: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function AdminDrawer({
  closeHref,
  eyebrow,
  title,
  children,
}: AdminDrawerProps) {
  return (
    <div className="admin-drawer-layer">
      <a className="admin-drawer-backdrop" href={closeHref} aria-label="Закрыть панель" />
      <aside className="admin-drawer" aria-label={title}>
        <header className="admin-drawer-head">
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <a className="admin-icon-button" href={closeHref} aria-label="Закрыть панель" title="Закрыть">
            ×
          </a>
        </header>
        <div className="admin-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
