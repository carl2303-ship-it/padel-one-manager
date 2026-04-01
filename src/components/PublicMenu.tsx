import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus,
  Minus,
  ShoppingCart,
  X,
  ChefHat,
  Coffee,
  Send,
  Check,
  Loader2,
  Bell,
  Clock,
  Phone,
  Star,
  ArrowLeft
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_food: boolean;
  is_highlighted?: boolean;
  sort_order?: number;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

interface Club {
  id: string;
  name: string;
  logo_url: string | null;
  photo_url_1: string | null;
  photo_url_2: string | null;
  owner_id: string;
}

interface PublicMenuProps {
  clubId: string;
  tableNumber: string | null;
}

export default function PublicMenu({ clubId, tableNumber }: PublicMenuProps) {
  const [club, setClub] = useState<Club | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneLookupResult, setPhoneLookupResult] = useState<{ found: boolean; name: string | null; source: string | null; discount: number; playerAccountId: string | null } | null>(null);
  const [lookingUpPhone, setLookingUpPhone] = useState(false);
  const phoneLookupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [mesa, setMesa] = useState(tableNumber || '');
  const [orderReady, setOrderReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadMenu();
  }, [clubId]);

  // Subscribe to order status changes via Supabase Realtime
  useEffect(() => {
    if (!orderId) return;

    const channel = anonSupabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'club_orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          const newStatus = payload.new?.status;
          if (newStatus) {
            setOrderStatus(newStatus);
            if (newStatus === 'ready') {
              setOrderReady(true);
              // Play notification sound
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRl9vT19teleVBRlQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
                // Use a simple beep
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.value = 0.3;
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
                // Second beep
                setTimeout(() => {
                  const osc2 = ctx.createOscillator();
                  const gain2 = ctx.createGain();
                  osc2.connect(gain2);
                  gain2.connect(ctx.destination);
                  osc2.frequency.value = 1100;
                  gain2.gain.value = 0.3;
                  osc2.start();
                  osc2.stop(ctx.currentTime + 0.5);
                }, 600);
              } catch {
                // Audio not supported
              }
              // Vibrate if supported
              if (navigator.vibrate) {
                navigator.vibrate([300, 200, 300, 200, 300]);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      anonSupabase.removeChannel(channel);
    };
  }, [orderId]);

  const loadMenu = async () => {
    setLoading(true);

    const { data: clubData } = await anonSupabase
      .from('clubs')
      .select('id, name, logo_url, photo_url_1, photo_url_2, owner_id')
      .eq('id', clubId)
      .eq('is_active', true)
      .maybeSingle();

    if (!clubData) {
      setLoading(false);
      return;
    }

    setClub(clubData);

    const { data: categoriesData } = await anonSupabase
      .from('menu_categories')
      .select('id, name, sort_order')
      .eq('club_owner_id', clubData.owner_id)
      .eq('is_active', true)
      .order('sort_order');

    const { data: itemsData } = await anonSupabase
      .from('menu_items')
      .select('*')
      .eq('club_owner_id', clubData.owner_id)
      .eq('is_available', true)
      .order('name');

    setCategories(categoriesData || []);
    setMenuItems(itemsData || []);
    setSelectedCategory(null);
    setLoading(false);
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        return prev.map(c =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1, notes: '' }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(c =>
          c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      return prev.filter(c => c.menuItem.id !== itemId);
    });
  };

  const getCartQuantity = (itemId: string) => {
    return cart.find(c => c.menuItem.id === itemId)?.quantity || 0;
  };

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.quantity * c.menuItem.price, 0);

  // Normalize phone number
  const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\s+/g, '').trim();
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.substring(2);
    if (!cleaned.startsWith('+') && cleaned.length === 9) cleaned = '+351' + cleaned;
    return cleaned;
  };

  // Look up player/member by phone number
  const handlePhoneLookup = async (phone: string) => {
    if (!club || phone.replace(/\s+/g, '').length < 6) {
      setPhoneLookupResult(null);
      return;
    }

    setLookingUpPhone(true);
    const normalizedPhone = normalizePhone(phone);

    try {
      // 1. Look up in player_accounts
      const { data: playerAccount } = await anonSupabase
        .from('player_accounts')
        .select('id, name, phone_number')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      // 2. Look up in member_subscriptions (club members with active subscription)
      const { data: memberSub } = await anonSupabase
        .from('member_subscriptions')
        .select('member_name, member_phone, status, player_account_id, plan:membership_plans(name, bar_discount_percent)')
        .eq('club_owner_id', club.owner_id)
        .eq('member_phone', normalizedPhone)
        .eq('status', 'active')
        .maybeSingle();

      // Also try by player_account_id if we found the player
      let memberSubByAccount = null;
      if (!memberSub && playerAccount) {
        const { data } = await anonSupabase
          .from('member_subscriptions')
          .select('member_name, member_phone, status, player_account_id, plan:membership_plans(name, bar_discount_percent)')
          .eq('club_owner_id', club.owner_id)
          .eq('player_account_id', playerAccount.id)
          .eq('status', 'active')
          .maybeSingle();
        memberSubByAccount = data;
      }

      const activeMember = memberSub || memberSubByAccount;

      if (activeMember) {
        const discount = (activeMember.plan as any)?.bar_discount_percent || 0;
        const planName = (activeMember.plan as any)?.name || '';
        setPhoneLookupResult({
          found: true,
          name: activeMember.member_name || playerAccount?.name || null,
          source: `Membro — ${planName}`,
          discount,
          playerAccountId: playerAccount?.id || activeMember.player_account_id || null
        });
        // Auto-fill name if empty
        const foundName = activeMember.member_name || playerAccount?.name;
        if (!customerName.trim() && foundName) {
          setCustomerName(foundName);
        }
      } else if (playerAccount) {
        setPhoneLookupResult({
          found: true,
          name: playerAccount.name,
          source: 'Jogador registado',
          discount: 0,
          playerAccountId: playerAccount.id
        });
        // Auto-fill name if empty
        if (!customerName.trim() && playerAccount.name) {
          setCustomerName(playerAccount.name);
        }
      } else {
        setPhoneLookupResult({ found: false, name: null, source: null, discount: 0, playerAccountId: null });
      }
    } catch (err) {
      console.error('Phone lookup error:', err);
      setPhoneLookupResult(null);
    }

    setLookingUpPhone(false);
  };

  // Debounced phone lookup
  const handlePhoneChange = (phone: string) => {
    setCustomerPhone(phone);
    setPhoneLookupResult(null);
    if (phoneLookupTimeout.current) clearTimeout(phoneLookupTimeout.current);
    if (phone.replace(/\s+/g, '').length >= 6) {
      phoneLookupTimeout.current = setTimeout(() => handlePhoneLookup(phone), 500);
    }
  };

  // Calculate total with discount
  const discountPercent = phoneLookupResult?.discount || 0;
  const totalPriceWithDiscount = discountPercent > 0
    ? totalPrice * (1 - discountPercent / 100)
    : totalPrice;

  const handleSubmitOrder = async () => {
    if (!club || !mesa.trim() || !customerName.trim() || cart.length === 0) return;

    setSubmitting(true);

    // Create the order (with discount applied if member)
    const { data: orderData, error: orderError } = await anonSupabase
      .from('club_orders')
      .insert({
        club_id: club.id,
        club_owner_id: club.owner_id,
        table_number: mesa.trim(),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        notes: discountPercent > 0
          ? `${orderNotes.trim() ? orderNotes.trim() + ' | ' : ''}🏷️ Membro -${discountPercent}%`
          : (orderNotes.trim() || null),
        total: totalPriceWithDiscount,
        status: 'pending',
        source: 'qr'
      })
      .select('id')
      .single();

    if (orderError || !orderData) {
      console.error('Error creating order:', orderError);
      alert('Erro ao enviar pedido. Tente novamente.');
      setSubmitting(false);
      return;
    }

    // Create order items (with discounted prices if member)
    const items = cart.map(c => {
      const unitPrice = discountPercent > 0
        ? Math.round(c.menuItem.price * (1 - discountPercent / 100) * 100) / 100
        : c.menuItem.price;
      return {
        order_id: orderData.id,
        menu_item_id: c.menuItem.id,
        item_name: c.menuItem.name,
        quantity: c.quantity,
        unit_price: unitPrice,
        is_food: c.menuItem.is_food,
        notes: c.notes.trim() || null,
        status: 'pending'
      };
    });

    const { error: itemsError } = await anonSupabase
      .from('club_order_items')
      .insert(items);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
    }

    // Try to notify manager
    try {
      await fetch(`${supabaseUrl}/functions/v1/notify-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          userId: club.owner_id,
          type: 'qr_order',
          bookingId: orderData.id,
          playerName: `${customerName.trim()} — Mesa ${mesa}`,
          courtName: `Mesa ${mesa}`,
          scheduledAt: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('Could not send notification:', err);
    }

    setOrderId(orderData.id);
    setOrderStatus('pending');
    setOrderSubmitted(true);
    setOrderReady(false);
    setCart([]);
    setShowCart(false);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">A carregar menu...</p>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 mb-2">Menu não encontrado</p>
          <p className="text-gray-500">O clube solicitado não está disponível.</p>
        </div>
      </div>
    );
  }

  // Order status tracking page
  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          {/* Ready notification overlay */}
          {orderReady && (
            <div className="fixed inset-0 bg-emerald-600/95 z-50 flex items-center justify-center p-6 animate-pulse">
              <div className="text-center text-white">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <Bell className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4">🎉 Pedido Pronto!</h2>
                <p className="text-xl mb-2">O seu pedido está pronto.</p>
                <p className="text-lg mb-8 opacity-90">Pode vir buscar ao bar!</p>
                <button
                  onClick={() => setOrderReady(false)}
                  className="px-8 py-3 bg-white text-emerald-700 rounded-xl font-bold text-lg hover:bg-gray-100 transition"
                >
                  OK, obrigado! 👍
                </button>
              </div>
            </div>
          )}

          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            orderStatus === 'pending' ? 'bg-amber-100' :
            orderStatus === 'preparing' ? 'bg-blue-100' :
            orderStatus === 'ready' ? 'bg-emerald-100' :
            orderStatus === 'delivered' ? 'bg-gray-100' : 'bg-emerald-100'
          }`}>
            {orderStatus === 'pending' && <Clock className="w-10 h-10 text-amber-600 animate-pulse" />}
            {orderStatus === 'preparing' && <ChefHat className="w-10 h-10 text-blue-600 animate-bounce" />}
            {orderStatus === 'ready' && <Bell className="w-10 h-10 text-emerald-600 animate-bounce" />}
            {orderStatus === 'delivered' && <Check className="w-10 h-10 text-gray-600" />}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {orderStatus === 'pending' && '⏳ Pedido Enviado'}
            {orderStatus === 'preparing' && '👨‍🍳 Em Preparação'}
            {orderStatus === 'ready' && '🔔 Pronto para levantar!'}
            {orderStatus === 'delivered' && '✅ Entregue'}
          </h2>

          <p className="text-gray-600 mb-2">
            <strong>Mesa {mesa}</strong> — {customerName}
          </p>

          <div className="my-6">
            {/* Progress bar */}
            <div className="flex items-center gap-1">
              <div className={`flex-1 h-2 rounded-full ${
                ['pending', 'preparing', 'ready', 'delivered'].includes(orderStatus) ? 'bg-emerald-500' : 'bg-gray-200'
              }`} />
              <div className={`flex-1 h-2 rounded-full ${
                ['preparing', 'ready', 'delivered'].includes(orderStatus) ? 'bg-emerald-500' : 'bg-gray-200'
              }`} />
              <div className={`flex-1 h-2 rounded-full ${
                ['ready', 'delivered'].includes(orderStatus) ? 'bg-emerald-500' : 'bg-gray-200'
              }`} />
              <div className={`flex-1 h-2 rounded-full ${
                orderStatus === 'delivered' ? 'bg-emerald-500' : 'bg-gray-200'
              }`} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">Enviado</span>
              <span className="text-xs text-gray-500">Aceite</span>
              <span className="text-xs text-gray-500">Pronto</span>
              <span className="text-xs text-gray-500">Entregue</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            {orderStatus === 'pending' && 'A aguardar confirmação do bar...'}
            {orderStatus === 'preparing' && 'O seu pedido está a ser preparado! 🍹'}
            {orderStatus === 'ready' && 'O seu pedido está pronto! Pode vir buscar ao bar. 🎉'}
            {orderStatus === 'delivered' && 'Obrigado! Bom apetite! 😄'}
          </p>

          <p className="text-xs text-gray-400 mb-4">
            💡 Mantenha esta página aberta — será notificado quando o seu pedido estiver pronto.
          </p>

          <button
            onClick={() => {
              setOrderSubmitted(false);
              setOrderId(null);
              setOrderStatus('pending');
              setOrderReady(false);
              setOrderNotes('');
              // Keep customerName, customerPhone and phoneLookupResult for repeat orders
            }}
            className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition"
          >
            Fazer Novo Pedido
          </button>
        </div>
      </div>
    );
  }

  const filteredItems = selectedCategory
    ? menuItems.filter(i => i.category_id === selectedCategory)
    : menuItems;

  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name || '';

  const getCategoryItemCount = (catId: string) => menuItems.filter(i => i.category_id === catId).length;
  const getCategoryHighlights = (catId: string) => menuItems.filter(i => i.category_id === catId && i.is_highlighted);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ===== CATEGORIES PAGE (no category selected) ===== */}
      {!selectedCategory ? (
        <div className="min-h-screen">
          {/* Hero Header */}
          <div className="bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white pt-12 pb-10 px-6">
            <div className="flex flex-col items-center text-center">
              {club.logo_url ? (
                <img src={club.logo_url} alt={club.name} className="w-24 h-24 rounded-2xl object-cover shadow-lg border-2 border-white/20 mb-4" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <Coffee className="w-10 h-10 text-white/60" />
                </div>
              )}
              <h1 className="text-lg font-semibold text-white/90 tracking-wide">{club.name}</h1>
              {mesa && (
                <p className="text-sm text-white/50 mt-1">{mesa === 'Balcão' ? 'Balcão' : `Mesa ${mesa}`}</p>
              )}
              <div className="mt-6">
                <h2 className="text-4xl font-black tracking-tight">MENU</h2>
                <div className="w-12 h-1 bg-emerald-500 rounded-full mx-auto mt-2" />
              </div>
            </div>
          </div>

          {/* Category Grid */}
          <div className="p-4 pb-28 space-y-3">
            {categories.length === 0 ? (
              <div className="text-center py-16">
                <Coffee className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Menu não disponível</p>
              </div>
            ) : (
              categories.map(cat => {
                const itemCount = getCategoryItemCount(cat.id);
                const highlights = getCategoryHighlights(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-left hover:shadow-md hover:border-emerald-200 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900">{cat.name}</h3>
                        <p className="text-sm text-gray-400 mt-0.5">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>
                        {highlights.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {highlights.slice(0, 3).map(h => (
                              <span key={h.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                {h.name}
                              </span>
                            ))}
                            {highlights.length > 3 && (
                              <span className="text-xs text-gray-400">+{highlights.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="ml-3 w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <ArrowLeft className="w-5 h-5 text-emerald-600 rotate-180" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ===== ITEMS PAGE (category selected) ===== */
        <>
          {/* Sticky Header with back */}
          <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 px-3 py-3">
              <button
                onClick={() => setSelectedCategory(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {club.logo_url && (
                  <img src={club.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-gray-900 truncate">{selectedCategoryName}</h1>
                  <p className="text-xs text-gray-400">{club.name}{mesa ? ` · ${mesa === 'Balcão' ? 'Balcão' : `Mesa ${mesa}`}` : ''}</p>
                </div>
              </div>
              {totalItems > 0 && (
                <button
                  onClick={() => setShowCart(true)}
                  className="relative p-2.5 bg-emerald-600 text-white rounded-xl"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">
                    {totalItems}
                  </span>
                </button>
              )}
            </div>

            {/* Category quick-switch pills */}
            <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Items List */}
          <div className="p-4 space-y-3 pb-28">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <Coffee className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400">Sem itens nesta categoria</p>
              </div>
            ) : (
              filteredItems.map(item => {
                const qty = getCartQuantity(item.id);
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border p-4 transition-all ${
                      qty > 0
                        ? 'border-emerald-300 ring-1 ring-emerald-100 shadow-sm'
                        : item.is_highlighted
                        ? 'border-amber-200 bg-amber-50/30 shadow-sm'
                        : 'border-gray-100 shadow-sm'
                    }`}
                  >
                    <div className="flex gap-3">
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap">
                              {item.name}
                              {item.is_highlighted && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                              {item.is_food && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-semibold">
                                  <ChefHat className="w-3 h-3" />
                                </span>
                              )}
                            </h3>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                            )}
                          </div>
                          <span className="font-bold text-emerald-700 text-lg whitespace-nowrap">
                            {item.price.toFixed(2)}€
                          </span>
                        </div>

                        <div className="flex items-center justify-end mt-3">
                          {qty > 0 ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-600 rounded-xl active:bg-red-100 transition"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="font-bold text-gray-900 w-8 text-center text-lg">{qty}</span>
                              <button
                                onClick={() => addToCart(item)}
                                className="w-9 h-9 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl active:bg-emerald-100 transition"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold active:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                              Adicionar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Floating Cart Button */}
      {totalItems > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-20">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-emerald-600 text-white rounded-2xl py-4 px-6 font-semibold shadow-lg active:bg-emerald-700 transition flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>Ver Pedido ({totalItems} {totalItems === 1 ? 'item' : 'itens'})</span>
            </div>
            <span className="text-lg font-bold">{totalPriceWithDiscount.toFixed(2)}€</span>
          </button>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                O Seu Pedido
              </h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Cart Items */}
              {cart.map(c => (
                <div key={c.menuItem.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeFromCart(c.menuItem.id)}
                      className="p-1 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition"
                    >
                      <Minus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <span className="font-bold text-gray-900 w-5 text-center">{c.quantity}</span>
                    <button
                      onClick={() => addToCart(c.menuItem)}
                      className="p-1 bg-white border border-gray-200 rounded-lg hover:bg-emerald-50 transition"
                    >
                      <Plus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm flex items-center gap-1">
                      {c.menuItem.is_food ? <ChefHat className="w-3.5 h-3.5 text-orange-500" /> : <Coffee className="w-3.5 h-3.5 text-blue-500" />}
                      {c.menuItem.name}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{(c.quantity * c.menuItem.price).toFixed(2)}€</span>
                </div>
              ))}

              {/* Mesa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {mesa === 'Balcão' ? '🏪 Balcão' : 'Mesa *'}
                </label>
                <input
                  type="text"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  placeholder="Número da mesa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                  disabled={!!tableNumber}
                />
              </div>

              {/* Customer Name (mandatory) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="O seu nome"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    !customerName.trim() ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
              </div>

              {/* Customer Phone (optional - for membership discounts) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Telemóvel (opcional)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+351 912 345 678"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      phoneLookupResult?.found ? 'border-green-400 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                  {lookingUpPhone && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>

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
                        🏷️ Desconto: {phoneLookupResult.discount}%
                      </div>
                    )}
                  </div>
                )}
                {phoneLookupResult && !phoneLookupResult.found && customerPhone.replace(/\s+/g, '').length >= 6 && (
                  <p className="text-xs text-gray-500 mt-1">Nenhuma conta encontrada com este número.</p>
                )}
                {!phoneLookupResult && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    🏷️ Se já és cliente do clube, coloca o teu telemóvel para usufruíres de descontos!
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Alergias, preferências..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Total */}
              <div className={`p-3 rounded-xl ${discountPercent > 0 ? 'bg-emerald-100 border border-emerald-300' : 'bg-emerald-50'}`}>
                {discountPercent > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span className="line-through">{totalPrice.toFixed(2)}€</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-emerald-600">
                      <span>🏷️ Desconto Membro ({discountPercent}%)</span>
                      <span>-{(totalPrice - totalPriceWithDiscount).toFixed(2)}€</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-emerald-200">
                      <span className="font-semibold text-gray-700">Total</span>
                      <span className="text-xl font-bold text-emerald-700">{totalPriceWithDiscount.toFixed(2)}€</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Total</span>
                    <span className="text-xl font-bold text-emerald-700">{totalPrice.toFixed(2)}€</span>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmitOrder}
                disabled={submitting || !mesa.trim() || !customerName.trim() || cart.length === 0}
                className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    A enviar pedido...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar Pedido
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
