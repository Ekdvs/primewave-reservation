"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { Button, Card, ErrorBox, Input } from "@/components/ui";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-indigo-600">ResourceHub</h1>
          <p className="text-sm text-slate-500">Sign in to manage reservations</p>
        </div>
        {error && <ErrorBox message={error} />}
        <form onSubmit={onSubmit} className="space-y-3">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" loading={busy} className="w-full">
            Sign in
          </Button>
        </form>
        <p className="text-center text-sm text-slate-500">
          No account?{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:underline">
            Register
          </Link>
        </p>
        <p className="rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-500">
          Demo: admin@primewave.lk / Password@123
        </p>
      </Card>
    </div>
  );
}