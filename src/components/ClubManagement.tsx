import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  MapPin,
  Phone,
  Mail,
  Globe,
  Image
} from 'lucide-react';

interface Club {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean;
}

export default function ClubManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    address: '',
    city: '',
    country: 'Portugal',
    phone: '',
    email: '',
    website: ''
  });

  useEffect(() => {
    if (user) {
      loadClubs();
    }
  }, [user]);

  const loadClubs = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('clubs')
      .select('*')
      .eq('owner_id', user.id)
      .order('name');

    setClubs(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      logo_url: '',
      address: '',
      city: '',
      country: 'Portugal',
      phone: '',
      email: '',
      website: ''
    });
    setEditingClub(null);
    setShowForm(false);
  };

  const handleEdit = (club: Club) => {
    setFormData({
      name: club.name,
      description: club.description || '',
      logo_url: club.logo_url || '',
      address: club.address || '',
      city: club.city || '',
      country: club.country || 'Portugal',
      phone: club.phone || '',
      email: club.email || '',
      website: club.website || ''
    });
    setEditingClub(club);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;

    setSaving(true);

    if (editingClub) {
      const { error } = await supabase
        .from('clubs')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          logo_url: formData.logo_url.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          country: formData.country.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          website: formData.website.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingClub.id);

      if (!error) {
        resetForm();
        loadClubs();
      }
    } else {
      const { error } = await supabase
        .from('clubs')
        .insert({
          owner_id: user.id,
          name: formData.name.trim(),
          description: formData.description.trim(),
          logo_url: formData.logo_url.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          country: formData.country.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          website: formData.website.trim() || null
        });

      if (!error) {
        resetForm();
        loadClubs();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (clubId: string) => {
    const { error } = await supabase
      .from('clubs')
      .delete()
      .eq('id', clubId);

    if (!error) {
      setDeleteConfirm(null);
      loadClubs();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">{t.message.loading}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t.clubs?.title || 'My Clubs'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t.clubs?.description || 'Manage your padel clubs and their information'}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            {t.clubs?.add || 'Add Club'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">
                {editingClub ? (t.clubs?.edit || 'Edit Club') : (t.clubs?.add || 'Add Club')}
              </h3>
            </div>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.clubs?.name || 'Club Name'} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Padel Blu"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.clubs?.description || 'Description'}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="A brief description of the club..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    {t.clubs?.logoUrl || 'Logo URL'}
                  </div>
                </label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/logo.png"
                />
                {formData.logo_url && (
                  <div className="mt-2">
                    <img
                      src={formData.logo_url}
                      alt="Logo preview"
                      className="h-12 w-auto object-contain bg-gray-100 rounded-lg p-1"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {t.clubs?.address || 'Address'}
                  </div>
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.clubs?.city || 'City'}
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Albufeira"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {t.clubs?.phone || 'Phone'}
                  </div>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t.clubs?.email || 'Email'}
                  </div>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t.clubs?.website || 'Website'}
                  </div>
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://www.padelblu.com"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={saving || !formData.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {saving ? t.message.saving : (editingClub ? t.common.save : (t.clubs?.add || 'Add Club'))}
              </button>
            </div>
          </form>
        </div>
      )}

      {clubs.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t.clubs?.noClubs || 'No clubs yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {t.clubs?.noClubsDesc || 'Create your first club to start organizing tournaments under its name'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            {t.clubs?.createFirst || 'Create First Club'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {clubs.map((club) => (
            <div
              key={club.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-start gap-4">
                {club.logo_url ? (
                  <img
                    src={club.logo_url}
                    alt={club.name}
                    className="w-16 h-16 object-contain bg-gray-100 rounded-lg p-1 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{club.name}</h3>
                      {club.description && (
                        <p className="text-sm text-gray-600 mt-1">{club.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(club)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {deleteConfirm === club.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(club.id)}
                            className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(club.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-500">
                    {club.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {club.city}
                      </span>
                    )}
                    {club.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {club.phone}
                      </span>
                    )}
                    {club.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {club.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
