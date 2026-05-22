import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');

  const manejarEnvio = (e) => {
    e.preventDefault();
    const exito = onLogin(usuario, clave);
    if (!exito) setError('Credenciales inválidas');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      <form onSubmit={manejarEnvio} className="card fade-in" style={{ width: '100%', maxWidth: '350px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--primary-color)', marginBottom: '1.5rem' }}>Portal de Métricas</h2>
        
        {error && <div style={{ color: 'var(--danger-color)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Usuario</label>
          <input 
            type="text" 
            value={usuario} 
            onChange={(e) => setUsuario(e.target.value)} 
            style={{ width: '93%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            required 
          />
        </div>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Contraseña</label>
          <input 
            type="password" 
            value={clave} 
            onChange={(e) => setClave(e.target.value)} 
            style={{ width: '93%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            required 
          />
        </div>
        
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Iniciar Sesión</button>
      </form>
    </div>
  );
}