import { useState, useEffect } from 'react';
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
  ArrowLeft,
  Loader2
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
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [mesa, setMesa] = useState(tableNumber || '');

  useEffect(() => {
    loadMenu();
  }, [clubId]);

  const loadMenu = async () => {
    setLoading(true);

    // Fetch club info
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

    // Fetch categories
    const { data: categoriesData } = await anonSupabase
      .from('menu_categories')
      .select('id, name, sort_order')
      .eq('club_owner_id', clubData.owner_id)
      .eq('is_active', true)
      .order('sort_order');

    // Fetch menu items
    const { data: itemsData } = await anonSupabase
      .from('menu_items')
      .select('id, category_id, name, description, price, image_url, is_food')
      .eq('club_owner_id', clubData.owner_id)
      .eq('is_available', true)
      .order('name');

    setCategories(categoriesData || []);
    setMenuItems(itemsData || []);
    if (categoriesData && categoriesData.length > 0) {
      setSelectedCategory(categoriesData[0].id);
    }
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

  const handleSubmitOrder = async () => {
    if (!club || !mesa.trim() || cart.length === 0) return;

    setSubmitting(true);

    // Create the order
    const { data: orderData, error: orderError } = await anonSupabase
      .from('club_orders')
      .insert({
        club_id: club.id,
        table_number: mesa.trim(),
        customer_name: customerName.trim() || null,
        notes: orderNotes.trim() || null,
        total: totalPrice,
        status: 'pending'
      })
      .select('id')
      .single();

    if (orderError || !orderData) {
      console.error('Error creating order:', orderError);
      alert('Erro ao enviar pedido. Tente novamente.');
      setSubmitting(false);
      return;
    }

    // Create order items
    const items = cart.map(c => ({
      order_id: orderData.id,
      menu_item_id: c.menuItem.id,
      item_name: c.menuItem.name,
      quantity: c.quantity,
      unit_price: c.menuItem.price,
      is_food: c.menuItem.is_food,
      notes: c.notes.trim() || null,
      status: 'pending'
    }));

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
          playerName: customerName.trim() || `Mesa ${mesa}`,
          courtName: `Mesa ${mesa}`,
          scheduledAt: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('Could not send notification:', err);
    }

    setOrderId(orderData.id);
    setOrderSubmitted(true);
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

  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido Enviado!</h2>
          <p className="text-gray-600 mb-4">
            O seu pedido para a <strong>Mesa {mesa}</strong> foi recebido.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            O staff do bar será notificado e o seu pedido será preparado em breve.
          </p>
          <button
            onClick={() => {
              setOrderSubmitted(false);
              setOrderId(null);
              setCustomerName('');
              setOrderNotes('');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        {/* Club Banner */}
        {(club.photo_url_1 || club.photo_url_2) && (
          <div className="flex h-32 overflow-hidden">
            {club.photo_url_1 && (
              <img src={club.photo_url_1} alt="" className={`${club.photo_url_2 ? 'w-1/2' : 'w-full'} object-cover`} />
            )}
            {club.photo_url_2 && (
              <img src={club.photo_url_2} alt="" className={`${club.photo_url_1 ? 'w-1/2' : 'w-full'} object-cover`} />
            )}
          </div>
        )}
        <div className="flex items-center gap-3 p-4">
          {club.logo_url && (
            <img src={club.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
          )}
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">{club.name}</h1>
            {mesa && <p className="text-xs text-gray-500">Mesa {mesa}</p>}
          </div>
          {totalItems > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2.5 bg-emerald-600 text-white rounded-xl"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">
                {totalItems}
              </span>
            </button>
          )}
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table Number input if not from QR */}
      {!tableNumber && !mesa && (
        <div className="p-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800 mb-2">Qual é a sua mesa?</p>
            <input
              type="text"
              value={mesa}
              onChange={(e) => setMesa(e.target.value)}
              placeholder="Número da mesa..."
              className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="p-4 space-y-3 pb-24">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Coffee className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Sem items disponíveis</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const qty = getCartQuantity(item.id);
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-sm border p-4 transition ${
                  qty > 0 ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {item.image_url && (
                    <img src={item.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                          {item.is_food ? (
                            <ChefHat className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          ) : (
                            <Coffee className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          )}
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      <span className="font-bold text-emerald-700 text-lg whitespace-nowrap">
                        {item.price.toFixed(2)}€
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-2">
                      {qty > 0 ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold text-gray-900 w-6 text-center">{qty}</span>
                          <button
                            onClick={() => addToCart(item)}
                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition flex items-center gap-1"
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

      {/* Floating Cart Button */}
      {totalItems > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent z-20">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-emerald-600 text-white rounded-2xl py-4 px-6 font-semibold shadow-lg hover:bg-emerald-700 transition flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>Ver Pedido ({totalItems} {totalItems === 1 ? 'item' : 'itens'})</span>
            </div>
            <span className="text-lg font-bold">{totalPrice.toFixed(2)}€</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Mesa *</label>
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

              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome (opcional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="O seu nome"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
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
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="text-xl font-bold text-emerald-700">{totalPrice.toFixed(2)}€</span>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmitOrder}
                disabled={submitting || !mesa.trim() || cart.length === 0}
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
