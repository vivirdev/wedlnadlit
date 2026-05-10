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
  "category": "family_close" | "family_extended" | "friends_close" | "friends" | "work" | "parents_friends",
  "plus_one": boolean,
  "attendance_prob": number (0.00-1.00),
  "gift_low": integer,
  "gift_realistic": integer,
  "gift_high": integer,
  "confidence": "high" | "medium" | "low",
  "reasoning": string (משפט אחד קצר בעברית למה סיווגת ככה)
}

** סמנטיקת מתנות **:
gift_low / gift_realistic / gift_high הם **סך המעטפה הכוללת** מהאורח/הזוג — לא לראש.
זוג שמגיע = רשומה אחת עם plus_one=true, ומתנה כוללת אחת מוגדלת (לא לכפול ידנית).

חוקים מחייבים:
- בודד (plus_one=false): כל gift_* חייב להיות >= 400.
- זוג (plus_one=true):    כל gift_* חייב להיות >= 800 (רצפה לזוג = 2 × רצפת בודד).
- gift_low <= gift_realistic <= gift_high.

ברירות מחדל לפי קטגוריה — לאדם בודד:
  family_close:    100% הגעה, 900  (טווח 700-1500)
  family_extended:  90% הגעה, 550  (טווח 450-800)
  friends_close:    95% הגעה, 600  (טווח 500-900)
  friends:          85% הגעה, 500  (טווח 400-700)
  work:             65% הגעה, 450  (טווח 400-600)
  parents_friends:  80% הגעה, 600  (טווח 500-900)

ברירות מחדל לזוג (plus_one=true) — סך המעטפה הכוללת, כולן ≥ 800:
  family_close:    1800 (טווח 1400-3000)
  family_extended: 1100 (טווח 900-1500)
  friends_close:   1300 (טווח 1100-1800)   ← חברי נפש/מהצבא/מהילדות יכולים 1500-1800
  friends:         1000 (טווח 900-1300)
  work:             900 (טווח 800-1100)
  parents_friends: 1200 (טווח 1000-1600)

** זיהוי זוגות (plus_one=true) **:
- שני שמות פרטיים מחוברים ב־"ו"/"&"/"+": "יוסי ושרה", "דני & מיכל", "אבי+נועה", "דניאל ונמרוד" → זוג.
  (זה תקף בלי קשר למין השמות — שני שמות ב־"ו" = זוג בברירת מחדל.)
- שם פרטי + סימון מפורש: "ובת זוגו", "ואשתו", "ובעלה", "וחברתו", "וחברו", "+1", "פלוס אחד" → זוג.
- שם משפחה במספר רבים: "משפחת כהן", "הכהנים" → זוג (לפחות).

** מתי זה לא זוג (plus_one=false) **:
- ההערה אומרת במפורש "שני חברים נפרדים", "כל אחד בנפרד", "צוות של 3" → לא זוג. ציין ב־reasoning שכדאי לפצל לרשומות.
- שם בודד אחד בלי "ו": "יוסי", "דנה" → לא זוג.

** כשזוג: השתמש בטבלת ברירות המחדל לזוגות שלמעלה **
(אין חישוב גנרי — ערכי הזוג כבר מוגדרים בטבלה למעלה לפי קטגוריה).

כללי תיוג:
- "דוד/דודה/אח/אחות/סבא/סבתא/בן דוד/בת דודה/הורה" → משפחה.
- "צבא/יחידה/פלוגה/חברים מהילדות/חבר נפש" → חברים קרובים.
- "עבודה/קולגה/בוס/משרד/החברה" → עבודה.
- "חבר של אבא/חברה של אמא/מהשכונה של ההורים" → חברים של ההורים.
- "רחוקים/לא בקשר/אולי לא יגיע/בחו״ל" → הורד הגעה ב־30-50%, confidence=low.
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
      system: CLASSIFY_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    return json({ error: `Anthropic error: ${res.status} ${await res.text()}` }, 502);
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

  // Server-side enforcement: per-person floor 400, couple floor 800, monotonic ordering.
  const isCouple = Boolean(parsed.plus_one);
  const floor = isCouple ? 800 : 400;
  const low = Math.max(floor, Math.round(Number(parsed.gift_low ?? floor)));
  const realistic = Math.max(low, Math.round(Number(parsed.gift_realistic ?? floor + 50)));
  const high = Math.max(realistic, Math.round(Number(parsed.gift_high ?? floor + 200)));
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