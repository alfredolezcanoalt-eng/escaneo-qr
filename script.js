const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwnBwd-BrpYzVc_u6PZnLNPHVzuvLiBzSP-xL0ZXnKEYDijw78fNG-F2vslKp21lJ4D/exec"; 
let colorGlobal = "", colorBG = "", colorTXT = "", estacionActual = 0, estacionesVisitadas = 0, datosJuegoLocal = {};

window.onload = () => { verificarSesion(); };

async function llamarAPI(datos) {
  try {
    const response = await fetch(WEB_APP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) });
    const res = await response.json();
    if (res && res.bloqueado) { mostrarAlertaCritica("🛑 ¡DEMASIADO TARDE!\nOtro equipo llegó al tesoro."); return res; }
    return res;
  } catch (error) { return { exito: false }; }
}

function mostrarAlertaCritica(msg) {
  const modal = document.getElementById('mi-alerta');
  document.getElementById('alerta-mensaje').innerText = msg;
  modal.querySelector('button').style.display = 'none';
  modal.style.display = 'flex';
  localStorage.setItem('JUEGO_BLOQUEADO', 'true');
}

function verificarSesion() {
  if (localStorage.getItem('JUEGO_BLOQUEADO')) { mostrarAlertaCritica("🛑 ¡DEMASIADO TARDE!"); return; }
  const guardado = localStorage.getItem('partidaTesoro');
  if (guardado) {
    const d = JSON.parse(guardado);
    colorGlobal = d.color; colorBG = d.bg; colorTXT = d.txt;
    estacionActual = d.estacion; estacionesVisitadas = d.visitadas; datosJuegoLocal = d.datosJuego;
    aplicarEstilos(); actualizarBarraUI();
    document.getElementById('texto-pista').innerText = d.pista;
    irAVista('vista-juego');
    mostrarPantallaJuego(estacionesVisitadas >= 8 ? 'tesoro' : 'pista');
  } else { cargarEquipos(); }
}

async function cargarEquipos() {
  const cont = document.getElementById('contenedor-botones');
  const equipos = await llamarAPI({ action: 'getTeams' });
  if (equipos && Array.isArray(equipos)) {
    cont.innerHTML = "";
    const confs = {"ROJO":"#FF0000","LILA":"#C8A2C8","BLANCO":"#FFF","AMARILLO":"#FFD700","NARANJA":"#FF8C00","CELESTE":"#00BFFF","VERDE":"#008000","MARRON":"#8B4513"};
    equipos.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-equipo-gigante';
      btn.style.backgroundColor = confs[c] || "#333";
      btn.innerText = c;
      btn.onclick = () => { colorGlobal = c; colorBG = btn.style.backgroundColor; irAVista('vista-login'); };
      cont.appendChild(btn);
    });
  }
}

function iniciarCamara(lat, lon) {
  irAVista('vista-qr');
  const scanner = new Html5Qrcode("reader");
  scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (txt) => {
    if (txt.trim() === estacionActual.toString().trim()) {
      scanner.stop();
      irAVista('vista-juego');
      document.getElementById('texto-acertijo').innerText = datosJuegoLocal[estacionActual].acertijo;
      mostrarPantallaJuego('acertijo');
      llamarAPI({ action: 'scan', color: colorGlobal, estacion: estacionActual, lat, lon, paso: estacionesVisitadas + 1 });
    }
  });
}

function enviarRespuesta() {
  const resp = document.getElementById('input-respuesta').value.toUpperCase().trim();
  if (resp === datosJuegoLocal[estacionActual].respuesta) {
    const estacionRespondida = estacionActual;
    estacionesVisitadas++;
    actualizarBarraUI();
    if (estacionesVisitadas >= 8) { mostrarPantallaJuego('tesoro'); } 
    else {
      estacionActual = datosJuegoLocal[estacionActual].proximoQR;
      document.getElementById('texto-pista').innerText = datosJuegoLocal[estacionRespondida].pistaSiguiente;
      mostrarPantallaJuego('pista');
      localStorage.setItem('partidaTesoro', JSON.stringify({ color: colorGlobal, bg: colorBG, estacion: estacionActual, visitadas: estacionesVisitadas, pista: document.getElementById('texto-pista').innerText, datosJuego: datosJuegoLocal }));
    }
    llamarAPI({ action: 'answer', color: colorGlobal, estacion: estacionRespondida, respuesta: resp, paso: estacionesVisitadas });
  }
}

function irAVista(id) { document.querySelectorAll('.container-fluid > div').forEach(v => v.style.display = v.id === id ? 'block' : 'none'); }
function mostrarPantallaJuego(p) { document.querySelectorAll('#tarjeta-dinamica > div').forEach(x => x.style.display = x.id === 'pantalla-'+p ? 'block' : 'none'); }
function aplicarEstilos() { document.body.style.background = `radial-gradient(circle, ${colorBG} 0%, #111 100%)`; }
function actualizarBarraUI() { document.getElementById('barra-completado').style.width = (estacionesVisitadas/8*100) + "%"; }
