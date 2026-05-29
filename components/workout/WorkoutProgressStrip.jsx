import React from 'react';

export default function WorkoutProgressStrip({
  exercises,
  activeExIdx,
  setActiveExIdx,
  getExerciseStatus,
  green,
  blue,
  darkModeResolved,
}) {
  return (
    <div style={{ display:"flex", gap:6, padding:"10px 16px 4px", flexShrink:0, overflowX:"auto" }}>
      {exercises.map((e, i) => {
        const done = getExerciseStatus(e).isDone;
        const active = i === activeExIdx;
        return (
          <button
            key={i}
            onClick={() => setActiveExIdx(i)}
            style={{
              flexShrink:0,
              height:5, borderRadius:3,
              width: active ? 24 : done ? 24 : 14,
              border:"none", cursor:"pointer",
              background: done ? green : active ? blue : (darkModeResolved ? "rgba(45,64,87,.8)" : "#CBD5E1"),
              transition:"all .25s ease",
              padding:0,
            }}
          />
        );
      })}
    </div>
  );
}
