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
  ChevronDown,
  Copy,
  Clock,
  Settings,
  Snowflake
} from 'lucide-react';

interface CourtSlotConfig {
  time: string;
  durations: number[]; // [60, 90, 120]
}

interface ScheduleConfig {
  operating_start: string;
  operating_end: string;
  slots: CourtSlotConfig[];
}

interface CourtSlotsData {
  // New format with schedules
  schedules?: {
    summer: ScheduleConfig;
    winter: ScheduleConfig;
  };
  // Legacy format (backward compatible)
  operating_start?: string;
  operating_end?: string;
  slots?: CourtSlotConfig[];
}

interface Court {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor' | 'covered';
  hourly_rate: number;
  peak_rate: number;
  price_90min: number | null;
  price_240min: number | null;
  is_active: boolean;
  description: string | null;
  sort_order: number;
  court_slots: CourtSlotsData | null;
}

type ScheduleTab = 'summer' | 'winter';

// Helper: convert "HH:MM" to minutes, treating "00:00" as end time = 1440
const timeToMinutes = (time: string, isEndTime = false): number => {
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m;
  return isEndTime && mins === 0 ? 1440 : mins;
};

// Extract the active schedule from court_slots (handles legacy format)
const getScheduleFromCourt = (courtSlots: CourtSlotsData | null, schedule: ScheduleTab): ScheduleConfig | null => {
  if (!courtSlots) return null;
  if (courtSlots.schedules) {
    return courtSlots.schedules[schedule];
  }
  // Legacy format: use as both schedules
  if (courtSlots.operating_start && courtSlots.slots) {
    return {
      operating_start: courtSlots.operating_start,
      operating_end: courtSlots.operating_end || '22:00',
      slots: courtSlots.slots,
    };
  }
  return null;
};

export default function CourtManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSlotsConfig, setShowSlotsConfig] = useState<string | null>(null);
  const [activeSchedule, setActiveSchedule] = useState<string>('summer'); // club-wide active schedule

  const [form, setForm] = useState({
    name: '',
    type: 'indoor' as 'indoor' | 'outdoor' | 'covered',
    hourly_rate: 20,
    peak_rate: 25,
    price_90min: null as number | null,
    price_240min: null as number | null,
    is_active: true,
    description: ''
  });

  // Slot configuration state
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>('summer');
  const [slotsOperatingStart, setSlotsOperatingStart] = useState('08:00');
  const [slotsOperatingEnd, setSlotsOperatingEnd] = useState('22:00');
  const [slotsConfig, setSlotsConfig] = useState<CourtSlotConfig[]>([]);
  // Store both schedules while editing
  const [summerSchedule, setSummerSchedule] = useState<ScheduleConfig | null>(null);
  const [winterSchedule, setWinterSchedule] = useState<ScheduleConfig | null>(null);

  useEffect(() => {
    if (user) {
      loadCourts();
      loadActiveSchedule();
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

  const loadActiveSchedule = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('clubs')
      .select('active_schedule')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (data?.active_schedule) {
      setActiveSchedule(data.active_schedule);
    }
  };

  // Generate time options for opening (00:00 - 23:30)
  const generateStartTimeOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  // Generate time options for closing (00:30 - 00:00 midnight)
  const generateEndTimeOptions = () => {
    const options = [];
    for (let h = 1; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    // Add midnight as last option
    options.push('00:00');
    return options;
  };

  const startTimeOptions = generateStartTimeOptions();
  const endTimeOptions = generateEndTimeOptions();

  // Generate 30-min slots between two times (supports midnight = 1440)
  const generateSlotsForRange = (start: string, end: string): CourtSlotConfig[] => {
    const slots: CourtSlotConfig[] = [];
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end, true);
    for (let m = startMinutes; m < endMinutes; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push({ time: timeStr, durations: [60, 90, 120] });
    }
    return slots;
  };

  // Save current editing state to the schedule memory
  const saveCurrentScheduleToMemory = () => {
    const current: ScheduleConfig = {
      operating_start: slotsOperatingStart,
      operating_end: slotsOperatingEnd,
      slots: [...slotsConfig],
    };
    if (scheduleTab === 'summer') {
      setSummerSchedule(current);
    } else {
      setWinterSchedule(current);
    }
    return current;
  };

  // Load a schedule into the editing state
  const loadScheduleIntoEditor = (schedule: ScheduleConfig | null) => {
    if (schedule) {
      setSlotsOperatingStart(schedule.operating_start);
      setSlotsOperatingEnd(schedule.operating_end);
      setSlotsConfig(schedule.slots.map(s => ({ ...s })));
    } else {
      setSlotsOperatingStart('08:00');
      setSlotsOperatingEnd('22:00');
      setSlotsConfig(generateSlotsForRange('08:00', '22:00'));
    }
  };

  // Open slot config for a court
  const openSlotsConfig = (court: Court) => {
    const summer = getScheduleFromCourt(court.court_slots, 'summer');
    const winter = getScheduleFromCourt(court.court_slots, 'winter');
    setSummerSchedule(summer);
    setWinterSchedule(winter);
    // Start on the active schedule tab
    const startTab = (activeSchedule === 'winter' ? 'winter' : 'summer') as ScheduleTab;
    setScheduleTab(startTab);
    loadScheduleIntoEditor(startTab === 'summer' ? summer : winter);
    setShowSlotsConfig(court.id);
  };

  // Switch between summer/winter tabs
  const handleScheduleTabChange = (newTab: ScheduleTab) => {
    // Save current tab's state
    saveCurrentScheduleToMemory();
    // Switch tab
    setScheduleTab(newTab);
    // Load the other tab's state
    if (newTab === 'summer') {
      loadScheduleIntoEditor(summerSchedule);
    } else {
      loadScheduleIntoEditor(winterSchedule);
    }
  };

  const handleSlotsStartChange = (newStart: string) => {
    setSlotsOperatingStart(newStart);
    const newSlots = generateSlotsForRange(newStart, slotsOperatingEnd);
    const merged = newSlots.map(ns => {
      const existing = slotsConfig.find(s => s.time === ns.time);
      return existing || ns;
    });
    setSlotsConfig(merged);
  };

  const handleSlotsEndChange = (newEnd: string) => {
    setSlotsOperatingEnd(newEnd);
    const newSlots = generateSlotsForRange(slotsOperatingStart, newEnd);
    const merged = newSlots.map(ns => {
      const existing = slotsConfig.find(s => s.time === ns.time);
      return existing || ns;
    });
    setSlotsConfig(merged);
  };

  const toggleSlotDuration = (slotTime: string, duration: number) => {
    setSlotsConfig(prev => prev.map(slot => {
      if (slot.time !== slotTime) return slot;
      const hasDuration = slot.durations.includes(duration);
      const newDurations = hasDuration
        ? slot.durations.filter(d => d !== duration)
        : [...slot.durations, duration].sort((a, b) => a - b);
      return { ...slot, durations: newDurations };
    }));
  };

  const setAllSlotsDuration = (duration: number, enabled: boolean) => {
    setSlotsConfig(prev => prev.map(slot => {
      if (enabled) {
        return { ...slot, durations: slot.durations.includes(duration) ? slot.durations : [...slot.durations, duration].sort((a, b) => a - b) };
      } else {
        return { ...slot, durations: slot.durations.filter(d => d !== duration) };
      }
    }));
  };

  const selectAllDurations = () => {
    setSlotsConfig(prev => prev.map(slot => ({ ...slot, durations: [60, 90, 120] })));
  };

  // Copy current schedule to the other one
  const copySummerToWinter = () => {
    const current = saveCurrentScheduleToMemory();
    if (scheduleTab === 'summer') {
      setWinterSchedule({ ...current, slots: current.slots.map(s => ({ ...s, durations: [...s.durations] })) });
      alert('Horário de verão copiado para inverno!');
    } else {
      setSummerSchedule({ ...current, slots: current.slots.map(s => ({ ...s, durations: [...s.durations] })) });
      alert('Horário de inverno copiado para verão!');
    }
  };

  const handleSaveSlotsConfig = async (courtId: string) => {
    // Save current editing tab
    const currentSchedule: ScheduleConfig = {
      operating_start: slotsOperatingStart,
      operating_end: slotsOperatingEnd,
      slots: slotsConfig.filter(s => s.durations.length > 0)
    };

    const finalSummer = scheduleTab === 'summer' ? currentSchedule : (summerSchedule || {
      operating_start: '08:00',
      operating_end: '22:00',
      slots: generateSlotsForRange('08:00', '22:00')
    });
    const finalWinter = scheduleTab === 'winter' ? currentSchedule : (winterSchedule || {
      operating_start: '09:00',
      operating_end: '21:00',
      slots: generateSlotsForRange('09:00', '21:00')
    });

    const courtSlotsData: CourtSlotsData = {
      schedules: {
        summer: {
          ...finalSummer,
          slots: finalSummer.slots.filter(s => s.durations.length > 0)
        },
        winter: {
          ...finalWinter,
          slots: finalWinter.slots.filter(s => s.durations.length > 0)
        }
      }
    };

    const { error } = await supabase
      .from('club_courts')
      .update({ court_slots: courtSlotsData })
      .eq('id', courtId);

    if (!error) {
      setShowSlotsConfig(null);
      loadCourts();
    } else {
      alert('Erro ao guardar slots: ' + error.message);
    }
  };

  const handleCopyCourt = async (court: Court) => {
    if (!user) return;
    const maxSortOrder = courts.length > 0 ? Math.max(...courts.map(c => c.sort_order)) : -1;
    const newName = `${court.name} (cópia)`;

    const { error } = await supabase
      .from('club_courts')
      .insert({
        user_id: user.id,
        name: newName,
        type: court.type,
        hourly_rate: court.hourly_rate,
        peak_rate: court.peak_rate,
        is_active: court.is_active,
        description: court.description,
        sort_order: maxSortOrder + 1,
        court_slots: court.court_slots
      });

    if (!error) {
      loadCourts();
    } else {
      alert('Erro ao copiar campo: ' + error.message);
    }
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
          price_90min: form.price_90min,
          price_240min: form.price_240min,
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
      const defaultSchedule: ScheduleConfig = {
        operating_start: '08:00',
        operating_end: '22:00',
        slots: generateSlotsForRange('08:00', '22:00')
      };
      const defaultSlots: CourtSlotsData = {
        schedules: {
          summer: { ...defaultSchedule },
          winter: { ...defaultSchedule, operating_end: '21:00', slots: generateSlotsForRange('08:00', '21:00') }
        }
      };

      const { error } = await supabase
        .from('club_courts')
        .insert({
          user_id: user.id,
          name: form.name,
          type: form.type,
          hourly_rate: form.hourly_rate,
          peak_rate: form.peak_rate,
          price_90min: form.price_90min,
          price_240min: form.price_240min,
          is_active: form.is_active,
          description: form.description || null,
          sort_order: maxSortOrder + 1,
          court_slots: defaultSlots
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
      price_90min: court.price_90min,
      price_240min: court.price_240min,
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
    if (!error) loadCourts();
  };

  const handleToggleActive = async (court: Court) => {
    const { error } = await supabase
      .from('club_courts')
      .update({ is_active: !court.is_active })
      .eq('id', court.id);
    if (!error) loadCourts();
  };

  const resetForm = () => {
    setForm({
      name: '',
      type: 'indoor',
      hourly_rate: 20,
      peak_rate: 25,
      price_90min: null,
      price_240min: null,
      is_active: true,
      description: ''
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'indoor': return Building;
      case 'outdoor': return Sun;
      case 'covered': return Umbrella;
      default: return MapPin;
    }
  };

  // Summary for the court card - shows the active schedule
  const getSlotsSummary = (court: Court) => {
    const schedule = getScheduleFromCourt(court.court_slots, activeSchedule as ScheduleTab);
    if (!schedule) return null;
    const activeSlots = schedule.slots.filter(s => s.durations.length > 0);
    const hasSchedules = court.court_slots?.schedules != null;
    return {
      total: activeSlots.length,
      start: schedule.operating_start,
      end: schedule.operating_end === '00:00' ? '00:00 (meia-noite)' : schedule.operating_end,
      hasSchedules,
    };
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

      {/* Active schedule indicator */}
      <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-100 p-3">
        <span className="text-sm text-gray-600">Horário ativo:</span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
          activeSchedule === 'summer'
            ? 'bg-orange-100 text-orange-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {activeSchedule === 'summer' ? (
            <><Sun className="w-3.5 h-3.5" /> Verão</>
          ) : (
            <><Snowflake className="w-3.5 h-3.5" /> Inverno</>
          )}
        </span>
        <span className="text-xs text-gray-400 ml-2">
          (Altere em Definições → Clubes → Editar Clube)
        </span>
      </div>

      {courts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t.courts.noCourts}</h3>
          <p className="text-gray-500 mb-6">{t.courts.addFirst}</p>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
            {t.courts.addCourt}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courts.map((court, index) => {
            const TypeIcon = getTypeIcon(court.type);
            const slotsSummary = getSlotsSummary(court);
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
                      <button onClick={() => handleMoveUp(court, index)} disabled={index === 0} className={`p-1 rounded transition ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`} title="Mover para cima">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleMoveDown(court, index)} disabled={index === courts.length - 1} className={`p-1 rounded transition ${index === courts.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`} title="Mover para baixo">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded ${court.is_active ? 'bg-white/20' : 'bg-red-500'}`}>
                        {court.is_active ? t.courts.active : t.courts.inactive}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.courts.type}</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">{t.courts[court.type as keyof typeof t.courts] || court.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.courts.hourlyRate}</span>
                    <span className="text-sm font-medium text-gray-900">{court.hourly_rate} EUR</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t.courts.peakRate}</span>
                    <span className="text-sm font-medium text-gray-900">{court.peak_rate} EUR</span>
                  </div>

                  {/* Slots summary */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-sm text-gray-500">Slots</span>
                    </div>
                    {slotsSummary ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {slotsSummary.start}-{slotsSummary.end} · {slotsSummary.total} slots
                        </span>
                        {slotsSummary.hasSchedules && (
                          <span className="text-[10px] text-gray-400">☀️❄️</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Não configurado</span>
                    )}
                  </div>

                  {court.description && (
                    <p className="text-sm text-gray-500 pt-2 border-t border-gray-100">{court.description}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 pt-3 border-t border-gray-100">
                    <button onClick={() => openSlotsConfig(court)} className="flex-1 px-2 py-2 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition flex items-center justify-center gap-1" title="Configurar Slots">
                      <Settings className="w-4 h-4" /> Slots
                    </button>
                    <button onClick={() => handleEdit(court)} className="flex-1 px-2 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center gap-1">
                      <Edit2 className="w-4 h-4" /> {t.common.edit}
                    </button>
                    <button onClick={() => handleCopyCourt(court)} className="px-2 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition flex items-center justify-center gap-1" title="Copiar Campo">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleToggleActive(court)} className={`px-2 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-1 ${court.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}>
                      {court.is_active ? '⏸' : '▶'}
                    </button>
                    <button onClick={() => handleDelete(court.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
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
              <h2 className="text-lg font-semibold text-gray-900">{editingCourt ? t.courts.editCourt : t.courts.addCourt}</h2>
              <button onClick={() => { setShowForm(false); setEditingCourt(null); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.name}</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Court 1" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.type}</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="indoor">{t.courts.indoor}</option>
                  <option value="outdoor">{t.courts.outdoor}</option>
                  <option value="covered">{t.courts.covered}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.hourlyRate} (EUR) — 60min</label>
                  <input type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="0" step="0.01" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.peakRate} (EUR)</label>
                  <input type="number" value={form.peak_rate} onChange={(e) => setForm({ ...form, peak_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="0" step="0.01" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço 90min (EUR)</label>
                  <input type="number" value={form.price_90min ?? ''} onChange={(e) => setForm({ ...form, price_90min: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="0" step="0.01" placeholder={`Auto: ${(form.hourly_rate * 1.5).toFixed(2)}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço 240min / 4h (EUR)</label>
                  <input type="number" value={form.price_240min ?? ''} onChange={(e) => setForm({ ...form, price_240min: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="0" step="0.01" placeholder={`Auto: ${(form.hourly_rate * 4).toFixed(2)}`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.courts.description}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows={2} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                <label htmlFor="is_active" className="text-sm text-gray-700">{t.courts.active}</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingCourt(null); resetForm(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">{t.common.cancel}</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Check className="w-4 h-4" />
                  {saving ? t.message.saving : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slots Configuration Modal */}
      {showSlotsConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-green-600" />
                  Configurar Slots — {courts.find(c => c.id === showSlotsConfig)?.name}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Configure os slots para cada período (verão/inverno)
                </p>
              </div>
              <button onClick={() => setShowSlotsConfig(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Schedule tabs */}
              <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleScheduleTabChange('summer')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    scheduleTab === 'summer'
                      ? 'bg-white text-orange-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  Horário de Verão
                </button>
                <button
                  type="button"
                  onClick={() => handleScheduleTabChange('winter')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    scheduleTab === 'winter'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Snowflake className="w-4 h-4" />
                  Horário de Inverno
                </button>
              </div>

              {/* Copy schedule button */}
              <button
                type="button"
                onClick={copySummerToWinter}
                className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition font-medium flex items-center gap-1.5"
              >
                <Copy className="w-3 h-3" />
                Copiar {scheduleTab === 'summer' ? 'verão → inverno' : 'inverno → verão'}
              </button>

              {/* Operating hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Abertura</label>
                  <select value={slotsOperatingStart} onChange={(e) => handleSlotsStartChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    {startTimeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Fecho</label>
                  <select value={slotsOperatingEnd} onChange={(e) => handleSlotsEndChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    {endTimeOptions.map(time => (
                      <option key={time} value={time}>
                        {time === '00:00' ? '00:00 (Meia-noite)' : time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-600">Ações rápidas:</span>
                <button type="button" onClick={selectAllDurations} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium">✅ Tudo ativo</button>
                <button type="button" onClick={() => setAllSlotsDuration(60, true)} className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition font-medium">Todos 60min</button>
                <button type="button" onClick={() => setAllSlotsDuration(90, true)} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition font-medium">Todos 90min</button>
                <button type="button" onClick={() => setAllSlotsDuration(120, true)} className="text-xs px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition font-medium">Todos 120min</button>
              </div>

              {/* Slots grid */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-4 gap-0 p-3 border-b border-gray-200 bg-gray-100">
                  <div className="text-sm font-semibold text-gray-700">Hora</div>
                  <div className="text-center"><span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">60 min</span></div>
                  <div className="text-center"><span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">90 min</span></div>
                  <div className="text-center"><span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">120 min</span></div>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {slotsConfig.map((slot, idx) => {
                    const isEven = idx % 2 === 0;
                    const slotMinutes = timeToMinutes(slot.time);
                    const endMinutes = timeToMinutes(slotsOperatingEnd, true);

                    return (
                      <div key={slot.time} className={`grid grid-cols-4 gap-0 p-2 items-center ${isEven ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition`}>
                        <div className="text-sm font-medium text-gray-800 pl-1">{slot.time}</div>
                        {[60, 90, 120].map(duration => {
                          const fitsInSchedule = slotMinutes + duration <= endMinutes;
                          const isActive = slot.durations.includes(duration);
                          return (
                            <div key={duration} className="flex justify-center">
                              {fitsInSchedule ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSlotDuration(slot.time, duration)}
                                  className={`w-10 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                                    isActive
                                      ? duration === 60 ? 'bg-green-500 border-green-500 text-white shadow-sm'
                                        : duration === 90 ? 'bg-purple-500 border-purple-500 text-white shadow-sm'
                                        : 'bg-orange-500 border-orange-500 text-white shadow-sm'
                                      : 'bg-white border-gray-200 text-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  {isActive ? <Check className="w-4 h-4" /> : <span className="text-xs">—</span>}
                                </button>
                              ) : (
                                <div className="w-10 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center" title="Excede o horário de fecho">
                                  <X className="w-3 h-3 text-gray-300" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-gray-500">
                {slotsConfig.filter(s => s.durations.length > 0).length} de {slotsConfig.length} slots ativos
                ({scheduleTab === 'summer' ? '☀️ Verão' : '❄️ Inverno'})
              </p>

              {/* Save / Cancel buttons */}
              <div className="flex gap-3 pt-2 sticky bottom-0 bg-white py-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowSlotsConfig(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
                <button type="button" onClick={() => handleSaveSlotsConfig(showSlotsConfig)} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  Guardar Slots (Verão + Inverno)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
