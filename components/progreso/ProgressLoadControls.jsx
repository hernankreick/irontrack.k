import React from "react";

export default function ProgressLoadControls({
  diasRutina,
  diaIdx,
  setDiaIdx,
  ejercicioSelId,
  setEjercicioSelId,
  exerciseOptions,
  rutinaActiva,
  selectBaseStyle,
  C,
  T,
  S,
  lang,
  M,
  emptyBox,
  compact,
}) {
  var uid = React.useId();
  var idDia = "pl-dia-" + uid;
  var idWarm = "pl-warm-" + uid;
  var idMain = "pl-main-" + uid;
  // Movil (compact): label mas junto al control, selects >=44 px y 16 px (sin zoom en iOS); el nombre largo se corta dentro del select.
  var selStyle = compact
    ? Object.assign({}, selectBaseStyle, { minHeight: 44, fontSize: 16, textOverflow: "ellipsis", minWidth: 0 })
    : selectBaseStyle;
  var lblStyle = Object.assign({ display: "block" }, T.labelMd, { color: C.t2, marginBottom: compact ? 4 : 6 }, compact ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : null);
  var gap = compact ? S.blockGap : S.blockGapLoose;
  var options = exerciseOptions || [];
  var warmupOptions = options.filter(function (ex) {
    return ex.section === "warmup";
  });
  var mainOptions = options.filter(function (ex) {
    return ex.section === "main";
  });

  return (
    <>
      {!rutinaActiva || diasRutina.length === 0 ? (
        <div style={{ marginBottom: S.blockGapLoose }}>
          {emptyBox(
            lang,
            M(
              lang,
              "Este alumno no tiene una rutina con días cargados",
              "This athlete has no routine with training days",
              "Este aluno não tem rotina com dias de treino carregados"
            ),
            C
          )}
        </div>
      ) : (
        <>
          <div style={{ marginBottom: gap }}>
            <label htmlFor={idDia} style={lblStyle}>
              {M(lang, "Día de entrenamiento", "Training day")}
            </label>
            <select
              id={idDia}
              value={String(Math.min(diaIdx, Math.max(0, diasRutina.length - 1)))}
              onChange={function (e) {
                setDiaIdx(parseInt(e.target.value, 10) || 0);
              }}
              style={selStyle}
            >
              {diasRutina.map(function (d, i) {
                var lbl = d && d.label ? String(d.label).trim() : "";
                if (!lbl) {
                  lbl = M(lang, "Día " + (i + 1), "Day " + (i + 1), "Dia " + (i + 1));
                }
                return (
                  <option key={"dia-rut-" + i} value={String(i)}>
                    {lbl}
                  </option>
                );
              })}
            </select>
          </div>

          {options.length === 0 ? (
            <div style={{ ...T.subtitle, color: C.t2, marginBottom: S.blockGapLoose }}>
              {M(
                lang,
                "Este día no tiene ejercicios en la rutina. Podés elegir otro día o revisar la rutina del alumno.",
                "This day has no exercises in the routine. Pick another day or review the athlete's plan.",
                "Este dia não tem exercícios na rotina. Escolha outro dia ou revise o plano do aluno."
              )}
            </div>
          ) : (
            <div
              style={
                compact && warmupOptions.length > 0 && mainOptions.length > 0
                  ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 8 }
                  : undefined
              }
            >
              {warmupOptions.length > 0 ? (
                <div style={{ marginBottom: compact ? gap : S.blockGap, minWidth: 0 }}>
                  <label htmlFor={idWarm} style={lblStyle}>
                    {M(lang, "Calentamiento", "Warm-up")}
                  </label>
                  <select
                    id={idWarm}
                    value={
                      warmupOptions.some(function (ex) {
                        return String(ex.id) === String(ejercicioSelId);
                      })
                        ? String(ejercicioSelId)
                        : ""
                    }
                    onChange={function (e) {
                      setEjercicioSelId(e.target.value || null);
                    }}
                    style={selStyle}
                  >
                    <option value="">{M(lang, "Seleccionar...", "Select...")}</option>
                    {warmupOptions.map(function (ex) {
                      return (
                        <option key={"w-" + ex.id} value={String(ex.id)}>
                          {ex.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}
              {mainOptions.length > 0 ? (
                <div style={{ marginBottom: gap, minWidth: 0 }}>
                  <label htmlFor={idMain} style={lblStyle}>
                    {M(lang, "Principal", "Main")}
                  </label>
                  <select
                    id={idMain}
                    value={
                      mainOptions.some(function (ex) {
                        return String(ex.id) === String(ejercicioSelId);
                      })
                        ? String(ejercicioSelId)
                        : ""
                    }
                    onChange={function (e) {
                      setEjercicioSelId(e.target.value || null);
                    }}
                    style={selStyle}
                  >
                    <option value="">{M(lang, "Seleccionar...", "Select...")}</option>
                    {mainOptions.map(function (ex) {
                      return (
                        <option key={"m-" + ex.id} value={String(ex.id)}>
                          {ex.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </>
  );
}
