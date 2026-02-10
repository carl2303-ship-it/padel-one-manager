import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Plus,
  X,
  Users,
  Shield,
  Coffee,
  GraduationCap,
  UserCheck,
  MoreHorizontal,
  Edit2,
  Trash2,
  Check,
  Mail,
  Phone,
  AlertCircle,
  Trophy,
  Send,
  Clock,
  CheckCircle
} from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'bar_staff' | 'coach' | 'receptionist' | 'other';
  permissions: Record<string, boolean>;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  player_id?: string | null;
  user_id?: string | null;
  invite_token?: string | null;
  invite_sent_at?: string | null;
  invite_expires_at?: string | null;
  invite_accepted_at?: string | null;
}

interface TournamentPlayer {
  id: string;
  name: string;
  email: string | null;
  phone_number: string;
  tournament_count?: number;
}

const roleIcons = {
  admin: Shield,
  bar_staff: Coffee,
  coach: GraduationCap,
  receptionist: UserCheck,
  other: MoreHorizontal
};

const roleColors = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  bar_staff: 'bg-rose-100 text-rose-700 border-rose-200',
  coach: 'bg-amber-100 text-amber-700 border-amber-200',
  receptionist: 'bg-blue-100 text-blue-700 border-blue-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200'
};

const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+');
};

export default function StaffManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [playerMatch, setPlayerMatch] = useState<TournamentPlayer | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'other' as StaffMember['role'],
    notes: '',
    is_active: true,
    permissions: {
      manage_bookings: false,
      manage_members: false,
      manage_bar: false,
      manage_academy: false,
      view_reports: false
    }
  });

  const roleLabels: Record<string, string> = {
    admin: t.staff?.admin || 'Administrator',
    bar_staff: t.staff?.barStaff || 'Bar/Restaurant',
    coach: t.staff?.coach || 'Coach',
    receptionist: t.staff?.receptionist || 'Receptionist',
    other: t.staff?.other || 'Other'
  };

  const permissionLabels: Record<string, string> = {
    manage_bookings: t.staff?.permBookings || 'Manage Bookings',
    manage_members: t.staff?.permMembers || 'Manage Members',
    manage_bar: t.staff?.permBar || 'Manage Bar',
    manage_academy: t.staff?.permAcademy || 'Manage Academy',
    view_reports: t.staff?.permReports || 'View Reports'
  };

  useEffect(() => {
    if (user) {
      loadStaff();
    }
  }, [user]);

  const loadStaff = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('club_staff')
      .select('*')
      .eq('club_owner_id', user.id)
      .order('name');

    if (data) {
      setStaff(data);
    }
    setLoading(false);
  };

  const checkPhoneForPlayer = async (phone: string) => {
    if (!phone || phone.length < 9) {
      setPlayerMatch(null);
      return;
    }

    setCheckingPhone(true);
    const normalizedPhone = normalizePhone(phone);

    const { data } = await supabase
      .from('players')
      .select('id, name, email, phone_number')
      .or(`phone_number.eq.${normalizedPhone},phone_number.eq.${phone}`)
      .limit(1)
      .maybeSingle();

    if (data) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .or(`phone_number.eq.${normalizedPhone},phone_number.eq.${phone}`);

      setPlayerMatch({
        ...data,
        tournament_count: count || 0
      });

      if (!form.name && data.name) {
        setForm(f => ({ ...f, name: data.name }));
      }
      if (!form.email && data.email) {
        setForm(f => ({ ...f, email: data.email }));
      }
    } else {
      setPlayerMatch(null);
    }
    setCheckingPhone(false);
  };

  const handlePhoneChange = (phone: string) => {
    setForm({ ...form, phone });
    if (phone.length >= 9) {
      checkPhoneForPlayer(phone);
    } else {
      setPlayerMatch(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.phone || !form.email) {
      alert(t.staff?.phoneEmailRequired || 'Phone and email are required');
      return;
    }

    setSaving(true);

    const staffData = {
      name: form.name,
      email: form.email,
      phone: normalizePhone(form.phone),
      role: form.role,
      notes: form.notes || null,
      is_active: form.is_active,
      permissions: form.permissions,
      perm_bookings: form.permissions.manage_bookings,
      perm_members: form.permissions.manage_members,
      perm_bar: form.permissions.manage_bar,
      perm_academy: form.permissions.manage_academy,
      perm_reports: form.permissions.view_reports
    };

    if (editingStaff) {
      await supabase
        .from('club_staff')
        .update(staffData)
        .eq('id', editingStaff.id);
    } else {
      await supabase
        .from('club_staff')
        .insert({
          ...staffData,
          club_owner_id: user.id
        });
    }

    setShowForm(false);
    setEditingStaff(null);
    setPlayerMatch(null);
    resetForm();
    loadStaff();
    setSaving(false);
  };

  const handleEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setForm({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      role: member.role,
      notes: member.notes || '',
      is_active: member.is_active,
      permissions: {
        manage_bookings: member.permissions?.manage_bookings || false,
        manage_members: member.permissions?.manage_members || false,
        manage_bar: member.permissions?.manage_bar || false,
        manage_academy: member.permissions?.manage_academy || false,
        view_reports: member.permissions?.view_reports || false
      }
    });
    setShowForm(true);
    if (member.phone) {
      checkPhoneForPlayer(member.phone);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.message.confirmDelete)) return;

    await supabase
      .from('club_staff')
      .delete()
      .eq('id', id);

    loadStaff();
  };

  const handleToggleActive = async (member: StaffMember) => {
    await supabase
      .from('club_staff')
      .update({ is_active: !member.is_active })
      .eq('id', member.id);

    loadStaff();
  };

  const handleSendInvite = async (member: StaffMember) => {
    if (!member.email) {
      alert(t.staff?.emailRequired || 'Email is required to send invite');
      return;
    }

    setSendingInvite(member.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-staff-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            staffId: member.id,
            clubName: t.staff?.clubName || 'PADEL ONE Manager',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invite');
      }

      alert(t.staff?.inviteSent || 'Invite sent successfully!');
      loadStaff();
    } catch (error) {
      console.error('Error sending invite:', error);
      alert(error instanceof Error ? error.message : 'Failed to send invite');
    } finally {
      setSendingInvite(null);
    }
  };

  const getInviteStatus = (member: StaffMember) => {
    if (member.user_id) {
      return 'accepted';
    }
    if (member.invite_accepted_at) {
      return 'accepted';
    }
    if (member.invite_sent_at) {
      const expiresAt = member.invite_expires_at ? new Date(member.invite_expires_at) : null;
      if (expiresAt && expiresAt < new Date()) {
        return 'expired';
      }
      return 'pending';
    }
    return 'not_sent';
  };

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      phone: '',
      role: 'other',
      notes: '',
      is_active: true,
      permissions: {
        manage_bookings: false,
        manage_members: false,
        manage_bar: false,
        manage_academy: false,
        view_reports: false
      }
    });
  };

  const filteredStaff = filterRole === 'all'
    ? staff
    : staff.filter(s => s.role === filterRole);

  const staffByRole = {
    admin: staff.filter(s => s.role === 'admin').length,
    bar_staff: staff.filter(s => s.role === 'bar_staff').length,
    coach: staff.filter(s => s.role === 'coach').length,
    receptionist: staff.filter(s => s.role === 'receptionist').length,
    other: staff.filter(s => s.role === 'other').length
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
        <h1 className="text-2xl font-bold text-gray-900">{t.staff?.title || 'Staff'}</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingStaff(null);
            setPlayerMatch(null);
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.staff?.addStaff || 'Add Staff'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(roleLabels).map(([role, label]) => {
          const Icon = roleIcons[role as keyof typeof roleIcons];
          const count = staffByRole[role as keyof typeof staffByRole];
          const isActive = filterRole === role;
          return (
            <button
              key={role}
              onClick={() => setFilterRole(filterRole === role ? 'all' : role)}
              className={`p-3 rounded-lg border transition ${
                isActive
                  ? roleColors[role as keyof typeof roleColors]
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <div className="text-2xl font-bold mt-1">{count}</div>
            </button>
          );
        })}
      </div>

      {staff.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t.staff?.noStaff || 'No staff members'}</h3>
          <p className="text-gray-500 mb-6">{t.staff?.addFirst || 'Add your first staff member'}</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            {t.staff?.addStaff || 'Add Staff'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.members?.name || 'Name'}</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.staff?.role || 'Role'}</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden md:table-cell">{t.members?.phone || 'Phone'}</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">{t.members?.email || 'Email'}</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.staff?.access || 'Access'}</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.members?.status || 'Status'}</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.common?.actions || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map(member => {
                  const RoleIcon = roleIcons[member.role];
                  const inviteStatus = getInviteStatus(member);
                  return (
                    <tr key={member.id} className={`hover:bg-gray-50 ${!member.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{member.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${roleColors[member.role]}`}>
                          <RoleIcon className="w-3 h-3" />
                          {roleLabels[member.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <a href={`tel:${member.phone}`} className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {member.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <a href={`mailto:${member.email}`} className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        {inviteStatus === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                            {t.staff?.hasAccess || 'Has Access'}
                          </span>
                        ) : inviteStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                            <Clock className="w-3 h-3" />
                            {t.staff?.invitePending || 'Pending'}
                          </span>
                        ) : inviteStatus === 'expired' ? (
                          <button
                            onClick={() => handleSendInvite(member)}
                            disabled={sendingInvite === member.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition"
                          >
                            <AlertCircle className="w-3 h-3" />
                            {t.staff?.inviteExpired || 'Expired - Resend'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendInvite(member)}
                            disabled={sendingInvite === member.id || !member.email}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition disabled:opacity-50"
                          >
                            {sendingInvite === member.id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                {t.staff?.sending || 'Sending...'}
                              </>
                            ) : (
                              <>
                                <Send className="w-3 h-3" />
                                {t.staff?.sendInvite || 'Send Invite'}
                              </>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(member)}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            member.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {member.is_active ? (t.members?.active || 'Active') : (t.members?.inactive || 'Inactive')}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(member)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(member.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingStaff ? (t.staff?.editStaff || 'Edit Staff') : (t.staff?.addStaff || 'Add Staff')}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingStaff(null);
                  setPlayerMatch(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.members?.phone || 'Phone'} * <span className="text-xs text-gray-500">(ID)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+351 912 345 678"
                    required
                  />
                  {checkingPhone && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
              </div>

              {playerMatch && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Trophy className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        {t.staff?.playerFound || 'Player found in tournaments!'}
                      </p>
                      <p className="text-sm text-green-700">
                        {playerMatch.name} - {playerMatch.tournament_count} {t.staff?.tournaments || 'tournaments'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.members?.email || 'Email'} *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="staff@club.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.members?.name || 'Name'} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.staff?.role || 'Role'} *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as StaffMember['role'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <option key={role} value={role}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.staff?.permissions || 'Permissions'}</label>
                <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.permissions[key as keyof typeof form.permissions]}
                        onChange={(e) => setForm({
                          ...form,
                          permissions: { ...form.permissions, [key]: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings?.notes || 'Notes'}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                <label htmlFor="is_active" className="text-sm text-gray-700">{t.members?.active || 'Active'}</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingStaff(null);
                    setPlayerMatch(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  {t.common?.cancel || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.phone || !form.email}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? (t.message?.saving || 'Saving...') : (t.common?.save || 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
