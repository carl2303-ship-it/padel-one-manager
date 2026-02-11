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
  BarChart3,
  User,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Minus,
  Euro
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

interface BarTab {
  id: string;
  club_owner_id: string;
  player_name: string;
  player_phone: string | null;
  player_account_id: string | null;
  tournament_id: string | null;
  tournament_name: string | null;
  status: 'open' | 'closed';
  total: number;
  payment_status: 'pending' | 'paid';
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

interface BarManagementProps {
  staffClubOwnerId?: string | null;
}

export default function BarManagement({ staffClubOwnerId }: BarManagementProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const [activeTab, setActiveTab] = useState<'tabs' | 'orders' | 'menu' | 'analytics'>('tabs');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
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
  const [addingItemToTab, setAddingItemToTab] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<'open' | 'closed' | 'all'>('open');

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

    const [categoriesResult, itemsResult, ordersResult, tabsResult] = await Promise.all([
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
        .limit(20),
      supabase
        .from('bar_tabs')
        .select('*')
        .eq('club_owner_id', effectiveUserId)
        .order('created_at', { ascending: false })
    ]);

    if (categoriesResult.data) setCategories(categoriesResult.data);
    if (itemsResult.data) setMenuItems(itemsResult.data);
    if (ordersResult.data) setOrders(ordersResult.data);
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

  // ---- Tab Management Functions ----

  const handleCreateTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId || !newTabForm.player_name.trim()) return;
    setSaving(true);

    const { error } = await supabase.from('bar_tabs').insert({
      club_owner_id: effectiveUserId,
      player_name: newTabForm.player_name.trim(),
      player_phone: newTabForm.player_phone.trim() || null,
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
    await supabase.from('bar_tabs').delete().eq('id', tabId);
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

  const handleToggleTabPayment = async (tab: BarTab) => {
    if (!effectiveUserId) return;
    const newStatus = tab.payment_status === 'paid' ? 'pending' : 'paid';

    await supabase
      .from('bar_tabs')
      .update({
        payment_status: newStatus,
        status: newStatus === 'paid' ? 'closed' : tab.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', tab.id);

    // Handle player_transactions
    if (newStatus === 'paid' && tab.total > 0) {
      // Find or create player_account
      let playerAccountId: string | null = null;
      if (tab.player_phone) {
        const normalizedPhone = tab.player_phone.replace(/\s+/g, '');
        const { data: existingAccount } = await supabase
          .from('player_accounts')
          .select('id')
          .eq('phone_number', normalizedPhone)
          .maybeSingle();

        playerAccountId = existingAccount?.id || null;

        if (!existingAccount) {
          const { data: newAccount } = await supabase
            .from('player_accounts')
            .insert({
              phone_number: normalizedPhone,
              name: tab.player_name
            })
            .select('id')
            .single();
          playerAccountId = newAccount?.id || null;
        }
      }

      // Create player_transaction
      const txData: Record<string, unknown> = {
        club_owner_id: effectiveUserId,
        player_name: tab.player_name,
        player_phone: tab.player_phone || '',
        transaction_type: 'bar',
        amount: tab.total,
        reference_id: tab.id,
        reference_type: 'bar_tab',
        notes: `Bar: Conta${tab.tournament_name ? ' - ' + tab.tournament_name : ''}`
      };
      if (playerAccountId) txData.player_account_id = playerAccountId;

      await supabase.from('player_transactions').insert(txData);
    } else if (newStatus === 'pending') {
      // Remove the transaction
      await supabase
        .from('player_transactions')
        .delete()
        .eq('reference_id', tab.id)
        .eq('reference_type', 'bar_tab');
    }

    await loadData();
  };

  const handleAddItemToTab = async (tabId: string, menuItem: MenuItem) => {
    // Check if item already exists in tab
    const existingItems = tabItems[tabId] || [];
    const existingItem = existingItems.find(i => i.menu_item_id === menuItem.id);

    if (existingItem) {
      // Increment quantity
      const newQty = existingItem.quantity + 1;
      await supabase
        .from('bar_tab_items')
        .update({
          quantity: newQty,
          total_price: newQty * existingItem.unit_price
        })
        .eq('id', existingItem.id);
    } else {
      // Add new item
      await supabase.from('bar_tab_items').insert({
        tab_id: tabId,
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        quantity: 1,
        unit_price: menuItem.price,
        total_price: menuItem.price
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.bar.title}</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1 flex-wrap">
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
          {activeTab === 'tabs' && (
            <button
              onClick={() => { setNewTabForm({ player_name: '', player_phone: '', notes: '' }); setShowNewTabForm(true); }}
              className="bg-orange-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-orange-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t.bar.openTab}
            </button>
          )}
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

      {/* ============ TABS / CONTAS ============ */}
      {activeTab === 'tabs' && (
        <div className="space-y-4">
          {/* Filter buttons */}
          <div className="flex gap-2">
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

                        {/* Add item section (inline menu) */}
                        {tab.status === 'open' && tab.payment_status !== 'paid' && isAddingItem && (
                          <div className="border-t border-gray-200 p-4 bg-orange-50/50">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-gray-900 text-sm">{t.bar.selectItem}</h4>
                              <button
                                onClick={() => setAddingItemToTab(null)}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {categories.map(cat => {
                                const catItems = menuItems.filter(i => i.category_id === cat.id && i.is_available);
                                if (catItems.length === 0) return null;
                                return (
                                  <div key={cat.id}>
                                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{cat.name}</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {catItems.map(menuItem => (
                                        <button
                                          key={menuItem.id}
                                          onClick={() => handleAddItemToTab(tab.id, menuItem)}
                                          className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition text-left"
                                        >
                                          <span className="text-sm font-medium text-gray-900">{menuItem.name}</span>
                                          <span className="text-sm text-orange-600 font-semibold">{menuItem.price.toFixed(2)} EUR</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              {menuItems.filter(i => i.is_available).length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-4">{t.bar.noItems}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="px-4 py-3 flex flex-wrap gap-2 border-t border-gray-100">
                          {tab.status === 'open' && tab.payment_status !== 'paid' && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setAddingItemToTab(isAddingItem ? null : tab.id); }}
                                className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition flex items-center gap-1 border border-orange-200"
                              >
                                <Plus className="w-4 h-4" />
                                {t.bar.addItemToTab}
                              </button>
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

      {/* ============ ORDERS ============ */}
      {activeTab === 'orders' && (
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
      )}

      {/* ============ MENU ============ */}
      {activeTab === 'menu' && (
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

      {/* ============ NEW TAB FORM MODAL ============ */}
      {showNewTabForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{t.bar.openTab}</h2>
              <button onClick={() => setShowNewTabForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTab} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.playerName} *</label>
                <input
                  type="text"
                  value={newTabForm.player_name}
                  onChange={(e) => setNewTabForm({ ...newTabForm, player_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Nome do cliente..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.playerPhone}</label>
                <input
                  type="text"
                  value={newTabForm.player_phone}
                  onChange={(e) => setNewTabForm({ ...newTabForm, player_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="+351..."
                />
              </div>
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
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewTabForm(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
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
