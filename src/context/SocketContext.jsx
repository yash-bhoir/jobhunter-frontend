import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthContext } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user }    = useAuthContext();
  const socketRef   = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const envUrl = import.meta.env.VITE_SOCKET_URL?.trim();
    const socketUrl = envUrl || window.location.origin;
    const socket = io(socketUrl, {
      withCredentials: true,
      // Allow long-polling first — websocket-only often fails or reconnect-loops behind Vite’s dev proxy.
      transports:           ['polling', 'websocket'],
      reconnection:           true,
      reconnectionAttempts:   8,
      reconnectionDelay:      1000,
      reconnectionDelayMax:   8000,
    });

    socket.on('connect',    () => { setConnected(true);  socket.emit('join', user._id); });
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;
    return () => { socket.disconnect(); setConnected(false); };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocketContext = () => useContext(SocketContext);