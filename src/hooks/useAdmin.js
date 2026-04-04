import { useSelector, useDispatch } from 'react-redux';
import { api } from '@utils/axios';
import { useToast } from './useToast';
import {
  setAdminStats, setAdminUsers, setSelectedUser,
  setAdminLoading, setAdminError, updateUserInList,
} from '@store/slices/adminSlice';

export function useAdmin() {
  const dispatch = useDispatch();
  const toast    = useToast();
  const { stats, users, totalUsers, loading, error, selectedUser } = useSelector(s => s.admin);

  const fetchStats = async () => {
    dispatch(setAdminLoading(true));
    try {
      const { data } = await api.get('/admin/analytics/overview');
      dispatch(setAdminStats(data.data));
    } catch (err) {
      dispatch(setAdminError(err.response?.data?.message || 'Failed to load stats'));
    } finally {
      dispatch(setAdminLoading(false));
    }
  };

  const fetchUsers = async (params = {}) => {
    dispatch(setAdminLoading(true));
    try {
      const query = new URLSearchParams(params).toString();
      const { data } = await api.get(`/admin/users${query ? `?${query}` : ''}`);
      dispatch(setAdminUsers({ users: data.data || [], total: data.pagination?.total || 0 }));
    } catch (err) {
      dispatch(setAdminError(err.response?.data?.message || 'Failed to load users'));
    } finally {
      dispatch(setAdminLoading(false));
    }
  };

  const changePlan = async (userId, plan) => {
    try {
      await api.patch(`/admin/users/${userId}/plan`, { plan });
      dispatch(updateUserInList({ _id: userId, plan }));
      toast.success(`Plan updated to ${plan}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan');
    }
  };

  const addCredits = async (userId, credits = 100) => {
    try {
      await api.patch(`/admin/users/${userId}/credits`, { credits });
      toast.success(`Added ${credits} credits`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add credits');
    }
  };

  const banUser = async (userId, reason) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { status: 'banned', reason });
      dispatch(updateUserInList({ _id: userId, status: 'banned' }));
      toast.success('User banned');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to ban user');
    }
  };

  return {
    stats, users, totalUsers, loading, error, selectedUser,
    fetchStats, fetchUsers, changePlan, addCredits, banUser,
    selectUser: (u) => dispatch(setSelectedUser(u)),
  };
}
