import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Heart, Wallet, ShieldAlert, CalendarHeart, Receipt, CheckCircle2, Circle, Clock, Lock, ArrowUpRight, ArrowDownRight, RefreshCw, MessageCircle, AlarmClock, Home, ListChecks, Settings, X, ChevronDown, Sparkles, Loader2, Search } from 'lucide-react';
import { supabase } from './lib/supabase';

interface Expense {
    id: number;
    name: string;
    amount: number | string;
    advance: number | string;
    paid?: boolean;
    contact_name?: string;
    contact_phone?: string;
    payment_method?: string;
    payment_holder?: string;
    arrival_time?: string;
    payment_ready?: boolean;
    advance_paid_by?: string;
}

interface RunSheetEvent {
    id: string;
    time: string;
    title: string;
    responsible: string;
    notes?: string;
}

const DEFAULT_RUN_SHEET: RunSheetEvent[] = [
    { id: 'rs-1', time: '08:00', title: 'תספורת / גילוח לחתן', responsible: 'חתן', notes: '' },
    { id: 'rs-2', time: '09:30', title: 'איפור ושיער לכלה', responsible: 'כלה', notes: '' },
    { id: 'rs-3', time: '13:00', title: 'סשן צילומים זוגי', responsible: 'צלם', notes: '' },
    { id: 'rs-4', time: '15:00', title: 'הגעה לאולם', responsible: 'שניהם', notes: '' },
    { id: 'rs-5', time: '16:30', title: 'קבלת פנים', responsible: 'אולם', notes: '' },
    { id: 'rs-6', time: '18:00', title: 'חופה', responsible: 'רב', notes: '' },
    { id: 'rs-7', time: '19:00', title: 'ארוחה + ריקודים', responsible: 'דיג\'יי', notes: '' },
    { id: 'rs-8', time: '23:30', title: 'ברכת המזון', responsible: 'רב', notes: '' },
    { id: 'rs-9', time: '00:30', title: 'סיום ופירוק', responsible: '', notes: '' },
];

const PAYMENT_METHODS = ['מזומן', "צ'ק", 'העברה', 'אשראי'] as const;
const PAYMENT_HOLDERS = ['חתן', 'כלה', 'אבא נדב', 'אמא נדב', 'אבא ליטל', 'אמא ליטל', 'אחר'] as const;
const ADVANCE_PAYERS = ['נדב', 'ליטל', 'משותף'] as const;
type AdvancePayer = typeof ADVANCE_PAYERS[number];

interface ChecklistItem {
    id: number;
    text: string;
    done: boolean;
    category: string;
}

type GuestSide = 'חתן' | 'כלה' | 'משותף';
type GuestCategory =
    | 'family_immediate'
    | 'family_close'
    | 'family_extended'
    | 'friends_bff'
    | 'friends_close'
    | 'friends'
    | 'friends_acquaintance'
    | 'work_close'
    | 'work'
    | 'work_boss'
    | 'parents_friends'
    | 'neighbors'
    | 'abroad';
type GuestConfidence = 'high' | 'medium' | 'low';
type GuestRsvp = 'confirmed' | 'doubtful' | 'declined';

interface Guest {
    id: number;
    name: string;
    note?: string | null;
    side?: GuestSide | null;
    category?: GuestCategory | null;
    plus_one: boolean;       // legacy mirror of (head_count >= 2); app keeps it in sync.
    head_count: number;      // 1 = single, 2 = couple, 3+ = family in one envelope.
    attendance_prob: number;
    gift_low: number;
    gift_realistic: number;
    gift_high: number;
    confidence?: GuestConfidence | null;
    ai_classified_at?: string | null;
    manually_edited: boolean;
    rsvp_status?: GuestRsvp | null;
}

const GUEST_CATEGORIES: { id: GuestCategory; label: string; emoji: string; color: string }[] = [
    { id: 'family_immediate',     label: 'משפחה גרעינית',          emoji: '❤️',                  color: 'bg-red-100 text-red-700 border-red-200' },
    { id: 'family_close',         label: 'משפחה קרובה',            emoji: '👨\u200D👩\u200D👧',   color: 'bg-rose-100 text-rose-700 border-rose-200' },
    { id: 'family_extended',      label: 'משפחה מורחבת',           emoji: '🧑\u200D🤝\u200D🧑',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { id: 'friends_bff',          label: 'חברי נפש',               emoji: '💖',                  color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
    { id: 'friends_close',        label: 'חברים קרובים',           emoji: '💞',                  color: 'bg-pink-100 text-pink-700 border-pink-200' },
    { id: 'friends',              label: 'חברים',                  emoji: '🥂',                  color: 'bg-sky-100 text-sky-700 border-sky-200' },
    { id: 'friends_acquaintance', label: 'מכרים',                  emoji: '👋',                  color: 'bg-slate-100 text-slate-600 border-slate-200' },
    { id: 'work_close',           label: 'קולגות קרובים',          emoji: '🤝',                  color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { id: 'work',                 label: 'עבודה',                  emoji: '💼',                  color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    { id: 'work_boss',            label: 'מנהלים / בכירים',        emoji: '🎯',                  color: 'bg-violet-100 text-violet-700 border-violet-200' },
    { id: 'parents_friends',      label: 'חברים של ההורים',        emoji: '🎩',                  color: 'bg-teal-100 text-teal-700 border-teal-200' },
    { id: 'neighbors',            label: 'שכנים',                  emoji: '🏘️',                  color: 'bg-lime-100 text-lime-700 border-lime-200' },
    { id: 'abroad',               label: 'מחו״ל',                  emoji: '✈️',                   color: 'bg-orange-100 text-orange-700 border-orange-200' },
];

const GUEST_SIDES: GuestSide[] = ['חתן', 'כלה', 'משותף'];

// Per-category defaults — applied when user picks a category manually,
// so attendance % and gift range snap to that category's typical values.
// Mirrors the table in the Edge Function's CLASSIFY_SYSTEM prompt.
const CATEGORY_DEFAULTS: Record<GuestCategory, { attendance_prob: number; gift_low: number; gift_realistic: number; gift_high: number }> = {
    family_immediate:     { attendance_prob: 1.00, gift_low: 1200, gift_realistic: 1500, gift_high: 2500 },
    family_close:         { attendance_prob: 1.00, gift_low: 700,  gift_realistic: 900,  gift_high: 1500 },
    family_extended:      { attendance_prob: 0.90, gift_low: 450,  gift_realistic: 550,  gift_high: 800 },
    friends_bff:          { attendance_prob: 1.00, gift_low: 600,  gift_realistic: 750,  gift_high: 1200 },
    friends_close:        { attendance_prob: 0.95, gift_low: 500,  gift_realistic: 600,  gift_high: 900 },
    friends:              { attendance_prob: 0.85, gift_low: 400,  gift_realistic: 500,  gift_high: 700 },
    friends_acquaintance: { attendance_prob: 0.60, gift_low: 400,  gift_realistic: 450,  gift_high: 600 },
    work_close:           { attendance_prob: 0.80, gift_low: 450,  gift_realistic: 550,  gift_high: 800 },
    work:                 { attendance_prob: 0.60, gift_low: 400,  gift_realistic: 450,  gift_high: 600 },
    work_boss:            { attendance_prob: 0.70, gift_low: 600,  gift_realistic: 750,  gift_high: 1100 },
    parents_friends:      { attendance_prob: 0.80, gift_low: 500,  gift_realistic: 600,  gift_high: 900 },
    neighbors:            { attendance_prob: 0.70, gift_low: 400,  gift_realistic: 500,  gift_high: 700 },
    abroad:               { attendance_prob: 0.30, gift_low: 400,  gift_realistic: 500,  gift_high: 800 },
};

// Couple defaults — used when head_count=2 so amounts snap to couple norms (couple floor = 800).
const CATEGORY_DEFAULTS_COUPLE: Record<GuestCategory, { gift_low: number; gift_realistic: number; gift_high: number }> = {
    family_immediate:     { gift_low: 2200, gift_realistic: 2800, gift_high: 4500 },
    family_close:         { gift_low: 1400, gift_realistic: 1800, gift_high: 3000 },
    family_extended:      { gift_low: 900,  gift_realistic: 1100, gift_high: 1500 },
    friends_bff:          { gift_low: 1200, gift_realistic: 1500, gift_high: 2200 },
    friends_close:        { gift_low: 1100, gift_realistic: 1300, gift_high: 1800 },
    friends:              { gift_low: 900,  gift_realistic: 1000, gift_high: 1300 },
    friends_acquaintance: { gift_low: 800,  gift_realistic: 900,  gift_high: 1100 },
    work_close:           { gift_low: 900,  gift_realistic: 1100, gift_high: 1500 },
    work:                 { gift_low: 800,  gift_realistic: 900,  gift_high: 1100 },
    work_boss:            { gift_low: 1200, gift_realistic: 1400, gift_high: 2000 },
    parents_friends:      { gift_low: 1000, gift_realistic: 1200, gift_high: 1600 },
    neighbors:            { gift_low: 800,  gift_realistic: 1000, gift_high: 1300 },
    abroad:               { gift_low: 800,  gift_realistic: 1000, gift_high: 1500 },
};

// Picks gift floor + scaled defaults for any head_count.
// 1 = single, 2 = couple, 3+ = couple values scaled by (heads/2), rounded to 100, with a hard floor of 400*heads.
const giftDefaultsForHeads = (category: GuestCategory, heads: number): { attendance_prob: number; gift_low: number; gift_realistic: number; gift_high: number } => {
    const single = CATEGORY_DEFAULTS[category];
    if (heads <= 1) {
        return { attendance_prob: single.attendance_prob, gift_low: single.gift_low, gift_realistic: single.gift_realistic, gift_high: single.gift_high };
    }
    const couple = CATEGORY_DEFAULTS_COUPLE[category];
    if (heads === 2) {
        return { attendance_prob: single.attendance_prob, gift_low: couple.gift_low, gift_realistic: couple.gift_realistic, gift_high: couple.gift_high };
    }
    const scale = heads / 2;
    const floor = 400 * heads;
    const round100 = (n: number) => Math.max(floor, Math.round(n * scale / 100) * 100);
    return {
        attendance_prob: single.attendance_prob,
        gift_low: round100(couple.gift_low),
        gift_realistic: round100(couple.gift_realistic),
        gift_high: round100(couple.gift_high),
    };
};

interface CpiData {
    baseCpi: number;       // CPI at contract signing (Jan 2026)
    currentCpi: number;    // Latest CPI
    currentMonth: string;  // e.g. "ינואר 2026"
    changePercent: number; // % change
    loading: boolean;
    error: string | null;
}

// Emoji mapping for expense names
const getExpenseEmoji = (name: string): string => {
    const lower = name.toLowerCase();
    const map: [string[], string][] = [
        [['אולם', 'גן', 'אירוע', 'מקום', 'venue'], '🏛️'],
        [['צלם', 'צילום', 'וידאו', 'מגנטים', 'photo', 'video'], '📸'],
        [['dj', 'דיג\'יי', 'מוזיקה', 'תקליטן', 'להקה', 'music'], '🎵'],
        [['שמלה', 'חליפה', 'בגד', 'dress', 'suit', 'לבוש'], '👗'],
        [['פרחים', 'עיצוב', 'סידור', 'flower', 'decor', 'קישוט'], '💐'],
        [['איפור', 'שיער', 'תסרוקת', 'makeup', 'hair', 'סטייל'], '💄'],
        [['הזמנות', 'הזמנה', 'דפוס', 'invitation', 'מיתוג'], '💌'],
        [['רב', 'חופה', 'טקס', 'rabbi', 'ceremony'], '💍'],
        [['הסעות', 'הסעה', 'רכב', 'לימוזינה', 'transport'], '🚐'],
        [['עוגה', 'עוגת', 'קינוח', 'מתוק', 'cake', 'dessert'], '🎂'],
        [['קייטרינג', 'אוכל', 'מנות', 'catering', 'food', 'בר'], '🍽️'],
        [['ריקוד', 'כוריאוגרף', 'dance'], '💃'],
        [['זמר', 'הופעה', 'אמן', 'singer', 'performer'], '🎤'],
        [['טבעות', 'טבעת', 'ring'], '💎'],
        [['ביטוח', 'insurance'], '🛡️'],
        [['מתנות', 'מתנה', 'gift', 'שי'], '🎁'],
        [['נסיעה', 'ירח דבש', 'honeymoon', 'חופשה', 'טיסה'], '✈️'],
        [['מלון', 'לינה', 'hotel'], '🏨'],
    ];
    for (const [keywords, emoji] of map) {
        if (keywords.some(kw => lower.includes(kw))) return emoji;
    }
    return '📋';
};

export default function WeddingSimulator() {
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState('');
    const [configId, setConfigId] = useState<number | null>(null);

    // Check Local Storage for active session on mount
    useEffect(() => {
        const checkAuth = async () => {
            const savedConfigId = localStorage.getItem('weddingConfigId');
            if (savedConfigId) {
                setConfigId(Number(savedConfigId));
                setIsAuthenticated(true);
            }
            setAuthLoading(false);
        };
        checkAuth();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');

        try {
            // Find config with matching password
            const { data, error } = await supabase
                .from('wedding_config')
                .select('id')
                .eq('password_hash', passwordInput)
                .single();

            if (error || !data) {
                // If it doesn't exist, maybe create it? For simplicity, we'll assume they created it manually or we auto-create on first try if no records exist.
                // Let's create a new one if NO configs exist at all (first run).
                const { count } = await supabase.from('wedding_config').select('*', { count: 'exact', head: true });
                if (count === 0) {
                    const { data: newData, error: insertError } = await supabase
                        .from('wedding_config')
                        .insert({ password_hash: passwordInput })
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    setConfigId(newData.id);
                    localStorage.setItem('weddingConfigId', newData.id.toString());
                    setIsAuthenticated(true);
                } else {
                    setAuthError('סיסמה שגויה');
                }
            } else {
                setConfigId(data.id);
                localStorage.setItem('weddingConfigId', data.id.toString());
                setIsAuthenticated(true);
            }
        } catch (err: any) {
            setAuthError(err.message || 'שגיאה בהתחברות');
        } finally {
            setAuthLoading(false);
        }
    };

    // Navigation State
    const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'runsheet' | 'advisor' | 'settings'>('home');
    const [settingsSubTab, setSettingsSubTab] = useState<'guests' | 'vendors' | 'cashflow'>('guests');

    // Wedding Date Setup
    const weddingDate = new Date('2026-06-23');
    const daysLeft = Math.ceil((weddingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    const getCategoryTargetDate = (category: string) => {
        const targetDate = new Date(weddingDate);
        switch (category) {
            case 'שלב ראשון': targetDate.setDate(targetDate.getDate() - 360); break;
            case 'בחירת ספקים': targetDate.setDate(targetDate.getDate() - 270); break;
            case 'בחירת ספקים שלב 2': targetDate.setDate(targetDate.getDate() - 180); break;
            case 'שלושה חודשים לפני החתונה': targetDate.setDate(targetDate.getDate() - 90); break;
            case 'חודש לפני החתונה': targetDate.setDate(targetDate.getDate() - 30); break;
            case 'שבועיים לפני': targetDate.setDate(targetDate.getDate() - 14); break;
            case 'שבוע לפני': targetDate.setDate(targetDate.getDate() - 7); break;
            default: return null;
        }
        return `${targetDate.getDate().toString().padStart(2, '0')}/${(targetDate.getMonth() + 1).toString().padStart(2, '0')}/${targetDate.getFullYear()}`;
    };

    // State for dynamic inputs (now with RSVP logic)
    const [invitedGuests, setInvitedGuests] = useState(300);
    const [noShowPercent, setNoShowPercent] = useState(15);
    const [avgGift, setAvgGift] = useState(400);

    // Venue Advance Payments
    const [venueAdvance1Percent] = useState(15);
    const [venueAdvance2Percent] = useState(35);
    // User stated both advances are based on the 225 guests @ 610 fixed amount
    const venueAdvanceFixedGuests = 225;
    const venueAdvanceFixedRate = 610;

    // CPI Indexation State
    const VENUE_CONTRACT_BASE_CPI = 103.3; // January 2026 — last CPI published before contract signing (24.2.2026)
    const [cpiData, setCpiData] = useState<CpiData>({
        baseCpi: VENUE_CONTRACT_BASE_CPI,
        currentCpi: VENUE_CONTRACT_BASE_CPI,
        currentMonth: 'ינואר 2026',
        changePercent: 0,
        loading: true,
        error: null,
    });

    // Safety Buffer State
    const [useSafetyBuffer, setSafetyBuffer] = useState(true);

    const [nadavMomGift, setNadavMomGift] = useState<number>(40000);

    // Array States
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [newChecklistText, setNewChecklistText] = useState('');
    const [fixedExpenses, setFixedExpenses] = useState<Expense[]>([]);
    const [runSheetEvents, setRunSheetEvents] = useState<RunSheetEvent[]>([]);
    const [guestList, setGuestList] = useState<Guest[]>([]);
    const [newGuestName, setNewGuestName] = useState('');
    const [newGuestNote, setNewGuestNote] = useState('');
    const [classifyingGuest, setClassifyingGuest] = useState(false);
    const [classifyError, setClassifyError] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
    const [importError, setImportError] = useState<string | null>(null);

    // Guest list view controls — search, side/category filters, group collapse, per-row expand.
    const [guestSearch, setGuestSearch] = useState('');
    const [guestSideFilter, setGuestSideFilter] = useState<GuestSide | 'all'>('all');
    const [guestCategoryFilter, setGuestCategoryFilter] = useState<GuestCategory | 'all' | 'unclassified'>('all');
    const [collapsedGuestGroups, setCollapsedGuestGroups] = useState<Set<string>>(new Set());
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [expandedGuestId, setExpandedGuestId] = useState<number | null>(null);

    const toggleGuestGroupCollapsed = (key: string) => {
        setCollapsedGuestGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const [newExpenseName, setNewExpenseName] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseAdvance, setNewExpenseAdvance] = useState('');
    const [expandedExpenseIds, setExpandedExpenseIds] = useState<Set<number>>(new Set());

    const toggleExpenseExpanded = (id: number) => {
        setExpandedExpenseIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const loadData = async (id: number) => {
        try {
            const [configRes, expensesRes, checklistRes, guestsRes] = await Promise.all([
                supabase.from('wedding_config').select('*').eq('id', id).single(),
                supabase.from('expenses').select('*').eq('config_id', id).order('id'),
                supabase.from('checklist').select('*').eq('config_id', id).order('id'),
                supabase.from('guests').select('*').eq('config_id', id).order('id'),
            ]);
            if (configRes.data) {
                setInvitedGuests(configRes.data.invited_guests);
                setNoShowPercent(configRes.data.no_show_percent);
                setAvgGift(configRes.data.avg_gift);
                setSafetyBuffer(configRes.data.use_safety_buffer);
                setNadavMomGift(configRes.data.nadav_mom_gift);
                const remoteEvents = configRes.data.run_sheet_events as RunSheetEvent[] | null;
                if (remoteEvents && remoteEvents.length > 0) {
                    setRunSheetEvents(remoteEvents);
                } else {
                    setRunSheetEvents(DEFAULT_RUN_SHEET);
                    await supabase.from('wedding_config').update({ run_sheet_events: DEFAULT_RUN_SHEET }).eq('id', id);
                }
            }
            if (expensesRes.data) setFixedExpenses(expensesRes.data);
            if (guestsRes.data) setGuestList(guestsRes.data);

            if (checklistRes.data && checklistRes.data.length > 0) {
                setChecklistItems(checklistRes.data);
            } else if (checklistRes.data && checklistRes.data.length === 0) {
                const defaultChecklist = [
                    // שלב ראשון
                    { text: 'הכנת רשימת מוזמנים', category: 'שלב ראשון' },
                    { text: 'בחירת תאריך ואזור מועדפים', category: 'שלב ראשון' },
                    { text: 'קביעת תקציב', category: 'שלב ראשון' },
                    // בחירת ספקים
                    { text: 'בחירת אולם ושריון תאריך', category: 'בחירת ספקים' },
                    { text: 'בחירת קייטרינג', category: 'בחירת ספקים' },
                    { text: 'בחירת צלמים', category: 'בחירת ספקים' },
                    { text: 'בחירת דיג\'יי', category: 'בחירת ספקים' },
                    { text: 'בחירת צלם מגנטים', category: 'בחירת ספקים' },
                    { text: 'סגירת חוזה מול האולם', category: 'בחירת ספקים' },
                    // בחירת ספקים שלב 2
                    { text: 'סגירת איפור ושיער לכלה', category: 'בחירת ספקים שלב 2' },
                    { text: 'סגירת איפור ושיער למלוות', category: 'בחירת ספקים שלב 2' },
                    { text: 'בחירת שמלת כלה', category: 'בחירת ספקים שלב 2' },
                    { text: 'ספק אלכוהול', category: 'בחירת ספקים שלב 2' },
                    { text: 'עיצוב הזמנות והדפסה', category: 'בחירת ספקים שלב 2' },
                    { text: 'עיצוב אולם', category: 'בחירת ספקים שלב 2' },
                    // שלושה חודשים לפני החתונה
                    { text: 'רישום ברבנות', category: 'שלושה חודשים לפני החתונה' },
                    { text: 'בניית הטקס', category: 'שלושה חודשים לפני החתונה' },
                    { text: 'רכישת טבעות נישואים', category: 'שלושה חודשים לפני החתונה' },
                    { text: 'רכישת חליפה ונעליים לחתן', category: 'שלושה חודשים לפני החתונה' },
                    { text: 'רכישת נעליים ואביזרים משלימים לכלה', category: 'שלושה חודשים לפני החתונה' },
                    { text: 'תיאום מפגש טעימות', category: 'שלושה חודשים לפני החתונה' },
                    { text: 'תיאום מפגש עם הדיג\'יי', category: 'שלושה חודשים לפני החתונה' },
                    // חודש לפני החתונה
                    { text: 'שליחת הזמנות', category: 'חודש לפני החתונה' },
                    { text: 'מפגש טעימות', category: 'חודש לפני החתונה' },
                    { text: 'פגישה עם הדיג\'יי', category: 'חודש לפני החתונה' },
                    { text: 'הזמנת כתובה', category: 'חודש לפני החתונה' },
                    { text: 'פגישה עם המעצב/ת של האולם', category: 'חודש לפני החתונה' },
                    // שבועיים לפני
                    { text: 'לשלם לאקו"ם', category: 'שבועיים לפני' },
                    { text: 'בחירת מיקום לצילומים לפני החתונה + לו"ז', category: 'שבועיים לפני' },
                    { text: 'אישורי הגעה', category: 'שבועיים לפני' },
                    { text: 'סידורי הושבה', category: 'שבועיים לפני' },
                    { text: 'מדידות אחרונות לשמלת כלה ואיסוף השמלה', category: 'שבועיים לפני' },
                    { text: 'כתיבת דברים אישיים לחופה', category: 'שבועיים לפני' },
                    // שבוע לפני
                    { text: 'שיחות תיאום עם הספקים', category: 'שבוע לפני' },
                    { text: 'להכין צ\'קים לספקים', category: 'שבוע לפני' },
                    { text: 'מתנות לאורחים?', category: 'שבוע לפני' },
                    { text: 'לקנות גומי לרחבה', category: 'שבוע לפני' },
                    { text: 'צ\'ק ליסט ליום החתונה', category: 'שבוע לפני' },
                    { text: 'אביזרי עיצוב', category: 'שבוע לפני' },
                    { text: 'אביזרים לרחבה', category: 'שבוע לפני' },
                    { text: 'רשימות - מה לא לשכוח', category: 'שבוע לפני' }
                ].map(item => ({ ...item, config_id: id, done: false }));

                const { data: newChecklist } = await supabase.from('checklist').insert(defaultChecklist).select();
                if (newChecklist) {
                    setChecklistItems(newChecklist);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (isAuthenticated && configId) {
            loadData(configId);

            // Subscribe to real-time changes
            const channel = supabase.channel('schema-db-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'wedding_config', filter: `id=eq.${configId}` }, () => loadData(configId))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `config_id=eq.${configId}` }, () => loadData(configId))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist', filter: `config_id=eq.${configId}` }, () => loadData(configId))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'guests', filter: `config_id=eq.${configId}` }, () => loadData(configId))
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [isAuthenticated, configId]);

    // Fetch CPI data from CBS via Supabase Edge Function
    useEffect(() => {
        const fetchCpi = async () => {
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const res = await fetch(`${supabaseUrl}/functions/v1/cpi-proxy`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                const dates = data?.month?.[0]?.date;
                if (!dates || dates.length === 0) throw new Error('No CPI data returned');

                // Latest CPI is the first entry
                const latest = dates[0];
                const currentCpi = latest.currBase.value;
                const currentMonth = `${latest.monthDesc} ${latest.year}`;
                const baseCpi = VENUE_CONTRACT_BASE_CPI;
                const changePercent = ((currentCpi - baseCpi) / baseCpi) * 100;

                setCpiData({
                    baseCpi,
                    currentCpi,
                    currentMonth,
                    changePercent,
                    loading: false,
                    error: null,
                });
            } catch (err: any) {
                setCpiData(prev => ({ ...prev, loading: false, error: err.message || 'שגיאה בטעינת מדד' }));
            }
        };
        fetchCpi();
    }, []);

    // Update remote config helper
    const updateConfig = async (field: string, value: any) => {
        if (!configId) return;
        try {
            await supabase.from('wedding_config').update({ [field]: value }).eq('id', configId);
        } catch (e) { console.error(e); }
    };

    // Derived state for actual guests
    const guests = Math.round(invitedGuests * (1 - (noShowPercent / 100)));

    // Calculations
    const calculations = useMemo(() => {
        // 1. Calculate Venue Cost based on Contract Tiers
        // Minimum 225 guests commitment - even if fewer arrive, we pay for 225
        const minVenueGuests = 225;
        let venueCost = 0;
        let costBreakdown = '';
        const effectiveVenueGuests = Math.max(guests, minVenueGuests);

        if (effectiveVenueGuests < 250) {
            venueCost = effectiveVenueGuests * 610;
            costBreakdown = guests < minVenueGuests
                ? `מינימום התחייבות: ${minVenueGuests} אורחים לפי 610 ₪ למנה (${guests} מגיעים בפועל)`
                : `${effectiveVenueGuests} אורחים לפי 610 ₪ למנה`;
        } else {
            const baseCost = 250 * 586;
            const extraGuests = guests - 250;
            const extraCost = extraGuests * 555;
            venueCost = baseCost + extraCost;
            costBreakdown = `250 ראשונים לפי 586 ₪ (${baseCost.toLocaleString()} ₪) + ${extraGuests} נוספים לפי 555 ₪ (${extraCost.toLocaleString()} ₪)`;
        }

        const venueBaseContractValue = venueAdvanceFixedGuests * venueAdvanceFixedRate;
        const venueAdvance1 = venueBaseContractValue * (venueAdvance1Percent / 100);
        const venueAdvance2 = venueBaseContractValue * (venueAdvance2Percent / 100);
        const venueAdvance = venueAdvance1 + venueAdvance2;

        // CPI Indexation — applies to full contract value (225 × 610 = 137,250)
        // The resulting difference is added/subtracted from the final payment
        const venueRemainder = venueCost - venueAdvance;
        const cpiChangeRatio = (cpiData.currentCpi - cpiData.baseCpi) / cpiData.baseCpi;
        const rawIndexation = venueBaseContractValue * cpiChangeRatio;
        // Cap clause (3.4): if indexation exceeds 1% of total contract, only 50% applies
        const indexationCapped = Math.abs(rawIndexation) > venueBaseContractValue * 0.01
            ? rawIndexation * 0.5
            : rawIndexation;
        const adjustedVenueRemainder = venueRemainder + indexationCapped;
        // CPI-adjusted total venue cost — this is what parents actually pay
        const adjustedVenueCost = venueCost + indexationCapped;

        // 2. Fixed Expenses & Advances
        const baseFixed = fixedExpenses.reduce((sum: number, exp: Expense) => sum + Number(exp.amount), 0);
        const totalFixedAdvances = fixedExpenses.reduce((sum: number, exp: Expense) => sum + Number(exp.advance || 0), 0);

        // Calculate buffer (10% of fixed expenses if enabled)
        const safetyBufferAmount = useSafetyBuffer ? baseFixed * 0.10 : 0;
        const totalFixed = baseFixed + safetyBufferAmount;

        // 3. Total Expenses — couple pays the full venue cost (CPI-adjusted).
        // Parents cap their contribution at the base contract (137,250); any
        // overage from indexation or extra meals falls on the couple.
        const totalExpenses = totalFixed + adjustedVenueCost;
        const venueOverage = Math.max(0, adjustedVenueCost - venueBaseContractValue);

        // 4. Total Parents Gifts — fixed at base contract value
        const litalParentsGift = Math.max(0, venueBaseContractValue - nadavMomGift);
        const totalParentsGift = nadavMomGift + litalParentsGift;
        const parentsFinalPayment = Math.max(0, venueBaseContractValue - venueAdvance);

        // 5. Totals & Balances
        const guestsIncome = guests * avgGift;
        const totalIncome = guestsIncome + totalParentsGift;
        const netBalance = totalIncome - totalExpenses;

        // 5. Cash Flow
        const totalAdvancesPaid = totalFixedAdvances + venueAdvance;
        const remainingToPay = totalExpenses - totalAdvancesPaid;

        // 6. Smart Insights
        const costPerGuest = totalExpenses / Math.max(1, guests);
        const breakEvenAvgGift = Math.max(0, (totalExpenses - totalParentsGift) / Math.max(1, guests));

        // 7. Progress Bar Percentage (Income vs Expenses)
        const incomeProgress = Math.min((totalIncome / Math.max(1, totalExpenses)) * 100, 100);

        // 8. Scenario Comparison
        const scenarios = [
            { label: 'פסימי', avgGift: 300, noShow: 20, color: 'rose' },
            { label: 'ריאלי', avgGift: avgGift, noShow: noShowPercent, color: 'pink' },
            { label: 'אופטימי', avgGift: 500, noShow: 10, color: 'emerald' },
        ].map(s => {
            const sGuests = Math.round(invitedGuests * (1 - s.noShow / 100));
            const sIncome = sGuests * s.avgGift + totalParentsGift;
            const sBalance = sIncome - totalExpenses;
            return { ...s, guests: sGuests, income: sIncome, balance: sBalance };
        });

        // 9. Expense Breakdown by category
        const expenseCategories = [
            { name: 'אולם', amount: adjustedVenueCost, color: '#6366f1' },
            { name: 'צילום', amount: fixedExpenses.filter(e => ['צלמים', 'צלם מגנטים'].some(k => e.name.includes(k))).reduce((s, e) => s + Number(e.amount), 0), color: '#8b5cf6' },
            { name: 'מוזיקה', amount: fixedExpenses.filter(e => ['דיג', 'רקדנים', 'סקסופוניסט', 'כנר'].some(k => e.name.includes(k))).reduce((s, e) => s + Number(e.amount), 0), color: '#ec4899' },
            { name: 'לבוש ויופי', amount: fixedExpenses.filter(e => ['שמלות', 'תכשיטים', 'איפור', 'חתן', 'טבעות', 'נעליים'].some(k => e.name.includes(k))).reduce((s, e) => s + Number(e.amount), 0), color: '#f59e0b' },
            { name: 'עיצוב', amount: fixedExpenses.filter(e => e.name.includes('עיצוב')).reduce((s, e) => s + Number(e.amount), 0), color: '#10b981' },
        ];
        const categorizedTotal = expenseCategories.reduce((s, c) => s + c.amount, 0);
        const otherAmount = baseFixed - categorizedTotal + venueCost > 0 ? baseFixed - (categorizedTotal - venueCost) : 0;
        if (otherAmount > 0) expenseCategories.push({ name: 'אחר', amount: otherAmount, color: '#94a3b8' });

        const remainingFixedPayments = baseFixed - totalFixedAdvances;

        return {
            venueCost, adjustedVenueCost, venueBaseContractValue, venueOverage,
            venueAdvance1, venueAdvance2, venueAdvance,
            venueRemainder, indexationCapped, adjustedVenueRemainder,
            costBreakdown, baseFixed, safetyBufferAmount, totalFixed, totalExpenses,
            guestsIncome, totalParentsGift, litalParentsGift, parentsFinalPayment,
            totalIncome, netBalance,
            totalAdvancesPaid, remainingToPay, costPerGuest, breakEvenAvgGift, incomeProgress,
            scenarios, expenseCategories, totalFixedAdvances, remainingFixedPayments,
        };
    }, [guests, avgGift, fixedExpenses, nadavMomGift, venueAdvance1Percent, venueAdvance2Percent, useSafetyBuffer, invitedGuests, noShowPercent, cpiData]);

    // Aggregated forecast from the per-guest list (replaces flat invitedGuests × avgGift when list is non-empty)
    const guestForecast = useMemo(() => {
        const totalGuests = guestList.length;
        let invitedHeads = 0;
        let expectedHeads = 0;
        let incomeLow = 0;
        let incomeMid = 0;
        let incomeHigh = 0;

        const byCategory = new Map<GuestCategory, { count: number; expected: number; income: number }>();

        for (const g of guestList) {
            const heads = Math.max(1, Number(g.head_count ?? (g.plus_one ? 2 : 1)));
            const prob = Math.max(0, Math.min(1, Number(g.attendance_prob ?? 0)));
            invitedHeads += heads;
            expectedHeads += heads * prob;
            // Gift is the envelope total from this entry (couple = single envelope), not per-head.
            incomeLow  += prob * Number(g.gift_low ?? 0);
            incomeMid  += prob * Number(g.gift_realistic ?? 0);
            incomeHigh += prob * Number(g.gift_high ?? 0);

            if (g.category) {
                const cur = byCategory.get(g.category) ?? { count: 0, expected: 0, income: 0 };
                cur.count += heads;
                cur.expected += heads * prob;
                cur.income += prob * Number(g.gift_realistic ?? 0);
                byCategory.set(g.category, cur);
            }
        }

        const lowConfidenceCount = guestList.filter(g => g.confidence === 'low').length;
        const unclassifiedCount = guestList.filter(g => !g.category).length;

        return {
            totalGuests,
            invitedHeads,
            expectedHeads,
            incomeLow: Math.round(incomeLow),
            incomeMid: Math.round(incomeMid),
            incomeHigh: Math.round(incomeHigh),
            byCategory,
            lowConfidenceCount,
            unclassifiedCount,
        };
    }, [guestList]);

    const formatHeads = (n: number) => String(Math.round(n));

    // Filtered + grouped guest list for the AI advisor view.
    // Order follows GUEST_CATEGORIES, with "ללא קטגוריה" appended when unclassified guests exist.
    type GuestGroupKey = GuestCategory | '_unclassified';
    type GuestGroupStat = { guests: Guest[]; heads: number; expectedHeads: number; expectedIncome: number };
    const groupedGuests = useMemo(() => {
        const q = guestSearch.trim().toLowerCase();
        const filtered = guestList.filter(g => {
            if (q) {
                const hay = `${g.name} ${g.note ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (guestSideFilter !== 'all' && g.side !== guestSideFilter) return false;
            if (guestCategoryFilter === 'unclassified' && g.category) return false;
            if (guestCategoryFilter !== 'all' && guestCategoryFilter !== 'unclassified' && g.category !== guestCategoryFilter) return false;
            return true;
        });
        const groups = new Map<GuestGroupKey, GuestGroupStat>();
        for (const g of filtered) {
            const key: GuestGroupKey = (g.category ?? '_unclassified') as GuestGroupKey;
            const cur = groups.get(key) ?? { guests: [], heads: 0, expectedHeads: 0, expectedIncome: 0 };
            const heads = Math.max(1, Number(g.head_count ?? (g.plus_one ? 2 : 1)));
            const prob = Math.max(0, Math.min(1, Number(g.attendance_prob ?? 0)));
            cur.guests.push(g);
            cur.heads += heads;
            cur.expectedHeads += heads * prob;
            cur.expectedIncome += prob * Number(g.gift_realistic ?? 0);
            groups.set(key, cur);
        }
        const ordered: Array<{ key: GuestGroupKey; label: string; emoji: string; color: string; data: GuestGroupStat }> = [];
        for (const cat of GUEST_CATEGORIES) {
            const data = groups.get(cat.id);
            if (data) ordered.push({ key: cat.id, label: cat.label, emoji: cat.emoji, color: cat.color, data });
        }
        const un = groups.get('_unclassified');
        if (un) ordered.push({ key: '_unclassified', label: 'ללא קטגוריה', emoji: '❓', color: 'bg-slate-100 text-slate-700 border-slate-200', data: un });
        return { ordered, totalFiltered: filtered.length };
    }, [guestList, guestSearch, guestSideFilter, guestCategoryFilter]);

    // Duplicate detection — groups guests by normalized name (lowercased, whitespace collapsed).
    // Any name shared by 2+ guests is flagged so the user can review and delete.
    const duplicateGuestGroups = useMemo(() => {
        const byName = new Map<string, Guest[]>();
        for (const g of guestList) {
            const key = (g.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
            if (!key) continue;
            const arr = byName.get(key) ?? [];
            arr.push(g);
            byName.set(key, arr);
        }
        const groups: Array<{ name: string; guests: Guest[] }> = [];
        for (const [key, arr] of byName) {
            if (arr.length > 1) groups.push({ name: arr[0].name || key, guests: arr });
        }
        groups.sort((a, b) => b.guests.length - a.guests.length);
        const total = groups.reduce((s, g) => s + g.guests.length, 0);
        return { groups, total };
    }, [guestList]);

    // Checklist calculations
    const smartChecklistItems = useMemo(() => {
        const matchedExpenseIds = new Set<number>();

        const mappedItems = checklistItems.map(item => {
            let isDone = item.done;
            let isLate = false;
            let originalExpenseId: number | undefined = undefined;

            // 1. Auto-Done based on expenses
            const nameLower = item.text.toLowerCase();
            const matchedExpense = fixedExpenses.find(exp => {
                const expLower = exp.name.toLowerCase();
                return (
                    (nameLower.includes('אולם') && expLower.includes('אולם')) ||
                    (nameLower.includes('צלמ') && expLower.includes('צלמ')) ||
                    (nameLower.includes('דיג') && expLower.includes('דיג')) ||
                    (nameLower.includes('קייטרינג') && expLower.includes('קייטרינג')) ||
                    (nameLower.includes('מגנטים') && expLower.includes('מגנט')) ||
                    (nameLower.includes('שמל') && expLower.includes('שמל')) ||
                    (nameLower.includes('איפור') && expLower.includes('איפור')) ||
                    (nameLower.includes('שיער') && expLower.includes('שיער')) ||
                    (nameLower.includes('אלכוהול') && expLower.includes('אלכוהול')) ||
                    (nameLower.includes('הזמנות') && expLower.includes('הזמנות')) ||
                    (nameLower.includes('טבעו') && (expLower.includes('טבעו') || expLower.includes('טבעת'))) ||
                    (nameLower.includes('חליפ') && (expLower.includes('חליפ') || expLower.includes('חתן'))) ||
                    (nameLower.includes('עיצוב') && (expLower.includes('עיצוב') || expLower.includes('פרחים'))) ||
                    (nameLower.includes('אקו"ם') && (expLower.includes('אקום') || expLower.includes('אקו"ם'))) ||
                    (nameLower.includes('רב') && (expLower.includes('רב') || expLower.includes('חופה')))
                );
            });

            if (matchedExpense) {
                matchedExpenseIds.add(matchedExpense.id);
                originalExpenseId = matchedExpense.id;
                if (matchedExpense.paid || Number(matchedExpense.advance) > 0) {
                    isDone = true;
                }
            }

            // 2. Late deadline logic
            if (!isDone) {
                const cat = item.category;
                if (cat === 'שלב ראשון' && daysLeft <= 360) isLate = true;
                if (cat === 'בחירת ספקים' && daysLeft <= 270) isLate = true;
                if (cat === 'בחירת ספקים שלב 2' && daysLeft <= 180) isLate = true;
                if (cat === 'שלושה חודשים לפני החתונה' && daysLeft <= 90) isLate = true;
                if (cat === 'חודש לפני החתונה' && daysLeft <= 30) isLate = true;
                if (cat === 'שבועיים לפני' && daysLeft <= 14) isLate = true;
                if (cat === 'שבוע לפני' && daysLeft <= 7) isLate = true;
            }

            return { ...item, isDone, isLate, isVirtual: false, originalExpenseId, isSyncedOutward: !!matchedExpense };
        });

        const virtualItems = fixedExpenses
            .filter(exp => !matchedExpenseIds.has(exp.id))
            .map(exp => ({
                id: -exp.id, // Ensure unique negative ID to prevent index collision manually
                text: `סגירת ספק: ${exp.name}`,
                category: 'ספקים נוספים',
                done: false,
                isDone: exp.paid || Number(exp.advance) > 0,
                isLate: false,
                isVirtual: true,
                originalExpenseId: exp.id,
                isSyncedOutward: true
            }));

        const combined = [...mappedItems, ...virtualItems];
        // Sort items so 'ספקים נוספים' is always at the end
        const order = ['שלב ראשון', 'בחירת ספקים', 'בחירת ספקים שלב 2', 'שלושה חודשים לפני החתונה', 'חודש לפני החתונה', 'שבועיים לפני', 'שבוע לפני', 'ספקים נוספים'];
        return combined.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    }, [checklistItems, fixedExpenses, daysLeft]);

    const checklistDone = smartChecklistItems.filter(i => i.isDone).length;
    const checklistTotal = smartChecklistItems.length;
    const checklistProgress = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;
    const categoryOffsets: Record<string, number> = {
        'שלב ראשון': 360,
        'בחירת ספקים': 270,
        'בחירת ספקים שלב 2': 180,
        'שלושה חודשים לפני החתונה': 90,
        'חודש לפני החתונה': 30,
        'שבועיים לפני': 14,
        'שבוע לפני': 7,
    };
    const checklistCategories = [...new Set(smartChecklistItems.map(i => i.category))]
        .filter(category => {
            const offset = categoryOffsets[category];
            const isPast = offset !== undefined && daysLeft < offset;
            const items = smartChecklistItems.filter(i => i.category === category);
            const allDone = items.length > 0 && items.every(i => i.isDone);
            return !(isPast && allDone);
        });

    // Smart action queue — surfaces what to do *this week* across the app
    type SmartAction = {
        key: string;
        emoji: string;
        title: string;
        reason: string;
        urgency: 'high' | 'medium' | 'low';
        kind: 'checklist' | 'vendor-advance' | 'vendor-final' | 'runsheet';
        checklistId?: number;
        expenseId?: number;
        whatsappPhone?: string;
        whatsappName?: string;
        topic?: string;
    };

    const smartActions = useMemo<SmartAction[]>(() => {
        const actions: SmartAction[] = [];

        // 1. Late checklist items
        smartChecklistItems
            .filter(i => i.isLate && !i.isDone)
            .forEach(item => {
                actions.push({
                    key: `chk-${item.id}`,
                    emoji: getExpenseEmoji(item.text),
                    title: item.text,
                    reason: `${item.category} — באיחור`,
                    urgency: 'high',
                    kind: 'checklist',
                    checklistId: item.id,
                });
            });

        // 2. Vendors with no advance and wedding is < 75 days away
        if (daysLeft <= 90) {
            fixedExpenses
                .filter(e => Number(e.advance) === 0 && !e.paid && Number(e.amount) > 0)
                .forEach(exp => {
                    const phone = exp.contact_phone;
                    actions.push({
                        key: `adv-${exp.id}`,
                        emoji: getExpenseEmoji(exp.name),
                        title: `מקדמה: ${exp.name}`,
                        reason: `${Number(exp.amount).toLocaleString('he-IL')} ₪ — מקדמה לא שולמה (${daysLeft} ימים)`,
                        urgency: daysLeft <= 30 ? 'high' : 'medium',
                        kind: 'vendor-advance',
                        expenseId: exp.id,
                        whatsappPhone: phone,
                        whatsappName: exp.contact_name,
                        topic: `תיאום מקדמה ל${exp.name}`,
                    });
                });
        }

        // 3. Vendors fully unpaid with wedding < 21 days — final payment looming
        if (daysLeft <= 21) {
            fixedExpenses
                .filter(e => !e.paid && Number(e.amount) > Number(e.advance || 0))
                .forEach(exp => {
                    actions.push({
                        key: `final-${exp.id}`,
                        emoji: '💰',
                        title: `תשלום סופי: ${exp.name}`,
                        reason: `יתרה ${(Number(exp.amount) - Number(exp.advance || 0)).toLocaleString('he-IL')} ₪ ליום האירוע`,
                        urgency: 'high',
                        kind: 'vendor-final',
                        expenseId: exp.id,
                        whatsappPhone: exp.contact_phone,
                        whatsappName: exp.contact_name,
                        topic: `תיאום תשלום סופי`,
                    });
                });
        }

        // 4. Run sheet readiness reminder
        if (daysLeft <= 14) {
            const unreadyVendors = fixedExpenses.filter(e => !e.payment_ready && Number(e.amount) > Number(e.advance || 0));
            if (unreadyVendors.length > 0) {
                actions.push({
                    key: 'runsheet-cash',
                    emoji: '✉️',
                    title: `${unreadyVendors.length} מעטפות שלא מוכנות`,
                    reason: 'הכינו מעטפות מזומן/צ\'קים לכל ספק לפי "יום החתונה"',
                    urgency: daysLeft <= 7 ? 'high' : 'medium',
                    kind: 'runsheet',
                });
            }
        }

        const order = { high: 0, medium: 1, low: 2 } as const;
        return actions.sort((a, b) => order[a.urgency] - order[b.urgency]).slice(0, 8);
    }, [smartChecklistItems, fixedExpenses, daysLeft]);

    // Advances breakdown by who paid (Nadav / Lital / shared / unassigned)
    const advancePayerBreakdown = useMemo(() => {
        const totals: Record<AdvancePayer | 'לא משויך', number> = {
            'נדב': 0,
            'ליטל': 0,
            'משותף': 0,
            'לא משויך': 0,
        };
        for (const e of fixedExpenses) {
            const adv = Number(e.advance) || 0;
            if (adv <= 0) continue;
            const payer = (e.advance_paid_by as AdvancePayer | undefined);
            if (payer && (ADVANCE_PAYERS as readonly string[]).includes(payer)) {
                totals[payer] += adv;
            } else {
                totals['לא משויך'] += adv;
            }
        }
        return totals;
    }, [fixedExpenses]);

    // Day-of-event payment summary
    const runSheetSummary = useMemo(() => {
        const vendorsWithFinal = fixedExpenses
            .filter(e => Number(e.amount) > Number(e.advance || 0))
            .map(e => ({
                ...e,
                remainingAmount: Number(e.amount) - Number(e.advance || 0),
            }))
            .sort((a, b) => (a.arrival_time || '99').localeCompare(b.arrival_time || '99'));

        const totalCash = vendorsWithFinal.filter(v => v.payment_method === 'מזומן').reduce((s, v) => s + v.remainingAmount, 0);
        const totalChecks = vendorsWithFinal.filter(v => v.payment_method === "צ'ק").reduce((s, v) => s + v.remainingAmount, 0);
        const totalTransfer = vendorsWithFinal.filter(v => v.payment_method === 'העברה').reduce((s, v) => s + v.remainingAmount, 0);
        const totalRemaining = vendorsWithFinal.reduce((s, v) => s + v.remainingAmount, 0);
        const readyCount = vendorsWithFinal.filter(v => v.payment_ready).length;

        // Add venue final to the picture (parents pay separately)
        const venueFinal = calculations.parentsFinalPayment;

        return {
            vendors: vendorsWithFinal,
            totalCash,
            totalChecks,
            totalTransfer,
            totalRemaining,
            readyCount,
            totalCount: vendorsWithFinal.length,
            venueFinal,
        };
    }, [fixedExpenses, calculations.parentsFinalPayment]);

    const [isMigrating, setIsMigrating] = useState(false);

    const handleMigrateLocalData = async () => {
        if (!configId) return;
        setIsMigrating(true);
        try {
            const localExpensesStr = window.localStorage.getItem('fixedExpenses');
            if (localExpensesStr) {
                const localExpenses = JSON.parse(localExpensesStr);
                // Clear existing remote expenses to prevent duplicates
                await supabase.from('expenses').delete().eq('config_id', configId);

                // Insert local expenses sequentially
                for (const exp of localExpenses) {
                    await supabase.from('expenses').insert({
                        config_id: configId,
                        name: exp.name,
                        amount: Number(exp.amount) || 0,
                        advance: Number(exp.advance) || 0,
                        paid: exp.paid || false
                    });
                }
                window.localStorage.removeItem('fixedExpenses'); // Remove from local so button disappears
                await loadData(configId); // Refresh state
                alert('כל ההוצאות הועברו בהצלחה לענן! ☁️');
            } else {
                alert('לא נמצאו הוצאות שמורות בזיכרון המקומי.');
            }
        } catch (e) {
            console.error(e);
            alert('קרתה שגיאה בהעברה. בדוק קונסול.');
        } finally {
            setIsMigrating(false);
        }
    };

    // Handlers
    const addExpense = async () => {
        if (newExpenseName && newExpenseAmount && configId) {
            const tempId = Date.now();
            setFixedExpenses(prev => [...prev, {
                id: tempId,
                name: newExpenseName,
                amount: Number(newExpenseAmount),
                advance: Number(newExpenseAdvance) || 0,
                paid: false
            }]);
            const payload = {
                config_id: configId,
                name: newExpenseName,
                amount: Number(newExpenseAmount),
                advance: Number(newExpenseAdvance) || 0
            };
            setNewExpenseName('');
            setNewExpenseAmount('');
            setNewExpenseAdvance('');

            await supabase.from('expenses').insert(payload);
            await loadData(configId);
        }
    };

    const removeExpense = async (id: number) => {
        if (!configId) return;
        setFixedExpenses(prev => prev.filter(e => e.id !== id));
        await supabase.from('expenses').delete().eq('id', id);
        await loadData(configId);
    };

    const updateExpense = async (id: number, field: string, value: string | number | boolean) => {
        if (!configId) return;
        const stringFields = ['contact_name', 'contact_phone', 'payment_method', 'payment_holder', 'arrival_time', 'advance_paid_by'];
        const booleanFields = ['payment_ready', 'paid'];
        const val: string | number | boolean =
            stringFields.includes(field) ? String(value) :
            booleanFields.includes(field) ? Boolean(value) :
            Number(value);
        setFixedExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));

        supabase.from('expenses').update({ [field]: val }).eq('id', id).then(() => {
            if (!stringFields.includes(field)) {
                loadData(configId);
            }
        });
    };

    const classifyAndAddGuest = async () => {
        if (!configId || !newGuestName.trim()) return;
        setClassifyingGuest(true);
        setClassifyError(null);
        try {
            const { data, error } = await supabase.functions.invoke('wedding-advisor', {
                body: { action: 'classify', name: newGuestName.trim(), note: newGuestNote.trim() || null },
            });
            if (error) throw error;
            const c = (data as { classification?: Record<string, unknown> })?.classification;
            if (!c) throw new Error('המודל החזיר תשובה ריקה');

            const headCount = Math.max(1, Math.min(12, Math.round(Number(c.head_count ?? (c.plus_one ? 2 : 1)))));
            const floor = 400 * headCount;
            const payload = {
                config_id: configId,
                name: newGuestName.trim(),
                note: newGuestNote.trim() || null,
                side: (c.side as GuestSide) ?? null,
                category: (c.category as GuestCategory) ?? null,
                head_count: headCount,
                plus_one: headCount >= 2,
                attendance_prob: Number(c.attendance_prob ?? 0.85),
                gift_low: Math.max(floor, Number(c.gift_low ?? floor)),
                gift_realistic: Math.max(floor, Number(c.gift_realistic ?? floor + 50)),
                gift_high: Math.max(floor, Number(c.gift_high ?? floor + 200)),
                confidence: (c.confidence as GuestConfidence) ?? 'medium',
                ai_classified_at: new Date().toISOString(),
                manually_edited: false,
            };
            await supabase.from('guests').insert(payload);
            setNewGuestName('');
            setNewGuestNote('');
            await loadData(configId);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setClassifyError(msg);
        } finally {
            setClassifyingGuest(false);
        }
    };

    const addGuestManual = async () => {
        if (!configId || !newGuestName.trim()) return;
        await supabase.from('guests').insert({
            config_id: configId,
            name: newGuestName.trim(),
            note: newGuestNote.trim() || null,
            category: 'friends',
            side: 'משותף',
            head_count: 1,
            plus_one: false,
            attendance_prob: 0.85,
            gift_low: 400,
            gift_realistic: 450,
            gift_high: 600,
            manually_edited: true,
        });
        setNewGuestName('');
        setNewGuestNote('');
        await loadData(configId);
    };

    const updateGuest = async (id: number, patch: Partial<Guest>) => {
        if (!configId) return;
        setGuestList(prev => prev.map(g => g.id === id ? { ...g, ...patch, manually_edited: true } : g));
        await supabase.from('guests').update({ ...patch, manually_edited: true }).eq('id', id);
    };

    const deleteGuest = async (id: number) => {
        if (!configId) return;
        setGuestList(prev => prev.filter(g => g.id !== id));
        await supabase.from('guests').delete().eq('id', id);
    };

    const deleteAllGuests = async () => {
        if (!configId || guestList.length === 0) return;
        if (!confirm(`למחוק את כל ${guestList.length} האורחים? פעולה זו לא ניתנת לביטול.`)) return;
        setGuestList([]);
        await supabase.from('guests').delete().eq('config_id', configId);
    };

    // RSVP toggle. Sets rsvp_status (intent) and snaps attendance_prob to a matching number.
    // null  → restore category default (or 0.85 fallback) so the forecast goes back to "auto".
    const setGuestRsvp = (g: Guest, status: GuestRsvp | null) => {
        let prob: number;
        if (status === 'confirmed') prob = 1.0;
        else if (status === 'doubtful') prob = 0.5;
        else if (status === 'declined') prob = 0.0;
        else prob = g.category ? CATEGORY_DEFAULTS[g.category].attendance_prob : 0.85;
        return updateGuest(g.id, { rsvp_status: status, attendance_prob: prob });
    };

    // Bulk import — accepts free-form text where each line is one guest.
    // Splits on tab/comma so Excel paste, CSV, or "Name, note" all work.
    const parseImportText = (text: string): Array<{ name: string; note: string }> => {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                const parts = line.split(/\t|,/);
                return {
                    name: (parts[0] ?? '').trim(),
                    note: parts.slice(1).join(', ').trim(),
                };
            })
            .filter(row => row.name.length > 0);
    };

    const handleCsvFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = String(e.target?.result ?? '');
            // Strip BOM if present
            setImportText(text.replace(/^\uFEFF/, ''));
        };
        reader.readAsText(file, 'utf-8');
    };

    const importBulkManual = async () => {
        if (!configId) return;
        const rows = parseImportText(importText);
        if (rows.length === 0) {
            setImportError('לא זוהו שורות תקינות. כל שורה צריכה להתחיל בשם.');
            return;
        }
        setImportError(null);
        setImportProgress({ done: 0, total: rows.length });
        const payload = rows.map(r => ({
            config_id: configId,
            name: r.name,
            note: r.note || null,
            category: 'friends' as GuestCategory,
            side: 'משותף' as GuestSide,
            head_count: 1,
            plus_one: false,
            attendance_prob: 0.85,
            gift_low: 400,
            gift_realistic: 450,
            gift_high: 600,
            manually_edited: true,
        }));
        await supabase.from('guests').insert(payload);
        setImportProgress({ done: rows.length, total: rows.length });
        setImportText('');
        setImportOpen(false);
        await loadData(configId);
        setTimeout(() => setImportProgress(null), 1500);
    };

    const importBulkWithAI = async () => {
        if (!configId) return;
        const rows = parseImportText(importText);
        if (rows.length === 0) {
            setImportError('לא זוהו שורות תקינות. כל שורה צריכה להתחיל בשם.');
            return;
        }
        setImportError(null);
        setImportProgress({ done: 0, total: rows.length });

        const BATCH_SIZE = 5;
        let done = 0;
        const failures: string[] = [];

        // Retries on 429 with exponential backoff. The Edge Function passes 429
        // through from Anthropic (other errors surface as 502 and aren't retried).
        const invokeClassify = async (name: string, note: string | null) => {
            const MAX_ATTEMPTS = 4;
            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                const { data, error } = await supabase.functions.invoke('wedding-advisor', {
                    body: { action: 'classify', name, note },
                });
                if (!error) return data;
                const status = (error as { context?: { status?: number } })?.context?.status;
                const msg = (error as { message?: string })?.message ?? String(error);
                const isRateLimit = status === 429 || /\b429\b|rate.?limit/i.test(msg);
                if (!isRateLimit || attempt === MAX_ATTEMPTS - 1) throw error;
                const wait = 1500 * Math.pow(2, attempt) + Math.random() * 500;
                await new Promise(r => setTimeout(r, wait));
            }
            throw new Error('unreachable');
        };

        // First batch is size 1: that single call warms the Anthropic prompt
        // cache, so every subsequent parallel call lands a cache hit and pays
        // ~10% input tokens. Without this, a parallel first batch can fan out
        // before the cache is written and burn full token cost ×5.
        let i = 0;
        while (i < rows.length) {
            const size = i === 0 ? 1 : BATCH_SIZE;
            const batch = rows.slice(i, i + size);
            const results = await Promise.all(batch.map(async (row) => {
                try {
                    const data = await invokeClassify(row.name, row.note || null);
                    const c = (data as { classification?: Record<string, unknown> })?.classification;
                    if (!c) throw new Error('empty classification');
                    const headCount = Math.max(1, Math.min(12, Math.round(Number(c.head_count ?? (c.plus_one ? 2 : 1)))));
                    const floor = 400 * headCount;
                    return {
                        config_id: configId,
                        name: row.name,
                        note: row.note || null,
                        side: (c.side as GuestSide) ?? null,
                        category: (c.category as GuestCategory) ?? null,
                        head_count: headCount,
                        plus_one: headCount >= 2,
                        attendance_prob: Number(c.attendance_prob ?? 0.85),
                        gift_low: Math.max(floor, Number(c.gift_low ?? floor)),
                        gift_realistic: Math.max(floor, Number(c.gift_realistic ?? floor + 50)),
                        gift_high: Math.max(floor, Number(c.gift_high ?? floor + 200)),
                        confidence: (c.confidence as GuestConfidence) ?? 'medium',
                        ai_classified_at: new Date().toISOString(),
                        manually_edited: false,
                    };
                } catch (e) {
                    failures.push(`${row.name}: ${e instanceof Error ? e.message : String(e)}`);
                    return null;
                }
            }));

            const valid = results.filter((r): r is NonNullable<typeof r> => r !== null);
            if (valid.length > 0) {
                await supabase.from('guests').insert(valid);
            }
            done += batch.length;
            i += batch.length;
            setImportProgress({ done, total: rows.length });
        }

        if (failures.length > 0) {
            setImportError(`${failures.length} כשלו: ${failures.slice(0, 3).join(' | ')}${failures.length > 3 ? '...' : ''}`);
        } else {
            setImportText('');
            setImportOpen(false);
        }
        await loadData(configId);
        setTimeout(() => setImportProgress(null), 2500);
    };

    const persistRunSheet = (events: RunSheetEvent[]) => {
        setRunSheetEvents(events);
        if (configId) {
            supabase.from('wedding_config').update({ run_sheet_events: events }).eq('id', configId);
        }
    };

    const updateRunSheetEvent = (id: string, field: keyof RunSheetEvent, value: string) => {
        persistRunSheet(runSheetEvents.map(ev => ev.id === id ? { ...ev, [field]: value } : ev));
    };

    const addRunSheetEvent = () => {
        const newEvent: RunSheetEvent = {
            id: `rs-${Date.now()}`,
            time: '12:00',
            title: 'אירוע חדש',
            responsible: '',
            notes: '',
        };
        persistRunSheet([...runSheetEvents, newEvent]);
    };

    const removeRunSheetEvent = (id: string) => {
        persistRunSheet(runSheetEvents.filter(ev => ev.id !== id));
    };

    const buildWhatsappLink = (phone: string | undefined, message: string) => {
        if (!phone) return null;
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 9) return null;
        const intl = cleaned.startsWith('972')
            ? cleaned
            : cleaned.startsWith('0')
                ? '972' + cleaned.slice(1)
                : '972' + cleaned;
        return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
    };

    const toggleExpensePaid = async (id: number) => {
        if (!configId) return;
        setFixedExpenses(prev => prev.map(e => e.id === id ? { ...e, paid: !e.paid } : e));
        const expense = fixedExpenses.find(e => e.id === id);
        if (expense) {
            await supabase.from('expenses').update({ paid: !expense.paid }).eq('id', id);
            await loadData(configId);
        }
    };

    const addChecklistItem = async () => {
        if (newChecklistText.trim() && configId) {
            const tempId = Date.now();
            setChecklistItems(prev => [...prev, {
                id: tempId,
                text: newChecklistText,
                category: 'כללי',
                done: false
            }]);
            const payload = {
                config_id: configId,
                text: newChecklistText,
                category: 'כללי', // Default category
                done: false
            };
            setNewChecklistText('');
            await supabase.from('checklist').insert(payload);
            await loadData(configId);
        }
    };

    const removeChecklistItem = async (id: number) => {
        if (!configId) return;
        setChecklistItems(prev => prev.filter(i => i.id !== id));
        await supabase.from('checklist').delete().eq('id', id);
        await loadData(configId);
    };

    const toggleChecklistItem = async (id: number) => {
        if (!configId) return;

        const smartItem = smartChecklistItems.find(i => i.id === id);
        if (smartItem?.isVirtual && smartItem.originalExpenseId) {
            // Virtual item: toggle the paid status on the actual expense
            await toggleExpensePaid(smartItem.originalExpenseId);
            return;
        }

        setChecklistItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
        const item = checklistItems.find(i => i.id === id);
        if (item) {
            await supabase.from('checklist').update({ done: !item.done }).eq('id', id);
            // If it's a real item but mapped to an expense we don't auto-update the expense paid state because it might represent "advance paid", not full paid.
            await loadData(configId);
        }
    };

    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#F8F8F8]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4D7F]"></div></div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8F8F8] p-4 font-sans" dir="rtl">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFE5ED] blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#F8F8F8] blur-3xl rounded-full -ml-16 -mb-16 pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-[#FFDEDE] text-[#FF4D7F] rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <Lock size={32} strokeWidth={1.5} />
                        </div>
                        <h1 className="text-2xl font-bold text-[#333333] text-center mb-2 tracking-tight">התחברות לחתונה</h1>
                        <p className="text-slate-500 text-center mb-8 text-sm">הכניסו את הסיסמה המשותפת שלכם כדי לצפות ולערוך מקול מקום</p>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    placeholder="הקלד סיסמה..."
                                    className="w-full px-4 py-3 bg-[#F8F8F8] border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF4D7F] focus:bg-white text-base font-medium text-center text-[#333333] outline-none transition-all"
                                />
                            </div>
                            {authError && <p className="text-rose-500 text-sm font-medium text-center bg-rose-50 py-2 rounded-lg">{authError}</p>}
                            <button
                                type="submit"
                                disabled={authLoading || !passwordInput}
                                className="w-full bg-[#FF4D7F] hover:bg-[#e63e6d] disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-md shadow-pink-200"
                            >
                                {authLoading ? 'מתחבר...' : 'היכנס'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div dir="rtl" className="min-h-screen bg-[#F5F7FA] p-4 md:p-8 font-sans text-[#333333] selection:bg-[#FFDEDE]">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Top Header - Hero Style */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center pt-8 pb-4 text-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFE5ED] border border-[#FFDEDE] text-[#FF4D7F] font-semibold text-sm mb-6 shadow-sm">
                        <CalendarHeart size={16} strokeWidth={1.5} />
                        <span>23 ביוני 2026 • מערבה • עוד {daysLeft} ימים!</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#1F1A1A] tracking-tight leading-tight">
                        חתונה חכמה <br className="md:hidden" />
                        <span className="text-[#FF4D7F]">מהרגע הראשון</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-4 text-lg max-w-xl mx-auto">
                        ניהול פיננסי אוטומטי, יחד עם תיעוד מוזמנים והוצאות ממרכז אחד.
                    </p>
                </motion.div>

                {/* Always-visible summary strip — totals across all tabs */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white grid grid-cols-3 divide-x divide-slate-100 overflow-hidden"
                    dir="rtl"
                >
                    <div className="p-4 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">הוצאות</p>
                        <p className="text-lg md:text-xl font-extrabold text-[#1F1A1A] tracking-tight">{formatMoney(calculations.totalExpenses)}</p>
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">הכנסה מאורחים</p>
                        <p className="text-lg md:text-xl font-extrabold text-[#1F1A1A] tracking-tight">{formatMoney(calculations.guestsIncome)}</p>
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">מאזן צפוי</p>
                        <p className={`text-lg md:text-xl font-extrabold tracking-tight ${calculations.netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {calculations.netBalance >= 0 ? '+' : ''}{formatMoney(calculations.netBalance)}
                        </p>
                    </div>
                </motion.div>

                {/* Main tabs (3) + settings gear */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="sticky top-4 z-50 mb-8 flex justify-center items-center gap-3"
                >
                    <div className="inline-flex flex-wrap justify-center gap-1.5 bg-white/80 backdrop-blur-xl border border-slate-200/70 rounded-full p-1.5 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
                        {([
                            { id: 'home', label: 'בית', Icon: Home },
                            { id: 'tasks', label: 'משימות', Icon: ListChecks },
                            { id: 'advisor', label: 'יועץ AI', Icon: Sparkles },
                            { id: 'runsheet', label: 'יום ה-X', Icon: AlarmClock },
                        ] as const).map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={`flex items-center gap-2 py-2 px-5 rounded-full font-medium text-sm transition-all duration-300 ${activeTab === id ? 'bg-[#FF4D7F] text-white shadow-md shadow-[#FFDEDE]' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                <Icon size={16} strokeWidth={1.7} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setActiveTab(activeTab === 'settings' ? 'home' : 'settings')}
                        className={`p-2.5 rounded-full transition-all duration-300 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border ${activeTab === 'settings' ? 'bg-[#1F1A1A] text-white border-[#1F1A1A]' : 'bg-white/80 backdrop-blur-xl text-slate-600 border-slate-200/70 hover:bg-slate-100'}`}
                        title="הגדרות וכלים"
                    >
                        {activeTab === 'settings' ? <X size={18} strokeWidth={1.7} /> : <Settings size={18} strokeWidth={1.7} />}
                    </button>
                </motion.div>

                {window.localStorage.getItem('fixedExpenses') && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-4 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-3 text-amber-800">
                            <Wallet size={24} strokeWidth={1.5} />
                            <div>
                                <p className="font-semibold">מצאנו הוצאות ששמרת בעבר במכשיר הזה!</p>
                                <p className="text-sm font-medium text-amber-700/80">לחץ אן כדי להעביר אותן למסד הנתונים בענן החדש.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleMigrateLocalData}
                            disabled={isMigrating}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-6 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                        >
                            {isMigrating ? 'מעביר...' : 'העבר לענן'}
                        </button>
                    </motion.div>
                )}

                {/* SETTINGS — header banner + sub-tabs (outside AnimatePresence so they don't re-mount on sub-tab switch) */}
                {activeTab === 'settings' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="md:col-span-2 bg-[#1F1A1A] text-white rounded-3xl p-5 flex items-center gap-3">
                            <div className="bg-white/10 p-2 rounded-xl">
                                <Settings size={18} strokeWidth={1.7} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">הגדרות וכלים</p>
                                <p className="font-bold tracking-tight">חישובי תקציב, ספקים, תרחישים ופילוחים</p>
                            </div>
                            <button onClick={() => setActiveTab('home')} className="mr-auto bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors">חזרה לבית</button>
                        </div>
                        <div className="md:col-span-2 bg-white rounded-2xl p-1.5 shadow-[0_4px_16px_rgb(0,0,0,0.04)] border border-slate-100 flex gap-1" dir="rtl">
                            {([
                                { id: 'guests', label: 'אורחים והכנסות' },
                                { id: 'vendors', label: 'ספקים' },
                                { id: 'cashflow', label: 'תזרים ותקציב' },
                            ] as const).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setSettingsSubTab(tab.id)}
                                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${settingsSubTab === tab.id ? 'bg-[#FF4D7F] text-white shadow-sm' : 'text-slate-500 hover:text-[#1F1A1A] hover:bg-slate-50'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {/* TAB CONTENT: HOME — status snapshot */}
                    {activeTab === 'home' && (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >

                            {/* Countdown hero — single focal point */}
                            <div className="md:col-span-2 bg-gradient-to-br from-[#FF4D7F] to-[#c42f52] rounded-2xl px-5 py-4 text-white shadow-[0_8px_24px_rgba(255,77,127,0.2)] relative overflow-hidden flex items-center justify-between">
                                <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">עד החתונה</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-extrabold tracking-tight">{daysLeft}</p>
                                    <p className="text-xs text-white/90 font-medium">ימים · 23.6.26</p>
                                </div>
                            </div>

                            {/* Advanced KPI grid — vendors closed, paid, income coverage, cost per guest */}
                            {(() => {
                                const vendorsTotal = fixedExpenses.length;
                                const vendorsClosed = fixedExpenses.filter(e => e.paid || Number(e.advance) > 0).length;
                                const vendorsPct = vendorsTotal ? (vendorsClosed / vendorsTotal) * 100 : 0;
                                const paidPct = calculations.totalExpenses ? (calculations.totalAdvancesPaid / calculations.totalExpenses) * 100 : 0;
                                const coverPct = calculations.incomeProgress;
                                return (
                                    <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-white rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ספקים סגורים</p>
                                                <Receipt size={13} className="text-slate-300" strokeWidth={1.7} />
                                            </div>
                                            <p className="text-2xl font-extrabold text-[#1F1A1A] tracking-tight">{vendorsClosed}<span className="text-sm text-slate-400 font-bold">/{vendorsTotal}</span></p>
                                            <div className="mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${vendorsPct}%` }} />
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">שולם בפועל</p>
                                                <Wallet size={13} className="text-slate-300" strokeWidth={1.7} />
                                            </div>
                                            <p className="text-2xl font-extrabold text-[#1F1A1A] tracking-tight">{paidPct.toFixed(0)}%</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{formatMoney(calculations.totalAdvancesPaid)} / {formatMoney(calculations.totalExpenses)}</p>
                                            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#FF4D7F] rounded-full transition-all" style={{ width: `${Math.min(paidPct, 100)}%` }} />
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">כיסוי הכנסות</p>
                                                <ArrowUpRight size={13} className="text-slate-300" strokeWidth={1.7} />
                                            </div>
                                            <p className={`text-2xl font-extrabold tracking-tight ${coverPct >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{coverPct.toFixed(0)}%</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">הכנסות מכסות הוצאות</p>
                                            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${coverPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(coverPct, 100)}%` }} />
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">עלות לאורח</p>
                                                <Users size={13} className="text-slate-300" strokeWidth={1.7} />
                                            </div>
                                            <p className="text-2xl font-extrabold text-[#1F1A1A] tracking-tight">{formatMoney(Math.round(calculations.costPerGuest))}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">לאיזון: {formatMoney(Math.round(calculations.breakEvenAvgGift))}</p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Payer breakdown — who paid advances so far */}
                            {(() => {
                                const nadav = advancePayerBreakdown['נדב'];
                                const lital = advancePayerBreakdown['ליטל'];
                                const shared = advancePayerBreakdown['משותף'];
                                const unassigned = advancePayerBreakdown['לא משויך'];
                                const totalPaid = nadav + lital + shared + unassigned;
                                if (totalPaid === 0) return null;
                                const seg = (v: number) => totalPaid ? (v / totalPaid) * 100 : 0;
                                return (
                                    <div className="md:col-span-2 bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">מי שילם עד עכשיו</p>
                                            <p className="text-xs font-semibold text-slate-500">סה"כ {formatMoney(totalPaid)}</p>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex" dir="ltr">
                                            {nadav > 0 && <div className="h-full bg-sky-500" style={{ width: `${seg(nadav)}%` }} title={`נדב: ${formatMoney(nadav)}`} />}
                                            {lital > 0 && <div className="h-full bg-pink-500" style={{ width: `${seg(lital)}%` }} title={`ליטל: ${formatMoney(lital)}`} />}
                                            {shared > 0 && <div className="h-full bg-violet-500" style={{ width: `${seg(shared)}%` }} title={`משותף: ${formatMoney(shared)}`} />}
                                            {unassigned > 0 && <div className="h-full bg-slate-300" style={{ width: `${seg(unassigned)}%` }} title={`לא משויך: ${formatMoney(unassigned)}`} />}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                                            {nadav > 0 && (
                                                <span className="flex items-center gap-1.5 text-slate-600">
                                                    <span className="w-2 h-2 rounded-full bg-sky-500" />נדב <span className="font-bold text-[#1F1A1A]">{formatMoney(nadav)}</span>
                                                </span>
                                            )}
                                            {lital > 0 && (
                                                <span className="flex items-center gap-1.5 text-slate-600">
                                                    <span className="w-2 h-2 rounded-full bg-pink-500" />ליטל <span className="font-bold text-[#1F1A1A]">{formatMoney(lital)}</span>
                                                </span>
                                            )}
                                            {shared > 0 && (
                                                <span className="flex items-center gap-1.5 text-slate-600">
                                                    <span className="w-2 h-2 rounded-full bg-violet-500" />משותף <span className="font-bold text-[#1F1A1A]">{formatMoney(shared)}</span>
                                                </span>
                                            )}
                                            {unassigned > 0 && (
                                                <span className="flex items-center gap-1.5 text-slate-500">
                                                    <span className="w-2 h-2 rounded-full bg-slate-300" />לא משויך <span className="font-bold text-slate-600">{formatMoney(unassigned)}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Status row — 2 simple cards */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Tasks */}
                                <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                    <p className="text-[11px] font-semibold text-slate-500 mb-2">משימות</p>
                                    <p className="text-2xl font-extrabold text-[#1F1A1A] tracking-tight">{checklistDone}<span className="text-base text-slate-400 font-bold">/{checklistTotal}</span></p>
                                    <p className="text-xs mt-1">
                                        {smartChecklistItems.filter(i => i.isLate && !i.isDone).length > 0
                                            ? <span className="text-rose-600">{smartChecklistItems.filter(i => i.isLate && !i.isDone).length} באיחור</span>
                                            : <span className="text-slate-400">{checklistProgress.toFixed(0)}% הושלמו</span>}
                                    </p>
                                </div>
                                {/* Wedding day readiness */}
                                <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                    <p className="text-[11px] font-semibold text-slate-500 mb-2">מעטפות ליום החתונה</p>
                                    <p className="text-2xl font-extrabold text-[#1F1A1A] tracking-tight">{runSheetSummary.readyCount}<span className="text-base text-slate-400 font-bold">/{runSheetSummary.totalCount}</span></p>
                                    <p className="text-xs text-slate-400 mt-1">מוכנות לחלוקה</p>
                                </div>
                            </div>

                            {/* This week — Smart Actions */}
                            <div className="md:col-span-2 bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-xl font-bold text-[#1F1A1A] tracking-tight">השבוע הקרוב</h2>
                                    <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFE5ED] text-[#FF4D7F]">
                                        {smartActions.length === 0 ? 'הכול תחת שליטה' : `${smartActions.length} פתוחות`}
                                    </div>
                                </div>
                                {smartActions.length === 0 ? (
                                    <div className="bg-white/70 border border-emerald-200 rounded-2xl p-6 text-center">
                                        <div className="text-4xl mb-2">🎉</div>
                                        <p className="font-bold text-emerald-700">אין פעולות דחופות לשבוע הקרוב</p>
                                        <p className="text-sm text-slate-500 mt-1">כל המקדמות בזמן ואין משימות באיחור.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {smartActions.map(action => {
                                            const message = action.whatsappName
                                                ? `היי ${action.whatsappName}, מדברים נדב וליטל מהחתונה ב-23.6.26. רציתי לתאם איתך בנושא ${action.topic}. תודה!`
                                                : `היי, מדברים נדב וליטל מהחתונה ב-23.6.26. רציתי לתאם איתך בנושא ${action.topic || ''}. תודה!`;
                                            const waLink = buildWhatsappLink(action.whatsappPhone, message);
                                            const urgencyClasses = action.urgency === 'high'
                                                ? 'border-rose-200 bg-rose-50/60'
                                                : action.urgency === 'medium'
                                                    ? 'border-amber-200 bg-amber-50/50'
                                                    : 'border-slate-200 bg-white';
                                            return (
                                                <div key={action.key} className={`flex items-center gap-3 p-4 rounded-2xl border ${urgencyClasses} shadow-sm`}>
                                                    <div className="text-2xl flex-shrink-0">{action.emoji}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-[#1F1A1A] text-sm truncate">{action.title}</p>
                                                        <p className="text-xs text-slate-500 truncate">{action.reason}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        {waLink && (
                                                            <a
                                                                href={waLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-xl shadow-sm transition-colors"
                                                                title="WhatsApp"
                                                            >
                                                                <MessageCircle size={16} strokeWidth={2} />
                                                            </a>
                                                        )}
                                                        {action.kind === 'checklist' && action.checklistId !== undefined && (
                                                            <button
                                                                onClick={() => toggleChecklistItem(action.checklistId!)}
                                                                className="bg-[#FF4D7F] hover:bg-[#e63e6d] text-white p-2 rounded-xl shadow-sm transition-colors"
                                                                title="סמן כבוצע"
                                                            >
                                                                <CheckCircle2 size={16} strokeWidth={2} />
                                                            </button>
                                                        )}
                                                        {(action.kind === 'vendor-advance' || action.kind === 'vendor-final') && action.expenseId !== undefined && (
                                                            <button
                                                                onClick={() => setActiveTab('settings')}
                                                                className="bg-slate-700 hover:bg-slate-800 text-white p-2 rounded-xl shadow-sm transition-colors"
                                                                title="לערוך"
                                                            >
                                                                <Receipt size={16} strokeWidth={2} />
                                                            </button>
                                                        )}
                                                        {action.kind === 'runsheet' && (
                                                            <button
                                                                onClick={() => setActiveTab('runsheet')}
                                                                className="bg-slate-700 hover:bg-slate-800 text-white p-2 rounded-xl shadow-sm transition-colors"
                                                                title="פתח יום החתונה"
                                                            >
                                                                <AlarmClock size={16} strokeWidth={2} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </motion.div>
                    )}

                    {/* SETTINGS: VENUE & CPI */}
                    {activeTab === 'settings' && settingsSubTab === 'cashflow' && (
                        <motion.div
                            key="budget-venue"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="max-w-2xl mx-auto"
                        >
                            {/* CPI Indexation Card */}
                            <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">הצמדה למדד</p>
                                        <h2 className="text-xl font-bold text-[#1F1A1A] tracking-tight">מדד המחירים לצרכן</h2>
                                    </div>
                                    {cpiData.loading ? (
                                        <RefreshCw size={14} className="text-slate-400 animate-spin mt-2" />
                                    ) : !cpiData.error && (
                                        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">{cpiData.currentMonth}</span>
                                    )}
                                </div>

                                {cpiData.loading ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-6 rounded-2xl">
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>טוען נתוני מדד...</span>
                                    </div>
                                ) : cpiData.error ? (
                                    <p className="text-sm text-rose-500 font-medium bg-rose-50 p-4 rounded-2xl">שגיאה: {cpiData.error}</p>
                                ) : (
                                    <>
                                        {/* Hero: big change % */}
                                        <div className={`rounded-[1.5rem] p-6 mb-3 border ${
                                            cpiData.changePercent > 0 ? 'bg-gradient-to-br from-rose-50 to-rose-100/40 border-rose-100' :
                                            cpiData.changePercent < 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 border-emerald-100' :
                                            'bg-slate-50 border-slate-100'
                                        }`}>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">שינוי מאז חתימת החוזה</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className={`text-5xl font-extrabold tracking-tight ${
                                                    cpiData.changePercent > 0 ? 'text-rose-700' :
                                                    cpiData.changePercent < 0 ? 'text-emerald-700' : 'text-slate-700'
                                                }`}>
                                                    {cpiData.changePercent > 0 ? '+' : ''}{cpiData.changePercent.toFixed(2)}%
                                                </span>
                                                {cpiData.changePercent > 0 ? (
                                                    <ArrowUpRight size={26} className="text-rose-500" strokeWidth={2.5} />
                                                ) : cpiData.changePercent < 0 ? (
                                                    <ArrowDownRight size={26} className="text-emerald-500" strokeWidth={2.5} />
                                                ) : null}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2 font-medium">
                                                {cpiData.baseCpi.toFixed(1)} <span className="text-slate-300 mx-1">·</span> ינואר 2026
                                                <span className="text-slate-300 mx-2">→</span>
                                                {cpiData.currentCpi.toFixed(1)} <span className="text-slate-300 mx-1">·</span> {cpiData.currentMonth}
                                            </p>
                                        </div>

                                        {/* Indexation amount (only if non-zero) */}
                                        {calculations.indexationCapped !== 0 && (
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-slate-600 font-medium">
                                                        סכום הצמדה {Math.abs(cpiData.changePercent) > 1 && <span className="text-[10px] text-slate-400">(מופחת 50%)</span>}
                                                    </span>
                                                    <span className={`font-bold text-base ${calculations.indexationCapped > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {calculations.indexationCapped > 0 ? '+' : ''}{formatMoney(Math.round(calculations.indexationCapped))}
                                                    </span>
                                                </div>
                                                {Math.abs(cpiData.changePercent) > 1 && (
                                                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">לפי סעיף 3.4 בהסכם — הפרשים מעל 1% מופחתים ב־50%</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Final payment hero */}
                                        <div className="bg-gradient-to-br from-[#FF4D7F] to-[#c42f52] text-white rounded-[1.5rem] p-5 shadow-[0_12px_30px_rgba(255,77,127,0.25)]">
                                            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">תשלום אחרון + הצמדה</p>
                                            <p className="text-3xl font-extrabold tracking-tight">{formatMoney(Math.round(calculations.adjustedVenueRemainder))}</p>
                                        </div>
                                    </>
                                )}
                            </div>

                        </motion.div>
                    )}

                    {/* SETTINGS: INCOME & GUESTS */}
                    {activeTab === 'settings' && settingsSubTab === 'guests' && (
                        <motion.div
                            key="income"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >

                            {/* Scenarios Section - RSVP LOGIC */}
                            <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white shadow-sm relative overflow-hidden group">
                                <h2 className="text-xl font-bold mb-8 flex items-center gap-3 text-[#1F1A1A] tracking-tight">
                                    <div className="bg-[#FFE5ED] border border-[#FFDEDE] text-[#FF4D7F] p-2.5 rounded-2xl shadow-sm">
                                        <Users size={24} strokeWidth={1.5} />
                                    </div>
                                    מחשבון מוזמנים והכנסות
                                </h2>

                                <div className="space-y-10">
                                    {/* Invited Slider */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="font-medium text-slate-700">כמה אנשים הוזמנו בסך הכל?</label>
                                            <input
                                                type="number"
                                                value={invitedGuests}
                                                onChange={(e) => setInvitedGuests(Number(e.target.value))}
                                                onBlur={(e) => updateConfig('invited_guests', Number(e.target.value))}
                                                className="w-24 px-3 py-2 text-xl font-semibold text-[#333333] bg-[#F8F8F8] border border-slate-200 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-[#FF4D7F] shadow-sm"
                                            />
                                        </div>
                                        <input
                                            type="range" min="150" max="800" step="1"
                                            value={invitedGuests}
                                            onChange={(e) => setInvitedGuests(Number(e.target.value))}
                                            onMouseUp={(e) => updateConfig('invited_guests', Number((e.target as HTMLInputElement).value))}
                                            className="w-full h-2.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#FF4D7F] shadow-inner"
                                        />
                                    </div>

                                    {/* No-Show Slider */}
                                    <div className="bg-[#F8F8F8] p-6 rounded-3xl border border-slate-100 relative group">
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="font-semibold text-slate-700">אחוז אי-הגעה משוער (פחת)</label>
                                            <div className="flex items-center gap-1 bg-white px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                                <span className="text-xl font-bold text-[#333333]">{noShowPercent}%</span>
                                            </div>
                                        </div>
                                        <input
                                            type="range" min="0" max="40" step="1"
                                            value={noShowPercent}
                                            onChange={(e) => setNoShowPercent(Number(e.target.value))}
                                            onMouseUp={(e) => updateConfig('no_show_percent', Number((e.target as HTMLInputElement).value))}
                                            className="w-full h-2.5 bg-rose-200 rounded-full appearance-none cursor-pointer accent-rose-500 shadow-inner"
                                        />
                                        <p className="text-sm font-medium text-rose-500/80 mt-4 text-center bg-white/40 py-2 rounded-lg">הסטנדרט בארץ לרוב עומד על 15% - 20%</p>
                                    </div>

                                    {/* Actual Guests Result */}
                                    <div className="flex justify-between items-center bg-[#FF4D7F] p-6 rounded-3xl shadow-[0_10px_20px_rgba(79,70,229,0.15)] text-white relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[40px] rounded-full"></div>
                                        <span className="font-medium text-[#FFE5ED] text-lg relative z-10">צפי מגיעים בפועל:</span>
                                        <span className="text-4xl font-semibold tracking-tighter relative z-10 group-hover:scale-105 transition-transform origin-left">{guests} <span className="text-xl font-medium opacity-80 tracking-normal">אורחים</span></span>
                                    </div>

                                    {/* Avg Gift Slider */}
                                    <div className="pt-8 border-t border-slate-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="font-medium text-slate-700">ממוצע מתנה לאורח (₪)</label>
                                            <input
                                                type="number"
                                                value={avgGift}
                                                onChange={(e) => setAvgGift(Number(e.target.value))}
                                                onBlur={(e) => updateConfig('avg_gift', Number(e.target.value))}
                                                className="w-24 px-3 py-2 text-xl font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                                            />
                                        </div>
                                        <input
                                            type="range" min="250" max="1000" step="10"
                                            value={avgGift}
                                            onChange={(e) => setAvgGift(Number(e.target.value))}
                                            onMouseUp={(e) => updateConfig('avg_gift', Number((e.target as HTMLInputElement).value))}
                                            className="w-full h-2.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500 shadow-inner"
                                        />
                                        <div className="flex justify-between text-xs font-medium text-slate-400 mt-3 px-1">
                                            <span>250₪ (פסימי)</span>
                                            <span>1000₪ (מוגזם)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Parents Section */}
                            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col justify-between group">
                                <div>
                                    <h2 className="text-xl font-bold text-[#1F1A1A] mb-8 flex items-center gap-3 tracking-tight">
                                        <div className="bg-[#FFE5ED] p-2.5 rounded-2xl text-[#FF4D7F] border border-[#FFDEDE]">
                                            <Heart size={24} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                        עזרה מההורים
                                    </h2>
                                    <div className="space-y-4">
                                        {/* Nadav's Mom Input */}
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-5 bg-[#F8F8F8] rounded-2xl border border-slate-100/50 shadow-sm gap-4 transition-colors">
                                            <span className="font-semibold text-slate-700 text-lg">אמא של נדב</span>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    value={nadavMomGift}
                                                    onChange={(e) => setNadavMomGift(Number(e.target.value))}
                                                    className="w-32 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF4D7F] text-xl font-bold text-center shadow-sm"
                                                />
                                                <span className="text-slate-400 font-semibold text-xl">₪</span>
                                            </div>
                                        </div>

                                        {/* Lital's Parents Overview (Dynamic) */}
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-5 bg-[#FFE5ED]/30 rounded-2xl border border-[#FFDEDE]/50 shadow-sm gap-4 transition-colors relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-1.5 h-full bg-pink-400"></div>
                                            <div>
                                                <span className="font-semibold text-slate-700 text-lg">ההורים של ליטל</span>
                                                <p className="text-xs text-[#FF4D7F] font-medium tracking-wide mt-1">משלימים את בסיס החוזה (137,250 ₪) — תוספות עליכם</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-xl border border-[#FFDEDE] shadow-sm">
                                                <span className="w-auto min-w-[4rem] text-xl font-bold text-center text-[#333333]">{calculations.litalParentsGift.toLocaleString()}</span>
                                                <span className="text-[#FF4D7F] font-semibold text-xl">₪</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 bg-[#FF4D7F] rounded-2xl p-6 text-white shadow-md relative overflow-hidden group-hover:shadow-lg transition-shadow">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[30px] rounded-full"></div>
                                    <div className="flex justify-between items-center relative z-10">
                                        <span className="font-medium text-[#FFE5ED] text-lg">סה"כ סיוע הורים:</span>
                                        <span className="text-3xl font-bold tracking-tighter">{formatMoney(calculations.totalParentsGift)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Venue cost per guest count + meal price — full width */}
                            <div className="md:col-span-2 bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600 border border-indigo-100">
                                        <Receipt size={24} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">עלות האולם לפי החוזה</p>
                                        <h2 className="text-xl font-bold text-[#1F1A1A] tracking-tight">חישוב לפי כמות מנות בפועל</h2>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Per-guest breakdown */}
                                    <div className="bg-[#F8F8F8] rounded-2xl border border-slate-100 p-5 md:col-span-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">פירוט מנות</p>
                                        {guests < 250 ? (
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">{Math.max(guests, 225)} מנות × 610 ₪</span>
                                                    <span className="font-bold text-[#1F1A1A]">{formatMoney(Math.max(guests, 225) * 610)}</span>
                                                </div>
                                                {guests < 225 && (
                                                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                                                        ⚠️ מינימום החוזה: 225 מנות. {guests} מגיעים בפועל — נשלם על {225 - guests} מנות שלא יאכלו.
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">250 מנות ראשונות × 586 ₪</span>
                                                    <span className="font-bold text-[#1F1A1A]">{formatMoney(250 * 586)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">{guests - 250} מנות נוספות × 555 ₪</span>
                                                    <span className="font-bold text-[#1F1A1A]">{formatMoney((guests - 250) * 555)}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="border-t border-slate-200 mt-3 pt-3 space-y-1.5 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">סה"כ לפי המנות:</span>
                                                <span className="font-semibold text-slate-700">{formatMoney(calculations.venueCost)}</span>
                                            </div>
                                            {Math.abs(calculations.indexationCapped) > 1 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500">הצמדה למדד:</span>
                                                    <span className={`font-semibold ${calculations.indexationCapped > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {calculations.indexationCapped > 0 ? '+' : ''}{formatMoney(Math.round(calculations.indexationCapped))}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                                <span className="font-bold text-slate-700">עלות בפועל:</span>
                                                <span className="text-xl font-extrabold text-indigo-600">{formatMoney(Math.round(calculations.adjustedVenueCost))}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Coverage breakdown */}
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3">איך זה מתחלק</p>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">בסיס החוזה (225 × 610):</span>
                                                    <span className="font-bold text-emerald-700">{formatMoney(calculations.venueBaseContractValue)}</span>
                                                </div>
                                                {calculations.adjustedVenueCost > calculations.venueBaseContractValue && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-600">תוספת מעל הבסיס:</span>
                                                        <span className="font-bold text-rose-600">+{formatMoney(Math.round(calculations.adjustedVenueCost - calculations.venueBaseContractValue))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-emerald-200">
                                            <p className="text-[11px] text-emerald-700 leading-relaxed">
                                                ✅ ההורים מכסים את הבסיס (137,250 ₪).<br />
                                                {calculations.venueOverage > 0
                                                    ? <>💸 כל מה שמעבר ({formatMoney(Math.round(calculations.venueOverage))}) — עליכם.</>
                                                    : <>אין תוספת מעל הבסיס.</>}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {/* SETTINGS: EXPENSES (vendors CRUD) */}
                    {activeTab === 'settings' && settingsSubTab === 'vendors' && (
                        <motion.div
                            key="expenses"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white"
                        >

                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6 border-b border-slate-100 pb-6">
                                <h2 className="text-2xl font-semibold flex items-center gap-3 text-[#1F1A1A] tracking-tight">
                                    <div className="bg-[#FFDEDE] text-[#FF4D7F] p-2.5 rounded-2xl">
                                        <Receipt size={24} strokeWidth={1.5} />
                                    </div>
                                    יומן הוצאות ומקדמות
                                </h2>

                                {/* Safety Buffer Toggle */}
                                <div className="flex items-center gap-3 bg-slate-100/80 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-slate-200 shadow-sm">
                                    <ShieldAlert size={20} className="text-slate-600" strokeWidth={1.5} />
                                    <span className="text-sm font-semibold text-[#333333]">מקדם בלת"מים (+10%)</span>
                                    <button
                                        onClick={() => {
                                            const newVal = !useSafetyBuffer;
                                            setSafetyBuffer(newVal);
                                            updateConfig('use_safety_buffer', newVal);
                                        }}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${useSafetyBuffer ? 'bg-[#FF4D7F] shadow-inner' : 'bg-slate-300 shadow-inner'}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${useSafetyBuffer ? '-translate-x-1.5' : '-translate-x-[26px]'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto pb-6">
                                <div className="min-w-[700px]">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-4 px-5 py-3.5 bg-slate-100/80 rounded-2xl text-sm font-medium text-slate-500 uppercase tracking-widest mb-4">
                                        <div className="col-span-5">סעיף הוצאה / ספק</div>
                                        <div className="col-span-3 text-left">עלות סופית משוערת</div>
                                        <div className="col-span-3 text-left">שולם במעמד חתימה</div>
                                        <div className="col-span-1"></div>
                                    </div>

                                    {/* Expenses List */}
                                    <div className="space-y-3 mb-10">
                                        <AnimatePresence>
                                            {[...fixedExpenses].sort((a, b) => (a.paid === b.paid ? 0 : a.paid ? 1 : -1)).map((expense) => (
                                                <motion.div
                                                    key={expense.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                                                    transition={{ duration: 0.2 }}
                                                    className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-3 ${expense.paid
                                                        ? 'bg-[#F8F8F8] border-slate-200 shadow-sm'
                                                        : 'bg-white border-slate-100 hover:border-[#FFDEDE] hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)]'
                                                        }`}
                                                >
                                                    <div className="grid grid-cols-12 gap-4 items-center">
                                                        <div className="col-span-5 flex items-center gap-3">
                                                            <button
                                                                onClick={() => toggleExpensePaid(expense.id)}
                                                                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${expense.paid
                                                                    ? 'bg-[#FF4D7F] border-[#FF4D7F] text-white'
                                                                    : 'bg-white border-slate-300 text-transparent hover:border-[#FF4D7F]'
                                                                    }`}
                                                            >
                                                                <CheckCircle2 size={14} className={expense.paid ? 'opacity-100' : 'opacity-0'} strokeWidth={1.5} />
                                                            </button>
                                                            <span className={`font-medium text-base truncate pr-2 flex-1 flex items-center gap-2 ${expense.paid ? 'text-slate-500 line-through opacity-70' : 'text-[#333333]'}`} title={expense.name}>
                                                                <span className="text-lg flex-shrink-0">{getExpenseEmoji(expense.name)}</span>
                                                                {expense.name}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-3">
                                                            <div className="relative group">
                                                                <input
                                                                    type="number"
                                                                    value={expense.amount}
                                                                    onChange={(e) => updateExpense(expense.id, 'amount', e.target.value)}
                                                                    className={`w-full pl-8 pr-4 py-2.5 bg-[#F8F8F8] border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF4D7F] focus:bg-white text-base font-semibold text-left outline-none transition-all shadow-inner group-hover:border-[#FFDEDE] ${expense.paid ? 'opacity-70 pointer-events-none' : ''
                                                                        }`}
                                                                    readOnly={expense.paid}
                                                                />
                                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₪</span>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-3">
                                                            <div className="relative group">
                                                                <input
                                                                    type="number"
                                                                    value={expense.advance}
                                                                    onChange={(e) => updateExpense(expense.id, 'advance', e.target.value)}
                                                                    className={`w-full pl-8 pr-4 py-2.5 bg-[#FFE5ED] border border-[#FFDEDE] rounded-xl focus:ring-2 focus:ring-[#FF4D7F] focus:bg-[#FFE5ED]/50 text-base font-semibold text-left text-[#333333] outline-none transition-all shadow-inner group-hover:border-[#FFDEDE] ${expense.paid ? 'opacity-70 pointer-events-none' : ''
                                                                        }`}
                                                                    readOnly={expense.paid}
                                                                />
                                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FF4D7F] font-semibold text-sm">₪</span>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-1 flex justify-end items-center gap-0.5">
                                                            <button
                                                                onClick={() => toggleExpenseExpanded(expense.id)}
                                                                title="פרטים נוספים"
                                                                className={`p-2 rounded-xl transition-colors ${expandedExpenseIds.has(expense.id) ? 'text-[#FF4D7F] bg-[#FFE5ED]' : 'text-slate-400 hover:text-[#FF4D7F] hover:bg-slate-50'}`}
                                                            >
                                                                <ChevronDown size={18} strokeWidth={1.5} className={`transition-transform ${expandedExpenseIds.has(expense.id) ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            <button onClick={() => removeExpense(expense.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                                                                <Trash2 size={18} strokeWidth={1.5} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Payer picker — always visible, big tap targets */}
                                                    <div className="flex items-center gap-2 flex-wrap pt-1">
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">שילם:</span>
                                                        {([
                                                            { id: 'נדב', emoji: '👨', activeBg: 'bg-sky-500', activeBorder: 'border-sky-500' },
                                                            { id: 'ליטל', emoji: '👰', activeBg: 'bg-pink-500', activeBorder: 'border-pink-500' },
                                                            { id: 'משותף', emoji: '🤝', activeBg: 'bg-violet-500', activeBorder: 'border-violet-500' },
                                                        ] as const).map(p => {
                                                            const isActive = expense.advance_paid_by === p.id;
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => updateExpense(expense.id, 'advance_paid_by', isActive ? '' : p.id)}
                                                                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all flex items-center gap-1.5 ${isActive ? `${p.activeBg} ${p.activeBorder} text-white shadow-sm` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                                                >
                                                                    <span>{p.emoji}</span>{p.id}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    <AnimatePresence>
                                                        {expandedExpenseIds.has(expense.id) && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="pt-3 border-t border-slate-100 overflow-hidden bg-[#F8F8F8] rounded-b-xl -mx-3.5 -mb-3.5 px-4 pb-4 mt-2 flex flex-col gap-3"
                                                            >
                                                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                                                    <div className="flex-1 w-full flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-[#FF4D7F] focus-within:border-[#FF4D7F] transition-all">
                                                                        <span className="bg-slate-100/50 text-slate-700 text-xs font-semibold px-3 py-2.5 border-l border-slate-100 whitespace-nowrap">איש קשר:</span>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="הכנס שם ספק/איש קשר"
                                                                            value={expense.contact_name || ''}
                                                                            onChange={(e) => updateExpense(expense.id, 'contact_name', e.target.value)}
                                                                            className="w-full px-3 py-2.5 bg-transparent text-sm font-medium outline-none text-[#333333] placeholder-slate-400/70"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 w-full flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-[#FF4D7F] focus-within:border-[#FF4D7F] transition-all">
                                                                        <span className="bg-slate-100/50 text-slate-700 text-xs font-semibold px-3 py-2.5 border-l border-slate-100 whitespace-nowrap">טלפון:</span>
                                                                        <input
                                                                            type="tel"
                                                                            placeholder="05X-XXXXXXX"
                                                                            value={expense.contact_phone || ''}
                                                                            onChange={(e) => updateExpense(expense.id, 'contact_phone', e.target.value)}
                                                                            className="w-full px-3 py-2.5 bg-transparent text-sm font-medium outline-none text-[#333333] placeholder-slate-400/70"
                                                                            dir="ltr"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>

                                    {/* Add new expense */}
                                    <div className="bg-[#FFE5ED]/50 p-6 rounded-3xl border border-[#FFDEDE] relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-1.5 h-full bg-[#FF4D7F] rounded-r-3xl"></div>
                                        <p className="text-sm font-medium text-[#333333] mb-4 flex items-center gap-2 uppercase tracking-wide">
                                            הוספת ספק / הוצאה חדשה
                                        </p>
                                        <div className="grid grid-cols-12 gap-4">
                                            <div className="col-span-5">
                                                <input type="text" placeholder="שם הספק (למשל: עיצוב פרחים)" value={newExpenseName} onChange={(e) => setNewExpenseName(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#FF4D7F] shadow-sm" />
                                            </div>
                                            <div className="col-span-3">
                                                <div className="relative">
                                                    <input type="number" placeholder="עלות כוללת" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#FF4D7F] text-left shadow-sm" />
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₪</span>
                                                </div>
                                            </div>
                                            <div className="col-span-3">
                                                <div className="relative">
                                                    <input type="number" placeholder="מקדמה עכשיו" value={newExpenseAdvance} onChange={(e) => setNewExpenseAdvance(e.target.value)} className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#FF4D7F] text-left shadow-sm" />
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₪</span>
                                                </div>
                                            </div>
                                            <div className="col-span-1">
                                                <button onClick={addExpense} className="w-full h-full bg-[#FF4D7F] hover:bg-[#e63e6d] active:scale-95 text-white rounded-xl flex items-center justify-center transition-all shadow-md">
                                                    <Plus size={24} strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Total Block breakdown inside Expenses Tab */}
                            <div className="mt-8 bg-[#F8F8F8]/80 backdrop-blur-md rounded-3xl p-8 border border-slate-100 max-w-lg mr-auto shadow-sm">
                                <h3 className="font-semibold text-[#1F1A1A] mb-5 flex items-center gap-2 text-xl tracking-tight">
                                    סיכום ספקים והוצאות נלוות
                                </h3>

                                <div className="space-y-4 text-base">
                                    <div className="flex justify-between items-center text-slate-600 font-medium pb-3 border-b border-slate-100">
                                        <span>בסיס הוצאות (ללא אולם):</span>
                                        <span className="font-semibold text-[#333333] text-lg">{formatMoney(calculations.baseFixed)}</span>
                                    </div>

                                    {useSafetyBuffer && (
                                        <div className="flex justify-between items-center text-amber-700 font-medium pb-3 border-b border-slate-100">
                                            <span>+ תוספת 10% מקדם בלת"מים:</span>
                                            <span className="font-semibold text-lg">{formatMoney(calculations.safetyBufferAmount)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-[#333333] pt-3">
                                        <span className="font-medium text-lg">סה"כ ספקים משוער:</span>
                                        <span className="font-semibold text-3xl tracking-tight">{formatMoney(calculations.totalFixed)}</span>
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    )}
                    {/* TAB CONTENT: TASKS + SETTINGS shared shell (rendered when either is active) */}
                    {(activeTab === 'tasks' || activeTab === 'settings') && (
                        <motion.div
                            key={`shell-${activeTab}`}
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >

                            {/* Wedding Checklist */}
                            {activeTab === 'tasks' && (
                            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white md:col-span-2">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold flex items-center gap-3 text-[#1F1A1A] tracking-tight">
                                        <div className="bg-[#FFE5ED] border border-[#FFDEDE] text-[#FF4D7F] p-2.5 rounded-2xl shadow-sm">
                                            <CheckCircle2 size={24} strokeWidth={1.5} />
                                        </div>
                                        צ'קליסט חתונה
                                    </h2>
                                    <div className="flex items-center gap-3 bg-[#F8F8F8] px-4 py-2 rounded-xl border border-slate-200">
                                        <div className="h-2.5 w-24 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${checklistProgress}%` }}
                                                transition={{ duration: 0.5 }}
                                                className="h-full bg-[#FF4D7F] rounded-full"
                                            />
                                        </div>
                                        <span className="text-sm font-semibold text-slate-700">{checklistDone}/{checklistTotal}</span>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {checklistCategories.map(category => (
                                        <div key={category}>
                                            <div className="flex justify-between items-center mb-3 text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} strokeWidth={1.5} />
                                                    <p className="text-xs font-medium tracking-widest">{category}</p>
                                                </div>
                                                {getCategoryTargetDate(category) && (
                                                    <p className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg tracking-wider">
                                                        עד ל-{getCategoryTargetDate(category)}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {smartChecklistItems.filter(item => item.category === category).map(item => (
                                                    <div key={item.id} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${item.isDone ? 'bg-[#F8F8F8] border-slate-200 opacity-70' :
                                                        item.isLate ? 'bg-rose-50 border-rose-200' :
                                                            'bg-white border-slate-100 hover:border-[#FFDEDE] hover:shadow-sm'
                                                        }`}
                                                        onClick={() => toggleChecklistItem(item.id)}>
                                                        {item.isDone ?
                                                            <CheckCircle2 size={22} className="text-[#FF4D7F] flex-shrink-0 mt-0.5" strokeWidth={1.5} /> :
                                                            <Circle size={22} className={`flex-shrink-0 mt-0.5 transition-colors ${item.isLate ? 'text-rose-400 group-hover:text-rose-600' : 'text-slate-300 group-hover:text-[#FF4D7F]'}`} strokeWidth={1.5} />
                                                        }
                                                        <div className="flex-1 flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-medium ${item.isDone ? 'text-slate-400 line-through' :
                                                                    item.isLate ? 'text-rose-900' :
                                                                        'text-[#333333]'
                                                                    }`}>{item.text}</span>
                                                                {item.isSyncedOutward && (
                                                                    <span className="text-[10px] text-[#FF4D7F] bg-[#FFE5ED] px-1.5 py-0.5 rounded-[5px] font-semibold flex items-center gap-1.5 border border-[#FFDEDE]">
                                                                        <RefreshCw size={10} className="mt-[-1px]" /> מקושר לספק
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {item.isLate && !item.isDone && (
                                                                <span className="text-[10px] font-semibold tracking-wider text-rose-500 uppercase mt-0.5 animate-pulse">
                                                                    ⚠ באיחור!
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!item.isVirtual && (
                                                            <button onClick={(e) => { e.stopPropagation(); removeChecklistItem(item.id); }} className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 size={14} strokeWidth={1.5} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Add checklist item */}
                                <div className="mt-6 flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="הוספת משימה חדשה..."
                                        value={newChecklistText}
                                        onChange={(e) => setNewChecklistText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                                        className="flex-1 px-4 py-3 bg-[#F8F8F8] border border-slate-200 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#FF4D7F] shadow-sm"
                                    />
                                    <button onClick={addChecklistItem} className="px-5 py-3 bg-[#FF4D7F] hover:bg-[#e63e6d] active:scale-95 text-white rounded-xl font-medium transition-all shadow-md flex items-center gap-2">
                                        <Plus size={18} strokeWidth={1.5} /> הוסף
                                    </button>
                                </div>
                            </div>
                            )}

                        </motion.div>
                    )}
                    {/* SETTINGS: CASH FLOW */}
                    {activeTab === 'settings' && settingsSubTab === 'cashflow' && (
                        <motion.div
                            key="cashflow"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                            {/* CARD 1: Parents pay */}
                            <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg font-bold flex-shrink-0">👨‍👩‍👧</div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">אולם</p>
                                        <h3 className="font-bold text-[#1F1A1A] text-lg leading-tight">ההורים משלמים</h3>
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1">
                                    <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                                        <span className="text-slate-500">מקדמה 1 — בחתימה</span>
                                        <span className="font-semibold text-[#333333]">{formatMoney(calculations.venueAdvance1)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                                        <span className="text-slate-500">מקדמה 2 — חודש לפני</span>
                                        <span className="font-semibold text-[#333333]">{formatMoney(calculations.venueAdvance2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                                        <span className="text-slate-500">תשלום סופי — ביום האירוע</span>
                                        <span className="font-semibold text-[#333333]">{formatMoney(Math.round(calculations.parentsFinalPayment))}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="font-bold text-slate-700">סה"כ</span>
                                        <span className="text-xl font-extrabold text-emerald-600">{formatMoney(calculations.totalParentsGift)}</span>
                                    </div>
                                </div>
                                <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-700 font-medium">
                                    משפחת נדב {formatMoney(nadavMomGift)} + משפחת ליטל {formatMoney(Math.round(calculations.litalParentsGift))}
                                    {calculations.venueOverage > 0 && (
                                        <p className="mt-1 text-[10px] text-rose-600/90 font-medium">⚠️ הצמדה ותוספת מנות ({formatMoney(Math.round(calculations.venueOverage))}) — עליכם, לא על ההורים</p>
                                    )}
                                </div>
                            </div>

                            {/* CARD 2: You pay */}
                            <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-2xl bg-[#FFE5ED] flex items-center justify-center text-[#FF4D7F] text-lg font-bold flex-shrink-0">💳</div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ספקים</p>
                                        <h3 className="font-bold text-[#1F1A1A] text-lg leading-tight">אתם משלמים</h3>
                                    </div>
                                </div>
                                <div className="space-y-1 flex-1">
                                    {fixedExpenses.filter(e => Number(e.advance) > 0).length > 0 && (
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">מקדמות ששולמו</p>
                                    )}
                                    {fixedExpenses.filter(e => Number(e.advance) > 0).map(e => (
                                        <div key={e.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50">
                                            <span className="text-slate-500 truncate max-w-[65%]">{getExpenseEmoji(e.name)} {e.name}</span>
                                            <span className="font-semibold text-[#FF4D7F]">{formatMoney(Number(e.advance))}</span>
                                        </div>
                                    ))}
                                    {fixedExpenses.filter(e => Number(e.advance) > 0).length === 0 && (
                                        <p className="text-sm text-slate-400 italic py-2">אין מקדמות עדיין</p>
                                    )}
                                    {(advancePayerBreakdown['נדב'] + advancePayerBreakdown['ליטל'] + advancePayerBreakdown['משותף']) > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                                            {(['נדב', 'ליטל', 'משותף'] as const).map(payer => (
                                                advancePayerBreakdown[payer] > 0 && (
                                                    <span key={payer} className="text-slate-500">
                                                        {payer}: <span className="font-semibold text-[#333333]">{formatMoney(advancePayerBreakdown[payer])}</span>
                                                    </span>
                                                )
                                            ))}
                                        </div>
                                    )}
                                    {calculations.remainingFixedPayments > 0 && (
                                        <>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2 pt-2">יתרות לתשלום ביום האירוע</p>
                                            {fixedExpenses.filter(e => Number(e.amount) - Number(e.advance) > 0).map(e => (
                                                <div key={e.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50">
                                                    <span className="text-slate-500 truncate max-w-[65%]">{getExpenseEmoji(e.name)} {e.name}</span>
                                                    <span className="font-semibold text-slate-600">{formatMoney(Number(e.amount) - Number(e.advance))}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    {calculations.venueOverage > 0 && (
                                        <>
                                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-4 mb-2 pt-2">תוספת אולם (מעל בסיס החוזה)</p>
                                            <div className="flex justify-between items-center text-sm py-1.5 border-b border-rose-50 bg-rose-50/40 rounded-lg px-2">
                                                <span className="text-rose-600 truncate max-w-[65%]">🏛️ הצמדה ותוספת מנות</span>
                                                <span className="font-semibold text-rose-600">{formatMoney(Math.round(calculations.venueOverage))}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-100">
                                    <span className="font-bold text-slate-700">סה"כ</span>
                                    <span className="text-xl font-extrabold text-[#FF4D7F]">{formatMoney(calculations.totalFixed + Math.round(calculations.venueOverage))}</span>
                                </div>
                            </div>

                            {/* CARD 3: Simulator (manual sliders) */}
                            <div className={`rounded-[2rem] p-7 flex flex-col relative overflow-hidden ${guestForecast.totalGuests > 0 ? '' : 'md:col-span-2'} ${calculations.netBalance >= 0 ? 'bg-gradient-to-br from-[#FF4D7F] to-[#c42f52]' : 'bg-gradient-to-br from-slate-700 to-slate-900'} text-white shadow-[0_20px_50px_rgba(255,77,127,0.2)]`}>
                                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="relative z-10 flex flex-col flex-1">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-lg flex-shrink-0">🎚️</div>
                                        <div>
                                            <p className="text-xs font-bold text-white/60 uppercase tracking-widest">סימולטור</p>
                                            <h3 className="font-bold text-white text-lg leading-tight">מספרים שאתם מגדירים</h3>
                                        </div>
                                    </div>
                                    <div className="space-y-3 flex-1">
                                        <div className="flex justify-between items-center text-sm py-2 border-b border-white/20">
                                            <span className="text-white/70">{guests} אורחים × {formatMoney(avgGift)}</span>
                                            <span className="font-semibold">+{formatMoney(calculations.guestsIncome)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm py-2 border-b border-white/20">
                                            <span className="text-white/70">הוצאות ספקים</span>
                                            <span className="font-semibold">-{formatMoney(calculations.totalFixed)}</span>
                                        </div>
                                        {calculations.venueOverage > 0 && (
                                            <div className="flex justify-between items-center text-sm py-2 border-b border-white/20">
                                                <span className="text-white/70">תוספת אולם (מעל בסיס)</span>
                                                <span className="font-semibold">-{formatMoney(Math.round(calculations.venueOverage))}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-6 bg-white/15 rounded-2xl p-5 text-center border border-white/20">
                                        <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2">נשאר לכם</p>
                                        <p className="text-4xl font-extrabold tracking-tight">
                                            {calculations.netBalance > 0 ? '+' : ''}{formatMoney(calculations.netBalance)}
                                        </p>
                                        <p className="text-xs text-white/50 mt-2">
                                            {calculations.netBalance >= 0 ? 'אחרי תשלום כל הספקים' : 'חסר — כדאי לחסוך'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* CARD 4: AI realistic forecast (only when guest list has data) */}
                            {guestForecast.totalGuests > 0 && (() => {
                                const aiNet = guestForecast.incomeMid + calculations.totalParentsGift - calculations.totalExpenses;
                                const attendancePct = guestForecast.invitedHeads > 0
                                    ? Math.round((guestForecast.expectedHeads / guestForecast.invitedHeads) * 100)
                                    : 0;
                                return (
                                    <div className={`rounded-[2rem] p-7 flex flex-col relative overflow-hidden ${aiNet >= 0 ? 'bg-gradient-to-br from-violet-600 to-indigo-700' : 'bg-gradient-to-br from-slate-700 to-slate-900'} text-white shadow-[0_20px_50px_rgba(99,102,241,0.25)]`}>
                                        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                                        <div className="relative z-10 flex flex-col flex-1">
                                            <div className="flex items-center justify-between gap-3 mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                                        <Sparkles size={18} strokeWidth={2.5} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-white/60 uppercase tracking-widest">AI מציאותי</p>
                                                        <h3 className="font-bold text-white text-lg leading-tight">לפי רשימת אורחים</h3>
                                                    </div>
                                                </div>
                                                <div className="bg-white/15 border border-white/20 rounded-xl px-3 py-1.5 text-center flex-shrink-0">
                                                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest leading-none">הגעה צפויה</p>
                                                    <p className="text-lg font-extrabold leading-tight">{attendancePct}%</p>
                                                    <p className="text-[10px] text-white/70 leading-none mt-0.5">~{Math.round(guestForecast.expectedHeads)} איש</p>
                                                </div>
                                            </div>
                                            <div className="space-y-3 flex-1">
                                                <div className="flex justify-between items-center text-sm py-2 border-b border-white/20">
                                                    <span className="text-white/70">{guestForecast.invitedHeads} מוזמנים → ~{formatHeads(guestForecast.expectedHeads)} מגיעים</span>
                                                    <span className="font-semibold">+{formatMoney(guestForecast.incomeMid)}</span>
                                                </div>
                                                {calculations.totalParentsGift > 0 && (
                                                    <div className="flex justify-between items-center text-sm py-2 border-b border-white/20">
                                                        <span className="text-white/70">השתתפות הורים</span>
                                                        <span className="font-semibold">+{formatMoney(calculations.totalParentsGift)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center text-sm py-2 border-b border-white/20">
                                                    <span className="text-white/70">הוצאות ספקים</span>
                                                    <span className="font-semibold">-{formatMoney(calculations.totalFixed)}</span>
                                                </div>
                                                {calculations.venueOverage > 0 && (
                                                    <div className="flex justify-between items-center text-sm py-2 border-b border-white/20">
                                                        <span className="text-white/70">תוספת אולם (מעל בסיס)</span>
                                                        <span className="font-semibold">-{formatMoney(Math.round(calculations.venueOverage))}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center text-[11px] py-1 text-white/50">
                                                    <span>טווח: {formatMoney(guestForecast.incomeLow)} – {formatMoney(guestForecast.incomeHigh)}</span>
                                                    {guestForecast.lowConfidenceCount > 0 && <span>{guestForecast.lowConfidenceCount} ב־confidence נמוך</span>}
                                                </div>
                                            </div>
                                            <div className="mt-6 bg-white/15 rounded-2xl p-5 text-center border border-white/20">
                                                <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2">נשאר לכם (לפי AI)</p>
                                                <p className="text-4xl font-extrabold tracking-tight">
                                                    {aiNet > 0 ? '+' : ''}{formatMoney(Math.round(aiNet))}
                                                </p>
                                                <p className="text-xs text-white/50 mt-2">לפי הסתברויות הגעה ומתנה לכל אורח</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                        </motion.div>
                    )}

                    {/* TAB CONTENT: ADVISOR — smart guest list (AI-classified) */}
                    {activeTab === 'advisor' && (
                        <motion.div
                            key="advisor"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="space-y-6"
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-br from-[#1F1A1A] to-[#2d2424] text-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.08)] relative overflow-hidden">
                                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FF4D7F]/30 rounded-full blur-3xl"></div>
                                <div className="relative z-10 flex items-center gap-3">
                                    <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
                                        <Sparkles size={20} strokeWidth={1.7} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">יועץ AI</p>
                                        <h2 className="text-xl font-bold tracking-tight">רשימת אורחים חכמה</h2>
                                        <p className="text-sm text-white/70 mt-0.5">הכנס שם והערה — Claude יסווג ויחזה הגעה ומתנה</p>
                                    </div>
                                </div>
                            </div>

                            {/* Forecast block */}
                            {guestForecast.totalGuests > 0 && (
                                <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                    <div className="flex items-center justify-between mb-5 gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">צפי משוקלל</p>
                                            <h3 className="text-lg font-bold text-[#1F1A1A] tracking-tight">{guestForecast.invitedHeads} מוזמנים → ~{formatHeads(guestForecast.expectedHeads)} מגיעים</h3>
                                            <p className="text-[11px] text-slate-400 mt-0.5">לפי הסתברות הגעה × מתנה לכל אורח</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {guestForecast.invitedHeads > 0 && (
                                                <div className="bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-center">
                                                    <p className="text-[9px] font-bold text-pink-600/70 uppercase tracking-widest leading-none">הגעה צפויה</p>
                                                    <p className="text-lg font-extrabold text-[#FF4D7F] leading-tight">{Math.round((guestForecast.expectedHeads / guestForecast.invitedHeads) * 100)}%</p>
                                                    <p className="text-[10px] text-pink-600/70 leading-none mt-0.5">~{Math.round(guestForecast.expectedHeads)} איש</p>
                                                </div>
                                            )}
                                            {guestForecast.lowConfidenceCount > 0 && (
                                                <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1.5">
                                                    <ShieldAlert size={12} strokeWidth={2} />
                                                    {guestForecast.lowConfidenceCount} ב־confidence נמוך
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-rose-600/70 uppercase tracking-widest mb-1">פסימי</p>
                                            <p className="text-xl font-extrabold text-rose-700 tracking-tight">{formatMoney(guestForecast.incomeLow)}</p>
                                        </div>
                                        <div className="bg-[#FF4D7F]/10 border border-[#FF4D7F]/20 rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-[#FF4D7F]/80 uppercase tracking-widest mb-1">ריאלי</p>
                                            <p className="text-xl font-extrabold text-[#FF4D7F] tracking-tight">{formatMoney(guestForecast.incomeMid)}</p>
                                        </div>
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest mb-1">אופטימי</p>
                                            <p className="text-xl font-extrabold text-emerald-700 tracking-tight">{formatMoney(guestForecast.incomeHigh)}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">פילוח לפי קטגוריה</p>
                                        {GUEST_CATEGORIES.map(cat => {
                                            const stat = guestForecast.byCategory.get(cat.id);
                                            if (!stat || stat.count === 0) return null;
                                            return (
                                                <div key={cat.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                                                    <span className="flex items-center gap-2">
                                                        <span>{cat.emoji}</span>
                                                        <span className="text-slate-700 font-medium">{cat.label}</span>
                                                        <span className="text-xs text-slate-400">({stat.count} איש, ~{formatHeads(stat.expected)} מגיעים)</span>
                                                    </span>
                                                    <span className="font-bold text-[#1F1A1A]">{formatMoney(Math.round(stat.income))}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Add guest form */}
                            <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">הוספת אורח</p>
                                <h3 className="text-lg font-bold text-[#1F1A1A] tracking-tight mb-4">סווג אורח חדש עם AI</h3>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={newGuestName}
                                        onChange={(e) => setNewGuestName(e.target.value)}
                                        placeholder="שם האורח (למשל: יוסי כהן)"
                                        className="w-full px-4 py-3 bg-[#F8F8F8] border border-slate-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#FF4D7F] focus:bg-white focus:outline-none transition-all"
                                    />
                                    <textarea
                                        value={newGuestNote}
                                        onChange={(e) => setNewGuestNote(e.target.value)}
                                        placeholder='הערה חופשית: "דוד מצד נדב" / "חבר צבא, עם בת זוג" / "קולגה מהעבודה של ליטל"'
                                        rows={2}
                                        className="w-full px-4 py-3 bg-[#F8F8F8] border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#FF4D7F] focus:bg-white focus:outline-none transition-all resize-none"
                                    />
                                    {classifyError && (
                                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3">
                                            ⚠️ {classifyError}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={classifyAndAddGuest}
                                            disabled={!newGuestName.trim() || classifyingGuest}
                                            className="flex-1 bg-[#FF4D7F] hover:bg-[#e63e6d] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-all shadow-md shadow-[#FFDEDE] flex items-center justify-center gap-2"
                                        >
                                            {classifyingGuest ? (
                                                <>
                                                    <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                                                    מסווג עם Claude...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={16} strokeWidth={1.7} />
                                                    סווג עם AI
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={addGuestManual}
                                            disabled={!newGuestName.trim() || classifyingGuest}
                                            className="px-5 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-2xl transition-colors text-sm"
                                            title="הוסף בלי AI (ברירות מחדל)"
                                        >
                                            ידני
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Bulk import (paste / CSV) */}
                            <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <button
                                    onClick={() => { setImportOpen(prev => !prev); setImportError(null); }}
                                    className="w-full flex items-center justify-between text-right"
                                >
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ייבוא בכמות</p>
                                        <h3 className="text-lg font-bold text-[#1F1A1A] tracking-tight">הדבק רשימה או העלה Excel/CSV</h3>
                                    </div>
                                    <ChevronDown size={20} strokeWidth={1.7} className={`text-slate-400 transition-transform ${importOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {importOpen && (
                                    <div className="mt-5 space-y-3">
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs text-slate-600 leading-relaxed">
                                            <p className="font-semibold text-slate-700 mb-1">פורמט נתמך:</p>
                                            <p>שורה אחת לאורח. שם — או שם + הערה מופרדים בפסיק / Tab.</p>
                                            <pre className="mt-2 bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] leading-5 text-slate-600 overflow-x-auto" dir="ltr">{`יוסי כהן, חבר צבא של נדב
שירה לוי, קולגה מהעבודה
דודה רחל, משפחה מצד אמא של ליטל`}</pre>
                                        </div>

                                        <textarea
                                            value={importText}
                                            onChange={(e) => setImportText(e.target.value)}
                                            placeholder="הדבק כאן את הרשימה — שורה לכל אורח..."
                                            rows={6}
                                            className="w-full px-4 py-3 bg-[#F8F8F8] border border-slate-100 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-[#FF4D7F] focus:bg-white focus:outline-none transition-all resize-y"
                                            dir="auto"
                                        />

                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 cursor-pointer rounded-xl text-xs font-semibold text-slate-700 transition-colors">
                                                <Receipt size={14} strokeWidth={1.7} />
                                                <span>או העלה CSV</span>
                                                <input
                                                    type="file"
                                                    accept=".csv,.txt,text/csv,text/plain"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) handleCsvFile(f);
                                                        e.target.value = '';
                                                    }}
                                                    className="hidden"
                                                />
                                            </label>
                                            <span className="text-xs text-slate-400">
                                                {importText.trim() ? `${parseImportText(importText).length} שורות זוהו` : 'אין שורות'}
                                            </span>
                                        </div>

                                        {importError && (
                                            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3">
                                                ⚠️ {importError}
                                            </div>
                                        )}

                                        {importProgress && (
                                            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3">
                                                <div className="flex items-center justify-between text-xs font-semibold text-[#FF4D7F] mb-1.5">
                                                    <span className="flex items-center gap-1.5">
                                                        <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />
                                                        מסווג...
                                                    </span>
                                                    <span>{importProgress.done} / {importProgress.total}</span>
                                                </div>
                                                <div className="h-1.5 bg-pink-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#FF4D7F] transition-all duration-300"
                                                        style={{ width: `${(importProgress.done / Math.max(1, importProgress.total)) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <button
                                                onClick={importBulkWithAI}
                                                disabled={!importText.trim() || importProgress !== null}
                                                className="flex-1 bg-[#FF4D7F] hover:bg-[#e63e6d] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-all shadow-md shadow-[#FFDEDE] flex items-center justify-center gap-2"
                                            >
                                                <Sparkles size={16} strokeWidth={1.7} />
                                                סווג את כולם עם AI
                                            </button>
                                            <button
                                                onClick={importBulkManual}
                                                disabled={!importText.trim() || importProgress !== null}
                                                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-2xl transition-colors text-sm"
                                                title="הוסף בלי AI (ברירות מחדל)"
                                            >
                                                ידני
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Guest list */}
                            <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <div className="flex items-center justify-between mb-5 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">רשימת מוזמנים</p>
                                        <h3 className="text-lg font-bold text-[#1F1A1A] tracking-tight">
                                            {guestList.length} אורחים
                                            {guestList.length > 0 && groupedGuests.totalFiltered !== guestList.length && (
                                                <span className="text-sm font-medium text-slate-400"> · {groupedGuests.totalFiltered} מוצגים</span>
                                            )}
                                        </h3>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-3 flex-wrap justify-end">
                                        {groupedGuests.ordered.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    const allKeys = groupedGuests.ordered.map(g => String(g.key));
                                                    setCollapsedGuestGroups(prev => prev.size >= allKeys.length ? new Set() : new Set(allKeys));
                                                }}
                                                className="text-xs font-semibold text-slate-500 hover:text-[#FF4D7F] transition-colors"
                                            >
                                                {collapsedGuestGroups.size >= groupedGuests.ordered.length ? 'פתח הכל' : 'סגור הכל'}
                                            </button>
                                        )}
                                        {guestList.length > 1 && (
                                            <button
                                                onClick={() => {
                                                    if (duplicateGuestGroups.groups.length === 0) {
                                                        alert('לא נמצאו כפילויות 🎉');
                                                        return;
                                                    }
                                                    setShowDuplicates(v => !v);
                                                }}
                                                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${duplicateGuestGroups.groups.length > 0 ? 'text-amber-600 hover:text-amber-800' : 'text-slate-500 hover:text-[#FF4D7F]'}`}
                                                title="בדוק אם יש שמות כפולים"
                                            >
                                                <Search size={14} strokeWidth={1.7} />
                                                {duplicateGuestGroups.groups.length > 0
                                                    ? `${showDuplicates ? 'הסתר' : 'הצג'} כפילויות (${duplicateGuestGroups.groups.length})`
                                                    : 'בדוק כפילויות'}
                                            </button>
                                        )}
                                        {guestList.length > 0 && (
                                            <button
                                                onClick={deleteAllGuests}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                                                title="מחק את כל האורחים"
                                            >
                                                <Trash2 size={14} strokeWidth={1.7} />
                                                מחק הכל
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {showDuplicates && duplicateGuestGroups.groups.length > 0 && (
                                    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm font-bold text-amber-800">
                                                נמצאו {duplicateGuestGroups.groups.length} שמות שחוזרים ({duplicateGuestGroups.total} רשומות)
                                            </p>
                                            <button
                                                onClick={() => setShowDuplicates(false)}
                                                className="text-amber-700 hover:text-amber-900"
                                                title="סגור"
                                            >
                                                <X size={16} strokeWidth={1.7} />
                                            </button>
                                        </div>
                                        <ul className="space-y-3">
                                            {duplicateGuestGroups.groups.map(group => (
                                                <li key={group.name} className="rounded-xl bg-white/80 border border-amber-100 p-3">
                                                    <p className="text-xs font-bold text-amber-700 mb-2">"{group.name}" — {group.guests.length} רשומות</p>
                                                    <ul className="space-y-1.5">
                                                        {group.guests.map(g => (
                                                            <li key={g.id} className="flex items-center justify-between gap-2 text-xs">
                                                                <span className="text-slate-700 truncate">
                                                                    {g.note ? <span className="text-slate-500">{g.note}</span> : <span className="text-slate-400 italic">ללא הערה</span>}
                                                                    {g.category && <span className="text-slate-400"> · {GUEST_CATEGORIES.find(c => c.id === g.category)?.label ?? g.category}</span>}
                                                                </span>
                                                                <button
                                                                    onClick={() => deleteGuest(g.id)}
                                                                    className="flex-shrink-0 flex items-center gap-1 text-red-500 hover:text-red-700 font-semibold"
                                                                    title="מחק רשומה זו"
                                                                >
                                                                    <Trash2 size={12} strokeWidth={1.7} />
                                                                    מחק
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {guestList.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <Users size={32} strokeWidth={1.5} className="mx-auto mb-3 opacity-50" />
                                        <p className="text-sm font-medium">אין אורחים עדיין</p>
                                        <p className="text-xs mt-1">הוסף אורח ראשון בטופס למעלה</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Search */}
                                        <div className="relative mb-3">
                                            <Search size={14} strokeWidth={1.7} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={guestSearch}
                                                onChange={(e) => setGuestSearch(e.target.value)}
                                                placeholder="חיפוש שם או הערה..."
                                                className="w-full pr-9 pl-9 py-2.5 bg-[#F8F8F8] border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#FF4D7F] focus:bg-white focus:outline-none transition-all"
                                            />
                                            {guestSearch && (
                                                <button
                                                    onClick={() => setGuestSearch('')}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                                    title="נקה חיפוש"
                                                >
                                                    <X size={14} strokeWidth={2} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Side filter */}
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {(['all', 'חתן', 'כלה', 'משותף'] as const).map(s => {
                                                const active = guestSideFilter === s;
                                                return (
                                                    <button
                                                        key={s}
                                                        onClick={() => setGuestSideFilter(s)}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${active ? 'bg-[#1F1A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                    >
                                                        {s === 'all' ? 'כל הצדדים' : s}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Category filter — only chips for groups that have guests */}
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            <button
                                                onClick={() => setGuestCategoryFilter('all')}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${guestCategoryFilter === 'all' ? 'bg-[#FF4D7F] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                כל הקבוצות
                                            </button>
                                            {GUEST_CATEGORIES.map(cat => {
                                                const stat = guestForecast.byCategory.get(cat.id);
                                                if (!stat || stat.count === 0) return null;
                                                const active = guestCategoryFilter === cat.id;
                                                return (
                                                    <button
                                                        key={cat.id}
                                                        onClick={() => setGuestCategoryFilter(active ? 'all' : cat.id)}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${active ? 'bg-[#FF4D7F] text-white border-[#FF4D7F]' : `${cat.color} hover:opacity-80`}`}
                                                    >
                                                        {cat.emoji} {cat.label}
                                                    </button>
                                                );
                                            })}
                                            {guestForecast.unclassifiedCount > 0 && (
                                                <button
                                                    onClick={() => setGuestCategoryFilter(guestCategoryFilter === 'unclassified' ? 'all' : 'unclassified')}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${guestCategoryFilter === 'unclassified' ? 'bg-[#FF4D7F] text-white border-[#FF4D7F]' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                                                >
                                                    ❓ ללא קטגוריה ({guestForecast.unclassifiedCount})
                                                </button>
                                            )}
                                        </div>

                                        {/* Grouped guests */}
                                        {groupedGuests.ordered.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 text-sm">
                                                לא נמצאו אורחים תואמים לסינון הנוכחי
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {groupedGuests.ordered.map(group => {
                                                    const groupKey = String(group.key);
                                                    const collapsed = collapsedGuestGroups.has(groupKey);
                                                    return (
                                                        <div key={groupKey} className="bg-[#F8F8F8] rounded-2xl border border-slate-100 overflow-hidden">
                                                            {/* Group header */}
                                                            <button
                                                                onClick={() => toggleGuestGroupCollapsed(groupKey)}
                                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white transition-colors text-right"
                                                            >
                                                                <ChevronDown size={16} strokeWidth={2} className={`text-slate-400 transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`} />
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${group.color}`}>
                                                                    {group.emoji} {group.label}
                                                                </span>
                                                                <span className="text-xs text-slate-500 font-medium flex-shrink-0">
                                                                    {group.data.guests.length} כניסות · {group.data.heads} ראשים
                                                                </span>
                                                                <div className="flex-1" />
                                                                <div className="flex items-center gap-3 text-xs flex-shrink-0">
                                                                    <span className="text-slate-500">~{formatHeads(group.data.expectedHeads)} מגיעים</span>
                                                                    <span className="font-bold text-[#1F1A1A]">{formatMoney(Math.round(group.data.expectedIncome))}</span>
                                                                </div>
                                                            </button>
                                                            {/* Group rows */}
                                                            {!collapsed && (
                                                                <div className="px-2 pb-2 space-y-1.5">
                                                                    {group.data.guests.map(g => {
                                                                        const expanded = expandedGuestId === g.id;
                                                                        return (
                                                                            <div key={g.id} className="bg-white border border-slate-100 rounded-xl">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setExpandedGuestId(expanded ? null : g.id)}
                                                                                    className="w-full text-right p-3 hover:bg-slate-50 transition-colors rounded-xl"
                                                                                >
                                                                                    <div className="flex items-start gap-3">
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                                <span className="font-semibold text-[#1F1A1A] text-sm">{g.name}</span>
                                                                                                {g.side && (
                                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{g.side}</span>
                                                                                                )}
                                                                                                {g.rsvp_status === 'confirmed' && (
                                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700" title="אישר הגעה">✓ אישר</span>
                                                                                                )}
                                                                                                {g.rsvp_status === 'doubtful' && (
                                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700" title="ספק אם יגיע">🤔 ספק</span>
                                                                                                )}
                                                                                                {g.rsvp_status === 'declined' && (
                                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700" title="לא מגיע">✗ לא מגיע</span>
                                                                                                )}
                                                                                                {(g.head_count ?? (g.plus_one ? 2 : 1)) >= 2 && (
                                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700" title={`${g.head_count ?? 2} אנשים`}>
                                                                                                        {(g.head_count ?? 2) === 2 ? '💑' : `👥 ×${g.head_count ?? 2}`}
                                                                                                    </span>
                                                                                                )}
                                                                                                {g.gift_realistic === 0 && (
                                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700" title="משלם בנפרד">🆓</span>
                                                                                                )}
                                                                                                {g.confidence === 'low' && (
                                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700" title="ביטחון נמוך">⚠️</span>
                                                                                                )}
                                                                                                {g.manually_edited && (
                                                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500" title="נערך ידנית">ידני</span>
                                                                                                )}
                                                                                            </div>
                                                                                            {g.note && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{g.note}</p>}
                                                                                        </div>
                                                                                        <div className="text-left text-[11px] flex-shrink-0 leading-tight">
                                                                                            <div className="text-slate-500">{Math.round((g.attendance_prob ?? 0) * 100)}%</div>
                                                                                            <div className="font-bold text-[#1F1A1A] mt-0.5">{g.gift_realistic === 0 ? '—' : formatMoney(g.gift_realistic)}</div>
                                                                                        </div>
                                                                                        <ChevronDown size={14} strokeWidth={2} className={`text-slate-400 mt-1 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                                                                    </div>
                                                                                </button>
                                                                                {expanded && (
                                                                                    <div className="px-3 pb-3 pt-2 border-t border-slate-100">
                                                                                        {/* RSVP quick-toggle */}
                                                                                        <div className="mb-3">
                                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">סטטוס הגעה</p>
                                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                                {([
                                                                                                    { v: null,        label: 'לא ידוע',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
                                                                                                    { v: 'confirmed', label: '✓ אישר',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                                                                                    { v: 'doubtful',  label: '🤔 ספק',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                                                                                                    { v: 'declined',  label: '✗ לא מגיע', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
                                                                                                ] as const).map(opt => {
                                                                                                    const active = (g.rsvp_status ?? null) === opt.v;
                                                                                                    return (
                                                                                                        <button
                                                                                                            key={String(opt.v)}
                                                                                                            onClick={() => setGuestRsvp(g, opt.v)}
                                                                                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${active ? 'bg-[#1F1A1A] text-white border-[#1F1A1A]' : `${opt.cls} hover:opacity-80`}`}
                                                                                                        >
                                                                                                            {opt.label}
                                                                                                        </button>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        </div>
                                                                                        {/* Inline edit row */}
                                                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                                                                <select
                                                                    value={g.side ?? ''}
                                                                    onChange={(e) => updateGuest(g.id, { side: (e.target.value as GuestSide) || null })}
                                                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                                                >
                                                                    <option value="">צד</option>
                                                                    {GUEST_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
                                                                </select>
                                                                <select
                                                                    value={g.category ?? ''}
                                                                    onChange={(e) => {
                                                                        const newCat = (e.target.value as GuestCategory) || null;
                                                                        if (newCat && CATEGORY_DEFAULTS[newCat]) {
                                                                            const heads = Math.max(1, Number(g.head_count ?? (g.plus_one ? 2 : 1)));
                                                                            const t = giftDefaultsForHeads(newCat, heads);
                                                                            updateGuest(g.id, {
                                                                                category: newCat,
                                                                                attendance_prob: t.attendance_prob,
                                                                                ...(g.gift_realistic === 0
                                                                                    ? {}
                                                                                    : { gift_low: t.gift_low, gift_realistic: t.gift_realistic, gift_high: t.gift_high }),
                                                                            });
                                                                        } else {
                                                                            updateGuest(g.id, { category: newCat });
                                                                        }
                                                                    }}
                                                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                                                >
                                                                    <option value="">קטגוריה</option>
                                                                    {GUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                                </select>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    value={Math.round((g.attendance_prob ?? 0) * 100)}
                                                                    onChange={(e) => {
                                                                        const v = Math.max(0, Math.min(100, Number(e.target.value)));
                                                                        updateGuest(g.id, { attendance_prob: v / 100 });
                                                                    }}
                                                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                                                    title="אחוז הגעה"
                                                                />
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    step={50}
                                                                    value={g.gift_realistic}
                                                                    disabled={g.gift_realistic === 0}
                                                                    onChange={(e) => {
                                                                        const raw = Number(e.target.value);
                                                                        const heads = Math.max(1, Number(g.head_count ?? (g.plus_one ? 2 : 1)));
                                                                        const minFloor = 400 * heads;
                                                                        const v = raw === 0 ? 0 : Math.max(minFloor, raw);
                                                                        updateGuest(g.id, { gift_realistic: v });
                                                                    }}
                                                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                                                    title="מתנה ריאלית (₪)"
                                                                />
                                                                <label className={`flex items-center gap-2 px-2 py-1.5 border rounded-lg text-xs cursor-pointer transition-colors ${g.gift_realistic === 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`} title="לא יספר בסטטיסטיקת הכסף, רק בכמות מוזמנים">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={g.gift_realistic === 0}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                updateGuest(g.id, { gift_low: 0, gift_realistic: 0, gift_high: 0 });
                                                                            } else {
                                                                                const heads = Math.max(1, Number(g.head_count ?? (g.plus_one ? 2 : 1)));
                                                                                if (g.category) {
                                                                                    const target = giftDefaultsForHeads(g.category, heads);
                                                                                    updateGuest(g.id, { gift_low: target.gift_low, gift_realistic: target.gift_realistic, gift_high: target.gift_high });
                                                                                } else {
                                                                                    const floor = 400 * heads;
                                                                                    updateGuest(g.id, { gift_low: floor, gift_realistic: floor + 50, gift_high: floor + 200 });
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="accent-indigo-600"
                                                                    />
                                                                    <span>🆓 משלם בנפרד</span>
                                                                </label>
                                                                <div className="flex items-center gap-2 px-2 py-1.5 border bg-white border-slate-200 rounded-lg text-xs" title="מספר נפשות לרשומה (1=בודד, 2=זוג, 3+=משפחה במעטפה אחת)">
                                                                    <span className="text-slate-500">👥</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const cur = Math.max(1, Number(g.head_count ?? (g.plus_one ? 2 : 1)));
                                                                            if (cur <= 1) return;
                                                                            const next = cur - 1;
                                                                            if (g.category && g.gift_realistic !== 0) {
                                                                                const t = giftDefaultsForHeads(g.category, next);
                                                                                updateGuest(g.id, { head_count: next, plus_one: next >= 2, gift_low: t.gift_low, gift_realistic: t.gift_realistic, gift_high: t.gift_high });
                                                                            } else {
                                                                                updateGuest(g.id, { head_count: next, plus_one: next >= 2 });
                                                                            }
                                                                        }}
                                                                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold leading-none disabled:opacity-40"
                                                                        disabled={(g.head_count ?? (g.plus_one ? 2 : 1)) <= 1}
                                                                    >−</button>
                                                                    <span className="font-bold text-[#1F1A1A] w-4 text-center">{g.head_count ?? (g.plus_one ? 2 : 1)}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const cur = Math.max(1, Number(g.head_count ?? (g.plus_one ? 2 : 1)));
                                                                            if (cur >= 12) return;
                                                                            const next = cur + 1;
                                                                            if (g.category && g.gift_realistic !== 0) {
                                                                                const t = giftDefaultsForHeads(g.category, next);
                                                                                updateGuest(g.id, { head_count: next, plus_one: next >= 2, gift_low: t.gift_low, gift_realistic: t.gift_realistic, gift_high: t.gift_high });
                                                                            } else {
                                                                                updateGuest(g.id, { head_count: next, plus_one: next >= 2 });
                                                                            }
                                                                        }}
                                                                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold leading-none disabled:opacity-40"
                                                                        disabled={(g.head_count ?? (g.plus_one ? 2 : 1)) >= 12}
                                                                    >+</button>
                                                                    <span className="text-slate-500 mr-1">{(g.head_count ?? (g.plus_one ? 2 : 1)) === 1 ? 'בודד' : (g.head_count ?? 2) === 2 ? 'זוג' : 'משפחה'}</span>
                                                                </div>
                                                                                        </div>
                                                                                        <div className="flex justify-end mt-3">
                                                                                            <button
                                                                                                onClick={(e) => { e.stopPropagation(); deleteGuest(g.id); }}
                                                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                                                title="הסר"
                                                                                            >
                                                                                                <Trash2 size={14} strokeWidth={1.7} />
                                                                                                הסר
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* TAB CONTENT: RUN SHEET — wedding day */}
                    {activeTab === 'runsheet' && (
                        <motion.div
                            key="runsheet"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="space-y-6"
                        >
                            {/* Day-of summary cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">מזומן ביום</p>
                                    <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatMoney(runSheetSummary.totalCash)}</p>
                                </div>
                                <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">צ'קים</p>
                                    <p className="text-2xl font-extrabold text-indigo-600 tracking-tight">{formatMoney(runSheetSummary.totalChecks)}</p>
                                </div>
                                <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">העברה</p>
                                    <p className="text-2xl font-extrabold text-sky-600 tracking-tight">{formatMoney(runSheetSummary.totalTransfer)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-[#FF4D7F] to-[#e63e6d] rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(255,77,127,0.25)] text-white relative overflow-hidden">
                                    <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/20 rounded-full blur-2xl"></div>
                                    <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2 relative z-10">מוכנות מעטפות</p>
                                    <p className="text-2xl font-extrabold tracking-tight relative z-10">{runSheetSummary.readyCount} / {runSheetSummary.totalCount}</p>
                                </div>
                            </div>

                            {/* Vendor envelopes — final payments */}
                            <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">תשלום סופי לכל ספק</p>
                                        <h2 className="text-xl font-bold text-[#1F1A1A] tracking-tight">מעטפות ליום החתונה</h2>
                                    </div>
                                    <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                                        סה"כ: {formatMoney(runSheetSummary.totalRemaining)}
                                    </div>
                                </div>
                                {runSheetSummary.vendors.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-8">אין ספקים עם יתרה לתשלום סופי. הוסיפו הוצאות בטאב "הוצאות וספקים".</p>
                                ) : (
                                    <div className="space-y-2">
                                        {runSheetSummary.vendors.map(v => (
                                            <div key={v.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-2xl border transition-colors ${v.payment_ready ? 'bg-emerald-50/50 border-emerald-200' : 'bg-[#F8F8F8] border-slate-100'}`}>
                                                <button
                                                    onClick={() => updateExpense(v.id, 'payment_ready', !v.payment_ready)}
                                                    className={`col-span-1 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${v.payment_ready ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 hover:border-emerald-400'}`}
                                                    title={v.payment_ready ? 'מעטפה מוכנה' : 'סמן כמוכן'}
                                                >
                                                    {v.payment_ready && <CheckCircle2 size={16} strokeWidth={2.5} />}
                                                </button>
                                                <div className="col-span-11 md:col-span-3 min-w-0">
                                                    <div className="font-semibold text-[#1F1A1A] truncate text-sm">{getExpenseEmoji(v.name)} {v.name}</div>
                                                    {v.contact_name && <div className="text-xs text-slate-500 truncate">{v.contact_name}</div>}
                                                </div>
                                                <input
                                                    type="time"
                                                    value={v.arrival_time || ''}
                                                    onChange={(e) => updateExpense(v.id, 'arrival_time', e.target.value)}
                                                    className="col-span-3 md:col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                                    title="שעת הגעה"
                                                />
                                                <select
                                                    value={v.payment_method || 'מזומן'}
                                                    onChange={(e) => updateExpense(v.id, 'payment_method', e.target.value)}
                                                    className="col-span-4 md:col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                                >
                                                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                                <select
                                                    value={v.payment_holder || ''}
                                                    onChange={(e) => updateExpense(v.id, 'payment_holder', e.target.value)}
                                                    className="col-span-5 md:col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                                >
                                                    <option value="">מי מחזיק?</option>
                                                    {PAYMENT_HOLDERS.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                <div className="col-span-12 md:col-span-2 text-left md:text-right">
                                                    <span className="font-bold text-[#FF4D7F] text-sm">{formatMoney(v.remainingAmount)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {runSheetSummary.venueFinal > 0 && (
                                    <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🏛️</span>
                                                <span className="font-semibold">תשלום סופי לאולם — באחריות ההורים</span>
                                            </div>
                                            <span className="font-bold">{formatMoney(Math.round(runSheetSummary.venueFinal))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Wedding-day timeline */}
                            <div className="bg-white rounded-[2rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">לוח זמנים</p>
                                        <h2 className="text-xl font-bold text-[#1F1A1A] tracking-tight">סדר היום</h2>
                                    </div>
                                    <button
                                        onClick={addRunSheetEvent}
                                        className="bg-[#FF4D7F] hover:bg-[#e63e6d] text-white font-semibold py-2 px-4 rounded-xl transition-colors text-sm flex items-center gap-2 shadow-sm"
                                    >
                                        <Plus size={16} strokeWidth={2} />
                                        הוסף שלב
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {[...runSheetEvents].sort((a, b) => a.time.localeCompare(b.time)).map(ev => (
                                        <div key={ev.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl bg-[#F8F8F8] border border-slate-100">
                                            <input
                                                type="time"
                                                value={ev.time}
                                                onChange={(e) => updateRunSheetEvent(ev.id, 'time', e.target.value)}
                                                className="col-span-3 md:col-span-2 px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#FF4D7F] text-center focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={ev.title}
                                                onChange={(e) => updateRunSheetEvent(ev.id, 'title', e.target.value)}
                                                placeholder="מה קורה?"
                                                className="col-span-9 md:col-span-5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={ev.responsible}
                                                onChange={(e) => updateRunSheetEvent(ev.id, 'responsible', e.target.value)}
                                                placeholder="אחראי"
                                                className="col-span-10 md:col-span-4 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#FF4D7F] focus:outline-none"
                                            />
                                            <button
                                                onClick={() => removeRunSheetEvent(ev.id)}
                                                className="col-span-2 md:col-span-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg p-2 transition-colors flex items-center justify-center"
                                                title="הסר"
                                            >
                                                <Trash2 size={16} strokeWidth={1.7} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}