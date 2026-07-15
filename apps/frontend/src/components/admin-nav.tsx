'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type AdminNavItem = {
  href: string;
  label: string;
};

const navItems: AdminNavItem[] = [
  { href: '/admin/templates', label: 'Templates' },
  { href: '/admin/layouts', label: 'Layouts' },
  { href: '/admin/media', label: 'Media' },
  { href: '/admin/audit', label: 'Audit' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {navItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
