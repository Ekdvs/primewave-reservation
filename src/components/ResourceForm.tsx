"use client";
import { FormEvent, useState } from "react";
import { api, errMsg, fieldErrors } from "@/lib/api";
import type { Category, Resource } from "@/lib/types";
import { Button, ErrorBox, Input, Modal, Select, Textarea, useToast } from "./ui";

export default function ResourceForm({
  resource,
  categories,
  onClose,
  onSaved,
}: {
  resource?: Resource;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({
    name: resource?.name ?? "",
    categoryId: resource?.categoryId ?? categories[0]?.id ?? "",
    location: resource?.location ?? "",
    capacity: resource?.capacity?.toString() ?? "",
    description: resource?.description ?? "",
    openTime: resource?.openTime ?? "08:00",
    closeTime: resource?.closeTime ?? "18:00",
    maxDurationMins: String(resource?.maxDurationMins ?? 240),
    requiresApproval: resource?.requiresApproval ?? false,
    status: resource?.status ?? "ACTIVE",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrs({});
    const body = {
      name: f.name,
      categoryId: f.categoryId,
      location: f.location || null,
      capacity: f.capacity ? Number(f.capacity) : null,
      description: f.description || null,
      openTime: f.openTime,
      closeTime: f.closeTime,
      maxDurationMins: Number(f.maxDurationMins),
      requiresApproval: f.requiresApproval,
      status: f.status,
    };
    try {
      if (resource) await api(`/resources/${resource.id}`, { method: "PATCH", body });
      else await api("/resources", { method: "POST", body });
      toast(resource ? "Resource updated" : "Resource created");
      onSaved();
    } catch (err) {
      setErrs(fieldErrors(err));
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={resource ? "Edit resource" : "Add resource"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <ErrorBox message={error} />}
        <Input label="Name" required value={f.name} onChange={set("name")} error={errs.name} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" required value={f.categoryId} onChange={set("categoryId")} error={errs.categoryId}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Status" value={f.status} onChange={set("status")} error={errs.status}>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Location" value={f.location} onChange={set("location")} error={errs.location} />
          <Input label="Capacity" type="number" min={1} value={f.capacity} onChange={set("capacity")} error={errs.capacity} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Opens" type="time" value={f.openTime} onChange={set("openTime")} error={errs.openTime} />
          <Input label="Closes" type="time" value={f.closeTime} onChange={set("closeTime")} error={errs.closeTime} />
          <Input
            label="Max mins"
            type="number"
            min={15}
            max={1440}
            value={f.maxDurationMins}
            onChange={set("maxDurationMins")}
            error={errs.maxDurationMins}
          />
        </div>
        <Textarea label="Description" value={f.description} onChange={set("description")} error={errs.description} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.requiresApproval}
            onChange={(e) => setF({ ...f, requiresApproval: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
          />
          Reservations require admin approval
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {resource ? "Save changes" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}