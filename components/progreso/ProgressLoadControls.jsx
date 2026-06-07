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
  alumnoColor,
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
              {options.some(function (o) {
                return o.section === "warmup";
              }) ? (
                <div style={{ marginBottom: S.blockGap }}>
                  <div
                    style={{
                      ...T.labelMd,
                      color: C.t2,
                      marginBottom: 8,
                      letterSpacing: 0.3,
                    }}
                  >
                    {M(lang, "Calentamiento", "Warm-up")}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {options
                      .filter(function (ex) {
                        return ex.section === "warmup";
                      })
                      .map(function (ex) {
                        var act = String(ejercicioSelId) === String(ex.id);
                        return (
                          <button
                            key={"w-" + ex.id}
                            type="button"
                            onClick={function () {
                              setEjercicioSelId(ex.id);
                            }}
                            style={{
                              border: "1px solid " + (act ? C.blue : C.brd),
                              background: act ? "#1e3a8a22" : "transparent",
                              color: act ? alumnoColor : C.t2,
                              ...T.bodySemibold,
                              padding: "7px 12px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              maxWidth: "100%",
                            }}
                          >
                            {ex.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : null}
              {options.some(function (o) {
                return o.section === "main";
              }) ? (
                <div style={{ marginBottom: S.blockGapLoose }}>
                  <div
                    style={{
                      ...T.labelMd,
                      color: C.t2,
                      marginBottom: 8,
                      letterSpacing: 0.3,
                    }}
                  >
                    {M(lang, "Principal", "Main")}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {options
                      .filter(function (ex) {
                        return ex.section === "main";
                      })
                      .map(function (ex) {
                        var act = String(ejercicioSelId) === String(ex.id);
                        return (
                          <button
                            key={"m-" + ex.id}
                            type="button"
                            onClick={function () {
                              setEjercicioSelId(ex.id);
                            }}
                            style={{
                              border: "1px solid " + (act ? C.blue : C.brd),
                              background: act ? "#1e3a8a22" : "transparent",
                              color: act ? alumnoColor : C.t2,
                              ...T.bodySemibold,
                              padding: "7px 12px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              maxWidth: "100%",
                            }}
                          >
                            {ex.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </>
  );
}
