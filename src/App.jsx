import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const USUARIOS_POR_DEFECTO = [
  { usuario: 'admin', clave: '123', rol: 'admin', sedeAsignada: null },
  { usuario: 'sede1', clave: '123', rol: 'sede', sedeAsignada: 'sede1' },
  { usuario: 'sede2', clave: '123', rol: 'sede', sedeAsignada: 'sede2' }
];

export default function App() {
  // 1. Base de datos de usuarios dinámica
  const [usuariosDB, setUsuariosDB] = useState(() => {
    const dbGuardada = localStorage.getItem('usuarios_db');
    return dbGuardada ? JSON.parse(dbGuardada) : USUARIOS_POR_DEFECTO;
  });

  // Guardar cambios automáticamente si el admin agrega/borra sedes
  useEffect(() => {
    localStorage.setItem('usuarios_db', JSON.stringify(usuariosDB));
  }, [usuariosDB]);

  // 2. Control de sesión actual
  const [usuarioLogueado, setUsuarioLogueado] = useState(() => {
    const sesionGuardada = localStorage.getItem('usuario_sesion');
    return sesionGuardada ? JSON.parse(sesionGuardada) : null;
  });

  const manejarLogin = (inputUsuario, inputClave) => {
    const encontrado = usuariosDB.find(
      u => u.usuario === inputUsuario && u.clave === inputClave
    );
    if (encontrado) {
      setUsuarioLogueado(encontrado);
      localStorage.setItem('usuario_sesion', JSON.stringify(encontrado));
      return true;
    }
    return false;
  };

  const manejarLogout = () => {
    setUsuarioLogueado(null);
    localStorage.removeItem('usuario_sesion');
  };

  return (
    <>
      {!usuarioLogueado ? (
        <Login onLogin={manejarLogin} />
      ) : (
        <Dashboard 
          usuario={usuarioLogueado} 
          onLogout={manejarLogout} 
          usuariosDB={usuariosDB}           // Pasamos la BD al dashboard
          setUsuariosDB={setUsuariosDB}     // Pasamos la función para modificarla
        />
      )}
    </>
  );
}