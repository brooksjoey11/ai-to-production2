import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function encodeState(returnTo: string): string {
  return Buffer.from(JSON.stringify({ returnTo }), "utf8").toString("base64url");
}

function decodeState(state: string): string {
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "returnTo" in parsed &&
      typeof (parsed as Record<string, unknown>).returnTo === "string"
    ) {
      const returnTo = (parsed as { returnTo: string }).returnTo;
      // Must be path-only: starts with / and no protocol/host
      if (returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("://")) {
        return returnTo;
      }
    }
  } catch {
    // fall through
  }
  return "/";
}

// Rate limit: max 20 OAuth requests per IP per minute
const oauthRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication requests, please try again later." },
});

export function registerGoogleOAuth(app: Express) {
  const client = new OAuth2Client(
    ENV.googleClientId,
    ENV.googleClientSecret,
    ENV.googleRedirectUri
  );

  // GET /api/auth/google — redirect to Google consent screen
  app.get("/api/auth/google", oauthRateLimit, (req: Request, res: Response) => {
    const rawReturnTo = getQueryParam(req, "returnTo") ?? "/";
    // Validate: must be path-only
    const returnTo =
      rawReturnTo.startsWith("/") &&
      !rawReturnTo.startsWith("//") &&
      !rawReturnTo.includes("://")
        ? rawReturnTo
        : "/";

    const state = encodeState(returnTo);

    const authUrl = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["openid", "email", "profile"],
      redirect_uri: ENV.googleRedirectUri,
      state,
    });

    res.redirect(302, authUrl);
  });

  // GET /api/auth/google/callback — handle Google callback
  app.get("/api/auth/google/callback", oauthRateLimit, async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const { tokens } = await client.getToken({ code, redirect_uri: ENV.googleRedirectUri });

      if (!tokens.id_token) {
        res.status(500).json({ error: "id_token missing from Google token response" });
        return;
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: ENV.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        res.status(500).json({ error: "Invalid id_token payload" });
        return;
      }

      const { sub, email, name } = payload;

      await db.upsertUser({
        openId: sub,
        email: email ?? null,
        name: name ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(sub, {
        name: name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      const returnTo = decodeState(state);
      res.redirect(302, returnTo);
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });
}
