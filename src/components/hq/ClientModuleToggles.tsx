import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ToggleLeft, ToggleRight, Zap, AlertCircle } from 'lucide-react';

interface PlatformModule {
  code: string;
  name: string;
  description: string | null;
  target_types: string[];
  requires_modules: string[];
}

interface ClientModuleRow {
  module_code: string;
  enabled: boolean;
  expires_at: string | null;
}

interface Props {
  entityType: 'club' | 'organizer';
  entityId: string;
  entityName?: string;
}

export default function ClientModuleToggles({ entityType, entityId, entityName }: Props) {
  const [catalog, setCatalog] = useState<PlatformModule[]>([]);
  const [clientMods, setClientMods] = useState<Record<string, ClientModuleRow>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [catRes, modsRes] = await Promise.all([
      supabase.from('platform_modules').select('code, name, description, target_types, requires_modules').eq('is_active', true).order('sort_order'),
      supabase.from('client_modules').select('module_code, enabled, expires_at').eq('entity_type', entityType).eq('entity_id', entityId),
    ]);
    const applicable = (catRes.data || []).filter(m => m.target_types.includes(entityType));
    setCatalog(applicable);
    const map: Record<string, ClientModuleRow> = {};
    (modsRes.data || []).forEach(row => { map[row.module_code] = row; });
    setClientMods(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  const toggleModule = async (code: string, enabled: boolean) => {
    setToggling(code);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('set_client_module', {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_module_code: code,
      p_enabled: enabled,
      p_expires_at: null,
      p_notes: null,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else if (data) {
      await load();
    }
    setToggling(null);
  };

  const bulkEnable = async () => {
    if (!confirm(`Ativar todos os módulos para ${entityName || 'este cliente'}?`)) return;
    setBulkLoading(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('bulk_enable_all_modules', {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_expires_at: null,
    });
    if (rpcError) setError(rpcError.message);
    else await load();
    setBulkLoading(false);
  };

  const isEnabled = (code: string) => clientMods[code]?.enabled === true;

  const isBlocked = (mod: PlatformModule) => {
    if (!mod.requires_modules?.length) return false;
    return mod.requires_modules.some(req => !isEnabled(req));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-[#D32F2F]" />
        A carregar módulos...
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Zap size={14} className="text-[#D32F2F]" />
          Módulos Ativos
        </h4>
        <button
          onClick={bulkEnable}
          disabled={bulkLoading}
          className="px-3 py-1 rounded-lg text-xs font-medium bg-[#D32F2F]/10 text-[#D32F2F] hover:bg-[#D32F2F]/20 disabled:opacity-50"
        >
          {bulkLoading ? 'A ativar...' : 'Ativar Todos'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-900/20 border border-red-800/30 rounded-lg text-xs text-red-400">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {catalog.map(mod => {
          const enabled = isEnabled(mod.code);
          const blocked = isBlocked(mod);
          return (
            <div
              key={mod.code}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                enabled ? 'bg-green-900/10 border-green-800/30' : 'bg-[#111111] border-[#2a2a2a]'
              }`}
            >
              <div className="min-w-0 flex-1 mr-2">
                <div className="text-sm font-medium text-gray-200">{mod.name}</div>
                {mod.requires_modules?.length > 0 && (
                  <div className="text-[10px] text-gray-500">
                    Requer: {mod.requires_modules.join(', ')}
                  </div>
                )}
                {clientMods[mod.code]?.expires_at && (
                  <div className="text-[10px] text-yellow-500">
                    Expira: {new Date(clientMods[mod.code].expires_at!).toLocaleDateString('pt-PT')}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleModule(mod.code, !enabled)}
                disabled={toggling === mod.code || (blocked && !enabled)}
                title={blocked && !enabled ? `Requer: ${mod.requires_modules.join(', ')}` : undefined}
                className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                  enabled
                    ? 'text-green-400 hover:bg-green-900/30'
                    : 'text-gray-500 hover:bg-[#2a2a2a]'
                }`}
              >
                {toggling === mod.code ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-current" />
                ) : enabled ? (
                  <><ToggleRight size={18} /> Ativo</>
                ) : (
                  <><ToggleLeft size={18} /> Inativo</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
