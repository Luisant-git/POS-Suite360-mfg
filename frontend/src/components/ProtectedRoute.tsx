import { Navigate, Outlet } from 'react-router-dom';
import { usePermissions } from '../utils/permissions';

interface ProtectedRouteProps {
  requiredPerms?: string | string[];
}

const ProtectedRoute = ({ requiredPerms }: ProtectedRouteProps) => {
  const { user, hasPerm, hasAnyPerm } = usePermissions();
  const token = localStorage.getItem('token');

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPerms) {
    const authorized = Array.isArray(requiredPerms)
      ? hasAnyPerm(requiredPerms)
      : hasPerm(requiredPerms);

    if (!authorized) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
