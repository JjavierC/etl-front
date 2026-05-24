import React, { useState, useEffect, useRef } from 'react';

export default function Dashboard({ usuario, onLogout, usuariosDB, setUsuariosDB }) {
  // === ESTADOS GENERALES ===
  const [vista, setVista] = useState('metricas'); // 'metricas' | 'sedes'
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  // === ESTADOS DE CARGA (Sedes) ===
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [mensajeUpload, setMensajeUpload] = useState({ tipo: '', texto: '' });
  const [notificando, setNotificando] = useState(false);
  const [carpetasExpandidas, setCarpetasExpandidas] = useState({});
  const inputArchivoRef = useRef(null);

  // === ESTADOS CRUD (Gestión de Sedes) ===
  const [formSede, setFormSede] = useState({ usuario: '', clave: '', sedeAsignada: '' });
  const [modoEdicion, setModoEdicion] = useState(false);
  const [usuarioOriginalId, setUsuarioOriginalId] = useState(null);

  const fechaHoy = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    if (vista !== 'metricas') return; 

    fetch('https://etl-ventas-api.onrender.com/api/ventas')
      .then(res => {
        if (!res.ok) throw new Error('Error al conectar con la API');
        return res.json();
      })
      .then(data => {
        const datosFiltrados = usuario.rol === 'admin' 
          ? data.datos 
          : data.datos.filter(v => v.sede === usuario.sedeAsignada);
        
        setVentas(datosFiltrados);
        
        if (datosFiltrados.length > 0) {
          const fechasUnicas = [...new Set(datosFiltrados.map(v => v.fecha))].sort((a, b) => new Date(b) - new Date(a));
          setCarpetasExpandidas({ [fechasUnicas[0]]: true });
        }
        
        setCargando(false);
      })
      .catch(err => {
        setError(err.message);
        setCargando(false);
      });
  }, [usuario, vista]);

  // === LÓGICA DE EXPORTACIÓN CSV ===
  const descargarConsolidadoCSV = () => {
    if (ventas.length === 0) {
      alert("No hay datos en el historial para exportar.");
      return;
    }

    // 1. Definir cabeceras
    const cabeceras = ['Fecha', 'Sede Origen', 'Producto', 'Cantidad', 'Precio Unitario', 'Total Venta'];
    
    // 2. Mapear los datos a filas de texto CSV
    const filasCSV = ventas.map(v => {
      const sede = v.sede ? v.sede : 'sin_sede';
      const totalVenta = (v.cantidad * v.precio).toFixed(2);
      return `${v.fecha},${sede},${v.producto},${v.cantidad},${v.precio},${totalVenta}`;
    });

    // 3. Unir todo con saltos de línea
    const contenidoCSV = [cabeceras.join(','), ...filasCSV].join('\n');

    // 4. Crear el archivo virtual y forzar descarga
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Consolidado_Global_${fechaHoy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // === LÓGICA DE GESTIÓN DE SEDES (CRUD) ===
  const manejarSubmitSede = (e) => {
    e.preventDefault();
    if (!formSede.usuario || !formSede.clave || !formSede.sedeAsignada) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    if (modoEdicion) {
      setUsuariosDB(prev => prev.map(u => u.usuario === usuarioOriginalId ? { ...formSede, rol: 'sede' } : u));
    } else {
      if (usuariosDB.some(u => u.usuario === formSede.usuario)) {
        alert("Ya existe un usuario con ese nombre.");
        return;
      }
      setUsuariosDB(prev => [...prev, { ...formSede, rol: 'sede' }]);
    }
    
    setFormSede({ usuario: '', clave: '', sedeAsignada: '' });
    setModoEdicion(false);
    setUsuarioOriginalId(null);
  };

  const editarSede = (u) => {
    setFormSede(u);
    setModoEdicion(true);
    setUsuarioOriginalId(u.usuario);
  };

  const eliminarSede = (usuarioEliminar) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el acceso a ${usuarioEliminar}?`)) {
      setUsuariosDB(prev => prev.filter(u => u.usuario !== usuarioEliminar));
    }
  };

  // === LÓGICA DE CARGA DE ARCHIVOS ===
  const yaSubioHoy = ventas.some(v => v.fecha === fechaHoy && v.sede === usuario.sedeAsignada);

  const manejarSeleccionArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setMensajeUpload({ tipo: 'error', texto: 'Solo se permiten archivos .csv' }); return; }

    const reader = new FileReader();
    reader.onload = (evento) => {
      const texto = evento.target.result;
      const lineas = texto.split('\n').map(l => l.trim()).filter(l => l);
      
      if (lineas.length < 2) { setMensajeUpload({ tipo: 'error', texto: 'El archivo está vacío o sin transacciones.' }); return; }
      const headers = lineas[0].toLowerCase().split(',');
      const columnasRequeridas = ['fecha', 'producto', 'cantidad', 'precio'];
      if (!columnasRequeridas.every(col => headers.includes(col))) { setArchivoSeleccionado(null); setMensajeUpload({ tipo: 'error', texto: `Estructura inválida. Columnas requeridas: ${columnasRequeridas.join(', ')}` }); return; }
      
      const fechaArchivo = lineas[1].split(',')[headers.indexOf('fecha')];
      if (fechaArchivo !== fechaHoy) { setArchivoSeleccionado(null); setMensajeUpload({ tipo: 'error', texto: `El archivo contiene registros del ${fechaArchivo}. Solo se admite hoy (${fechaHoy}).` }); return; }

      setArchivoSeleccionado(file);
      setMensajeUpload({ tipo: 'exito', texto: `El archivo "${file.name}" está validado.` });
    };
    reader.readAsText(file);
  };

  const enviarArchivo = async () => {
    if (!archivoSeleccionado) return;
    setMensajeUpload({ tipo: 'info', texto: 'Transfiriendo archivo al servidor...' });
    const formData = new FormData();
    formData.append('file', archivoSeleccionado);
    formData.append('sede', usuario.sedeAsignada); 

    try {
      const response = await fetch('https://etl-ventas-api.onrender.com/api/subir-csv', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        setMensajeUpload({ tipo: 'exito', texto: data.mensaje || '¡Reporte recibido en la cola principal!' });
        setArchivoSeleccionado(null);
        if (inputArchivoRef.current) inputArchivoRef.current.value = '';
      } else {
        const errData = await response.json();
        setMensajeUpload({ tipo: 'error', texto: errData.detail || 'Fallo al subir el archivo' });
      }
    } catch (err) { setMensajeUpload({ tipo: 'error', texto: 'Error de red.' }); }
  };

  const solicitarDesbloqueo = async () => {
    setNotificando(true);
    try {
      await fetch('http://localhost:8000/api/notificar-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sede: usuario.usuario, motivo: "Solicita limpieza de registros de hoy." })
      });
      alert("Notificación urgente enviada al administrador.");
    } catch (error) { alert("Error de conexión."); }
    setNotificando(false);
  };

  const totalFacturado = ventas.reduce((acc, curr) => acc + (curr.cantidad * curr.precio), 0);

  const ventasAgrupadas = ventas.reduce((acc, venta) => {
    const fecha = venta.fecha;
    const sede = venta.sede ? venta.sede.toLowerCase() : 'sin_sede';
    if (!acc[fecha]) acc[fecha] = {};
    if (!acc[fecha][sede]) acc[fecha][sede] = [];
    acc[fecha][sede].push(venta);
    return acc;
  }, {});

  const fechasOrdenadas = Object.keys(ventasAgrupadas).sort((a, b) => new Date(b) - new Date(a));
  const toggleCarpeta = (claveUnica) => setCarpetasExpandidas(prev => ({ ...prev, [claveUnica]: !prev[claveUnica] }));

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--primary-color)' }}>Panel de Control ETL</h1>
          <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)' }}>
            Sesión activa: <strong>{usuario.usuario}</strong> | Perfil: {usuario.rol.toUpperCase()}
          </p>
        </div>
        <button onClick={onLogout} className="btn btn-danger">Cerrar Sesión</button>
      </header>

      {usuario.rol === 'admin' && (
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <button 
            onClick={() => setVista('metricas')} 
            style={{ padding: '0.5rem 1rem', border: 'none', backgroundColor: vista === 'metricas' ? 'var(--secondary-color)' : 'transparent', color: vista === 'metricas' ? 'white' : 'var(--text-muted)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
          >
            📊 Tablero de Métricas
          </button>
          <button 
            onClick={() => setVista('sedes')} 
            style={{ padding: '0.5rem 1rem', border: 'none', backgroundColor: vista === 'sedes' ? 'var(--secondary-color)' : 'transparent', color: vista === 'sedes' ? 'white' : 'var(--text-muted)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
          >
            ⚙️ Gestión de Sedes
          </button>
        </div>
      )}

      {vista === 'metricas' && (
        <>
          {usuario.rol === 'sede' && (
            <div className="card fade-in" style={{ marginBottom: '2rem', border: '2px dashed var(--border-color)', backgroundColor: '#f8fafc' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Subida de Reporte Diario ({fechaHoy})</h3>
                {yaSubioHoy ? (
                  <span style={{ padding: '6px 12px', backgroundColor: 'var(--success-color)', color: 'white', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>✅ PROCESADO HOY</span>
                ) : (
                  <span style={{ padding: '6px 12px', backgroundColor: '#fbbf24', color: '#78350f', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>⚠️ PENDIENTE</span>
                )}
              </div>
              {yaSubioHoy ? (
                <div style={{ padding: '1.5rem', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                  <p style={{ margin: '0 0 1rem 0', color: '#1e40af', fontWeight: '500' }}>El sistema está bloqueado para prevenir duplicidad de datos.</p>
                  <button className="btn btn-danger" onClick={solicitarDesbloqueo} disabled={notificando}>
                    {notificando ? 'Notificando...' : '⚠️ Solicitar corrección de datos al Administrador'}
                  </button>
                </div>
              ) : (
                <>
                  <input type="file" accept=".csv" onChange={manejarSeleccionArchivo} ref={inputArchivoRef} style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'white' }} />
                  {mensajeUpload.texto && (
                    <div style={{ padding: '1rem', marginBottom: '1rem', borderRadius: '6px', backgroundColor: mensajeUpload.tipo === 'error' ? '#fef2f2' : (mensajeUpload.tipo === 'exito' ? '#ecfdf5' : '#eff6ff'), color: mensajeUpload.tipo === 'error' ? 'var(--danger-color)' : (mensajeUpload.tipo === 'exito' ? 'var(--success-color)' : 'var(--secondary-color)'), border: `1px solid ${mensajeUpload.tipo === 'error' ? '#fca5a5' : (mensajeUpload.tipo === 'exito' ? '#6ee7b7' : '#bfdbfe')}` }}>
                      {mensajeUpload.texto}
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={enviarArchivo} disabled={!archivoSeleccionado} style={{ opacity: !archivoSeleccionado ? 0.5 : 1, cursor: !archivoSeleccionado ? 'not-allowed' : 'pointer', width: '100%' }}>
                    Subir a Cola de Procesamiento Central
                  </button>
                </>
              )}
            </div>
          )}

          {error ? (
            <div className="card" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}>{error}</div>
          ) : cargando ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Conectando con la base de datos...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ borderLeft: '4px solid var(--secondary-color)' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Facturado {usuario.rol === 'admin' ? '(Global)' : '(Sede)'}</h3>
                  <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>${totalFacturado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="card" style={{ borderLeft: '4px solid var(--success-color)' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Volumen de Transacciones</h3>
                  <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{ventas.length}</p>
                </div>
              </div>

              {/* TÍTULO Y BOTÓN DE EXPORTACIÓN */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ color: 'var(--primary-color)', margin: 0, fontWeight: '600' }}>Historial Estructurado</h3>
                {usuario.rol === 'admin' && ventas.length > 0 && (
                  <button 
                    onClick={descargarConsolidadoCSV} 
                    className="btn btn-primary" 
                    style={{ backgroundColor: '#10b981', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                  >
                    ⬇️ Exportar Consolidado (.csv)
                  </button>
                )}
              </div>

              {fechasOrdenadas.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron transacciones.</div>
              ) : (
                fechasOrdenadas.map(fecha => {
                  const sedesEnFecha = ventasAgrupadas[fecha];
                  const sedesOrdenadas = Object.keys(sedesEnFecha).sort();
                  const totalVentasDia = Object.values(sedesEnFecha).flat();
                  const totalDineroDia = totalVentasDia.reduce((acc, curr) => acc + (curr.cantidad * curr.precio), 0);
                  const estaExpandidaFecha = carpetasExpandidas[fecha];

                  return (
                    <div key={fecha} className="card fade-in" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem', borderRadius: '8px' }}>
                      <div onClick={() => toggleCarpeta(fecha)} style={{ padding: '1rem 1.5rem', backgroundColor: estaExpandidaFecha ? '#f1f5f9' : '#ffffff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: estaExpandidaFecha ? '1px solid var(--border-color)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>{estaExpandidaFecha ? '📂' : '📁'}</span>
                          <div>
                            <h4 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1rem' }}>Fecha: {fecha}</h4>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sedesOrdenadas.length} sedes reportaron • {totalVentasDia.length} transacciones</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                          <span style={{ fontWeight: '600', color: 'var(--primary-color)' }}>${totalDineroDia.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transform: estaExpandidaFecha ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>▼</span>
                        </div>
                      </div>

                      {estaExpandidaFecha && (
                        <div style={{ padding: '1rem', backgroundColor: '#fafafa' }}>
                          {sedesOrdenadas.map(sede => {
                            const ventasDeSede = sedesEnFecha[sede];
                            const totalDineroSede = ventasDeSede.reduce((acc, curr) => acc + (curr.cantidad * curr.precio), 0);
                            const claveSede = `${fecha}-${sede}`; 
                            const estaExpandidaSede = carpetasExpandidas[claveSede];

                            return (
                              <div key={claveSede} style={{ marginBottom: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                                <div onClick={() => toggleCarpeta(claveSede)} style={{ padding: '0.75rem 1rem', backgroundColor: estaExpandidaSede ? '#f8fafc' : '#ffffff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: estaExpandidaSede ? '1px solid var(--border-color)' : 'none' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1rem', opacity: 0.7 }}>{estaExpandidaSede ? '📂' : '📁'}</span>
                                    <h5 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600' }}>{sede === 'sin_sede' ? 'Sede Desconocida' : sede.toUpperCase()}</h5>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '12px' }}>{ventasDeSede.length} regs</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontWeight: '500', color: 'var(--secondary-color)', fontSize: '0.9rem' }}>${totalDineroSede.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', transform: estaExpandidaSede ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                                  </div>
                                </div>
                                {estaExpandidaSede && (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                                      <tr>
                                        <th style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>PRODUCTO</th>
                                        <th style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>CANTIDAD</th>
                                        <th style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>PRECIO UNIT.</th>
                                        <th style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>TOTAL</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ventasDeSede.map((venta, index) => (
                                        <tr key={index} style={{ borderBottom: index === ventasDeSede.length - 1 ? 'none' : '1px solid #eee' }}>
                                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{venta.producto}</td>
                                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{venta.cantidad}</td>
                                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>${venta.precio.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary-color)' }}>${(venta.cantidad * venta.precio).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </>
      )}

      {vista === 'sedes' && usuario.rol === 'admin' && (
        <div className="fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Accesos Autorizados</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Usuario (Login)</th>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Identificador Sede BD</th>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosDB.filter(u => u.rol === 'sede').length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay sedes registradas.</td>
                    </tr>
                  ) : (
                    usuariosDB.filter(u => u.rol === 'sede').map((u, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{u.usuario}</td>
                        <td style={{ padding: '1rem', color: 'var(--secondary-color)', fontWeight: '600' }}>{u.sedeAsignada}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button onClick={() => editarSede(u)} className="btn" style={{ backgroundColor: '#e2e8f0', color: 'var(--text-main)', padding: '0.4rem 0.8rem', marginRight: '0.5rem', fontSize: '0.8rem' }}>Editar</button>
                          <button onClick={() => eliminarSede(u.usuario)} className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Borrar</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ position: 'sticky', top: '2rem' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--primary-color)' }}>
                {modoEdicion ? 'Actualizar Accesos' : 'Crear Nueva Sede'}
              </h3>
              <form onSubmit={manejarSubmitSede}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>Nombre de Usuario (Login)</label>
                  <input type="text" value={formSede.usuario} onChange={e => setFormSede({...formSede, usuario: e.target.value})} style={{ width: '100%', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} placeholder="Ej: sucursal_norte" required />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>Contraseña</label>
                  <input type="text" value={formSede.clave} onChange={e => setFormSede({...formSede, clave: e.target.value})} style={{ width: '100%', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} required />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>Identificador en Base de Datos</label>
                  <input type="text" value={formSede.sedeAsignada} onChange={e => setFormSede({...formSede, sedeAsignada: e.target.value})} style={{ width: '100%', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} placeholder="Ej: norte" required />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '5px 0 0 0' }}>Con este nombre se agruparán sus ventas en los reportes.</p>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '0.5rem' }}>
                  {modoEdicion ? 'Guardar Cambios' : 'Registrar Sede'}
                </button>
                {modoEdicion && (
                  <button type="button" onClick={() => { setModoEdicion(false); setFormSede({usuario: '', clave: '', sedeAsignada: ''}); setUsuarioOriginalId(null); }} className="btn" style={{ width: '100%', backgroundColor: '#f1f5f9', color: 'var(--text-main)' }}>
                    Cancelar Edición
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}