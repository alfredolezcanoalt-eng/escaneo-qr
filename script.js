/* =========================================
   CONFIGURACIÓN Y VARIABLES GLOBALES
   ========================================= */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwnBwd-BrpYzVc_u6PZnLNPHVzuvLiBzSP-xL0ZXnKEYDijw78fNG-F2vslKp21lJ4D/exec"; 

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
    return await response.json();
  } catch (error) {
    console.error("Error en conexión:", error);
    return { exito: false, error: error.message };
  }
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
  if(confirm("⚠️ ¿ESTÁS SEGURO DE QUE DESEAS SALIR?")) {
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
    cont.innerHTML = "<p class='text-danger text-center w-100 mt-5 fw-bold'>Error al cargar.</p>";
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
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(()=>{}, ()=>{}, {enableHighAccuracy: true});
  } else { 
    mostrarAlerta("CÓDIGO INCORRECTO"); 
  }
  btn.disabled = false;
  btn.innerText = "CONTINUAR";
}

/* =========================================
   MÓDULO DE CÁMARA Y GPS (OPTIMIZADO)
   ========================================= */
function abrirEscaner() {
  const icon = document.querySelector('.icon-cam');
  icon.innerText = "⏳";
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        icon.innerText = "📷";
        iniciarCamara(position.coords.latitude, position.coords.longitude);
      },
      () => {
        icon.innerText = "📷";
        iniciarCamara(null, null);
      }, 
      { enableHighAccuracy: true, timeout: 5000 }
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
    
    // VALIDACIÓN INSTANTÁNEA LOCAL
    if(txt.trim() === estacionActual.toString().trim()) { 
      cerrarEscaner(); 
      
      // Mostrar acertijo inmediatamente
      document.getElementById('error-respuesta').style.display = 'none';
      document.getElementById('texto-acertijo').innerText = datosJuegoLocal[estacionActual].acertijo;
      mostrarPantallaJuego('acertijo');

      // Registro en segundo plano (Background)
      llamarAPI({ 
        action: 'scan', 
        color: colorGlobal, 
        estacion: estacionActual, 
        lat: lat, 
        lon: lon, 
        paso: estacionesVisitadas + 1 
      });

    } else { 
      mostrarAlerta("QR INCORRECTO"); 
      cerrarEscaner(); 
    }
  }).catch(() => { 
    mostrarAlerta("ERROR DE CÁMARA"); 
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
   RESOLUCIÓN DE ACERTIJOS (OPTIMIZADO)
   ========================================= */
function enviarRespuesta() {
  const input = document.getElementById('input-respuesta');
  const respuestaUsuario = limpiarTextoLocal(input.value);
  const infoEstacion = datosJuegoLocal[estacionActual];

  // VALIDACIÓN INSTANTÁNEA LOCAL
  if (respuestaUsuario === infoEstacion.respuesta) {
    const pistaSig = infoEstacion.pistaSiguiente;
    const proximoQR = infoEstacion.proximoQR;
    const pasoRealizado = estacionesVisitadas + 1;

    // Acción inmediata UI
    estacionesVisitadas++; 
    actualizarBarraUI();
    
    if(estacionesVisitadas >= 8) {
      mostrarPantallaJuego('tesoro'); 
      document.getElementById('pista-tesoro-final').innerText = pistaSig;
      document.getElementById('cuerpo-web').style.background = "radial-gradient(circle at center, #2d1b0d 0%, #000 100%)"; 
      guardar(pistaSig);
    } else {
      estacionActual = proximoQR; 
      document.getElementById('texto-pista').innerText = pistaSig;
      input.value = ""; 
      mostrarPantallaJuego('pista'); 
      guardar(pistaSig);
    }

    // Registro en segundo plano
    llamarAPI({ 
      action: 'answer', 
      color: colorGlobal, 
      estacion: infoEstacion.id_original || estacionActual, 
      respuesta: input.value, 
      paso: pasoRealizado 
    });

  } else { 
    document.getElementById('error-respuesta').style.display = 'block'; 
  }
}

function procesarFoto() {
  const file = document.getElementById('foto-tesoro').files[0];
  if(!file) return;
  const reader = new FileReader();
  document.getElementById('status-foto').innerText = "SUBIENDO EVIDENCIA...";
  
  reader.onload = async (e) => {
    const base64Str = e.target.result;
    const res = await llamarAPI({ action: 'uploadPhoto', base64: base64Str, color: colorGlobal });
    if(res && res.exito) { 
      mostrarAlerta("¡FOTO GUARDADA!\nDiríjanse a la base."); 
      setTimeout(resetSesion, 3000); 
    } else {
      mostrarAlerta("Error al guardar la foto.");
      document.getElementById('status-foto').innerText = "";
    }
  };
  reader.readAsDataURL(file);
}

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
