import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthContext } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user }    = useAuthContext();
  const socketRef   = useRef(null);
  /** Real socket instance in state so consumers re-render and attach listeners as soon as `io()` exists (not only after `connect`). */
  const [socket, setSocket]     = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    const envUrl = import.meta.env.VITE_SOCKET_URL?.trim();
    const socketUrl = envUrl || window.location.origin;
    const s = io(socketUrl, {
      withCredentials: true,
      // Allow long-polling first — websocket-only often fails or reconnect-loops behind Vite’s dev proxy.
      transports:           ['polling', 'websocket'],
      reconnection:           true,
      reconnectionAttempts:   8,
      reconnectionDelay:      1000,
      reconnectionDelayMax:   8000,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect',    () => { setConnected(true);  s.emit('join', user._id); });
    s.on('disconnect', () => setConnected(false));

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocketContext = () => useContext(SocketContext);