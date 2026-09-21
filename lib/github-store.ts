export type ReviewPayload = {
  fields: Record<string, string>;
  checks: Record<string, boolean>;
};

export type StoredReview = {
  payload: ReviewPayload;
  updatedAt: string;
  device?: string;
};

export type ReviewDocument = {
  schemaVersion: 5 | 6;
  updatedAt: string;
  records: Record<string, StoredReview>;
};

export type GitHubConfig = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
  device: string;
};

export type GitHubRevision = {
  sha: string;
  message: string;
  authoredAt: string;
  author: string;
};

const API = "https://api.github.com";

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubFetch<T>(url: string, config: GitHubConfig, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...headers(config.token), "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : `GitHub 请求失败（${response.status}）`;
    throw new Error(response.status === 401 ? "令牌无效或已过期" : response.status === 403 ? `GitHub 拒绝访问：${message}` : message);
  }
  return data as T;
}

export function emptyDocument(): ReviewDocument {
  return { schemaVersion: 6, updatedAt: new Date(0).toISOString(), records: {} };
}

export async function verifyRepository(config: GitHubConfig) {
  return githubFetch<{ default_branch: string }>(`${API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`, config);
}

export async function pullDocument(config: GitHubConfig, ref = config.branch) {
  const url = `${API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers: headers(config.token), cache: "no-store" });
  if (response.status === 404) return { document: emptyDocument(), sha: null as string | null };
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(response.status === 401 ? "令牌无效或已过期" : (typeof data.message === "string" ? data.message : "无法读取 GitHub 数据"));
  const parsed = JSON.parse(decodeBase64(String(data.content))) as ReviewDocument;
  return {
    document: { ...emptyDocument(), ...parsed, records: parsed.records ?? {} },
    sha: String(data.sha),
  };
}

export async function pushDocument(config: GitHubConfig, document: ReviewDocument, sha: string | null, message: string) {
  const url = `${API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path.split("/").map(encodeURIComponent).join("/")}`;
  const body: Record<string, unknown> = {
    message,
    branch: config.branch,
    content: encodeBase64(`${JSON.stringify(document, null, 2)}\n`),
  };
  if (sha) body.sha = sha;
  return githubFetch<{ content: { sha: string }; commit: { sha: string } }>(url, config, { method: "PUT", body: JSON.stringify(body) });
}

export async function listRevisions(config: GitHubConfig, limit = 30) {
  const query = new URLSearchParams({ path: config.path, sha: config.branch, per_page: String(limit) });
  const rows = await githubFetch<Array<{ sha: string; commit: { message: string; author: { name: string; date: string } } }>>(
    `${API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/commits?${query}`,
    config,
  );
  return rows.map((row) => ({
    sha: row.sha,
    message: row.commit.message,
    authoredAt: row.commit.author.date,
    author: row.commit.author.name,
  })) satisfies GitHubRevision[];
}
