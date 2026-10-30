import React, { useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { dayNum, diaLocal } from "../../lib/metricas/index.js";

/** Opciones del selector de período (ids que entiende getPeriodDays en coachProgresoMetrics.js). */
export var PERIOD_IDS = ["semanas4", "semanas8", "meses3", "meses6", "todo", "custom"];
/** Períodos largos: si el historial no se cargó completo, pueden faltarles registros antiguos. */
var LARGOS = { meses6: true, todo: true, custom: true };

var DAY_MS = 86400000;

/** Número de día de calendario -> "aaaa-mm-dd" (valor de <input type="date">). */
export function dayToIso(dia) {
  var d = new Date(dia * DAY_MS);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

/** "aaaa-mm-dd" -> número de día, o null si no es una fecha válida. */
export function isoToDay(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  var dia = dayNum(y, mo, d);
  return dayToIso(dia) === s ? dia : null;
}

function fechaCorta(dia, lang) {
  var u = new Date(dia * DAY_MS);
  var d = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  var l = lang === "es" ? "es-AR" : lang === "pt" ? "pt-BR" : "en-US";
  return d.toLocaleDateString(l, { day: "numeric", month: "short" }).replace(/\./g, "");
}

/**
 * Texto del período: `short` para la barra compacta («4 sem»). periodo = { id, desde?, hasta? } (custom: números de día).
 */
export function periodLabel(periodo, lang, short) {
  var id = periodo && periodo.id;
  if (id === "custom" && periodo.desde != null && periodo.hasta != null) {
    return fechaCorta(periodo.desde, lang) + " – " + fechaCorta(periodo.hasta, lang);
  }
  var L = {
    semanas4: short ? M(lang, "4 sem", "4 wk", "4 sem") : M(lang, "4 semanas", "4 weeks", "4 semanas"),
    semanas8: short ? M(lang, "8 sem", "8 wk", "8 sem") : M(lang, "8 semanas", "8 weeks", "8 semanas"),
    meses3: short ? M(lang, "3 meses", "3 mo", "3 meses") : M(lang, "3 meses", "3 months", "3 meses"),
    meses6: short ? M(lang, "6 meses", "6 mo", "6 meses") : M(lang, "6 meses", "6 months", "6 meses"),
    todo: short ? M(lang, "Todo", "All", "Tudo") : M(lang, "Todo el historial", "Whole history", "Todo o histórico"),
    custom: M(lang, "Personalizado", "Custom", "Personalizado"),
  };
  return L[id] || L.semanas4;
}

/**
 * Valida un rango personalizado ("aaaa-mm-dd"). Devuelve { ok, desde, hasta } o { ok:false, error }.
 * Reglas: ambas fechas válidas, inicio <= fin, y ninguna posterior a hoy (no hay datos del futuro).
 */
export function validateCustomRange(desdeIso, hastaIso, lang, hoy) {
  var h = hoy != null ? hoy : diaLocal();
  var d = isoToDay(desdeIso);
  var a = isoToDay(hastaIso);
  if (d == null || a == null) return { ok: false, error: M(lang, "Elegí la fecha de inicio y la de fin.", "Choose a start and an end date.", "Escolha a data de início e a de fim.") };
  if (d > a) return { ok: false, error: M(lang, "La fecha de inicio tiene que ser anterior o igual a la de fin.", "The start date must be on or before the end date.", "A data de início deve ser anterior ou igual à de fim.") };
  if (a > h) return { ok: false, error: M(lang, "La fecha de fin no puede ser posterior a hoy.", "The end date cannot be after today.", "A data de fim não pode ser posterior a hoje.") };
  return { ok: true, desde: d, hasta: a };
}

/**
 * Botón que muestra el período elegido y abre el selector (encabezado completo y barra compacta).
 * `short`: etiqueta corta también en el encabezado completo (móvil), para que el nombre del alumno no se corte.
 */
export function PeriodButton({ periodo, onOpen, compact, short, lang, C, P }) {
  var label = periodLabel(periodo, lang, compact || short);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={M(lang, "Período: ", "Period: ", "Período: ") + periodLabel(periodo, lang, false) + ". " + M(lang, "Cambiar", "Change", "Trocar")}
      data-qa={compact ? "periodo-btn-compacto" : "periodo-btn"}
      style={{
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: compact ? 44 : 56,
        minWidth: 44,
        maxWidth: compact || short ? 150 : 200,
        padding: compact ? "0 12px" : "0 12px 0 14px",
        background: C.card,
        border: "1px solid " + P.line,
        borderRadius: compact ? 22 : 14,
        color: C.t,
        fontSize: compact ? 15 : 15,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      {compact ? null : <CalendarDays size={18} color={P.accentText} aria-hidden="true" style={{ flex: "none" }} />}
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <ChevronDown size={compact ? 14 : 16} color={P.muted} aria-hidden="true" style={{ flex: "none" }} />
    </button>
  );
}

/**
 * Contenido de la hoja «Período»: las cinco opciones fijas (se aplican al tocarlas) y el rango personalizado (dos
 * <input type="date"> nativos —en iPhone abren el selector de fechas del sistema— y «Aplicar» con validación).
 */
export function PeriodSheetContent({ periodo, onSelect, historiaIncompleta, lang, C, P, hoy }) {
  var h = hoy != null ? hoy : diaLocal();
  var cur = periodo || { id: "semanas4" };
  var [showCustom, setShowCustom] = useState(cur.id === "custom");
  var [desde, setDesde] = useState(cur.id === "custom" && cur.desde != null ? dayToIso(cur.desde) : dayToIso(h - 27));
  var [hasta, setHasta] = useState(cur.id === "custom" && cur.hasta != null ? dayToIso(cur.hasta) : dayToIso(h));
  var [error, setError] = useState("");

  function opt(id) {
    var sel = cur.id === id;
    var isCustom = id === "custom";
    return (
      <li key={id}>
        <button
          type="button"
          role="radio"
          aria-checked={sel}
          data-qa={"periodo-op-" + id}
          onClick={function () {
            if (isCustom) {
              setShowCustom(true);
              return;
            }
            onSelect({ id: id });
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            minHeight: 52,
            padding: "0 12px",
            border: "none",
            borderRadius: 12,
            background: sel ? (P.dark ? "#172554" : "#eff6ff") : "transparent",
            color: C.t,
            textAlign: "left",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: sel ? 700 : 600 }}>{periodLabel({ id: id }, lang, false)}</span>
            {isCustom && sel ? <span style={{ fontSize: 13, color: P.accentSoftText }}>{periodLabel(cur, lang, false)}</span> : null}
            {historiaIncompleta && LARGOS[id] ? (
              <span style={{ fontSize: 12, color: P.warn }}>{M(lang, "Puede faltar historial antiguo", "Older history may be missing", "Pode faltar histórico antigo")}</span>
            ) : null}
          </span>
          {sel ? <Check size={20} color={P.accentText} strokeWidth={2.5} aria-hidden="true" style={{ flex: "none" }} /> : null}
        </button>
      </li>
    );
  }

  var inputStyle = {
    width: "100%",
    minHeight: 48,
    boxSizing: "border-box",
    padding: "0 12px",
    background: P.dark ? C.cardDark : C.card,
    border: "1px solid " + P.line,
    borderRadius: 12,
    color: C.t,
    fontSize: 16,
    fontFamily: "inherit",
    colorScheme: P.dark ? "dark" : "light",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <ul role="radiogroup" aria-label={M(lang, "Período", "Period", "Período")} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
        {PERIOD_IDS.map(opt)}
      </ul>
      {showCustom ? (
        <div data-qa="periodo-custom" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, border: "1px solid " + C.brd, borderRadius: 14, background: P.dark ? C.cardDark : "#f8fafc" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: P.muted, minWidth: 0 }}>
              {M(lang, "Desde", "From", "De")}
              <input id="periodo-desde" type="date" value={desde} max={hasta || dayToIso(h)} onChange={function (e) { setDesde(e.target.value); setError(""); }} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: P.muted, minWidth: 0 }}>
              {M(lang, "Hasta", "To", "Até")}
              <input id="periodo-hasta" type="date" value={hasta} min={desde || undefined} max={dayToIso(h)} onChange={function (e) { setHasta(e.target.value); setError(""); }} style={inputStyle} />
            </label>
          </div>
          {error ? <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.bad, lineHeight: 1.4 }}>{error}</p> : null}
          <button
            type="button"
            data-qa="periodo-aplicar"
            onClick={function () {
              var v = validateCustomRange(desde, hasta, lang, h);
              if (!v.ok) {
                setError(v.error);
                return;
              }
              onSelect({ id: "custom", desde: v.desde, hasta: v.hasta });
            }}
            style={{ minHeight: 48, border: "none", borderRadius: 12, background: C.blue, color: "#ffffff", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
          >
            {M(lang, "Aplicar período", "Apply period", "Aplicar período")}
          </button>
        </div>
      ) : null}
      <p style={{ margin: "4px 0 0", fontSize: 12, color: P.muted, lineHeight: 1.45 }}>
        {M(
          lang,
          "Las tarjetas comparan con el período anterior de igual duración. «Todo el historial» no tiene período anterior.",
          "Cards compare with the previous period of the same length. «Whole history» has no previous period.",
          "Os cartões comparam com o período anterior de mesma duração. «Todo o histórico» não tem período anterior."
        )}
      </p>
    </div>
  );
}
