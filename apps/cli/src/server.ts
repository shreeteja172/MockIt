import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";

export type ServerOptions = {
  host?: string;
  port?: number;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4000;

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) => {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
};

const pick = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)]!;

const firstNames = [
  "Ava",
  "Liam",
  "Maya",
  "Noah",
  "Zoe",
  "Ethan",
  "Ivy",
  "Leo",
];
const lastNames = [
  "Sharma",
  "Smith",
  "Khan",
  "Patel",
  "Garcia",
  "Johnson",
  "Ng",
  "Brown",
];
const topics = [
  "Auth",
  "Dashboard",
  "API",
  "Search",
  "Billing",
  "Profile",
  "Notifications",
  "Deploy",
];
const verbs = [
  "improve",
  "fix",
  "refactor",
  "optimize",
  "ship",
  "review",
  "test",
  "document",
];

const createMockUser = () => {
  const firstName = pick(firstNames);
  const lastName = pick(lastNames);
  const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;

  return {
    id: randomUUID(),
    fullName: `${firstName} ${lastName}`,
    username,
    email: `${username}@example.com`,
    avatarUrl: `https://api.dicebear.com/9.x/identicon/svg?seed=${username}`,
  };
};

const createMockPost = () => {
  const topic = pick(topics);
  const verb = pick(verbs);

  return {
    id: randomUUID(),
    title: `${topic}: ${verb} workflow`,
    body: `This is a generated ${topic.toLowerCase()} note used for mock API responses.`,
    createdAt: new Date(
      Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000),
    ).toISOString(),
  };
};

const getCountFromUrl = (urlText: string | undefined, fallback = 5): number => {
  if (!urlText) {
    return fallback;
  }

  const url = new URL(urlText, "http://localhost");
  const rawCount = Number(url.searchParams.get("count") ?? fallback);

  if (!Number.isFinite(rawCount)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(rawCount), 1), 50);
};

export const startServer = ({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
}: ServerOptions = {}) => {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

    if (request.method === "GET" && pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/users") {
      const count = getCountFromUrl(request.url, 8);
      sendJson(response, 200, {
        users: Array.from({ length: count }, createMockUser),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/posts") {
      const count = getCountFromUrl(request.url, 5);
      sendJson(response, 200, {
        posts: Array.from({ length: count }, createMockPost),
      });
      return;
    }

    sendJson(response, 404, {
      message: "Route not found",
      availableRoutes: [
        "GET /health",
        "GET /users?count=10",
        "GET /posts?count=5",
      ],
    });
  });

  server.listen(port, host, () => {
    console.log(`Mock API running at http://${host}:${port}`);
  });

  return server;
};
