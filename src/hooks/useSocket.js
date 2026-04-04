import { useEffect } from 'react';
import { useSocketContext } from '@context/SocketContext';

export const useSocket = (event, handler, deps = []) => {
  const { socket } = useSocketContext();
  useEffect(() => {
    if (!socket || !event || !handler) return;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, event, ...deps]);
};