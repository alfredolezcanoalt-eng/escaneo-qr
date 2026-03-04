/** @OnlyCurrentDoc */
const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  if (e.parameter.v === 'admin') {
    return HtmlService.createTemplateFromFile('Monitor').evaluate()
      .setTitle('MONITOR STAFF')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } 
  else if (e.parameter.v === 'mapa') {
    return HtmlService.createTemplateFromFile('Mapa').evaluate()
      .setTitle('MAPA DE CONTROL GPS')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createHtmlOutput("Servidor de API Activo");
}

// Consulta rápida en RAM
function estaBloqueado() {
  const cache = CacheService.getScriptCache();
  return cache.get("JUEGO_FINALIZADO") === "true";
}

function doPost(e) {
  let respuesta;
  try {
    const datosRecibidos = JSON.parse(e.postData.contents);
    const accion = datosRecibidos.action;

    // CONSULTA DE CACHÉ: Rechazo inmediato si el juego terminó
    if ((accion === 'scan' || accion === 'answer') && estaBloqueado()) {
      return ContentService.createTextOutput(JSON.stringify({ 
        exito: false, 
        bloqueado: true 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    switch (accion) {
      case 'getTeams':
        respuesta = obtenerEquipos();
        break;
      case 'login':
        respuesta = validarAcceso(datosRecibidos.color, datosRecibidos.codigo);
        break;
      case 'scan':
        if (datosRecibidos.lat) {
          respuesta = registrarLlegadaConUbicacion(datosRecibidos.color, datosRecibidos.estacion, datosRecibidos.lat, datosRecibidos.lon, datosRecibidos.paso);
        } else {
          registrarLlegada(datosRecibidos.color, datosRecibidos.paso);
          respuesta = { exito: true };
        }
        break;
      case 'answer':
        respuesta = validarRespuesta(datosRecibidos.color, datosRecibidos.estacion, datosRecibidos.respuesta, datosRecibidos.paso);
        break;
      case 'uploadPhoto':
        respuesta = subirFotoFinal(datosRecibidos.base64, datosRecibidos.color);
        break;
      default:
        respuesta = { exito: false, error: "Acción no reconocida" };
    }
  } catch (err) {
    respuesta = { exito: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}


function validarAcceso(color, codigo) {
  const hoja = SS.getSheetByName("EQUIPOS");
  const datos = hoja.getDataRange().getValues();
  const filaEquipo = datos.find(f => f[0].toString().toUpperCase() === color.toUpperCase() && f[1].toString() === codigo.toString());
  
  if (filaEquipo) {
    registrarInicio(color);
    const datosJuego = obtenerDatosJuego(color); 
    return { 
      exito: true, 
      pistaInicial: limpiarTexto(filaEquipo[5]), 
      estacionObjetivo: filaEquipo[7].toString().trim(), 
      datosJuego: datosJuego 
    };
  }
  return { exito: false };
}


function limpiarTexto(texto) {
  if (!texto) return "";
  return texto.toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function obtenerEquipos() {
  const hoja = SS.getSheetByName("EQUIPOS");
  return hoja.getRange("A2:A9").getValues()
    .map(f => f[0].toString().toUpperCase().trim())
    .filter(c => c !== "");
}

function registrarInicio(color) {
  const hP = SS.getSheetByName("PROGRESO");
  const dP = hP.getDataRange().getValues();
  for (let j = 1; j < dP.length; j++) {
    if (dP[j][0].toString().toUpperCase() === color.toUpperCase()) {
      if (!dP[j][1]) hP.getRange(j + 1, 2).setValue(new Date());
      break;
    }
  }
}

function obtenerDatosJuego(color) {
  const datos = SS.getSheetByName("ESTACIONES").getDataRange().getValues();
  let mapa = {};
  
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][1].toString().toUpperCase() === color.toUpperCase()) {
      let qrID = datos[i][0].toString().trim();
      mapa[qrID] = {
        acertijo: limpiarTexto(datos[i][2]),
        respuesta: limpiarTexto(datos[i][3]),
        pistaSiguiente: limpiarTexto(datos[i][4]),
        proximoQR: datos[i][8] ? datos[i][8].toString().trim() : ""
      };
    }
  }
  return mapa;
}

function registrarLlegada(equipo, paso) {
  const hoja = SS.getSheetByName("PROGRESO");
  const datos = hoja.getDataRange().getValues();
  const idx = datos.findIndex(f => f[0].toString().toUpperCase() === equipo.toUpperCase());
  
  if (idx !== -1) {
    hoja.getRange(idx + 1, parseInt(paso) + 2).setValue(new Date());
  }
}

function registrarLlegadaConUbicacion(equipo, nroEstacion, lat, lon, paso) {
  try {
    const hojaEstaciones = SS.getSheetByName("Estaciones");
    const datos = hojaEstaciones.getDataRange().getValues();
    const ahora = new Date();
    
    let filaEncontrada = -1;
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim() === nroEstacion.toString().trim() && 
          datos[i][1].toString().toUpperCase() === equipo.toUpperCase()) {
        filaEncontrada = i + 1;
        break;
      }
    }

    if (filaEncontrada !== -1) {
      hojaEstaciones.getRange(filaEncontrada, 6).setValue(lat);
      hojaEstaciones.getRange(filaEncontrada, 7).setValue(lon);
      hojaEstaciones.getRange(filaEncontrada, 8).setValue(ahora);
      
      registrarLlegada(equipo, paso);
      return { exito: true };
    } else {
      return { exito: false, error: "No se encontró la combinación" };
    }
  } catch (e) { return { exito: false, error: e.message }; }
}

function validarRespuesta(color, nro, resp, paso) {
  const rLimpia = limpiarTexto(resp);
  let esCorrecto = false;
  let pistaSig = "";
  
  const datosEstaciones = SS.getSheetByName("ESTACIONES").getDataRange().getValues();
  for (let i = 1; i < datosEstaciones.length; i++) {
    if (datosEstaciones[i][0].toString().trim() === nro.toString().trim() && 
        datosEstaciones[i][1].toString().toUpperCase() === color.toUpperCase()) {
        
      if (limpiarTexto(datosEstaciones[i][3]) === rLimpia) {
        esCorrecto = true;
        pistaSig = limpiarTexto(datosEstaciones[i][4]);
        break;
      }
    }
  }

  if (esCorrecto) {
    const hP = SS.getSheetByName("PROGRESO");
    const dP = hP.getDataRange().getValues();
    const idx = dP.findIndex(f => f[0].toString().toUpperCase() === color.toUpperCase());
    if (idx !== -1) {
      hP.getRange(idx + 1, 11 + parseInt(paso)).setValue(new Date());
    }
    return { exito: true, pistaSiguiente: pistaSig };
  }
  return { exito: false };
}

function subirFotoFinal(base64, equipo) {
  try {
    // ACTIVAR CACHÉ: Bloqueo inmediato para todos los demás por 4 horas (14400 seg)
    CacheService.getScriptCache().put("JUEGO_FINALIZADO", "true", 14400);

    const blob = Utilities.newBlob(Utilities.base64Decode(base64.split(",")[1]), "image/jpeg", "TESORO_" + equipo + ".JPG");
    const archivo = DriveApp.getRootFolder().createFile(blob);
    
    const hE = SS.getSheetByName("EQUIPOS");
    const dE = hE.getDataRange().getValues();
    const idxE = dE.findIndex(f => f[0].toString().toUpperCase() === equipo.toUpperCase());
    if (idxE !== -1) {
      hE.getRange(idxE + 1, 7).setValue(archivo.getUrl());
    }

    const hP = SS.getSheetByName("PROGRESO");
    const dP = hP.getDataRange().getValues();
    const idxP = dP.findIndex(f => f[0].toString().toUpperCase() === equipo.toUpperCase());
    if (idxP !== -1) {
      hP.getRange(idxP + 1, 11).setValue(new Date());
    }
    
    return { exito: true };
  } catch (e) { return { exito: false }; }
}

// Botón de Reset del Monitor
function resetearBloqueoCache() {
  try {
    CacheService.getScriptCache().remove("JUEGO_FINALIZADO");
    return { exito: true, mensaje: "Caché reiniciado. El juego está abierto de nuevo." };
  } catch (e) {
    return { exito: false, error: e.toString() };
  }
}

function leerProgresoAdmin() {
  const hojaP = SS.getSheetByName("PROGRESO");
  const datosP = hojaP.getDataRange().getValues();
  const hojaE = SS.getSheetByName("EQUIPOS");
  const datosE = hojaE.getDataRange().getValues();
  
  const resumen = datosP.slice(1).map((fila) => {
    let estaciones = [];
    let completadas = 0;
    let ultimaRespuestaMs = 0;
    
    const equipoNombre = fila[0] ? fila[0].toString().toUpperCase() : "";
    const datoEquipo = datosE.find(e => e[0].toString().toUpperCase() === equipoNombre);
    const fotoUrl = (datoEquipo && datoEquipo[6]) ? datoEquipo[6] : "";

    for(let j = 2; j <= 9; j++) { 
      const llego = !!fila[j];
      const respondio = !!fila[j + 9];
      
      if(respondio) {
        completadas++;
        if (fila[j + 9] instanceof Date) {
          const ms = fila[j + 9].getTime();
          if (ms > ultimaRespuestaMs) ultimaRespuestaMs = ms;
        }
      }
      estaciones.push({ llego, respondio });
    }

    const fechaFin = (fila[10] instanceof Date) ? fila[10].getTime() : null;

    return {
      equipo: equipoNombre,
      inicio: fila[1] instanceof Date ? Utilities.formatDate(fila[1], "GMT-3", "HH:mm") : "--:--",
      estaciones: estaciones,
      pasos: completadas,
      ultimaRespuestaMs: ultimaRespuestaMs,
      finalizadoMs: fechaFin,
      foto: fotoUrl
    };
  });

  return resumen.sort((a, b) => {
    if (b.pasos !== a.pasos) return b.pasos - a.pasos;
    if (a.pasos > 0 && b.pasos > 0) return a.ultimaRespuestaMs - b.ultimaRespuestaMs;
    return 0;
  });
}

function obtenerPuntosGPS() {
  const hoja = SS.getSheetByName("Estaciones");
  const datos = hoja.getDataRange().getValues();
  const puntos = [];

  for (let i = 1; i < datos.length; i++) {
    const equipoNombre = datos[i][1];
    const lat = datos[i][5];        
    const lon = datos[i][6];
    
    if (lat && lon) {
      puntos.push({
        equipo: equipoNombre,
        estacion: datos[i][0],
        lat: lat,
        lon: lon,
        hora: datos[i][7] ? Utilities.formatDate(new Date(datos[i][7]), "GMT-3", "HH:mm") : "",
        color: determinarColorHex(equipoNombre) 
      });
    }
  }
  return puntos;
}

function determinarColorHex(nombre) {
  const colores = {
    "ROJO": "#FF0000", "CELESTE": "#00BFFF", "VERDE": "#008000", "AMARILLO": "#FFFF00",
    "NARANJA": "#FFA500", "LILA": "#8A2BE2", "BLANCO": "#FFFFFF", "MARRON": "#8B4513"
  };
  return colores[nombre.toUpperCase().trim()] || "#cccccc";
}
