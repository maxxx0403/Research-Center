import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Reserve = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const labId = searchParams.get('lab_id');

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate(labId ? `/user/reserve?lab_id=${labId}` : '/user/reserve', { replace: true });
    } else {
      navigate(labId ? `/user-login?redirect=/user/reserve?lab_id=${labId}` : '/user-login?redirect=/user/reserve', { replace: true });
    }
  }, [user, loading, navigate, labId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>);

};

export default Reserve;