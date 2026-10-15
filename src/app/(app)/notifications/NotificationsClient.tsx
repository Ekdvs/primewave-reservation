
"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { fmtDateTime } from "@/lib/datetime";
import type { AppNotification, Paged } from "@/lib/types";
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  FullSpinner,
  PageHeader,
  Pagination,
  cn,
  useToast,
} from "@/components/ui";

export default function NotificationsClient() {
  const toast = useToast();

  const [data, setData] = useState<Paged<AppNotification> | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await api<Paged<AppNotification>>(
        "/notifications",
        {
          query: {
            unread: unreadOnly ? "true" : undefined,
            page,
            limit: 15,
          },
        }
      );

      setData(result);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await api(`/notifications/${id}/read`, {
        method: "POST",
      });

      await load();
    } catch (e) {
      toast(errMsg(e), "error");
    }
  }

  async function markAll() {
    try {
      await api("/notifications/read-all", {
        method: "POST",
      });

      toast("All marked as read");
      await load();
    } catch (e) {
      toast(errMsg(e), "error");
    }
  }

  const unread = data?.meta.unreadCount ?? 0;
  const totalPages = data
    ? Math.ceil(data.meta.total / data.meta.limit)
    : 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setUnreadOnly((previous) => !previous);
                setPage(1);
              }}
            >
              {unreadOnly ? "Show all" : "Unread only"}
            </Button>

            <Button onClick={markAll} disabled={unread === 0}>
              Mark all read
            </Button>
          </>
        }
      />

      {error && <ErrorBox message={error} />}

      {loading ? (
        <FullSpinner />
      ) : !data || data.items.length === 0 ? (
        <Empty text="No notifications." />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((notification) => (
              <Card
                key={notification.id}
                className={cn(
                  !notification.readAt &&
                    "border-indigo-300 bg-indigo-50/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {!notification.readAt && (
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-600" />
                      )}
                      {notification.title}
                    </p>

                    <p className="text-sm text-slate-600">
                      {notification.message}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {fmtDateTime(notification.createdAt)}
                    </p>
                  </div>

                  {!notification.readAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead(notification.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Pagination
            page={data.meta.page}
            pages={totalPages}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
