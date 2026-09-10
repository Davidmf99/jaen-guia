const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: pan } = await supabase.from('negocios').select('nombre').ilike('nombre', '%pan%');
  console.log("Negocios con 'pan':", pan);
  
  const { count: natCount } = await supabase.from('negocios').select('id', { count: 'exact', head: true }).eq('categoria_id', 'naturaleza'); // wait category is referenced by ID or tipo
  console.log("Count of naturaleza:", natCount);
}
run();
