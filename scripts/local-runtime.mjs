import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";

const root = process.cwd();
const distDir = path.join(root, "dist");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function createApiRes(res) {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      sendJson(res, this.statusCode || 200, payload);
    },
  };
}

async function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const body = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    let target = path.join(distDir, requestedPath);

    try {
      await serveStatic(res, target);
    } catch {
      target = path.join(distDir, "index.html");
      await serveStatic(res, target);
    }
  } catch (error) {
    sendJson(res, 500, {
      message: error instanceof Error ? error.message : "Server error",
    });
  }
});

server.listen(port, host, () => {
  console.log(`SERVICE_READY http://${host}:${port}`);
});
