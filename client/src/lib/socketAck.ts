import type { Socket } from "socket.io-client";

export type AckResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

function normalizeAck<T>(response: unknown): AckResult<T> {
  if (response == null) {
    return { ok: true };
  }
  if (typeof response === "object") {
    const res = response as Record<string, unknown>;
    if (res.ok === false) {
      return {
        ok: false,
        error: typeof res.error === "string" && res.error.trim() ? res.error : "Request failed",
        data: response as T,
      };
    }
    if (res.ok === true) {
      return { ok: true, data: response as T };
    }
  }
  return { ok: true, data: response as T };
}

export function emitWithAck<T = unknown>(
  socket: Socket | null | undefined,
  event: string,
  payload?: unknown,
  timeoutMs = 15000,
): Promise<AckResult<T>> {
  if (!socket) {
    return Promise.resolve({ ok: false, error: "Not connected" });
  }
  if (typeof (socket as { connected?: boolean }).connected === "boolean" && !socket.connected) {
    return Promise.resolve({ ok: false, error: "Not connected" });
  }

  return new Promise<AckResult<T>>((resolve) => {
    let settled = false;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve({ ok: false, error: "Request timed out" });
          }, timeoutMs)
        : null;

    try {
      socket.emit(event, payload, (response: unknown) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(normalizeAck<T>(response));
      });
    } catch (error) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send request",
      });
    }
  });
}
