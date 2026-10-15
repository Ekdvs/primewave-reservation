
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { fmtRange } from "@/lib/datetime";
import type { Paged, Reservation } from "@/lib/types";

import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  FullSpinner,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  cn,
  useToast,
} from "@/components/ui";

export default function ReservationsClient() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const toast = useToast();

  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paged<Reservation> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState<Reservation | null>(null);
  const [reason, setReason] = useState("");

  // Load reservations.
  // Do not send status when the filter is empty.
  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = {
        scope,
        ...(status ? { status } : {}),
        page,
        limit: 10,
      };

      const result = await api<Paged<Reservation>>("/reservations", {
        query,
      });

      setData(result);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [scope, status, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Perform a reservation action and refresh the list.
  async function act(
    id: string,
    fn: () => Promise<unknown>,
    okMsg: string
  ) {
    setBusyId(id);

    try {
      await fn();
      toast(okMsg);
      await load();
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusyId(null);
    }
  }

  // Cancel reservation.
  const cancel = (r: Reservation) => {
    if (!confirm(`Cancel "${r.title}"?`)) return;

    void act(
      r.id,
      () =>
        api(`/reservations/${r.id}/cancel`, {
          method: "POST",
        }),
      "Reservation cancelled"
    );
  };

  // Approve reservation.
  const approve = (r: Reservation) => {
    void act(
      r.id,
      () =>
        api(`/reservations/${r.id}/decision`, {
          method: "POST",
          body: { action: "approve" },
        }),
      "Approved"
    );
  };

  // Reject reservation.
  async function submitReject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!rejecting) return;

    const reservation = rejecting;

    await act(
      reservation.id,
      () =>
        api(`/reservations/${reservation.id}/decision`, {
          method: "POST",
          body: {
            action: "reject",
            reason,
          },
        }),
      "Rejected"
    );

    setRejecting(null);
    setReason("");
  }

  // Determine whether cancellation is allowed.
  const canCancel = (r: Reservation) =>
    (r.status === "PENDING" || r.status === "CONFIRMED") &&
    (isAdmin || new Date(r.startTime) > new Date());

  return (
    <>
      <PageHeader
        title="Reservations"
        subtitle={
          scope === "all"
            ? "All reservations in the organization"
            : "Your reservations"
        }
        actions={
          <Link
            href="/resources"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New reservation
          </Link>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isAdmin && (
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
            {(["mine", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setScope(s);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  scope === s
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600"
                )}
              >
                {s === "mine" ? "Mine" : "All"}
              </button>
            ))}
          </div>
        )}

        <div className="w-48">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>

            {[
              "PENDING",
              "CONFIRMED",
              "COMPLETED",
              "CANCELLED",
              "REJECTED",
            ].map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Error */}
      {error && <ErrorBox message={error} />}

      {/* Reservations list */}
      {loading ? (
        <FullSpinner />
      ) : !data || data.items.length === 0 ? (
        <Empty text="No reservations found." />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{r.title}</h3>
                      <Badge value={r.status} />
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      <Link
                        href={`/resources/${r.resourceId}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {r.resource.name}
                      </Link>{" "}
                      · {fmtRange(r.startTime, r.endTime)}
                    </p>

                    {scope === "all" && (
                      <p className="text-xs text-slate-500">
                        By {r.user.name} ({r.user.email})
                      </p>
                    )}

                    {r.purpose && (
                      <p className="mt-1 text-sm text-slate-500">
                        {r.purpose}
                      </p>
                    )}

                    {r.status === "REJECTED" && r.rejectReason && (
                      <p className="mt-1 text-sm text-red-600">
                        Reason: {r.rejectReason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {isAdmin && r.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          loading={busyId === r.id}
                          onClick={() => approve(r)}
                        >
                          Approve
                        </Button>

                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === r.id}
                          onClick={() => setRejecting(r)}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {canCancel(r) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === r.id}
                        onClick={() => cancel(r)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Pagination
            page={data.meta.page}
            pages={data.meta.pages ?? 1}
            onChange={setPage}
          />
        </>
      )}

      {/* Reject modal */}
      {rejecting && (
        <Modal
          title={`Reject "${rejecting.title}"`}
          onClose={() => {
            setRejecting(null);
            setReason("");
          }}
        >
          <form onSubmit={submitReject} className="space-y-3">
            <Textarea
              label="Reason (shown to the requester)"
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setRejecting(null);
                  setReason("");
                }}
              >
                Back
              </Button>

              <Button type="submit" variant="danger">
                Reject reservation
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
