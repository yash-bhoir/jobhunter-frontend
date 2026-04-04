import { createSlice } from '@reduxjs/toolkit';
const s = createSlice({
  name: 'auth',
  initialState: { user: null, loading: true },
  reducers: {
    setUser:    (s, a) => { s.user = a.payload; s.loading = false; },
    clearUser:  (s)    => { s.user = null; s.loading = false; },
    setLoading: (s, a) => { s.loading = a.payload; },
  },
});
export const { setUser, clearUser, setLoading } = s.actions;
export default s.reducer;