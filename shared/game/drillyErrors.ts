// Only these reviewed messages may cross the AI service boundary into the game UI.
export const DRILLY_ERRORS = {
  unproven:
    "Drilly could not finish testing its room within the building budget. Retry; your draft and medals are unchanged.",
  configuration: "Drilly is not configured. Set the backend OpenAI API key.",
  credentials: "Drilly’s API key was rejected. Check the backend OpenAI key.",
  quota:
    "Drilly’s OpenAI account has no available API quota. Check API billing and credits.",
  rateLimit: "Drilly’s AI service is busy. Wait a moment before retrying.",
  request:
    "Drilly’s AI request was rejected. Check the configured model and API permissions.",
  timeout: "Drilly took too long to respond. Retry; no medals were awarded.",
  incomplete:
    "Drilly’s AI response was incomplete. Retry; no medals were awarded.",
  unavailable:
    "Drilly could not finish thinking. Please retry; no medals were awarded.",
} as const;

export function drillyErrorMessage(error: unknown, fallback: string): string {
  const value = error instanceof Error ? error.message : error;
  return (
    Object.values(DRILLY_ERRORS).find((message) => value === message) ??
    fallback
  );
}
