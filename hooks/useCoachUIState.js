import { useState } from 'react';

export function useCoachUIState() {
  const [registrosSubTab, setRegistrosSubTab] = useState(0);
  const [sugsOpen, setSugsOpen] = useState({});
  const [filtroRut, setFiltroRut] = useState("todas");
  const [bibOpenNewExerciseTick, setBibOpenNewExerciseTick] = useState(0);

  const [coachAlumnosSearch, setCoachAlumnosSearch] = useState("");
  const [coachAlumnosFilter, setCoachAlumnosFilter] = useState("todos");
  const [coachRoutineDiaIdx, setCoachRoutineDiaIdx] = useState(0);
  const [coachDiaSecsOpen, setCoachDiaSecsOpen] = useState({ warmup: true, main: true });
  const [coachCardMenuId, setCoachCardMenuId] = useState(null);
  const [coachRutinaMenuOpen, setCoachRutinaMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return {
    registrosSubTab,
    setRegistrosSubTab,
    sugsOpen,
    setSugsOpen,
    filtroRut,
    setFiltroRut,
    bibOpenNewExerciseTick,
    setBibOpenNewExerciseTick,
    coachAlumnosSearch,
    setCoachAlumnosSearch,
    coachAlumnosFilter,
    setCoachAlumnosFilter,
    coachRoutineDiaIdx,
    setCoachRoutineDiaIdx,
    coachDiaSecsOpen,
    setCoachDiaSecsOpen,
    coachCardMenuId,
    setCoachCardMenuId,
    coachRutinaMenuOpen,
    setCoachRutinaMenuOpen,
    mobileDrawerOpen,
    setMobileDrawerOpen,
  };
}
