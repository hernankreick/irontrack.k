import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const MODAL_TRANSITION_MS = 200;
const MODAL_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export default function BaseModal({
  open,
  onClose,
  children,
  maxWidth = 480,
  closeOnOutside = true,
}) {
  const [shouldRender, setShouldRender] = useState(!!open);

  useEffect(function () {
    if (open) {
      setShouldRender(true);
      return undefined;
    }
    var timer = window.setTimeout(function () {
      setShouldRender(false);
    }, MODAL_TRANSITION_MS);
    return function () {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(function () {
    if (!shouldRender) return undefined;
    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return function () {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldRender]);

  useEffect(function () {
    if (!shouldRender) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape' && typeof onClose === 'function') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return function () {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [shouldRender, onClose]);

  if (!shouldRender || typeof document === 'undefined') return null;

  var isClosing = !open;
  var resolvedMaxWidth = typeof maxWidth === 'number' ? maxWidth : maxWidth || 480;
  var cardMaxWidth = typeof resolvedMaxWidth === 'number' ? resolvedMaxWidth : String(resolvedMaxWidth);
  var prefersDark = true;
  try {
    var storedDark = window.localStorage.getItem('it_dark');
    prefersDark = storedDark !== null
      ? storedDark !== 'false'
      : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) {}
  var modalBg = prefersDark ? '#0d1424' : '#FFFFFF';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        opacity: isClosing ? 0 : 1,
        transition: 'opacity ' + MODAL_TRANSITION_MS + 'ms ' + MODAL_EASE,
        animation: isClosing ? 'none' : 'it-dup-day-overlay-in ' + MODAL_TRANSITION_MS + 'ms ' + MODAL_EASE,
      }}
      onClick={function () {
        if (closeOnOutside !== false && typeof onClose === 'function') onClose();
      }}
    >
      <div
        style={{
          background: modalBg,
          borderRadius: 18,
          padding: 20,
          width: '90%',
          maxWidth: cardMaxWidth,
          border: '1px solid var(--it-modal-border, #2D4057)',
          boxShadow: '0 24px 80px rgba(0,0,0,.45)',
          transform: isClosing ? 'scale(0.96) translateY(10px)' : 'scale(1) translateY(0)',
          opacity: isClosing ? 0 : 1,
          transition:
            'opacity ' + MODAL_TRANSITION_MS + 'ms ' + MODAL_EASE + ', transform ' +
            MODAL_TRANSITION_MS + 'ms ' + MODAL_EASE,
          animation: isClosing ? 'none' : 'it-dup-day-card-in ' + MODAL_TRANSITION_MS + 'ms ' + MODAL_EASE,
        }}
        onClick={function (e) { e.stopPropagation(); }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
