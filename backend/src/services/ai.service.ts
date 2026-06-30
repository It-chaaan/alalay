export async function chat() {
  return {
    status: "not_configured",
    message: "AI Assistant backend is not configured yet. Add the planned Supabase Edge Function or Gemini integration before enabling chat.",
  };
}
