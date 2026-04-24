import React from 'react';
import { ScanLine, Plus, Search, ChevronDown } from 'lucide-react';
import { irontrackMsg as M } from '../../lib/irontrackMsg.js';
import { RoutineFilters } from './RoutineFilters.jsx';
import './routines-ui.css';

/**
 * Cabecera + barra búsqueda/filtros/orden (mock Rutinas IronTrack).
 */
export function RoutinesTopSection({
  lang,
  darkMode,
  border,
  textMain,
  textMuted,
  surfaceInput,
  filtroRut,
  setFiltroRut,
  searchQuery,
  setSearchQuery,
  sortOrder,
  setSortOrder,
  onScan,
  onNewRoutine,
}) {
  return (
    <div className="it-routines-top-wrap">
      <header
        className="it-routines-page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 16,
          marginBottom: 4,
          borderBottom: `1px solid ${darkMode ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)'}`,
        }}
      >
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: -0.02,
              lineHeight: 1.15,
              color: textMain,
            }}
          >
            {M(lang, 'Rutinas', 'Routines', 'Rotinas')}
          </h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.45,
              color: textMuted,
              maxWidth: 520,
            }}
          >
            {M(
              lang,
              'Gestioná tus planes, asignaciones y plantillas.',
              'Manage your plans, assignments, and templates.',
              'Gerencie seus planos, atribuições e modelos.'
            )}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="it-routine-btn it-routine-btn--ghost hov"
            onClick={onScan}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: `1px solid ${darkMode ? 'rgba(226,232,240,0.35)' : border}`,
              borderRadius: 10,
              color: darkMode ? '#e2e8f0' : textMain,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            <ScanLine size={17} strokeWidth={2} />
            {M(lang, 'Escanear rutina existente', 'Scan existing routine', 'Digitalizar rotina existente')}
          </button>
          <button
            type="button"
            className="it-routine-btn hov"
            onClick={onNewRoutine}
            style={{
              padding: '10px 18px',
              background: '#2563eb',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            {M(lang, 'Nueva rutina', 'New routine', 'Nova rotina')}
          </button>
        </div>
      </header>

      {setFiltroRut && (
        <div
          className="it-routines-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            paddingBottom: 16,
            marginBottom: 8,
            borderBottom: `1px solid ${darkMode ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.06)'}`,
          }}
        >
          <div
            className="it-routines-search-wrap"
            style={{
              flex: '1 1 220px',
              minWidth: 0,
              maxWidth: 420,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: textMuted,
                pointerEvents: 'none',
              }}
              strokeWidth={2}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={M(lang, 'Buscar rutina...', 'Search routine...', 'Buscar rotina...')}
              aria-label={M(lang, 'Buscar rutina', 'Search routines', 'Buscar rotinas')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px 10px 40px',
                borderRadius: 10,
                border: `1px solid ${border}`,
                background: surfaceInput,
                color: textMain,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          <div
            className="it-routine-filters-row"
            style={{
              flex: '2 1 260px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            <RoutineFilters
              filtro={filtroRut}
              setFiltro={setFiltroRut}
              lang={lang}
              darkMode={darkMode}
              border={border}
              textMuted={textMuted}
            />
          </div>

          <div style={{ flex: '0 0 auto', position: 'relative' }}>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="it-routine-sort-select it-routine-btn hov"
              aria-label={M(lang, 'Ordenar rutinas', 'Sort routines', 'Ordenar rotinas')}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                padding: '10px 38px 10px 14px',
                borderRadius: 10,
                border: `1px solid ${border}`,
                background: surfaceInput,
                color: darkMode ? '#f1f5f9' : textMain,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                minWidth: 140,
              }}
            >
              <option value="recientes">{M(lang, 'Recientes', 'Recent', 'Recentes')}</option>
              <option value="default">{M(lang, 'Orden de lista', 'List order', 'Ordem da lista')}</option>
            </select>
            <ChevronDown
              size={16}
              aria-hidden
              style={{
                position: 'absolute',
                right: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: textMuted,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
