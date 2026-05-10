import { z } from "zod";
import { spotifyFetch } from "./client.ts";
import type { Playlist, Track } from "./types.ts";
import { PlaylistNotFound, SpotifyUpstreamError } from "../errors.ts";

const ArtistSchema = z.object({ name: z.string() });

const TrackSchema = z.object({
  name: z.string(),
  duration_ms: z.number().int().nonnegative(),
  artists: z.array(ArtistSchema),
});

// Each item in the paging object holds the actual track. Historically Spotify
// returned this under `track`; current responses use `item`. Accept either.
const TrackItemSchema = z
  .object({
    track: z.union([TrackSchema, z.null()]).optional(),
    item: z.union([TrackSchema, z.null()]).optional(),
  });

const PagedTracksSchema = z.object({
  items: z.array(TrackItemSchema),
  next: z.string().nullable(),
});

// Spotify's `/v1/playlists/{id}` response. The paging object historically lived
// under `tracks`; in current responses it lives under `items`. Some responses
// omit the paging object entirely (newer dev-mode behavior) — in that case we
// fall back to GET /v1/playlists/{id}/tracks.
const PlaylistEnvelopeSchema = z.object({
  id: z.string(),
  name: z.string(),
  images: z.array(z.object({ url: z.string() })).default([]),
  tracks: PagedTracksSchema.optional(),
  items: PagedTracksSchema.optional(),
});

type RawTrackItem = z.infer<typeof TrackItemSchema>;

function appendItems(out: Track[], items: ReadonlyArray<RawTrackItem>): void {
  for (const entry of items) {
    const t = entry.track ?? entry.item;
    if (!t) continue;
    out.push({
      position: out.length + 1,
      title: t.name,
      artists: t.artists.map((a) => a.name),
      durationMs: t.duration_ms,
    });
  }
}

export async function getPlaylist(token: string, id: string): Promise<Playlist> {
  const res = await spotifyFetch(token, `/v1/playlists/${encodeURIComponent(id)}`);
  // 403 from this endpoint means Spotify is hiding tracks (e.g. Dev-Mode app
  // viewing a playlist the user doesn't own). Treat it as not-found from our
  // perspective so the UI surfaces a sensible message.
  if (res.status === 404 || res.status === 403) throw new PlaylistNotFound(id);
  if (!res.ok) throw new SpotifyUpstreamError(res.status);

  const envelope = PlaylistEnvelopeSchema.parse(await res.json());

  const collected: Track[] = [];
  // Inline paging if present, otherwise hit the dedicated /tracks endpoint.
  let next: string | null;
  const inline = envelope.tracks ?? envelope.items;
  if (inline) {
    appendItems(collected, inline.items);
    next = inline.next;
  } else {
    const tracksRes = await spotifyFetch(
      token,
      `/v1/playlists/${encodeURIComponent(id)}/tracks?limit=100`,
    );
    if (tracksRes.status === 403 || tracksRes.status === 404) throw new PlaylistNotFound(id);
    if (!tracksRes.ok) throw new SpotifyUpstreamError(tracksRes.status);
    const page = PagedTracksSchema.parse(await tracksRes.json());
    appendItems(collected, page.items);
    next = page.next;
  }

  // Follow the cursor `next` URL until exhausted — Spotify returns absolute URLs.
  while (next) {
    const pageRes = await spotifyFetch(token, next);
    if (!pageRes.ok) throw new SpotifyUpstreamError(pageRes.status);
    const page = PagedTracksSchema.parse(await pageRes.json());
    appendItems(collected, page.items);
    next = page.next;
  }

  const totalDurationMs = collected.reduce((acc, t) => acc + t.durationMs, 0);
  return {
    id: envelope.id,
    title: envelope.name,
    coverUrl: envelope.images[0]?.url,
    tracks: collected,
    totalDurationMs,
  };
}
