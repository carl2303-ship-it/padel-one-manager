import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/authContext';

type OrganizerVenue = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  club_id: string | null;
  courts: Array<{ id: string; name: string; is_active: boolean }>;
};

type DirectoryClub = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  owner_id: string | null;
};

type VenueForm = {
  name: string;
  city: string;
  address: string;
  courtsText: string;
};

const emptyForm = (): VenueForm => ({
  name: '',
  city: '',
  address: '',
  courtsText: 'Campo 1\nCampo 2',
});

/**
 * Manager lite — CRUD de organizer_venues + courts (sem court bookings).
 * A Tour só selecciona venues já geridos aqui.
 */
export default function OrganizerVenuesManagement() {
  const { user } = useAuth();
  const userId = user?.id;

  const [directoryClubs, setDirectoryClubs] = useState<DirectoryClub[]>([]);
  const [venues, setVenues] = useState<OrganizerVenue[]>([]);
  const [clubCourtNames, setClubCourtNames] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VenueForm>(emptyForm());

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const [{ data: clubRows, error: clubErr }, { data: venueRows, error: vErr }] = await Promise.all([
        supabase
          .from('clubs')
          .select('id, name, city, address, owner_id')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('organizer_venues')
          .select('id, name, address, city, club_id')
          .eq('user_id', userId)
          .order('name'),
      ]);
      if (clubErr) throw clubErr;
      if (vErr) throw vErr;

      setDirectoryClubs(clubRows || []);

      const ids = (venueRows || []).map((v) => v.id);
      const courtsByVenue = new Map<string, Array<{ id: string; name: string; is_active: boolean }>>();
      if (ids.length > 0) {
        const { data: courtRows, error: cErr } = await supabase
          .from('organizer_venue_courts')
          .select('id, venue_id, name, is_active, sort_order')
          .in('venue_id', ids)
          .order('sort_order');
        if (cErr) throw cErr;
        for (const c of courtRows || []) {
          const list = courtsByVenue.get(c.venue_id) || [];
          list.push({ id: c.id, name: c.name, is_active: c.is_active });
          courtsByVenue.set(c.venue_id, list);
        }
      }

      setVenues(
        (venueRows || []).map((v) => ({
          ...v,
          courts: courtsByVenue.get(v.id) || [],
        }))
      );

      const owners = [...new Set((clubRows || []).map((c) => c.owner_id).filter(Boolean))] as string[];
      const courtMap = new Map<string, string[]>();
      if (owners.length > 0) {
        const { data: ownedCourts } = await supabase
          .from('club_courts')
          .select('user_id, name, is_active')
          .in('user_id', owners)
          .eq('is_active', true)
          .order('sort_order');
        const byOwner = new Map<string, string[]>();
        for (const c of ownedCourts || []) {
          const list = byOwner.get(c.user_id) || [];
          if (c.name?.trim()) list.push(c.name.trim());
          byOwner.set(c.user_id, list);
        }
        for (const club of clubRows || []) {
          if (!club.owner_id) continue;
          courtMap.set(club.id, byOwner.get(club.owner_id) || []);
        }
      }
      setClubCourtNames(courtMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clubes');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const venueByClubId = useMemo(() => {
    const map = new Map<string, OrganizerVenue>();
    for (const v of venues) {
      if (v.club_id) map.set(v.club_id, v);
    }
    return map;
  }, [venues]);

  const filteredDirectory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const linked = new Set([...venueByClubId.keys()]);
    const list = (directoryClubs || []).filter((c) => !linked.has(c.id));
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
  }, [directoryClubs, search, venueByClubId]);

  const filteredVenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.city || '').toLowerCase().includes(q) ||
        (v.address || '').toLowerCase().includes(q)
    );
  }, [venues, search]);

  const parseCourtNames = (text: string): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of text.split('\n')) {
      const n = line.trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    setError('');
  };

  const openEdit = (venue: OrganizerVenue) => {
    setEditingId(venue.id);
    setForm({
      name: venue.name,
      city: venue.city || '',
      address: venue.address || '',
      courtsText: venue.courts.map((c) => c.name).join('\n') || 'Campo 1',
    });
    setShowForm(true);
    setError('');
  };

  const linkDirectoryClub = async (club: DirectoryClub) => {
    if (!userId) return;
    setBusy(true);
    setError('');
    try {
      if (venueByClubId.has(club.id)) return;

      const { data: venueRow, error: venueErr } = await supabase
        .from('organizer_venues')
        .insert({
          user_id: userId,
          club_id: club.id,
          name: club.name,
          city: club.city,
          address: club.address,
        })
        .select('id')
        .single();
      if (venueErr) throw venueErr;

      const seedCourts = clubCourtNames.get(club.id) || [];
      if (seedCourts.length > 0) {
        await supabase.from('organizer_venue_courts').insert(
          seedCourts.map((cn, i) => ({
            venue_id: venueRow.id,
            name: cn,
            sort_order: i,
            is_active: true,
          }))
        );
      }
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar clube');
    } finally {
      setBusy(false);
    }
  };

  const saveVenue = async () => {
    if (!userId) return;
    const name = form.name.trim();
    if (!name) {
      setError('Indica o nome do clube.');
      return;
    }
    const courtNames = parseCourtNames(form.courtsText);
    if (courtNames.length === 0) {
      setError('Indica pelo menos um campo.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (editingId) {
        const venue = venues.find((v) => v.id === editingId);
        const { error: updErr } = await supabase
          .from('organizer_venues')
          .update({
            name,
            city: form.city.trim() || null,
            address: form.address.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .eq('user_id', userId);
        if (updErr) throw updErr;

        if (venue?.club_id) {
          const dir = directoryClubs.find((c) => c.id === venue.club_id);
          if (dir && !dir.owner_id) {
            await supabase
              .from('clubs')
              .update({
                name,
                city: form.city.trim() || null,
                address: form.address.trim() || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', venue.club_id);
          }
        }

        await supabase.from('organizer_venue_courts').delete().eq('venue_id', editingId);
        const { error: insCourtsErr } = await supabase.from('organizer_venue_courts').insert(
          courtNames.map((cn, i) => ({
            venue_id: editingId,
            name: cn,
            sort_order: i,
            is_active: true,
          }))
        );
        if (insCourtsErr) throw insCourtsErr;
      } else {
        const { data: venueRow, error: insErr } = await supabase
          .from('organizer_venues')
          .insert({
            user_id: userId,
            name,
            city: form.city.trim() || null,
            address: form.address.trim() || null,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;

        const { error: courtsErr } = await supabase.from('organizer_venue_courts').insert(
          courtNames.map((cn, i) => ({
            venue_id: venueRow.id,
            name: cn,
            sort_order: i,
            is_active: true,
          }))
        );
        if (courtsErr) throw courtsErr;
      }

      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar clube');
    } finally {
      setBusy(false);
    }
  };

  const unlinkVenue = async (venue: OrganizerVenue) => {
    if (!userId) return;
    if (!confirm(`Remover "${venue.name}" da tua lista de clubes?`)) return;
    setBusy(true);
    setError('');
    try {
      const { error: delErr } = await supabase
        .from('organizer_venues')
        .delete()
        .eq('id', venue.id)
        .eq('user_id', userId);
      if (delErr) throw delErr;
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover clube');
    } finally {
      setBusy(false);
    }
  };

  if (!userId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-blue-600" />
            Clubes / venues
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Locais onde operas torneios (dados e campos). Sem reservas de courts. Na Tour só
            seleccionas estes venues.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Novo clube
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar na tua lista ou no directório…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          Os teus clubes ({venues.length})
        </h2>
        {filteredVenues.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center">
            Ainda não tens venues. Adiciona do directório Padel1 ou cria um novo.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-xl divide-y bg-white">
            {filteredVenues.map((venue) => (
              <div key={venue.id} className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{venue.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[venue.city, venue.address].filter(Boolean).join(' · ') || 'Sem morada'}
                    {' · '}
                    {venue.courts.filter((c) => c.is_active).length} campo(s)
                  </p>
                  {venue.courts.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {venue.courts
                        .filter((c) => c.is_active)
                        .map((c) => c.name)
                        .join(', ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(venue)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                  title="Editar campos"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => unlinkVenue(venue)}
                  disabled={busy}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          Directório Padel1 (adicionar)
        </h2>
        {filteredDirectory.length === 0 ? (
          <p className="text-sm text-gray-500">
            {search.trim()
              ? 'Nenhum clube do directório corresponde à pesquisa.'
              : 'Todos os clubes activos do directório já estão na tua lista (ou o directório está vazio).'}
          </p>
        ) : (
          <div className="border border-gray-200 rounded-xl divide-y max-h-72 overflow-y-auto bg-white">
            {filteredDirectory.map((club) => {
              const courtCount = clubCourtNames.get(club.id)?.length || 0;
              return (
                <div key={club.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{club.name}</p>
                    <p className="text-xs text-gray-500">
                      {[club.city, club.address].filter(Boolean).join(' · ') || 'Sem morada'}
                      {' · '}
                      {courtCount} campo(s)
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => linkDirectoryClub(club)}
                    className="shrink-0 text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {editingId ? 'Editar clube / campos' : 'Novo clube'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome do clube *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Padel Blu"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Morada</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Nomes dos campos (um por linha) *
              </label>
              <textarea
                value={form.courtsText}
                onChange={(e) => setForm((f) => ({ ...f, courtsText: e.target.value }))}
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder={'Campo 1\nCampo 2\nCampo Central'}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-2 text-sm border rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveVenue}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
