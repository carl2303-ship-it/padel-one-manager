import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Plus,
  X,
  MapPin,
  Edit2,
  Trash2,
  Check,
  Building,
  Sun,
  Umbrella,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface Court {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor' | 'covered';
  hourly_rate: number;
  peak_rate: number;
  is_active: boolean;
  description: string | null;
  sort_order: number;
}

export default function CourtManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'indoor' as 'indoor' | 'outdoor' | 'covered',
    hourly_rate: 20,
    peak_rate: 25,
    is_active: true,
    description: ''
  });

  useEffect(() => {
    if (user) {
      loadCourts();
    }
  }, [user]);

  const loadCourts = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('club_courts')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
      .order('name');

    if (data) {
      setCourts(data);
    }
    setLoading(false);
  };

  const handleMoveUp = async (court: Court, index: number) => {
    if (index === 0) return;
    const prevCourt = courts[index - 1];

    await Promise.all([
      supabase.from('club_courts').update({ sort_order: prevCourt.sort_order }).eq('id', court.id),
      supabase.from('club_courts').update({ sort_order: court.sort_order }).eq('id', prevCourt.id)
    ]);

    loadCourts();
  };

  const handleMoveDown = async (court: Court, index: number) => {
    if (index === courts.length - 1) return;
    const nextCourt = courts[index + 1];

    await Promise.all([
      supabase.from('club_courts').update({ sort_order: nextCourt.sort_order }).eq('id', court.id),
      supabase.from('club_courts').update({ sort_order: court.sort_order }).eq('id', nextCourt.id)
    ]);

    loadCourts();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    if (editingCourt) {
      const { error } = await supabase
        .from('club_courts')
        .update({
          name: form.name,
          type: form.type,
          hourly_rate: form.hourly_rate,
          peak_rate: form.peak_rate,
          is_active: form.is_active,
          description: form.description || null
        })
        .eq('id', editingCourt.id);

      if (!error) {
        setShowForm(false);
        setEditingCourt(null);
        loadCourts();
      }
    } else {
      const maxSortOrder = courts.length > 0 ? Math.max(...courts.map(c => c.sort_order)) : -1;
      const { error } = await supabase
        .from('club_courts')
        .insert({
          user_id: user.id,
          name: form.name,
          type: form.type,
          hourly_rate: form.hourly_rate,
          peak_rate: form.peak_rate,
          is_active: form.is_active,
          description: form.description || null,
          sort_order: maxSortOrder + 1
        });

      if (!error) {
        setShowForm(false);
        loadCourts();
      }
    }

    setSaving(false);
    resetForm();
  };

  const handleEdit = (court: Court) => {
    setEditingCourt(court);
    setForm({
      name: court.name,
      type: court.type,
      hourly_rate: court.hourly_rate,
      peak_rate: court.peak_rate,
      is_active: court.is_active,
      description: court.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (courtId: string) => {
    if (!confirm(t.message.confirmDelete)) return;

    const { error } = await supabase
      .from('club_courts')
      .delete()
      .eq('id', courtId);

    if (!error) {
      loadCourts();
    }
  };

  const handleToggleActive = async (court: Court) => {
    const { error } = await supabase
      .from('club_courts')
      .update({ is_active: !court.is_active })
      .eq('id', court.id);

    if (!error) {
      loadCourts();
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      type: 'indoor',
      hourly_rate: 20,
      peak_rate: 25,
      is_active: true,
      description: ''
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'indoor':
        return Building;
      case 'outdoor':
        return Sun;
      case 'covered':
        return Umbrella;
      default:
        return MapPin;
    }
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.courts.title}</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingCourt(null);
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.courts.addCourt}
        </button>
      </div>

      {courts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t.courts.noCourts}</h3>
          <p className="text-gray-500 mb-6">{t.courts.addFirst}</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            {t.courts.addCourt}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courts.map((court, index) => {
            const TypeIcon = getTypeIcon(court.type);
            return (
              <div
                key={court.id}
                className={`bg-white rounded-xl shadow-sm border ${
                  court.is_active ? 'border-gray-100' : 'border-red-100 bg-red-50/30'
                } overflow-hidden`}
              >
                <div className={`p-4 ${court.is_active ? 'bg-blue-600' : 'bg-gray-400'}`}>
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="w-5 h-5" />
                      <span className="font-medium">{court.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveUp(court, index)}
                        disabled={index === 0}
                        className={`p-1 rounded transition ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
                        title="Mover para cima"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(court, index)}
                        disabled={index === courts.length - 1}
                        className={`p-1 rounded transition ${index === courts.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
                        title="Mover para baixo"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                        court.is_active ? 'bg-white/20' : 'bg-red-500'
                      }`}>
                        {court.is_active ? t.courts.active : t.courts.inactive}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.courts.type}</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {t.courts[court.type as keyof typeof t.courts] || court.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.courts.hourlyRate}</span>
                    <span className="text-sm font-medium text-gray-900">{court.hourly_rate} EUR</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.courts.peakRate}</span>
                    <span className="text-sm font-medium text-gray-900">{court.peak_rate} EUR</span>
                  </div>
                  {court.description && (
                    <p className="text-sm text-gray-500 pt-2 border-t border-gray-100">
                      {court.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(court)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t.common.edit}
                    </button>
                    <button
                      onClick={() => handleToggleActive(court)}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-1 ${
                        court.is_active
                          ? 'text-yellow-600 hover:bg-yellow-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {court.is_active ? t.courts.inactive : t.courts.active}
                    </button>
                    <button
                      onClick={() => handleDelete(court.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Court Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCourt ? t.courts.editCourt : t.courts.addCourt}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingCourt(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.name}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Court 1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.type}</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'indoor' | 'outdoor' | 'covered' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="indoor">{t.courts.indoor}</option>
                  <option value="outdoor">{t.courts.outdoor}</option>
                  <option value="covered">{t.courts.covered}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.hourlyRate} (EUR)</label>
                  <input
                    type="number"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.peakRate} (EUR)</label>
                  <input
                    type="number"
                    value={form.peak_rate}
                    onChange={(e) => setForm({ ...form, peak_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.description}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">{t.courts.active}</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCourt(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? t.message.saving : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
