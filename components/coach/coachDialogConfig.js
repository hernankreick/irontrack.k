export function getCoachDialogModalConfig(coachDialog, msg, es) {
  var c = coachDialog || { t: 'none' };
  if (c.t === 'none') {
    return { tone: 'danger', title: '', message: '', subjectName: null, confirmLabel: msg('Aceptar', 'OK', 'OK'), useLogoutIcon: false };
  }
  if (c.t === 'deleteAlumno') {
    return {
      tone: 'danger',
      title: msg('Eliminar alumno', 'Delete student', 'Excluir aluno'),
      message: msg(
        'Esta acción no se puede deshacer. El alumno se eliminará definitivamente.',
        'This action cannot be undone. The athlete will be permanently removed.',
        'Esta ação não pode ser desfeita. O aluno será excluído permanentemente.'
      ),
      subjectName: c.a && (c.a.nombre || c.a.email),
      confirmLabel: msg('Eliminar', 'Delete', 'Excluir'),
      useLogoutIcon: false,
      loadingLabel: msg('Eliminando…', 'Removing…', 'Excluindo…'),
    };
  }
  if (c.t === 'clearProgress' && c.a) {
    return {
      tone: 'danger',
      title: msg('Limpiar historial de progreso', 'Clear progress history', 'Limpar histórico de progresso'),
      message: msg(
        'Esta acción eliminará los PRs, sesiones completadas, volumen, tonelaje y métricas de progreso de este alumno. La rutina asignada y los datos personales se mantendrán. Esta acción no se puede deshacer.',
        'This action will delete this athlete’s PRs, completed sessions, volume, tonnage, and progress metrics. The assigned routine and personal data will be kept. This action cannot be undone.',
        'Esta ação eliminará os PRs, sessões concluídas, volume, tonelagem e métricas de progresso deste aluno. A rotina atribuída e os dados pessoais serão mantidos. Esta ação não pode ser desfeita.'
      ),
      subjectName: c.a && (c.a.nombre || c.a.email),
      confirmLabel: msg('Limpiar historial', 'Clear history', 'Limpar histórico'),
      useLogoutIcon: false,
      loadingLabel: msg('Limpiando…', 'Clearing…', 'Limpando…'),
      requireAcknowledge: true,
      acknowledgeLabel: msg(
        'Entiendo que esta acción no se puede deshacer',
        'I understand this action cannot be undone',
        'Entendo que esta ação não pode ser desfeita'
      ),
    };
  }
  if (c.t === 'quitarRut') {
    return {
      tone: 'danger',
      title: msg('Quitar rutina', 'Remove routine', 'Remover rotina'),
      message: msg(
        'Esta acción no se puede deshacer. La rutina se desasignará y se eliminará del registro.',
        'This action cannot be undone. The routine will be unassigned and removed from the record.',
        'Esta ação não pode ser desfeita. A rotina será desatribuída e removida do registro.'
      ),
      subjectName: c.rutinaActiva && c.rutinaActiva.nombre,
      confirmLabel: msg('Quitar', 'Remove', 'Remover'),
      useLogoutIcon: false,
      loadingLabel: msg('Quitando…', 'Removing…', 'Removendo…'),
    };
  }
  if (c.t === 'resetWeek') {
    return {
      tone: 'caution',
      title: msg('Reiniciar semana', 'Reset week', 'Redefinir semana'),
      message: es
        ? '¿Reiniciar la semana actual? El alumno volverá a Día 1 de la semana ' + c.semanaCiclo + '.'
        : 'Reset the current week? The athlete will restart at Day 1 of week ' + c.semanaCiclo + '.',
      subjectName: null,
      confirmLabel: msg('Reiniciar', 'Reset', 'Redefinir'),
      useLogoutIcon: false,
      loadingLabel: msg('Aplicando…', 'Applying…', 'Aplicando…'),
    };
  }
  if (c.t === 'resetRoutine') {
    return {
      tone: 'caution',
      title: msg('Reiniciar rutina', 'Reset routine', 'Redefinir rotina'),
      message: msg(
        '¿Reiniciar la rutina completa? Se borrarán todas las sesiones y el progreso registrado de esta rutina, y el alumno quedará en Semana 4 para continuar entrenando.',
        'Reset the entire routine? All sessions and recorded progress for this routine will be deleted, and the athlete will be left at Week 4 to keep training.',
        'Redefinir a rotina completa? Todas as sessões e o progresso registrado desta rotina serão apagados, e o aluno ficará na Semana 4 para continuar treinando.'
      ),
      subjectName: c.a && (c.a.nombre || c.a.email),
      confirmLabel: msg('Reiniciar', 'Reset', 'Redefinir'),
      useLogoutIcon: false,
      loadingLabel: msg('Aplicando…', 'Applying…', 'Aplicando…'),
      requireAcknowledge: true,
      acknowledgeLabel: msg(
        'Entiendo que esta acción no se puede deshacer',
        'I understand this action cannot be undone',
        'Entendo que esta ação não pode ser desfeita'
      ),
    };
  }
  if (c.t === 'editAlum') {
    return {
      tone: 'neutral',
      title: msg('Editar alumno', 'Edit athlete', 'Editar aluno'),
      message: msg('Se abrirá el formulario para modificar email y contraseña del alumno.', 'A form will open to edit the athlete’s email and password.', 'O formulário será aberto para editar e-mail e senha do aluno.'),
      subjectName: c.a && (c.a.nombre || c.a.email),
      confirmLabel: msg('Continuar', 'Continue', 'Continuar'),
      useLogoutIcon: false,
      loadingLabel: msg('…', '…', '…'),
    };
  }
  if (c.t === 'goRoutines') {
    return {
      tone: 'neutral',
      title: msg('Abrir en Rutinas', 'Open in Routines', 'Abrir em Rotinas'),
      message: msg('Se abrirá la pestaña RUTINAS con esta rutina para editarla.', 'The Routines tab will open with this routine for editing.', 'A aba Rotinas abrirá com esta rotina para edição.'),
      subjectName: c.rutinaActiva && c.rutinaActiva.nombre,
      confirmLabel: msg('Abrir', 'Open', 'Abrir'),
      useLogoutIcon: false,
      loadingLabel: msg('…', '…', '…'),
    };
  }
  if (c.t === 'assignRut') {
    return {
      tone: 'caution',
      title: c.ex
        ? msg('Cambiar rutina asignada', 'Change assigned routine', 'Trocar rotina atribuída')
        : msg('Asignar rutina', 'Assign routine', 'Atribuir rotina'),
      message: c.assignMsg,
      subjectName: null,
      confirmLabel: msg('Confirmar', 'Confirm', 'Confirmar'),
      useLogoutIcon: false,
      loadingLabel: msg('Asignando…', 'Assigning…', 'Atribuindo…'),
    };
  }
  if (c.t === 'logout' || c.t === 'logoutSettings') {
    return {
      tone: 'neutral',
      title: msg('¿Cerrar sesión?', 'Log out?', 'Encerrar sessão?'),
      message: msg('Vas a salir y tendrás que volver a iniciar sesión.', "You'll sign out and will need to sign in again.", 'Você sairá e precisará entrar de novo.'),
      subjectName: null,
      confirmLabel: msg('Cerrar sesión', 'Log out', 'Sair'),
      useLogoutIcon: true,
      loadingLabel: msg('Cerrando…', 'Signing out…', 'Saindo…'),
    };
  }
  return { tone: 'danger', title: '', message: '', subjectName: null, confirmLabel: 'OK', useLogoutIcon: false, loadingLabel: '…' };
}
