"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const nav = [
  ["Overview", "/", "⌂"],
  ["Admissions", "#", "◎"],
  ["Students", "/students", "♙"],
  ["Academics", "#", "▦"],
  ["Attendance", "/attendance", "✓"],
  ["Finance", "/payments", "৳"],
  ["Exams", "#", "▤"],
  ["Materials", "#", "◈"],
  ["Notices & SMS", "#", "◌"],
  ["Reports", "#", "▥"],
] as const;

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">ধ</div>
          <div><strong>ধ্রুবক</strong><span>Coaching Portal</span></div>
        </div>
        <div className="workspace-switcher"><span className="workspace-dot" />Dhrubok Coaching<span className="chevron">⌄</span></div>
        <nav className="nav-list" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {nav.map(([label, href, icon]) => {
            const active = href !== "#" && (href === "/" ? pathname === "/" : pathname.startsWith(href));
            return href === "#" ? (
              <span className="nav-item disabled" key={label}><span className="nav-icon">{icon}</span>{label}</span>
            ) : (
              <Link className={`nav-item ${active ? "active" : ""}`} href={href} key={label}>
                <span className="nav-icon">{icon}</span>{label}
              </Link>
            );
          })}
          <p className="nav-label second">Manage</p>
          <span className="nav-item disabled"><span className="nav-icon">◇</span>Website</span>
          <span className="nav-item disabled"><span className="nav-icon">⚙</span>Settings</span>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">?</span><div><strong>Need a hand?</strong><span>View quick guide</span></div></div>
          <div className="profile-row"><div className="avatar">SH</div><div><strong>Sayed Hasan</strong><span>Owner</span></div><span className="more">•••</span></div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark">ধ</div><strong>ধ্রুবক</strong></div>
          <div className="topbar-search"><span>⌕</span><input aria-label="Search" placeholder="Search students, batches, payments..." /><kbd>⌘ K</kbd></div>
          <div className="topbar-actions"><button className="icon-button" aria-label="Notifications">♧<i /></button><button className="language-button">বাংলা <span>⌄</span></button><div className="top-avatar">SH</div></div>
        </header>
        <div className="page-wrap">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function Button({ children, secondary = false, danger = false }: { children: ReactNode; secondary?: boolean; danger?: boolean }) {
  const cls = danger ? "button button-danger" : secondary ? "button button-secondary" : "button";
  return <button className={cls}>{children}</button>;
}

export function Status({ children, tone }: { children: ReactNode; tone: "green" | "orange" | "red" | "blue" | "gray" }) {
  return <span className={`status status-${tone}`}><span />{children}</span>;
}
