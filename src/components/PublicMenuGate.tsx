import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PublicMenu from './PublicMenu';

interface Props {
  clubId: string;
  tableNumber: string | null;
}

export default function PublicMenuGate({ clubId, tableNumber }: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('has_module', {
        p_entity_type: 'club',
        p_entity_id: clubId,
        p_module_code: 'bar',
      });
      setAllowed(!!data);
    })();
  }, [clubId]);

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🍽️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Menu indisponível</h1>
          <p className="text-gray-500 text-sm">
            O módulo de bar/restaurante não está ativo para este clube.
          </p>
        </div>
      </div>
    );
  }

  return <PublicMenu clubId={clubId} tableNumber={tableNumber} />;
}
