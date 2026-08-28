import {
  BasicRateLimiter,
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

import { BASE_URL } from "./constants.js";

type UserAgentProvider = () => Promise<string>;

type RateLimiter = {
  interceptRequest(request: Request): Promise<Request>;
  interceptResponse(request: Request, response: Response, data: ArrayBuffer): Promise<ArrayBuffer>;
};

export type MangaHereTextResponse = {
  status: number;
  body: string;
};

function isResolverRequest(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith("/chapterfun.ashx");
  } catch {
    return false;
  }
}

function challengeHeader(response: Response): string | undefined {
  const entry = Object.entries(response.headers).find(
    ([name]) => name.toLowerCase() === "cf-mitigated",
  );
  return entry?.[1];
}

export class MangaHereInterceptor extends PaperbackInterceptor {
  constructor(
    id: string,
    private readonly getUserAgent: UserAgentProvider = () => Application.getDefaultUserAgent(),
    private readonly limiter: RateLimiter = new BasicRateLimiter(`${id}-browsing`, {
      numberOfRequests: 12,
      bufferInterval: 10,
      ignoreImages: true,
    }),
  ) {
    super(id);
  }

  override async interceptRequest(request: Request): Promise<Request> {
    const prepared: Request = {
      ...request,
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        origin: BASE_URL,
        referer: `${BASE_URL}/`,
        "user-agent": await this.getUserAgent(),
        ...request.headers,
      },
      cookies: { ...request.cookies, isAdult: "1" },
    };

    return isResolverRequest(prepared.url) ? prepared : this.limiter.interceptRequest(prepared);
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    if (challengeHeader(response)?.toLowerCase() === "challenge") {
      throw new CloudflareError(request, "MangaHere requires Cloudflare verification");
    }
    return isResolverRequest(request.url)
      ? data
      : this.limiter.interceptResponse(request, response, data);
  }
}

export class MangaHereNetwork {
  private readonly interceptor: MangaHereInterceptor;
  private registered = false;

  constructor(interceptorId = "MangaHere") {
    this.interceptor = new MangaHereInterceptor(interceptorId);
  }

  initialise(): void {
    if (this.registered) return;
    this.interceptor.registerInterceptor();
    this.registered = true;
  }

  async requestText(request: Request): Promise<MangaHereTextResponse> {
    const [response, data] = await Application.scheduleRequest(request);
    return {
      status: response.status,
      body: Application.arrayBufferToUTF8String(data),
    };
  }
}
