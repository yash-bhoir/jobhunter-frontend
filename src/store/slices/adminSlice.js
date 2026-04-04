import { createSlice } from '@reduxjs/toolkit';

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    stats:       null,
    users:       [],
    totalUsers:  0,
    loading:     false,
    error:       null,
    selectedUser: null,
  },
  reducers: {
    setAdminStats:    (state, action) => { state.stats = action.payload; },
    setAdminUsers:    (state, action) => { state.users = action.payload.users; state.totalUsers = action.payload.total; },
    setSelectedUser:  (state, action) => { state.selectedUser = action.payload; },
    setAdminLoading:  (state, action) => { state.loading = action.payload; },
    setAdminError:    (state, action) => { state.error = action.payload; },
    updateUserInList: (state, action) => {
      const idx = state.users.findIndex(u => u._id === action.payload._id);
      if (idx !== -1) state.users[idx] = { ...state.users[idx], ...action.payload };
    },
    clearAdmin: (state) => {
      state.stats = null; state.users = []; state.totalUsers = 0;
      state.loading = false; state.error = null; state.selectedUser = null;
    },
  },
});

export const {
  setAdminStats, setAdminUsers, setSelectedUser,
  setAdminLoading, setAdminError, updateUserInList, clearAdmin,
} = adminSlice.actions;

export default adminSlice.reducer;
