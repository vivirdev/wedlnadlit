// Wedding advisor: two actions wrapped in one Edge Function.
//   action=classify  → Haiku 4.5  → returns structured guest classification (JSON)
//   action=chat      → Sonnet 4.6 → returns advisor reply with full wedding-state context
//
// Reads ANTHROPIC_API_KEY from Edge Function secrets (set in Supabase dashboard).
// Anthropic minimum-floor invariant: every gift_* >= 400.

// Ambient Deno declaration — this file runs on Deno (Supabase Edge Runtime), not the Vite bundle.
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLASSIFY_SYSTEM = `מסווג אורחים לחתונה ישראלית 2026 (נדב+ליטל). קלט: שם+הערה. החזר JSON בלבד:
{"side":"חתן|כלה|משותף","category":"<cat>","head_count":int,"plus_one":bool,"attendance_prob":0-1,"gift_low":int,"gift_realistic":int,"gift_high":int,"confidence":"high|medium|low","reasoning":"משפט קצר"}

קטגוריות (cat): family_immediate, family_close, family_extended, friends_bff, friends_close, friends, friends_acquaintance, work_close, work, work_boss, parents_friends, neighbors, abroad.

head_count = כמה נפשות במעטפה אחת (לא כמה מעטפות). "יוסי"=1; "יוסי ושרה"/"דני+מיכל"/"+1"=2; "משפחת כהן" בלי מספר=2; "משפחת כהן 4"/"+2 ילדים"=4; "+3"=4. ילדים מתחת ל-3 לא נספרים.

gift_* = סך המעטפה (לא לראש). חובה: gift_* ≥ 400×head_count, וגם gift_low ≤ gift_realistic ≤ gift_high. plus_one = (head_count≥2).

ברירות מחדל לבודד (head_count=1): attendance%, realistic(low-high):
  family_immediate 100%, 1500(1200-2500) — הורים/אחים/ילדים
  family_close 100%, 900(700-1500) — סבים/דודים
  family_extended 90%, 550(450-800) — בני דודים
  friends_bff 100%, 750(600-1200) — חברי נפש
  friends_close 95%, 600(500-900) — צבא/ילדות
  friends 85%, 500(400-700)
  friends_acquaintance 60%, 450(400-600) — מכרים
  work_close 80%, 550(450-800)
  work 60%, 450(400-600)
  work_boss 70%, 750(600-1100)
  parents_friends 80%, 600(500-900)
  neighbors 70%, 500(400-700)
  abroad 30%, 500(400-800)

לזוג (head_count=2) הכפל את ה-realistic ב-1.85, low ב-1.5, high ב-1.7, עגל למאות. ל-head_count≥3 הכפל את ערכי הזוג ב-(head_count/2). תמיד שמור gift_low ≥ 400×head_count.

תיוג: הורה/אח/בן→family_immediate. סבא/דוד→family_close. בן דוד→family_extended. חבר נפש→friends_bff. צבא/ילדות→friends_close. אוני/חוג→friends. מכר→friends_acquaintance. צוות קרוב→work_close. קולגה→work. בוס/בכיר→work_boss. חבר של ההורים→parents_friends. שכן→neighbors. חו״ל→abroad. "לא בקשר"→הורד הגעה 30-50%, confidence=low. ללא הקשר→friends, confidence=low.

JSON בלבד, ללא markdown.`;

const CHAT_SYSTEM = `אתה יועץ חתונה אישי לנדב וליטל. החתונה שלהם מתקרבת.
בכל הודעה תקבל תמונת מצב מלאה ועדכנית של תכנון החתונה (הוצאות, מקדמות, מי שילם, אורחים, צ'קליסט, ימים שנותרו, מדד צרכן).
ענה בעברית, ישיר וקצר. תן המלצות פרקטיות ומבוססות על הנתונים האמיתיים שלפניך.
אם אתה רואה סיכון תקציבי או חריגה — אמור במפורש מה הסיכון ומה הפעולה המדויקת לעשות.
אם המצב תקין — אמור גם את זה במשפט קצר, אל תמציא בעיות.
ציין מספרים אמיתיים מהנתונים, לא הערכות גנריות.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "Server misconfigured: ANTHROPIC_API_KEY not set" }, 500);
    }

    const body = await req.json();

    if (body.action === "classify") return await handleClassify(body, apiKey);
    if (body.action === "chat") return await handleChat(body, apiKey);

    return json({ error: "Unknown action — expected 'classify' or 'chat'" }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

async function handleClassify(body: { name?: string; note?: string }, apiKey: string) {
  const { name, note } = body;
  if (!name || typeof name !== "string") {
    return json({ error: "Missing 'name'" }, 400);
  }

  const userMessage = `שם: ${name}\nהערה: ${note?.trim() || "(אין)"}\n\nהחזר JSON בלבד.`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: HAIKU,
      max_tokens: 500,
      // Prompt caching keeps the constant system block in Anthropic's cache for
      // ~5min at 10% input-token rate — required to survive 50K tokens/min on
      // bulk CSV imports of 200+ guests.
      system: [
        { type: "text", text: CLASSIFY_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Pass 429 through so the client can retry with backoff. Other upstream
    // failures still surface as 502 (treat-as-bug).
    const status = res.status === 429 ? 429 : 502;
    return json({ error: `Anthropic error: ${res.status} ${errText}` }, status);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return json({ error: "Model did not return JSON", raw: text }, 502);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return json({ error: "Failed to parse model JSON", raw: text }, 502);
  }

  // Server-side enforcement: floor = 400 × head_count, monotonic ordering, plus_one ↔ head_count consistency.
  const headCountRaw = Number(parsed.head_count ?? (parsed.plus_one ? 2 : 1));
  const headCount = Math.max(1, Math.min(12, Math.round(Number.isFinite(headCountRaw) ? headCountRaw : 1)));
  const floor = 400 * headCount;
  const low = Math.max(floor, Math.round(Number(parsed.gift_low ?? floor)));
  const realistic = Math.max(low, Math.round(Number(parsed.gift_realistic ?? floor + 50)));
  const high = Math.max(realistic, Math.round(Number(parsed.gift_high ?? floor + 200)));
  parsed.head_count = headCount;
  parsed.plus_one = headCount >= 2;
  parsed.gift_low = low;
  parsed.gift_realistic = realistic;
  parsed.gift_high = high;

  return json({ classification: parsed, usage: data?.usage });
}

async function handleChat(
  body: { messages?: Array<{ role: string; content: string }>; weddingState?: unknown },
  apiKey: string,
) {
  const { messages, weddingState } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "Missing or empty 'messages' array" }, 400);
  }

  const stateBlock = weddingState
    ? `\n\nתמונת מצב נוכחית של החתונה (JSON, נכון לעכשיו):\n${JSON.stringify(weddingState, null, 2)}`
    : "";

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: SONNET,
      max_tokens: 1024,
      system: CHAT_SYSTEM + stateBlock,
      messages,
    }),
  });

  if (!res.ok) {
    return json({ error: `Anthropic error: ${res.status} ${await res.text()}` }, 502);
  }

  const data = await res.json();
  const reply: string = data?.content?.[0]?.text ?? "";
  return json({ reply, usage: data?.usage });
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}