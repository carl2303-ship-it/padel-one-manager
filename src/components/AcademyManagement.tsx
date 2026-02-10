import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Plus,
  X,
  GraduationCap,
  Users,
  Calendar,
  Clock,
  Check,
  Edit2,
  Trash2,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Search,
  UserCheck,
  TrendingUp,
  Building2
} from 'lucide-react';

interface Court {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
}

interface StaffCoach {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar_url?: string | null;
}

interface ClassType {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  max_students: number;
  price_per_class: number;
  is_active: boolean;
}

interface ClassEnrollment {
  id: string;
  class_id: string;
  student_name: string | null;
  status: string;
  member_subscription_id?: string | null;
  organizer_player_id?: string | null;
}

interface OrganizerPlayer {
  id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
}

interface ScheduledClass {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  coach_id: string | null;
  class_type_id: string;
  court_id: string | null;
  level: string | null;
  gender: 'M' | 'F' | 'Misto' | null;
  coach_name?: string;
  coach_avatar?: string | null;
  coach_email?: string;
  club_owner_id?: string;
  class_type?: ClassType;
  court?: Court;
  enrollments?: ClassEnrollment[];
}

interface AcademyManagementProps {
  staffClubOwnerId?: string | null;
}

export default function AcademyManagement({ staffClubOwnerId }: AcademyManagementProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const [activeTab, setActiveTab] = useState<'classes' | 'types'>('classes');
  const [coaches, setCoaches] = useState<StaffCoach[]>([]);
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [classes, setClasses] = useState<ScheduledClass[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);
  const [editingType, setEditingType] = useState<ClassType | null>(null);
  const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [selectedClassForStudent, setSelectedClassForStudent] = useState<ScheduledClass | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [players, setPlayers] = useState<OrganizerPlayer[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<OrganizerPlayer | null>(null);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [isCreatingNewPlayer, setIsCreatingNewPlayer] = useState(false);

  const [typeForm, setTypeForm] = useState({
    name: '',
    description: '',
    duration_minutes: 60,
    max_students: 4,
    price_per_class: 25
  });

  const [classForm, setClassForm] = useState({
    coach_id: '',
    class_type_id: '',
    court_id: '',
    date: '',
    time: '09:00',
    notes: '',
    level: '',
    gender: 'Misto' as 'M' | 'F' | 'Misto'
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    console.log('[AcademyManagement] Loading data with:', { 
      user_id: user.id, 
      effectiveUserId,
      staffClubOwnerId 
    });

    const [coachesResult, typesResult, classesResult, courtsResult, playersResult] = await Promise.all([
      supabase
        .from('club_staff')
        .select('id, name, phone, email')
        .eq('club_owner_id', effectiveUserId)
        .eq('role', 'coach')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('class_types')
        .select('*')
        .eq('club_owner_id', effectiveUserId)
        .order('name'),
      supabase
        .from('club_classes')
        .select(`
          *,
          class_type:class_types(*),
          court:club_courts(id, name, type)
        `)
        .eq('club_owner_id', effectiveUserId)
        .order('scheduled_at', { ascending: false })
        .limit(50),
      supabase
        .from('club_courts')
        .select('id, name, type, hourly_rate')
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('organizer_players')
        .select('id, name, email, phone_number')
        .eq('organizer_id', effectiveUserId)
        .order('name')
    ]);

    console.log('[AcademyManagement] Results:', {
      coaches: coachesResult.data?.length || 0,
      types: typesResult.data?.length || 0,
      classes: classesResult.data?.length || 0,
      courts: courtsResult.data?.length || 0,
      players: playersResult.data?.length || 0,
      coachesError: coachesResult.error,
      typesError: typesResult.error,
      classesError: classesResult.error
    });

    if (coachesResult.data) setCoaches(coachesResult.data);
    if (typesResult.data) setClassTypes(typesResult.data);
    if (courtsResult.data) setCourts(courtsResult.data);
    if (playersResult.data) setPlayers(playersResult.data);

    if (classesResult.data) {
      const classIds = classesResult.data.map((c: any) => c.id);
      
      let enrollmentsData: any[] = [];
      if (classIds.length > 0) {
        const { data } = await supabase
          .from('class_enrollments')
          .select('id, class_id, student_name, status, member_subscription_id, organizer_player_id')
          .in('class_id', classIds)
          .in('status', ['enrolled', 'attended']);
        enrollmentsData = data || [];
      }

      const classesWithCoach = classesResult.data.map((cls: any) => {
        const coach = coachesResult.data?.find(c => c.id === cls.coach_id);
        const classEnrollments = enrollmentsData?.filter(e => e.class_id === cls.id) || [];
        return {
          ...cls,
          coach_name: coach?.name || (cls.coach_id ? 'Unknown' : 'No coach'),
          coach_avatar: null, // avatar_url não existe na tabela club_staff
          coach_email: coach?.email || null,
          enrollments: classEnrollments
        };
      });
      
      // Filtrar apenas aulas futuras para exibir
      const now = new Date().toISOString();
      const futureClasses = classesWithCoach.filter((cls: any) => cls.scheduled_at >= now);
      
      console.log('[AcademyManagement] Classes processed:', {
        total: classesWithCoach.length,
        future: futureClasses.length,
        sample: classesWithCoach[0]
      });
      
      setClasses(futureClasses as ScheduledClass[]);
    } else {
      console.log('[AcademyManagement] No classes data returned');
      setClasses([]);
    }
    setLoading(false);
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    if (editingType) {
      await supabase
        .from('class_types')
        .update({
          name: typeForm.name,
          description: typeForm.description || null,
          duration_minutes: typeForm.duration_minutes,
          max_students: typeForm.max_students,
          price_per_class: typeForm.price_per_class
        })
        .eq('id', editingType.id);
    } else {
      await supabase.from('class_types').insert({
        club_owner_id: effectiveUserId,
        name: typeForm.name,
        description: typeForm.description || null,
        duration_minutes: typeForm.duration_minutes,
        max_students: typeForm.max_students,
        price_per_class: typeForm.price_per_class
      });
    }

    setShowTypeForm(false);
    setEditingType(null);
    resetTypeForm();
    loadData();
    setSaving(false);
  };

  const handleScheduleClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const [hours, minutes] = classForm.time.split(':').map(Number);
    const scheduledAt = new Date(classForm.date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const classType = classTypes.find(ct => ct.id === classForm.class_type_id);
    const durationMinutes = classType?.duration_minutes || 60;

    const levelValue = classForm.level?.trim() || null;
    const genderValue = classForm.gender || 'Misto';
    
    // Construir objeto de update
    const updateData: any = {
      coach_id: classForm.coach_id === '' ? null : classForm.coach_id,
      class_type_id: classForm.class_type_id,
      court_id: classForm.court_id === '' ? null : classForm.court_id,
      scheduled_at: scheduledAt.toISOString(),
      notes: classForm.notes?.trim() || null
    };
    
    // Adicionar level e gender (se a migration foi executada, estes campos existem)
    // Se level for null, ainda enviamos null (a coluna aceita null)
    if (levelValue !== null && levelValue !== '') {
      updateData.level = levelValue;
    } else {
      updateData.level = null;
    }
    updateData.gender = genderValue;
    
    console.log('[AcademyManagement] Saving class with:', {
      level: levelValue,
      gender: genderValue,
      updateData: updateData,
      classForm: classForm
    });

    if (editingClass) {
      const { data, error } = await supabase
        .from('club_classes')
        .update(updateData)
        .eq('id', editingClass.id)
        .select();
      
      if (error) {
        console.error('[AcademyManagement] Error updating class:', error);
        console.error('[AcademyManagement] Error details:', JSON.stringify(error, null, 2));
        console.error('[AcademyManagement] Update data sent:', JSON.stringify(updateData, null, 2));
        alert('Erro ao atualizar aula: ' + (error.message || error.details || JSON.stringify(error)));
        setSaving(false);
        return;
      }
      
      console.log('[AcademyManagement] Class updated successfully:', data);
    } else {
      const insertData: any = {
        club_owner_id: effectiveUserId,
        coach_id: classForm.coach_id === '' ? null : classForm.coach_id,
        class_type_id: classForm.class_type_id,
        court_id: classForm.court_id === '' ? null : classForm.court_id,
        scheduled_at: scheduledAt.toISOString(),
        notes: classForm.notes?.trim() || null
      };
      
      // Adicionar level e gender
      if (levelValue !== null && levelValue !== '') {
        insertData.level = levelValue;
      } else {
        insertData.level = null;
      }
      insertData.gender = genderValue;
      
      console.log('[AcademyManagement] Inserting class with:', insertData);
      
      const { data: newClass, error } = await supabase
        .from('club_classes')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        console.error('[AcademyManagement] Error creating class:', error);
        console.error('[AcademyManagement] Error details:', JSON.stringify(error, null, 2));
        console.error('[AcademyManagement] Insert data sent:', JSON.stringify(insertData, null, 2));
        alert('Erro ao criar aula: ' + (error.message || error.details || JSON.stringify(error)));
        setSaving(false);
        return;
      }
      
      console.log('[AcademyManagement] Class created:', newClass);

      if (newClass && classForm.court_id) {
        const endTime = new Date(scheduledAt);
        endTime.setMinutes(scheduledAt.getMinutes() + durationMinutes);

        const coach = coaches.find(c => c.id === classForm.coach_id);

        await supabase.from('court_bookings').insert({
          user_id: effectiveUserId,
          court_id: classForm.court_id,
          start_time: scheduledAt.toISOString(),
          end_time: endTime.toISOString(),
          booked_by_name: coach?.name || classType?.name || 'Class',
          status: 'confirmed',
          price: 0,
          payment_status: 'paid',
          event_type: 'training',
          notes: `${classType?.name || 'Class'}${coach ? ` - ${coach.name}` : ''}`
        });
      }
    }

    setShowClassForm(false);
    setEditingClass(null);
    resetClassForm();
    loadData();
    setSaving(false);
  };

  const handleEditType = (type: ClassType) => {
    setEditingType(type);
    setTypeForm({
      name: type.name,
      description: type.description || '',
      duration_minutes: type.duration_minutes,
      max_students: type.max_students,
      price_per_class: type.price_per_class
    });
    setShowTypeForm(true);
  };

  const handleEditClass = (cls: ScheduledClass) => {
    setEditingClass(cls);
    const scheduledAt = new Date(cls.scheduled_at);
    const dateStr = scheduledAt.toISOString().split('T')[0];
    const timeStr = `${scheduledAt.getHours().toString().padStart(2, '0')}:${scheduledAt.getMinutes().toString().padStart(2, '0')}`;
    setClassForm({
      coach_id: cls.coach_id || '',
      class_type_id: cls.class_type_id,
      court_id: cls.court_id || '',
      date: dateStr,
      time: timeStr,
      notes: cls.notes || '',
      level: cls.level || '',
      gender: cls.gender || 'Misto'
    });
    setShowClassForm(true);
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm(t.message.confirmDelete)) return;
    await supabase.from('class_types').delete().eq('id', id);
    loadData();
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm(t.message.confirmDelete)) return;
    await supabase.from('club_classes').delete().eq('id', id);
    loadData();
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForStudent || !studentName.trim() || !user) return;

    setSaving(true);

    let playerId = selectedPlayer?.id || null;

    if (isCreatingNewPlayer && !selectedPlayer) {
      const { data: newPlayer, error } = await supabase
        .from('organizer_players')
        .insert({
          organizer_id: effectiveUserId,
          name: studentName.trim(),
          email: studentEmail.trim() || null,
          phone_number: studentPhone.trim() || null
        })
        .select()
        .single();

      if (newPlayer && !error) {
        playerId = newPlayer.id;
      }
    }

    await supabase.from('class_enrollments').insert({
      class_id: selectedClassForStudent.id,
      student_name: studentName.trim(),
      status: 'enrolled',
      organizer_player_id: playerId
    });

    setShowStudentForm(false);
    setSelectedClassForStudent(null);
    setStudentName('');
    setStudentEmail('');
    setStudentPhone('');
    setSelectedPlayer(null);
    setPlayerSearch('');
    setIsCreatingNewPlayer(false);
    loadData();
    setSaving(false);
  };

  const handleRemoveStudent = async (enrollmentId: string) => {
    if (!confirm(t.message.confirmDelete)) return;
    await supabase.from('class_enrollments').delete().eq('id', enrollmentId);
    loadData();
  };

  const openStudentForm = (cls: ScheduledClass) => {
    setSelectedClassForStudent(cls);
    setStudentName('');
    setStudentEmail('');
    setStudentPhone('');
    setSelectedPlayer(null);
    setPlayerSearch('');
    setShowPlayerDropdown(false);
    setIsCreatingNewPlayer(false);
    setShowStudentForm(true);
  };

  const handleSelectPlayer = (player: OrganizerPlayer) => {
    setSelectedPlayer(player);
    setStudentName(player.name);
    setStudentEmail(player.email || '');
    setStudentPhone(player.phone_number || '');
    setPlayerSearch('');
    setShowPlayerDropdown(false);
    setIsCreatingNewPlayer(false);
  };

  const handleClearPlayer = () => {
    setSelectedPlayer(null);
    setStudentName('');
    setStudentEmail('');
    setStudentPhone('');
    setPlayerSearch('');
  };

  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(playerSearch.toLowerCase())) ||
    (p.phone_number && p.phone_number.includes(playerSearch))
  );

  const resetTypeForm = () => {
    setTypeForm({
      name: '',
      description: '',
      duration_minutes: 60,
      max_students: 4,
      price_per_class: 25
    });
  };

  const resetClassForm = () => {
    setClassForm({
      coach_id: '',
      class_type_id: '',
      court_id: '',
      date: '',
      time: '09:00',
      notes: '',
      level: '',
      gender: 'Misto'
    });
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let h = 7; h <= 22; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${dayName}, ${day} ${monthName} ${hours}:${minutes}`;
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
        <h1 className="text-2xl font-bold text-gray-900">{t.academy.title}</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('classes')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === 'classes' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              {t.academy.classes}
            </button>
            <button
              onClick={() => setActiveTab('types')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === 'types' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              {t.academy.classTypes}
            </button>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'classes') {
                resetClassForm();
                setEditingClass(null);
                setShowClassForm(true);
              } else {
                resetTypeForm();
                setEditingType(null);
                setShowTypeForm(true);
              }
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'classes' ? t.academy.scheduleClass : t.academy.addClassType}
          </button>
        </div>
      </div>

      {coaches.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 text-sm">
            {t.academy.noCoaches || 'No coaches found. Add coaches in the Staff section with the "Coach" role.'}
          </p>
        </div>
      )}

      {activeTab === 'classes' && (
        classes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.academy.noClasses}</h3>
            {coaches.length > 0 && classTypes.length > 0 && (
              <button
                onClick={() => setShowClassForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition mt-4"
              >
                {t.academy.scheduleClass}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            {classes.map(cls => {
              const isExpanded = expandedClassId === cls.id;
              const enrollmentCount = cls.enrollments?.length || 0;
              const maxStudents = cls.class_type?.max_students || 4;
              const isFull = enrollmentCount >= maxStudents;

              return (
                <div key={cls.id} className="divide-y divide-gray-50">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <GraduationCap className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{cls.class_type?.name}</div>
                        <div className="text-sm text-gray-500">{cls.coach_name}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                          {cls.level && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Nível: {cls.level}
                            </span>
                          )}
                          {cls.gender && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {cls.gender === 'M' ? '♂ Masculino' : cls.gender === 'F' ? '♀ Feminino' : '⚥ Misto'}
                            </span>
                          )}
                        </div>
                        {cls.notes && <div className="text-xs text-gray-400 mt-1">{cls.notes}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExpandedClassId(isExpanded ? null : cls.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          enrollmentCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        {enrollmentCount}/{maxStudents}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">{formatDateTime(cls.scheduled_at)}</div>
                        <div className="text-xs text-gray-500">{cls.class_type?.duration_minutes} min</div>
                      </div>
                      <button
                        onClick={() => handleEditClass(cls)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(cls.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 py-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700">{t.academy?.students || 'Students'}</h4>
                        {!isFull && (
                          <button
                            onClick={() => openStudentForm(cls)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                          >
                            <UserPlus className="w-4 h-4" />
                            {t.academy?.addStudent || 'Add Student'}
                          </button>
                        )}
                      </div>

                      {enrollmentCount === 0 ? (
                        <p className="text-sm text-gray-500 py-2">{t.academy?.noStudents || 'No students enrolled yet'}</p>
                      ) : (
                        <div className="space-y-2">
                          {cls.enrollments?.map(enrollment => {
                            const isLinkedPlayer = enrollment.organizer_player_id || enrollment.member_subscription_id;
                            return (
                              <div key={enrollment.id} className={`flex items-center justify-between p-2 rounded-lg border ${isLinkedPlayer ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center gap-2">
                                  {isLinkedPlayer && (
                                    <UserCheck className="w-4 h-4 text-emerald-600" />
                                  )}
                                  <span className={`text-sm font-medium ${isLinkedPlayer ? 'text-emerald-800' : 'text-gray-900'}`}>
                                    {enrollment.student_name || 'Unknown'}
                                  </span>
                                  {isLinkedPlayer && (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                      {t.academy?.linkedPlayer || 'Player'}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRemoveStudent(enrollment.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isFull && (
                        <p className="text-xs text-amber-600 mt-2">{t.academy?.classFull || 'Class is full'}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'types' && (
        classTypes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.academy.noClasses}</h3>
            <button
              onClick={() => setShowTypeForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition mt-4"
            >
              {t.academy.addClassType}
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {classTypes.map(type => (
              <div key={type.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-amber-600 text-white">
                  <div className="font-medium">{type.name}</div>
                </div>
                <div className="p-4 space-y-2">
                  {type.description && <p className="text-sm text-gray-600">{type.description}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {type.duration_minutes} min</span>
                    <span className="text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> Max {type.max_students}</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900">{type.price_per_class} EUR</div>
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEditType(type)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t.common.edit}
                    </button>
                    <button
                      onClick={() => handleDeleteType(type.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Class Type Form Modal */}
      {showTypeForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingType ? t.common.edit : t.academy.addClassType}
              </h2>
              <button onClick={() => { setShowTypeForm(false); setEditingType(null); resetTypeForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddType} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.academy.className}</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bar.description}</label>
                <textarea
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.academy.duration}</label>
                  <select
                    value={typeForm.duration_minutes}
                    onChange={(e) => setTypeForm({ ...typeForm, duration_minutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.academy.maxStudents}</label>
                  <input
                    type="number"
                    value={typeForm.max_students}
                    onChange={(e) => setTypeForm({ ...typeForm, max_students: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.academy.pricePerClass} (EUR)</label>
                <input
                  type="number"
                  value={typeForm.price_per_class}
                  onChange={(e) => setTypeForm({ ...typeForm, price_per_class: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowTypeForm(false); setEditingType(null); resetTypeForm(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Check className="w-4 h-4" />
                  {saving ? t.message.saving : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Class Form Modal */}
      {showClassForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingClass ? t.common.edit : t.academy.scheduleClass}
              </h2>
              <button onClick={() => { setShowClassForm(false); setEditingClass(null); resetClassForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleScheduleClass} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.academy.selectCoach}</label>
                <select
                  value={classForm.coach_id}
                  onChange={(e) => setClassForm({ ...classForm, coach_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No coach assigned</option>
                  {coaches.map(coach => (
                    <option key={coach.id} value={coach.id}>{coach.name}</option>
                  ))}
                </select>
                {coaches.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Add coaches in Staff section first</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.academy.selectClassType} *</label>
                <select
                  value={classForm.class_type_id}
                  onChange={(e) => setClassForm({ ...classForm, class_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">{t.academy.selectClassType}</option>
                  {classTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name} - {type.price_per_class} EUR ({type.duration_minutes} min)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings?.selectCourt || 'Court'}</label>
                <select
                  value={classForm.court_id}
                  onChange={(e) => setClassForm({ ...classForm, court_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t.common?.optional || 'Optional'}</option>
                  {courts.map(court => (
                    <option key={court.id} value={court.id}>{court.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{t.academy?.courtHint || 'If selected, a booking will be created automatically'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings?.selectDate || 'Date'} *</label>
                  <input
                    type="date"
                    value={classForm.date}
                    onChange={(e) => setClassForm({ ...classForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings?.selectTime || 'Time'} *</label>
                  <select
                    value={classForm.time}
                    onChange={(e) => setClassForm({ ...classForm, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {timeSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings?.notes || 'Notes'}</label>
                <textarea
                  value={classForm.notes}
                  onChange={(e) => setClassForm({ ...classForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nível (ex: 0-7, 0-3, 5-7)</label>
                  <input
                    type="text"
                    value={classForm.level}
                    onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0-7"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
                  <select
                    value={classForm.gender}
                    onChange={(e) => setClassForm({ ...classForm, gender: e.target.value as 'M' | 'F' | 'Misto' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Misto">Misto</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowClassForm(false); setEditingClass(null); resetClassForm(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
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

      {showStudentForm && selectedClassForStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {t.academy?.addStudent || 'Add Student'}
              </h2>
              <button onClick={() => { setShowStudentForm(false); setSelectedClassForStudent(null); setStudentName(''); setStudentEmail(''); setStudentPhone(''); setSelectedPlayer(null); setPlayerSearch(''); setIsCreatingNewPlayer(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="p-4 space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-amber-800">{selectedClassForStudent.class_type?.name}</div>
                <div className="text-xs text-amber-600">{formatDateTime(selectedClassForStudent.scheduled_at)}</div>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.academy?.searchPlayer || 'Search Existing Player'}
                </label>
                {selectedPlayer ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-emerald-600" />
                      <div>
                        <div className="text-sm font-medium text-emerald-800">{selectedPlayer.name}</div>
                        {selectedPlayer.email && (
                          <div className="text-xs text-emerald-600">{selectedPlayer.email}</div>
                        )}
                        {selectedPlayer.phone_number && (
                          <div className="text-xs text-emerald-600">{selectedPlayer.phone_number}</div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearPlayer}
                      className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={playerSearch}
                        onChange={(e) => {
                          setPlayerSearch(e.target.value);
                          setShowPlayerDropdown(e.target.value.length > 0);
                        }}
                        onFocus={() => setShowPlayerDropdown(true)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t.academy?.searchPlayerPlaceholder || 'Search by name, email or phone...'}
                      />
                    </div>
                    {showPlayerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredPlayers.slice(0, 8).map(player => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => handleSelectPlayer(player)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
                          >
                            <UserCheck className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{player.name}</div>
                              <div className="text-xs text-gray-500">
                                {player.email && <span>{player.email}</span>}
                                {player.email && player.phone_number && <span> | </span>}
                                {player.phone_number && <span>{player.phone_number}</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                        {filteredPlayers.length === 0 && playerSearch && (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            {t.academy?.noPlayersFound || 'No players found'}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setShowPlayerDropdown(false);
                            setIsCreatingNewPlayer(true);
                            setStudentName(playerSearch);
                            setPlayerSearch('');
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 border-t border-gray-200 bg-gray-50"
                        >
                          <Plus className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">
                            {t.academy?.createNewPlayer || 'Create new player'}
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {(isCreatingNewPlayer || !selectedPlayer) && !showPlayerDropdown && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.members?.name || 'Student Name'} *</label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => {
                        setStudentName(e.target.value);
                        if (selectedPlayer && e.target.value !== selectedPlayer.name) {
                          setSelectedPlayer(null);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={t.academy?.studentNamePlaceholder || 'Enter student name'}
                      required
                    />
                  </div>

                  {isCreatingNewPlayer && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t.common?.email || 'Email'}
                        </label>
                        <input
                          type="email"
                          value={studentEmail}
                          onChange={(e) => setStudentEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t.academy?.emailPlaceholder || 'player@email.com'}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t.common?.phone || 'Phone'}
                        </label>
                        <input
                          type="tel"
                          value={studentPhone}
                          onChange={(e) => setStudentPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t.academy?.phonePlaceholder || '+351 912 345 678'}
                        />
                      </div>
                      <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        {t.academy?.newPlayerNote || 'This player will be added to your player database and can be used in tournaments.'}
                      </p>
                    </>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowStudentForm(false); setSelectedClassForStudent(null); setStudentName(''); setStudentEmail(''); setStudentPhone(''); setSelectedPlayer(null); setPlayerSearch(''); setIsCreatingNewPlayer(false); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving || !studentName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {saving ? t.message.saving : (t.common?.add || 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
