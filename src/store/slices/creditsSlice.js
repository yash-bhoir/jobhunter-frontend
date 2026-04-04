import { createSlice } from '@reduxjs/toolkit';
const s = createSlice({
  name: 'credits',
  initialState: { data: null, loading: false },
  reducers: {
    setCredits:    (s, a) => { s.data = a.payload; s.loading = false; },
    deductCredits: (s, a) => { if (s.data) s.data.usedCredits += a.payload; },
    setLoading:    (s, a) => { s.loading = a.payload; },
  },
});
export const { setCredits, deductCredits, setLoading } = s.actions;
export default s.reducer;