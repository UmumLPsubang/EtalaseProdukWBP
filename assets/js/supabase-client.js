// Kredensial publik Supabase - aman dipakai di browser karena akses data
// dibatasi oleh Row Level Security (RLS) policy di sisi database.
const SUPABASE_URL = "https://ajcbklvimafrrpbucrii.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_CpJeuzVt42RBFGFr0GrFHA_9vpppqAz";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
