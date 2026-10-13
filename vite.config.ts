import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const currentDir = process.cwd();
const projectRoot = existsSync(path.join(currentDir, "api/auth/google/start.js")) ? currentDir : path.resolve(currentDir, "../..");
const guideDir = path.resolve(projectRoot, "docs/guide");
const importServerModule = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{ default: (req: any, res: any) => unknown }>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "generated-guide";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);
  // Backward-compatible local migration: copy the legacy value into the
  // dev-server process. Client code never reads import.meta.env for OpenAI.
  if (!process.env.OPENAI_API_KEY && env.VITE_OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.VITE_OPENAI_API_KEY;
  }

  return {
    root: process.cwd(),
    resolve: { dedupe: ["react", "react-dom"] },
    server: { host: "localhost", port: 5173, strictPort: true },
    plugins: [
      react(),
      !env.VERCEL && {
        name: "local-api-dev",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const raw = req.url ?? "";
            const url = new URL(raw, "http://localhost");

            function sendJson(statusCode: number, payload: unknown) {
              res.statusCode = statusCode;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify(payload));
            }

            function makeApiRes() {
              let _status = 200;
              return {
                status(code: number) { _status = code; return this; },
                json(payload: unknown) { sendJson(_status, payload); },
              };
            }

            try {
              const authHandlerPath: Record<string, string> = {
                "/api/auth/google/start": "api/auth/google/start.js",
                "/api/auth/google/callback": "api/auth/google/callback.js",
                "/api/auth/session": "api/auth/session.js",
                "/api/auth/logout": "api/auth/logout.js",
              };
              const authPath = authHandlerPath[url.pathname];
              if (authPath) {
                const chunks: Buffer[] = [];
                await new Promise<void>((resolve, reject) => {
                  req.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
                  req.on("end", resolve);
                  req.on("error", reject);
                });
                const body = Buffer.concat(chunks);
                const apiReq = Object.assign(req, { url: raw, method: req.method, headers: req.headers, body });
                const handlerUrl = pathToFileURL(path.resolve(projectRoot, authPath)).href;
                const { default: handler } = await importServerModule(handlerUrl);
                await handler(apiReq, res);
                return;
              }

              const blueprintMatch = url.pathname.match(/^\/api\/blueprint\/(chat|requirements|prd)$/);
              if (blueprintMatch) {
                const handlers = {
                  chat: () => import("./api/blueprint/chat.js"),
                  requirements: () => import("./api/blueprint/requirements.js"),
                  prd: () => import("./api/blueprint/prd.js"),
                } as const;
                let rawBody = "";
                await new Promise<void>((resolve, reject) => {
                  req.on("data", (chunk) => { rawBody += chunk; });
                  req.on("end", resolve);
                  req.on("error", reject);
                });
                const { default: handler } = await handlers[blueprintMatch[1] as keyof typeof handlers]();
                await handler({ method: req.method, body: rawBody ? JSON.parse(rawBody) : {} }, makeApiRes());
                return;
              }

            } catch (error) {
              sendJson(500, { message: error instanceof Error ? error.message : "Server error" });
              return;
            }

            next();
          });
        },
      },
      {
        name: "local-guide-writer",
        configureServer(server) {
          server.middlewares.use("/__guide/save", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end("Method Not Allowed");
              return;
            }

            let rawBody = "";
            req.on("data", (chunk) => {
              rawBody += chunk;
            });

            req.on("end", async () => {
              try {
                const payload = JSON.parse(rawBody) as {
                  content?: string;
                  suggestedKey?: string;
                  tags?: string[];
                  title?: string;
                };

                if (!payload.title || !payload.content) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "title and content are required" }));
                  return;
                }

                await fs.mkdir(guideDir, { recursive: true });

                const baseKey = slugify(payload.suggestedKey || payload.title);
                let fileKey = baseKey;
                let counter = 2;

                while (true) {
                  try {
                    await fs.access(path.join(guideDir, `${fileKey}.md`));
                    fileKey = `${baseKey}-${counter}`;
                    counter += 1;
                  } catch {
                    break;
                  }
                }

                const tags = (payload.tags || []).map((tag) => tag.trim()).filter(Boolean).join(", ");
                const frontmatter = [
                  "---",
                  `title: ${payload.title}`,
                  tags ? `tags: ${tags}` : "",
                  "---",
                  "",
                ]
                  .filter(Boolean)
                  .join("\n");

                const content = `${frontmatter}${payload.content}`.replace(/\n{3,}/g, "\n\n");
                const relativePath = `docs/guide/${fileKey}.md`;
                await fs.writeFile(path.join(guideDir, `${fileKey}.md`), content, "utf8");

                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    key: fileKey,
                    title: payload.title,
                    path: relativePath,
                    content: payload.content,
                    tags: payload.tags || [],
                  }),
                );
              } catch (error) {
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    error: error instanceof Error ? error.message : "failed to save guide",
                  }),
                );
              }
            });
          });
        },
      },
    ],
  };
});
