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
  Building2,
  Phone,
  User,
  Award
} from 'lucide-react';

interface Court {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
}

const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+');
};

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
  class_category: 'single' | 'pack' | 'group';
  pack_size?: number | null;
  group_size?: number | null;
  frequency_per_week?: number | null;
  monthly_price_per_player?: number | null;
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
  group_series_id?: string | null;
  series_week_number?: number | null;
}

interface PackClass {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  coach_id: string | null;
  court_id: string | null;
  pack_purchase_id: string;
}

interface PackPurchase {
  id: string;
  class_type_id: string;
  student_name: string;
  student_phone: string | null;
  student_email: string | null;
  organizer_player_id: string | null;
  member_subscription_id: string | null;
  pack_size: number;
  price_paid: number;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  class_type?: ClassType;
  completions?: LessonCompletion[];
  scheduled_classes?: PackClass[];
}

interface LessonCompletion {
  id: string;
  pack_purchase_id: string;
  class_id: string | null;
  completed_at: string;
  completed_by: string | null;
  notes: string | null;
  class?: ScheduledClass;
}

interface AcademyManagementProps {
  staffClubOwnerId?: string | null;
}

export default function AcademyManagement({ staffClubOwnerId }: AcademyManagementProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const [activeTab, setActiveTab] = useState<'classes' | 'types' | 'packs'>('classes');
  const [packPurchases, setPackPurchases] = useState<PackPurchase[]>([]);
  const [showPackForm, setShowPackForm] = useState(false);
  const [selectedPack, setSelectedPack] = useState<PackPurchase | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [selectedPackType, setSelectedPackType] = useState<string>('');
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
    price_per_class: 25,
    class_category: 'single' as 'single' | 'pack' | 'group',
    pack_size: 5,
    group_size: 2,
    frequency_per_week: 1,
    monthly_price_per_player: 50
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

  const [groupClassParticipants, setGroupClassParticipants] = useState<Array<{
    name: string;
    phone: string;
    email: string;
    isMember: boolean;
    discount: number;
    planName: string;
    organizer_player_id?: string | null;
    member_subscription_id?: string | null;
  }>>([]);

  const [groupClassSearchResults, setGroupClassSearchResults] = useState<Map<number, Array<{
    member_name: string;
    member_phone: string;
    plan: { name: string; court_discount_percent: number } | null;
  }>>>(new Map());

  const [focusedGroupInput, setFocusedGroupInput] = useState<number | null>(null);
  const [searchingGroupPlayer, setSearchingGroupPlayer] = useState<number | null>(null);

  // Pack creation with scheduling
  const [packCoachId, setPackCoachId] = useState('');
  const [packCourtId, setPackCourtId] = useState('');
  const [packStartDate, setPackStartDate] = useState('');
  const [packStartTime, setPackStartTime] = useState('09:00');
  const [packPlayerSearch, setPackPlayerSearch] = useState('');
  const [packPlayerResults, setPackPlayerResults] = useState<OrganizerPlayer[]>([]);
  const [showPackPlayerDropdown, setShowPackPlayerDropdown] = useState(false);

  // Class filters
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [classFilterType, setClassFilterType] = useState('');
  const [classFilterDate, setClassFilterDate] = useState('');

  const [packSubTab, setPackSubTab] = useState<'active' | 'finished'>('active');

  // Reschedule lesson modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleClass, setRescheduleClass] = useState<PackClass | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');

  useEffect(() => {
    if (user) {
      loadData();
      if (activeTab === 'packs') {
        loadPackPurchases();
      }
    }
  }, [user, activeTab]);

  // Inicializar participantes quando tipo de grupo é selecionado
  useEffect(() => {
    if (!classForm.class_type_id || classTypes.length === 0) {
      if (groupClassParticipants.length > 0) {
        setGroupClassParticipants([]);
      }
      return;
    }

    const selectedType = classTypes.find(t => t.id === classForm.class_type_id);
    const isGroup = selectedType?.class_category === 'group';
    const requiredParticipants = selectedType?.group_size || 2;
    
    if (isGroup) {
      if (groupClassParticipants.length !== requiredParticipants) {
        setGroupClassParticipants(
          Array.from({ length: requiredParticipants }, () => ({
            name: '',
            phone: '',
            email: '',
            isMember: false,
            discount: 0,
            planName: '',
            organizer_player_id: null,
            member_subscription_id: null
          }))
        );
      }
    } else {
      if (groupClassParticipants.length > 0) {
        setGroupClassParticipants([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classForm.class_type_id]);

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

    const updateData: any = {
      name: typeForm.name,
      description: typeForm.description || null,
      duration_minutes: typeForm.duration_minutes,
      max_students: typeForm.max_students,
      price_per_class: typeForm.price_per_class,
      class_category: typeForm.class_category
    };

    if (typeForm.class_category === 'pack') {
      updateData.pack_size = typeForm.pack_size;
      updateData.group_size = null;
      updateData.frequency_per_week = null;
      updateData.monthly_price_per_player = null;
    } else if (typeForm.class_category === 'group') {
      updateData.group_size = typeForm.group_size;
      updateData.frequency_per_week = typeForm.frequency_per_week;
      updateData.monthly_price_per_player = typeForm.monthly_price_per_player;
      updateData.price_per_class = typeForm.monthly_price_per_player;
      updateData.max_students = typeForm.group_size;
      updateData.pack_size = null;
    } else {
      updateData.pack_size = null;
      updateData.group_size = null;
      updateData.frequency_per_week = null;
      updateData.monthly_price_per_player = null;
    }

    if (editingType) {
      await supabase
        .from('class_types')
        .update(updateData)
        .eq('id', editingType.id);
    } else {
      await supabase.from('class_types').insert({
        club_owner_id: effectiveUserId,
        ...updateData
      });
    }

    setShowTypeForm(false);
    setEditingType(null);
    resetTypeForm();
    loadData();
    setSaving(false);
  };

  const searchPlayerForGroup = async (playerIndex: number, name: string, phone: string) => {
    if (!effectiveUserId) return;
    if ((!name || name.length < 2) && (!phone || phone.length < 6)) {
      setGroupClassSearchResults(prev => {
        const newMap = new Map(prev);
        newMap.delete(playerIndex);
        return newMap;
      });
      return;
    }

    setSearchingGroupPlayer(playerIndex);
    const normalizedPhone = phone ? normalizePhone(phone) : '';

    const allResults: Array<{
      member_name: string;
      member_phone: string;
      plan: { name: string; court_discount_percent: number } | null;
    }> = [];

    // Buscar membros
    let memberQuery = supabase
      .from('member_subscriptions')
      .select(`
        id,
        member_name,
        member_phone,
        plan:membership_plans(name, court_discount_percent)
      `)
      .eq('club_owner_id', effectiveUserId)
      .eq('status', 'active');

    if (normalizedPhone && normalizedPhone.length >= 6) {
      memberQuery = memberQuery.or(`member_phone.ilike.%${normalizedPhone}%,member_phone.ilike.%${phone}%`);
    } else if (name && name.length >= 2) {
      memberQuery = memberQuery.ilike('member_name', `%${name}%`);
    }

    const { data: membersData } = await memberQuery.limit(10).order('member_name');
    if (membersData) {
      membersData.forEach((item: any) => {
        allResults.push({
          member_name: item.member_name,
          member_phone: item.member_phone,
          plan: item.plan
        });
      });
    }

    // Buscar jogadores de torneios
    const { data: clubsData } = await supabase
      .from('clubs')
      .select('id')
      .eq('owner_id', effectiveUserId)
      .limit(1)
      .maybeSingle();

    if (clubsData) {
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('id')
        .eq('club_id', clubsData.id)
        .limit(100);

      if (tournamentsData && tournamentsData.length > 0) {
        const tournamentIds = tournamentsData.map(t => t.id);
        let tournamentPlayersQuery = supabase
          .from('players')
          .select('name, phone_number')
          .in('tournament_id', tournamentIds);

        if (normalizedPhone && normalizedPhone.length >= 6) {
          tournamentPlayersQuery = tournamentPlayersQuery.or(`phone_number.ilike.%${normalizedPhone}%,phone_number.ilike.%${phone}%`);
        } else if (name && name.length >= 2) {
          tournamentPlayersQuery = tournamentPlayersQuery.ilike('name', `%${name}%`);
        }

        const { data: tournamentPlayersData } = await tournamentPlayersQuery.limit(10).order('name');
        if (tournamentPlayersData) {
          tournamentPlayersData.forEach((item: any) => {
            const exists = allResults.some(r => 
              r.member_name.toLowerCase() === item.name?.toLowerCase() && 
              r.member_phone === (item.phone_number || '')
            );
            if (!exists && item.name) {
              allResults.push({
                member_name: item.name,
                member_phone: item.phone_number || '',
                plan: null
              });
            }
          });
        }
      }

      // Buscar jogadores de jogos abertos
      const { data: openGamesData } = await supabase
        .from('open_games')
        .select('id')
        .eq('club_id', clubsData.id)
        .limit(100);

      if (openGamesData && openGamesData.length > 0) {
        const gameIds = openGamesData.map(g => g.id);
        const { data: openGamePlayersData } = await supabase
          .from('open_game_players')
          .select('user_id')
          .in('game_id', gameIds);

        if (openGamePlayersData && openGamePlayersData.length > 0) {
          const userIds = [...new Set(openGamePlayersData.map(p => p.user_id))];
          let playerAccountsQuery = supabase
            .from('player_accounts')
            .select('user_id, name, phone_number')
            .in('user_id', userIds);

          if (normalizedPhone && normalizedPhone.length >= 6) {
            playerAccountsQuery = playerAccountsQuery.or(`phone_number.ilike.%${normalizedPhone}%,phone_number.ilike.%${phone}%`);
          } else if (name && name.length >= 2) {
            playerAccountsQuery = playerAccountsQuery.ilike('name', `%${name}%`);
          }

          const { data: playerAccountsData } = await playerAccountsQuery.limit(10).order('name');
          if (playerAccountsData) {
            playerAccountsData.forEach((item: any) => {
              const exists = allResults.some(r => 
                r.member_name.toLowerCase() === item.name?.toLowerCase() && 
                r.member_phone === (item.phone_number || '')
              );
              if (!exists && item.name) {
                allResults.push({
                  member_name: item.name,
                  member_phone: item.phone_number || '',
                  plan: null
                });
              }
            });
          }
        }
      }
    }

    const sortedResults = allResults
      .sort((a, b) => a.member_name.localeCompare(b.member_name))
      .slice(0, 10);

    const newResults = new Map(groupClassSearchResults);
    if (sortedResults.length > 0) {
      newResults.set(playerIndex, sortedResults);
    } else {
      newResults.delete(playerIndex);
    }
    setGroupClassSearchResults(newResults);
    setSearchingGroupPlayer(null);
  };

  const handleGroupPlayerNameChange = (playerIndex: number, name: string) => {
    const newParticipants = [...groupClassParticipants];
    newParticipants[playerIndex] = { ...newParticipants[playerIndex], name };
    setGroupClassParticipants(newParticipants);
    if (name.length >= 2) {
      searchPlayerForGroup(playerIndex, name, newParticipants[playerIndex].phone);
    } else {
      setGroupClassSearchResults(prev => {
        const newMap = new Map(prev);
        newMap.delete(playerIndex);
        return newMap;
      });
    }
  };

  const handleGroupPlayerPhoneChange = (playerIndex: number, phone: string) => {
    const newParticipants = [...groupClassParticipants];
    newParticipants[playerIndex] = { ...newParticipants[playerIndex], phone };
    setGroupClassParticipants(newParticipants);
    if (phone.length >= 6) {
      searchPlayerForGroup(playerIndex, newParticipants[playerIndex].name, phone);
    } else {
      setGroupClassSearchResults(prev => {
        const newMap = new Map(prev);
        newMap.delete(playerIndex);
        return newMap;
      });
    }
  };

  const handleSelectGroupPlayer = (playerIndex: number, result: {
    member_name: string;
    member_phone: string;
    plan: { name: string; court_discount_percent: number } | null;
  }) => {
    const newParticipants = [...groupClassParticipants];
    const isMember = result.plan !== null;
    newParticipants[playerIndex] = {
      name: result.member_name,
      phone: result.member_phone,
      email: '', // Será preenchido se necessário
      isMember: isMember,
      discount: result.plan?.court_discount_percent || 0,
      planName: result.plan?.name || '',
      organizer_player_id: null,
      member_subscription_id: null
    };
    setGroupClassParticipants(newParticipants);
    setGroupClassSearchResults(prev => {
      const newMap = new Map(prev);
      newMap.delete(playerIndex);
      return newMap;
    });
    setFocusedGroupInput(null);
  };

  const handleClearGroupPlayer = (playerIndex: number) => {
    const newParticipants = [...groupClassParticipants];
    newParticipants[playerIndex] = {
      name: '',
      phone: '',
      email: '',
      isMember: false,
      discount: 0,
      planName: '',
      organizer_player_id: null,
      member_subscription_id: null
    };
    setGroupClassParticipants(newParticipants);
    setGroupClassSearchResults(prev => {
      const newMap = new Map(prev);
      newMap.delete(playerIndex);
      return newMap;
    });
    setFocusedGroupInput(null);
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
      // Verificar se é aula de grupo
      const isGroupClass = classType?.class_category === 'group';
      
      if (isGroupClass) {
        // Validar participantes
        const requiredParticipants = classType?.group_size || 2;
        const validParticipants = groupClassParticipants.filter(p => p.name.trim() && p.phone.trim() && p.email.trim());
        
        if (validParticipants.length < requiredParticipants) {
          alert(`É necessário adicionar pelo menos ${requiredParticipants} participantes com nome, telefone e email.`);
          setSaving(false);
          return;
        }

        // Criar série de 4 semanas
        // Gerar UUID simples compatível
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        const groupSeriesId = generateUUID();
        const classesToCreate = [];
        
        for (let week = 1; week <= 4; week++) {
          const weekDate = new Date(scheduledAt);
          weekDate.setDate(weekDate.getDate() + (week - 1) * 7);
          
          const insertData: any = {
            club_owner_id: effectiveUserId,
            coach_id: classForm.coach_id === '' ? null : classForm.coach_id,
            class_type_id: classForm.class_type_id,
            court_id: classForm.court_id === '' ? null : classForm.court_id,
            scheduled_at: weekDate.toISOString(),
            notes: classForm.notes?.trim() || null,
            group_series_id: groupSeriesId,
            series_week_number: week
          };
          
          if (levelValue !== null && levelValue !== '') {
            insertData.level = levelValue;
          } else {
            insertData.level = null;
          }
          insertData.gender = genderValue;
          
          classesToCreate.push(insertData);
        }

        // Inserir todas as aulas
        const { data: createdClasses, error: classesError } = await supabase
          .from('club_classes')
          .insert(classesToCreate)
          .select();

        if (classesError) {
          console.error('[AcademyManagement] Error creating group classes:', classesError);
          alert('Erro ao criar aulas de grupo: ' + classesError.message);
          setSaving(false);
          return;
        }

        // Criar participantes para todas as aulas
        if (createdClasses && createdClasses.length > 0) {
          const enrollmentsToCreate = [];
          
          for (const cls of createdClasses) {
            for (const participant of validParticipants.slice(0, requiredParticipants)) {
              // Buscar organizer_player_id ou member_subscription_id se necessário
              let organizerPlayerId = null;
              let memberSubscriptionId = null;
              
              if (participant.organizer_player_id) {
                organizerPlayerId = participant.organizer_player_id;
              } else if (participant.member_subscription_id) {
                memberSubscriptionId = participant.member_subscription_id;
              } else {
                // Tentar encontrar jogador existente ou criar novo
                const normalizedPhone = normalizePhone(participant.phone);
                const { data: existingMember } = await supabase
                  .from('member_subscriptions')
                  .select('id')
                  .eq('club_owner_id', effectiveUserId)
                  .eq('status', 'active')
                  .or(`member_phone.ilike.%${normalizedPhone}%,member_phone.ilike.%${participant.phone}%`)
                  .maybeSingle();
                
                if (existingMember) {
                  memberSubscriptionId = existingMember.id;
                } else {
                  // Criar organizer_player se não existir
                  const { data: existingPlayer } = await supabase
                    .from('organizer_players')
                    .select('id')
                    .eq('organizer_id', effectiveUserId)
                    .or(`phone_number.ilike.%${normalizedPhone}%,phone_number.ilike.%${participant.phone}%`)
                    .maybeSingle();
                  
                  if (existingPlayer) {
                    organizerPlayerId = existingPlayer.id;
                  } else {
                    // Criar novo organizer_player
                    const { data: newPlayer } = await supabase
                      .from('organizer_players')
                      .insert({
                        organizer_id: effectiveUserId,
                        name: participant.name,
                        phone_number: participant.phone,
                        email: participant.email
                      })
                      .select()
                      .single();
                    
                    if (newPlayer) {
                      organizerPlayerId = newPlayer.id;
                    }
                  }
                }
              }

              enrollmentsToCreate.push({
                class_id: cls.id,
                student_name: participant.name,
                organizer_player_id: organizerPlayerId,
                member_subscription_id: memberSubscriptionId,
                status: 'enrolled'
              });
            }
          }

          if (enrollmentsToCreate.length > 0) {
            await supabase.from('class_enrollments').insert(enrollmentsToCreate);
          }
        }

        // Criar reservas de campo para todas as aulas
        if (createdClasses && classForm.court_id) {
          const coach = coaches.find(c => c.id === classForm.coach_id);
          const bookingsToCreate = createdClasses.map(cls => {
            const startTime = new Date(cls.scheduled_at);
            const endTime = new Date(startTime);
            endTime.setMinutes(startTime.getMinutes() + durationMinutes);
            
            return {
              user_id: effectiveUserId,
              court_id: classForm.court_id,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              booked_by_name: coach?.name || classType?.name || 'Aula de Grupo',
              booked_by_phone: coach?.phone || null,
              price: 0,
              payment_status: 'paid',
              event_type: 'training',
              notes: `${classType?.name || 'Aula de Grupo'}${coach ? ` - ${coach.name}` : ''} - Semana ${cls.series_week_number}`
            };
          });

          await supabase.from('court_bookings').insert(bookingsToCreate);
        }

        setGroupClassParticipants([]);
        setGroupClassSearchResults(new Map());
      } else {
        // Aula pontual normal
        const insertData: any = {
          club_owner_id: effectiveUserId,
          coach_id: classForm.coach_id === '' ? null : classForm.coach_id,
          class_type_id: classForm.class_type_id,
          court_id: classForm.court_id === '' ? null : classForm.court_id,
          scheduled_at: scheduledAt.toISOString(),
          notes: classForm.notes?.trim() || null
        };
        
        if (levelValue !== null && levelValue !== '') {
          insertData.level = levelValue;
        } else {
          insertData.level = null;
        }
        insertData.gender = genderValue;
        
        const { data: newClass, error } = await supabase
          .from('club_classes')
          .insert(insertData)
          .select()
          .single();
        
        if (error) {
          console.error('[AcademyManagement] Error creating class:', error);
          alert('Erro ao criar aula: ' + error.message);
          setSaving(false);
          return;
        }

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
      price_per_class: type.price_per_class,
      class_category: type.class_category || 'single',
      pack_size: type.pack_size || 5,
      group_size: type.group_size || 2,
      frequency_per_week: type.frequency_per_week || 1
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
    let playerAccountId: string | null = null;
    let studentId: string | null = null;

    // Se há um jogador selecionado, tentar buscar o player_account_id
    if (selectedPlayer) {
      // Tentar encontrar player_accounts pelo nome ou telefone do organizer_player
      const { data: playerAccount } = await supabase
        .from('player_accounts')
        .select('id, user_id')
        .or(`name.ilike.%${selectedPlayer.name}%,phone_number.eq.${selectedPlayer.phone_number || ''}`)
        .limit(1)
        .maybeSingle();

      if (playerAccount) {
        playerAccountId = playerAccount.id;
        studentId = playerAccount.user_id;
      }
    }

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
        
        // Tentar encontrar player_accounts pelo nome ou telefone do novo organizer_player
        if (studentPhone.trim()) {
          const { data: playerAccount } = await supabase
            .from('player_accounts')
            .select('id, user_id')
            .or(`name.ilike.%${studentName.trim()}%,phone_number.eq.${studentPhone.trim()}`)
            .limit(1)
            .maybeSingle();

          if (playerAccount) {
            playerAccountId = playerAccount.id;
            studentId = playerAccount.user_id;
          }
        }
      }
    }

    const { error: enrollmentError } = await supabase.from('class_enrollments').insert({
      class_id: selectedClassForStudent.id,
      student_name: studentName.trim(),
      status: 'enrolled',
      organizer_player_id: playerId,
      student_id: studentId,
      player_account_id: playerAccountId
    });

    if (!enrollmentError && effectiveUserId && selectedClassForStudent) {
      // Get class details for notification
      const scheduledAt = new Date(selectedClassForStudent.scheduled_at);
      const classDate = scheduledAt.toISOString().split('T')[0];
      const classTime = `${scheduledAt.getHours().toString().padStart(2, '0')}:${scheduledAt.getMinutes().toString().padStart(2, '0')}`;
      const className = selectedClassForStudent.class_type?.name || 'Aula';

      // Notify manager about new enrollment
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-manager`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              userId: effectiveUserId,
              type: 'class_enrollment',
              playerName: studentName.trim(),
              className: className,
              classDate: classDate,
              classTime: classTime,
            }),
          }
        );
      } catch (notifyError) {
        console.error('Error notifying manager:', notifyError);
      }
    }

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
    
    // Get enrollment details before deleting
    const { data: enrollment } = await supabase
      .from('class_enrollments')
      .select('id, student_name, class_id')
      .eq('id', enrollmentId)
      .single();

    const { error } = await supabase.from('class_enrollments').delete().eq('id', enrollmentId);

    if (!error && enrollment && effectiveUserId && enrollment.class_id) {
      // Get class details for notification
      const { data: classData } = await supabase
        .from('club_classes')
        .select('scheduled_at, class_type_id')
        .eq('id', enrollment.class_id)
        .single();

      if (classData) {
        // Get class type name
        let className = 'Aula';
        if (classData.class_type_id) {
          const { data: classType } = await supabase
            .from('class_types')
            .select('name')
            .eq('id', classData.class_type_id)
            .single();
          if (classType) className = classType.name;
        }

        const scheduledAt = new Date(classData.scheduled_at);
        const classDate = scheduledAt.toISOString().split('T')[0];
        const classTime = `${scheduledAt.getHours().toString().padStart(2, '0')}:${scheduledAt.getMinutes().toString().padStart(2, '0')}`;

        // Notify manager about cancellation
        try {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-manager`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                userId: effectiveUserId,
                type: 'class_cancellation',
                playerName: enrollment.student_name || 'Aluno',
                className: className,
                classDate: classDate,
                classTime: classTime,
              }),
            }
          );
        } catch (notifyError) {
          console.error('Error notifying manager:', notifyError);
        }
      }
    }

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
    (p.name && p.name.toLowerCase().includes(playerSearch.toLowerCase())) ||
    (p.email && p.email.toLowerCase().includes(playerSearch.toLowerCase())) ||
    (p.phone_number && p.phone_number.includes(playerSearch))
  );

  const filteredPackPlayers = players.filter(p =>
    (p.name && p.name.toLowerCase().includes(packPlayerSearch.toLowerCase())) ||
    (p.email && p.email.toLowerCase().includes(packPlayerSearch.toLowerCase())) ||
    (p.phone_number && p.phone_number.includes(packPlayerSearch))
  );

  const loadPackPurchases = async () => {
    if (!effectiveUserId) return;
    
    const { data, error } = await supabase
      .from('pack_purchases')
      .select(`
        *,
        class_type:class_types(*)
      `)
      .eq('club_owner_id', effectiveUserId)
      .eq('is_active', true)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Error loading pack purchases:', error);
      return;
    }

    if (data) {
      const packIds = data.map(p => p.id);
      
      // Load completions
      const { data: completions } = await supabase
        .from('lesson_completions')
        .select(`
          *,
          class:club_classes(*)
        `)
        .in('pack_purchase_id', packIds);

      // Load scheduled classes for packs
      const { data: packClasses } = await supabase
        .from('club_classes')
        .select('id, scheduled_at, status, notes, coach_id, court_id, pack_purchase_id')
        .in('pack_purchase_id', packIds)
        .order('scheduled_at', { ascending: true });

      const packsWithData = data.map(pack => ({
        ...pack,
        completions: completions?.filter(c => c.pack_purchase_id === pack.id) || [],
        scheduled_classes: packClasses?.filter(c => c.pack_purchase_id === pack.id) || []
      }));

      setPackPurchases(packsWithData as PackPurchase[]);
    }
  };

  const resetTypeForm = () => {
    setTypeForm({
      name: '',
      description: '',
      duration_minutes: 60,
      max_students: 4,
      price_per_class: 25,
      class_category: 'single',
      pack_size: 5,
      group_size: 2,
      frequency_per_week: 1,
      monthly_price_per_player: 50
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
    setGroupClassParticipants([]);
    setGroupClassSearchResults(new Map());
    setFocusedGroupInput(null);
  };

  const handleExtendGroupSeries = async (seriesId: string) => {
    if (!effectiveUserId) return;
    
    // Buscar a última aula da série
    const { data: lastClass } = await supabase
      .from('club_classes')
      .select('*')
      .eq('group_series_id', seriesId)
      .order('series_week_number', { ascending: false })
      .limit(1)
      .single();

    if (!lastClass) {
      alert('Série não encontrada');
      return;
    }

    const classType = classTypes.find(ct => ct.id === lastClass.class_type_id);
    if (!classType || classType.class_category !== 'group') {
      alert('Esta não é uma série de aulas de grupo');
      return;
    }

    // Buscar participantes da última aula
    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('class_id', lastClass.id);

    if (!enrollments || enrollments.length === 0) {
      alert('Nenhum participante encontrado na série');
      return;
    }

    // Criar mais 4 semanas
    const lastDate = new Date(lastClass.scheduled_at);
    const durationMinutes = classType.duration_minutes || 60;
    const classesToCreate = [];

    for (let week = 1; week <= 4; week++) {
      const weekDate = new Date(lastDate);
      weekDate.setDate(weekDate.getDate() + week * 7);
      
      const insertData: any = {
        club_owner_id: effectiveUserId,
        coach_id: lastClass.coach_id,
        class_type_id: lastClass.class_type_id,
        court_id: lastClass.court_id,
        scheduled_at: weekDate.toISOString(),
        notes: lastClass.notes,
        group_series_id: seriesId,
        series_week_number: (lastClass.series_week_number || 4) + week,
        level: lastClass.level,
        gender: lastClass.gender
      };
      
      classesToCreate.push(insertData);
    }

    const { data: createdClasses, error: classesError } = await supabase
      .from('club_classes')
      .insert(classesToCreate)
      .select();

    if (classesError) {
      alert('Erro ao prolongar série: ' + classesError.message);
      return;
    }

    // Criar participantes para as novas aulas
    if (createdClasses && createdClasses.length > 0) {
      const enrollmentsToCreate = [];
      
      for (const cls of createdClasses) {
        for (const enrollment of enrollments) {
          enrollmentsToCreate.push({
            class_id: cls.id,
            student_name: enrollment.student_name,
            organizer_player_id: enrollment.organizer_player_id,
            member_subscription_id: enrollment.member_subscription_id,
            status: 'enrolled'
          });
        }
      }

      if (enrollmentsToCreate.length > 0) {
        await supabase.from('class_enrollments').insert(enrollmentsToCreate);
      }

      // Criar reservas de campo
      if (lastClass.court_id) {
        const coach = coaches.find(c => c.id === lastClass.coach_id);
        const bookingsToCreate = createdClasses.map(cls => {
          const startTime = new Date(cls.scheduled_at);
          const endTime = new Date(startTime);
          endTime.setMinutes(startTime.getMinutes() + durationMinutes);
          
          return {
            user_id: effectiveUserId,
            court_id: lastClass.court_id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            booked_by_name: coach?.name || classType?.name || 'Aula de Grupo',
            booked_by_phone: coach?.phone || null,
            price: 0,
            payment_status: 'paid',
            event_type: 'training',
            notes: `${classType?.name || 'Aula de Grupo'}${coach ? ` - ${coach.name}` : ''} - Semana ${cls.series_week_number}`
          };
        });

        await supabase.from('court_bookings').insert(bookingsToCreate);
      }
    }

    loadData();
    alert('Série prolongada com sucesso! Mais 4 semanas adicionadas.');
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
              onClick={() => {
                setActiveTab('types');
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === 'types' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              {t.academy.classTypes}
            </button>
            <button
              onClick={() => {
                setActiveTab('packs');
                loadPackPurchases();
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === 'packs' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              Packs
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

      {activeTab === 'classes' && (() => {
        const filteredClasses = classes.filter(cls => {
          const matchesSearch = !classSearchTerm || 
            (cls.class_type?.name && cls.class_type.name.toLowerCase().includes(classSearchTerm.toLowerCase())) ||
            (cls.coach_name && cls.coach_name.toLowerCase().includes(classSearchTerm.toLowerCase())) ||
            (cls.enrollments?.some(e => e.student_name?.toLowerCase().includes(classSearchTerm.toLowerCase()))) ||
            (cls.notes && cls.notes.toLowerCase().includes(classSearchTerm.toLowerCase()));
          const matchesType = !classFilterType || cls.class_type?.id === classFilterType;
          const matchesDate = !classFilterDate || (cls.scheduled_at && cls.scheduled_at.startsWith(classFilterDate));
          return matchesSearch && matchesType && matchesDate;
        });

        return (
          <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[180px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={classSearchTerm}
                  onChange={(e) => setClassSearchTerm(e.target.value)}
                  placeholder="Buscar aluno, treinador, tipo..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={classFilterType}
                onChange={(e) => setClassFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos os Tipos</option>
                {classTypes.map(ct => (
                  <option key={ct.id} value={ct.id}>{ct.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={classFilterDate}
                onChange={(e) => setClassFilterDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {(classSearchTerm || classFilterType || classFilterDate) && (
                <button
                  onClick={() => { setClassSearchTerm(''); setClassFilterType(''); setClassFilterDate(''); }}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Limpar
                </button>
              )}
            </div>
          </div>

        {filteredClasses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {(classSearchTerm || classFilterType || classFilterDate) ? 'Nenhuma aula encontrada com os filtros aplicados' : t.academy.noClasses}
            </h3>
            {(classSearchTerm || classFilterType || classFilterDate) ? (
              <button
                onClick={() => { setClassSearchTerm(''); setClassFilterType(''); setClassFilterDate(''); }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
              >
                Limpar filtros
              </button>
            ) : coaches.length > 0 && classTypes.length > 0 && (
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
            {filteredClasses.map(cls => {
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

                      {cls.class_type?.class_category === 'group' && cls.group_series_id && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <button
                            onClick={() => {
                              if (confirm('Deseja prolongar esta série de aulas de grupo por mais 4 semanas?')) {
                                handleExtendGroupSeries(cls.group_series_id!);
                              }
                            }}
                            className="w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Prolongar Pack (Mais 4 semanas)
                          </button>
                          {cls.series_week_number && (
                            <p className="text-xs text-gray-500 mt-1 text-center">Semana {cls.series_week_number} de 4</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
        }
        </>
      );
      })()}

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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Aula *</label>
                <select
                  value={typeForm.class_category}
                  onChange={(e) => setTypeForm({ ...typeForm, class_category: e.target.value as 'single' | 'pack' | 'group' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="single">Aula Pontual</option>
                  <option value="pack">Pack de Aulas</option>
                  <option value="group">Aula de Grupo</option>
                </select>
              </div>
              {typeForm.class_category === 'pack' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Aulas no Pack *</label>
                    <select
                      value={typeForm.pack_size}
                      onChange={(e) => setTypeForm({ ...typeForm, pack_size: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value={5}>5 Aulas</option>
                      <option value={10}>10 Aulas</option>
                    </select>
                  </div>
                </>
              )}
              {typeForm.class_category === 'group' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Jogadores *</label>
                    <select
                      value={typeForm.group_size}
                      onChange={(e) => setTypeForm({ ...typeForm, group_size: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value={2}>2 Jogadores</option>
                      <option value={3}>3 Jogadores</option>
                      <option value={4}>4 Jogadores</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequência por Semana *</label>
                    <select
                      value={typeForm.frequency_per_week}
                      onChange={(e) => setTypeForm({ ...typeForm, frequency_per_week: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value={1}>1x por semana</option>
                      <option value={2}>2x por semana</option>
                      <option value={3}>3x por semana</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duração (minutos) *</label>
                    <select
                      value={typeForm.duration_minutes}
                      onChange={(e) => setTypeForm({ ...typeForm, duration_minutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value={60}>60 minutos</option>
                      <option value={90}>90 minutos</option>
                    </select>
                  </div>
                </>
              )}
              {typeForm.class_category === 'single' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duração (minutos) *</label>
                  <input
                    type="number"
                    value={typeForm.duration_minutes}
                    onChange={(e) => setTypeForm({ ...typeForm, duration_minutes: parseInt(e.target.value) || 60 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="30"
                    step="15"
                    required
                  />
                </div>
              )}
              {typeForm.class_category !== 'group' && (
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
              )}
              {typeForm.class_category === 'group' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço Mensal por Jogador (EUR) *</label>
                  <input
                    type="number"
                    value={typeForm.monthly_price_per_player}
                    onChange={(e) => setTypeForm({ ...typeForm, monthly_price_per_player: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              )}
              {typeForm.class_category !== 'group' && (
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
              )}
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
                  {classTypes.filter(ct => ct.class_category !== 'pack').map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.class_category === 'group' ? `${type.monthly_price_per_player || type.price_per_class} EUR/mês/jogador` : `${type.price_per_class} EUR`} ({type.duration_minutes} min)
                    </option>
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
              {classForm.class_type_id && (() => {
                const selectedType = classTypes.find(t => t.id === classForm.class_type_id);
                const isGroup = selectedType?.class_category === 'group';
                const requiredParticipants = selectedType?.group_size || 2;
                
                if (isGroup) {
                  return (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">Participantes ({requiredParticipants} obrigatórios) *</label>
                        <span className="text-xs text-gray-500">Telefone e Email obrigatórios</span>
                      </div>
                      {groupClassParticipants.slice(0, requiredParticipants).map((participant, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${participant.isMember ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500">Participante {idx + 1}</span>
                            {participant.isMember && (
                              <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <Award className="w-3 h-3" />
                                {participant.planName} - {participant.discount}% desconto
                              </span>
                            )}
                            {(participant.name || participant.phone) && (
                              <button
                                type="button"
                                onClick={() => handleClearGroupPlayer(idx)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded transition flex-shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="relative">
                              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input
                                type="text"
                                value={participant.name}
                                onChange={(e) => handleGroupPlayerNameChange(idx, e.target.value)}
                                onFocus={() => setFocusedGroupInput(idx)}
                                onBlur={() => setTimeout(() => setFocusedGroupInput(null), 200)}
                                className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Nome"
                                required
                              />
                              {searchingGroupPlayer === idx && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  <div className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                                </div>
                              )}
                              {focusedGroupInput === idx && groupClassSearchResults.has(idx) && groupClassSearchResults.get(idx)!.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                  {groupClassSearchResults.get(idx)!.map((result, resultIdx) => (
                                    <div
                                      key={resultIdx}
                                      onClick={() => handleSelectGroupPlayer(idx, result)}
                                      className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900 break-words">{result.member_name}</div>
                                            <div className="text-xs text-gray-500 break-words">{result.member_phone}</div>
                                          </div>
                                          {result.plan && (
                                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                                              <Award className="w-3 h-3" />
                                              {result.plan.name} - {result.plan.court_discount_percent}%
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="relative">
                                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                  type="tel"
                                  value={participant.phone}
                                  onChange={(e) => handleGroupPlayerPhoneChange(idx, e.target.value)}
                                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Telefone"
                                  required
                                />
                              </div>
                              <div>
                                <input
                                  type="email"
                                  value={participant.email}
                                  onChange={(e) => {
                                    const newParticipants = [...groupClassParticipants];
                                    newParticipants[idx] = { ...newParticipants[idx], email: e.target.value };
                                    setGroupClassParticipants(newParticipants);
                                  }}
                                  className="w-full pl-2 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Email"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        Aulas serão criadas automaticamente para 4 semanas (mesma hora, mesmo dia da semana)
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
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

      {activeTab === 'packs' && (() => {
        const activePacks = packPurchases.filter(p => {
          const done = p.completions?.length || 0;
          return done < p.pack_size;
        });
        const finishedPacks = packPurchases.filter(p => {
          const done = p.completions?.length || 0;
          return done >= p.pack_size;
        });

        return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Packs de Aulas</h2>
            <button
              onClick={() => {
                setSelectedPack(null);
                setStudentName('');
                setStudentEmail('');
                setStudentPhone('');
                setSelectedPlayer(null);
                setPackPlayerSearch('');
                setSelectedPackType('');
                setPackCoachId('');
                setPackCourtId('');
                setPackStartDate('');
                setPackStartTime('09:00');
                setShowPackForm(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Pack
            </button>
          </div>

          {/* Sub-tabs: Ativos / Terminados */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setPackSubTab('active')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                packSubTab === 'active' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Ativos ({activePacks.length})
            </button>
            <button
              onClick={() => setPackSubTab('finished')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                packSubTab === 'finished' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Terminados ({finishedPacks.length})
            </button>
          </div>

          {(() => {
            const displayPacks = packSubTab === 'active' ? activePacks : finishedPacks;
            if (displayPacks.length === 0) {
              return (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {packSubTab === 'active' ? 'Nenhum pack ativo' : 'Nenhum pack terminado'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {packSubTab === 'active' ? 'Crie um novo pack de aulas para começar' : 'Os packs completados aparecerão aqui'}
                  </p>
                </div>
              );
            }
            return (
            <div className="grid gap-4">
              {displayPacks.map(pack => {
                const completedCount = pack.completions?.length || 0;
                const remaining = pack.pack_size - completedCount;
                const progress = (completedCount / pack.pack_size) * 100;
                
                return (
                  <div key={pack.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{pack.student_name}</h3>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {pack.class_type?.name || 'Pack'}
                          </span>
                          {remaining === 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Completo</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                          {pack.student_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{pack.student_phone}</span>}
                          {pack.student_email && <span className="text-xs">{pack.student_email}</span>}
                          <span className="font-medium">{pack.price_paid.toFixed(2)} EUR</span>
                          <span className="text-xs text-gray-400">Comprado: {new Date(pack.purchased_at).toLocaleDateString('pt-PT')}</span>
                        </div>
                      </div>
                      {remaining > 0 && (
                        <button
                          onClick={() => {
                            setSelectedPack(pack);
                            setShowCompletionModal(true);
                          }}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center gap-1.5 flex-shrink-0"
                        >
                          <Check className="w-4 h-4" />
                          Marcar Aula
                        </button>
                      )}
                    </div>
                    
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Progresso: {completedCount}/{pack.pack_size} aulas</span>
                        <span className={remaining === 0 ? 'text-green-600 font-medium' : ''}>{remaining === 0 ? 'Pack Completo!' : `${remaining} restantes`}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${remaining === 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Lessons - collapsible */}
                    {pack.scheduled_classes && pack.scheduled_classes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <details className="group">
                          <summary className="flex items-center justify-between cursor-pointer select-none py-1 hover:bg-gray-50 rounded-lg px-2 transition">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">Aulas do Pack</span>
                              <div className="flex gap-1 ml-1">
                                {Array.from({ length: pack.pack_size }, (_, i) => (
                                  <div key={i} className={`w-2 h-2 rounded-full ${i < completedCount ? 'bg-green-500' : 'bg-gray-300'}`} />
                                ))}
                              </div>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {pack.scheduled_classes.map((cls, idx) => {
                              const completionForClass = pack.completions?.find(c => c.class_id === cls.id);
                              const isCompleted = !!completionForClass;
                              const lessonDate = new Date(cls.scheduled_at);
                              const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                              const isPast = lessonDate < new Date() && !isCompleted;
                              
                              return (
                                <div key={cls.id} className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm ${
                                  isCompleted ? 'bg-green-50' : isPast ? 'bg-amber-50' : 'bg-gray-50'
                                }`}>
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                                      isCompleted 
                                        ? 'bg-green-500 text-white' 
                                        : isPast
                                          ? 'bg-amber-400 text-white'
                                          : 'bg-gray-200 text-gray-600'
                                    }`}>
                                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className={`text-sm ${isCompleted ? 'text-green-700 line-through' : isPast ? 'text-amber-700' : 'text-gray-700'}`}>
                                        {dayNames[lessonDate.getDay()]}, {lessonDate.toLocaleDateString('pt-PT')} às {lessonDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {isCompleted && completionForClass && (
                                        <span className="text-xs text-green-500">
                                          Completada em {new Date(completionForClass.completed_at).toLocaleDateString('pt-PT')}
                                        </span>
                                      )}
                                      {isPast && <span className="text-xs text-amber-500">Aula passada - não marcada</span>}
                                    </div>
                                  </div>
                                  {!isCompleted && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRescheduleClass(cls);
                                        const d = new Date(cls.scheduled_at);
                                        setRescheduleDate(d.toISOString().split('T')[0]);
                                        setRescheduleTime(d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }));
                                        setShowRescheduleModal(true);
                                      }}
                                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition flex-shrink-0"
                                      title="Reagendar aula"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            );
          })()}
        </div>
        );
      })()}

      {/* Pack Purchase Form Modal */}
      {showPackForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">Novo Pack de Aulas</h2>
              <button onClick={() => { setShowPackForm(false); setSelectedPack(null); setStudentName(''); setStudentEmail(''); setStudentPhone(''); setSelectedPlayer(null); setPackPlayerSearch(''); setSelectedPackType(''); setPackCoachId(''); setPackCourtId(''); setPackStartDate(''); setPackStartTime('09:00'); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!effectiveUserId || !selectedPackType) return;
              
              const packType = classTypes.find(t => t.id === selectedPackType);
              if (!packType) {
                alert('Tipo de pack não encontrado');
                return;
              }

              if (!studentName.trim()) {
                alert('Nome do aluno é obrigatório');
                return;
              }

              setSaving(true);

              // Create pack purchase
              const { data: newPack, error: packError } = await supabase.from('pack_purchases').insert({
                club_owner_id: effectiveUserId,
                class_type_id: packType.id,
                student_name: studentName.trim(),
                student_phone: studentPhone || null,
                student_email: studentEmail || null,
                organizer_player_id: selectedPlayer?.id || null,
                pack_size: packType.pack_size || 5,
                price_paid: packType.price_per_class * (packType.pack_size || 5)
              }).select().single();

              if (packError) {
                alert('Erro ao criar pack: ' + packError.message);
                setSaving(false);
                return;
              }

              // If start date is set, create scheduled classes for each lesson
              if (packStartDate && newPack) {
                const packSize = packType.pack_size || 5;
                const [hours, minutes] = packStartTime.split(':').map(Number);
                const classesToCreate = [];

                for (let i = 0; i < packSize; i++) {
                  const lessonDate = new Date(packStartDate);
                  lessonDate.setDate(lessonDate.getDate() + i * 7);
                  lessonDate.setHours(hours, minutes, 0, 0);

                  const insertData: any = {
                    club_owner_id: effectiveUserId,
                    coach_id: packCoachId || null,
                    class_type_id: packType.id,
                    court_id: packCourtId || null,
                    scheduled_at: lessonDate.toISOString(),
                    pack_purchase_id: newPack.id,
                    notes: `Pack - ${studentName.trim()} - Aula ${i + 1}/${packSize}`
                  };
                  classesToCreate.push(insertData);
                }

                const { data: createdClasses, error: classError } = await supabase
                  .from('club_classes')
                  .insert(classesToCreate)
                  .select();

                if (!classError && createdClasses) {
                  // Create enrollments for each class
                  const enrollmentsToCreate = createdClasses.map(cls => ({
                    class_id: cls.id,
                    student_name: studentName.trim(),
                    organizer_player_id: selectedPlayer?.id || null,
                    status: 'enrolled'
                  }));
                  await supabase.from('class_enrollments').insert(enrollmentsToCreate);

                  // Create court bookings if court selected
                  if (packCourtId) {
                    const coach = coaches.find(c => c.id === packCoachId);
                    const durationMinutes = packType.duration_minutes || 60;
                    const bookingsToCreate = createdClasses.map((cls, i) => {
                      const startTime = new Date(cls.scheduled_at);
                      const endTime = new Date(startTime);
                      endTime.setMinutes(startTime.getMinutes() + durationMinutes);
                      return {
                        user_id: effectiveUserId,
                        court_id: packCourtId,
                        start_time: startTime.toISOString(),
                        end_time: endTime.toISOString(),
                        booked_by_name: coach?.name || `Pack ${studentName.trim()}`,
                        booked_by_phone: coach?.phone || null,
                        price: 0,
                        payment_status: 'paid',
                        event_type: 'training',
                        notes: `Pack ${packType.name} - ${studentName.trim()} - Aula ${i + 1}/${packSize}`
                      };
                    });
                    await supabase.from('court_bookings').insert(bookingsToCreate);
                  }
                }
              }

              setShowPackForm(false);
              setStudentName('');
              setStudentEmail('');
              setStudentPhone('');
              setSelectedPlayer(null);
              setSelectedPackType('');
              setPackCoachId('');
              setPackCourtId('');
              setPackStartDate('');
              setPackStartTime('09:00');
              setPackPlayerSearch('');
              setSaving(false);
              loadPackPurchases();
              loadData();
            }} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Pack *</label>
                <select
                  value={selectedPackType}
                  onChange={(e) => setSelectedPackType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Selecione um tipo de pack</option>
                  {classTypes.filter(t => t.class_category === 'pack').map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.pack_size} aulas - {(type.price_per_class * (type.pack_size || 5)).toFixed(2)} EUR
                    </option>
                  ))}
                </select>
                {classTypes.filter(t => t.class_category === 'pack').length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Primeiro crie um tipo de pack de aulas na tab Tipos</p>
                )}
              </div>

              {/* Player search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aluno *</label>
                {selectedPlayer ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-emerald-600" />
                      <div>
                        <div className="text-sm font-medium text-emerald-800">{selectedPlayer.name}</div>
                        {selectedPlayer.phone_number && <div className="text-xs text-emerald-600">{selectedPlayer.phone_number}</div>}
                        {selectedPlayer.email && <div className="text-xs text-emerald-600">{selectedPlayer.email}</div>}
                      </div>
                    </div>
                    <button type="button" onClick={() => { setSelectedPlayer(null); setStudentName(''); setStudentPhone(''); setStudentEmail(''); setPackPlayerSearch(''); }} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={packPlayerSearch}
                      onChange={(e) => { setPackPlayerSearch(e.target.value); setShowPackPlayerDropdown(e.target.value.length > 0); }}
                      onFocus={() => setShowPackPlayerDropdown(packPlayerSearch.length > 0)}
                      onBlur={() => setTimeout(() => setShowPackPlayerDropdown(false), 200)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Buscar aluno por nome, email ou telefone..."
                    />
                    {showPackPlayerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredPackPlayers.slice(0, 8).map(player => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setStudentName(player.name);
                              setStudentPhone(player.phone_number || '');
                              setStudentEmail(player.email || '');
                              setPackPlayerSearch('');
                              setShowPackPlayerDropdown(false);
                            }}
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
                        {filteredPackPlayers.length === 0 && packPlayerSearch && (
                          <div className="px-3 py-2 text-sm text-gray-500">Nenhum jogador encontrado</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!selectedPlayer && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Aluno *</label>
                    <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                      <input type="tel" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Agendar Aulas do Pack</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treinador</label>
                  <select value={packCoachId} onChange={(e) => setPackCoachId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="">Sem treinador</option>
                    {coaches.map(coach => (<option key={coach.id} value={coach.id}>{coach.name}</option>))}
                  </select>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campo</label>
                  <select value={packCourtId} onChange={(e) => setPackCourtId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="">Sem campo</option>
                    {courts.map(court => (<option key={court.id} value={court.id}>{court.name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data da 1ª Aula *</label>
                    <input type="date" value={packStartDate} onChange={(e) => setPackStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
                    <select value={packStartTime} onChange={(e) => setPackStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                      {timeSlots.map(slot => (<option key={slot} value={slot}>{slot}</option>))}
                    </select>
                  </div>
                </div>
                {selectedPackType && packStartDate && (
                  <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium mb-2">Aulas agendadas automaticamente (1x por semana):</p>
                    <div className="space-y-1">
                      {Array.from({ length: classTypes.find(t => t.id === selectedPackType)?.pack_size || 5 }, (_, i) => {
                        const d = new Date(packStartDate);
                        d.setDate(d.getDate() + i * 7);
                        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs text-blue-800">
                            <div className="w-5 h-5 rounded-full border-2 border-blue-300 flex items-center justify-center text-blue-400 flex-shrink-0">{i + 1}</div>
                            <span>{dayNames[d.getDay()]}, {d.toLocaleDateString('pt-PT')} às {packStartTime}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowPackForm(false); setSelectedPack(null); setStudentName(''); setStudentEmail(''); setStudentPhone(''); setSelectedPlayer(null); setPackPlayerSearch(''); setSelectedPackType(''); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Check className="w-4 h-4" />
                  {saving ? t.message.saving : 'Criar Pack e Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && selectedPack && (() => {
        const completedClassIds = new Set(selectedPack.completions?.map(c => c.class_id) || []);
        const pendingClasses = selectedPack.scheduled_classes?.filter(c => !completedClassIds.has(c.id)) || [];

        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Marcar Aula como Completada</h2>
              <button onClick={() => { setShowCompletionModal(false); setSelectedPack(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>{selectedPack.student_name}</strong> - Pack de {selectedPack.pack_size} aulas
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Aulas completadas: {selectedPack.completions?.length || 0} / {selectedPack.pack_size}
                </p>
              </div>

              {pendingClasses.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Selecione a aula a marcar:</p>
                  {pendingClasses.map((cls, idx) => {
                    const lessonDate = new Date(cls.scheduled_at);
                    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                    const isPast = lessonDate < new Date();
                    const originalIdx = selectedPack.scheduled_classes?.findIndex(c => c.id === cls.id) ?? idx;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={async () => {
                          const { error } = await supabase.from('lesson_completions').insert({
                            pack_purchase_id: selectedPack.id,
                            class_id: cls.id,
                            completed_by: effectiveUserId
                          });
                          if (error) {
                            alert('Erro ao marcar aula: ' + error.message);
                            return;
                          }
                          setShowCompletionModal(false);
                          setSelectedPack(null);
                          loadPackPurchases();
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition hover:border-green-400 hover:bg-green-50 ${
                          isPast ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isPast ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-600'}`}>
                            {originalIdx + 1}
                          </div>
                          <span className="text-sm text-gray-800">
                            {dayNames[lessonDate.getDay()]}, {lessonDate.toLocaleDateString('pt-PT')} às {lessonDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <Check className="w-5 h-5 text-green-500" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await supabase.from('lesson_completions').insert({
                      pack_purchase_id: selectedPack.id,
                      class_id: null,
                      completed_by: effectiveUserId
                    });
                    if (error) {
                      alert('Erro ao marcar aula: ' + error.message);
                      return;
                    }
                    setShowCompletionModal(false);
                    setSelectedPack(null);
                    loadPackPurchases();
                  }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 font-medium"
                >
                  <Check className="w-5 h-5" />
                  Marcar Próxima Aula como Completada
                </button>
              )}

              <button type="button" onClick={() => { setShowCompletionModal(false); setSelectedPack(null); }} className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Reschedule Lesson Modal */}
      {showRescheduleModal && rescheduleClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Reagendar Aula</h2>
              <button onClick={() => { setShowRescheduleModal(false); setRescheduleClass(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!rescheduleClass || !rescheduleDate) return;

              setSaving(true);

              const [hours, minutes] = rescheduleTime.split(':').map(Number);
              const newDate = new Date(rescheduleDate);
              newDate.setHours(hours, minutes, 0, 0);

              // Update the class date
              const { error: classError } = await supabase
                .from('club_classes')
                .update({ scheduled_at: newDate.toISOString() })
                .eq('id', rescheduleClass.id);

              if (classError) {
                alert('Erro ao reagendar aula: ' + classError.message);
                setSaving(false);
                return;
              }

              // Update associated court booking if exists
              if (rescheduleClass.court_id) {
                const oldDate = new Date(rescheduleClass.scheduled_at);
                const oldStart = oldDate.toISOString();
                
                // Find and update matching booking
                const { data: existingBooking } = await supabase
                  .from('court_bookings')
                  .select('id, start_time, end_time')
                  .eq('court_id', rescheduleClass.court_id)
                  .eq('user_id', effectiveUserId)
                  .gte('start_time', new Date(oldDate.getTime() - 60000).toISOString())
                  .lte('start_time', new Date(oldDate.getTime() + 60000).toISOString())
                  .limit(1)
                  .single();

                if (existingBooking) {
                  const oldBookingStart = new Date(existingBooking.start_time);
                  const oldBookingEnd = new Date(existingBooking.end_time);
                  const durationMs = oldBookingEnd.getTime() - oldBookingStart.getTime();
                  const newEnd = new Date(newDate.getTime() + durationMs);

                  await supabase
                    .from('court_bookings')
                    .update({
                      start_time: newDate.toISOString(),
                      end_time: newEnd.toISOString()
                    })
                    .eq('id', existingBooking.id);
                }
              }

              setShowRescheduleModal(false);
              setRescheduleClass(null);
              setSaving(false);
              loadPackPurchases();
              loadData();
            }} className="p-4 space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Data actual:</strong>
                </p>
                <p className="text-sm font-medium text-amber-800 mt-1">
                  {(() => {
                    const d = new Date(rescheduleClass.scheduled_at);
                    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                    return `${dayNames[d.getDay()]}, ${d.toLocaleDateString('pt-PT')} às ${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
                  })()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Data *</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Hora *</label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Nova data:</strong>{' '}
                  {rescheduleDate ? (() => {
                    const d = new Date(rescheduleDate);
                    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                    return `${dayNames[d.getDay()]}, ${d.toLocaleDateString('pt-PT')} às ${rescheduleTime}`;
                  })() : 'Selecione uma data'}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowRescheduleModal(false); setRescheduleClass(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Calendar className="w-4 h-4" />
                  {saving ? t.message.saving : 'Reagendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}