import { createSlice } from '@reduxjs/toolkit';
const s = createSlice({
  name: 'ui',
  initialState: { sidebarOpen: true, upgradeModal: false, activeModal: null },
  reducers: {
    toggleSidebar:  (s)    => { s.sidebarOpen = !s.sidebarOpen; },
    setSidebar:     (s, a) => { s.sidebarOpen = a.payload; },
    setUpgradeModal:(s, a) => { s.upgradeModal = a.payload; },
    openModal:      (s, a) => { s.activeModal = a.payload; },
    closeModal:     (s)    => { s.activeModal = null; },
  },
});
export const { toggleSidebar, setSidebar, setUpgradeModal, openModal, closeModal } = s.actions;
export default s.reducer;