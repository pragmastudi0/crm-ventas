import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { toast } from '@/components/ui/use-toast';
import { mapSupabaseAuthError } from '@/lib/mapSupabaseAuthError';

function inputStyle() {
  return {
    width: '100%',
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '11px 12px',
    color: '#FFFFFF',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, login, signup, role, authError, refreshAuth } = useAuth();
  const [mode, setMode] = useState('login');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const hoy = new Date().toISOString().split('T')[0];
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoadingAuth) return null;
  if (isAuthenticated) {
    if (role === null) {
      if (authError?.type === 'role') {
        return (
          <div
            style={{
              minHeight: '100vh',
              display: 'grid',
              placeItems: 'center',
              background: '#111111',
              padding: 16,
              color: '#FFFFFF',
              textAlign: 'center',
              gap: 16,
            }}
          >
            <p style={{ fontSize: 14, color: '#cccccc', maxWidth: 360 }}>{authError.message}</p>
            <button
              type="button"
              onClick={() => void refreshAuth()}
              style={{
                border: 'none',
                borderRadius: 999,
                background: '#E8001D',
                color: '#FFFFFF',
                fontWeight: 700,
                padding: '11px 20px',
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        );
      }
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#111111]">
          <div className="w-8 h-8 border-4 border-slate-600 border-t-[#E8001D] rounded-full animate-spin" />
        </div>
      );
    }
    return <Navigate to={role === 'admin' ? createPageUrl('Dashboard') : createPageUrl('PortalCliente')} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'signup') {
        const result = await signup(
          email.trim(),
          password,
          nombre.trim(),
          fechaNacimiento,
          telefono.trim(),
        );
        if (result.user && !result.session) {
          toast({
            title: 'Cuenta creada',
            description:
              'Tu cuenta quedó lista, pero la sesión no inició automáticamente. Probá ingresar con el mismo email y contraseña.',
          });
          setMode('login');
          setPassword('');
          setFechaNacimiento('');
          setTelefono('');
          return;
        }
        toast({
          title: 'Cuenta lista',
          description: 'Ya podés usar la app.',
        });
        navigate(result.role === 'admin' ? createPageUrl('Dashboard') : createPageUrl('PortalCliente'), { replace: true });
      } else {
        const result = await login(email.trim(), password);
        toast({
          title: 'Sesión iniciada',
          description: 'Bienvenido/a.',
        });
        navigate(result.role === 'admin' ? createPageUrl('Dashboard') : createPageUrl('PortalCliente'), { replace: true });
      }
    } catch (submitError) {
      const friendly = mapSupabaseAuthError(submitError);
      setError(friendly);
      toast({
        variant: 'destructive',
        title: mode === 'signup' ? 'No se pudo registrar' : 'No se pudo ingresar',
        description: friendly,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#111111',
      padding: 'max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#161616', border: '1px solid #1F1F1F', borderRadius: 16, padding: 24, boxSizing: 'border-box' }}>
        <h1 style={{ margin: 0, color: '#FFFFFF', fontSize: 24, fontWeight: 900 }}>Somos la Mickey</h1>
        <p style={{ marginTop: 6, color: '#888888', fontSize: 13 }}>
          {mode === 'signup' ? 'Crear cuenta de socio' : 'Ingresar a tu cuenta'}
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 18, display: 'grid', gap: 12 }}>
          {mode === 'signup' && (
            <>
              <input
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Nombre completo"
                style={inputStyle()}
                autoComplete="name"
              />
              <div>
                <label htmlFor="auth-telefono" style={{ display: 'block', color: '#888888', fontSize: 12, marginBottom: 6 }}>
                  Número de teléfono
                </label>
                <input
                  id="auth-telefono"
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  placeholder="Ej: 351-555-1234"
                  style={inputStyle()}
                  autoComplete="tel"
                  required
                />
              </div>
              <div>
                <label htmlFor="auth-fecha-nac" style={{ display: 'block', color: '#888888', fontSize: 12, marginBottom: 6 }}>
                  Fecha de nacimiento
                </label>
                <input
                  id="auth-fecha-nac"
                  type="date"
                  value={fechaNacimiento}
                  onChange={(event) => setFechaNacimiento(event.target.value)}
                  max={hoy}
                  required
                  style={inputStyle()}
                />
              </div>
            </>
          )}
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={inputStyle()} />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña"
            style={inputStyle()}
          />
          {error && <div style={{ color: '#E8001D', fontSize: 12 }}>{error}</div>}
          <button
            type="submit"
            disabled={
              saving ||
              !email ||
              !password ||
              (mode === 'signup' && (!nombre || !telefono || !fechaNacimiento))
            }
            style={{
              border: 'none',
              borderRadius: 999,
              background: '#E8001D',
              color: '#FFFFFF',
              fontWeight: 700,
              padding: '12px 14px',
              minHeight: 48,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {saving ? 'Procesando...' : mode === 'signup' ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((value) => (value === 'login' ? 'signup' : 'login'));
            setError('');
            setFechaNacimiento('');
            setTelefono('');
          }}
          style={{
            marginTop: 4,
            width: '100%',
            background: 'none',
            border: 'none',
            color: '#F9D100',
            padding: '12px 8px',
            minHeight: 48,
            cursor: 'pointer',
            fontSize: 13,
            textAlign: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {mode === 'signup' ? 'Ya tengo cuenta' : 'No tengo cuenta, quiero registrarme'}
        </button>
      </div>
    </div>
  );
}
