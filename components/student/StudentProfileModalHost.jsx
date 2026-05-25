import React from "react";
import AlumnoProfileModal from "./AlumnoProfileModal.jsx";

export default function StudentProfileModalHost({
  open,
  esAlumno,
  sessionData,
  profileEdit,
  setProfileEdit,
  profileFileRef,
  bgSub,
  border,
  textMain,
  msg,
  onClose,
  onSave,
}) {
  if (!open || !sessionData || !esAlumno) return null;

  return (
    <AlumnoProfileModal
      open={open}
      sessionData={sessionData}
      profileEdit={profileEdit}
      setProfileEdit={setProfileEdit}
      profileFileRef={profileFileRef}
      bgSub={bgSub}
      border={border}
      textMain={textMain}
      msg={msg}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
