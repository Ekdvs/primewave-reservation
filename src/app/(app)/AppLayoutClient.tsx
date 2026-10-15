
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { FullSpinner } from "@/components/ui";

export default function AppLayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <FullSpinner />;
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        {children}
      </main>
    </>
  );
}
