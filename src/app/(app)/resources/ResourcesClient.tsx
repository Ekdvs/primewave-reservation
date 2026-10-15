
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import type { Category, Paged, Resource } from "@/lib/types";
import ResourceForm from "@/components/ResourceForm";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  FullSpinner,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  useToast,
} from "@/components/ui";

export default function ResourcesClient() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const toast = useToast();

  const [data, setData] = useState<Paged<Resource> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formFor, setFormFor] = useState<Resource | "new" | null>(null);
  const [showCat, setShowCat] = useState(false);
  const [catName, setCatName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Omit empty filters instead of sending q=&categoryId=&status=.
      const query = {
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(status ? { status } : {}),
        page,
        limit: 9,
      };

      const result = await api<Paged<Resource>>("/resources", {
        query,
      });

      setData(result);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, status, page]);

  const loadCats = useCallback(async () => {
    try {
      const result = await api<Category[]>("/categories");
      setCategories(result);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCats();
  }, [loadCats]);

  async function addCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      await api("/categories", {
        method: "POST",
        body: { name: catName.trim() },
      });

      toast("Category added");
      setCatName("");
      setShowCat(false);
      await loadCats();
    } catch (err) {
      toast(errMsg(err), "error");
    }
  }

  async function remove(resource: Resource) {
    if (!confirm(`Delete "${resource.name}"?`)) return;

    try {
      await api(`/resources/${resource.id}`, {
        method: "DELETE",
      });

      toast("Resource deleted");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Resources"
        subtitle="Browse and book shared facilities"
        actions={
          isAdmin ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setShowCat(true)}
              >
                + Category
              </Button>

              <Button
                onClick={() => setFormFor("new")}
                disabled={categories.length === 0}
              >
                + Add resource
              </Button>
            </>
          ) : undefined
        }
      />

      <Card className="mb-5">
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q);
          }}
        >
          <Input
            placeholder="Search name or location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </Select>

          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </Card>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <FullSpinner />
      ) : !data || data.items.length === 0 ? (
        <Empty text="No resources found." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((resource) => (
              <Card key={resource.id} className="flex flex-col">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{resource.name}</h3>
                    <p className="text-xs text-slate-500">
                      {resource.category.name}
                    </p>
                  </div>
                  <Badge value={resource.status} />
                </div>

                <dl className="mb-3 space-y-1 text-sm text-slate-600">
                  <div>📍 {resource.location ?? "—"}</div>
                  <div>
                    👥 {resource.capacity
                      ? `Up to ${resource.capacity}`
                      : "No limit"}
                  </div>
                  <div>
                    🕒 {resource.openTime} – {resource.closeTime}
                    {" "}(max {resource.maxDurationMins} min)
                  </div>
                </dl>

                {resource.requiresApproval && (
                  <div className="mb-3">
                    <Badge
                      value="APPROVAL"
                      label="Approval required"
                    />
                  </div>
                )}

                <div className="mt-auto flex flex-wrap gap-2">
                  <Link
                    href={`/resources/${resource.id}`}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    {resource.status === "ACTIVE"
                      ? "View & book"
                      : "View"}
                  </Link>

                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setFormFor(resource)}
                      >
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(resource)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
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

      {formFor && (
        <ResourceForm
          resource={formFor === "new" ? undefined : formFor}
          categories={categories}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null);
            void load();
          }}
        />
      )}

      {showCat && (
        <Modal
          title="Add category"
          onClose={() => setShowCat(false)}
        >
          <form onSubmit={addCategory} className="space-y-3">
            <Input
              label="Category name"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCat(false)}
              >
                Cancel
              </Button>

              <Button type="submit">Add</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
