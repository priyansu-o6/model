"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearTokens, isAuthenticated, refreshAccessToken, willExpireSoon } from "@/lib/auth";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const PUBLIC_PATHS = ["/login"];

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkAuth() {
      const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
      if (isPublic) {
        if (mounted) setReady(true);
        return;
      }

      if (!isAuthenticated()) {
        router.replace("/login");
        return;
      }

      if (willExpireSoon(120)) {
        const ok = await refreshAccessToken();
        if (!ok) {
          clearTokens();
          router.replace("/login");
          return;
        }
      }
      if (mounted) setReady(true);
    }
    checkAuth();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!ready) {
    return <div className="p-6 text-sm text-text-muted">Checking authentication...</div>;
  }

  return <>{children}</>;
}
