type Props = { authError?: string };

const AUTH_ERROR_COPY: Record<string, string> = {
  invalid_state: "La sesión de inicio expiró. Inténtalo de nuevo.",
  exchange_failed: "No se pudo conectar con Spotify. Inténtalo de nuevo.",
  access_denied: "Conexión cancelada.",
};

export function LoginPanel({ authError }: Props) {
  const message = authError
    ? AUTH_ERROR_COPY[authError] ?? AUTH_ERROR_COPY.exchange_failed
    : null;
  return (
    <>
      <a
        href="/api/auth/login"
        className={[
          "mt-2 inline-flex items-center justify-center",
          "w-full h-11 px-4 rounded-md",
          "bg-accent text-black text-[14px] font-semibold tracking-[-0.01em]",
          "transition-[background-color] duration-[120ms]",
          "hover:bg-accent-hover",
        ].join(" ")}
      >
        Conectar con Spotify
      </a>
      <div className="mt-4 min-h-[18px] text-[13px] leading-[1.4]" aria-live="polite">
        {message ? <p className="text-danger">{message}</p> : null}
      </div>
    </>
  );
}
