const isDebugEnabled =
  process.env.NODE_ENV === "development" || process.env.DEBUG === "true";

export function logInfo(message: string) {
  console.log(message);
}

export function logDebug(message: string) {
  if (!isDebugEnabled) return;
  console.log(message);
}

export function logWarn(message: string) {
  console.warn(message);
}

export function logError(message: string) {
  console.error(message);
}
