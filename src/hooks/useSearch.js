import { useSelector, useDispatch } from 'react-redux';
import { startSearch, updateProgress, completeSearch, setSearchError } from '@store/slices/searchSlice';
import { setJobs } from '@store/slices/jobsSlice';
import { api } from '@utils/axios';
import { useToast } from './useToast';
import { useNavigate } from 'react-router-dom';

export function useSearch() {
  const dispatch  = useDispatch();
  const toast     = useToast();
  const navigate  = useNavigate();
  const { running, progress, currentSearchId, error } = useSelector(s => s.search);

  const runSearch = async ({ role, location, workType, platforms, force = false }) => {
    if (!role?.trim()) { toast.error('Please enter a job role'); return null; }

    dispatch(startSearch(null));

    try {
      const { data } = await api.post('/search/run', {
        role: role.trim(),
        location: location?.trim() || 'India',
        workType,
        platforms,
        force,
      });

      dispatch(setJobs(data.data.jobs || []));
      dispatch(completeSearch());

      if (data.data.fromCache) {
        toast.success(`Loaded from cache — saved 10 credits! (${data.data.jobs?.length} jobs)`);
      } else {
        toast.success(`Found ${data.data.totalFound} jobs!`);
      }

      setTimeout(() => navigate('/results'), 1500);
      return data.data;

    } catch (err) {
      dispatch(setSearchError(err.response?.data?.message || 'Search failed'));
      toast.error(err.response?.data?.message || 'Search failed');
      return null;
    }
  };

  const checkCache = async ({ role, location, workType }) => {
    if (!role?.trim()) return null;
    try {
      const params = new URLSearchParams({
        role: role.trim(),
        ...(location  && { location  }),
        ...(workType  && { workType  }),
      });
      const { data } = await api.get(`/search/check-cache?${params}`);
      return data.data;
    } catch {
      return null;
    }
  };

  return { running, progress, currentSearchId, error, runSearch, checkCache };
}
