export type Track = {
  position: number;
  title: string;
  artists: string[];
  durationMs: number;
};

export type Playlist = {
  id: string;
  title: string;
  coverUrl?: string;
  tracks: Track[];
  totalDurationMs: number;
};
