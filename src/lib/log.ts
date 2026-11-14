// The app's one way to note a failure in the logs: what couldn't be done, and only the kind of failure
// (an error code or class name). Never a message, row, name, fact, email or token: a database error's
// details can hold the row it refused. scripts/check-logic.mjs checks no other log line passes one.
export function warnKind(what: string, error?: unknown) {
  const { code, name } = (error && typeof error === 'object' ? error : {}) as { code?: unknown; name?: unknown };
  const kind = typeof code === 'string' && code ? code : typeof name === 'string' && name !== 'Error' ? name : '';
  console.warn(kind ? `${what} (${kind})` : what);
}
