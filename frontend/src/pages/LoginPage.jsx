import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const cleanUsername = username.trim();
        if (!cleanUsername) throw new Error('Scegli uno username');

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: cleanUsername } },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setInfo('Registrazione avvenuta! Controlla la tua email per confermare l\'account, poi accedi.');
          setMode('login');
        }
      }
    } catch (err) {
      setError(err.message || 'Si e\' verificato un errore');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Yu-Gi-Oh Deck Builder</h1>
        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            Accedi
          </button>
          <button
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
            type="button"
          >
            Registrati
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="es. kaiba_seto"
                required
                minLength={3}
                maxLength={24}
              />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Crea account'}
          </button>
        </form>
      </div>
    </div>
  );
}
