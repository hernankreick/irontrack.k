import React from "react";

export default function ProgressLoadControls({
  alumnosSorted,
  alumnoSel,
  setAlumnoSel,
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
}) {
  var options = exerciseOptions || [];
  var warmupOptions = options.filter(function (ex) {
    return ex.section === "warmup";
  });
  var mainOptions = options.filter(function (ex) {
    return ex.section === "main";
  });

  return (
    <>
      <div style={{ marginBottom: S.blockGapLoose }}>
        <label
          style={{
            display: "block",
            ...T.labelMd,
            color: C.t2,
            marginBottom: 6,
          }}
        >
          {M(lang, "Alumno", "Athlete")}
        </label>
        <select
          value={alumnoSel != null ? String(alumnoSel) : ""}
          onChange={function (e) {
            var v = e.target.value;
            setAlumnoSel(v || null);
          }}
          style={selectBaseStyle}
        >
          {alumnosSorted.map(function (a) {
            return (
              <option key={String(a.id)} value={String(a.id)}>
                {a.nombre || a.email || "—"}
              </option>
            );
          })}
        </select>
      </div>

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
          <div style={{ marginBottom: S.blockGapLoose }}>
            <label
              style={{
                display: "block",
                ...T.labelMd,
                color: C.t2,
                marginBottom: 6,
              }}
            >
              {M(lang, "Día de entrenamiento", "Training day")}
            </label>
            <select
              value={String(Math.min(diaIdx, Math.max(0, diasRutina.length - 1)))}
              onChange={function (e) {
                setDiaIdx(parseInt(e.target.value, 10) || 0);
              }}
              style={selectBaseStyle}
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
            <>
              {warmupOptions.length > 0 ? (
                <div style={{ marginBottom: S.blockGap }}>
                  <label
                    style={{
                      display: "block",
                      ...T.labelMd,
                      color: C.t2,
                      marginBottom: 6,
                    }}
                  >
                    {M(lang, "Calentamiento", "Warm-up")}
                  </label>
                  <select
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
                    style={selectBaseStyle}
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
                <div style={{ marginBottom: S.blockGapLoose }}>
                  <label
                    style={{
                      display: "block",
                      ...T.labelMd,
                      color: C.t2,
                      marginBottom: 6,
                    }}
                  >
                    {M(lang, "Principal", "Main")}
                  </label>
                  <select
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
                    style={selectBaseStyle}
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
            </>
          )}
        </>
      )}
    </>
  );
}
