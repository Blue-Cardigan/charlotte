import { supabase } from "./supabase";

interface ApiFetchOptions extends RequestInit {
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const headers = new Headers(options?.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (options?.auth) {
    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data.session?.access_token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    const message = data.error ?? "Request failed";
    throw new Error(message);
  }

  return data as T;
}
