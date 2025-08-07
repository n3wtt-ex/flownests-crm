import handler from "./index.ts";

// Optional: set fake envs here if your handler expects them.
// Deno.env.set("SUPABASE_URL", "http://localhost:54321");
// Deno.env.set("SUPABASE_ANON_KEY", "test_anon_key");

Deno.serve(async (req: Request) => {
  try {
    return await handler(req);
  } catch (err) {
    console.error("instantly-reply dev_server error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
