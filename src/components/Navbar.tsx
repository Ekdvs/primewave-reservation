"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { AppNotification, Paged } from "@/lib/types";
import { Button, cn } from "./ui";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/resources", label: "Resources" },
  { href: "/reservations", label: "Reservations" },
  { href: "/notifications", label: "Notifications" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Paged<AppNotification>>("/notifications", { query: { unread: "true", limit: 1 } })
        .then((r) => alive && setUnread(r.meta.unreadCount ?? 0))
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-3 text-lg font-bold text-indigo-600">ResourceHub</span>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "relative rounded-lg px-3 py-1.5 text-sm font-medium",
                pathname.startsWith(l.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {l.label}
              {l.href === "/notifications" && unread > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            {user?.name} <span className="text-xs text-slate-400">({user?.role.toLowerCase()})</span>
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}