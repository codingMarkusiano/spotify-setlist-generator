"use client";

import { useEffect, useRef, useState } from "react";

type ApiErrorCode =
  | "rate_limited"
  | "invalid_body"
  | "invalid_url"
  | "playlist_not_found"
  | "spotify_rate_limit"
  | "spotify_upstream"
  | "auth_required"
  | "internal_error";

const ERROR_COPY: Record<ApiErrorCode | "default", string> = {
  invalid_url: "Ese enlace no parece una playlist de Spotify.",
  invalid_body: "Ese enlace no parece una playlist de Spotify.",
  playlist_not_found: "No se encontró la playlist. ¿Es pública?",
  rate_limited: "Demasiadas peticiones. Prueba en un minuto.",
  spotify_rate_limit: "Demasiadas peticiones. Prueba en un minuto.",
  spotify_upstream: "Algo ha fallado. Inténtalo de nuevo.",
  auth_required: "Sesión caducada. Vuelve a conectar.",
  internal_error: "Algo ha fallado. Inténtalo de nuevo.",
  default: "Algo ha fallado. Inténtalo de nuevo.",
};

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const match = /filename="([^"]+)"/i.exec(value);
  return match?.[1] ?? null;
}

export function SetlistForm() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeout.current) clearTimeout(successTimeout.current);
    };
  }, []);

  const isLoading = status.kind === "loading";
  const trimmed = url.trim();
  const submitDisabled = isLoading || trimmed.length === 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitDisabled) return;

    if (successTimeout.current) {
      clearTimeout(successTimeout.current);
      successTimeout.current = null;
    }
    setStatus({ kind: "loading" });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!res.ok) {
        let code: ApiErrorCode | "default" = "default";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error && data.error in ERROR_COPY) {
            code = data.error as ApiErrorCode;
          }
        } catch {
          // ignore — fall through to default copy
        }
        if (code === "auth_required") {
          window.location.href = "/api/auth/login";
          return;
        }
        setStatus({ kind: "error", message: ERROR_COPY[code] });
        return;
      }

      const blob = await res.blob();
      const filename =
        filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
        "setlist.docx";

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      setStatus({ kind: "success" });
      successTimeout.current = setTimeout(() => {
        setStatus({ kind: "idle" });
        successTimeout.current = null;
      }, 2000);
    } catch {
      setStatus({ kind: "error", message: ERROR_COPY.default });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="playlist-url" className="sr-only">
        URL de la playlist de Spotify
      </label>
      <input
        id="playlist-url"
        name="url"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://open.spotify.com/playlist/..."
        value={url}
        disabled={isLoading}
        onChange={(e) => setUrl(e.target.value)}
        className={[
          "block w-full h-11 px-[14px] rounded-md text-[14px] text-text",
          "bg-surface-2 border border-border",
          "outline-none transition-[border-color,opacity] duration-[120ms]",
          "focus:border-accent",
          isLoading ? "opacity-60" : "",
        ].join(" ")}
      />

      <button
        type="submit"
        disabled={submitDisabled}
        className={[
          "mt-3 inline-flex items-center justify-center gap-2",
          "w-full h-11 px-4 rounded-md",
          "bg-accent text-black text-[14px] font-semibold tracking-[-0.01em]",
          "transition-[background-color] duration-[120ms]",
          "hover:enabled:bg-accent-hover",
          "active:enabled:[filter:brightness(0.95)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {isLoading ? (
          <>
            <Spinner />
            <span>Generando…</span>
          </>
        ) : (
          <span>Generar DOCX</span>
        )}
      </button>

      <FeedbackSlot status={status} />
    </form>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="block w-[14px] h-[14px] rounded-full border-[1.5px] border-black/30 border-t-black"
      style={{ animation: "spin 0.8s linear infinite" }}
    />
  );
}

function FeedbackSlot({ status }: { status: Status }) {
  // 16px reserved slot below the button. Stays in flow at all times to avoid
  // layout shift between idle/error/success.
  return (
    <div className="mt-4 min-h-[18px] text-[13px] leading-[1.4]" aria-live="polite">
      {status.kind === "error" ? (
        <p className="text-danger">{status.message}</p>
      ) : status.kind === "success" ? (
        <p
          className="text-accent"
          style={{ animation: "fade-out-2s 2000ms ease-out forwards" }}
        >
          Listo.
        </p>
      ) : null}
    </div>
  );
}
