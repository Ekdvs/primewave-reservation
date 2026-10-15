"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { errMsg, fieldErrors } from "@/lib/api";
import { Button, Card, ErrorBox, Input } from "@/components/ui";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", department: "" });
  const [error, setError] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrs({});
    try {
      await register({ ...f, department: f.department || undefined });
      router.replace("/dashboard");
    } catch (err) {
      setErrs(fieldErrors(err));
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-indigo-600">Create account</h1>
          <p className="text-sm text-slate-500">Join ResourceHub</p>
        </div>
        {error && <ErrorBox message={error} />}
        <form onSubmit={onSubmit} className="space-y-3">
          <Input label="Full name" required value={f.name} onChange={set("name")} error={errs.name} />
          <Input label="Email" type="email" required value={f.email} onChange={set("email")} error={errs.email} />
          <Input label="Department (optional)" value={f.department} onChange={set("department")} error={errs.department} />
          <Input
            label="Password (min 8 characters)"
            type="password"
            required
            value={f.password}
            onChange={set("password")}
            error={errs.password}
          />
          <Button type="submit" loading={busy} className="w-full">
            Register
          </Button>
        </form>
        <p className="text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}