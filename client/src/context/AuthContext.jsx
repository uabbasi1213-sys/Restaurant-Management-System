import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(data => {
          setUser(data.user);
          setRestaurant(data.restaurant);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const me = await api.get('/auth/me');
    setRestaurant(me.restaurant);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setRestaurant(null);
  };

  const updateRestaurant = (data) => setRestaurant(data);

  return (
    <AuthContext.Provider value={{ user, restaurant, loading, login, logout, updateRestaurant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
