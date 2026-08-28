/* oxlint-disable typescript/no-floating-promises -- node:test registers top-level tests. */
import assert from "node:assert/strict";
import test from "node:test";

import { CloudflareError, type Request, type Response } from "@paperback/types";

import { MangaHereInterceptor } from "../../MangaHere/network.js";

function response(headers: Record<string, string> = {}): Response {
  return {
    url: "https://www.mangahere.cc/",
    status: 200,
    headers,
    cookies: [],
  };
}

test("adds browser headers and the adult cookie to MangaHere requests", async () => {
  let limited = 0;
  const interceptor = new MangaHereInterceptor("test", async () => "Paperback Test Agent", {
    interceptRequest: async (request: Request) => {
      limited += 1;
      return request;
    },
    interceptResponse: async (_request: Request, _response: Response, data: ArrayBuffer) => data,
  });

  const request = await interceptor.interceptRequest({
    url: "https://www.mangahere.cc/search?title=test",
    method: "GET",
  });

  assert.equal(limited, 1);
  assert.equal(request.headers?.referer, "https://www.mangahere.cc/");
  assert.equal(request.headers?.origin, "https://www.mangahere.cc");
  assert.equal(request.headers?.["user-agent"], "Paperback Test Agent");
  assert.equal(request.cookies?.isAdult, "1");
});

test("bypasses the browsing limiter only for chapterfun resolver requests", async () => {
  let limited = 0;
  const interceptor = new MangaHereInterceptor("test", async () => "Paperback Test Agent", {
    interceptRequest: async (request: Request) => {
      limited += 1;
      return request;
    },
    interceptResponse: async (_request: Request, _response: Response, data: ArrayBuffer) => data,
  });

  const request = await interceptor.interceptRequest({
    url: "https://www.mangahere.cc/chapterfun.ashx?cid=1&page=1&key=x",
    method: "GET",
    headers: { referer: "https://www.mangahere.cc/manga/example/c001/1.html" },
  });

  assert.equal(limited, 0);
  assert.equal(request.headers?.referer, "https://www.mangahere.cc/manga/example/c001/1.html");
});

test("throws a Cloudflare bypass error only for an explicit challenge", async () => {
  const interceptor = new MangaHereInterceptor("test", async () => "Paperback Test Agent", {
    interceptRequest: async (request: Request) => request,
    interceptResponse: async (_request: Request, _response: Response, data: ArrayBuffer) => data,
  });
  const request: Request = { url: "https://www.mangahere.cc/", method: "GET" };
  const data = new ArrayBuffer(0);

  await assert.rejects(
    interceptor.interceptResponse(request, response({ "cf-mitigated": "challenge" }), data),
    CloudflareError,
  );
  assert.equal(await interceptor.interceptResponse(request, response(), data), data);
});
