
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekcgvhntoztulffwqefm.supabase.co';
const supabaseKey = 'sb_publishable_9CjS_3M2cSM57RkRjAZMQw_6AUVvt2d';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  },
  global: {
    fetch: (url, options) => {
      const executeFetch = (retries = 2): Promise<Response> => {
        return fetch(url, options).catch(err => {
          if (retries > 0 && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
            return new Promise(resolve => setTimeout(resolve, 1000)).then(() => executeFetch(retries - 1));
          }
          throw err;
        });
      };
      return executeFetch();
    }
  }
});
