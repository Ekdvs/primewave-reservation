
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { api, errMsg, fieldErrors } from "@/lib/api";
import { fmtTime, todayLocal, toIso } from "@/lib/datetime";

import type { Availability, Resource } from "@/lib/types";

import {
  Badge,
  Button,
  Card,
  ErrorBox,
  FullSpinner,
  Input,
  Spinner,
  Textarea,
  useToast,
} from "@/components/ui";

export default function ResourceDetailClient() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [resource, setResource] = useState<Resource | null>(null);
  const [av, setAv] = useState<Availability | null>(null);
  const [date, setDate] = useState(todayLocal());

  const [loading, setLoading] = useState(true);
  const [avLoading, setAvLoading] = useState(false);
  const [error, setError] = useState("");

  const [f, setF] = useState({
    title: "",
    purpose: "",
    start: "",
    end: "",
    attendees: "",
  });

  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // Load resource details
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    api<Resource>(`/resources/${id}`)
      .then((data) => {
        if (!cancelled) {
          setResource(data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(errMsg(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load resource availability for the selected date
  const loadAv = useCallback(async () => {
    setAvLoading(true);

    try {
      const availability = await api<Availability>(
        `/resources/${id}/availability`,
        {
          query: { date },
        }
      );

      setAv(availability);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setAvLoading(false);
    }
  }, [id, date]);

  useEffect(() => {
    loadAv();
  }, [loadAv]);

  // Select a free time slot
  function pickSlot(s: { start: string; end: string }) {
    if (!resource) return;

    const startMs = new Date(s.start).getTime();

    const endMs = Math.min(
      new Date(s.end).getTime(),
      startMs + resource.maxDurationMins * 60_000
    );

    setF((current) => ({
      ...current,
      start: fmtTime(s.start),
      end: fmtTime(new Date(endMs).toISOString()),
    }));

    setFormError("");
    setErrs({});
  }

  // Submit reservation request
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);
    setFormError("");
    setErrs({});

    try {
      await api("/reservations", {
        method: "POST",
        body: {
          resourceId: id,
          title: f.title,
          purpose: f.purpose || undefined,
          attendees: f.attendees ? Number(f.attendees) : undefined,
          startTime: toIso(date, f.start),
          endTime: toIso(date, f.end),
        },
      });

      toast(
        resource?.requiresApproval
          ? "Request submitted for approval"
          : "Reservation confirmed"
      );

      setF({
        title: "",
        purpose: "",
        start: "",
        end: "",
        attendees: "",
      });

      await loadAv();
    } catch (err) {
      setErrs(fieldErrors(err));
      setFormError(errMsg(err));
      await loadAv();
    } finally {
      setBusy(false);
    }
  }

  // Loading state
  if (loading) {
    return <FullSpinner />;
  }

  // Resource not found or failed to load
  if (!resource) {
    return <ErrorBox message={error || "Resource not found"} />;
  }

  const bookable = resource.status === "ACTIVE";

  return (
    <>
      <Link
        href="/resources"
        className="mb-3 inline-block text-sm text-indigo-600 hover:underline"
      >
        ← Back to resources
      </Link>

      {/* Resource details */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{resource.name}</h1>

            <p className="text-sm text-slate-500">
              {resource.category.name} ·{" "}
              {resource.location ?? "No location"}
            </p>

            {resource.description && (
              <p className="mt-2 text-sm text-slate-600">
                {resource.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge value={resource.status} />

            {resource.requiresApproval && (
              <Badge
                value="APPROVAL"
                label="Approval required"
              />
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            👥{" "}
            {resource.capacity
              ? `Capacity ${resource.capacity}`
              : "No capacity limit"}
          </div>

          <div>
            🕒 {resource.openTime} – {resource.closeTime}
          </div>

          <div>⏱ Max {resource.maxDurationMins} minutes</div>
        </div>
      </Card>

      {/* Resource availability warning */}
      {!bookable && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This resource is currently{" "}
          {resource.status.toLowerCase()} and cannot be booked.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Availability panel */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Availability</h2>

            <input
              type="date"
              value={date}
              min={todayLocal()}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          {avLoading && !av ? (
            <div className="flex justify-center py-6 text-indigo-600">
              <Spinner />
            </div>
          ) : av ? (
            <div className="space-y-4">
              {/* Free time slots */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Free slots (click to use)
                </h3>

                {av.freeSlots.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No free time on this day.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {av.freeSlots.map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => pickSlot(s)}
                        disabled={!bookable}
                        className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-800 hover:bg-green-100 disabled:opacity-50"
                      >
                        {fmtTime(s.start)} – {fmtTime(s.end)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing bookings */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Booked
                </h3>

                {av.bookings.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nothing booked yet.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {av.bookings.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span>
                          {fmtTime(b.startTime)} – {fmtTime(b.endTime)}

                          {b.mine && (
                            <span className="ml-2 text-xs font-medium text-indigo-600">
                              (yours)
                            </span>
                          )}
                        </span>

                        <Badge value={b.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <ErrorBox
              message={error || "Could not load availability."}
            />
          )}

          {avLoading && av && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Spinner />
              Refreshing availability...
            </div>
          )}
        </Card>

        {/* Reservation form */}
        <Card>
          <h2 className="mb-3 font-semibold">Book this resource</h2>

          <form onSubmit={onSubmit} className="space-y-3">
            {formError && <ErrorBox message={formError} />}

            <Input
              label="Title"
              required
              value={f.title}
              onChange={(e) =>
                setF({ ...f, title: e.target.value })
              }
              error={errs.title}
              disabled={!bookable}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Start"
                type="time"
                required
                value={f.start}
                onChange={(e) =>
                  setF({ ...f, start: e.target.value })
                }
                error={errs.startTime}
                disabled={!bookable}
              />

              <Input
                label="End"
                type="time"
                required
                value={f.end}
                onChange={(e) =>
                  setF({ ...f, end: e.target.value })
                }
                error={errs.endTime}
                disabled={!bookable}
              />

              <Input
                label="Attendees"
                type="number"
                min={1}
                value={f.attendees}
                onChange={(e) =>
                  setF({ ...f, attendees: e.target.value })
                }
                error={errs.attendees}
                disabled={!bookable}
              />
            </div>

            <Textarea
              label="Purpose (optional)"
              value={f.purpose}
              onChange={(e) =>
                setF({ ...f, purpose: e.target.value })
              }
              error={errs.purpose}
              disabled={!bookable}
            />

            <p className="text-xs text-slate-500">
              Date: {date} (Sri Lanka time)
            </p>

            <Button
              type="submit"
              loading={busy}
              disabled={!bookable}
              className="w-full"
            >
              {resource.requiresApproval
                ? "Request reservation"
                : "Confirm reservation"}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
