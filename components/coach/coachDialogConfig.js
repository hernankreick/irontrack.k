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
        'Esta acción eliminará los PRs, sesiones completadas, volumen, tonelaje y métricas de progreso de este alumno. La rutina asignada y los datos personales se mantendrán. Las series que el alumno tenga sin sincronizar en su teléfono no volverán a subirse solas: quedarán en revisión. Esta acción no se puede deshacer.',
        'This action will delete this athlete’s PRs, completed sessions, volume, tonnage, and progress metrics. The assigned routine and personal data will be kept. Sets still unsynced on the athlete’s phone will not be uploaded again automatically: they will be kept for review. This action cannot be undone.',
        'Esta ação eliminará os PRs, sessões concluídas, volume, tonelagem e métricas de progresso deste aluno. A rotina atribuída e os dados pessoais serão mantidos. As séries ainda não sincronizadas no telefone do aluno não serão reenviadas automaticamente: ficarão em revisão. Esta ação não pode ser desfeita.'
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
  if (c.t === 'clearProgressSinVinculo' && c.a) {
    // D76-09: el alumno no tiene su cuenta de la app vinculada. Sin vinculo no puede recibir el sello nuevo del historial: todo lo que
    // registre despues del borrado quedaria en revision en su telefono. Si pidio el vinculo desde la app, se aprueba (verificado por el servidor).
    var sol = c.solicitud && c.solicitud.auth_uid ? c.solicitud : null;
    return {
      tone: 'danger',
      title: msg('Cuenta del alumno sin vincular', 'Athlete account not linked', 'Conta do aluno não vinculada'),
      message: sol
        ? msg(
          'La cuenta de este alumno todavía no está vinculada. Desde la app pidió vincular la cuenta ' + (sol.email || '') + '. Si es su cuenta, al confirmar se aprueba el vínculo y se limpia el historial.',
          'This athlete’s account is not linked yet. From the app they asked to link the account ' + (sol.email || '') + '. If it is their account, confirming approves the link and clears the history.',
          'A conta deste aluno ainda não está vinculada. Pelo app, ele pediu para vincular a conta ' + (sol.email || '') + '. Se for a conta dele, ao confirmar o vínculo é aprovado e o histórico é limpo.'
        )
        : msg(
          'La cuenta de este alumno todavía no está vinculada: pedile que inicie sesión en la app y volvé a intentar. Si limpiás igual, lo que registre después quedará en revisión en su teléfono hasta vincular la cuenta.',
          'This athlete’s account is not linked yet: ask them to sign in to the app and try again. If you clear anyway, whatever they log afterwards will stay for review on their phone until the account is linked.',
          'A conta deste aluno ainda não está vinculada: peça para ele entrar no app e tente novamente. Se você limpar mesmo assim, o que ele registrar depois ficará em revisão no telefone dele até vincular a conta.'
        ),
      subjectName: c.a.nombre || c.a.email,
      confirmLabel: sol
        ? msg('Vincular y limpiar', 'Link and clear', 'Vincular e limpar')
        : msg('Limpiar igual', 'Clear anyway', 'Limpar mesmo assim'),
      useLogoutIcon: false,
      loadingLabel: msg('Procesando…', 'Processing…', 'Processando…'),
      requireAcknowledge: true,
      acknowledgeLabel: sol
        ? msg('Confirmo que ' + (sol.email || 'esa') + ' es la cuenta de este alumno', 'I confirm ' + (sol.email || 'that') + ' is this athlete’s account', 'Confirmo que ' + (sol.email || 'essa') + ' é a conta deste aluno')
        : msg('Entiendo que esta acción no se puede deshacer', 'I understand this action cannot be undone', 'Entendo que esta ação não pode ser desfeita'),
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
    var semana = c.semanaCiclo;
    var base = es
      ? 'El alumno vuelve a empezar la Semana ' + semana + ' desde el Día 1. No se borra nada: las sesiones, series y récords ya registrados quedan en el historial, pero no cuentan como días completados de la semana reiniciada.'
      : 'The athlete starts Week ' + semana + ' again from Day 1. Nothing is deleted: sessions, sets and records already logged stay in the history, but they do not count as completed days of the restarted week.';
    return {
      tone: 'caution',
      title: msg('Reiniciar semana', 'Reset week', 'Redefinir semana'),
      message: c.aviso ? base + ' ' + c.aviso : base,
      subjectName: null,
      confirmLabel: msg('Reiniciar', 'Reset', 'Redefinir'),
      useLogoutIcon: false,
      loadingLabel: msg('Aplicando…', 'Applying…', 'Aplicando…'),
    };
  }
  if (c.t === 'resetRoutine') {
    // En la app real la ficha usa RoutineRestartModal (con opcion de cargas); este texto lo usa la demo de la ficha.
    return {
      tone: 'caution',
      title: msg('Reiniciar rutina', 'Reset routine', 'Redefinir rotina'),
      message: msg(
        'Vuelve a Semana 1, Día 1. No se borra nada: las sesiones, series y récords ya registrados quedan en el historial.',
        'Goes back to Week 1, Day 1. Nothing is deleted: sessions, sets and records already logged stay in the history.',
        'Volta para a Semana 1, Dia 1. Nada é apagado: sessões, séries e recordes já registrados ficam no histórico.'
      ),
      subjectName: c.a && (c.a.nombre || c.a.email),
      confirmLabel: msg('Reiniciar', 'Reset', 'Redefinir'),
      useLogoutIcon: false,
      loadingLabel: msg('Aplicando…', 'Applying…', 'Aplicando…'),
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
      compact: true,
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
