import { createRoot } from 'react-dom/client';

import App from './App';
import { installSupabaseFetchAdapter } from './lib/supabase-fetch-adapter';
import { installSupabaseExportOpenAdapter } from './lib/supabase-export-open';

import './index.css';

installSupabaseFetchAdapter();
installSupabaseExportOpenAdapter();

createRoot(document.getElementById('root')!).render(<App />);
