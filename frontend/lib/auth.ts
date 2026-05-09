import { apiFetch } from "./api";

export async function getMe() {
  try {
    return await apiFetch<{ id: number; email: string; role: string }>(
      "/auth/me",
    );
  } catch {
    return null;
  }
}
