import { useState } from 'react';

export function useStudentUIState() {
  const [expandedPlanDay, setExpandedPlanDay] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pwaInstallTipOpen, setPwaInstallTipOpen] = useState(false);

  return {
    expandedPlanDay,
    setExpandedPlanDay,
    userMenuOpen,
    setUserMenuOpen,
    pwaInstallTipOpen,
    setPwaInstallTipOpen,
  };
}
