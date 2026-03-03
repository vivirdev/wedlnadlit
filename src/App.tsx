import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, TrendingUp, TrendingDown, Heart, PieChart, Wallet, ShieldAlert, CalendarHeart, LayoutDashboard, Receipt, Sparkles, CheckCircle2, Circle, Clock, Banknote, BarChart3, Lock } from 'lucide-react';
import { supabase } from './lib/supabase';

interface Expense {
    id: number;
    name: string;
    amount: number | string;
    advance: number | string;
    paid?: boolean;
    contact_name?: string;
    contact_phone?: string;
}

interface ChecklistItem {
    id: number;
    text: string;
    done: boolean;
    category: string;
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
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'income', 'expenses'

    // Wedding Date Setup
    const weddingDate = new Date('2026-06-23');
    const daysLeft = Math.ceil((weddingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

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

    // Safety Buffer State
    const [useSafetyBuffer, setSafetyBuffer] = useState(true);

    // Savings Tracker
    const [monthlySaving, setMonthlySaving] = useState(3000);
    const [nadavMomGift, setNadavMomGift] = useState<number>(40000);

    // Array States
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [newChecklistText, setNewChecklistText] = useState('');
    const [fixedExpenses, setFixedExpenses] = useState<Expense[]>([]);

    const [newExpenseName, setNewExpenseName] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseAdvance, setNewExpenseAdvance] = useState('');

    const loadData = async (id: number) => {
        try {
            const [configRes, expensesRes, checklistRes] = await Promise.all([
                supabase.from('wedding_config').select('*').eq('id', id).single(),
                supabase.from('expenses').select('*').eq('config_id', id).order('id'),
                supabase.from('checklist').select('*').eq('config_id', id).order('id')
            ]);
            if (configRes.data) {
                setInvitedGuests(configRes.data.invited_guests);
                setNoShowPercent(configRes.data.no_show_percent);
                setAvgGift(configRes.data.avg_gift);
                setMonthlySaving(configRes.data.monthly_saving);
                setSafetyBuffer(configRes.data.use_safety_buffer);
                setNadavMomGift(configRes.data.nadav_mom_gift);
            }
            if (expensesRes.data) setFixedExpenses(expensesRes.data);

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
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [isAuthenticated, configId]);

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
        let venueCost = 0;
        let costBreakdown = '';

        if (guests < 250) {
            venueCost = guests * 610;
            costBreakdown = `${guests} אורחים לפי 610 ₪ למנה`;
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

        // 2. Fixed Expenses & Advances
        const baseFixed = fixedExpenses.reduce((sum: number, exp: Expense) => sum + Number(exp.amount), 0);
        const totalFixedAdvances = fixedExpenses.reduce((sum: number, exp: Expense) => sum + Number(exp.advance || 0), 0);

        // Calculate buffer (10% of fixed expenses if enabled)
        const safetyBufferAmount = useSafetyBuffer ? baseFixed * 0.10 : 0;
        const totalFixed = baseFixed + safetyBufferAmount;

        // 3. Total Expenses (needed for Lital parents' gift calculation)
        const totalExpenses = totalFixed + venueCost;

        // 4. Total Parents Gifts
        // Lital's parents pay the exact remainder of the VENUE cost minus Nadav's mom.
        const litalParentsGift = Math.max(0, venueCost - nadavMomGift);
        const totalParentsGift = nadavMomGift + litalParentsGift;

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
            { name: 'אולם', amount: venueCost, color: '#6366f1' },
            { name: 'צילום', amount: fixedExpenses.filter(e => ['צלמים', 'צלם מגנטים'].some(k => e.name.includes(k))).reduce((s, e) => s + Number(e.amount), 0), color: '#8b5cf6' },
            { name: 'מוזיקה', amount: fixedExpenses.filter(e => ['דיג', 'רקדנים', 'סקסופוניסט', 'כנר'].some(k => e.name.includes(k))).reduce((s, e) => s + Number(e.amount), 0), color: '#ec4899' },
            { name: 'לבוש ויופי', amount: fixedExpenses.filter(e => ['שמלות', 'תכשיטים', 'איפור', 'חתן', 'טבעות', 'נעליים'].some(k => e.name.includes(k))).reduce((s, e) => s + Number(e.amount), 0), color: '#f59e0b' },
            { name: 'עיצוב', amount: fixedExpenses.filter(e => e.name.includes('עיצוב')).reduce((s, e) => s + Number(e.amount), 0), color: '#10b981' },
        ];
        const categorizedTotal = expenseCategories.reduce((s, c) => s + c.amount, 0);
        const otherAmount = baseFixed - categorizedTotal + venueCost > 0 ? baseFixed - (categorizedTotal - venueCost) : 0;
        if (otherAmount > 0) expenseCategories.push({ name: 'אחר', amount: otherAmount, color: '#94a3b8' });

        return {
            venueCost, venueAdvance1, venueAdvance2, venueAdvance,
            costBreakdown, baseFixed, safetyBufferAmount, totalFixed, totalExpenses,
            guestsIncome, totalParentsGift, litalParentsGift, totalIncome, netBalance,
            totalAdvancesPaid, remainingToPay, costPerGuest, breakEvenAvgGift, incomeProgress,
            scenarios, expenseCategories,
        };
    }, [guests, avgGift, fixedExpenses, nadavMomGift, venueAdvance1Percent, venueAdvance2Percent, useSafetyBuffer, invitedGuests, noShowPercent]);

    // Savings Calculations
    const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
    const totalSavingsByWedding = monthlySaving * monthsLeft;
    const savingsNeeded = calculations.totalAdvancesPaid; // advances needed before wedding
    const savingsProgress = Math.min((totalSavingsByWedding / Math.max(1, savingsNeeded)) * 100, 100);

    // Checklist calculations
    const smartChecklistItems = useMemo(() => {
        return checklistItems.map(item => {
            let isDone = item.done;
            let isLate = false;

            // 1. Auto-Done based on expenses
            const nameLower = item.text.toLowerCase();
            const hasMatchedExpense = fixedExpenses.some(exp => {
                if (exp.paid || Number(exp.advance) > 0) {
                    const expLower = exp.name.toLowerCase();
                    if (nameLower.includes('אולם') && expLower.includes('אולם')) return true;
                    if (nameLower.includes('צלמ') && expLower.includes('צלמ')) return true;
                    if (nameLower.includes('דיג') && expLower.includes('דיג')) return true;
                    if (nameLower.includes('קייטרינג') && expLower.includes('קייטרינג')) return true;
                    if (nameLower.includes('מגנטים') && expLower.includes('מגנט')) return true;
                    if (nameLower.includes('שמל') && expLower.includes('שמל')) return true;
                    if (nameLower.includes('איפור') && expLower.includes('איפור')) return true;
                    if (nameLower.includes('שיער') && expLower.includes('שיער')) return true;
                    if (nameLower.includes('אלכוהול') && expLower.includes('אלכוהול')) return true;
                    if (nameLower.includes('הזמנות') && expLower.includes('הזמנות')) return true;
                    if (nameLower.includes('טבעו') && expLower.includes('טבעו')) return true;
                    if (nameLower.includes('חליפ') && (expLower.includes('חליפ') || expLower.includes('חתן'))) return true;
                    if (nameLower.includes('עיצוב') && expLower.includes('עיצוב')) return true;
                    if (nameLower.includes('אקו"ם') && (expLower.includes('אקום') || expLower.includes('אקו"ם'))) return true;
                }
                return false;
            });

            if (hasMatchedExpense) {
                isDone = true;
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

            return { ...item, isDone, isLate };
        });
    }, [checklistItems, fixedExpenses, daysLeft]);

    const checklistDone = smartChecklistItems.filter(i => i.isDone).length;
    const checklistTotal = smartChecklistItems.length;
    const checklistProgress = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;
    const checklistCategories = [...new Set(smartChecklistItems.map(i => i.category))];

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

    const updateExpense = async (id: number, field: string, value: string | number) => {
        if (!configId) return;
        const val = field === 'contact_name' || field === 'contact_phone' ? value : Number(value);
        setFixedExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));

        // Don't wait for loadData here as it causes focus loss while typing text inputs
        supabase.from('expenses').update({ [field]: val }).eq('id', id).then(() => {
            // Optional: we can reload data in background if needed, but realtime should catch it
            // or we rely on the local optimistic update.
            if (field !== 'contact_name' && field !== 'contact_phone') {
                loadData(configId);
            }
        });
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
        setChecklistItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
        const item = checklistItems.find(i => i.id === id);
        if (item) {
            await supabase.from('checklist').update({ done: !item.done }).eq('id', id);
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

                {/* Pinned Summary Dashboard - ALWAYS VISIBLE */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 lg:px-8"
                >
                    {/* Income Card */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(255,77,127,0.1)] transition-all group border border-transparent hover:border-[#FFDEDE]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">הכנסות והורים</p>
                        <p className="text-3xl font-extrabold text-[#FF4D7F] tracking-tight">{formatMoney(calculations.totalIncome)}</p>
                    </div>

                    {/* Expenses Card */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(255,77,127,0.1)] transition-all group border border-transparent hover:border-[#FFDEDE] relative overflow-hidden">
                        {useSafetyBuffer && <div className="absolute top-0 right-0 w-1.5 h-full bg-[#FFDEDE]"></div>}
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">סה"כ הוצאות</p>
                        <p className="text-3xl font-extrabold text-[#FF4D7F] tracking-tight">{formatMoney(calculations.totalExpenses)}</p>
                    </div>

                    {/* Advances Card */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(255,77,127,0.1)] transition-all group border border-transparent hover:border-[#FFDEDE]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">מקדמות ששולמו</p>
                        <p className="text-3xl font-extrabold text-[#FF4D7F] tracking-tight">{formatMoney(calculations.totalAdvancesPaid)}</p>
                    </div>

                    {/* Net Balance Card - Pink gradient */}
                    <div className={`rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(255,77,127,0.25)] relative overflow-hidden group ${calculations.netBalance >= 0 ? 'bg-gradient-to-br from-[#FF4D7F] to-[#e63e6d]' : 'bg-gradient-to-br from-[#d4365e] to-[#c42f52]'}`}>
                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:bg-white/30 transition-all"></div>
                        <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-3 relative z-10">רווח משוער</p>
                        <div className="flex items-center gap-2 relative z-10">
                            {calculations.netBalance >= 0 ? <TrendingUp className="text-white opacity-80" size={24} strokeWidth={1.5} /> : <TrendingDown className="text-rose-200" size={24} strokeWidth={1.5} />}
                            <p className="text-3xl font-extrabold text-white tracking-tight">
                                {calculations.netBalance > 0 ? '+' : ''}{formatMoney(calculations.netBalance)}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Custom Tabs Navigation (Vibrant Pills) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-wrap justify-center gap-3 sticky top-4 z-50 mb-8"
                >
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-6 rounded-full font-medium transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-[#FF4D7F] text-white shadow-md shadow-[#FFDEDE]/50' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'}`}
                    >
                        <LayoutDashboard size={18} strokeWidth={1.5} />
                        <span>סקירה ותובנות</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('income')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-6 rounded-full font-medium transition-all duration-300 ${activeTab === 'income' ? 'bg-[#FF4D7F] text-white shadow-md shadow-[#FFDEDE]/50' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'}`}
                    >
                        <Users size={18} strokeWidth={1.5} />
                        <span>מוזמנים והכנסות</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('expenses')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-6 rounded-full font-medium transition-all duration-300 ${activeTab === 'expenses' ? 'bg-[#FF4D7F] text-white shadow-md shadow-[#FFDEDE]/50' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'}`}
                    >
                        <Receipt size={18} strokeWidth={1.5} />
                        <span>הוצאות וספקים</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('smart')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-6 rounded-full font-medium transition-all duration-300 ${activeTab === 'smart' ? 'bg-[#FF4D7F] text-white shadow-md shadow-[#FFDEDE]/50' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'}`}
                    >
                        <Sparkles size={18} strokeWidth={1.5} />
                        <span>ניהול חכם</span>
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

                <AnimatePresence mode="wait">
                    {/* TAB CONTENT: DASHBOARD */}
                    {activeTab === 'dashboard' && (
                        <motion.div
                            key="dashboard"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >

                            {/* Visual Budget Progress Bar */}
                            <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white md:col-span-2">
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">סקירה תקציבית</p>
                                        <p className="font-bold text-[#1F1A1A] text-2xl tracking-tight">מדד כיסוי ההשקעה</p>
                                    </div>
                                    <div className="px-4 py-1.5 rounded-xl text-sm font-bold bg-[#F8F8F8] border border-slate-200 text-slate-700">
                                        {calculations.incomeProgress >= 100 ? 'החזרתם 100% ויותר! 🎉' : `מכוסה: ${calculations.incomeProgress.toFixed(1)}%`}
                                    </div>
                                </div>
                                <div className="h-8 w-full bg-slate-100/80 rounded-full overflow-hidden flex relative shadow-inner border border-slate-200/50">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${calculations.incomeProgress}%` }}
                                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                                        className={`h-full ${calculations.netBalance >= 0 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-[#FF4D7F] to-pink-500'}`}
                                    ></motion.div>
                                    <div className="absolute top-0 bottom-0 border-l-2 border-slate-900/20 border-dashed z-10" style={{ left: '0%' }}></div>
                                </div>
                                <div className="flex justify-between text-sm font-medium text-slate-400 mt-3 px-1">
                                    <span>{formatMoney(0)}</span>
                                    <span>יעד התאפסות: <span className="text-slate-700">{formatMoney(calculations.totalExpenses)}</span></span>
                                </div>
                            </div>

                            {/* Smart Insights Block */}
                            <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white h-full flex flex-col justify-between">
                                <div className="mb-6">
                                    <p className="text-xs font-semibold text-[#FF4D7F] uppercase tracking-widest mb-1">תובנות הזהב</p>
                                    <h2 className="text-xl font-bold text-[#1F1A1A] flex items-center gap-2">
                                        כדי לא להפסיד שקל
                                    </h2>
                                </div>
                                <div className="bg-[#F8F8F8] p-6 rounded-2xl border border-slate-100">
                                    <p className="text-slate-500 text-sm font-semibold mb-1 uppercase tracking-wider">הממוצע הנדרש:</p>
                                    <p className="text-5xl font-bold text-[#FF4D7F] tracking-tighter mb-4">{formatMoney(calculations.breakEvenAvgGift)} <span className="text-base font-semibold text-slate-400">לאורח</span></p>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-500">
                                        <span>סיוע הורים:</span>
                                        <span className="text-[#333333]">{(calculations.totalParentsGift).toLocaleString()} ₪</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <div>
                                        <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">עלות כוללת לאורח</p>
                                        <p className="text-2xl font-bold text-[#FF4D7F]">{formatMoney(calculations.costPerGuest)}</p>
                                    </div>
                                    <div className="bg-[#F8F8F8] p-3 rounded-xl border border-slate-100">
                                        <PieChart className="text-slate-400" size={24} strokeWidth={1.5} />
                                    </div>
                                </div>
                            </div>

                            {/* Venue Details */}
                            <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col justify-between">
                                <div>
                                    <div className="mb-6">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">התחייבויות לאולם</p>
                                        <h2 className="text-xl font-bold text-[#1F1A1A] flex items-center gap-2">
                                            תקציר האולם
                                        </h2>
                                    </div>

                                    <div className="bg-[#F8F8F8] p-5 rounded-2xl border border-slate-100 mb-6">
                                        <p className="text-sm font-medium text-slate-600 mb-4">{calculations.costBreakdown}</p>
                                        <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-4">
                                            <span className="font-semibold text-slate-500">סה"כ לתשלום:</span>
                                            <span className="font-bold text-[#FF4D7F] text-xl">{formatMoney(calculations.venueCost)}</span>
                                        </div>

                                        {/* Venue Payment Schedule Breakdown */}
                                        <div className="space-y-3 text-sm pt-2">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">פריסת תשלומים</p>
                                            <div className="flex justify-between text-slate-600 items-center">
                                                <span className="font-medium">מקדמה 1 (חתימה):</span>
                                                <span className="font-bold">{formatMoney(calculations.venueAdvance1)}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-600 items-center">
                                                <span className="font-medium">מקדמה 2 (חודש לפני):</span>
                                                <span className="font-bold">{formatMoney(calculations.venueAdvance2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 p-5 rounded-2xl mt-auto">
                                    <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">יתרה מאוחרת (ביום האירוע)</p>
                                    <div className="flex justify-between items-end">
                                        <span className="text-3xl font-bold text-[#FF4D7F]">{formatMoney(calculations.remainingToPay)}</span>
                                        <span className="text-xs text-slate-500 font-medium pb-1.5">מהמעטפות / כיס משותף</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* TAB CONTENT: INCOME & GUESTS */}
                    {activeTab === 'income' && (
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
                                                <p className="text-xs text-[#FF4D7F] font-medium tracking-wide mt-1">משלימים את יתרת עלות האולם</p>
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

                        </motion.div>
                    )}

                    {/* TAB CONTENT: EXPENSES */}
                    {activeTab === 'expenses' && (
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
                                                        <div className="col-span-1 flex justify-end">
                                                            <button onClick={() => removeExpense(expense.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                                                                <Trash2 size={18} strokeWidth={1.5} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <AnimatePresence>
                                                        {expense.paid && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3 overflow-hidden bg-[#F8F8F8] rounded-b-xl -mx-3.5 -mb-3.5 px-4 pb-4 mt-2"
                                                            >
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
                    {/* TAB CONTENT: SMART MANAGEMENT */}
                    {activeTab === 'smart' && (
                        <motion.div
                            key="smart"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >

                            {/* Scenario Comparison */}
                            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white md:col-span-2">
                                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-[#1F1A1A] tracking-tight">
                                    <div className="bg-[#FFDEDE] text-[#FF4D7F] p-2.5 rounded-2xl">
                                        <BarChart3 size={24} strokeWidth={1.5} />
                                    </div>
                                    השוואת תרחישים
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {calculations.scenarios.map((s, i) => (
                                        <div key={i} className={`rounded-3xl p-6 border relative overflow-hidden ${s.color === 'rose' ? 'bg-rose-50/50 border-rose-200' :
                                            s.color === 'pink' ? 'bg-[#FFE5ED]/50 border-[#FFDEDE] ring-2 ring-[#FFDEDE]' :
                                                'bg-emerald-50/50 border-emerald-200'
                                            }`}>
                                            {s.color === 'pink' && <div className="absolute top-2 left-2 bg-[#FF4D7F] text-white text-xs font-medium px-2 py-0.5 rounded-full">נוכחי</div>}
                                            <p className={`text-sm font-medium uppercase tracking-widest mb-4 ${s.color === 'rose' ? 'text-rose-600' : s.color === 'pink' ? 'text-[#FF4D7F]' : 'text-emerald-600'
                                                }`}>{s.label}</p>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between"><span className="text-slate-600">ממוצע מתנה:</span><span className="font-semibold">{formatMoney(s.avgGift)}</span></div>
                                                <div className="flex justify-between"><span className="text-slate-600">אי-הגעה:</span><span className="font-semibold">{s.noShow}%</span></div>
                                                <div className="flex justify-between"><span className="text-slate-600">מגיעים:</span><span className="font-semibold">{s.guests}</span></div>
                                                <div className="flex justify-between"><span className="text-slate-600">הכנסה כוללת:</span><span className="font-semibold">{formatMoney(s.income)}</span></div>
                                                <div className={`flex justify-between pt-3 border-t ${s.balance >= 0 ? 'border-emerald-200' : 'border-rose-200'}`}>
                                                    <span className="font-medium">שורה תחתונה:</span>
                                                    <span className={`font-semibold text-lg ${s.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                        {s.balance > 0 ? '+' : ''}{formatMoney(s.balance)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Savings Tracker */}
                            <div className="bg-gradient-to-br from-slate-900 via-[#2a0a14] to-slate-900 rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.15)] text-white border border-white/10 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-48 h-48 bg-[#FF4D7F]/10 blur-[60px] rounded-full pointer-events-none"></div>
                                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 tracking-tight relative z-10">
                                    <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-sm">
                                        <Banknote className="text-[#FFDEDE]" size={24} strokeWidth={1.5} />
                                    </div>
                                    מעקב חיסכון חודשי
                                </h2>
                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="font-medium text-[#FFE5ED]">כמה אתם חוסכים בחודש?</label>
                                            <input
                                                type="number"
                                                value={monthlySaving}
                                                onChange={(e) => setMonthlySaving(Number(e.target.value))}
                                                onBlur={(e) => updateConfig('monthly_saving', Number(e.target.value))}
                                                className="w-28 px-3 py-2 text-xl font-semibold text-[#FF4D7F] bg-white/10 border border-white/20 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-[#FF4D7F] backdrop-blur-sm"
                                            />
                                        </div>
                                        <input
                                            type="range" min="0" max="15000" step="500"
                                            value={monthlySaving}
                                            onChange={(e) => setMonthlySaving(Number(e.target.value))}
                                            onMouseUp={(e) => updateConfig('monthly_saving', Number((e.target as HTMLInputElement).value))}
                                            className="w-full h-2.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#FF4D7F]"
                                        />
                                    </div>
                                    <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 space-y-3">
                                        <div className="flex justify-between text-[#FFE5ED]"><span>חודשים שנותרו:</span><span className="font-semibold text-white">{monthsLeft}</span></div>
                                        <div className="flex justify-between text-[#FFE5ED]"><span>סה"כ חיסכון עד החתונה:</span><span className="font-semibold text-[#FF4D7F] text-xl">{formatMoney(totalSavingsByWedding)}</span></div>
                                        <div className="flex justify-between text-[#FFE5ED]"><span>מקדמות שנדרשות:</span><span className="font-semibold text-[#FFDEDE]">{formatMoney(savingsNeeded)}</span></div>
                                        <div className="h-4 w-full bg-white/10 rounded-full overflow-hidden mt-2">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${savingsProgress}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className={`h-full rounded-full ${savingsProgress >= 100 ? 'bg-pink-400' : 'bg-slate-400'}`}
                                            />
                                        </div>
                                        <p className="text-xs text-[#FFDEDE] text-center mt-1">
                                            {savingsProgress >= 100 ? '🎉 מכוסה לחלוטין!' : `${savingsProgress.toFixed(0)}% מכוסה — צריך עוד ${formatMoney(Math.max(0, savingsNeeded - totalSavingsByWedding))}`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Expense Breakdown Donut */}
                            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-[#1F1A1A] tracking-tight">
                                    <div className="bg-[#FFDEDE] text-[#FF4D7F] p-2.5 rounded-2xl">
                                        <PieChart size={24} strokeWidth={1.5} />
                                    </div>
                                    פילוח הוצאות
                                </h2>
                                <div className="flex flex-col items-center gap-6">
                                    {/* SVG Donut */}
                                    <svg viewBox="0 0 120 120" className="w-48 h-48">
                                        {(() => {
                                            const total = calculations.expenseCategories.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
                                            let offset = 0;
                                            return calculations.expenseCategories.filter(c => c.amount > 0).map((cat, i) => {
                                                const pct = total > 0 ? (cat.amount / total) * 100 : 0;
                                                const dashArray = `${pct * 2.83} ${283 - pct * 2.83}`;
                                                const dashOffset = -offset * 2.83;
                                                offset += pct;
                                                return (
                                                    <circle key={i} cx="60" cy="60" r="45" fill="none"
                                                        stroke={cat.color} strokeWidth="18"
                                                        strokeDasharray={dashArray}
                                                        strokeDashoffset={dashOffset}
                                                        className="transition-all duration-500"
                                                        style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
                                                    />
                                                );
                                            });
                                        })()}
                                        <text x="60" y="56" textAnchor="middle" className="text-[10px] font-semibold fill-slate-900">{formatMoney(calculations.totalExpenses)}</text>
                                        <text x="60" y="70" textAnchor="middle" className="text-[6px] font-medium fill-slate-500">סה"כ הוצאות</text>
                                    </svg>
                                    {/* Legend */}
                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        {calculations.expenseCategories.filter(c => c.amount > 0).map((cat, i) => {
                                            const total = calculations.expenseCategories.reduce((s, c) => s + c.amount, 0);
                                            const pct = total > 0 ? ((cat.amount / total) * 100).toFixed(1) : '0';
                                            return (
                                                <div key={i} className="flex items-center gap-2 text-sm">
                                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                                    <span className="text-slate-700 font-medium truncate">{cat.name}</span>
                                                    <span className="text-slate-400 mr-auto">{pct}%</span>
                                                    <span className="font-semibold text-[#333333]">{formatMoney(cat.amount)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Wedding Checklist */}
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
                                            <div className="flex items-center gap-2 mb-3">
                                                <Clock size={14} className="text-slate-400" strokeWidth={1.5} />
                                                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">{category}</p>
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
                                                            <span className={`font-medium ${item.isDone ? 'text-slate-400 line-through' :
                                                                item.isLate ? 'text-rose-900' :
                                                                    'text-[#333333]'
                                                                }`}>{item.text}</span>
                                                            {item.isLate && !item.isDone && (
                                                                <span className="text-[10px] font-semibold tracking-wider text-rose-500 uppercase mt-0.5 animate-pulse">
                                                                    ⚠ באיחור!
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); removeChecklistItem(item.id); }} className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 size={14} strokeWidth={1.5} />
                                                        </button>
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

                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}