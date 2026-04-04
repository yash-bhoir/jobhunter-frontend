import { configureStore } from '@reduxjs/toolkit';
import authReducer    from './slices/authSlice';
import creditsReducer from './slices/creditsSlice';
import searchReducer  from './slices/searchSlice';
import jobsReducer    from './slices/jobsSlice';
import uiReducer      from './slices/uiSlice';
import adminReducer   from './slices/adminSlice';

export const store = configureStore({
  reducer: {
    auth:    authReducer,
    credits: creditsReducer,
    search:  searchReducer,
    jobs:    jobsReducer,
    ui:      uiReducer,
    admin:   adminReducer,
  },
});
