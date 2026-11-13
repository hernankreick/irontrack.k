import React, { useCallback, useEffect, useRef, useState } from "react";
import PrescritoEjecutadoVista from "./PrescritoEjecutadoVista.jsx";
import { obtenerHostPrescritoEjecutado } from "../../lib/prescritoEjecutadoHost.js";
import { useIronTrackI18n } from "../../contexts/IronTrackI18nContext.jsx";

/**
 * Contenedor: lee los datos del alumno (via el puente registrado por App) y delega la presentacion. Sin la bandera de build no renderiza nada
 * ni hace ninguna lectura. `propio`: lo mira el propio alumno en su dispositivo (unico caso en que se puede afirmar "registro completo").
 */
export default function PrescritoEjecutadoPanel({ alumnoId, propio = false, darkMode = true }) {
  var { lang } = useIronTrackI18n();
  var host = obtenerHostPrescritoEjecutado();
  var [estado, setEstado] = useState("cargando"); var [datos, setDatos] = useState(null);
  var ultimo = useRef(0);
  var cargar = useCallback(function () {
    if (!host.activo || !host.cargar || alumnoId == null || alumnoId === "") return;
    var mio = ++ultimo.current; setEstado("cargando");
    Promise.resolve(host.cargar(alumnoId, { propio: propio })).then(function (r) {
      if (mio !== ultimo.current) return;            // llego tarde: el alumno cambio mientras tanto
      setDatos(r); setEstado(r && r.estado ? r.estado : "error");
    }, function () { if (mio === ultimo.current) setEstado("error"); });
  }, [alumnoId, propio, host.activo, host.cargar]);
  useEffect(function () { cargar(); return function () { ultimo.current++; }; }, [cargar]);
  if (!host.activo) return null;
  return <PrescritoEjecutadoVista estado={estado} resultado={datos && datos.resultado} cobertura={datos && datos.cobertura} onReintentar={cargar} darkMode={darkMode} lang={lang} />;
}
