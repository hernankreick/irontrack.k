// Swipe horizontal sobre las pills de reps del panel de registro (WorkoutExercisePanel).
//
// Cambia SOLO las reps (setReps). Los tres handlers cortan la propagacion (stopPropagation) para que el gesto no llegue
// al swipe de la tarjeta, que registra el set. No usa `this`: el estado inicial vive en startRef ({ current }).

export function createRepsSwipeHandlers({ startRef, getCur, lo, hi, step, setReps, vibrate }) {
  const buzz = vibrate || function () {};
  return {
    onTouchStart(e) {
      e.stopPropagation();
      startRef.current = e.touches[0].clientX;
    },
    onTouchMove(e) {
      e.stopPropagation();
    },
    onTouchEnd(e) {
      e.stopPropagation();
      const dx = e.changedTouches[0].clientX - (startRef.current || 0);
      startRef.current = null;
      const cur = getCur();
      if (dx < -30 && cur < hi) {
        setReps(String(Math.min(hi, cur + step)));
        buzz(15);
      } else if (dx > 30 && cur > lo) {
        setReps(String(Math.max(lo, cur - step)));
        buzz(15);
      }
    },
  };
}

/**
 * ¿El gesto sigue siendo un swipe horizontal? Con poco movimiento vertical (<=12 px) siempre; si no, el desplazamiento
 * horizontal debe ser al menos el doble del vertical. Un gesto diagonal o vertical es scroll y NO registra la serie.
 */
export function esSwipeHorizontal(dx, dy) {
  var ax = Math.abs(Number(dx) || 0);
  var ay = Math.abs(Number(dy) || 0);
  return ay <= 12 || ax >= 2 * ay;
}
