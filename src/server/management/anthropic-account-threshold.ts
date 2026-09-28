import type { OcxConfig } from "../../types";
import { effectiveAnthropicAccountThreshold, parseAnthropicAccountThreshold } from "../../oauth/anthropic-account-threshold";
import { getAccountSet, setAnthropicAccountThreshold } from "../../oauth/store";
import { jsonResponse } from "../auth-cors";
import { readManagementJsonBodyOr } from "./body";

/** Account-owned policy writes share the auth-store lock, not a config/auth split transaction. */
export async function handleAnthropicAccountThreshold(req: Request, config: OcxConfig): Promise<Response> {
  const body = await readManagementJsonBodyOr(req, {});
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonResponse({ error: "body must be an object" }, 400);
  const fields = body as Record<string, unknown>;
  if (fields.provider !== "anthropic" || config.providers.anthropic?.authMode !== "oauth") {
    return jsonResponse({ error: "account threshold requires Anthropic OAuth" }, 400);
  }
  if (typeof fields.accountId !== "string" || !fields.accountId.trim()) return jsonResponse({ error: "missing accountId" }, 400);
  const threshold = parseAnthropicAccountThreshold(fields.threshold);
  if (fields.threshold !== null && threshold === null) return jsonResponse({ error: "threshold must be an integer 0-100 or null" }, 400);
  if (!await setAnthropicAccountThreshold(fields.accountId, threshold)) return jsonResponse({ error: "account not found" }, 404);
  const account = getAccountSet("anthropic")?.accounts.find(row => row.id === fields.accountId);
  return jsonResponse({ ok: true, provider: "anthropic", accountId: fields.accountId,
    autoSwitchThresholdOverride: account?.autoSwitchThresholdOverride ?? null,
    effectiveAutoSwitchThreshold: effectiveAnthropicAccountThreshold(config, account),
    autoSwitchThreshold: effectiveAnthropicAccountThreshold(config) });
}
