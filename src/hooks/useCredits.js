import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { api } from '@utils/axios';
import { setCredits } from '@store/slices/creditsSlice';

export const useCredits = () => {
  const dispatch = useDispatch();
  const { data, loading } = useSelector(s => s.credits);

  useEffect(() => {
    if (!data && !loading) {
      api.get('/user/credits')
        .then(({ data: res }) => dispatch(setCredits(res.data)))
        .catch(() => {});
    }
  }, [data, loading, dispatch]);

  const total     = (data?.totalCredits || 0) + (data?.topupCredits || 0);
  const remaining = data ? Math.max(0, total - (data.usedCredits || 0)) : 0;
  const usagePct  = total > 0 ? Math.round(((data?.usedCredits || 0) / total) * 100) : 0;

  return { credits: data, remaining, usagePct, loading };
};