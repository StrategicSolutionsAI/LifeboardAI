// Helper functions for Todoist OAuth flow
// Note: You must set the following environment variables in your .env.local file:
// TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET, NEXT_PUBLIC_SITE_URL
// The redirect URI registered in your Todoist app should be:
//   {NEXT_PUBLIC_SITE_URL}/api/auth/todoist/callback

import { stringify } from 'querystring';

interface TodoistTokenResponse {
  access_token: string;
  token_type: string;
  // Todoist returns no refresh_token; tokens are long-lived unless revoked.
}

const TODOIST_AUTH_BASE = 'https://todoist.com/oauth/authorize';
const TODOIST_TOKEN_URL = 'https://todoist.com/oauth/access_token';

export function getTodoistAuthUrl(): string {
  const clientId = process.env.TODOIST_CLIENT_ID;
  if (!clientId) throw new Error('TODOIST_CLIENT_ID env var missing');

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/todoist/callback`;
  const scope = 'data:read_write';

  const params = new URLSearchParams({
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
  });

  return `${TODOIST_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeTodoistCodeForToken(code: string): Promise<TodoistTokenResponse> {
  const clientId = process.env.TODOIST_CLIENT_ID;
  const clientSecret = process.env.TODOIST_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Todoist client env vars missing');

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/todoist/callback`;

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  };

  const res = await fetch(TODOIST_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Todoist token exchange failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as TodoistTokenResponse;
  return data;
} 