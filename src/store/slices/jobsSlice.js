import { createSlice } from '@reduxjs/toolkit';
const s = createSlice({
  name: 'jobs',
  initialState: { list: [], selected: null, filters: {}, sort: 'matchScore' },
  reducers: {
    setJobs:         (s, a) => { s.list = a.payload; },
    setSelected:     (s, a) => { s.selected = a.payload; },
    setFilters:      (s, a) => { s.filters = { ...s.filters, ...a.payload }; },
    clearFilters:    (s)    => { s.filters = {}; },
    setSort:         (s, a) => { s.sort = a.payload; },
    updateJobStatus: (s, a) => {
      const job = s.list.find(j => j._id === a.payload.id);
      if (job) job.status = a.payload.status;
    },
  },
});
export const { setJobs, setSelected, setFilters, clearFilters, setSort, updateJobStatus } = s.actions;
export default s.reducer;