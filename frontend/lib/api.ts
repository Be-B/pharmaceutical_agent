const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type UserProfile = {
  id: number;
  email: string;
  role: string;
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  symptoms_note?: string | null;
  current_medications?: string | null;
  allergies?: string | null;
};

export const api = {
  // auth — 본인 프로필은 단일 리소스 /auth/me 로 통일 (GET 조회, PATCH 부분수정)
  me: () => apiFetch<UserProfile>("/auth/me"),
  updateMe: (body: Partial<UserProfile>) =>
    apiFetch<UserProfile>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  logout: () => apiFetch("/auth/logout", { method: "POST" }),
  // chat sessions
  listSessions: () => apiFetch<Session[]>("/chat/sessions"),
  createSession: (title?: string) =>
    apiFetch<Session>("/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  listMessages: (sid: string) =>
    apiFetch<Msg[]>(`/chat/sessions/${sid}/messages`),
  // prompts
  listPrompts: () => apiFetch<Prompt[]>("/prompts"),
  getPrompt: (key: string) => apiFetch<PromptDetail>(`/prompts/${key}`),
  createPrompt: (body: { key: string; description: string }) =>
    apiFetch<Prompt>("/prompts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createVersion: (
    key: string,
    body: {
      content: string;
      model?: string | null;
      temperature?: number | null;
    },
  ) =>
    apiFetch<Version>(`/prompts/${key}/versions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  // 활성 버전 = 단일 리소스. PUT 으로 교체 (idempotent).
  setActiveVersion: (key: string, version_number: number) =>
    apiFetch<Version>(`/prompts/${key}/active-version`, {
      method: "PUT",
      body: JSON.stringify({ version_number }),
    }),
  listActivations: (key: string) =>
    apiFetch<Activation[]>(`/prompts/${key}/activations`),
};

export type Session = {
  id: string;  // UUID hex
  title: string;
  created_at: string;
  updated_at: string;
};
export type Msg = {
  id: number;
  role: string;
  content: string;
  tool_calls: unknown[] | null;
  prompt_version_id: number | null;
  created_at: string;
};
export type Prompt = {
  id: number;
  key: string;
  description: string;
  created_at: string;
};
export type Version = {
  id: number;
  version_number: number;
  content: string;
  model: string | null;
  temperature: number | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
};
export type PromptDetail = Prompt & { versions: Version[] };
export type Activation = {
  id: number;
  prompt_version_id: number;
  version_number: number;
  activated_by: number | null;
  activated_by_email: string | null;
  activated_at: string;
  deactivated_at: string | null;
};
