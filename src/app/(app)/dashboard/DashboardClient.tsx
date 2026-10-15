
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { fmtRange } from "@/lib/datetime";
import type {
  DashboardStats,
  Paged,
  Reservation,
} from "@/lib/types";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  FullSpinner,
  PageHeader,
} from "@/components/ui";

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const body = (
    <Card className="transition hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardClient() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcoming, setUpcoming] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [dashboardStats, reservations] = await Promise.all([
          isAdmin
            ? api<DashboardStats>("/dashboard")
            : Promise.resolve(null),
          api<Paged<Reservation>>("/reservations", {
            query: {
              scope: "mine",
              from: new Date().toISOString(),
              limit: 20,
            },
          }),
        ]);

        if (cancelled) return;

        setStats(dashboardStats);

        setUpcoming(
          reservations.items
            .filter(
              (reservation) =>
                reservation.status === "CONFIRMED" ||
                reservation.status === "PENDING"
            )
            .sort(
              (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime()
            )
            .slice(0, 5)
        );
      } catch (e) {
        if (!cancelled) {
          setError(errMsg(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (loading) {
    return <FullSpinner />;
  }

  const sum = (values?: Record<string, number>) =>
    Object.values(values ?? {}).reduce(
      (total, value) => total + value,
      0
    );

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "User"}`}
        subtitle="Overview of resources and reservations"
      />

      {error && <ErrorBox message={error} />}

      {isAdmin && stats && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat
              label="Total resources"
              value={sum(stats.resources)}
              href="/resources"
            />
            <Stat
              label="Active resources"
              value={stats.resources.ACTIVE ?? 0}
              href="/resources"
            />
            <Stat
              label="Today's reservations"
              value={stats.todayReservations}
              href="/reservations"
            />
            <Stat
              label="Pending approvals"
              value={stats.pendingApprovals}
              href="/reservations"
            />
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold">
                Reservations by status
              </h2>

              <div className="space-y-2">
                {[
                  "PENDING",
                  "CONFIRMED",
                  "COMPLETED",
                  "CANCELLED",
                  "REJECTED",
                ].map((status) => (
                  <div
                    key={status}
                    className="flex items-center justify-between text-sm"
                  >
                    <Badge value={status} />
                    <span className="font-semibold">
                      {stats.reservations[status] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold">
                Most used resources (30 days)
              </h2>

              {stats.topResourcesLast30Days.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No usage data yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.topResourcesLast30Days.map((resource) => {
                    const max =
                      stats.topResourcesLast30Days[0].reservations || 1;

                    return (
                      <div
                        key={resource.resourceId}
                        className="text-sm"
                      >
                        <div className="mb-1 flex justify-between">
                          <span>{resource.name}</span>
                          <span className="font-semibold">
                            {resource.reservations}
                          </span>
                        </div>

                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-indigo-500"
                            style={{
                              width: `${
                                (resource.reservations / max) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">
            My upcoming reservations
          </h2>

          <Link
            href="/resources"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Book a resource →
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <Empty text="No upcoming reservations." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((reservation) => (
              <li
                key={reservation.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {reservation.title}
                  </p>
                  <p className="text-slate-500">
                    {reservation.resource.name} ·{" "}
                    {fmtRange(
                      reservation.startTime,
                      reservation.endTime
                    )}
                  </p>
                </div>

                <Badge value={reservation.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
