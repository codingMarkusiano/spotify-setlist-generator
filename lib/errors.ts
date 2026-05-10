export class InvalidUrl extends Error {
  readonly name = "InvalidUrl";
  constructor(public readonly input: string) {
    super(`Not a valid Spotify playlist URL: ${input}`);
  }
}

export class PlaylistNotFound extends Error {
  readonly name = "PlaylistNotFound";
  constructor(public readonly playlistId: string) {
    super(`Playlist not found or not public: ${playlistId}`);
  }
}

export class SpotifyRateLimit extends Error {
  readonly name = "SpotifyRateLimit";
  constructor(public readonly retryAfterSeconds: number) {
    super(`Spotify rate limit hit; retry after ${retryAfterSeconds}s`);
  }
}

export class SpotifyUpstreamError extends Error {
  readonly name = "SpotifyUpstreamError";
  constructor(public readonly status: number, message?: string) {
    super(message ?? `Spotify upstream error (status ${status})`);
  }
}

export class SpotifyAuthError extends Error {
  readonly name = "SpotifyAuthError";
  constructor(message?: string) {
    super(message ?? "Failed to obtain Spotify access token");
  }
}
