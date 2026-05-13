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

const CLASSIFY_SYSTEM = `אתה מסווג אורחים לחתונה ישראלית בשנת 2026 של נדב וליטל.
מקבל: שם + הערה חופשית של המתכנן.
החזר JSON תקני בלבד (ללא markdown, ללא טקסט נוסף) עם השדות הבאים:

{
  "side": "חתן" | "כלה" | "משותף",
  "category": "family_immediate" | "family_close" | "family_extended" | "friends_bff" | "friends_close" | "friends" | "friends_acquaintance" | "work_close" | "work" | "work_boss" | "parents_friends" | "neighbors" | "abroad",
  "head_count": integer (1-12),  // כמה אנשים יושבים מתחת לרשומה הזאת
  "plus_one": boolean,            // legacy: true אם head_count >= 2
  "attendance_prob": number (0.00-1.00),
  "gift_low": integer,
  "gift_realistic": integer,
  "gift_high": integer,
  "confidence": "high" | "medium" | "low",
  "reasoning": string (משפט אחד קצר בעברית למה סיווגת ככה)
}

** ספירת נפשות (head_count) — חוק יסוד **:
רשומה אחת = מעטפה אחת. גם אם יושבים 4 אנשים, זאת רשומה אחת עם head_count=4.
- "יוסי" → 1
- "יוסי ושרה", "דני+מיכל", "אבי ואשתו", "+1", "ובת זוגו" → 2
- "משפחת כהן" (בלי מספר) → 2 (זוג בברירת מחדל)
- "משפחת כהן 4", "משפחת כהן (4 אנשים)", "ההורים + 2 ילדים", "אבא אמא ושני ילדים" → 4
- "ההורים והילדים" בלי מספר ספציפי → 4 (הנחה סבירה: הורים + 2)
- "+3", "פלוס שלושה", "ועוד 3 ילדים" → השם הראשון + 3 = 4
- "צוות של 5 מהעבודה" → 5 (אבל ציין ב־reasoning שכנראה כדאי לפצל)
- ילדים מתחת לגיל 3 לא יושבים — אל תספור אותם.

** סמנטיקת מתנות **:
gift_low / gift_realistic / gift_high הם **סך המעטפה הכוללת** של הרשומה — לא לראש.
משפחה עם head_count=4 = מעטפה אחת מוגדלת, לא 4 מעטפות נפרדות.

חוקים מחייבים:
- כל gift_* חייב להיות >= 400 × head_count (רצפה דינמית: בודד=400, זוג=800, 3=1200, 4=1600...).
- gift_low <= gift_realistic <= gift_high.
- plus_one = (head_count >= 2).

ברירות מחדל לפי קטגוריה — לאדם בודד (head_count=1):
  family_immediate:     100% הגעה, 1500 (טווח 1200-2500)   ← הורים/אחים/ילדים בלבד
  family_close:         100% הגעה, 900  (טווח 700-1500)    ← סבים/דודים
  family_extended:       90% הגעה, 550  (טווח 450-800)     ← בני דודים/רחוקים
  friends_bff:          100% הגעה, 750  (טווח 600-1200)    ← חברי נפש בלבד
  friends_close:         95% הגעה, 600  (טווח 500-900)     ← מהצבא/ילדות/יומיומיים
  friends:               85% הגעה, 500  (טווח 400-700)
  friends_acquaintance:  60% הגעה, 450  (טווח 400-600)     ← מכרים, פחות בקשר
  work_close:            80% הגעה, 550  (טווח 450-800)     ← הצוות הקרוב
  work:                  60% הגעה, 450  (טווח 400-600)
  work_boss:             70% הגעה, 750  (טווח 600-1100)    ← מנהלים/בכירים
  parents_friends:       80% הגעה, 600  (טווח 500-900)
  neighbors:             70% הגעה, 500  (טווח 400-700)
  abroad:                30% הגעה, 500  (טווח 400-800)     ← חיים בחו״ל

ברירות מחדל לזוג (head_count=2) — סך המעטפה, כולן ≥ 800:
  family_immediate:     2800 (טווח 2200-4500)
  family_close:         1800 (טווח 1400-3000)
  family_extended:      1100 (טווח 900-1500)
  friends_bff:          1500 (טווח 1200-2200)
  friends_close:        1300 (טווח 1100-1800)
  friends:              1000 (טווח 900-1300)
  friends_acquaintance:  900 (טווח 800-1100)
  work_close:           1100 (טווח 900-1500)
  work:                  900 (טווח 800-1100)
  work_boss:            1400 (טווח 1200-2000)
  parents_friends:      1200 (טווח 1000-1600)
  neighbors:            1000 (טווח 800-1300)
  abroad:               1000 (טווח 800-1500)

ברירות מחדל למשפחה (head_count>=3):
  הכפל את ערכי הזוג ב־(head_count/2), עגל ל־100 הקרוב, ושמור על רצפה של 400 × head_count.
  דוגמה: family_close עם head_count=4 → 1800 × 2 = 3600 (טווח 2800-6000), רצפה 1600.
  דוגמה: friends עם head_count=4 → 1000 × 2 = 2000 (טווח 1800-2600), רצפה 1600.

כללי תיוג קטגוריה — בחר את הקטגוריה הצרה והמדויקת ביותר:
- "הורה/אבא/אמא/אח/אחות/בן/בת" של החתן או הכלה → family_immediate.
- "סבא/סבתא/דוד/דודה" → family_close.
- "בן דוד/בת דודה/קרוב רחוק" → family_extended.
- "חבר נפש/הכי טוב/הכי קרוב/אחי" → friends_bff.
- "צבא/יחידה/פלוגה/חברים מהילדות/מהבי״ס/חברה טובה" → friends_close.
- "חבר רגיל/מהאוניברסיטה/מהחוג" → friends.
- "מכר/חבר רחוק/לא ממש בקשר/פעם בשנה" → friends_acquaintance.
- "הצוות שלי/הקבוצה הקרובה בעבודה/שותף לפרויקט" → work_close.
- "מהמשרד/קולגה/החברה" → work.
- "המנהל/הבוס/סמנכ״ל/מנכ״ל/בכיר" → work_boss.
- "חבר של אבא/חברה של אמא/מהשכונה של ההורים" → parents_friends.
- "שכן/מהבניין/מהרחוב" → neighbors.
- "מחו״ל/בארה״ב/אירופה/לא בארץ" → abroad.
- "רחוקים/לא בקשר/אולי לא יגיע" בלי הקשר חו״ל → הורד הגעה ב־30-50%, confidence=low.
- אם אין הקשר ברור — confidence=low, השתמש ב־friends כברירת מחדל.

החזר JSON בלבד.`;

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
      // Prompt caching: the system block is constant and large (~3.5K tokens with
      // 13 categories). Marking it ephemeral lets Anthropic serve it from cache at
      // ~10% of the input-token rate for 5 minutes, which is what makes bulk CSV
      // imports survive the 50K tokens/min rate limit.
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