import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Building2, ToggleLeft, ToggleRight, Search } from 'lucide-react';

interface Club {
  id: string;
  name: string;
  city: string | null;
  status: string;
  tour_license_active: boolean;
}

export default function HQTourLicenses() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadClubs(); }, []);

  const loadClubs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clubs')
      .select('id, name, city, status, tour_license_active')
      .order('name');
    if (data) setClubs(data);
    setLoading(false);
  };

  const toggleTourLicense = async (club: Club) => {
    setSaving(club.id);
    const { error } = await supabase
      .from('clubs')
      .update({ tour_license_active: !club.tour_license_active })
      .eq('id', club.id);
    if (!error) {
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, tour_license_active: !c.tour_license_active } : c));
    }
    setSaving(null);
  };

  const filteredClubs = clubs.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#D32F2F]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
        <Shield size={24} className="text-[#D32F2F]" />
        Licenças Tour
        <span className="text-sm font-normal text-gray-500 ml-2">({clubs.length} clubes)</span>
      </h1>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Pesquisar clube..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-[#D32F2F]/50"
        />
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-[#151515] text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
          <div className="col-span-4">Clube</div>
          <div className="col-span-2">Cidade</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-4">Tour License</div>
        </div>
        {filteredClubs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum clube encontrado.</div>
        ) : (
          filteredClubs.map(club => (
            <div key={club.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-3 border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#151515] transition-colors items-center">
              <div className="lg:col-span-4 text-sm font-medium text-gray-100 flex items-center gap-2">
                <Building2 size={14} className="text-gray-500 shrink-0" />
                {club.name}
              </div>
              <div className="lg:col-span-2 text-sm text-gray-400">{club.city || '—'}</div>
              <div className="lg:col-span-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  club.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                }`}>
                  {club.status === 'active' ? 'Ativo' : 'Suspenso'}
                </span>
              </div>
              <div className="lg:col-span-4">
                <button
                  onClick={() => toggleTourLicense(club)}
                  disabled={saving === club.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    club.tour_license_active
                      ? 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
                      : 'bg-[#2a2a2a] text-gray-500 hover:bg-[#333333]'
                  }`}
                >
                  {club.tour_license_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {club.tour_license_active ? 'Ativa' : 'Inativa'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
