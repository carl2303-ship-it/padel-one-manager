import { useState, useEffect } from 'react';
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
  BarChart3
} from 'lucide-react';
import BarMetricsDashboard from './BarMetricsDashboard';

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
  image_url: string | null;
}

interface Order {
  id: string;
  customer_name: string | null;
  table_number: string | null;
  status: string;
  total: number;
  payment_status: string;
  created_at: string;
}

interface BarManagementProps {
  staffClubOwnerId?: string | null;
}

export default function BarManagement({ staffClubOwnerId }: BarManagementProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'analytics'>('orders');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [itemForm, setItemForm] = useState({
    category_id: '',
    name: '',
    description: '',
    price: 0,
    is_available: true
  });

  useEffect(() => {
    if (effectiveUserId) {
      loadData();
    }
  }, [effectiveUserId]);

  const loadData = async () => {
    if (!effectiveUserId) return;

    const [categoriesResult, itemsResult, ordersResult] = await Promise.all([
      supabase
        .from('menu_categories')
        .select('*')
        .eq('club_owner_id', effectiveUserId)
        .order('sort_order'),
      supabase
        .from('menu_items')
        .select('*')
        .eq('club_owner_id', effectiveUserId)
        .order('name'),
      supabase
        .from('bar_orders')
        .select('*')
        .eq('club_owner_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    if (categoriesResult.data) setCategories(categoriesResult.data);
    if (itemsResult.data) setMenuItems(itemsResult.data);
    if (ordersResult.data) setOrders(ordersResult.data);
    setLoading(false);
  };

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

    if (editingItem) {
      await supabase
        .from('menu_items')
        .update({
          category_id: itemForm.category_id,
          name: itemForm.name,
          description: itemForm.description || null,
          price: itemForm.price,
          is_available: itemForm.is_available
        })
        .eq('id', editingItem.id);
    } else {
      await supabase.from('menu_items').insert({
        club_owner_id: effectiveUserId,
        category_id: itemForm.category_id,
        name: itemForm.name,
        description: itemForm.description || null,
        price: itemForm.price,
        is_available: itemForm.is_available
      });
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
      is_available: item.is_available
    });
    setShowItemForm(true);
  };

  const resetItemForm = () => {
    setItemForm({ category_id: '', name: '', description: '', price: 0, is_available: true });
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t.message.confirmDelete)) return;
    await supabase.from('menu_categories').delete().eq('id', id);
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
      is_available: item.is_available
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

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    await supabase
      .from('bar_orders')
      .update({ status })
      .eq('id', orderId);
    loadData();
  };

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

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">{t.message.loading}</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.bar.title}</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === 'orders' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              {t.bar.orders}
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
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                activeTab === 'analytics' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Metricas
            </button>
          </div>
          {activeTab === 'menu' && (
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

      {activeTab === 'orders' ? (
        orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.bar.noOrders}</h3>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg">
                      <ShoppingBag className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {order.customer_name || 'Guest'}
                        {order.table_number && <span className="text-gray-500"> - {t.bar.tableNumber} {order.table_number}</span>}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(order.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                      {t.bar[`order${order.status.charAt(0).toUpperCase() + order.status.slice(1)}` as keyof typeof t.bar] || order.status}
                    </span>
                    <span className="font-bold text-gray-900">{order.total.toFixed(2)} EUR</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center gap-1"
                    >
                      <ChefHat className="w-4 h-4" />
                      Start Preparing
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                      className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      {t.bar.markReady}
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      {t.bar.markDelivered}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-6">
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
            categories.map(category => {
              const categoryItems = menuItems.filter(item => item.category_id === category.id);
              return (
                <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">{category.name}</h3>
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
                      {categoryItems.map(item => (
                        <div key={item.id} className="p-4 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            {item.description && (
                              <div className="text-sm text-gray-500">{item.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-gray-900">{item.price.toFixed(2)} EUR</span>
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

      {activeTab === 'analytics' && (
        <BarMetricsDashboard staffClubOwnerId={staffClubOwnerId} />
      )}

      {/* Category Form Modal */}
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

      {/* Item Form Modal */}
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
    </div>
  );
}
