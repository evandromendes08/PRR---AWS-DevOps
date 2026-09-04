const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1_048_576);

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": process.env.CORS_ORIGIN || "*",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  });
  res.end(status === 204 ? undefined : JSON.stringify(payload));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    let tooLarge = false;

    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (tooLarge) return reject(requestError("Request body is too large", 413));
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(requestError("Request body must be valid JSON", 400));
      }
    });
    req.on("error", reject);
  });
}

function apiPath(pathname) {
  return pathname.startsWith("/api/") ? pathname.slice(4) : pathname;
}

module.exports = { json, body, apiPath };
