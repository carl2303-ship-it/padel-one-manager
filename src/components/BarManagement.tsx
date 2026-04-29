import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Plus,
  X,
  Coffee,
  ShoppingBag,
  Check,
  Trash2,
  Clock,
  ChefHat,
  Edit2,
  Copy,
  BarChart3,
  User,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Minus,
  Euro,
  QrCode,
  Bell,
  ExternalLink,
  Smartphone,
  Upload,
  Image,
  Loader2,
  Star,
  Search,
  Banknote
} from 'lucide-react';
import BarMetricsDashboard from './BarMetricsDashboard';
import { compressImage } from '../lib/imageCompressor';
import { compareMenuItemsInCategory, orderMenuItemsByCategoryList } from '../lib/menuItemSort';

/** PostgREST quando a coluna ainda não existe na base (migração não aplicada). */
function isPostgrestMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === 'PGRST204') return true;
  const m = (err.message || '').toLowerCase();
  return m.includes('column') && (m.includes('schema') || m.includes('could not find'));
}

type ItemFormState = {
  category_id: string;
  name: string;
  description: string;
  price: number;
  is_available: boolean;
  is_food: boolean;
  image_url: string;
  is_highlighted: boolean;
  kitchen_slot1_start: string;
  kitchen_slot1_end: string;
  kitchen_slot2_start: string;
  kitchen_slot2_end: string;
};

/** Cozinha: cada slot precisa início e fim; se estiver incompleto, o slot fica vazio. */
function buildKitchenScheduleFromForm(itemForm: ItemFormState): {
  kitchen_slot1_start: string | null;
  kitchen_slot1_end: string | null;
  kitchen_slot2_start: string | null;
  kitchen_slot2_end: string | null;
} {
  if (!itemForm.is_food) {
    return { kitchen_slot1_start: null, kitchen_slot1_end: null, kitchen_slot2_start: null, kitchen_slot2_end: null };
  }
  const t = (s: string) => s.trim();
  const s1s = t(itemForm.kitchen_slot1_start);
  const s1e = t(itemForm.kitchen_slot1_end);
  const s2s = t(itemForm.kitchen_slot2_start);
  const s2e = t(itemForm.kitchen_slot2_end);
  const slot1 = s1s && s1e ? { start: s1s, end: s1e } : null;
  const slot2 = s2s && s2e ? { start: s2s, end: s2e } : null;
  return {
    kitchen_slot1_start: slot1 ? slot1.start : null,
    kitchen_slot1_end: slot1 ? slot1.end : null,
    kitchen_slot2_start: slot2 ? slot2.start : null,
    kitchen_slot2_end: slot2 ? slot2.end : null,
  };
}

interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  is_food: boolean;
  image_url: string | null;
  is_highlighted: boolean;
  sort_order: number;
  kitchen_slot1_start: string | null;
  kitchen_slot1_end: string | null;
  kitchen_slot2_start: string | null;
  kitchen_slot2_end: string | null;
}

// Orders are now unified in club_orders (QrOrder interface used for all)

interface BarTab {
  id: string;
  club_owner_id: string;
  player_name: string;
  player_phone: string | null;
  player_account_id: string | null;
  bar_customer_id: string | null;
  tournament_id: string | null;
  tournament_name: string | null;
  status: 'open' | 'closed';
  total: number;
  payment_status: 'pending' | 'paid';
  payment_method: 'cash' | 'card' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BarTabItem {
  id: string;
  tab_id: string;
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  created_at: string;
}

interface ClubTable {
  id: string;
  club_id: string;
  table_number: string;
  is_active: boolean;
}

interface QrOrder {
  id: string;
  club_id: string;
  club_owner_id: string | null;
  table_number: string;
  status: string;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  source: 'qr' | 'manual';
  payment_status: string;
  created_at: string;
  updated_at: string;
  items?: QrOrderItem[];
}

interface QrOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  is_food: boolean;
  notes: string | null;
  status: string;
}

interface BarManagementProps {
  staffClubOwnerId?: string | null;
  /** 'kitchen' = filtro e alertas só de comida por omissão; o utilizador pode ativar "Bar (todos)" no ecrã. */
  staffRole?: string | null;
}

const orderHasFoodItems = (order: QrOrder): boolean =>
  (order.items ?? []).some((i) => i.is_food);

const itemIsReady = (i: QrOrderItem) => i.status === 'ready';

const orderItemsProgress = (order: QrOrder) => {
  const list = order.items || [];
  const nTotal = list.length;
  if (nTotal === 0) return { nReady: 0, nTotal: 0 };
  const nReady = list.filter(itemIsReady).length;
  return { nReady, nTotal };
};

export default function BarManagement({ staffClubOwnerId, staffRole }: BarManagementProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const isKitchenRole = staffRole === 'kitchen';
  const [kitchenViewFilter, setKitchenViewFilter] = useState<'all' | 'kitchen_only'>(isKitchenRole ? 'kitchen_only' : 'all');
  const isKitchenSoloView = kitchenViewFilter === 'kitchen_only';
  const showFullBarUi = kitchenViewFilter === 'all';
  const kitchenBeepedOrderIdsRef = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'tabs' | 'orders' | 'menu' | 'qr-orders' | 'qr-codes' | 'analytics'>('tabs');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  // orders state removed - using unified qrOrders (club_orders) for everything
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bar Tabs state
  const [barTabs, setBarTabs] = useState<BarTab[]>([]);
  const [tabItems, setTabItems] = useState<Record<string, BarTabItem[]>>({});
  const [expandedTab, setExpandedTab] = useState<string | null>(null);
  const [showNewTabForm, setShowNewTabForm] = useState(false);
  const [newTabForm, setNewTabForm] = useState({ player_name: '', player_phone: '', notes: '' });
  const [phoneLookupResult, setPhoneLookupResult] = useState<{ found: boolean; name: string | null; source: string | null; discount: number } | null>(null);
  const [lookingUpPhone, setLookingUpPhone] = useState(false);
  const phoneLookupTimeout = useState<ReturnType<typeof setTimeout> | null>(null);
  const [addingItemToTab, setAddingItemToTab] = useState<string | null>(null);
  const [addItemCategoryFilter, setAddItemCategoryFilter] = useState<string>('popular');
  const [addItemSearch, setAddItemSearch] = useState('');
  const [popularItemIds, setPopularItemIds] = useState<string[]>([]);
  const [tabFilter, setTabFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [sendingToKitchen, setSendingToKitchen] = useState<string | null>(null);
  const [paymentChoiceTab, setPaymentChoiceTab] = useState<BarTab | null>(null);

  // Name lookup state (new tab form)
  const [nameLookupResults, setNameLookupResults] = useState<{ name: string; phone: string | null; source: string; discount: number }[]>([]);
  const [lookingUpName, setLookingUpName] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const nameLookupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // QR Orders & Tables state
  const [qrOrders, setQrOrders] = useState<QrOrder[]>([]);
  const [clubTables, setClubTables] = useState<ClubTable[]>([]);
  const [clubId, setClubId] = useState<string | null>(null);
  const [showTableForm, setShowTableForm] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [qrOrderFilter, setQrOrderFilter] = useState<'pending' | 'preparing' | 'all'>('pending');

  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [itemForm, setItemForm] = useState({
    category_id: '',
    name: '',
    description: '',
    price: 0,
    is_available: true,
    is_food: false,
    image_url: '',
    is_highlighted: false,
    kitchen_slot1_start: '',
    kitchen_slot1_end: '',
    kitchen_slot2_start: '',
    kitchen_slot2_end: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (effectiveUserId) {
      loadData();
    }
  }, [effectiveUserId]);

  // Cozinha: abre directamente no separador de pedidos (QR)
  useEffect(() => {
    if (isKitchenRole) setActiveTab('orders');
  }, [isKitchenRole]);

  useEffect(() => {
    if (isKitchenSoloView && activeTab !== 'orders') {
      setActiveTab('orders');
    }
  }, [isKitchenSoloView, activeTab]);

  // ---- Audio notification for new orders ----
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }, []);

  const activateSound = useCallback(async () => {
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      // Play a real (short) tone so the user confirms they hear it
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      audioUnlockedRef.current = true;
      setSoundEnabled(true);
    } catch { /* ignore */ }

    // Also request Notification permission (for background tab alerts)
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch { /* ignore */ }
  }, [ensureAudioCtx]);

  const playOrderBeep = useCallback((context: 'kitchen' | 'bar' = 'bar') => {
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const tones = [
        { freq: 880, start: 0, end: 0.15 },
        { freq: 1100, start: 0.18, end: 0.33 },
        { freq: 1320, start: 0.36, end: 0.55 },
      ];
      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = tone.freq;
        gain.gain.setValueAtTime(0.7, ctx.currentTime + tone.start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + tone.end);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + tone.start);
        osc.stop(ctx.currentTime + tone.end);
      }

      // Repeat after 2s
      setTimeout(() => {
        try {
          const ctx2 = audioCtxRef.current;
          if (!ctx2) return;
          for (const tone of tones) {
            const osc = ctx2.createOscillator();
            const gain = ctx2.createGain();
            osc.type = 'sine';
            osc.frequency.value = tone.freq;
            gain.gain.setValueAtTime(0.7, ctx2.currentTime + tone.start);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + tone.end);
            osc.connect(gain).connect(ctx2.destination);
            osc.start(ctx2.currentTime + tone.start);
            osc.stop(ctx2.currentTime + tone.end);
          }
        } catch { /* ignore */ }
      }, 2000);

      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          const isKitchen = context === 'kitchen';
          new Notification(isKitchen ? 'Cozinha — novo pedido' : 'Bar — novo pedido', {
            body: isKitchen
              ? 'Há artigos de cozinha num novo pedido'
              : 'Chegou um novo pedido',
            icon: '/favicon.ico',
            tag: 'new-order',
            requireInteraction: true
          });
        }
      } catch { /* ignore */ }
    } catch {
      // Audio API unavailable — silent fallback
    }
  }, [ensureAudioCtx]);

  const reloadOrders = useCallback(async () => {
    if (!effectiveUserId) return;
    const { data: allOrdersData } = await supabase
      .from('club_orders')
      .select('*')
      .or(`club_owner_id.eq.${effectiveUserId},club_id.eq.${clubId || '00000000-0000-0000-0000-000000000000'}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (allOrdersData) {
      const ordersWithItems = await Promise.all(
        allOrdersData.map(async (order) => {
          const { data: items } = await supabase
            .from('club_order_items')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at');
          return { ...order, items: items || [] };
        })
      );
      setQrOrders(ordersWithItems);
    }
  }, [effectiveUserId, clubId]);

  const reloadTabs = useCallback(async () => {
    if (!effectiveUserId) return;
    const { data: tabsData } = await supabase
      .from('bar_tabs')
      .select('*')
      .eq('club_owner_id', effectiveUserId)
      .order('created_at', { ascending: false });

    if (tabsData) {
      setBarTabs(tabsData);
      const openTabIds = tabsData.filter(t => t.status === 'open').map(t => t.id);
      if (openTabIds.length > 0) {
        const { data: allItems } = await supabase
          .from('bar_tab_items')
          .select('*')
          .in('tab_id', openTabIds)
          .order('created_at', { ascending: true });
        if (allItems) {
          const grouped: Record<string, BarTabItem[]> = {};
          allItems.forEach(item => {
            if (!grouped[item.tab_id]) grouped[item.tab_id] = [];
            grouped[item.tab_id].push(item);
          });
          setTabItems(grouped);
        }
      }
    }
  }, [effectiveUserId]);

  // Real-time subscription for new/updated orders (QR + manual)
  // Kitchen: beep on food line items (order is created before lines); bar/owner: beep on new order.
  useEffect(() => {
    if (!clubId && !effectiveUserId) return;

    const isOurs = (row: { club_id?: string; club_owner_id?: string | null }) =>
      (clubId && row?.club_id === clubId) || row?.club_owner_id === effectiveUserId;

    const channel = supabase
      .channel('bar-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'club_orders' },
        async (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as { id?: string; club_id?: string; club_owner_id?: string | null };
          if (!isOurs(row)) return;
          await reloadOrders();
          if (!isKitchenSoloView) {
            playOrderBeep('bar');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'club_order_items' },
        async (payload: { new: Record<string, unknown> }) => {
          if (!isKitchenSoloView) return;
          const row = payload.new as { order_id?: string; is_food?: boolean };
          if (!row?.is_food || !row.order_id) return;
          const { data: order } = await supabase
            .from('club_orders')
            .select('id, club_id, club_owner_id')
            .eq('id', row.order_id)
            .maybeSingle();
          if (!order || !isOurs(order)) return;
          if (kitchenBeepedOrderIdsRef.current.has(row.order_id)) return;
          kitchenBeepedOrderIdsRef.current.add(row.order_id);
          setTimeout(() => kitchenBeepedOrderIdsRef.current.delete(row.order_id), 8000);
          playOrderBeep('kitchen');
          await reloadOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'club_orders' },
        async (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as { club_id?: string; club_owner_id?: string | null };
          if (isOurs(row)) await reloadOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'club_order_items' },
        async () => { await reloadOrders(); }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'club_orders' },
        async () => { await reloadOrders(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, effectiveUserId, isKitchenSoloView, playOrderBeep, reloadOrders]);

  // Auto-refresh when the tab/window regains focus
  const lastForegroundRefresh = useRef(Date.now());
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastForegroundRefresh.current;
        if (elapsed > 15_000 && effectiveUserId) {
          lastForegroundRefresh.current = Date.now();
          console.log('[Bar] Foreground refresh triggered');
          void reloadOrders();
          void reloadTabs();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [effectiveUserId, clubId, reloadOrders, reloadTabs]);

  const loadData = async () => {
    if (!effectiveUserId) return;

    // Get club ID for QR features
    const { data: clubData } = await supabase
      .from('clubs')
      .select('id')
      .eq('owner_id', effectiveUserId)
      .limit(1)
      .maybeSingle();
    
    if (clubData) {
      setClubId(clubData.id);

      // Load tables
      const { data: tablesData } = await supabase
        .from('club_tables')
        .select('*')
        .eq('club_id', clubData.id)
        .order('table_number');
      
      if (tablesData) setClubTables(tablesData);
    }

    // Load ALL orders from unified club_orders table (both manual and QR)
    const { data: allOrdersData } = await supabase
      .from('club_orders')
      .select('*')
      .or(`club_owner_id.eq.${effectiveUserId},club_id.eq.${clubData?.id || '00000000-0000-0000-0000-000000000000'}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (allOrdersData) {
      // Load items for each order
      const ordersWithItems = await Promise.all(
        allOrdersData.map(async (order) => {
          const { data: items } = await supabase
            .from('club_order_items')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at');
          return { ...order, items: items || [] };
        })
      );
      setQrOrders(ordersWithItems);
    }

    const [categoriesResult, itemsResult, tabsResult] = await Promise.all([
      supabase
        .from('menu_categories')
        .select('*')
        .eq('club_owner_id', effectiveUserId)
        .order('sort_order'),
      supabase
        .from('menu_items')
        .select('*')
        .eq('club_owner_id', effectiveUserId)
        .order('sort_order')
        .order('name'),
      supabase
        .from('bar_tabs')
        .select('*')
        .eq('club_owner_id', effectiveUserId)
        .order('created_at', { ascending: false })
    ]);

    if (categoriesResult.data) setCategories(categoriesResult.data);
    if (itemsResult.data && categoriesResult.data) {
      setMenuItems(orderMenuItemsByCategoryList(categoriesResult.data, itemsResult.data));
    } else if (itemsResult.data) {
      setMenuItems(itemsResult.data);
    }
    if (tabsResult.data) {
      setBarTabs(tabsResult.data);
      // Load items for all open tabs
      const openTabIds = tabsResult.data.filter(t => t.status === 'open').map(t => t.id);
      if (openTabIds.length > 0) {
        const { data: allItems } = await supabase
          .from('bar_tab_items')
          .select('*')
          .in('tab_id', openTabIds)
          .order('created_at', { ascending: true });
        if (allItems) {
          const grouped: Record<string, BarTabItem[]> = {};
          allItems.forEach(item => {
            if (!grouped[item.tab_id]) grouped[item.tab_id] = [];
            grouped[item.tab_id].push(item);
          });
          setTabItems(grouped);
        }
      }
    }
    setLoading(false);
  };

  const loadTabItems = async (tabId: string) => {
    const { data } = await supabase
      .from('bar_tab_items')
      .select('*')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: true });
    if (data) {
      setTabItems(prev => ({ ...prev, [tabId]: data }));
    }
  };

  const loadPopularItems = useCallback(async () => {
    if (!effectiveUserId) return;
    const menuItemIds = menuItems.map(m => m.id);
    if (menuItemIds.length === 0) return;
    const { data } = await supabase
      .from('bar_tab_items')
      .select('menu_item_id, quantity')
      .in('menu_item_id', menuItemIds);
    if (data && data.length > 0) {
      const counts = new Map<string, number>();
      data.forEach(row => {
        counts.set(row.menu_item_id, (counts.get(row.menu_item_id) || 0) + row.quantity);
      });
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
      setPopularItemIds(sorted);
    }
  }, [effectiveUserId, menuItems]);

  useEffect(() => { loadPopularItems(); }, [loadPopularItems]);

  // ---- Tab Management Functions ----

  // Helper function to normalize phone numbers
  const normalizePhone = (phone: string | null): string => {
    if (!phone) return '';
    return phone.replace(/\s+/g, '').trim();
  };

  // Helper function to get member bar discount
  const getMemberBarDiscount = async (playerPhone: string | null, playerAccountId: string | null): Promise<number> => {
    if (!effectiveUserId) return 0;
    
    // Try by player_account_id first
    if (playerAccountId) {
      const { data: subscription } = await supabase
        .from('member_subscriptions')
        .select('plan:membership_plans(bar_discount_percent)')
        .eq('club_owner_id', effectiveUserId)
        .eq('player_account_id', playerAccountId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0])
        .maybeSingle();
      
      if (subscription?.plan) {
        return (subscription.plan as any).bar_discount_percent || 0;
      }
    }
    
    // Try by phone number
    if (playerPhone) {
      const normalizedPhone = normalizePhone(playerPhone);
      const { data: subscription } = await supabase
        .from('member_subscriptions')
        .select('plan:membership_plans(bar_discount_percent)')
        .eq('club_owner_id', effectiveUserId)
        .eq('member_phone', normalizedPhone)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0])
        .maybeSingle();
      
      if (subscription?.plan) {
        return (subscription.plan as any).bar_discount_percent || 0;
      }
    }
    
    return 0;
  };

  // Look up player/member by phone number
  const handlePhoneLookup = async (phone: string) => {
    if (!effectiveUserId || phone.length < 6) {
      setPhoneLookupResult(null);
      return;
    }

    setLookingUpPhone(true);
    const normalizedPhone = normalizePhone(phone);

    try {
      // 1. Look up in player_accounts
      const { data: playerAccount } = await supabase
        .from('player_accounts')
        .select('id, name, phone_number')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      // 2. Look up in member_subscriptions (club members)
      const { data: memberSub } = await supabase
        .from('member_subscriptions')
        .select('member_name, member_phone, status, plan:membership_plans(name, bar_discount_percent)')
        .eq('club_owner_id', effectiveUserId)
        .eq('member_phone', normalizedPhone)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0])
        .maybeSingle();

      if (memberSub) {
        const discount = (memberSub.plan as any)?.bar_discount_percent || 0;
        const planName = (memberSub.plan as any)?.name || '';
        setPhoneLookupResult({
          found: true,
          name: memberSub.member_name,
          source: `Membro do clube — ${planName}`,
          discount
        });
        // Auto-fill name if empty
        if (!newTabForm.player_name.trim() && memberSub.member_name) {
          setNewTabForm(prev => ({ ...prev, player_name: memberSub.member_name }));
        }
      } else if (playerAccount) {
        const discount = await getMemberBarDiscount(normalizedPhone, playerAccount.id);
        setPhoneLookupResult({
          found: true,
          name: playerAccount.name,
          source: 'Jogador registado',
          discount
        });
        if (!newTabForm.player_name.trim() && playerAccount.name) {
          setNewTabForm(prev => ({ ...prev, player_name: playerAccount.name }));
        }
      } else {
        const { data: barCustomer } = await supabase
          .from('bar_customers')
          .select('id, name, phone_number, visit_count')
          .eq('club_owner_id', effectiveUserId)
          .eq('phone_number', normalizedPhone)
          .maybeSingle();

        if (barCustomer) {
          setPhoneLookupResult({
            found: true,
            name: barCustomer.name,
            source: `Cliente do bar (${barCustomer.visit_count || 1} visita${(barCustomer.visit_count || 1) > 1 ? 's' : ''})`,
            discount: 0
          });
          if (!newTabForm.player_name.trim() && barCustomer.name) {
            setNewTabForm(prev => ({ ...prev, player_name: barCustomer.name }));
          }
        } else {
          setPhoneLookupResult({ found: false, name: null, source: null, discount: 0 });
        }
      }
    } catch (err) {
      console.error('Phone lookup error:', err);
      setPhoneLookupResult(null);
    }

    setLookingUpPhone(false);
  };

  // Debounced phone lookup on input change
  const handlePhoneChange = (phone: string) => {
    setNewTabForm(prev => ({ ...prev, player_phone: phone }));
    setPhoneLookupResult(null);

    // Clear previous timeout
    if (phoneLookupTimeout[0]) clearTimeout(phoneLookupTimeout[0]);

    if (phone.length >= 6) {
      const timeout = setTimeout(() => handlePhoneLookup(phone), 500);
      phoneLookupTimeout[0] = timeout;
    }
  };

  const handleNameLookup = async (name: string) => {
    if (!effectiveUserId || name.length < 2) {
      setNameLookupResults([]);
      setShowNameSuggestions(false);
      return;
    }

    setLookingUpName(true);
    try {
      const pattern = `%${name}%`;
      const results: { name: string; phone: string | null; source: string; discount: number }[] = [];
      const seen = new Set<string>();

      const { data: members } = await supabase
        .from('member_subscriptions')
        .select('member_name, member_phone, status, plan:membership_plans(name, bar_discount_percent)')
        .eq('club_owner_id', effectiveUserId)
        .ilike('member_name', pattern)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0])
        .limit(10);

      if (members) {
        for (const m of members) {
          const key = `${m.member_name}|${m.member_phone || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const discount = (m.plan as any)?.bar_discount_percent || 0;
          const planName = (m.plan as any)?.name || '';
          results.push({
            name: m.member_name,
            phone: m.member_phone || null,
            source: `Membro — ${planName}`,
            discount
          });
        }
      }

      const { data: players } = await supabase
        .from('player_accounts')
        .select('id, name, phone_number')
        .ilike('name', pattern)
        .limit(10);

      if (players) {
        for (const p of players) {
          const key = `${p.name}|${p.phone_number || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const discount = await getMemberBarDiscount(p.phone_number, p.id);
          results.push({
            name: p.name,
            phone: p.phone_number || null,
            source: discount > 0 ? 'Jogador (membro)' : 'Jogador registado',
            discount
          });
        }
      }

      const { data: barCustomers } = await supabase
        .from('bar_customers')
        .select('id, name, phone_number, visit_count')
        .eq('club_owner_id', effectiveUserId)
        .ilike('name', pattern)
        .limit(10);

      if (barCustomers) {
        for (const bc of barCustomers) {
          const key = `${bc.name}|${bc.phone_number || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({
            name: bc.name,
            phone: bc.phone_number || null,
            source: `Cliente do bar (${bc.visit_count || 1} visita${(bc.visit_count || 1) > 1 ? 's' : ''})`,
            discount: 0
          });
        }
      }

      setNameLookupResults(results);
      setShowNameSuggestions(results.length > 0);
    } catch (err) {
      console.error('Name lookup error:', err);
      setNameLookupResults([]);
    }
    setLookingUpName(false);
  };

  const handleNameChange = (name: string) => {
    setNewTabForm(prev => ({ ...prev, player_name: name }));
    setShowNameSuggestions(false);
    if (nameLookupTimeout.current) clearTimeout(nameLookupTimeout.current);
    if (name.length >= 2) {
      nameLookupTimeout.current = setTimeout(() => handleNameLookup(name), 500);
    } else {
      setNameLookupResults([]);
    }
  };

  const handleSelectNameSuggestion = (suggestion: { name: string; phone: string | null; source: string; discount: number }) => {
    setNewTabForm(prev => ({
      ...prev,
      player_name: suggestion.name,
      player_phone: suggestion.phone || prev.player_phone
    }));
    setPhoneLookupResult({
      found: true,
      name: suggestion.name,
      source: suggestion.source,
      discount: suggestion.discount
    });
    setShowNameSuggestions(false);
    setNameLookupResults([]);
  };

  const handleSendToKitchen = async (tab: BarTab) => {
    if (!effectiveUserId || !clubId) return;
    const items = tabItems[tab.id] || [];
    const foodItems = items.filter(item => {
      const mi = menuItems.find(m => m.id === item.menu_item_id);
      return mi?.is_food;
    });
    if (foodItems.length === 0) return;

    setSendingToKitchen(tab.id);
    try {
      const foodTotal = foodItems.reduce((sum, item) => sum + item.total_price, 0);

      const { data: orderData, error: orderError } = await supabase
        .from('club_orders')
        .insert({
          club_id: clubId,
          club_owner_id: effectiveUserId,
          table_number: 'Balcão',
          customer_name: tab.player_name,
          customer_phone: tab.player_phone || null,
          total: foodTotal,
          status: 'pending',
          source: 'manual' as const,
          payment_status: 'pending',
          notes: `Conta: ${tab.player_name}`
        })
        .select('id')
        .single();

      if (orderError || !orderData) {
        console.error('Error creating kitchen order:', orderError);
        alert('Erro ao criar pedido para a cozinha.');
        setSendingToKitchen(null);
        return;
      }

      const orderItems = foodItems.map(item => ({
        order_id: orderData.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        is_food: true,
        notes: null as string | null,
        status: 'pending'
      }));

      const { error: itemsError } = await supabase
        .from('club_order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        alert('Erro ao criar items do pedido.');
        setSendingToKitchen(null);
        return;
      }

      await reloadOrders();
      alert(`Pedido enviado para a cozinha! (${foodItems.length} item(s) de comida)`);
    } catch (err) {
      console.error('Send to kitchen error:', err);
      alert('Erro ao enviar pedido para a cozinha.');
    }
    setSendingToKitchen(null);
  };

  const handleCreateTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId || !newTabForm.player_name.trim()) return;
    setSaving(true);

    let playerAccountId: string | null = null;
    let barCustomerId: string | null = null;
    if (newTabForm.player_phone) {
      const normalizedPhone = normalizePhone(newTabForm.player_phone);
      const { data: existingPlayer } = await supabase
        .from('player_accounts')
        .select('id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();
      
      if (existingPlayer) {
        playerAccountId = existingPlayer.id;
      } else {
        const { data: existingBarCustomer } = await supabase
          .from('bar_customers')
          .select('id')
          .eq('club_owner_id', effectiveUserId)
          .eq('phone_number', normalizedPhone)
          .maybeSingle();
        barCustomerId = existingBarCustomer?.id || null;
      }
    }

    const { error } = await supabase.from('bar_tabs').insert({
      club_owner_id: effectiveUserId,
      player_name: newTabForm.player_name.trim(),
      player_phone: newTabForm.player_phone.trim() || null,
      player_account_id: playerAccountId,
      bar_customer_id: barCustomerId,
      notes: newTabForm.notes.trim() || null
    });

    if (!error) {
      setShowNewTabForm(false);
      setNewTabForm({ player_name: '', player_phone: '', notes: '' });
      await loadData();
    }
    setSaving(false);
  };

  const handleDeleteTab = async (tabId: string) => {
    if (!confirm(t.bar.confirmDeleteTab)) return;
    await supabase.from('player_transactions')
      .delete()
      .eq('reference_id', tabId)
      .eq('reference_type', 'bar_tab');
    await supabase.from('bar_tabs').delete().eq('id', tabId);
    await loadData();
  };

  const handleDeleteEmptyOpenTabs = async () => {
    // Contas abertas sem itens
    const openTabs = barTabs.filter(t => t.status === 'open');
    const emptyTabs = openTabs.filter(t => {
      const items = tabItems[t.id] || [];
      return items.length === 0 && t.total === 0;
    });

    if (emptyTabs.length === 0) {
      alert('Não existem contas abertas sem despesas.');
      return;
    }

    if (!confirm(`Eliminar ${emptyTabs.length} conta${emptyTabs.length > 1 ? 's' : ''} aberta${emptyTabs.length > 1 ? 's' : ''} sem despesas?`)) return;

    for (const tab of emptyTabs) {
      await supabase.from('bar_tabs').delete().eq('id', tab.id);
    }
    await loadData();
  };

  const handleCloseTab = async (tabId: string) => {
    if (!confirm(t.bar.confirmCloseTab)) return;
    await supabase
      .from('bar_tabs')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', tabId);
    await loadData();
  };

  const handleReopenTab = async (tabId: string) => {
    await supabase
      .from('bar_tabs')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', tabId);
    await loadData();
  };

  const handleToggleTabPayment = async (tab: BarTab, paymentMethod?: 'cash' | 'card') => {
    if (!effectiveUserId) return;
    const newStatus = tab.payment_status === 'paid' ? 'pending' : 'paid';

    if (newStatus === 'paid' && !paymentMethod) {
      setPaymentChoiceTab(tab);
      return;
    }

    await supabase
      .from('bar_tabs')
      .update({
        payment_status: newStatus,
        payment_method: newStatus === 'paid' ? (paymentMethod || null) : null,
        status: newStatus === 'paid' ? 'closed' : tab.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', tab.id);

    if (newStatus === 'paid' && tab.total > 0) {
      let playerAccountId: string | null = tab.player_account_id || null;

      if (!playerAccountId && tab.player_phone && effectiveUserId) {
        const normalizedPhone = tab.player_phone.replace(/\s+/g, '');

        const { data: existingPlayer } = await supabase
          .from('player_accounts')
          .select('id')
          .eq('phone_number', normalizedPhone)
          .maybeSingle();

        if (existingPlayer) {
          playerAccountId = existingPlayer.id;
        } else {
          const { data: existingBarCustomer } = await supabase
            .from('bar_customers')
            .select('id, visit_count, total_spent')
            .eq('club_owner_id', effectiveUserId)
            .eq('phone_number', normalizedPhone)
            .maybeSingle();

          if (existingBarCustomer) {
            await supabase.from('bar_customers').update({
              visit_count: (existingBarCustomer.visit_count || 0) + 1,
              total_spent: (Number(existingBarCustomer.total_spent) || 0) + tab.total,
              last_visit_at: new Date().toISOString()
            }).eq('id', existingBarCustomer.id);
          } else {
            await supabase.from('bar_customers').insert({
              club_owner_id: effectiveUserId,
              name: tab.player_name,
              phone_number: normalizedPhone,
              total_spent: tab.total,
              visit_count: 1
            });
          }
        }
      }

      const txData: Record<string, unknown> = {
        club_owner_id: effectiveUserId,
        player_name: tab.player_name,
        player_phone: tab.player_phone || '',
        transaction_type: 'bar',
        amount: tab.total,
        reference_id: tab.id,
        reference_type: 'bar_tab',
        notes: `Bar: Conta${tab.tournament_name ? ' - ' + tab.tournament_name : ''}${paymentMethod ? ` (${paymentMethod === 'cash' ? 'Dinheiro' : 'Cartão'})` : ''}`
      };
      if (playerAccountId) txData.player_account_id = playerAccountId;

      await supabase.from('player_transactions').insert(txData);
    } else if (newStatus === 'pending') {
      await supabase
        .from('player_transactions')
        .delete()
        .eq('reference_id', tab.id)
        .eq('reference_type', 'bar_tab');
    }

    setPaymentChoiceTab(null);
    await loadData();
  };

  const handleAddItemToTab = async (tabId: string, menuItem: MenuItem) => {
    // Get the tab to check for member discount
    const tab = barTabs.find(t => t.id === tabId);
    if (!tab) return;

    // Get member discount
    const discountPercent = await getMemberBarDiscount(tab.player_phone, tab.player_account_id);
    const discountedPrice = discountPercent > 0 
      ? menuItem.price * (1 - discountPercent / 100)
      : menuItem.price;

    // Check if item already exists in tab
    const existingItems = tabItems[tabId] || [];
    const existingItem = existingItems.find(i => i.menu_item_id === menuItem.id);

    if (existingItem) {
      // Increment quantity (keep existing unit_price with discount)
      const newQty = existingItem.quantity + 1;
      await supabase
        .from('bar_tab_items')
        .update({
          quantity: newQty,
          total_price: newQty * existingItem.unit_price
        })
        .eq('id', existingItem.id);
    } else {
      // Add new item with discounted price
      await supabase.from('bar_tab_items').insert({
        tab_id: tabId,
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        quantity: 1,
        unit_price: discountedPrice,
        total_price: discountedPrice
      });
    }

    // Recalculate total
    await recalculateTabTotal(tabId);
    await loadTabItems(tabId);
  };

  const handleUpdateItemQuantity = async (tabId: string, itemId: string, delta: number) => {
    const items = tabItems[tabId] || [];
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await supabase.from('bar_tab_items').delete().eq('id', itemId);
    } else {
      await supabase
        .from('bar_tab_items')
        .update({
          quantity: newQty,
          total_price: newQty * item.unit_price
        })
        .eq('id', itemId);
    }

    await recalculateTabTotal(tabId);
    await loadTabItems(tabId);
  };

  const handleRemoveItemFromTab = async (tabId: string, itemId: string) => {
    await supabase.from('bar_tab_items').delete().eq('id', itemId);
    await recalculateTabTotal(tabId);
    await loadTabItems(tabId);
  };

  const recalculateTabTotal = async (tabId: string) => {
    const { data: items } = await supabase
      .from('bar_tab_items')
      .select('total_price')
      .eq('tab_id', tabId);

    const total = items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;

    await supabase
      .from('bar_tabs')
      .update({ total, updated_at: new Date().toISOString() })
      .eq('id', tabId);

    setBarTabs(prev => prev.map(t => t.id === tabId ? { ...t, total } : t));
  };

  // ---- QR Tables & Orders Functions ----

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubId || !newTableNumber.trim()) return;
    setSaving(true);

    const { error } = await supabase.from('club_tables').insert({
      club_id: clubId,
      table_number: newTableNumber.trim()
    });

    if (error) {
      alert(error.message.includes('duplicate') ? 'Esta mesa já existe!' : `Erro: ${error.message}`);
    } else {
      setShowTableForm(false);
      setNewTableNumber('');
      loadData();
    }
    setSaving(false);
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Eliminar esta mesa?')) return;
    await supabase.from('club_tables').delete().eq('id', tableId);
    loadData();
  };

  const syncOrderStatusFromItems = async (orderId: string) => {
    const { data: orderRow } = await supabase
      .from('club_orders')
      .select('status')
      .eq('id', orderId)
      .single();
    if (!orderRow) return;
    if (['delivered', 'cancelled', 'pending'].includes(orderRow.status)) return;

    const { data: itemRows } = await supabase
      .from('club_order_items')
      .select('status')
      .eq('order_id', orderId);
    if (!itemRows?.length) return;

    const allReady = itemRows.every((row) => row.status === 'ready');
    const next = allReady ? 'ready' : 'preparing';
    if (orderRow.status !== next) {
      await supabase
        .from('club_orders')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', orderId);
    }
  };

  const handleUpdateQrOrderStatus = async (orderId: string, status: string) => {
    const order = qrOrders.find(o => o.id === orderId);

    await supabase
      .from('club_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    // When accepting a QR order, auto-create or add to bar tab for that table
    if (status === 'preparing' && order && effectiveUserId) {
      try {
        // Check if there's an open tab for this table + customer combination
        const tableLabel = order.table_number === 'Balcão' ? '🏪 Balcão' : `Mesa ${order.table_number}`;
        const tabName = order.customer_name ? `${order.customer_name} — ${tableLabel}` : tableLabel;
        const customerPhone = order.customer_phone || null;

        // Look up member discount if phone is provided
        let playerAccountId: string | null = null;
        let discountPercent = 0;

        if (customerPhone) {
          const normalizedPhone = normalizePhone(customerPhone);
          // Find player account by phone
          const { data: playerAccount } = await supabase
            .from('player_accounts')
            .select('id')
            .eq('phone_number', normalizedPhone)
            .maybeSingle();

          if (playerAccount) {
            playerAccountId = playerAccount.id;
          }

          // Check for membership discount
          discountPercent = await getMemberBarDiscount(customerPhone, playerAccountId);
        }
        
        const { data: existingTab } = await supabase
          .from('bar_tabs')
          .select('id')
          .eq('club_owner_id', effectiveUserId)
          .eq('player_name', tabName)
          .eq('status', 'open')
          .maybeSingle();

        let tabId: string;

        if (existingTab) {
          tabId = existingTab.id;
        } else {
          // Create a new open tab for this table + customer
          const tabInsertData: Record<string, unknown> = {
            club_owner_id: effectiveUserId,
            player_name: tabName,
            player_phone: customerPhone,
            notes: discountPercent > 0 
              ? `📱 QR — ${tableLabel} | 🏷️ Membro -${discountPercent}%`
              : `📱 QR — ${tableLabel}`,
          };
          if (playerAccountId) tabInsertData.player_account_id = playerAccountId;

          const { data: newTab } = await supabase
            .from('bar_tabs')
            .insert(tabInsertData)
            .select('id')
            .single();

          if (!newTab) {
            console.error('Failed to create bar tab for QR order');
            loadData();
            return;
          }
          tabId = newTab.id;
        }

        // Add order items to the tab (with discount applied if member)
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const discountedPrice = discountPercent > 0
              ? item.unit_price * (1 - discountPercent / 100)
              : item.unit_price;

            // Check if item already exists in tab
            const { data: existingItem } = await supabase
              .from('bar_tab_items')
              .select('id, quantity, unit_price')
              .eq('tab_id', tabId)
              .eq('item_name', item.item_name)
              .eq('unit_price', discountedPrice)
              .maybeSingle();

            if (existingItem) {
              const newQty = existingItem.quantity + item.quantity;
              await supabase
                .from('bar_tab_items')
                .update({
                  quantity: newQty,
                  total_price: newQty * existingItem.unit_price,
                })
                .eq('id', existingItem.id);
            } else {
              await supabase.from('bar_tab_items').insert({
                tab_id: tabId,
                menu_item_id: item.menu_item_id,
                item_name: item.item_name,
                quantity: item.quantity,
                unit_price: discountedPrice,
                total_price: item.quantity * discountedPrice,
              });
            }
          }

          // Recalculate tab total
          const { data: allItems } = await supabase
            .from('bar_tab_items')
            .select('total_price')
            .eq('tab_id', tabId);

          const total = allItems?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
          await supabase
            .from('bar_tabs')
            .update({ total, updated_at: new Date().toISOString() })
            .eq('id', tabId);
        }
      } catch (err) {
        console.error('Error creating bar tab from QR order:', err);
      }
    }

    loadData();
  };

  const handleMarkQrOrderItemReady = async (orderId: string, itemId: string) => {
    const { error } = await supabase
      .from('club_order_items')
      .update({ status: 'ready' })
      .eq('id', itemId);
    if (error) {
      console.error(error);
      return;
    }
    await syncOrderStatusFromItems(orderId);
    loadData();
  };

  const canMarkItemReady = (item: QrOrderItem): boolean => {
    if (isKitchenSoloView) return item.is_food;
    if (staffRole === 'bar_staff') return !item.is_food;
    return true;
  };

  const getMenuPublicUrl = () => {
    if (!clubId) return '';
    return `${window.location.origin}/menu/${clubId}`;
  };

  const getTableQrUrl = (tableNumber: string) => {
    if (!clubId) return '';
    return `${window.location.origin}/menu/${clubId}?mesa=${encodeURIComponent(tableNumber)}`;
  };

  const ordersForView = useMemo(
    () => (isKitchenSoloView ? qrOrders.filter(orderHasFoodItems) : qrOrders),
    [qrOrders, isKitchenSoloView]
  );

  const pendingQrCount = ordersForView.filter(o => o.status === 'pending').length;

  // ---- Original Menu/Orders Functions ----

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;

    setSaving(true);

    if (editingCategory) {
      await supabase
        .from('menu_categories')
        .update({ name: categoryForm.name })
        .eq('id', editingCategory.id);
    } else {
      await supabase.from('menu_categories').insert({
        club_owner_id: effectiveUserId,
        name: categoryForm.name,
        sort_order: categories.length
      });
    }

    setShowCategoryForm(false);
    setEditingCategory(null);
    setCategoryForm({ name: '' });
    loadData();
    setSaving(false);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;

    setSaving(true);

    const scheduleFields = buildKitchenScheduleFromForm(itemForm);
    const baseItemFields = {
      category_id: itemForm.category_id,
      name: itemForm.name,
      description: itemForm.description || null,
      price: itemForm.price,
      is_available: itemForm.is_available,
      is_food: itemForm.is_food,
      image_url: itemForm.image_url.trim() || null,
      is_highlighted: itemForm.is_highlighted,
    };

    let lastError: { code?: string; message?: string } | null = null;

    if (editingItem) {
      const full = { ...baseItemFields, ...scheduleFields };
      let { error } = await supabase.from('menu_items').update(full).eq('id', editingItem.id);
      if (error && isPostgrestMissingColumnError(error)) {
        ({ error } = await supabase.from('menu_items').update(baseItemFields).eq('id', editingItem.id));
        if (!error) {
          alert('Menu guardado. Aplique a migração "kitchen_slot" no Supabase para os horários da cozinha fazerem efeito.');
        }
      }
      lastError = error;
    } else {
      const catItems = menuItems.filter(i => i.category_id === itemForm.category_id);
      const fullInsert = {
        club_owner_id: effectiveUserId,
        ...baseItemFields,
        sort_order: catItems.length,
        ...scheduleFields,
      };
      let { error } = await supabase.from('menu_items').insert(fullInsert);
      if (error && isPostgrestMissingColumnError(error)) {
        const { error: e2 } = await supabase.from('menu_items').insert({
          club_owner_id: effectiveUserId,
          ...baseItemFields,
          sort_order: catItems.length,
        });
        if (!e2) {
          alert('Menu guardado. Aplique a migração "kitchen_slot" no Supabase para os horários da cozinha fazerem efeito.');
        }
        lastError = e2;
      } else {
        lastError = error;
      }
    }

    if (lastError) {
      console.error('menu_items save:', lastError);
      alert(`Não foi possível guardar: ${lastError.message || 'Erro desconhecido'}`);
      setSaving(false);
      return;
    }

    setShowItemForm(false);
    setEditingItem(null);
    resetItemForm();
    loadData();
    setSaving(false);
  };

  const handleEditCategory = (category: MenuCategory) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setShowCategoryForm(true);
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      category_id: item.category_id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      is_available: item.is_available,
      is_food: item.is_food || false,
      image_url: item.image_url || '',
      is_highlighted: item.is_highlighted || false,
      kitchen_slot1_start: item.kitchen_slot1_start?.slice(0, 5) || '',
      kitchen_slot1_end: item.kitchen_slot1_end?.slice(0, 5) || '',
      kitchen_slot2_start: item.kitchen_slot2_start?.slice(0, 5) || '',
      kitchen_slot2_end: item.kitchen_slot2_end?.slice(0, 5) || '',
    });
    setShowItemForm(true);
  };

  const resetItemForm = () => {
    setItemForm({ category_id: '', name: '', description: '', price: 0, is_available: true, is_food: false, image_url: '', is_highlighted: false, kitchen_slot1_start: '', kitchen_slot1_end: '', kitchen_slot2_start: '', kitchen_slot2_end: '' });
  };

  const handleMenuImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      // Compress the image
      const compressed = await compressImage(file);
      
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${effectiveUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, compressed, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Erro ao carregar imagem: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);

      setItemForm(prev => ({ ...prev, image_url: urlData.publicUrl }));
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Erro ao processar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveMenuImage = async () => {
    if (itemForm.image_url) {
      // Try to delete from storage
      try {
        const url = new URL(itemForm.image_url);
        const pathParts = url.pathname.split('/menu-images/');
        if (pathParts[1]) {
          await supabase.storage.from('menu-images').remove([decodeURIComponent(pathParts[1])]);
        }
      } catch (err) {
        console.warn('Could not delete old image:', err);
      }
    }
    setItemForm(prev => ({ ...prev, image_url: '' }));
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= categories.length) return;
    const current = categories[index];
    const swap = categories[swapIndex];
    await Promise.all([
      supabase.from('menu_categories').update({ sort_order: swapIndex }).eq('id', current.id),
      supabase.from('menu_categories').update({ sort_order: index }).eq('id', swap.id)
    ]);
    loadData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t.message.confirmDelete)) return;
    await supabase.from('menu_categories').delete().eq('id', id);
    loadData();
  };

  const moveItem = async (categoryId: string, index: number, direction: 'up' | 'down') => {
    const catItems = [...menuItems.filter((i) => i.category_id === categoryId)].sort(compareMenuItemsInCategory);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= catItems.length) return;
    const current = catItems[index];
    const swap = catItems[swapIndex];
    await Promise.all([
      supabase.from('menu_items').update({ sort_order: swapIndex }).eq('id', current.id),
      supabase.from('menu_items').update({ sort_order: index }).eq('id', swap.id)
    ]);
    loadData();
  };

  const toggleItemHighlight = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ is_highlighted: !item.is_highlighted }).eq('id', item.id);
    loadData();
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm(t.message.confirmDelete)) return;
    await supabase.from('menu_items').delete().eq('id', id);
    loadData();
  };

  const handleDuplicateItem = async (item: MenuItem) => {
    if (!effectiveUserId) return;

    await supabase.from('menu_items').insert({
      club_owner_id: effectiveUserId,
      category_id: item.category_id,
      name: `${item.name} (Copia)`,
      description: item.description,
      price: item.price,
      is_available: item.is_available,
      is_food: item.is_food,
      image_url: item.image_url
    });
    loadData();
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);
    loadData();
  };

  // club_orders: fluxo; linhas têm "Pronto" e syncOrderStatusFromItems actualiza o estado global

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'preparing':
        return 'bg-blue-100 text-blue-700';
      case 'ready':
        return 'bg-green-100 text-green-700';
      case 'delivered':
        return 'bg-gray-100 text-gray-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Filter tabs
  const filteredTabs = barTabs.filter(tab => {
    if (tabFilter === 'open') return tab.status === 'open';
    if (tabFilter === 'closed') return tab.status === 'closed';
    return true;
  });

  const openTabsCount = barTabs.filter(t => t.status === 'open').length;

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">{t.message.loading}</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Sound activation banner — must be tapped once to unlock audio on tablets */}
      {!soundEnabled && (
        <button
          onClick={activateSound}
          className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg text-lg font-bold transition-all animate-pulse"
        >
          <span className="text-2xl">🔔</span>
          {isKitchenSoloView
            ? 'Toque para ativar alertas da cozinha (só comida)'
            : 'Toque aqui para ativar alertas sonoros'}
        </button>
      )}
      {soundEnabled && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <span>🔊</span>{' '}
          {isKitchenSoloView
            ? 'Alertas activos — notificação quando houver artigos de cozinha no pedido'
            : 'Alertas sonoros ativos — será notificado a cada novo pedido'}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.bar.title}</h1>
          {isKitchenSoloView && (
            <p className="text-sm text-orange-700 mt-1 font-medium">
              Modo cozinha: vê e ouve apenas pedidos com artigos de comida (itens com &quot;Cozinha&quot; no menu)
            </p>
          )}
          {!isKitchenSoloView && kitchenViewFilter === 'all' && isKitchenRole && (
            <p className="text-sm text-blue-800 mt-1 font-medium">
              A ver todos os pedidos (bebidas e comida) — no mesmo posto, como no balcão
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Vista:</span>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setKitchenViewFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  kitchenViewFilter === 'all' ? 'bg-white shadow text-blue-800' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Bar (todos)
              </button>
              <button
                type="button"
                onClick={() => setKitchenViewFilter('kitchen_only')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  kitchenViewFilter === 'kitchen_only' ? 'bg-white shadow text-orange-800' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Só cozinha
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1 flex-wrap">
            {!showFullBarUi ? (
              <button
                onClick={() => setActiveTab('orders')}
                className="px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 bg-white shadow text-gray-900"
              >
                {t.bar.orders} — cozinha
                {pendingQrCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-1 animate-pulse">
                    {pendingQrCount}
                  </span>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('tabs')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                    activeTab === 'tabs' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  {t.bar.tabs}
                  {openTabsCount > 0 && (
                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
                      {openTabsCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                    activeTab === 'orders' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  {t.bar.orders}
                  {pendingQrCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-1 animate-pulse">
                      {pendingQrCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                    activeTab === 'menu' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  {t.bar.menu}
                </button>
                <button
                  onClick={() => setActiveTab('qr-codes')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                    activeTab === 'qr-codes' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  QR Codes
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                    activeTab === 'analytics' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Metricas
                </button>
              </>
            )}
          </div>
          {activeTab === 'tabs' && showFullBarUi && (
            <button
              onClick={() => { setNewTabForm({ player_name: '', player_phone: '', notes: '' }); setShowNewTabForm(true); }}
              className="bg-orange-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-orange-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t.bar.openTab}
            </button>
          )}
          {activeTab === 'menu' && showFullBarUi && (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingCategory(null); setCategoryForm({ name: '' }); setShowCategoryForm(true); }}
                className="bg-gray-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-gray-700 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.bar.addCategory}
              </button>
              <button
                onClick={() => { setEditingItem(null); resetItemForm(); setShowItemForm(true); }}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.bar.addItem}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============ TABS / CONTAS ============ */}
      {activeTab === 'tabs' && (
        <div className="space-y-4">
          {/* Filter buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['open', 'closed', 'all'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setTabFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  tabFilter === filter
                    ? 'bg-orange-100 text-orange-700 border border-orange-300'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {filter === 'open' ? t.bar.tabOpen : filter === 'closed' ? t.bar.tabClosed : 'Todos'}
                {filter === 'open' && openTabsCount > 0 && (
                  <span className="ml-1.5 text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full">{openTabsCount}</span>
                )}
              </button>
            ))}

            {/* Botão limpar contas vazias */}
            {tabFilter === 'open' && openTabsCount > 0 && (
              <button
                onClick={handleDeleteEmptyOpenTabs}
                className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium transition bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar contas vazias
              </button>
            )}
          </div>

          {filteredTabs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t.bar.noTabs}</h3>
              <button
                onClick={() => { setNewTabForm({ player_name: '', player_phone: '', notes: '' }); setShowNewTabForm(true); }}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition mt-4"
              >
                {t.bar.openTab}
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTabs.map(tab => {
                const isExpanded = expandedTab === tab.id;
                const items = tabItems[tab.id] || [];
                const isAddingItem = addingItemToTab === tab.id;

                return (
                  <div key={tab.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                    tab.payment_status === 'paid' ? 'border-green-200 bg-green-50/30' : 
                    tab.status === 'open' ? 'border-orange-200' : 'border-gray-200'
                  }`}>
                    {/* Tab Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50/50 transition"
                      onClick={async () => {
                        if (isExpanded) {
                          setExpandedTab(null);
                        } else {
                          setExpandedTab(tab.id);
                          if (!tabItems[tab.id]) {
                            await loadTabItems(tab.id);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            tab.payment_status === 'paid' ? 'bg-green-500' :
                            tab.status === 'open' ? 'bg-orange-500' : 'bg-gray-400'
                          }`}>
                            {tab.player_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              {tab.player_name}
                              {tab.tournament_name && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                  {tab.tournament_name}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatDate(tab.created_at)}
                              {tab.player_phone && (
                                <span className="text-gray-400">| {tab.player_phone}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-lg text-gray-900">{tab.total.toFixed(2)} EUR</div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                tab.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                tab.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {tab.payment_status === 'paid' ? t.bar.tabPaid :
                                 tab.status === 'open' ? t.bar.tabOpen : t.bar.tabClosed}
                              </span>
                              {tab.payment_status === 'paid' && tab.payment_method && (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  tab.payment_method === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {tab.payment_method === 'cash' ? '💵' : '💳'}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                {items.length || '0'} items
                              </span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </div>
                      </div>
                    </div>

                    {/* Tab Details (expanded) */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {/* Items list */}
                        {items.length === 0 ? (
                          <div className="p-6 text-center text-gray-500 text-sm">{t.bar.noItemsInTab}</div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {items.map(item => (
                              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-gray-900">{item.item_name}</span>
                                  <span className="text-xs text-gray-500">x{item.quantity}</span>
                                  <span className="text-xs text-gray-400">@ {item.unit_price.toFixed(2)} EUR</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-gray-900">{item.total_price.toFixed(2)} EUR</span>
                                  {tab.status === 'open' && tab.payment_status !== 'paid' && (
                                    <div className="flex items-center gap-1 ml-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateItemQuantity(tab.id, item.id, -1); }}
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateItemQuantity(tab.id, item.id, 1); }}
                                        className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveItemFromTab(tab.id, item.id); }}
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded ml-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Total */}
                        <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                          <span className="font-semibold text-gray-700">{t.bar.tabTotal}</span>
                          <span className="font-bold text-lg text-gray-900">{tab.total.toFixed(2)} EUR</span>
                        </div>

                        {/* Add item section (inline menu with categories, search & popular) */}
                        {tab.status === 'open' && tab.payment_status !== 'paid' && isAddingItem && (() => {
                          const availableItems = menuItems.filter(i => i.is_available);
                          const searchLower = addItemSearch.toLowerCase().trim();
                          const filteredItems = searchLower
                            ? availableItems.filter(i => i.name.toLowerCase().includes(searchLower))
                            : addItemCategoryFilter === 'popular'
                              ? availableItems.filter(i => popularItemIds.includes(i.id))
                                  .sort((a, b) => popularItemIds.indexOf(a.id) - popularItemIds.indexOf(b.id))
                              : addItemCategoryFilter === 'all'
                                ? availableItems
                                : availableItems.filter(i => i.category_id === addItemCategoryFilter);
                          const showGrouped = addItemCategoryFilter === 'all' && !searchLower;
                          return (
                          <div className="border-t border-gray-200 p-4 bg-orange-50/50">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-gray-900 text-sm">{t.bar.selectItem}</h4>
                              <button onClick={() => { setAddingItemToTab(null); setAddItemSearch(''); setAddItemCategoryFilter('popular'); }} className="p-1 hover:bg-gray-200 rounded">
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Search bar */}
                            <div className="relative mb-3">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={addItemSearch}
                                onChange={e => setAddItemSearch(e.target.value)}
                                placeholder="Procurar item..."
                                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
                              />
                              {addItemSearch && (
                                <button onClick={() => setAddItemSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded">
                                  <X className="w-3.5 h-3.5 text-gray-400" />
                                </button>
                              )}
                            </div>

                            {/* Category tabs */}
                            {!searchLower && (
                              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                                <button
                                  onClick={() => setAddItemCategoryFilter('popular')}
                                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${addItemCategoryFilter === 'popular' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'}`}
                                >
                                  <Star className="w-3 h-3" /> Top
                                </button>
                                <button
                                  onClick={() => setAddItemCategoryFilter('all')}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${addItemCategoryFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'}`}
                                >
                                  Todos
                                </button>
                                {categories.map(cat => {
                                  const hasItems = availableItems.some(i => i.category_id === cat.id);
                                  if (!hasItems) return null;
                                  return (
                                    <button
                                      key={cat.id}
                                      onClick={() => setAddItemCategoryFilter(cat.id)}
                                      className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${addItemCategoryFilter === cat.id ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'}`}
                                    >
                                      {cat.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Items grid */}
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                              {showGrouped ? (
                                categories.map(cat => {
                                  const catItems = [...availableItems.filter(i => i.category_id === cat.id)].sort(compareMenuItemsInCategory);
                                  if (catItems.length === 0) return null;
                                  return (
                                    <div key={cat.id}>
                                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1 sticky top-0 bg-orange-50/90 py-1">{cat.name}</div>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                        {catItems.map(menuItem => (
                                          <button key={menuItem.id} onClick={() => handleAddItemToTab(tab.id, menuItem)} className="flex flex-col px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition text-left">
                                            <span className="text-sm font-medium text-gray-900 truncate w-full">{menuItem.name}</span>
                                            <span className="text-xs text-orange-600 font-semibold mt-0.5">{menuItem.price.toFixed(2)} €</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                  {filteredItems.sort(compareMenuItemsInCategory).map(menuItem => (
                                    <button key={menuItem.id} onClick={() => handleAddItemToTab(tab.id, menuItem)} className="flex flex-col px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition text-left">
                                      <span className="text-sm font-medium text-gray-900 truncate w-full">{menuItem.name}</span>
                                      <span className="text-xs text-orange-600 font-semibold mt-0.5">{menuItem.price.toFixed(2)} €</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {filteredItems.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-4">
                                  {searchLower ? 'Nenhum item encontrado' : addItemCategoryFilter === 'popular' && popularItemIds.length === 0 ? 'Sem histórico de vendas' : t.bar.noItems}
                                </p>
                              )}
                            </div>
                          </div>
                          );
                        })()}

                        {/* Action buttons */}
                        <div className="px-4 py-3 flex flex-wrap gap-2 border-t border-gray-100">
                          {tab.status === 'open' && tab.payment_status !== 'paid' && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (isAddingItem) { setAddingItemToTab(null); setAddItemSearch(''); setAddItemCategoryFilter('popular'); } else { setAddingItemToTab(tab.id); setAddItemSearch(''); setAddItemCategoryFilter('popular'); } }}
                                className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition flex items-center gap-1 border border-orange-200"
                              >
                                <Plus className="w-4 h-4" />
                                {t.bar.addItemToTab}
                              </button>
                              {(tabItems[tab.id] || []).some(item => menuItems.find(m => m.id === item.menu_item_id)?.is_food) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSendToKitchen(tab); }}
                                  disabled={sendingToKitchen === tab.id}
                                  className="px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition flex items-center gap-1 border border-amber-300 disabled:opacity-50"
                                >
                                  {sendingToKitchen === tab.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <ChefHat className="w-4 h-4" />
                                  )}
                                  Enviar para Cozinha
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition flex items-center gap-1 border border-gray-200"
                              >
                                <X className="w-4 h-4" />
                                {t.bar.closeTab}
                              </button>
                            </>
                          )}
                          {tab.status === 'closed' && tab.payment_status !== 'paid' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReopenTab(tab.id); }}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center gap-1 border border-blue-200"
                            >
                              Reabrir
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleTabPayment(tab); }}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition flex items-center gap-1 border ${
                              tab.payment_status === 'paid'
                                ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                                : 'text-green-600 hover:bg-green-50 border-green-200'
                            }`}
                          >
                            {tab.payment_status === 'paid' ? (
                              <>
                                <X className="w-4 h-4" />
                                {t.bar.markUnpaid}
                              </>
                            ) : (
                              <>
                                <Euro className="w-4 h-4" />
                                {t.bar.markPaid}
                              </>
                            )}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }}
                            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1 border border-red-200"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t.bar.deleteTab}
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
      )}

      {/* ============ ORDERS (unified club_orders) ============ */}
      {activeTab === 'orders' && (() => {
        // Active = all orders not yet delivered/cancelled (cozinha: só pedidos com artigos is_food)
        const activeOrders = ordersForView.filter(o => !['delivered', 'cancelled'].includes(o.status));
        const finishedOrders = ordersForView.filter(o => o.status === 'delivered');
        const showingActive = qrOrderFilter !== 'all';

        const displayedOrders = showingActive ? activeOrders : finishedOrders;

        return (
          <div className="space-y-4">
            {/* Tabs: Em preparação / Terminados */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setQrOrderFilter('pending')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                    showingActive
                      ? 'bg-orange-100 text-orange-800 border-2 border-orange-300'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  🔥 Em preparação
                  {activeOrders.length > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      showingActive ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>{activeOrders.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setQrOrderFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                    !showingActive
                      ? 'bg-gray-200 text-gray-800 border-2 border-gray-300'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  ✅ Terminados
                  {finishedOrders.length > 0 && (
                    <span className="text-xs bg-gray-300 text-gray-700 px-2 py-0.5 rounded-full font-bold">{finishedOrders.length}</span>
                  )}
                </button>
              </div>
              <button
                onClick={() => loadData()}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-1"
              >
                🔄 Atualizar
              </button>
            </div>

            {displayedOrders.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {showingActive ? 'Sem pedidos ativos' : 'Sem pedidos terminados'}
                </h3>
                <p className="text-sm text-gray-500">
                  {showingActive
                    ? (isKitchenSoloView && qrOrders.some(o => !['delivered', 'cancelled'].includes(o.status)) && ordersForView.length === 0
                        ? 'Neste momento só há pedidos de bar (bebidas). A cozinha não recebe estes pedidos.'
                        : 'Os novos pedidos aparecerão aqui automaticamente.')
                    : 'Os pedidos entregues aparecerão aqui.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {displayedOrders.map(order => {
                  const lineItems = isKitchenSoloView
                    ? (order.items || []).filter((i) => i.is_food)
                    : (order.items || []);
                  const foodSubtotal = (order.items || [])
                    .filter((i) => i.is_food)
                    .reduce((s, i) => s + i.quantity * i.unit_price, 0);
                  // Card background color based on status
                  const cardBg = order.status === 'pending' ? 'bg-red-50 border-red-300 ring-2 ring-red-200' :
                                 order.status === 'preparing' ? 'bg-orange-50 border-orange-300' :
                                 order.status === 'ready' ? 'bg-green-50 border-green-300' :
                                 'bg-gray-50 border-gray-200';

                  const statusIcon = order.status === 'pending' ? '🔴' :
                                     order.status === 'preparing' ? '🟠' :
                                     order.status === 'ready' ? '🟢' : '✅';

                  const { nReady, nTotal } = orderItemsProgress(order);
                  const baseStatusLabel = order.status === 'pending' ? 'Novo pedido!' :
                                      order.status === 'preparing' ? 'Em preparação' :
                                      order.status === 'ready' ? 'Pronto para entrega' : 'Entregue';
                  const statusLabel =
                    order.status === 'preparing' && nTotal > 0
                      ? `${baseStatusLabel} — ${nReady}/${nTotal} prontos`
                      : baseStatusLabel;

                  return (
                    <div key={order.id} className={`rounded-xl shadow-sm border overflow-hidden transition-all duration-300 ${cardBg}`}>
                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm ${
                              order.status === 'pending' ? 'bg-red-500 animate-pulse' :
                              order.status === 'preparing' ? 'bg-orange-500' :
                              order.status === 'ready' ? 'bg-green-500' : 'bg-gray-400'
                            }`}>
                              {order.table_number === 'Balcão' ? '🏪' : `M${order.table_number}`}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 flex items-center gap-2">
                                {order.table_number === 'Balcão' ? '🏪 Balcão' : `Mesa ${order.table_number}`}
                                {order.source === 'qr' && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">📱 QR</span>
                                )}
                              </div>
                              {order.customer_name && (
                                <div className="text-sm text-gray-600 font-medium">{order.customer_name}</div>
                              )}
                              {order.customer_phone && (
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  📱 {order.customer_phone}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {formatDate(order.created_at)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-xl text-gray-900">
                              {isKitchenSoloView ? foodSubtotal.toFixed(2) : order.total.toFixed(2)} €
                            </div>
                            {isKitchenSoloView && (
                              <div className="text-xs text-gray-500">Subtotal cozinha</div>
                            )}
                            <div className="text-xs font-semibold mt-1">
                              {statusIcon} {statusLabel}
                            </div>
                          </div>
                        </div>

                        {/* Order items */}
                        {lineItems.length > 0 && (
                          <div className="border-t border-gray-200/50 pt-3 space-y-2.5">
                            {lineItems.map((item) => {
                              const showPronto =
                                order.status === 'preparing' && canMarkItemReady(item) && !itemIsReady(item);
                              const isDone = itemIsReady(item);
                              return (
                                <div
                                  key={item.id}
                                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                >
                                  <div className="flex min-w-0 items-center gap-2 flex-1">
                                    {item.is_food ? (
                                      <ChefHat className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                    ) : (
                                      <Coffee className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                    )}
                                    <span className="font-medium text-gray-800">
                                      {item.quantity}× {item.item_name}
                                    </span>
                                    {item.notes && (
                                      <span className="text-xs text-gray-400">({item.notes})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {showPronto && (
                                      <button
                                        type="button"
                                        onClick={() => { void handleMarkQrOrderItemReady(order.id, item.id); }}
                                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm"
                                      >
                                        ✓ Pronto
                                      </button>
                                    )}
                                    {isDone && (
                                      <span className="text-xs font-semibold text-green-600 whitespace-nowrap">
                                        ✓ Pronto
                                      </span>
                                    )}
                                    <span className="text-gray-600 tabular-nums min-w-[3.25rem] text-right">
                                      {(item.quantity * item.unit_price).toFixed(2)} €
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {order.status === 'preparing' && nTotal > 0 && nReady < nTotal && (
                          <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-dashed border-gray-200">
                            Toque em <span className="font-semibold">Pronto</span> em cada bebida e em cada
                            comida. O bar marca bebidas; a cozinha, comida. Só fica
                            <span className="font-medium"> &quot;Pronto para entrega&quot; </span>
                            quando tudo estiver com ✓.
                          </p>
                        )}

                        {/* Member discount badge + notes */}
                        {order.notes && (() => {
                          const hasDiscount = order.notes!.includes('🏷️ Membro');
                          const parts = order.notes!.split('|').map(p => p.trim());
                          const userNotes = hasDiscount ? parts.filter(p => !p.includes('🏷️ Membro')).join(' ').trim() : order.notes;
                          const discountNote = hasDiscount ? parts.find(p => p.includes('🏷️ Membro')) : null;
                          return (
                            <>
                              {discountNote && (
                                <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-xs text-emerald-700 border border-emerald-200 font-semibold">
                                  {discountNote}
                                </div>
                              )}
                              {userNotes && (
                                <div className="mt-1 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-800 border border-yellow-200">
                                  📝 {userNotes}
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {order.status !== 'delivered' && order.status !== 'cancelled' && (
                          <div className="flex gap-2 pt-3 mt-3 border-t border-gray-200/50">
                            <button
                              onClick={() => order.status === 'pending' ? handleUpdateQrOrderStatus(order.id, 'preparing') : null}
                              disabled={order.status !== 'pending'}
                              className={`flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
                                order.status === 'pending'
                                  ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm cursor-pointer'
                                  : 'bg-orange-200 text-orange-800 cursor-default opacity-60'
                              }`}
                            >
                              {order.status === 'pending' ? '📥' : '✓'}
                              Recebido
                            </button>

                            <button
                              onClick={() => order.status === 'ready' ? handleUpdateQrOrderStatus(order.id, 'delivered') : null}
                              disabled={order.status !== 'ready'}
                              className={`flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
                                order.status === 'ready'
                                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm cursor-pointer'
                                  : 'bg-gray-100 text-gray-400 cursor-default'
                              }`}
                            >
                              🤝 Retirado
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ============ MENU ============ */}
      {activeTab === 'menu' && (
        <div className="space-y-6 w-full max-w-4xl xl:max-w-5xl mx-auto min-w-0">
          {categories.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <Coffee className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t.bar.noItems}</h3>
              <button
                onClick={() => setShowCategoryForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition mt-4"
              >
                {t.bar.addCategory}
              </button>
            </div>
          ) : (
            categories.map((category, catIdx) => {
              const categoryItems = [...menuItems.filter((item) => item.category_id === category.id)].sort(
                compareMenuItemsInCategory
              );
              return (
                <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveCategory(catIdx, 'up')}
                          disabled={catIdx === 0}
                          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveCategory(catIdx, 'down')}
                          disabled={catIdx === categories.length - 1}
                          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {categoryItems.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">{t.bar.noItems}</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {categoryItems.map((item, itemIdx) => (
                        <div
                          key={item.id}
                          className={`p-3 sm:p-4 grid grid-cols-1 gap-3 min-w-0 sm:grid-cols-[1fr_minmax(0,auto)] sm:items-start ${
                            item.is_highlighted ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="flex flex-col flex-shrink-0">
                              <button
                                onClick={() => moveItem(category.id, itemIdx, 'up')}
                                disabled={itemIdx === 0}
                                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => moveItem(category.id, itemIdx, 'down')}
                                disabled={itemIdx === categoryItems.length - 1}
                                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                {item.is_food ? <ChefHat className="w-5 h-5 text-gray-400" /> : <Coffee className="w-5 h-5 text-gray-400" />}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="font-medium text-gray-900 break-words">{item.name}</span>
                                {item.is_highlighted && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                                <span className="font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                  {item.price.toFixed(2)} €
                                </span>
                                {item.is_food && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 inline-flex items-center gap-0.5">
                                    <ChefHat className="w-3 h-3" />
                                    Cozinha
                                  </span>
                                )}
                                {item.is_food && item.kitchen_slot1_start && item.kitchen_slot1_end && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 inline-flex items-center gap-0.5 whitespace-nowrap">
                                    <Clock className="w-3 h-3" />
                                    {item.kitchen_slot1_start.slice(0, 5)}–{item.kitchen_slot1_end.slice(0, 5)}
                                    {item.kitchen_slot2_start && item.kitchen_slot2_end && (
                                      <> · {item.kitchen_slot2_start.slice(0, 5)}–{item.kitchen_slot2_end.slice(0, 5)}</>
                                    )}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <div className="text-sm text-gray-500 mt-0.5 line-clamp-2 sm:line-clamp-3 break-words">{item.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 sm:justify-end sm:pt-0.5 w-full sm:w-auto sm:shrink-0">
                            <button
                              onClick={() => toggleItemHighlight(item)}
                              className={`p-2 rounded-lg transition ${item.is_highlighted ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:bg-gray-50'}`}
                              title={item.is_highlighted ? 'Remover destaque' : 'Destacar'}
                            >
                              <Star className={`w-4 h-4 ${item.is_highlighted ? 'fill-amber-500' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleToggleItemAvailability(item)}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {item.is_available ? t.bar.available : t.bar.unavailable}
                            </button>
                            <button
                              onClick={() => handleDuplicateItem(item)}
                              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                              title="Duplicar"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditItem(item)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============ QR CODES / TABLES ============ */}
      {activeTab === 'qr-codes' && (
        <div className="space-y-6">
          {/* Menu Public URL */}
          {clubId && (
            <div className="bg-gradient-to-r from-emerald-50 to-lime-50 rounded-xl border border-emerald-200 p-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4 text-emerald-600" />
                Link do Menu Digital
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={getMenuPublicUrl()}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-600"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getMenuPublicUrl());
                    alert('Link copiado!');
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Este é o link geral do menu. Para mesas específicas, crie mesas abaixo e gere QR codes individuais.
              </p>
            </div>
          )}

          {/* Bar Counter QR Code */}
          {clubId && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                🏪 QR Code — Balcão
              </h3>
              <p className="text-sm text-gray-600 mb-3">Para clientes que pedem diretamente ao bar, sem mesa.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/menu/${clubId}?mesa=Balc%C3%A3o`;
                    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`, '_blank');
                  }}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition flex items-center gap-1"
                >
                  <QrCode className="w-4 h-4" />
                  Ver QR Code Balcão
                </button>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/menu/${clubId}?mesa=Balc%C3%A3o`;
                    navigator.clipboard.writeText(url);
                    alert('Link do balcão copiado!');
                  }}
                  className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Link
                </button>
              </div>
            </div>
          )}

          {/* Tables Management */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-gray-600" />
                Mesas ({clubTables.length})
              </h3>
              <button
                onClick={() => { setShowTableForm(true); setNewTableNumber(''); }}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar Mesa
              </button>
            </div>

            {clubTables.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900 mb-1">Sem mesas configuradas</h4>
                <p className="text-sm text-gray-500">Adicione mesas para gerar QR codes individuais.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {clubTables.map(table => (
                  <div key={table.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                    <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-600">{table.table_number}</span>
                    </div>
                    <p className="font-semibold text-gray-900 mb-1">Mesa {table.table_number}</p>
                    <div className="flex flex-col gap-2 mt-3">
                      <button
                        onClick={() => {
                          const url = getTableQrUrl(table.table_number);
                          // Open QR code generator
                          window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`, '_blank');
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition flex items-center justify-center gap-1"
                      >
                        <QrCode className="w-4 h-4" />
                        Ver QR Code
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(getTableQrUrl(table.table_number));
                          alert(`Link da Mesa ${table.table_number} copiado!`);
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center gap-1"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar Link
                      </button>
                      <button
                        onClick={() => handleDeleteTable(table.id)}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <BarMetricsDashboard staffClubOwnerId={staffClubOwnerId} />
      )}

      {/* ============ NEW TAB FORM MODAL ============ */}
      {showNewTabForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{t.bar.openTab}</h2>
              <button onClick={() => { setShowNewTabForm(false); setPhoneLookupResult(null); setNameLookupResults([]); setShowNameSuggestions(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTab} className="p-4 space-y-4">
              {/* Phone first - for auto-lookup */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📱 Telemóvel</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newTabForm.player_phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                      phoneLookupResult?.found ? 'border-green-400 bg-green-50' :
                      phoneLookupResult && !phoneLookupResult.found ? 'border-gray-300' : 'border-gray-300'
                    }`}
                    placeholder="+351 912 345 678"
                  />
                  {lookingUpPhone && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Introduz o telemóvel para encontrar o jogador ou membro automaticamente</p>

                {/* Lookup result */}
                {phoneLookupResult?.found && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="font-medium">{phoneLookupResult.name}</span>
                    </div>
                    <div className="text-xs text-green-600 mt-0.5">{phoneLookupResult.source}</div>
                    {phoneLookupResult.discount > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 text-sm font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md w-fit">
                        🏷️ Desconto Bar: {phoneLookupResult.discount}%
                      </div>
                    )}
                  </div>
                )}
                {phoneLookupResult && !phoneLookupResult.found && newTabForm.player_phone.length >= 6 && (
                  <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
                    Nenhum jogador ou membro encontrado com este número.
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.playerName} *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newTabForm.player_name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => { if (nameLookupResults.length > 0) setShowNameSuggestions(true); }}
                    onBlur={() => { setTimeout(() => setShowNameSuggestions(false), 200); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Nome do cliente..."
                    required
                    autoComplete="off"
                  />
                  {lookingUpName && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Escreve o nome para procurar nos jogadores e membros do clube</p>
                {showNameSuggestions && nameLookupResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {nameLookupResults.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectNameSuggestion(s)}
                        className="w-full text-left px-3 py-2 hover:bg-orange-50 transition flex items-center justify-between border-b border-gray-50 last:border-0"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            {s.name}
                          </div>
                          <div className="text-xs text-gray-500">{s.source}{s.phone ? ` — ${s.phone}` : ''}</div>
                        </div>
                        {s.discount > 0 && (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            -{s.discount}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {phoneLookupResult?.found && phoneLookupResult.name && newTabForm.player_name !== phoneLookupResult.name && (
                  <button
                    type="button"
                    onClick={() => setNewTabForm(prev => ({ ...prev, player_name: phoneLookupResult.name! }))}
                    className="text-xs text-orange-600 mt-1 hover:underline"
                  >
                    Usar nome encontrado: {phoneLookupResult.name}
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.notes}</label>
                <textarea
                  value={newTabForm.notes}
                  onChange={(e) => setNewTabForm({ ...newTabForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={2}
                  placeholder="Notas opcionais..."
                />
              </div>

              {/* Discount info banner */}
              {phoneLookupResult?.found && phoneLookupResult.discount > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                  <p className="font-medium">🏷️ Este cliente tem desconto de {phoneLookupResult.discount}% no bar!</p>
                  <p className="text-xs text-emerald-600 mt-1">O desconto será aplicado automaticamente nos items adicionados à conta.</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowNewTabForm(false); setPhoneLookupResult(null); setNameLookupResults([]); setShowNameSuggestions(false); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <CreditCard className="w-4 h-4" />
                  {saving ? (t.message?.saving || 'Saving...') : t.bar.openTab}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ PAYMENT METHOD CHOICE MODAL ============ */}
      {paymentChoiceTab && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Método de Pagamento</h2>
              <button onClick={() => setPaymentChoiceTab(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">{paymentChoiceTab.player_name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{paymentChoiceTab.total.toFixed(2)} EUR</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleToggleTabPayment(paymentChoiceTab, 'cash')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-green-200 hover:border-green-400 hover:bg-green-50 transition"
                >
                  <Banknote className="w-8 h-8 text-green-600" />
                  <span className="font-semibold text-green-700">Dinheiro</span>
                </button>
                <button
                  onClick={() => handleToggleTabPayment(paymentChoiceTab, 'card')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition"
                >
                  <CreditCard className="w-8 h-8 text-blue-600" />
                  <span className="font-semibold text-blue-700">Cartão</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ CATEGORY FORM MODAL ============ */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? (t.common?.edit || 'Edit') : t.bar.addCategory}
              </h2>
              <button onClick={() => { setShowCategoryForm(false); setEditingCategory(null); setCategoryForm({ name: '' }); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Drinks, Food, Snacks..."
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCategoryForm(false); setEditingCategory(null); setCategoryForm({ name: '' }); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Check className="w-4 h-4" />
                  {saving ? (t.message?.saving || 'Saving...') : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ ITEM FORM MODAL ============ */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingItem ? (t.common?.edit || 'Edit') : t.bar.addItem}
              </h2>
              <button onClick={() => { setShowItemForm(false); setEditingItem(null); resetItemForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.categories}</label>
                <select
                  value={itemForm.category_id}
                  onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.itemName}</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.description}</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Image className="w-4 h-4" />
                  Foto do Item
                </label>
                {itemForm.image_url ? (
                  <div className="relative">
                    <img
                      src={itemForm.image_url}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveMenuImage}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                    {uploadingImage ? (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">A carregar...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Carregar foto</span>
                        <span className="text-xs text-gray-400">JPG, PNG (max 5MB)</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMenuImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.price} (EUR)</label>
                <input
                  type="number"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="item_available"
                    checked={itemForm.is_available}
                    onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="item_available" className="text-sm text-gray-700">{t.bar.available}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="item_is_food"
                    checked={itemForm.is_food}
                    onChange={(e) => setItemForm({ ...itemForm, is_food: e.target.checked })}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="item_is_food" className="text-sm text-gray-700 flex items-center gap-1">
                    <ChefHat className="w-4 h-4 text-orange-500" />
                    Comida (vai para cozinha)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="item_highlighted"
                    checked={itemForm.is_highlighted}
                    onChange={(e) => setItemForm({ ...itemForm, is_highlighted: e.target.checked })}
                    className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                  />
                  <label htmlFor="item_highlighted" className="text-sm text-gray-700 flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-500" />
                    Destacar no menu
                  </label>
                </div>
              </div>

              {/* Kitchen schedule — only for food items */}
              {itemForm.is_food && (
                <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-semibold text-orange-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Horário da cozinha (opcional)
                  </p>
                  <p className="text-[11px] text-orange-600 -mt-1.5">
                    Deixe em branco se o item estiver disponível durante todo o horário de funcionamento.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Slot 1 — Início</label>
                      <input
                        type="time"
                        value={itemForm.kitchen_slot1_start}
                        onChange={(e) => setItemForm({ ...itemForm, kitchen_slot1_start: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Slot 1 — Fim</label>
                      <input
                        type="time"
                        value={itemForm.kitchen_slot1_end}
                        onChange={(e) => setItemForm({ ...itemForm, kitchen_slot1_end: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Slot 2 — Início</label>
                      <input
                        type="time"
                        value={itemForm.kitchen_slot2_start}
                        onChange={(e) => setItemForm({ ...itemForm, kitchen_slot2_start: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Slot 2 — Fim</label>
                      <input
                        type="time"
                        value={itemForm.kitchen_slot2_end}
                        onChange={(e) => setItemForm({ ...itemForm, kitchen_slot2_end: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowItemForm(false); setEditingItem(null); resetItemForm(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Check className="w-4 h-4" />
                  {saving ? (t.message?.saving || 'Saving...') : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ============ TABLE FORM MODAL ============ */}
      {showTableForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Adicionar Mesa</h2>
              <button onClick={() => setShowTableForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTable} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número da Mesa *</label>
                <input
                  type="text"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1, 2, 3... ou A1, B2..."
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTableForm(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Plus className="w-4 h-4" />
                  {saving ? (t.message?.saving || 'Saving...') : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
