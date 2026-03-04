const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwnBwd-BrpYzVc_u6PZnLNPHVzuvLiBzSP-xL0ZXnKEYDijw78fNG-F2vslKp21lJ4D/exec"; 

let colorGlobal = "", colorBG = "", colorTXT = "";
let estacionActual = 0, estacionesVisitadas = 0, html5QrCode;
let datosJuegoLocal = {}; 

window.onload = () => { verificarSesion(); };

// LLAMADA API: Ahora intercepta el estado bloqueado global
async function llamarAPI(datos) {
  try {
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos)
    });
    const res = await response.json();
    
    // Si el servidor detecta que el juego ya terminó
    if (res && res.bloqueado) {
      mostrarAlerta("🛑 JUEGO FINALIZADO\nUn equipo ya encontró el tesoro. ¡Gracias por participar!");
      setTimeout(resetSesion, 6000);
      return { exito: false, bloqueado: true };
    }
    
    return res;
  } catch (error) {
    console.error("Error:", error);
    mostrarAlerta("Error de conexión. Revisa tu internet.");
    return { exito: false };
  }
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
  if(confirm("⚠️ ¿Deseas salir?")) resetSesion(); 
}

async function cargarEquipos() {
  const cont = document.getElementById('contenedor-botones');
  const equipos = await llamarAPI({ action: 'getTeams' });
  if(equipos && Array.isArray(equipos)) {
    const confs = {"ROJO":{bg:"#FF0000",txt:"#FFF"},"LILA":{bg:"#C8A2C8",txt:"#000"},"BLANCO":{bg:"#FFF",txt:"#000"},"AMARILLO":{bg:"#FFD700",txt:"#000"},"NARANJA":{bg:"#FF8C00",txt:"#FFF"},"CELESTE":{bg:"#00BFFF",txt:"#000"},"VERDE":{bg:"#008000",txt:"#FFF"},"MARRON":{bg:"#8B4513",txt:"#FFF"}};
    cont.innerHTML = "";
    equipos.forEach(c => {
      const f = confs[c] || {bg:c,txt:"#FFF"};
      const btn = document.createElement('button');
      btn.className = 'btn btn-equipo-gigante';
      btn.style.backgroundColor = f.bg; btn.style.color = f.txt;
      btn.innerText = c;
      btn.onclick = () => loginEquipo(c, f.bg, f.txt);
      cont.appendChild(btn);
    });
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
  document.getElementById('cuerpo-web').style.background = `radial-gradient(circle at top, color-mix(in srgb, ${colorBG} 85%, transparent) 0%, #1a1a1a 100%)`;
}

function actualizarBarraUI() {
  const pct = Math.round((estacionesVisitadas / 8) * 100);
  const barra = document.getElementById('barra-completado');
  barra.style.width = pct + "%"; barra.innerText = pct + "%";
  document.getElementById('num-pasos').innerText = estacionesVisitadas;
  barra.style.backgroundColor = colorBG; barra.style.color = colorTXT;
}

async function verificarCodigo() {
  const btn = document.querySelector('#vista-login button.btn-dark');
  const codigo = document.getElementById('input-codigo').value;
  btn.disabled = true;
  const res = await llamarAPI({ action: 'login', color: colorGlobal, codigo: codigo });
  if(res && res.exito) {
    estacionActual = res.estacionObjetivo; datosJuegoLocal = res.datosJuego; 
    document.getElementById('texto-pista').innerText = res.pistaInicial;
    actualizarBarraUI(); guardar(res.pistaInicial); 
    irAVista('vista-juego'); mostrarPantallaJuego('pista');
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(()=>{}, ()=>{}, {enableHighAccuracy: true});
  } else if (!res.bloqueado) { mostrarAlerta("CÓDIGO INCORRECTO"); }
  btn.disabled = false;
}

function abrirEscaner() {
  const icon = document.querySelector('.icon-cam');
  icon.innerText = "⏳";
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => { icon.innerText = "📷"; iniciarCamara(p.coords.latitude, p.coords.longitude); },
      () => { icon.innerText = "📷"; iniciarCamara(null, null); }, 
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else { iniciarCamara(null, null); }
}

function iniciarCamara(lat, lon) {
  irAVista('vista-qr');
  html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
    if(txt.trim() === estacionActual.toString().trim()) { 
      cerrarEscaner(); 
      const res = await llamarAPI({ action: 'scan', color: colorGlobal, estacion: estacionActual, lat: lat, lon: lon, paso: estacionesVisitadas + 1 });
      if (res && res.bloqueado) return;
      document.getElementById('texto-acertijo').innerText = datosJuegoLocal[estacionActual].acertijo;
      mostrarPantallaJuego('acertijo');
    } else { mostrarAlerta("QR INCORRECTO"); cerrarEscaner(); }
  }).catch(() => { cerrarEscaner(); });
}

function cerrarEscaner() { 
  if(html5QrCode) { html5QrCode.stop().then(() => irAVista('vista-juego')).catch(() => irAVista('vista-juego')); }
  else { irAVista('vista-juego'); }
}

async function enviarRespuesta() {
  const input = document.getElementById('input-respuesta');
  const resp = input.value.toString().toUpperCase().trim();
  if (resp === datosJuegoLocal[estacionActual].respuesta) {
    const res = await llamarAPI({ action: 'answer', color: colorGlobal, estacion: estacionActual, respuesta: resp, paso: estacionesVisitadas + 1 });
    if (res && res.bloqueado) return;
    estacionesVisitadas++; actualizarBarraUI();
    if(estacionesVisitadas >= 8) {
      const pF = datosJuegoLocal[estacionActual].pistaSiguiente;
      document.getElementById('pista-tesoro-final').innerText = pF;
      mostrarPantallaJuego('tesoro'); guardar(pF);
    } else {
      const pS = datosJuegoLocal[estacionActual].pistaSiguiente;
      estacionActual = datosJuegoLocal[estacionActual].proximoQR;
      document.getElementById('texto-pista').innerText = pS;
      input.value = ""; mostrarPantallaJuego('pista'); guardar(pS);
    }
  } else { document.getElementById('error-respuesta').style.display = 'block'; }
}

async function procesarFoto() {
  const file = document.getElementById('foto-tesoro').files[0];
  if(!file) return;
  const reader = new FileReader();
  document.getElementById('status-foto').innerText = "SUBIENDO...";
  reader.onload = async (e) => {
    const res = await llamarAPI({ action: 'uploadPhoto', base64: e.target.result, color: colorGlobal });
    if(res && res.exito) { mostrarAlerta("¡LOGRADO!"); setTimeout(resetSesion, 4000); }
  };
  reader.readAsDataURL(file);
}

function irAVista(id) { 
  ['vista-equipos', 'vista-login', 'vista-juego', 'vista-qr'].forEach(v => { document.getElementById(v).style.display = (v == id) ? 'block' : 'none'; });
  actualizarBotonQR(); 
}

function mostrarPantallaJuego(p) {
  ['pantalla-pista', 'pantalla-acertijo', 'pantalla-tesoro'].forEach(x => { document.getElementById(x).style.display = (x === 'pantalla-'+p) ? 'block' : 'none'; });
  if(p==='pista') document.getElementById('pantalla-pista').style.display = 'flex';
  actualizarBotonQR();
}

function actualizarBotonQR() {
  const enP = document.getElementById('pantalla-pista').style.display !== 'none';
  document.getElementById('contenedor-escanear-fijo').style.display = (estacionesVisitadas < 8 && enP && document.getElementById('vista-juego').style.display !== 'none') ? 'block' : 'none';
}
