// Marker header set by API routes on 401 responses that mean the app session
// itself is gone (as opposed to provider-auth 401s like an expired Todoist or
// Google token, which must NOT sign the user out). The client fetch wrapper
// (fetch-with-timeout.ts) redirects to /login when it sees this header —
// checking a header instead of parsing the body keeps the contract
// machine-readable and independent of error-message wording.
export const SESSION_EXPIRED_HEADER = 'x-session-expired'
