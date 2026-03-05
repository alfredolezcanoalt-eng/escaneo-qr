/* =========================================
   CONFIGURACIÓN Y VARIABLES GLOBALES
   ========================================= */
 

let colorGlobal = "", colorBG = "", colorTXT = "";
let estacionActual = 0, estacionesVisitadas = 0, html5QrCode;
let datosJuegoLocal = {}; 

window.onload = () => { verificarSesion(); };

/* =========================================
   CONEXIÓN CON EL SERVIDOR (API FETCH)
   ========================================= */
async function llamarAPI(datos) {
  try {
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos)
    });
    
    const jsonRespuesta = await response.json();
    
    // Si el servidor detecta que el equipo terminó o el juego cerró
    if (jsonRespuesta.juegoFinalizado) {
      bloquearJuegoFinalizado();
      return { exito: false, juegoFinalizado: true }; 
    }

    return jsonRespuesta;
  } catch (error) {
    console.error("Error en conexión:", error);
    return { exito: false, error: error.message };
  }
}

function bloquearJuegoFinalizado() {
  // Aseguramos que la pantalla de bloqueo sea visible y cubra todo
  const bloqueo = document.getElementById('pantalla-bloqueo-global');
  if (bloqueo) {
    bloqueo.style.display = 'flex';
    // Borramos datos locales para que no pueda saltarse el bloqueo recargando
    localStorage.removeItem('partidaTesoro');
  }
}

async function verificarCodigo() {
  const btn = document.querySelector('#vista-login button.btn-dark');
  const inputCodigo = document.getElementById('input-codigo').value;
  
  btn.disabled = true;
  btn.innerText = "VERIFICANDO...";

  // Pasamos el color para que el servidor pueda verificar si ese equipo ya terminó
  const res = await llamarAPI({ action: 'login', color: colorGlobal, codigo: inputCodigo });
  
  if(res && res.exito) {
    estacionActual = res.estacionObjetivo; 
    datosJuegoLocal = res.datosJuego; 
    document.getElementById('texto-pista').innerText = res.pistaInicial;
    actualizarBarraUI(); 
    guardar(res.pistaInicial); 
    irAVista('vista-juego'); 
    mostrarPantallaJuego('pista');
  } else { 
    // Si no fue por juegoFinalizado (bloqueado por llamarAPI), mostrar error de código
    if(!res.juegoFinalizado) {
      mostrarAlerta("CÓDIGO INCORRECTO O EQUIPO BLOQUEADO"); 
    }
  }
  
  btn.disabled = false;
  btn.innerText = "CONTINUAR";
}

/* =========================================
   UTILIDADES Y ESTADO DEL JUEGO
   ========================================= */
function limpiarTextoLocal(texto) {
  if (!texto) return "";
  return texto.toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function mostrarAlerta(msg) { 
  document.getElementById('alerta-mensaje').innerText = msg; 
  document.getElementById('mi-alerta').style.display = 'flex'; 
}

function cerrarAlerta() { 
  document.getElementById('mi-alerta').style.display = 'none'; 
}

function verificarSesion() {
  const guardado = localStorage.getItem('partidaTesoro');
  if (guardado) {
    const d = JSON.parse(guardado);
    colorGlobal = d.color; colorBG = d.bg; colorTXT = d.txt;
    estacionActual = d.estacion; estacionesVisitadas = d.visitadas;
    datosJuegoLocal = d.datosJuego || {}; 
    aplicarEstilos(); actualizarBarraUI();
    document.getElementById('texto-pista').innerText = d.pista;
    irAVista('vista-juego');
    if(estacionesVisitadas >= 8) { 
      mostrarPantallaJuego('tesoro'); 
      document.getElementById('pista-tesoro-final').innerText = d.pista; 
    } else { 
      mostrarPantallaJuego('pista'); 
    }
  } else { 
    cargarEquipos(); 
  }
}

function guardar(p) { 
  localStorage.setItem('partidaTesoro', JSON.stringify({ 
    color: colorGlobal, bg: colorBG, txt: colorTXT, 
    estacion: estacionActual, visitadas: estacionesVisitadas, 
    pista: p, datosJuego: datosJuegoLocal 
  })); 
}

function resetSesion() { 
  localStorage.removeItem('partidaTesoro'); 
  location.reload(); 
}

function confirmarReinicio() { 
  if(confirm("⚠️ ¿ESTÁS SEGURO DE QUE DESEAS SALIR?\n\nSi reinicias, tendrás que volver a ingresar el código de acceso de tu equipo.")) {
    resetSesion(); 
  }
}

/* =========================================
   VISTAS Y FLUJO DE USUARIO
   ========================================= */
async function cargarEquipos() {
  const cont = document.getElementById('contenedor-botones');
  cont.innerHTML = "<p class='text-white text-center w-100 mt-5 fw-bold'>Cargando equipos...</p>";
  
  const equipos = await llamarAPI({ action: 'getTeams' });
  
  if(equipos && Array.isArray(equipos)) {
    const confs = {
      "ROJO":{bg:"#FF0000",txt:"#FFF"},"LILA":{bg:"#C8A2C8",txt:"#000"},"BLANCO":{bg:"#FFF",txt:"#000"},
      "AMARILLO":{bg:"#FFD700",txt:"#000"},"NARANJA":{bg:"#FF8C00",txt:"#FFF"},"CELESTE":{bg:"#00BFFF",txt:"#000"},
      "VERDE":{bg:"#008000",txt:"#FFF"},"MARRON":{bg:"#8B4513",txt:"#FFF"}
    };
    cont.innerHTML = "";
    equipos.forEach(c => {
      const f = confs[c] || {bg:c,txt:"#FFF"};
      const btn = document.createElement('button');
      btn.className = 'btn btn-equipo-gigante';
      btn.style.backgroundColor = f.bg; 
      btn.style.color = f.txt;
      btn.innerText = c;
      btn.onclick = () => loginEquipo(c, f.bg, f.txt);
      cont.appendChild(btn);
    });
  } else {
    cont.innerHTML = "<p class='text-danger text-center w-100 mt-5 fw-bold'>Error al cargar. Recarga la página.</p>";
  }
}

function loginEquipo(c, bg, txt) { 
  colorGlobal = c; colorBG = bg; colorTXT = txt; 
  aplicarEstilos(); 
  document.getElementById('cabecera-login').innerText = "EQUIPO " + c; 
  document.getElementById('cabecera-login').style.backgroundColor = bg; 
  document.getElementById('cabecera-login').style.color = txt; 
  irAVista('vista-login'); 
}

function aplicarEstilos() { 
  const bgElement = document.getElementById('cuerpo-web');
  bgElement.style.background = `radial-gradient(circle at top, color-mix(in srgb, ${colorBG} 85%, transparent) 0%, #1a1a1a 100%)`;
  bgElement.style.minHeight = "100vh";
}

function actualizarBarraUI() {
  const pct = Math.round((estacionesVisitadas / 8) * 100);
  const barra = document.getElementById('barra-completado');
  barra.style.width = pct + "%"; 
  barra.innerText = pct + "%";
  document.getElementById('num-pasos').innerText = estacionesVisitadas;
  barra.style.backgroundColor = colorBG;
  barra.style.color = colorTXT;
  barra.className = "progress-bar progress-bar-striped progress-bar-animated fw-bold";
}

async function verificarCodigo() {
  const btn = document.querySelector('#vista-login button.btn-dark');
  const inputCodigo = document.getElementById('input-codigo').value;
  
  btn.disabled = true;
  btn.innerText = "VERIFICANDO...";

  const res = await llamarAPI({ action: 'login', color: colorGlobal, codigo: inputCodigo });
  
  if(res && res.exito) {
    estacionActual = res.estacionObjetivo; 
    datosJuegoLocal = res.datosJuego; 
    document.getElementById('texto-pista').innerText = res.pistaInicial;
    actualizarBarraUI(); 
    guardar(res.pistaInicial); 
    irAVista('vista-juego'); 
    mostrarPantallaJuego('pista');
    
    // Solicitar permisos de GPS anticipadamente de forma silenciosa
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(()=>{}, ()=>{}, {enableHighAccuracy: true});
  } else { 
    if(!res.juegoFinalizado) mostrarAlerta("CÓDIGO INCORRECTO"); 
  }
  
  btn.disabled = false;
  btn.innerText = "CONTINUAR";
}

/* =========================================
   MÓDULO DE CÁMARA Y GPS
   ========================================= */
function abrirEscaner() {
  const icon = document.querySelector('.icon-cam');
  icon.innerText = "⏳"; // Muestra reloj de arena mientras capta GPS
  const opcionesGps = { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        icon.innerText = "📷";
        iniciarCamara(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.warn("GPS falló:", error);
        icon.innerText = "📷";
        iniciarCamara(null, null);
      }, 
      opcionesGps
    );
  } else {
    icon.innerText = "📷";
    iniciarCamara(null, null);
  }
}

function iniciarCamara(lat, lon) {
  irAVista('vista-qr');
  html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (txt) => {
    
    // ⚡ LÓGICA ASÍNCRONA/OPTIMISTA: Verificamos localmente y avanzamos sin esperar
    if(txt.trim() === estacionActual.toString().trim()) { 
      cerrarEscaner(); 
      let pasoActual = estacionesVisitadas + 1;

      // Disparamos la escritura al servidor de fondo (Fire and Forget)
      if (lat !== null) {
        llamarAPI({ action: 'scan', color: colorGlobal, estacion: estacionActual, lat: lat, lon: lon, paso: pasoActual });
      } else {
        llamarAPI({ action: 'scan', color: colorGlobal, paso: pasoActual });
      }
      
      // Avanzamos en la interfaz instantáneamente
      document.getElementById('error-respuesta').style.display = 'none';
      document.getElementById('texto-acertijo').innerText = datosJuegoLocal[estacionActual].acertijo;
      mostrarPantallaJuego('acertijo');
    } else { 
      mostrarAlerta("QR INCORRECTO.\nVerifica que sea el QR correcto"); 
      cerrarEscaner(); 
    }
  }).catch(() => { 
    mostrarAlerta("ERROR DE CÁMARA. Asegúrate de dar permisos en el navegador."); 
    cerrarEscaner();
  });
}

function cerrarEscaner() { 
  if(html5QrCode) {
    html5QrCode.stop().then(() => irAVista('vista-juego')).catch(() => irAVista('vista-juego')); 
  } else {
    irAVista('vista-juego');
  }
}

/* =========================================
   RESOLUCIÓN DE ACERTIJOS Y FINAL
   ========================================= */
function enviarRespuesta() {
  const input = document.getElementById('input-respuesta');
  const respuestaUsuario = limpiarTextoLocal(input.value);
  const respuestaCorrecta = datosJuegoLocal[estacionActual].respuesta;

  document.getElementById('error-respuesta').style.display = 'none';

  // ⚡ LÓGICA ASÍNCRONA/OPTIMISTA: Comprobación local inmediata
  if (respuestaUsuario === respuestaCorrecta) {
    document.getElementById('btn-enviar-respuesta').style.display = 'none';
    let pasoActual = estacionesVisitadas + 1;
    
    // Sincronizamos con el servidor en segundo plano
    llamarAPI({ action: 'answer', color: colorGlobal, estacion: estacionActual, respuesta: input.value, paso: pasoActual });
    
    // UI reacciona instantáneamente
    estacionesVisitadas++; 
    actualizarBarraUI();
    document.getElementById('btn-enviar-respuesta').style.display = 'block'; 
    
    if(estacionesVisitadas >= 8) {
      mostrarPantallaJuego('tesoro'); 
      const pistaFinal = datosJuegoLocal[estacionActual].pistaSiguiente;
      document.getElementById('pista-tesoro-final').innerText = pistaFinal;
      document.getElementById('cuerpo-web').style.background = "radial-gradient(circle at center, #2d1b0d 0%, #000 100%)"; 
      guardar(pistaFinal);
    } else {
      const pistaSig = datosJuegoLocal[estacionActual].pistaSiguiente;
      const proximoQR = datosJuegoLocal[estacionActual].proximoQR;
      
      estacionActual = proximoQR; 
      document.getElementById('texto-pista').innerText = pistaSig;
      input.value = ""; 
      mostrarPantallaJuego('pista'); 
      guardar(pistaSig);
    }
  } else { 
    document.getElementById('error-respuesta').style.display = 'block'; 
  }
}

function procesarFoto() {
  const file = document.getElementById('foto-tesoro').files[0];
  if(!file) return;
  const reader = new FileReader();
  document.getElementById('status-foto').innerText = "SUBIENDO EVIDENCIA... (Esto puede tomar unos segundos)";
  
  reader.onload = async (e) => {
    const base64Str = e.target.result;
    const res = await llamarAPI({ action: 'uploadPhoto', base64: base64Str, color: colorGlobal });
    
    if(res && res.exito) { 
      mostrarAlerta("¡FOTO GUARDADA CON ÉXITO!\nDiríjanse a la base."); 
      setTimeout(resetSesion, 5000); 
    } else if (!res.juegoFinalizado) {
      mostrarAlerta("Error al guardar la foto. Intenta de nuevo.");
      document.getElementById('status-foto').innerText = "";
    }
  };
  reader.readAsDataURL(file);
}

/* =========================================
   NAVEGACIÓN INTERNA
   ========================================= */
function irAVista(id) { 
  ['vista-equipos', 'vista-login', 'vista-juego', 'vista-qr'].forEach(v => { 
    document.getElementById(v).style.display = (v == id) ? 'block' : 'none'; 
  }); 
  actualizarBotonQR(); 
}

function mostrarPantallaJuego(pantalla) {
  ['pantalla-pista', 'pantalla-acertijo', 'pantalla-tesoro'].forEach(p => { 
    document.getElementById(p).style.display = (p === 'pantalla-'+pantalla) ? 'block' : 'none'; 
  });
  if(pantalla==='pista') document.getElementById('pantalla-pista').style.display = 'flex';
  actualizarBotonQR();
}

function actualizarBotonQR() {
  const enPista = document.getElementById('pantalla-pista').style.display !== 'none';
  document.getElementById('contenedor-escanear-fijo').style.display = 
    (estacionesVisitadas < 8 && enPista && document.getElementById('vista-juego').style.display !== 'none') ? 'block' : 'none';
}
