import { isIP } from "node:net";

// Reject unexpected Host headers (DNS rebinding): only localhost and IP literals.
export function isAllowedHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.startsWith("[")
    ? hostHeader.slice(1, hostHeader.indexOf("]")) // [::1]:8080
    : hostHeader.replace(/:\d+$/, "");
  return host === "localhost" || host.endsWith(".localhost") || isIP(host) !== 0;
}
