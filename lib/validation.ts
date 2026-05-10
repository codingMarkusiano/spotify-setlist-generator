import { z } from "zod";

// Body validation only — URL shape is checked by parsePlaylistUrl downstream,
// so here we just guard against non-strings, empty input, and absurd lengths.
export const GenerateRequestSchema = z.object({
  url: z.string().min(1).max(2000),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
