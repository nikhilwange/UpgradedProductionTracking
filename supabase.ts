
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekcgvhntoztulffwqefm.supabase.co';
const supabaseKey = 'sb_publishable_9CjS_3M2cSM57RkRjAZMQw_6AUVvt2d';

export const supabase = createClient(supabaseUrl, supabaseKey);
