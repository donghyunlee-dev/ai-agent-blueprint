// Minimal mock req/res for calling Vercel-style handler(req, res) modules directly in node:test.

export function createMockReq({ method = "GET", url = "/", cookie } = {}) {
  return {
    method,
    url,
    headers: cookie ? { cookie } : {},
  };
}

export function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    end(data) {
      this.body = data;
      this.ended = true;
    },
  };
}
