import { Eye, FilePlus, MessageSquare } from "lucide-react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

/** Metadatos visuales compartidos por accion rapida (gradientes, sombras). */
export const QUICK_VISUAL_DARK = {
  message: {
    gradient: "linear-gradient(152deg, #2563eb 0%, #3730a3 42%, #0f172a 88%)",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 6px 28px rgba(15,23,42,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
    shadowHover:
      "0 18px 48px rgba(37,99,235,0.35), 0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
    orbBg: "linear-gradient(165deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 100%)",
    orbBorder: "rgba(255,255,255,0.28)",
    orbShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
    Icon: MessageSquare,
    iconColor: "#ffffff",
    titleColor: "#ffffff",
    subColor: "rgba(255,255,255,0.72)",
    ctaColor: "rgba(255,255,255,0.58)",
    ctaBorder: "rgba(255,255,255,0.1)",
  },
  routine: {
    gradient: "linear-gradient(152deg, #7c3aed 0%, #5b21b6 40%, #0c0a12 88%)",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 6px 28px rgba(12,10,18,0.6), 0 2px 8px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.1)",
    shadowHover:
      "0 18px 48px rgba(124,58,237,0.38), 0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.16)",
    orbBg: "linear-gradient(165deg, rgba(255,255,255,0.2) 0%, rgba(167,139,250,0.12) 100%)",
    orbBorder: "rgba(196,181,253,0.35)",
    orbShadow: "0 4px 18px rgba(88,28,135,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
    Icon: FilePlus,
    iconColor: "#f5f3ff",
    titleColor: "#ffffff",
    subColor: "rgba(255,255,255,0.72)",
    ctaColor: "rgba(255,255,255,0.58)",
    ctaBorder: "rgba(255,255,255,0.1)",
  },
  review: {
    gradient: "linear-gradient(152deg, #059669 0%, #0d9488 38%, #022c22 88%)",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 6px 28px rgba(2,44,34,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
    shadowHover:
      "0 18px 48px rgba(16,185,129,0.32), 0 10px 28px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.15)",
    orbBg: "linear-gradient(165deg, rgba(255,255,255,0.2) 0%, rgba(52,211,153,0.12) 100%)",
    orbBorder: "rgba(110,231,183,0.35)",
    orbShadow: "0 4px 18px rgba(4,120,87,0.4), inset 0 1px 0 rgba(255,255,255,0.28)",
    Icon: Eye,
    iconColor: "#ecfdf5",
    titleColor: "#ffffff",
    subColor: "rgba(255,255,255,0.72)",
    ctaColor: "rgba(255,255,255,0.58)",
    ctaBorder: "rgba(255,255,255,0.1)",
  },
};

export const QUICK_VISUAL_LIGHT = {
  message: {
    gradient: "linear-gradient(152deg, #eff6ff 0%, #dbeafe 42%, #ffffff 92%)",
    border: "rgba(37,99,235,0.2)",
    shadow: "0 6px 24px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
    shadowHover: "0 14px 36px rgba(37,99,235,0.14), 0 8px 20px rgba(15,23,42,0.07)",
    orbBg: "linear-gradient(165deg, rgba(37,99,235,0.12) 0%, #ffffff 100%)",
    orbBorder: "rgba(37,99,235,0.28)",
    orbShadow: "0 2px 12px rgba(37,99,235,0.12)",
    Icon: MessageSquare,
    iconColor: "#2563eb",
    titleColor: "#0f172a",
    subColor: "rgba(15,23,42,0.58)",
    ctaColor: "rgba(37,99,235,0.85)",
    ctaBorder: "rgba(15,23,42,0.08)",
  },
  routine: {
    gradient: "linear-gradient(152deg, #f5f3ff 0%, #ede9fe 45%, #ffffff 92%)",
    border: "rgba(124,58,237,0.22)",
    shadow: "0 6px 24px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
    shadowHover: "0 14px 36px rgba(124,58,237,0.14), 0 8px 20px rgba(15,23,42,0.07)",
    orbBg: "linear-gradient(165deg, rgba(124,58,237,0.12) 0%, #ffffff 100%)",
    orbBorder: "rgba(124,58,237,0.3)",
    orbShadow: "0 2px 12px rgba(124,58,237,0.12)",
    Icon: FilePlus,
    iconColor: "#7c3aed",
    titleColor: "#0f172a",
    subColor: "rgba(15,23,42,0.58)",
    ctaColor: "rgba(124,58,237,0.88)",
    ctaBorder: "rgba(15,23,42,0.08)",
  },
  review: {
    gradient: "linear-gradient(152deg, #ecfdf5 0%, #d1fae5 42%, #ffffff 92%)",
    border: "rgba(5,150,105,0.22)",
    shadow: "0 6px 24px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
    shadowHover: "0 14px 36px rgba(5,150,105,0.14), 0 8px 20px rgba(15,23,42,0.07)",
    orbBg: "linear-gradient(165deg, rgba(16,185,129,0.12) 0%, #ffffff 100%)",
    orbBorder: "rgba(16,185,129,0.3)",
    orbShadow: "0 2px 12px rgba(16,185,129,0.12)",
    Icon: Eye,
    iconColor: "#059669",
    titleColor: "#0f172a",
    subColor: "rgba(15,23,42,0.58)",
    ctaColor: "rgba(5,150,105,0.9)",
    ctaBorder: "rgba(15,23,42,0.08)",
  },
};

export function buildQuickActions(lang, darkMode) {
  var v = darkMode !== false ? QUICK_VISUAL_DARK : QUICK_VISUAL_LIGHT;
  return [
    {
      action: "message",
      ...v.message,
      title: M(lang, "Enviar mensaje", "Send message", "Enviar mensagem"),
      sub: M(lang, "a tu equipo", "to your team", "à sua equipe"),
    },
    {
      action: "routine",
      ...v.routine,
      title: M(lang, "Crear rutina", "Create routine", "Criar rotina"),
      sub: M(lang, "personalizada", "custom", "personalizada"),
    },
    {
      action: "review",
      ...v.review,
      title: M(lang, "Revisar alumnos", "Review athletes", "Rever alunos"),
      sub: M(lang, "que necesitan atención", "who need attention", "que precisam de atenção"),
    },
  ];
}
