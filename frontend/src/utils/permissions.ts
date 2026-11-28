import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const PERMISSIONS_UPDATED_EVENT = 'user-permissions-updated';
const SYNC_THROTTLE_MS = 5000;

let inflightSync: Promise<any> | null = null;
let lastSyncAt = 0;

export const getStoredUser = (): any => {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getStoredPermissions = (user?: any): string[] => {
  const target = user !== undefined ? user : getStoredUser();
  return Array.isArray(target?.role?.permissions) ? target.role.permissions : [];
};

export const checkHasPerm = (perm: string, permissions: string[], user: any): boolean => {
  if (permissions.includes('ALL')) return true;
  if (permissions.length === 0 && !user?.roleId) return true;
  return permissions.includes(perm);
};

export const checkHasAnyPerm = (perms: string[], permissions: string[], user: any): boolean => {
  if (permissions.includes('ALL')) return true;
  if (permissions.length === 0 && !user?.roleId) return true;
  return perms.some((p) => permissions.includes(p));
};

export const notifyUserPermissionsUpdated = (updatedUser?: any) => {
  if (updatedUser) {
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }
  window.dispatchEvent(new Event(PERMISSIONS_UPDATED_EVENT));
};

/**
 * Fetches the current user's fresh role and permissions from the backend
 * so permission changes made by an admin take effect without re-login.
 */
export const syncUserPermissions = async (force = false): Promise<any> => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_THROTTLE_MS) {
    return getStoredUser();
  }

  if (inflightSync) {
    return inflightSync;
  }

  inflightSync = (async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (data && data.id !== undefined) {
        lastSyncAt = Date.now();
        notifyUserPermissionsUpdated(data);
        return data;
      }
    } catch (err: any) {
      // Fallback to /roles/:id if /auth/me is unavailable on an older backend instance
      const currentUser = getStoredUser();
      if (currentUser?.roleId && Number(currentUser.roleId) > 0 && err?.response?.status !== 401) {
        try {
          const { data: roleData } = await api.get(`/roles/${currentUser.roleId}`);
          if (roleData) {
            lastSyncAt = Date.now();
            const merged = { ...currentUser, role: roleData };
            notifyUserPermissionsUpdated(merged);
            return merged;
          }
        } catch {
          // Ignore fallback errors cleanly
        }
      }
    } finally {
      inflightSync = null;
    }
    return getStoredUser();
  })();

  return inflightSync;
};

export const usePermissions = () => {
  const [user, setUser] = useState<any>(() => getStoredUser());
  const [permissions, setPermissions] = useState<string[]>(() => getStoredPermissions());

  const readFromStorage = useCallback(() => {
    const nextUser = getStoredUser();
    setUser(nextUser);
    setPermissions(getStoredPermissions(nextUser));
  }, []);

  useEffect(() => {
    readFromStorage();
    syncUserPermissions(false);

    const handleUpdate = () => readFromStorage();
    const handleFocus = () => {
      syncUserPermissions(false);
    };

    window.addEventListener(PERMISSIONS_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener(PERMISSIONS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, [readFromStorage]);

  const hasPerm = useCallback(
    (perm: string) => checkHasPerm(perm, permissions, user),
    [permissions, user]
  );

  const hasAnyPerm = useCallback(
    (perms: string[]) => checkHasAnyPerm(perms, permissions, user),
    [permissions, user]
  );

  const refreshPermissions = useCallback(() => syncUserPermissions(true), []);

  return { user, permissions, hasPerm, hasAnyPerm, refreshPermissions };
};

