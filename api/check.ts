// Diagnostic temporaire : la migration du rate limit est-elle appliquée ?
import { supabase } from './lib/clients';

const { data, error } = await supabase.rpc('check_rate_limit', {
  p_key: 'diagnostic',
  p_max: 100,
  p_window_seconds: 60,
});

console.log('check_rate_limit :', error ? `MANQUANTE (${error.message})` : `OK (allowed=${data})`);
