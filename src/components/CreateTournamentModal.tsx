import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import { X, Upload } from 'lucide-react';
import { compressImage, formatFileSize } from '../lib/imageCompressor';

type CreateTournamentModalProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function CreateTournamentModal({ onClose, onSuccess }: CreateTournamentModalProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '12:00',
    daily_start_time: '09:00',
    daily_end_time: '21:00',
    format: 'single_elimination' as const,
    round_robin_type: 'teams' as const,
    max_teams: 16,
    number_of_courts: 1,
    match_duration_minutes: 15,
    teams_per_group: 4,
    number_of_groups: 4,
    knockout_stage: 'quarterfinals' as 'final' | 'round_of_16' | 'quarterfinals' | 'semifinals',
    registration_fee: 0,
    category_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [dailySchedules, setDailySchedules] = useState<Array<{ date: string; start_time: string; end_time: string }>>([]);
  const [clubCourts, setClubCourts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [selectedCourtNames, setSelectedCourtNames] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchClubCourts();
    }
  }, [user]);

  const fetchClubCourts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('club_courts')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (error) {
      console.error('Error fetching courts:', error);
      return;
    }

    if (data) {
      setClubCourts(data);
      if (data.length > 0) {
        setSelectedCourtNames(data.slice(0, formData.number_of_courts).map(c => c.name));
      }
    }
  };

  const toggleCourtSelection = (courtName: string) => {
    setSelectedCourtNames(prev => {
      if (prev.includes(courtName)) {
        return prev.filter(n => n !== courtName);
      }
      return [...prev, courtName];
    });
  };

  const generateDailySchedules = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const schedules: Array<{ date: string; start_time: string; end_time: string }> = [];

    const current = new Date(start);
    while (current <= end) {
      schedules.push({
        date: current.toISOString().split('T')[0],
        start_time: formData.daily_start_time,
        end_time: formData.daily_end_time,
      });
      current.setDate(current.getDate() + 1);
    }

    setDailySchedules(schedules);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 2 * 1024 * 1024;

    if (file.size > 10 * 1024 * 1024) {
      setError('Imagem muito grande (max 10MB antes de compressao)');
      return;
    }

    try {
      setError('');
      const compressed = await compressImage(file);

      if (compressed.size > maxSize) {
        setError(`Imagem ainda muito grande apos compressao: ${formatFileSize(compressed.size)}. Tente uma imagem mais pequena.`);
        return;
      }

      setImageFile(compressed);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch {
      setError('Erro ao processar imagem');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setError('End date must be after start date');
      setLoading(false);
      return;
    }

    if (!formData.category_name.trim()) {
      setError('Category name is required');
      setLoading(false);
      return;
    }

    if (selectedCourtNames.length === 0 && clubCourts.length > 0) {
      setError('Selecione pelo menos um campo');
      setLoading(false);
      return;
    }

    let imageUrl = formData.image_url;

    if (imageFile) {
      setUploading(true);
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tournament-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        setError(`Upload error: ${uploadError.message}`);
        setLoading(false);
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('tournament-images')
        .getPublicUrl(filePath);

      imageUrl = publicUrl;
      setUploading(false);
    }

    const { data: tournamentData, error: submitError } = await supabase.from('tournaments').insert([
      {
        name: formData.name,
        description: formData.description,
        image_url: imageUrl,
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        daily_start_time: formData.start_time,
        daily_end_time: formData.end_time,
        format: formData.format,
        round_robin_type: formData.round_robin_type,
        max_teams: 999,
        number_of_courts: selectedCourtNames.length || formData.number_of_courts,
        court_names: selectedCourtNames.length > 0 ? selectedCourtNames : null,
        match_duration_minutes: formData.match_duration_minutes,
        teams_per_group: formData.teams_per_group,
        number_of_groups: formData.number_of_groups,
        knockout_stage: formData.knockout_stage,
        registration_fee: formData.registration_fee,
        daily_schedules: dailySchedules.length > 0 ? dailySchedules : null,
        status: 'draft',
        user_id: user?.id,
      },
    ]).select();

    if (submitError) {
      setError(submitError.message);
      setLoading(false);
      return;
    }

    if (!tournamentData || tournamentData.length === 0) {
      setError('Failed to create tournament');
      setLoading(false);
      return;
    }

    const tournamentId = tournamentData[0].id;

    const { error: categoryError } = await supabase.from('tournament_categories').insert([
      {
        tournament_id: tournamentId,
        name: formData.category_name,
        format: formData.format === 'round_robin' ? 'single_elimination' : formData.format,
        number_of_groups: formData.format === 'groups_knockout' ? formData.number_of_groups : 0,
        max_teams: formData.max_teams,
      },
    ]);

    if (categoryError) {
      setError(`Tournament created but failed to create category: ${categoryError.message}`);
      setLoading(false);
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t.tournament.create}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.tournament.name} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Summer Padel Championship 2024"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.tournament.description}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add tournament details, rules, or any additional information..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.tournament.imageUrl}</label>

            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview('');
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 text-gray-400 mb-3" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG ate 2MB (comprimido automaticamente)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1">{t.tournament.imageUrlHelper}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.tournament.startDate} *
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => {
                  setFormData({ ...formData, start_date: e.target.value });
                  if (e.target.value && formData.end_date) {
                    generateDailySchedules(e.target.value, formData.end_date);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.tournament.endDate} *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => {
                  setFormData({ ...formData, end_date: e.target.value });
                  if (formData.start_date && e.target.value) {
                    generateDailySchedules(formData.start_date, e.target.value);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.tournament.dailyStartTime} *
              </label>
              <input
                type="time"
                required
                value={formData.daily_start_time}
                onChange={(e) => setFormData({ ...formData, daily_start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">{t.tournament.dailyStartTimeHelper}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.tournament.dailyEndTime} *
              </label>
              <input
                type="time"
                required
                value={formData.daily_end_time}
                onChange={(e) => setFormData({ ...formData, daily_end_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">{t.tournament.dailyEndTimeHelper}</p>
            </div>
          </div>

          {dailySchedules.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.tournament.customizeSchedule || 'Customize Daily Schedule'}</h3>
              <p className="text-xs text-gray-600 mb-3">{t.tournament.customizeScheduleHelper || 'Set different hours for each day'}</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dailySchedules.map((schedule, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2 items-center bg-white p-2 rounded border border-gray-200">
                    <div className="text-sm font-medium text-gray-700">
                      {(() => {
                        const d = new Date(schedule.date + 'T00:00:00');
                        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                      })()}
                    </div>
                    <input
                      type="time"
                      value={schedule.start_time}
                      onChange={(e) => {
                        const updated = [...dailySchedules];
                        updated[index].start_time = e.target.value;
                        setDailySchedules(updated);
                      }}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="time"
                      value={schedule.end_time}
                      onChange={(e) => {
                        const updated = [...dailySchedules];
                        updated[index].end_time = e.target.value;
                        setDailySchedules(updated);
                      }}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.category.name} *
            </label>
            <input
              type="text"
              required
              value={formData.category_name}
              onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., M1, F1, Open, Mixed"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t.category.required || 'Each tournament must have at least one category. You can add more categories later.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.tournament.format} *
            </label>
            <select
              value={formData.format}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  format: e.target.value as 'single_elimination' | 'round_robin' | 'groups_knockout' | 'individual_groups_knockout',
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="single_elimination">{t.format.single_elimination}</option>
              <option value="round_robin">{t.format.round_robin}</option>
              <option value="groups_knockout">{t.format.groups_knockout}</option>
              <option value="individual_groups_knockout">Grupos Individuais + Eliminatórias</option>
            </select>
          </div>

          {formData.format === 'round_robin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Round Robin Type *
              </label>
              <select
                value={formData.round_robin_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    round_robin_type: e.target.value as 'teams' | 'individual',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="teams">Teams (Fixed Pairs)</option>
                <option value="individual">Individual (Rotating Partners)</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {formData.round_robin_type === 'teams'
                  ? 'Teams play all other teams'
                  : 'Players rotate partners each round'}
              </p>
            </div>
          )}

          {formData.format === 'round_robin' && formData.round_robin_type === 'individual' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Individual Round Robin</h4>
              <p className="text-sm text-blue-800">
                Start time and end time will be used to calculate match duration automatically based on number of players.
                Players will be randomly paired each round.
              </p>
            </div>
          )}

          {formData.format === 'individual_groups_knockout' && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <h4 className="font-semibold text-amber-900 mb-2">Importante: Categorias dos Jogadores</h4>
              <p className="text-sm text-amber-800">
                Antes de inscrever jogadores neste torneio, certifique-se de que a <strong>categoria de cada jogador</strong> esta atualizada na sua lista de jogadores.
                O sistema usa a categoria (M5, M6, F5, F6...) para determinar automaticamente o genero e pontuar na liga correta.
              </p>
            </div>
          )}

          {(formData.format === 'groups_knockout' || formData.format === 'individual_groups_knockout') && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.tournament.numberOfGroups} *
                  </label>
                  <select
                    value={formData.number_of_groups}
                    onChange={(e) =>
                      setFormData({ ...formData, number_of_groups: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={2}>2 grupos</option>
                    <option value={3}>3 grupos</option>
                    <option value={4}>4 grupos</option>
                    <option value={5}>5 grupos</option>
                    <option value={6}>6 grupos</option>
                    <option value={8}>8 grupos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.format === 'individual_groups_knockout' ? 'Jogadores por Grupo *' : 'Teams per Group *'}
                  </label>
                  <select
                    value={formData.teams_per_group}
                    onChange={(e) =>
                      setFormData({ ...formData, teams_per_group: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={3}>{formData.format === 'individual_groups_knockout' ? '3 jogadores' : '3 teams'}</option>
                    <option value={4}>{formData.format === 'individual_groups_knockout' ? '4 jogadores' : '4 teams'}</option>
                    <option value={5}>{formData.format === 'individual_groups_knockout' ? '5 jogadores' : '5 teams'}</option>
                    <option value={6}>{formData.format === 'individual_groups_knockout' ? '6 jogadores' : '6 teams'}</option>
                    <option value={8}>{formData.format === 'individual_groups_knockout' ? '8 jogadores' : '8 teams'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.tournament.knockoutStageLabel} *
                  </label>
                  <select
                    value={formData.knockout_stage}
                    onChange={(e) =>
                      setFormData({ ...formData, knockout_stage: e.target.value as 'final' | 'round_of_16' | 'quarterfinals' | 'semifinals' })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="final">Final (2 qualificados)</option>
                    <option value="semifinals">Meias-Finais (4 qualificados)</option>
                    <option value="quarterfinals">Quartos (8 qualificados)</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                {formData.format === 'individual_groups_knockout' ? (
                  <p className="text-sm text-blue-800">
                    <strong>Grupos Individuais + Eliminatórias:</strong> {formData.number_of_groups} grupos com {formData.teams_per_group} jogadores cada (total: {formData.number_of_groups * formData.teams_per_group} jogadores).
                    Todos contra todos dentro de cada grupo (individual). Depois, os melhores qualificam-se para {formData.knockout_stage === 'final' ? 'a final' : formData.knockout_stage === 'semifinals' ? 'as meias-finais' : 'os quartos de final'} com equipas formadas aleatoriamente.
                  </p>
                ) : (
                  <p className="text-sm text-blue-800">
                    <strong>Groups + Knockout:</strong> {formData.number_of_groups} groups with {formData.teams_per_group} teams each (total: {formData.number_of_groups * formData.teams_per_group} teams).
                    {t.tournament.knockoutStageDescription} {formData.knockout_stage === 'final' ? t.tournament.twoTeamFinal : formData.knockout_stage === 'semifinals' ? t.tournament.fourTeamSemifinals : formData.knockout_stage === 'quarterfinals' ? t.tournament.eightTeamQuarterfinals : t.tournament.sixteenTeamRoundOf16}.
                    {formData.knockout_stage === 'round_of_16' && ` ${t.tournament.best3rdIncluded}`}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.round_robin_type === 'individual' || formData.format === 'individual_groups_knockout'
                  ? 'Max Jogadores (categoria)'
                  : 'Max Equipas (categoria)'
                } *
              </label>
              <select
                value={formData.max_teams}
                onChange={(e) =>
                  setFormData({ ...formData, max_teams: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={4}>4</option>
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={14}>14</option>
                <option value={16}>16</option>
                <option value={32}>32</option>
                <option value={64}>64</option>
                <option value={120}>120</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Limite de inscricoes para esta categoria
              </p>
            </div>

          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.tournament.courts} * ({selectedCourtNames.length} selecionado{selectedCourtNames.length !== 1 ? 's' : ''})
            </label>
            {clubCourts.length > 0 ? (
              <div className="border border-gray-300 rounded-lg p-3 space-y-2 bg-gray-50">
                {clubCourts.map((court) => {
                  const isSelected = selectedCourtNames.includes(court.name);
                  return (
                    <label
                      key={court.id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCourtSelection(court.name)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">{court.name}</span>
                      <span className="text-xs text-gray-500 capitalize">({court.type})</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Nenhum campo configurado no clube</p>
                <p className="text-xs text-gray-400 mt-1">Configure os campos na secao "Campos" do clube</p>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Selecione os campos que serao utilizados neste torneio
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.tournament.matchDuration} *
            </label>
            <select
              required
              value={formData.match_duration_minutes}
              onChange={(e) =>
                setFormData({ ...formData, match_duration_minutes: parseInt(e.target.value) })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 13 }, (_, i) => i + 8).map((min) => (
                <option key={min} value={min}>{min} minutes</option>
              ))}
              {Array.from({ length: 20 }, (_, i) => 25 + i * 5).map((min) => (
                <option key={min} value={min}>{min} minutes</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {t.tournament.matchDurationHelper}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.registration.fee}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.registration_fee}
              onChange={(e) =>
                setFormData({ ...formData, registration_fee: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t.registration.feeHelper}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              {t.button.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t.message.saving : t.tournament.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
