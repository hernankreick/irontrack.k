import React, { createContext, useContext, useMemo } from 'react';
import { irontrackMsg } from '../lib/irontrackMsg.js';

const IronTrackI18nContext = createContext({
  lang: 'es',
  msg: (es, en, pt) => irontrackMsg('es', es, en, pt),
});

export function IronTrackI18nProvider({ lang, children }) {
  const value = useMemo(
    function () {
      return {
        lang: lang || 'es',
        msg: function (es, en, pt) {
          return irontrackMsg(lang || 'es', es, en, pt);
        },
      };
    },
    [lang]
  );
  return <IronTrackI18nContext.Provider value={value}>{children}</IronTrackI18nContext.Provider>;
}

export function useIronTrackI18n() {
  return useContext(IronTrackI18nContext);
}
