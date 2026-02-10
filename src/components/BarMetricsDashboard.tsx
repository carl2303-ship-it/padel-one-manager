import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Euro,
  ShoppingBag,
  Users,
  Package,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface BarMetricsDashboardProps {
  staffClubOwnerId?: string | null;
}

interface PeriodMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  uniqueCustomers: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  topCategories: { name: string; revenue: number }[];
  dailyRevenue: { date: string; revenue: number; orders: number }[];
}

interface ComparisonData {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  percentageChange: {
    revenue: number;
    orders: number;
    averageOrder: number;
    customers: number;
  };
}

type DateFilter = 'today' | 'week' | 'month' | 'year';

export default function BarMetricsDashboard({ staffClubOwnerId }: BarMetricsDashboardProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);

  const getDateRanges = () => {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (dateFilter) {
      case 'today':
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      case 'week':
        currentStart = new Date(now);
        currentStart.setDate(now.getDate() - 7);
        currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        previousStart = new Date(now);
        previousStart.setDate(now.getDate() - 14);
        previousEnd = new Date(now);
        previousEnd.setDate(now.getDate() - 7);
        previousEnd.setHours(23, 59, 59, 999);
        break;
      case 'month':
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'year':
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;
    }

    return {
      current: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
      previous: { start: previousStart.toISOString(), end: previousEnd.toISOString() }
    };
  };

  const loadMetricsForPeriod = async (startDate: string, endDate: string): Promise<PeriodMetrics> => {
    if (!effectiveUserId) {
      return {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        uniqueCustomers: 0,
        topProducts: [],
        topCategories: [],
        dailyRevenue: []
      };
    }

    const { data: orders } = await supabase
      .from('bar_orders')
      .select('id, total, customer_name, created_at')
      .eq('club_owner_id', effectiveUserId)
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: orderItems } = await supabase
      .from('bar_order_items')
      .select(`
        quantity,
        price,
        menu_item:menu_items(name, category_id),
        bar_order:bar_orders!inner(club_owner_id, status, created_at)
      `)
      .eq('bar_order.club_owner_id', effectiveUserId)
      .eq('bar_order.status', 'completed')
      .gte('bar_order.created_at', startDate)
      .lte('bar_order.created_at', endDate);

    const { data: categories } = await supabase
      .from('menu_categories')
      .select('id, name')
      .eq('club_owner_id', effectiveUserId);

    const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);

    const totalRevenue = orders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;
    const totalOrders = orders?.length || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const uniqueCustomers = new Set(orders?.map(o => o.customer_name?.toLowerCase()).filter(Boolean)).size;

    const productMap = new Map<string, { quantity: number; revenue: number }>();
    const categoryRevenueMap = new Map<string, number>();

    orderItems?.forEach(item => {
      const menuItem = item.menu_item as { name: string; category_id: string } | null;
      if (menuItem) {
        const existing = productMap.get(menuItem.name) || { quantity: 0, revenue: 0 };
        productMap.set(menuItem.name, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (item.quantity * item.price)
        });

        const catName = categoryMap.get(menuItem.category_id) || 'Other';
        categoryRevenueMap.set(catName, (categoryRevenueMap.get(catName) || 0) + (item.quantity * item.price));
      }
    });

    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topCategories = Array.from(categoryRevenueMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    orders?.forEach(order => {
      const date = order.created_at.split('T')[0];
      const existing = dailyMap.get(date) || { revenue: 0, orders: 0 };
      dailyMap.set(date, {
        revenue: existing.revenue + (Number(order.total) || 0),
        orders: existing.orders + 1
      });
    });

    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      uniqueCustomers,
      topProducts,
      topCategories,
      dailyRevenue
    };
  };

  const loadAllMetrics = async () => {
    setLoading(true);
    const ranges = getDateRanges();

    const [current, previous] = await Promise.all([
      loadMetricsForPeriod(ranges.current.start, ranges.current.end),
      loadMetricsForPeriod(ranges.previous.start, ranges.previous.end)
    ]);

    const calculateChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    setComparison({
      current,
      previous,
      percentageChange: {
        revenue: calculateChange(current.totalRevenue, previous.totalRevenue),
        orders: calculateChange(current.totalOrders, previous.totalOrders),
        averageOrder: calculateChange(current.averageOrderValue, previous.averageOrderValue),
        customers: calculateChange(current.uniqueCustomers, previous.uniqueCustomers)
      }
    });

    setLoading(false);
  };

  useEffect(() => {
    if (effectiveUserId) {
      loadAllMetrics();
    }
  }, [effectiveUserId, dateFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getPeriodLabel = () => {
    switch (dateFilter) {
      case 'today': return { current: 'Hoje', previous: 'Ontem' };
      case 'week': return { current: 'Esta Semana', previous: 'Semana Anterior' };
      case 'month': return { current: 'Este Mes', previous: 'Mes Anterior' };
      case 'year': return { current: 'Este Ano', previous: 'Ano Anterior' };
    }
  };

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600 bg-green-50';
    if (value < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const labels = getPeriodLabel();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Metricas do Bar</h2>
          <p className="text-sm text-gray-500 mt-1">Analise o desempenho e compare com periodos anteriores</p>
        </div>

        <div className="flex gap-2">
          {(['today', 'week', 'month', 'year'] as DateFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {filter === 'today' && 'Hoje'}
              {filter === 'week' && 'Semana'}
              {filter === 'month' && 'Mes'}
              {filter === 'year' && 'Ano'}
            </button>
          ))}
        </div>
      </div>

      {comparison && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Euro className="w-5 h-5 text-green-600" />
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(comparison.percentageChange.revenue)}`}>
                  <TrendIcon value={comparison.percentageChange.revenue} />
                  {formatPercentage(comparison.percentageChange.revenue)}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(comparison.current.totalRevenue)}</p>
                <p className="text-sm text-gray-500">Receita Total</p>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {labels.previous}: <span className="font-medium text-gray-700">{formatCurrency(comparison.previous.totalRevenue)}</span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(comparison.percentageChange.orders)}`}>
                  <TrendIcon value={comparison.percentageChange.orders} />
                  {formatPercentage(comparison.percentageChange.orders)}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{comparison.current.totalOrders}</p>
                <p className="text-sm text-gray-500">Total de Pedidos</p>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {labels.previous}: <span className="font-medium text-gray-700">{comparison.previous.totalOrders}</span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-amber-600" />
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(comparison.percentageChange.averageOrder)}`}>
                  <TrendIcon value={comparison.percentageChange.averageOrder} />
                  {formatPercentage(comparison.percentageChange.averageOrder)}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(comparison.current.averageOrderValue)}</p>
                <p className="text-sm text-gray-500">Valor Medio por Pedido</p>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {labels.previous}: <span className="font-medium text-gray-700">{formatCurrency(comparison.previous.averageOrderValue)}</span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(comparison.percentageChange.customers)}`}>
                  <TrendIcon value={comparison.percentageChange.customers} />
                  {formatPercentage(comparison.percentageChange.customers)}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{comparison.current.uniqueCustomers}</p>
                <p className="text-sm text-gray-500">Clientes Unicos</p>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {labels.previous}: <span className="font-medium text-gray-700">{comparison.previous.uniqueCustomers}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Produtos Mais Vendidos</h3>
                <span className="text-xs text-gray-500">{labels.current}</span>
              </div>
              {comparison.current.topProducts.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">Sem vendas neste periodo</p>
              ) : (
                <div className="space-y-3">
                  {comparison.current.topProducts.map((product, index) => {
                    const prevProduct = comparison.previous.topProducts.find(p => p.name === product.name);
                    const revenueChange = prevProduct
                      ? ((product.revenue - prevProduct.revenue) / prevProduct.revenue) * 100
                      : 100;

                    return (
                      <div key={product.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-200 text-gray-700' :
                            index === 2 ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.quantity} unidades</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                          {prevProduct && (
                            <div className={`flex items-center justify-end gap-1 text-xs ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {revenueChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {Math.abs(revenueChange).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Receita por Categoria</h3>
                <span className="text-xs text-gray-500">{labels.current}</span>
              </div>
              {comparison.current.topCategories.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">Sem vendas neste periodo</p>
              ) : (
                <div className="space-y-4">
                  {comparison.current.topCategories.map((category) => {
                    const maxRevenue = Math.max(...comparison.current.topCategories.map(c => c.revenue));
                    const percentage = (category.revenue / maxRevenue) * 100;
                    const prevCategory = comparison.previous.topCategories.find(c => c.name === category.name);
                    const revenueChange = prevCategory
                      ? ((category.revenue - prevCategory.revenue) / prevCategory.revenue) * 100
                      : 100;

                    return (
                      <div key={category.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{category.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(category.revenue)}</span>
                            {prevCategory && (
                              <span className={`text-xs ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {comparison.current.dailyRevenue.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Receita Diaria</h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded"></span>
                    Receita
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-green-500 rounded"></span>
                    Pedidos
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="flex gap-2 min-w-max pb-2">
                  {comparison.current.dailyRevenue.map((day) => {
                    const maxRevenue = Math.max(...comparison.current.dailyRevenue.map(d => d.revenue));
                    const heightPercent = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                    const date = new Date(day.date);
                    const dayLabel = date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' });

                    return (
                      <div key={day.date} className="flex flex-col items-center gap-2 w-16">
                        <div className="h-32 w-full flex flex-col justify-end items-center gap-1">
                          <div
                            className="w-8 bg-blue-500 rounded-t transition-all duration-300"
                            style={{ height: `${Math.max(heightPercent, 4)}%` }}
                            title={formatCurrency(day.revenue)}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-gray-600">{dayLabel}</p>
                          <p className="text-xs text-gray-500">{day.orders} ped.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border border-blue-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Resumo do Periodo</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Melhor dia</p>
                    <p className="font-medium text-gray-900">
                      {comparison.current.dailyRevenue.length > 0
                        ? new Date(comparison.current.dailyRevenue.reduce((best, day) =>
                            day.revenue > best.revenue ? day : best
                          ).date).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
                        : '-'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Receita media/dia</p>
                    <p className="font-medium text-gray-900">
                      {comparison.current.dailyRevenue.length > 0
                        ? formatCurrency(comparison.current.totalRevenue / comparison.current.dailyRevenue.length)
                        : formatCurrency(0)
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Pedidos/dia</p>
                    <p className="font-medium text-gray-900">
                      {comparison.current.dailyRevenue.length > 0
                        ? (comparison.current.totalOrders / comparison.current.dailyRevenue.length).toFixed(1)
                        : '0'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Meta sugerida</p>
                    <p className="font-medium text-green-600">
                      {formatCurrency(comparison.current.totalRevenue * 1.1)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
