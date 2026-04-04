import { createSlice } from '@reduxjs/toolkit';
const s = createSlice({
  name: 'search',
  initialState: { running: false, progress: {}, currentSearchId: null, error: null },
  reducers: {
    startSearch:    (s, a) => { s.running = true; s.progress = {}; s.error = null; s.currentSearchId = a.payload; },
    updateProgress: (s, a) => { s.progress[a.payload.platform] = a.payload; },
    completeSearch: (s)    => { s.running = false; },
    setSearchError: (s, a) => { s.running = false; s.error = a.payload; },
  },
});
export const { startSearch, updateProgress, completeSearch, setSearchError } = s.actions;
export default s.reducer;