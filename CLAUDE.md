# 🧠 Proyecto: App de Entrenamiento

## 📦 Descripción general

Aplicación donde alumnos siguen rutinas por semanas, registran entrenamientos y se trackean PRs.

---

## 🏗️ Estructura

### Rutinas

* Tienen semanas
* Cada semana tiene días
* Cada día tiene ejercicios

### Progreso

* Se registra por sesión
* Incluye: ejercicio, sets, reps, kg, fecha, semana

### PRs

* Se calculan por ejercicio
* Se actualizan automáticamente
* Persisten en el tiempo

---

## ⚙️ Reglas clave

* Nunca romper relación rutina → semana → día
* Cada registro de progreso debe tener semana
* PRs no deben resetearse
* Progreso debe estar sincronizado con rutina

---

## 🚨 Errores a evitar

* No guardar semana en progreso
* Desincronizar rutina y progreso
* Sobrescribir PRs
* Cambiar estructura sin actualizar lógica

---

## 🎯 Objetivo

* Ver semana actual
* Ver progreso real
* Ver PRs correctamente

---

## 🧠 Nota para Claude

Priorizar:

* consistencia de datos
* fixes mínimos
* no romper estructura existente
