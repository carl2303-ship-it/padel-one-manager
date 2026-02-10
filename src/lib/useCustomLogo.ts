import { useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from './supabase';
import { AuthContext } from './authContext';

export function useCustomLogo(userId?: string) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const authContext = useContext(AuthContext);
  const user = authContext?.user;

  const targetUserId = userId || user?.id;

  const loadLogo = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('user_logo_settings')
        .select('logo_url')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    } catch (error) {
      console.error('Error loading custom logo:', error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadLogo();
  }, [loadLogo]);

  return {
    logoUrl: logoUrl || '/icon.png',
    hasCustomLogo: !!logoUrl,
    loading,
  };
}
