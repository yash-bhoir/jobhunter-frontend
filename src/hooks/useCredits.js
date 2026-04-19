import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useCallback } from 'react';
import { api } from '@utils/axios';
import { setCredits } from '@store/slices/creditsSlice';

export const useCredits = () => {
  const dispatch = useDispatch();
  const { data, loading } = useSelector(s => s.credits);

  const fetchCredits = useCallback(() => {
    api.get('/user/credits')
      .then(({ data: res }) => dispatch(setCredits(res.data)))
      .catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (!data && !loading) fetchCredits();
  }, [data, loading, fetchCredits]);

  const total     = (data?.totalCredits || 0) + (data?.topupCredits || 0);
  const remaining = data ? Math.max(0, total - (data.usedCredits || 0)) : 0;
  const usagePct  = total > 0 ? Math.round(((data?.usedCredits || 0) / total) * 100) : 0;

  return { credits: data, remaining, usagePct, loading, refreshCredits: fetchCredits };
};