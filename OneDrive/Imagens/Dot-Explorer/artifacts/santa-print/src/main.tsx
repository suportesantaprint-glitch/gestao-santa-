import { createRoot } from 'react-dom/client';

import App from './App';
import { installSupabaseFetchAdapter } from './lib/supabase-fetch-adapter';

import './index.css';

installSupabaseFetchAdapter();

createRoot(document.getElementById('root')!).render(<App />);
