import { cookies } from "next/headers";
import { SetlistForm } from "@/components/setlist-form";
import { LoginPanel } from "@/components/login-panel";
import { SESSION_COOKIE, decryptJson, type Session } from "@/lib/auth";

type SearchParams = { auth_error?: string };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const session = raw ? decryptJson<Session>(raw) : null;
  const authed = session !== null;

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <section className="w-full max-w-[460px] rounded-[12px] border border-border bg-surface px-8 py-10">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-text">
          Spotify Setlist Generator
        </h1>
        <p className="mt-2 text-[14px] leading-[1.5] text-text-muted">
          {authed
            ? "Pega el enlace de una playlist y descarga el setlist en .docx."
            : "Conéctate con Spotify para generar setlists en .docx desde tus playlists."}
        </p>
        <div className="mt-8">
          {authed ? <SetlistForm /> : <LoginPanel authError={params.auth_error} />}
        </div>
      </section>
    </main>
  );
}
