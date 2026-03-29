import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminIdentity } from "../../shared/contracts";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; admin: AdminIdentity }
  | { status: "unauthenticated" };

export function useAdminAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const mountedRef = useRef(true);

  const refreshAuth = useCallback(async () => {
    try {
      const admin = await apiFetch<AdminIdentity>("/api/auth/me", { auth: true });
      if (mountedRef.current) {
        setState({ status: "authenticated", admin });
      }
    } catch {
      if (mountedRef.current) {
        setState({ status: "unauthenticated" });
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshAuth();

    const listener = supabase.auth.onAuthStateChange(() => {
      if (!mountedRef.current) {
        return;
      }
      void refreshAuth();
    });

    return () => {
      mountedRef.current = false;
      listener.data.subscription.unsubscribe();
    };
  }, [refreshAuth]);

  return { ...state, refresh: refreshAuth };
}
