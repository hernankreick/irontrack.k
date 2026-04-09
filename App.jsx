import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Ic } from './components/Ic.jsx';
import { LogForm } from './components/LogForm.jsx';
import { RutinaView } from './components/RutinaView.jsx';
import { WorkoutScreen } from './components/WorkoutScreen.jsx';
import { Chat } from './components/Chat.jsx';
import { ChatFlotante } from './components/ChatFlotante.jsx';
import { useAlumnos } from './hooks/useAlumnos.js';
import { ROUTINE_TEMPLATES, instantiateTemplate, emptyDays, getTemplateById } from './lib/routineTemplates.js';
import { getYTVideoId } from './lib/getYTVideoId.js';
import { fmt, fmtP } from './lib/timeFormat.js';
import { generarSugerenciasAlumno } from './lib/sugerenciasAlumno.js';
import AtencionHoy from "./components/AtencionHoy/AtencionHoy";
import CoachDashboard from './components/CoachDashboard';


const PATS = {
  rodilla:  {label:"RODILLA",   labelEn:"KNEE",      color:"#22C55E", icon:"R"},
  empuje:   {label:"EMPUJE",    labelEn:"PUSH",      color:"#2563EB", icon:"E"},
  traccion: {label:"TRACCIÓN",  labelEn:"PULL",      color:"#2563EB", icon:"T"},
  bisagra:  {label:"BISAGRA",   labelEn:"HINGE",     color:"#60A5FA", icon:"B"},
  core:     {label:"CORE",      labelEn:"CORE",      color:"#8B9AB2", icon:"M"},
  movilidad:{label:"MOVILIDAD", labelEn:"MOBILITY",  color:"#22C55E", icon:"M"},
  cardio:   {label:"CARDIO",    labelEn:"CARDIO",    color:"#2563EB", icon:"C"},
  oly:      {label:"OLÍMPICO",  labelEn:"OLYMPIC",   color:"#60A5FA", icon:"O"},
};

const EX = [
  // ── CUADRICEPS ──────────────────────────────────────────────────────
  {id:"sq",     name:"Sentadilla con barra",           nameEn:"Barbell Squat",              pattern:"rodilla", muscle:"Cuadriceps",              equip:"Barra",       youtube:"https://www.youtube.com/watch?v=bEv6CCg2BC8"},
  {id:"gcsq",   name:"Sentadilla de copa",             nameEn:"Goblet Squat",               pattern:"rodilla", muscle:"Cuadriceps",              equip:"Kettlebell",  youtube:"https://www.youtube.com/watch?v=MxsFDhcyFyE"},
  {id:"bsq",    name:"Sentadilla bulgara",             nameEn:"Bulgarian Split Squat",      pattern:"rodilla", muscle:"Cuadriceps",              equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=2C-uNgKwPLE"},
  {id:"sumoq",  name:"Sentadilla sumo",                nameEn:"Sumo Squat",                 pattern:"rodilla", muscle:"Cuadriceps/Gluteos",      equip:"Barra",       youtube:"https://www.youtube.com/watch?v=U3HlEF_E9fo"},
  {id:"jsq",    name:"Sentadillas con salto",          nameEn:"Jump Squat",                 pattern:"rodilla", muscle:"Cuadriceps",              equip:"Libre",       youtube:"https://www.youtube.com/watch?v=YGGq0AE5Uyc"},
  {id:"lunge",  name:"Estocadas",                      nameEn:"Lunges",                     pattern:"rodilla", muscle:"Cuadriceps",              equip:"Libre",       youtube:"https://www.youtube.com/watch?v=QOVaHwm-Q6U"},
  {id:"rlunge", name:"Estocadas hacia atras",          nameEn:"Reverse Lunges",             pattern:"rodilla", muscle:"Cuadriceps",              equip:"Libre",       youtube:"https://www.youtube.com/watch?v=xrPteyQLGAo"},
  {id:"llunge", name:"Estocadas laterales",            nameEn:"Lateral Lunges",             pattern:"rodilla", muscle:"Cuadriceps/Abductores",   equip:"Libre",       youtube:"https://www.youtube.com/watch?v=gwWv7aPcD88"},
  {id:"boxup",  name:"Subidas al cajon",               nameEn:"Box Step Up",                pattern:"rodilla", muscle:"Cuadriceps",              equip:"Cajon",       youtube:"https://www.youtube.com/watch?v=dQqApCGd5Ss"},
  {id:"lboxup", name:"Subidas laterales al cajon",     nameEn:"Lateral Box Step Up",        pattern:"rodilla", muscle:"Cuadriceps/Gluteos",      equip:"Cajon",       youtube:"https://www.youtube.com/watch?v=JeB_wGPMqG0"},
  {id:"pistol", name:"Pistols",                        nameEn:"Pistol Squat",               pattern:"rodilla", muscle:"Cuadriceps",              equip:"Libre",       youtube:"https://www.youtube.com/watch?v=vq5-vdgJc0I"},
  {id:"skater", name:"Sentadilla skater",              nameEn:"Skater Squat",               pattern:"rodilla", muscle:"Cuadriceps",              equip:"Libre",       youtube:"https://www.youtube.com/watch?v=d4HQh5RwXoY"},
  {id:"legext", name:"Sillon de cuadriceps",           nameEn:"Leg Extension",              pattern:"rodilla", muscle:"Cuadriceps",              equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=YyvSfVjQeL0"},
  {id:"legext1",name:"Sillon de cuadriceps 1 pierna",  nameEn:"Single Leg Extension",       pattern:"rodilla", muscle:"Cuadriceps",              equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=YyvSfVjQeL0"},
  {id:"lp",     name:"Prensa piernas",                 nameEn:"Leg Press",                  pattern:"rodilla", muscle:"Cuadriceps/Gluteos",      equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=IZxyjW7MPJQ"},
  // ── ISQUIOS / GLUTEOS ────────────────────────────────────────────────
  {id:"dl",     name:"Peso muerto",                    nameEn:"Deadlift",                   pattern:"bisagra", muscle:"Isquios/Gluteos",         equip:"Barra",       youtube:"https://www.youtube.com/watch?v=op9kVnSso6Q"},
  {id:"rdl",    name:"Peso muerto rumano",             nameEn:"Romanian Deadlift",          pattern:"bisagra", muscle:"Isquios/Gluteos",         equip:"Barra",       youtube:"https://www.youtube.com/watch?v=JCXUYuzwNrM"},
  {id:"sldl",   name:"Peso muerto 1 pierna",           nameEn:"Single Leg Deadlift",        pattern:"bisagra", muscle:"Isquios/Gluteos",         equip:"Mancuerna",   youtube:"https://www.youtube.com/watch?v=FIEkFESFOkQ"},
  {id:"sumodl", name:"Peso muerto sumo",               nameEn:"Sumo Deadlift",              pattern:"bisagra", muscle:"Isquios/Gluteos/Abduct",  equip:"Barra",       youtube:"https://www.youtube.com/watch?v=WBPvQMBePGs"},
  {id:"hip",    name:"Hip thrust",                     nameEn:"Hip Thrust",                 pattern:"bisagra", muscle:"Gluteos",                 equip:"Barra",       youtube:"https://www.youtube.com/watch?v=xDmFkJxPzeM"},
  {id:"hip1",   name:"Hip thrust a una pierna",        nameEn:"Single Leg Hip Thrust",      pattern:"bisagra", muscle:"Gluteos",                 equip:"Barra",       youtube:"https://www.youtube.com/watch?v=pq6WHjzOkl8"},
  {id:"kbswing",name:"Swing con KB",                   nameEn:"Kettlebell Swing",           pattern:"bisagra", muscle:"Gluteos/Isquios",         equip:"Kettlebell",  youtube:"https://www.youtube.com/watch?v=YSxHifyI6s8"},
  {id:"nordic", name:"Nordicos",                       nameEn:"Nordic Curl",                pattern:"bisagra", muscle:"Isquios",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=d8AAPMBqWFk"},
  {id:"bridge", name:"Puente de gluteos",              nameEn:"Glute Bridge",               pattern:"bisagra", muscle:"Gluteos",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=OUgsJ8-Vi0E"},
  {id:"bridge1",name:"Puente de gluteos 1 pierna",     nameEn:"Single Leg Glute Bridge",    pattern:"bisagra", muscle:"Gluteos",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=qMKYfZOCNeg"},
  {id:"fbcurl", name:"Curl femoral con fitball",       nameEn:"Fitball Leg Curl",           pattern:"bisagra", muscle:"Isquios",                 equip:"Fitball",     youtube:"https://www.youtube.com/watch?v=Xy97Q3bB3xc"},
  {id:"seathc", name:"Femorales sentado",              nameEn:"Seated Leg Curl",            pattern:"bisagra", muscle:"Isquios",                 equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=1Tq3QdYUuHs"},
  {id:"lc",     name:"Camilla de isquios",             nameEn:"Lying Leg Curl",             pattern:"bisagra", muscle:"Isquios",                 equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=ELOCsoDSmrg"},
  {id:"calf",   name:"Pantorrillas",                   nameEn:"Calf Raise",                 pattern:"bisagra", muscle:"Gemelos",                 equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=-M4-G8p1fCI"},
  // ── EMPUJE ───────────────────────────────────────────────────────────
  {id:"bp",     name:"Press de banca",                 nameEn:"Bench Press",                pattern:"empuje",  muscle:"Pecho",                   equip:"Barra",       youtube:"https://www.youtube.com/watch?v=SCVCLChPQFY"},
  {id:"dbp",    name:"Press de banca con mancuernas",  nameEn:"Dumbbell Bench Press",       pattern:"empuje",  muscle:"Pecho",                   equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=QsYre__-aro"},
  {id:"dbp1",   name:"Press de banca mancuerna 1 brazo",nameEn:"Single Arm DB Bench Press", pattern:"empuje",  muscle:"Pecho",                   equip:"Mancuerna",   youtube:"https://www.youtube.com/watch?v=1rHZQPOJMz4"},
  {id:"ibp",    name:"Press inclinado con barra",      nameEn:"Incline Barbell Press",      pattern:"empuje",  muscle:"Pecho alto",              equip:"Barra",       youtube:"https://www.youtube.com/watch?v=DbFgADa2PL8"},
  {id:"idbp",   name:"Press inclinado con mancuernas", nameEn:"Incline Dumbbell Press",     pattern:"empuje",  muscle:"Pecho alto",              equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=8iPEnn-ltC8"},
  {id:"ohp",    name:"Press de hombros con barra",     nameEn:"Barbell Overhead Press",     pattern:"empuje",  muscle:"Hombro",                  equip:"Barra",       youtube:"https://www.youtube.com/watch?v=2yjwXTZQDDI"},
  {id:"arnold", name:"Press Arnold",                   nameEn:"Arnold Press",               pattern:"empuje",  muscle:"Hombro",                  equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=6Z15_WdXmVw"},
  {id:"mohpm",  name:"Press de hombros en maquina",    nameEn:"Machine Shoulder Press",     pattern:"empuje",  muscle:"Hombro",                  equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=Wqq43dKW1TU"},
  {id:"uohp",   name:"Press hombros unilateral",       nameEn:"Unilateral Shoulder Press",  pattern:"empuje",  muscle:"Hombro",                  equip:"Mancuerna",   youtube:"https://www.youtube.com/watch?v=UMSIITSREt0"},
  {id:"kuohp",  name:"Press hombros unilateral arrodillado",nameEn:"Half Kneeling Press",   pattern:"empuje",  muscle:"Hombro/Core",             equip:"Mancuerna",   youtube:"https://www.youtube.com/watch?v=cKJq3dNNIr4"},
  {id:"land",   name:"Press landmine",                 nameEn:"Landmine Press",             pattern:"empuje",  muscle:"Hombro/Pecho",            equip:"Barra",       youtube:"https://www.youtube.com/watch?v=cayxFfn9SkU"},
  {id:"late",   name:"Vuelos laterales",               nameEn:"Lateral Raise",              pattern:"empuje",  muscle:"Hombro lateral",          equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=3VcKaXpzqRo"},
  {id:"ffr",    name:"Vuelos frontales",               nameEn:"Front Raise",                pattern:"empuje",  muscle:"Hombro frontal",          equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=sON2s2l-Tks"},
  {id:"tric",   name:"Triceps en polea con soga",      nameEn:"Triceps Rope Pushdown",      pattern:"empuje",  muscle:"Triceps",                 equip:"Polea",       youtube:"https://www.youtube.com/watch?v=vB5OHsJ3EME"},
  {id:"tric2",  name:"Triceps tras nuca en polea",     nameEn:"Overhead Triceps Extension", pattern:"empuje",  muscle:"Triceps",                 equip:"Polea",       youtube:"https://www.youtube.com/watch?v=_gsUck-7M74"},
  {id:"tric3",  name:"Patada de burro en polea",       nameEn:"Cable Kickback",             pattern:"empuje",  muscle:"Triceps",                 equip:"Polea",       youtube:"https://www.youtube.com/watch?v=l3WwE4K2TCA"},
  {id:"tric4",  name:"Triceps tras nuca con soga",     nameEn:"Rope Overhead Extension",    pattern:"empuje",  muscle:"Triceps",                 equip:"Polea",       youtube:"https://www.youtube.com/watch?v=_gsUck-7M74"},
  {id:"tric5",  name:"Triceps frances con mancuernas", nameEn:"French Press",               pattern:"empuje",  muscle:"Triceps",                 equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=ir5PsbniVSc"},
  {id:"bankdip",name:"Fondos en banco",                nameEn:"Bench Dip",                  pattern:"empuje",  muscle:"Triceps/Pecho",           equip:"Banco",       youtube:"https://www.youtube.com/watch?v=c3ZGl4pAwZ4"},
  {id:"dip",    name:"Fondos en paralelas",            nameEn:"Parallel Bar Dip",           pattern:"empuje",  muscle:"Pecho/Triceps",           equip:"Paralelas",   youtube:"https://www.youtube.com/watch?v=2z8JmcrW-As"},
  {id:"pushup", name:"Push up",                        nameEn:"Push Up",                    pattern:"empuje",  muscle:"Pecho/Triceps",           equip:"Libre",       youtube:"https://www.youtube.com/watch?v=IODxDxX7oi4"},
  // ── TRACCION ─────────────────────────────────────────────────────────
  {id:"row",    name:"Remo con barra",                 nameEn:"Barbell Row",                pattern:"traccion",muscle:"Espalda",                 equip:"Barra",       youtube:"https://www.youtube.com/watch?v=FWJR5Ve8bnQ"},
  {id:"prow",   name:"Remo pendlay",                   nameEn:"Pendlay Row",                pattern:"traccion",muscle:"Espalda",                 equip:"Barra",       youtube:"https://www.youtube.com/watch?v=RA0Ly0eAaok"},
  {id:"irow",   name:"Remo en banco inclinado",        nameEn:"Incline Dumbbell Row",       pattern:"traccion",muscle:"Espalda",                 equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=uiizbEDPFPU"},
  {id:"dbrow",  name:"Remo serrucho",                  nameEn:"Single Arm Dumbbell Row",    pattern:"traccion",muscle:"Espalda",                 equip:"Mancuerna",   youtube:"https://www.youtube.com/watch?v=pYcpY20QaE8"},
  {id:"ringrow",name:"Remo en anillas",                nameEn:"Ring Row",                   pattern:"traccion",muscle:"Espalda",                 equip:"Anillas",     youtube:"https://www.youtube.com/watch?v=LDzSk9MNEo4"},
  {id:"cabrow", name:"Remo bajo en maquina",           nameEn:"Seated Cable Row",           pattern:"traccion",muscle:"Espalda",                 equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=GZbfZ033f74"},
  {id:"uprow",  name:"Remo alto en dorsalera",         nameEn:"High Cable Row",             pattern:"traccion",muscle:"Espalda alta",            equip:"Polea",       youtube:"https://www.youtube.com/watch?v=HKSsG2lhLas"},
  {id:"lat",    name:"Jalon al pecho prono",           nameEn:"Lat Pulldown",               pattern:"traccion",muscle:"Dorsal",                  equip:"Polea",       youtube:"https://www.youtube.com/watch?v=CAwf7n6Luuc"},
  {id:"lats",   name:"Jalon al pecho supino",          nameEn:"Supinated Lat Pulldown",     pattern:"traccion",muscle:"Dorsal",                  equip:"Polea",       youtube:"https://www.youtube.com/watch?v=lueE_MBAhHo"},
  {id:"pu",     name:"Dominadas pronas",               nameEn:"Pull Up",                    pattern:"traccion",muscle:"Dorsal",                  equip:"Barra",       youtube:"https://www.youtube.com/watch?v=eGo4IYlbE5g"},
  {id:"pusu",   name:"Dominadas supinas",              nameEn:"Chin Up",                    pattern:"traccion",muscle:"Dorsal/Biceps",           equip:"Barra",       youtube:"https://www.youtube.com/watch?v=a5-tWfJDUQo"},
  {id:"punu",   name:"Dominadas neutras",              nameEn:"Neutral Grip Pull Up",       pattern:"traccion",muscle:"Dorsal",                  equip:"Barra",       youtube:"https://www.youtube.com/watch?v=rB-KMkRXN4E"},
  {id:"hammer", name:"Remo hammer",                    nameEn:"Hammer Row",                 pattern:"traccion",muscle:"Dorsal/Biceps",           equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=vVnXRJLFKyQ"},
  {id:"uproww", name:"Remo al menton con barra W",     nameEn:"Upright Row",                pattern:"traccion",muscle:"Trapecio/Hombro",         equip:"Barra W",     youtube:"https://www.youtube.com/watch?v=Hceg1MfOiJ0"},
  {id:"vertm",  name:"Maquina traccion vertical",      nameEn:"Vertical Traction Machine",  pattern:"traccion",muscle:"Dorsal",                  equip:"Maquina",     youtube:"https://www.youtube.com/watch?v=CAwf7n6Luuc"},
  {id:"pullover",name:"Pull over en polea",            nameEn:"Cable Pullover",             pattern:"traccion",muscle:"Dorsal",                  equip:"Polea",       youtube:"https://www.youtube.com/watch?v=s9SQSGkHiBI"},
  {id:"revfly", name:"Vuelos posteriores sentado",     nameEn:"Reverse Fly",                pattern:"traccion",muscle:"Hombro posterior",        equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=TXYnAEDiOX4"},
  {id:"urow",   name:"Remo en polea unilateral",       nameEn:"Single Arm Cable Row",       pattern:"traccion",muscle:"Espalda",                 equip:"Polea",       youtube:"https://www.youtube.com/watch?v=YxJHBaGsXKI"},
  {id:"curl",   name:"Curl de biceps",                 nameEn:"Bicep Curl",                 pattern:"traccion",muscle:"Biceps",                  equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=ykJmrZ5v0Oo"},
  {id:"bcurl",  name:"Curl de biceps con barra W",     nameEn:"EZ Bar Curl",                pattern:"traccion",muscle:"Biceps",                  equip:"Barra W",     youtube:"https://www.youtube.com/watch?v=5OtWwT_EWQU"},
  {id:"hcurl",  name:"Biceps martillo",                nameEn:"Hammer Curl",                pattern:"traccion",muscle:"Biceps/Braquial",         equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=zC3nLlEvin4"},
  {id:"ccurl",  name:"Biceps concentrado",             nameEn:"Concentration Curl",         pattern:"traccion",muscle:"Biceps",                  equip:"Mancuerna",   youtube:"https://www.youtube.com/watch?v=Jvj2wV0vOFU"},
  {id:"pcurl",  name:"Biceps en polea",                nameEn:"Cable Curl",                 pattern:"traccion",muscle:"Biceps",                  equip:"Polea",       youtube:"https://www.youtube.com/watch?v=V8dZ3pyiCBo"},
  // ── CORE ─────────────────────────────────────────────────────────────
  {id:"plank",  name:"Plancha",                        nameEn:"Plank",                      pattern:"core",    muscle:"Core",                    equip:"Libre",       youtube:"https://www.youtube.com/watch?v=pSHjTRCQxIw"},
  {id:"plankl", name:"Plancha lateral",                nameEn:"Side Plank",                 pattern:"core",    muscle:"Core/Oblicuos",           equip:"Libre",       youtube:"https://www.youtube.com/watch?v=K2VljzCC16g"},
  {id:"ab",     name:"Abdominales",                    nameEn:"Crunches",                   pattern:"core",    muscle:"Core",                    equip:"Libre",       youtube:"https://www.youtube.com/watch?v=Xyd_fa5zoEU"},
  {id:"crunch", name:"Crunch en polea",                nameEn:"Cable Crunch",               pattern:"core",    muscle:"Core",                    equip:"Polea",       youtube:"https://www.youtube.com/watch?v=TSHCc2jJRgQ"},
  {id:"drgflag",name:"Dragon flag",                    nameEn:"Dragon Flag",                pattern:"core",    muscle:"Core",                    equip:"Banco",       youtube:"https://www.youtube.com/watch?v=pvz7k5gO-DE"},
  {id:"hollow", name:"Hollow body",                    nameEn:"Hollow Body Hold",           pattern:"core",    muscle:"Core",                    equip:"Libre",       youtube:"https://www.youtube.com/watch?v=LlDNef_Ztsc"},
  {id:"pallof", name:"Pallof press",                   nameEn:"Pallof Press",               pattern:"core",    muscle:"Core/Oblicuos",           equip:"Polea",       youtube:"https://www.youtube.com/watch?v=AH_QZLm_0-s"},
  {id:"lgrlwk", name:"Farmer walk",                    nameEn:"Farmer Walk",                pattern:"core",    muscle:"Core/Trapecio",           equip:"Mancuernas",  youtube:"https://www.youtube.com/watch?v=Fkzk_RqlYig"},
  {id:"abwheel",name:"Rueda abdominal",                nameEn:"Ab Wheel Rollout",           pattern:"core",    muscle:"Core",                    equip:"Rueda",       youtube:"https://www.youtube.com/watch?v=jhD4Udjk37Y"},
  // ── MOVILIDAD ────────────────────────────────────────────────────────
  {id:"hipflex",name:"Flexibilidad de cadera",         nameEn:"Hip Flexor Stretch",         pattern:"movilidad",muscle:"Cadera",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=gRNQDXe0NKY"},
  {id:"t90",    name:"T90",                            nameEn:"90/90 Hip Stretch",          pattern:"movilidad",muscle:"Cadera",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=SnMvFQiKOT0"},
  {id:"pigdov", name:"Paloma",                         nameEn:"Pigeon Pose",                pattern:"movilidad",muscle:"Gluteo/Cadera",          equip:"Libre",       youtube:"https://www.youtube.com/watch?v=24Ej7YmBWBQ"},
  {id:"thspin", name:"Rotacion toracica",              nameEn:"Thoracic Rotation",          pattern:"movilidad",muscle:"Columna",                equip:"Libre",       youtube:"https://www.youtube.com/watch?v=GnHVcVMFoLQ"},
  {id:"catrec", name:"Cat camel",                      nameEn:"Cat Camel",                  pattern:"movilidad",muscle:"Columna",                equip:"Libre",       youtube:"https://www.youtube.com/watch?v=kqnua4rHVVA"},
  {id:"shcir",  name:"Circunducciones de hombro",      nameEn:"Shoulder Circles",           pattern:"movilidad",muscle:"Hombro",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=4_DGiGb7XoM"},
  {id:"ankmob", name:"Movilidad de tobillo",           nameEn:"Ankle Mobility",             pattern:"movilidad",muscle:"Tobillo",                equip:"Libre",       youtube:"https://www.youtube.com/watch?v=idDnIQFHE7s"},
  {id:"wrstretch",name:"Estiramiento de muneca",       nameEn:"Wrist Stretch",              pattern:"movilidad",muscle:"Muneca",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=mSZWSQSSEjE"},
  // ── CARDIO ───────────────────────────────────────────────────────────
  {id:"run",    name:"Trote",                          nameEn:"Jog",                        pattern:"cardio",  muscle:"General",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=_kGESn8ArrU"},
  {id:"bike",   name:"Bicicleta",                      nameEn:"Cycling",                    pattern:"cardio",  muscle:"General",                 equip:"Bicicleta",   youtube:"https://www.youtube.com/watch?v=5yjr7tbpOVQ"},
  {id:"row_c",  name:"Remo ergometro",                 nameEn:"Rowing Machine",             pattern:"cardio",  muscle:"General",                 equip:"Remo",        youtube:"https://www.youtube.com/watch?v=H0r_Ql5F4lk"},
  {id:"skip",   name:"Skipping",                       nameEn:"High Knees",                 pattern:"cardio",  muscle:"General",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=8opcQdC-V-U"},
  {id:"burpee", name:"Burpees",                        nameEn:"Burpees",                    pattern:"cardio",  muscle:"General",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=auBLPXO8Fww"},
  {id:"jump",   name:"Saltos",                         nameEn:"Box Jumps",                  pattern:"cardio",  muscle:"General",                 equip:"Libre",       youtube:"https://www.youtube.com/watch?v=NBY9-kTuHEk"},
  {id:"rope",   name:"Soga",                           nameEn:"Jump Rope",                  pattern:"cardio",  muscle:"General",                 equip:"Soga",        youtube:"https://www.youtube.com/watch?v=FJmRQ5iTXKE"},
  // ── OLIMPICOS ────────────────────────────────────────────────────────
  {id:"snatch", name:"Arranque",                       nameEn:"Snatch",                     pattern:"oly",     muscle:"Cuerpo completo",         equip:"Barra",       youtube:"https://www.youtube.com/watch?v=9xQp2sldyts"},
  {id:"hsnatch",name:"Arranque de colgado",            nameEn:"Hang Snatch",                pattern:"oly",     muscle:"Cuerpo completo",         equip:"Barra",       youtube:"https://www.youtube.com/watch?v=6QKMrArRa7s"},
  {id:"clean",  name:"Cargada",                        nameEn:"Power Clean",                pattern:"oly",     muscle:"Cuerpo completo",         equip:"Barra",       youtube:"https://www.youtube.com/watch?v=KjGvwQl8tis"},
  {id:"cjerk",  name:"Cargada y envion",               nameEn:"Clean and Jerk",             pattern:"oly",     muscle:"Cuerpo completo",         equip:"Barra",       youtube:"https://www.youtube.com/watch?v=6IYzFwHDEik"},
  {id:"ppres",  name:"Push press",                     nameEn:"Push Press",                 pattern:"oly",     muscle:"Hombro/Triceps",          equip:"Barra",       youtube:"https://www.youtube.com/watch?v=X6-DMh-t4nQ"},
  {id:"core_bicho_muerto_disco", name:"Bicho muerto con disco",       nameEn:"Dead Bug with Plate",         pattern:"core", muscle:"Core/Abdomen",   equip:"Disco",      youtube:"https://www.youtube.com/watch?v=9tKE-VKwJDM"},
  {id:"core_twist_ruso_disco",   name:"Twist ruso con disco",          nameEn:"Russian Twist with Plate",    pattern:"core", muscle:"Oblicuos",       equip:"Disco",      youtube:"https://www.youtube.com/watch?v=JyUqwkVpsi8"},
  {id:"core_clam_shell",         name:"Clam shell",                    nameEn:"Clamshell",                   pattern:"core", muscle:"Gluteo medio",   equip:"Colchoneta", youtube:"https://www.youtube.com/watch?v=ZWQMhBVBo8c"},
  {id:"core_abs_paralelas_ext",  name:"Abs en paralelas piernas ext.", nameEn:"Hanging Leg Raise Straight",  pattern:"core", muscle:"Abdomen",        equip:"Paralelas",  youtube:"https://www.youtube.com/watch?v=OXkuOGMDJBA"},
  {id:"core_abs_paralelas_flex", name:"Abs en paralelas piernas flex.",nameEn:"Hanging Knee Raise",          pattern:"core", muscle:"Abdomen",        equip:"Paralelas",  youtube:"https://www.youtube.com/watch?v=XD2_MQULM0E"},
  {id:"core_remo_renegado",      name:"Remo renegado",                 nameEn:"Renegade Row",                pattern:"core", muscle:"Core/Espalda",   equip:"Mancuernas", youtube:"https://www.youtube.com/watch?v=ZWQMhBVBo8c"},
  {id:"core_revolver_olla",      name:"Revolver la olla",              nameEn:"Stir the Pot",                pattern:"core", muscle:"Core",           equip:"Fitball",    youtube:"https://www.youtube.com/watch?v=DHabp9nVFmc"},
  {id:"core_plancha_rkc",        name:"Plancha RKC",                   nameEn:"RKC Plank",                   pattern:"core", muscle:"Core",           equip:"Colchoneta", youtube:"https://www.youtube.com/watch?v=44ScXWFaVBs"},
  {id:"core_plancha_const",      name:"Plancha construcciones",        nameEn:"Plank Build-Ups",             pattern:"core", muscle:"Core",           equip:"Colchoneta", youtube:"https://www.youtube.com/watch?v=DHabp9nVFmc"},
  {id:"core_plancha_3ap",        name:"Plancha 3 apoyos",              nameEn:"3-Point Plank",               pattern:"core", muscle:"Core",           equip:"Colchoneta", youtube:"https://www.youtube.com/watch?v=yeKv5ML5_hU"},
  {id:"core_espinales_colch",    name:"Espinales en colchoneta",       nameEn:"Back Extensions on Mat",      pattern:"core", muscle:"Espinales",      equip:"Colchoneta", youtube:"https://www.youtube.com/watch?v=ph3pMQ6rEp8"},
  {id:"core_espinales_banco45",  name:"Espinales en banco 45",         nameEn:"Back Extensions 45°",         pattern:"core", muscle:"Espinales",      equip:"Banco 45",   youtube:"https://www.youtube.com/watch?v=ph3pMQ6rEp8"},
  {id:"core_espinales_cruzados", name:"Espinales cruzados",            nameEn:"Twisting Back Extensions",   pattern:"core", muscle:"Espinales",      equip:"Banco 45",   youtube:"https://www.youtube.com/watch?v=ph3pMQ6rEp8"},
  {id:"core_bird_dog",           name:"Bird dog",                      nameEn:"Bird Dog",                    pattern:"core", muscle:"Core/Estabilidad",equip:"Colchoneta", youtube:"https://www.youtube.com/watch?v=wiFNA3sqjCA"},
];

const VIDEOS = {
  "sq":    "https://youtu.be/-bJIpOq-LWk",
  "lp":    "https://www.youtube.com/results?search_query=prensa+piernas+tecnica+shorts",
  "lunge": "https://www.youtube.com/results?search_query=zancada+tecnica+tutorial+shorts",
  "dl":    "https://www.youtube.com/results?search_query=peso+muerto+tecnica+tutorial+shorts",
  "rdl":   "https://www.youtube.com/results?search_query=peso+muerto+rumano+tecnica+shorts",
  "hcurl": "https://www.youtube.com/results?search_query=curl+femoral+tecnica+shorts",
  "hip":   "https://www.youtube.com/results?search_query=hip+thrust+tecnica+tutorial+shorts",
  "calf":  "https://www.youtube.com/results?search_query=pantorrillas+gemelos+tecnica+shorts",
  "bp":    "https://www.youtube.com/results?search_query=press+banca+tecnica+tutorial+shorts",
  "ibp":   "https://www.youtube.com/results?search_query=press+inclinado+banca+tecnica+shorts",
  "dbp":   "https://www.youtube.com/results?search_query=press+mancuernas+pecho+tecnica+shorts",
  "fly":   "https://www.youtube.com/results?search_query=aperturas+pecho+mancuernas+tecnica+shorts",
  "ohp":   "https://www.youtube.com/results?search_query=press+militar+hombros+tecnica+shorts",
  "late":  "https://www.youtube.com/results?search_query=elevaciones+laterales+hombro+tecnica+shorts",
  "dip":   "https://www.youtube.com/results?search_query=fondos+paralelas+triceps+tecnica+shorts",
  "tpush": "https://www.youtube.com/results?search_query=extension+triceps+polea+tecnica+shorts",
  "pu":    "https://www.youtube.com/results?search_query=dominadas+tecnica+tutorial+shorts",
  "row":   "https://www.youtube.com/results?search_query=remo+barra+espalda+tecnica+shorts",
  "crow":  "https://www.youtube.com/results?search_query=remo+polea+cable+tecnica+shorts",
  "lat":   "https://www.youtube.com/results?search_query=jalon+pecho+dorsal+tecnica+shorts",
  "facep": "https://www.youtube.com/results?search_query=face+pull+hombro+posterior+tecnica+shorts",
  "curl":  "https://www.youtube.com/results?search_query=curl+biceps+mancuernas+tecnica+shorts",
  "plank": "https://www.youtube.com/results?search_query=plancha+core+tecnica+tutorial+shorts",
  "crunch":"https://www.youtube.com/results?search_query=crunch+abdominal+tecnica+shorts",
  "legr":  "https://www.youtube.com/results?search_query=elevacion+piernas+abdominales+tecnica+shorts",
  "mob1":  "https://www.youtube.com/results?search_query=movilidad+cadera+ejercicios+shorts",
  "mob2":  "https://www.youtube.com/results?search_query=movilidad+toracica+columna+ejercicios+shorts",
  "suppu": "https://www.youtube.com/results?search_query=dominadas+supinas+chin+up+tecnica+shorts",
  "hammer":"https://www.youtube.com/results?search_query=curl+martillo+biceps+tecnica+shorts",
  "legcurl":"https://www.youtube.com/results?search_query=sillon+isquios+curl+femoral+maquina+shorts",
  "legext":"https://www.youtube.com/results?search_query=sillon+cuadriceps+extension+maquina+shorts",
  "trico": "https://www.youtube.com/results?search_query=triceps+polea+pushdown+tecnica+shorts",
  "lateralfly":"https://www.youtube.com/results?search_query=vuelos+laterales+hombro+tecnica+shorts",
  "trot1": "https://www.youtube.com/results?search_query=rotacion+toracica+suelo+movilidad+shorts",
  "trot2": "https://www.youtube.com/results?search_query=rotacion+toracica+cuadrupedia+movilidad+shorts",
  "trot3": "https://www.youtube.com/results?search_query=foam+roller+columna+toracica+movilidad+shorts",
  "trot4": "https://www.youtube.com/results?search_query=rotacion+toracica+banda+elastica+shorts",
  "hipm1": "https://www.youtube.com/results?search_query=90+90+movilidad+cadera+ejercicio+shorts",
  "hipm2": "https://www.youtube.com/results?search_query=apertura+cadera+banda+elastica+movilidad+shorts",
  "hipm3": "https://www.youtube.com/results?search_query=estocada+movilidad+cadera+flexor+shorts",
  "hipm4": "https://www.youtube.com/results?search_query=mariposa+dinamica+aductores+cadera+shorts",
  "shom1": "https://www.youtube.com/results?search_query=rotacion+hombro+banda+manguito+rotador+shorts",
  "shom2": "https://www.youtube.com/results?search_query=dislocaciones+hombro+banda+movilidad+shorts",
  "shom3": "https://www.youtube.com/results?search_query=pass+through+palo+movilidad+hombros+shorts",
  "shom4": "https://www.youtube.com/results?search_query=apertura+pecho+banda+hombros+movilidad+shorts",
  "ankm1": "https://www.youtube.com/results?search_query=movilidad+tobillo+pared+ejercicio+shorts",
  "ankm2": "https://www.youtube.com/results?search_query=movilidad+tobillo+banda+elastica+shorts",
  "ankm3": "https://www.youtube.com/results?search_query=circulos+tobillo+movilidad+shorts",
  "ankm4": "https://www.youtube.com/results?search_query=sentadilla+tobillo+movilidad+shorts",
  "plank2":  "https://www.youtube.com/results?search_query=plancha+lateral+oblicuos+tecnica+shorts",
  "plank3":  "https://www.youtube.com/results?search_query=RKC+plank+tecnica+core+shorts",
  "hollow":  "https://www.youtube.com/results?search_query=hollow+hold+abdominales+tecnica+shorts",
  "abwheel": "https://www.youtube.com/results?search_query=rueda+abdominal+rollout+tecnica+shorts",
  "deadbug": "https://www.youtube.com/results?search_query=dead+bug+core+estabilizacion+shorts",
  "pallof":  "https://www.youtube.com/results?search_query=pallof+press+core+anti+rotacion+shorts",
  "mtnclmb": "https://www.youtube.com/results?search_query=mountain+climber+core+cardio+tecnica+shorts",
  "vup":     "https://www.youtube.com/results?search_query=v+up+abdominales+tecnica+shorts",
  "russtwist":"https://www.youtube.com/results?search_query=russian+twist+oblicuos+tecnica+shorts",
  "situp":   "https://www.youtube.com/results?search_query=sit+up+abdominales+tecnica+shorts",
  "tobar":   "https://www.youtube.com/results?search_query=toes+to+bar+core+tecnica+shorts",
  "woodchop":"https://www.youtube.com/results?search_query=hacha+banda+oblicuos+woodchop+shorts",
  "dragoncurl":"https://www.youtube.com/results?search_query=dragon+flag+core+avanzado+shorts",
  "bgoodmorn":"https://www.youtube.com/results?search_query=buenos+dias+banda+lumbar+core+shorts",
  "curlconc": "https://www.youtube.com/results?search_query=curl+concentrado+biceps+tecnica+shorts",
  "curlpolea":"https://www.youtube.com/results?search_query=curl+biceps+polea+cable+tecnica+shorts",
  "curlw":    "https://www.youtube.com/results?search_query=curl+barra+w+ez+biceps+tecnica+shorts",
  "kickback": "https://www.youtube.com/results?search_query=patada+burro+triceps+mancuerna+tecnica+shorts",
  "rearfly":  "https://www.youtube.com/results?search_query=vuelos+posteriores+banco+hombro+tecnica+shorts",
  "pendlay":  "https://www.youtube.com/results?search_query=remo+pendlay+barra+tecnica+shorts",
  "serrucho": "https://www.youtube.com/results?search_query=remo+serrucho+mancuerna+espalda+tecnica+shorts",
  "remoalto": "https://www.youtube.com/results?search_query=remo+alto+polea+cable+espalda+tecnica+shorts",
};

const IMGS = {
  "sq":    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Squats.png/320px-Squats.png",
  "lp":    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Leg_press.jpg/320px-Leg_press.jpg",
  "lunge": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Lunges.jpg/320px-Lunges.jpg",
  "dl":    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Deadlift_form.jpg/320px-Deadlift_form.jpg",
  "rdl":   "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Romanian_deadlift.jpg/320px-Romanian_deadlift.jpg",
  "hcurl": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Leg_curl.jpg/320px-Leg_curl.jpg",
  "hip":   "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Hip_thrust.jpg/320px-Hip_thrust.jpg",
  "calf":  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Calf_raise.jpg/320px-Calf_raise.jpg",
  "bp":    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Bench_press_2.jpg/320px-Bench_press_2.jpg",
  "ibp":   "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Incline_bench_press.jpg/320px-Incline_bench_press.jpg",
  "dbp":   "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Dumbbell_bench_press.jpg/320px-Dumbbell_bench_press.jpg",
  "fly":   "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Dumbbell_fly.jpg/320px-Dumbbell_fly.jpg",
  "ohp":   "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Overhead_press.jpg/320px-Overhead_press.jpg",
  "late":  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Lateral_raise.jpg/320px-Lateral_raise.jpg",
  "dip":   "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Dips_on_a_chair.jpg/320px-Dips_on_a_chair.jpg",
  "tpush": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Triceps_pushdown.jpg/320px-Triceps_pushdown.jpg",
  "pu":    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Pull_up_demonstration.jpg/320px-Pull_up_demonstration.jpg",
  "row":   "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Bent_over_row.jpg/320px-Bent_over_row.jpg",
  "crow":  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Seated_cable_row.jpg/320px-Seated_cable_row.jpg",
  "lat":   "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Lat_pulldown.jpg/320px-Lat_pulldown.jpg",
  "facep": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Face_pull.jpg/320px-Face_pull.jpg",
  "curl":  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Dumbbell_curl.jpg/320px-Dumbbell_curl.jpg",
  "plank": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Plank_position.jpg/320px-Plank_position.jpg",
  "crunch":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Abdominal_crunch.jpg/320px-Abdominal_crunch.jpg",
  "legr":  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Leg_raise.jpg/320px-Leg_raise.jpg",
  "mob1":  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Hip_flexor_stretch.jpg/320px-Hip_flexor_stretch.jpg",
  "mob2":  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Thoracic_rotation.jpg/320px-Thoracic_rotation.jpg",
};

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sbFetch = async (path, method="GET", body=null) => {
  const opts = { method, headers: { "apikey": SB_KEY, "Authorization": "Bearer "+SB_KEY, "Content-Type": "application/json", "Prefer": "return=representation" } };
  if(body) opts.body = JSON.stringify(body);
  const r = await fetch(SB_URL+"/rest/v1/"+path, opts);
  if(!r.ok) return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
};

const sb = {
  getAlumnos: (entId) => sbFetch("alumnos?entrenador_id=eq."+entId+"&select=*"),
  createAlumno: (data) => sbFetch("alumnos", "POST", data),
  getRutinas: (alumnoId) => sbFetch("rutinas?alumno_id=eq."+alumnoId+"&select=*"),
  getRutinasByEntrenador: () => sbFetch("rutinas?entrenador_id=eq.entrenador_principal&select=*"),
  createRutina: (data) => sbFetch("rutinas", "POST", data),
  updateRutina: (id, data) => sbFetch("rutinas?id=eq."+id, "PATCH", data),
  deleteRutina: (id) => sbFetch("rutinas?id=eq."+id, "DELETE"),
  getProgreso: (alumnoId) => sbFetch("progreso?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc"),
  addProgreso: (data) => sbFetch("progreso", "POST", data),
  getSesiones: (alumnoId) => sbFetch("sesiones?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc&limit=10"),
  addSesion: (data) => sbFetch("sesiones", "POST", data),
  getUltimaSesion: (alumnoId) => sbFetch("sesiones?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc&limit=1"),
  getFotos: (alumnoId) => sbFetch("fotos?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc"),
  deleteFoto: (id) => sbFetch("fotos?id=eq."+id, "DELETE"),
  addFoto: (data) => sbFetch("fotos", "POST", data),
  updateAlumno: async (id, data) => {
    return sbFetch("alumnos?id=eq."+id, "PATCH", data);
  },
  getConfig: () => sbFetch("config?id=eq.pagos&select=*"),
  saveConfig: (data) => sbFetch("config?id=eq.pagos", "PATCH", data),
  getMensajes: (alumnoId) => sbFetch("mensajes?alumno_id=eq."+alumnoId+"&select=*&order=created_at.asc&limit=50"),
  addMensaje: (data) => sbFetch("mensajes", "POST", data),
  marcarMensajesLeidos: async (alumnoId, esEntrenador) => {
  const deQuien = esEntrenador ? "false" : "true";
  const url = "mensajes?alumno_id=eq."+alumnoId+"&de_entrenador=eq."+deQuien+"&leido=eq.false";
  const r = await fetch(SB_URL+"/rest/v1/"+url, {
    method: "PATCH",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer "+SB_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({ leido: true })
  });
  if (!r.ok) {
    const err = await r.text();
    console.error("marcarMensajesLeidos falló:", r.status, err);
  }
},
  getNota: (alumnoId) => sbFetch("notas?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc&limit=1"),
  setNota: (data) => sbFetch("notas", "POST", data),
  getVideoOverrides: () => sbFetch("video_overrides?select=ejercicio_id,youtube_url"),
  getCustomEx: () => sbFetch("ejercicios_custom?entrenador_id=eq.entrenador_principal&select=*"),
  addCustomEx: (data) => sbFetch("ejercicios_custom", "POST", data),
  deleteCustomEx: (id) => sbFetch("ejercicios_custom?id=eq."+id, "DELETE"),
  updateCustomEx: (id, data) => sbFetch("ejercicios_custom?id=eq."+id, "PATCH", data),
  setVideoOverride: async (ejercicioId, url) => {
    try { await sbFetch("video_overrides?ejercicio_id=eq."+ejercicioId, "DELETE"); } catch(e){}
    try { return await sbFetch("video_overrides", "POST", {ejercicio_id:ejercicioId, youtube_url:url, entrenador_id:"entrenador_principal"}); } catch(e){ return null; }
  },
};



const uid = () => Math.random().toString(36).slice(2,9);


function PagoAlumno({aliasData, es, toast2, darkMode}) {
  const {bg, bgCard, bgSub, border, textMain, textMuted} = getTheme(darkMode);
const [pagoVisible, setPagoVisible] = React.useState(()=>
  localStorage.getItem("it_pago_cerrado")!=="true"
);
if(!pagoVisible) return null;
return(
  <div style={{background:bgCard,border:"1px solid #22c55e44",borderRadius:12,
    padding:"12px 16px",marginBottom:12,position:"relative"}}>
    <button onClick={()=>{
        setPagoVisible(false);
        localStorage.setItem("it_pago_cerrado","true");
      }}
      style={{position:"absolute",top:8,right:8,background:"transparent",
        border:"none",color:textMuted,fontSize:18,cursor:"pointer",
        width:28,height:28,display:"flex",alignItems:"center",
        justifyContent:"center",borderRadius:6,lineHeight:1}}><Ic name="x" size={16}/></button>
    <div style={{fontSize:13,fontWeight:700,color:"#22C55E",marginBottom:8,
      paddingRight:28}}>💰 {es?"Datos de pago":"Payment info"}</div>
    <div style={{background:bgSub,borderRadius:12,padding:"8px 12px"}}>
      {aliasData.banco&&<div style={{fontSize:11,color:textMuted,marginBottom:4}}>{aliasData.banco}</div>}
      <div style={{fontSize:18,fontWeight:800,letterSpacing:0.3,marginBottom:4}}>{aliasData.alias}</div>
      {aliasData.cbu&&<div style={{fontSize:11,color:textMuted,marginBottom:4}}>{aliasData.cbu}</div>}
      {aliasData.monto&&<div style={{fontSize:13,fontWeight:700,color:"#22C55E",marginBottom:4}}>{aliasData.monto}/mes</div>}
      {aliasData.nota&&<div style={{fontSize:11,color:textMuted}}>{aliasData.nota}</div>}
    </div>
    <button className="hov"
      style={{background:"#22C55E20",color:"#22C55E",border:"none",
        borderRadius:8,padding:"8px",width:"100%",marginTop:8,
        fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}
      onClick={()=>{navigator.clipboard.writeText(aliasData.alias);toast2(es?"Alias copiado ✓":"Alias copied ✓");}}>
      <Ic name="copy" size={14}/> {es?"Copiar alias":"Copy alias"}
    </button>
  </div>
);
}

function FotosSlider({fotos, es, darkMode, toast2, sb, sessionData, setFotos}) {
  const {bg, bgCard, bgSub, border, textMain, textMuted} = getTheme(darkMode);
const [sliderPos, setSliderPos] = React.useState(50);
const [isDragging, setIsDragging] = React.useState(false);
const sliderRef = React.useRef();
const fotoAntes = fotos[fotos.length-1];
const fotoDespues = fotos[0];
const calcPos = (clientX) => {
  const rect = sliderRef.current?.getBoundingClientRect();
  if(!rect) return 50;
  return Math.min(100, Math.max(0, ((clientX-rect.left)/rect.width)*100));
};
return(
  <div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,textTransform:"uppercase"}}>
        {fotos.length} fotos · {es?"comparador":"before/after"}
      </div>
      <div style={{fontSize:11,color:textMuted}}>← {es?"arrastrá":"drag"} →</div>
    </div>
    <div ref={sliderRef}
      style={{position:"relative",width:"100%",aspectRatio:"3/4",borderRadius:12,overflow:"hidden",
        cursor:"ew-resize",userSelect:"none",touchAction:"none",border:"1px solid "+border}}
      onMouseDown={e=>{setIsDragging(true);setSliderPos(calcPos(e.clientX));}}
      onMouseMove={e=>{if(isDragging)setSliderPos(calcPos(e.clientX));}}
      onMouseUp={()=>setIsDragging(false)}
      onMouseLeave={()=>setIsDragging(false)}
      onTouchStart={e=>{setIsDragging(true);setSliderPos(calcPos(e.touches[0].clientX));}}
      onTouchMove={e=>{e.preventDefault();if(isDragging)setSliderPos(calcPos(e.touches[0].clientX));}}
      onTouchEnd={()=>setIsDragging(false)}
    >
      <img src={fotoDespues.imagen} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
      <div style={{position:"absolute",inset:0,clipPath:`inset(0 ${100-sliderPos}% 0 0)`}}>
        <img src={fotoAntes.imagen} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      </div>
      <div style={{position:"absolute",top:0,bottom:0,left:`${sliderPos}%`,transform:"translateX(-50%)",width:3,background:"#fff",boxShadow:"0 0 8px rgba(0,0,0,.6)"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          width:38,height:38,borderRadius:"50%",background:"#fff",border:"2px solid #2563EB",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 2px 12px rgba(0,0,0,.4)",fontSize:15,color:"#2563EB",fontWeight:700}}>⇔</div>
      </div>
      <div style={{position:"absolute",bottom:8,left:8,background:"rgba(0,0,0,.7)",color:"#fff",fontSize:11,fontWeight:600,padding:"4px 8px",borderRadius:6}}>
        {es?"ANTES":"BEFORE"} · {fotoAntes.fecha}
      </div>
      <div style={{position:"absolute",bottom:8,right:8,background:"rgba(37,99,235,.85)",color:"#fff",fontSize:11,fontWeight:600,padding:"4px 8px",borderRadius:6}}>
        {es?"AHORA":"NOW"} · {fotoDespues.fecha}
      </div>
    </div>
  </div>
);
}

function getTheme(darkMode) {
  const dm = darkMode !== false;
  return {
    bg: dm?"#0F1923":"#F0F4F8",
    bgCard: dm?"#1E2D40":"#FFFFFF",
    bgSub: dm?"#162234":"#EEF2F7",
    border: dm?"#2D4057":"#E2E8F0",
    textMain: dm?"#FFFFFF":"#0F1923",
    textMuted: dm?"#8B9AB2":"#64748B",
  };
}

function RecordatoriosPanel({es, darkMode, toast2}) {
  const {bg, bgCard, bgSub, border, textMain, textMuted} = getTheme(darkMode);
const DIAS = es
  ? ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
  : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const [notifDias, setNotifDias] = React.useState(()=>{
  try{ return JSON.parse(localStorage.getItem("it_notif_dias")||"[]"); }catch(e){return [];}
});
const [notifHora, setNotifHora] = React.useState(()=>
  localStorage.getItem("it_notif_hora")||"08:00"
);
const [notifActivo, setNotifActivo] = React.useState(()=>
  localStorage.getItem("it_notif_on")==="true"
);
const toggleDia = (i) => {
  const next = notifDias.includes(i)
    ? notifDias.filter(d=>d!==i)
    : [...notifDias,i];
  setNotifDias(next);
  localStorage.setItem("it_notif_dias", JSON.stringify(next));
};
const guardar = async () => {
  localStorage.setItem("it_notif_hora", notifHora);
  localStorage.setItem("it_notif_on", "true");
  setNotifActivo(true);
  // Pedir permiso de notificaciones
  if("Notification" in window && Notification.permission==="default"){
    await Notification.requestPermission();
  }
  toast2(es?"Recordatorios activados ✓":"Reminders set ✓");
};
const apagar = () => {
  localStorage.setItem("it_notif_on","false");
  setNotifActivo(false);
  toast2(es?"Recordatorios desactivados":"Reminders off");
};
return(
  <div style={{marginBottom:24}}>
    <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>
      🔔 {es?"Recordatorios de entrenamiento":"Training reminders"}
    </div>
    <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
      {DIAS.map((d,i)=>(
        <button key={"it-notif-dow-"+i} onClick={()=>toggleDia(i)}
          style={{flex:1,minWidth:36,padding:"8px 4px",borderRadius:8,border:"1px solid "+
            (notifDias.includes(i)?"#2563EB":"#2D4057"),
            background:notifDias.includes(i)?"#2563EB":"transparent",
            color:notifDias.includes(i)?"#fff":textMuted,
            fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {d}
        </button>
      ))}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
      <div style={{fontSize:13,color:textMuted,fontWeight:500,flex:1}}>
        {es?"Hora del recordatorio":"Reminder time"}
      </div>
      <input type="time" value={notifHora}
        onChange={e=>{setNotifHora(e.target.value);localStorage.setItem("it_notif_hora",e.target.value);}}
        style={{background:bgSub,color:textMain,border:"1px solid "+border,
          borderRadius:8,padding:"8px 12px",fontSize:15,fontFamily:"inherit",outline:"none"}}/>
    </div>
    {notifActivo?(
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1,padding:"8px 12px",background:"#22C55E12",border:"1px solid #22C55E33",
          borderRadius:12,fontSize:13,color:"#22C55E",fontWeight:600,display:"flex",alignItems:"center",gap:8}}>
          🔔 {es?`Activo · ${notifDias.length} días · ${notifHora}`:`On · ${notifDias.length} days · ${notifHora}`}
        </div>
        <button onClick={apagar}
          style={{padding:"8px 16px",background:"#EF444422",color:"#EF4444",border:"1px solid #EF444433",
            borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {es?"Apagar":"Off"}
        </button>
      </div>
    ):(
      <button onClick={guardar} disabled={notifDias.length===0}
        style={{width:"100%",padding:"12px",
          background:notifDias.length>0?"#2563EB":"#2D4057",
          color:notifDias.length>0?"#fff":textMuted,
          border:"none",borderRadius:12,fontSize:15,fontWeight:700,
          cursor:notifDias.length>0?"pointer":"not-allowed",fontFamily:"inherit"}}>
        {notifDias.length===0
          ?(es?"Seleccioná al menos un día":"Select at least one day")
          :(es?"Activar recordatorios":"Activate reminders")}
      </button>
    )}
  </div>
);
}





const IronTrackLogo = ({size=28, color="#2563EB", showBar=true, mode=null, modeColor="#22C55E"}) => (
  <div style={{display:"flex",flexDirection:"column",gap:2}}>
    <div style={{display:"flex",alignItems:"center",gap:showBar?8:0}}>
      {showBar&&<div style={{width:4,height:size*1.1,background:color,borderRadius:2,flexShrink:0}}/>}
      <span style={{
        fontSize:size,fontWeight:900,letterSpacing:size>22?3:2,color,
        fontFamily:"'Barlow Condensed','Arial Black',sans-serif",
        lineHeight:1,textTransform:"uppercase"
      }}>IRON<br/>TRACK</span>
    </div>
    {mode&&<div style={{fontSize:11,color:modeColor,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginLeft:showBar?12:0}}>{mode}</div>}
  </div>
);

const IconPlan = ({size=20, color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/>
  </svg>
);

const IconExercises = ({size=20, color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4v16M18 4v16M3 8h4M17 8h4M3 16h4M17 16h4M7 12h10"/>
  </svg>
);

const IconProgress = ({size=20, color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const IconDashboard = ({size=20, color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);

const IconRoutines = ({size=20, color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
  </svg>
);

const IconAthletes = ({size=20, color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconSettings = ({size=18, color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);


function GymApp() {
  const [tab, setTab] = useState("plan");
  const [tabMain, setTabMain] = useState("entrenador"); // entrenador | alumno
      const [onboardStep, setOnboardStep] = useState(0);
  const [onboardDone, setOnboardDone] = useState(()=>{ try{return !!localStorage.getItem('it_onboard_done');}catch(e){return false;} });
                          const ENTRENADOR_ID = "entrenador_principal";
  // Modo alumno: detectar ?r= en la URL
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const sharedParam = urlParams ? urlParams.get("r") : null;
  const readOnly = !!sharedParam;
  const [sharedLoaded, setSharedLoaded] = useState(false);
  // Login
  const [sessionData, setSessionData] = useState(()=>{ try{return JSON.parse(localStorage.getItem("it_session")||"null")}catch(e){return null} });
  const [loginScreen, setLoginScreen] = useState(()=>{ try{return !localStorage.getItem("it_session")}catch(e){return true} });
  const [loginRole, setLoginRole] = useState("entrenador");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [webAuthnAvail] = useState(()=> typeof window!=="undefined" && !!window.PublicKeyCredential);
  const [savedCredential] = useState(()=>{ try{return localStorage.getItem("it_biometric_cred")}catch(e){return null} });
  const [lang, setLang] = useState(()=>{try{return localStorage.getItem("it_lang")||"es"}catch(e){return "es"}});
  const [darkMode, setDarkMode] = useState(()=>{
    try{
      const saved = localStorage.getItem("it_dark");
      if(saved !== null) return saved !== "false";
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches !== false;
    }catch(e){ return true; }
  });

  // ── useAlumnos ────────────────────────────────────────────────────────
  const {
    alumnos, setAlumnos,
    sesiones, setSesiones,
    alumnoActivo, setAlumnoActivo,
    alumnoSesiones, setAlumnoSesiones,
    alumnoProgreso, setAlumnoProgreso,
    loadingSB, setLoadingSB,
    newAlumnoForm, setNewAlumnoForm,
    newAlumnoData, setNewAlumnoData,
    newAlumnoErrors, setNewAlumnoErrors,
    editAlumnoModal, setEditAlumnoModal,
    editAlumnoEmail, setEditAlumnoEmail,
    editAlumnoPass, setEditAlumnoPass,
    cargarAlumnos,
    notifyAlumno,
  } = useAlumnos({ sb });
  const [rutinasSB, setRutinasSB] = useState([]);
  const [registrosSubTab, setRegistrosSubTab] = useState(0);
  const [sesionesGlobales, setSesionesGlobales] = useState([]);
  const [progresoGlobal, setProgresoGlobal] = useState({});
  const [sugerencias, setSugerencias] = useState({});
  // Estado del dropdown de sugerencias por alumno (para no mostrar listas interminables).
  const [sugsOpen, setSugsOpen] = useState({});
  const [rutinasSBEntrenador, setRutinasSBEntrenador] = useState([]);
  const [filtroRut, setFiltroRut] = useState("todas");

  

  const cargarSesionesGlobales = React.useCallback(async function(alumnosActuales) {
    var lista = alumnosActuales || alumnos;
    if(!lista || lista.length === 0) {
      try {
        var sbAlumnos = await sb.getAlumnos('entrenador_principal');
        if(sbAlumnos && sbAlumnos.length > 0) { setAlumnos(sbAlumnos); lista = sbAlumnos; }
        else return;
      } catch(e) { return; }
    }
    try {
      var ids = lista.map(function(a){return a.id}).filter(function(id){return id && typeof id === 'string'});
      if(ids.length === 0) return;
      var idsStr = ids.join(',');
      var results = await Promise.all([
        sbFetch('sesiones?alumno_id=in.(' + idsStr + ')&select=*&order=created_at.desc&limit=500'),
        sbFetch('progreso?alumno_id=in.(' + idsStr + ')&select=alumno_id,ejercicio_id,kg,reps,fecha&order=created_at.desc&limit=3000'),
      ]);
      if(results[0] && Array.isArray(results[0])) setSesionesGlobales(results[0]);
      if(results[1] && Array.isArray(results[1])) {
        var idx2 = {};
        results[1].forEach(function(reg) {
          if(!idx2[reg.alumno_id]) idx2[reg.alumno_id] = [];
          idx2[reg.alumno_id].push(reg);
        });
        setProgresoGlobal(idx2);
      }
    } catch(e) { console.error('[cargarSesionesGlobales]', e); }
  }, [alumnos]);

  useEffect(function() {
    if(sessionData && sessionData.role==='entrenador') {
      var init = async function() {
        var sbAlumnos = await sb.getAlumnos('entrenador_principal') || [];
        setAlumnos(sbAlumnos);
        if(sbAlumnos.length > 0) cargarSesionesGlobales(sbAlumnos);
        try { var rutsDB = await sb.getRutinasByEntrenador(); if(rutsDB && Array.isArray(rutsDB)) setRutinasSBEntrenador(rutsDB); } catch(e) {}
      };
      init();
      var intervalo = setInterval(function() { cargarSesionesGlobales(); }, 30000);
      return function() { clearInterval(intervalo); };
    }
  }, [sessionData]);

  const es = lang==="es";
  const [routines, setRoutines] = useState(() => { try{return JSON.parse(localStorage.getItem("it_rt")||"[]")}catch(e){return []} });
  const [progress, setProgress] = useState(() => { try{return JSON.parse(localStorage.getItem("it_pg")||"{}")}catch(e){return {}} });
  const [user, setUser] = useState(() => { try{return JSON.parse(localStorage.getItem("it_u")||"null")}catch(e){return null} });
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [filterPat, setFilterPat] = useState(null);
  const [detailEx, setDetailEx] = useState(null);
  const [logModal, setLogModal] = useState(null);
  const [activeExIdx, setActiveExIdx] = useState(0); // ejercicio activo en modo entrenamiento
  const [expandedR, setExpandedR] = useState(null);
  const [selDay, setSelDay] = useState(null);
  const [addExModal, setAddExModal] = useState(null); // {rId, dIdx}
  const [addExSearch, setAddExSearch] = useState("");
  const [addExPat, setAddExPat] = useState(null);
  const [addExSelectedIds, setAddExSelectedIds] = useState([]);
  const [newR, setNewR] = useState(null);
  /** Rutina local usada al pulsar "Asignar rutina" en cada alumno (explícita si hay varias). */
  const [assignRoutineId, setAssignRoutineId] = useState(null);
  const routineForAssign = useMemo(function(){
    if(!routines.length) return null;
    var id = assignRoutineId && routines.some(function(r){return r.id===assignRoutineId;}) ? assignRoutineId : routines[routines.length-1].id;
    return routines.find(function(r){return r.id===id;}) || null;
  }, [routines, assignRoutineId]);
  const [dupDayModal, setDupDayModal] = useState(null); // {rId, dIdx, days}
  const [chatModal, setChatModal] = useState(null); // {alumnoId, alumnoNombre}
  const [videoOverrides, setVideoOverrides] = useState({}); // {ejercicioId: url}
  const [videoModal, setVideoModal] = useState(null); // {url, nombre}
  const [expandedPlanDay, setExpandedPlanDay] = useState(null); // "rutId-dayIdx"
  const [editEx, setEditEx] = useState(null);
  const [loginModal, setLoginModal] = useState(false);
  const [session, setSession] = useState(null);
  const [preSessionPRs, setPreSessionPRs] = useState({});
  const [prCelebration, setPrCelebration] = useState(null); // {ejercicio, kg, prevKg, diff, exId}
  const [sessionPRList, setSessionPRList] = useState([]); // [{exId, ejercicio, kg, prevKg, diff}]
  const [notaDia, setNotaDia] = useState(""); // nota del entrenador al alumno
  const [notaDiaInput, setNotaDiaInput] = useState(""); // input del entrenador
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const scrollRef = useRef(null);
  const lastScrollY = useRef(0);
  const [resumenSesion, setResumenSesion] = useState(null);
  const [chatOpenId, setChatOpenId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(()=>{ try{ const v=localStorage.getItem("it_show_welcome"); if(v){localStorage.removeItem("it_show_welcome");return true;} return false; }catch(e){return false;} });
  const [currentWeek, setCurrentWeek] = useState(() => { try{return parseInt(localStorage.getItem("it_week")||"0")}catch(e){return 0} });
  const [completedDays, setCompletedDays] = useState(() => { try{return JSON.parse(localStorage.getItem("it_cd")||"[]")}catch(e){return []} });
  const [pdfRoutine, setPdfRoutine] = useState(null);
  const [libQ, setLibQ] = useState("");
  const [filtPat, setFiltPat] = useState(null);
  const [editExModal, setEditExModal] = useState(null);
  const [editExNombre, setEditExNombre] = useState("");
  const [editExYT, setEditExYT] = useState("");
  const [customEx, setCustomEx] = useState(() => { try{return JSON.parse(localStorage.getItem("it_cex")||"[]")}catch(e){return []} });
  const [exModal, setExModal] = useState(null);
  const [aliasModal, setAliasModal] = useState(false);
  const [aliasData, setAliasData] = useState(null);
  const [isOnline, setIsOnline] = useState(()=>typeof navigator!=='undefined'?navigator.onLine:true);
  const [pendingSync, setPendingSync] = useState(()=>{
    try{return JSON.parse(localStorage.getItem('it_pending_sync')||'[]');}catch(e){return [];}
  });
  const [pagosEstado, setPagosEstado] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("it_pagos_estado")||"{}"); }catch(e){ return {}; }
  });
  const togglePago = (alumnoId) => {
    setPagosEstado(prev => {
      const cur = prev[alumnoId] || "pendiente";
      const next = cur === "pagado" ? "pendiente" : cur === "pendiente" ? "vencido" : "pagado";
      const updated = {...prev, [alumnoId]: next};
      try{ localStorage.setItem("it_pagos_estado", JSON.stringify(updated)); }catch(e){}
      return updated;
    });
  };
  const [aliasForm, setAliasForm] = useState({alias:"",cbu:"",monto:"",banco:"",nota:""});
  const [timer, setTimer] = useState(null);
  const timerRef = useRef(null);

  /** Después de login/logout (localStorage ya actualizado): sincroniza sesión y datos persistidos sin recargar. */
  function syncStateWithLocalStorage() {
    var sess = null;
    try { sess = JSON.parse(localStorage.getItem("it_session") || "null"); } catch (e) { sess = null; }
    setSessionData(sess);
    try { setLoginScreen(!localStorage.getItem("it_session")); } catch (e) { setLoginScreen(true); }
    try { setRoutines(JSON.parse(localStorage.getItem("it_rt") || "[]")); } catch (e) { setRoutines([]); }
    try { setProgress(JSON.parse(localStorage.getItem("it_pg") || "{}")); } catch (e) { setProgress({}); }
    try { setUser(JSON.parse(localStorage.getItem("it_u") || "null")); } catch (e) { setUser(null); }
    var welcome = false;
    try {
      if (localStorage.getItem("it_show_welcome")) {
        localStorage.removeItem("it_show_welcome");
        welcome = true;
      }
    } catch (e) {}
    setShowWelcome(welcome);
    try { setCurrentWeek(parseInt(localStorage.getItem("it_week") || "0", 10) || 0); } catch (e) { setCurrentWeek(0); }
    try { setCompletedDays(JSON.parse(localStorage.getItem("it_cd") || "[]")); } catch (e) { setCompletedDays([]); }
    try { setCustomEx(JSON.parse(localStorage.getItem("it_cex") || "[]")); } catch (e) { setCustomEx([]); }
    try { setPendingSync(JSON.parse(localStorage.getItem("it_pending_sync") || "[]")); } catch (e) { setPendingSync([]); }
    try { setPagosEstado(JSON.parse(localStorage.getItem("it_pagos_estado") || "{}")); } catch (e) { setPagosEstado({}); }
    try { setOnboardDone(!!localStorage.getItem("it_onboard_done")); } catch (e) { setOnboardDone(false); }
    setTab("plan");
    setSession(null);
    setAlumnos([]);
    setSesiones([]);
    setAlumnoActivo(null);
    setAlumnoSesiones([]);
    setAlumnoProgreso([]);
    setSesionesGlobales([]);
    setProgresoGlobal({});
    setRutinasSBEntrenador([]);
    setRutinasSB([]);
    setLoadingSB(false);
    setUserMenuOpen(false);
    setSettingsOpen(false);
    setLoginModal(false);
    setPreSessionPRs({});
    setSessionPRList([]);
    setPrCelebration(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimer(null);
  }

  // OneSignal Web Push

  // ── Escuchar cambios de tema del SO ─────────────────────────────────────
  useEffect(()=>{
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if(!mq) return;
    const handler = (e) => {
      if(localStorage.getItem("it_dark") === null) setDarkMode(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Detectar online/offline y sincronizar cola ─────────────────────────
  useEffect(()=>{
    const goOnline = () => {
      setIsOnline(true);
      // Sincronizar sets pendientes
      const pending = JSON.parse(localStorage.getItem('it_pending_sync')||'[]');
      if(pending.length === 0) return;
      const alumnoIdSync = (()=>{try{return JSON.parse(localStorage.getItem("it_session")||"null")?.alumnoId}catch(e){return null}})();
      if(!alumnoIdSync) return;
      pending.forEach(item => {
        try {
          console.log("[PROGRESO] enviando a supabase...");sb.addProgreso({
            alumno_id: alumnoIdSync,
            ejercicio_id: item.exId,
            kg: item.kg, reps: item.reps,
            nota: item.note||'', fecha: item.date
          });
        } catch(e) {}
      });
      localStorage.removeItem('it_pending_sync');
      setPendingSync([]);
      if(pending.length > 0) toast2(pending.length+' set'+(pending.length>1?'s':'')+' sincronizados ✓');
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [sessionData]);

    // ── Registrar Service Worker (PWA) ───────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(reg => console.log('SW registrado:', reg.scope))
          .catch(err => console.log('SW error:', err));
      });
    }
  }, []);

  useEffect(() => {
    if(typeof window === "undefined") return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.init({
        appId: "8c5e2bd1-2ac8-497a-93eb-fd07e5ce74d7",
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });
    });
  }, []);

  useEffect(() => {
    if(sharedParam && !sharedLoaded) {
      (async () => {
        try {
          const decoded = JSON.parse(atob(sharedParam));
          // Siempre intentar cargar desde Supabase primero (rutina más actualizada)
          if(decoded?.alumnoId) {
            const ruts = await sbFetch("rutinas?alumno_id=eq."+decoded.alumnoId+"&select=*&order=created_at.desc&limit=1");
            if(ruts && ruts[0] && ruts[0].datos) {
              setRoutines([{...ruts[0].datos, alumnoId: decoded.alumnoId, id: ruts[0].id}]);
              setSharedLoaded(true);
              return;
            }
          }
          // Fallback: usar datos del link si Supabase falla
          if(decoded && decoded.id) setRoutines([decoded]);
        } catch(e) {
          try {
            const decoded = JSON.parse(atob(sharedParam));
            if(decoded && decoded.id) setRoutines([decoded]);
          } catch(e2) {}
        }
        setSharedLoaded(true);
      })();
    }
  }, []);
  useEffect(() => { if(!readOnly) localStorage.setItem("it_rt",JSON.stringify(routines)); },[routines]);
  useEffect(() => { localStorage.setItem("it_pg",JSON.stringify(progress)); },[progress]);

  // Recalcular timer cuando el alumno vuelve de background
  useEffect(()=>{
    const handleVisibility = () => {
      if(!document.hidden && timer?.endAt) {
        const rem = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
        if(rem <= 0) {
          if(timerRef.current) clearInterval(timerRef.current);
          setTimer(null);
          toast2(es?"¡Pausa lista! 💪":"Rest done! 💪");
        } else {
          setTimer(prev => prev ? {...prev, remaining:rem} : null);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [timer, es]);
  useEffect(() => { localStorage.setItem("it_week",String(currentWeek)); },[currentWeek]);

  useEffect(() => {
    if(!readOnly && sessionData?.role==="entrenador") {
      cargarAlumnos();
    }
  }, [sessionData?.role]);

  // Refrescar rutinas del alumno desde Supabase siempre al cargar
  useEffect(() => {
    if(!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      (async () => {
        try {
          const ruts = await sbFetch("rutinas?alumno_id=eq."+sessionData.alumnoId+"&select=*&order=created_at.desc&limit=1");
          if(ruts && ruts[0] && ruts[0].datos) {
            const rSB = ruts[0];
            const rutLocal = {
              id: rSB.id,
              name: rSB.nombre || "Rutina",
              days: rSB.datos?.days || [],
              alumno: rSB.datos?.alumno || sessionData.name || "",
              note: rSB.datos?.note || "",
              alumno_id: sessionData.alumnoId,
              saved: true
            };
            setRoutines(function(prev) {
              // No duplicar si ya existe
              var existe = prev.find(function(r) { return r.id === rSB.id; });
              if(existe) return prev.map(function(r) { return r.id === rSB.id ? rutLocal : r; });
              return [rutLocal];
            });
          }
          // Cargar nota del día
          sb.getNota(sessionData.alumnoId).then(function(res) {
            if(res && res[0]) setNotaDia(res[0].contenido||res[0].texto||"");
          }).catch(function(){});
        } catch(e) { console.error('[cargarRutinaAlumno]', e); }
      })();
    }
  }, [sessionData?.alumnoId]);
  useEffect(() => { localStorage.setItem("it_cd",JSON.stringify(completedDays)); },[completedDays]);
  useEffect(() => { localStorage.setItem("it_cex",JSON.stringify(customEx)); },[customEx]);
  // Cargar config de pagos desde Supabase
  useEffect(() => {
    sb.getConfig().then(res => {
      if(res && res[0]) setAliasData(res[0]);
    }).catch(()=>{});
    // Cargar video overrides
    sb.getVideoOverrides().then(function(res){
      if(res && Array.isArray(res)) {
        var map = {};
        res.forEach(function(r){ map[r.ejercicio_id] = r.youtube_url; });
        setVideoOverrides(map);
      }
    }).catch(function(){});
    // Cargar ejercicios custom desde Supabase
    sb.getCustomEx().then(function(res){
      if(res && Array.isArray(res) && res.length > 0) {
        var exs = res.map(function(e){ return {id:e.id, name:e.name, nameEn:e.name_en||e.name, pattern:e.pattern||"empuje", muscle:e.muscle||"", equip:e.equip||"Libre", youtube:e.youtube||""}; });
        setCustomEx(function(prev){
          // Merge: Supabase tiene prioridad, agregar locales que no estén
          var ids = new Set(exs.map(function(e){return e.id}));
          var locales = (prev||[]).filter(function(e){return !ids.has(e.id)});
          return [...exs, ...locales];
        });
      }
    }).catch(function(){});
  }, []);

  const toast2 = useCallback((msg, type) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);


  const R = 26; const circ = 2*Math.PI*R;

  const startTimer = (secs, color) => {
    if(timerRef.current) clearInterval(timerRef.current);
    const endAt = Date.now() + secs * 1000;
    setTimer({total:secs, remaining:secs, color, endAt});
    timerRef.current = setInterval(()=>{
      const rem = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setTimer(prev=>{
        if(!prev) return null;
        if(rem <= 0){
          clearInterval(timerRef.current);
          toast2(es?"¡Pausa lista! 💪":"Rest done! 💪");
          return null;
        }
        return {...prev, remaining:rem};
      });
    }, 500); // cada 500ms para mayor precisión
  };

  const sessionDataRef = React.useRef(sessionData);React.useEffect(()=>{sessionDataRef.current=sessionData;},[sessionData]);const logSet = (exId, kg, reps, note, rpe) => {
    const d = new Date().toLocaleDateString("es-AR");
    setProgress(prev=>{
      const ex = {...(prev[exId]||{sets:[],max:0})};
      ex.sets = [{kg:parseFloat(kg)||0,reps:parseInt(reps)||0,date:d,week:currentWeek,note,rpe:rpe||null},...(ex.sets||[])].slice(0,50);
      ex.max = Math.max(ex.max||0,parseFloat(kg)||0);
      return {...prev,[exId]:ex};
    });
    // Guardar en Supabase — si offline, guardar en cola local
    const alumnoIdSync = (()=>{try{return JSON.parse(localStorage.getItem("it_session")||"null")?.alumnoId}catch(e){return null}})() || (readOnly&&sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(alumnoIdSync) {
      if(!isOnline) {
        const item = {exId, kg:parseFloat(kg)||0, reps:parseInt(reps)||0, note:note||'', date:d};
        const updated = [...pendingSync, item];
        setPendingSync(updated);
        try{localStorage.setItem('it_pending_sync', JSON.stringify(updated));}catch(e){}
      } else {
        sb.addProgreso({
          alumno_id: alumnoIdSync,
          ejercicio_id: exId,
          kg: parseFloat(kg)||0,
          reps: parseInt(reps)||0,
          nota: note||"",
          fecha: d
        }).then(function(r){console.log("[PROGRESO] OK",r)}).catch(function(e){console.error("[PROGRESO] ERR",e)});
      }
    }
    // Detectar PR y celebrar (fuera del setter para tener acceso al scope)
    const exPrevData = progress[exId]||{sets:[],max:0};
    const newKgVal = parseFloat(kg)||0;
    if(newKgVal > (exPrevData.max||0) && (exPrevData.max||0) > 0) {
      const exInfoCel = [...EX,...(customEx||[])].find(e=>e.id===exId);
      const prevMax = exPrevData.max||0;
      const diff = Math.round((newKgVal - prevMax)*10)/10;
      setPrCelebration({ejercicio: exInfoCel?.name||exId, kg: newKgVal, prevKg: prevMax, diff: diff, exId: exId});
      // Guardar PR en lista de la sesión
      setSessionPRList(function(prev){
        var existe = prev.find(function(p){return p.exId===exId && p.kg===newKgVal});
        if(existe) return prev;
        return [...prev, {exId:exId, ejercicio:exInfoCel?.name||exId, kg:newKgVal, prevKg:prevMax, diff:diff}];
      });
      setTimeout(()=>setPrCelebration(null), 3000);
    }
    if(!isOnline) {
      toast2(es?'Set guardado localmente':'Set saved locally');
    } else {
      toast2(es?'Serie guardada ✓':'Set saved ✓');
    }
    // Actualizar kg en la rutina para autocompletar sets restantes
    if(parseFloat(kg)>0) {
      setRoutines(prev=>prev.map(r=>({...r,days:r.days.map(d=>({...d,
        exercises:d.exercises.map(ex=>ex.id===exId?{...ex,kg:String(kg)}:ex),
        warmup:(d.warmup||[]).map(ex=>ex.id===exId?{...ex,kg:String(kg)}:ex)
      }))})));
    }
  };

  const bg=darkMode?"#0F1923":"#F0F4F8";
  const bgCard=darkMode?"#1E2D40":"#FFFFFF";
  const bgSub=darkMode?"#162234":"#E2E8F0";
  const border=darkMode?"#2D4057":"#2D4057";
  const textMain=darkMode?"#FFFFFF":"#0F1923";
  const textMuted=darkMode?"#8B9AB2":"#64748B";
  const green=darkMode?"#22C55E":"#16A34A";
  const greenSoft=darkMode?"rgba(34,197,94,0.12)":"rgba(22,163,74,0.1)";
  const greenBorder=darkMode?"rgba(34,197,94,0.25)":"rgba(22,163,74,0.25)";
  const card={background:bgCard,borderRadius:16,padding:"16px 18px",marginBottom:8,border:"1px solid "+border,boxShadow:darkMode?"0 4px 16px rgba(0,0,0,0.5)":"0 2px 8px rgba(0,0,0,0.08)"};
  const inp={background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",width:"100%",boxSizing:"border-box"};
  const lbl={fontSize:13,fontWeight:600,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"};
  const btn=(col,txt)=>({background:col||(darkMode?"#2D4057":"#E2E8F0"),color:txt||(darkMode?"#FFFFFF":"#0F1923"),border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:1});
  const tag=(col)=>({background:"#162234",color:"#8B9AB2",border:"1px solid #2D4057",borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700});

  const allEx = React.useMemo(function(){ return [...EX, ...(customEx||[])]; }, [customEx]);
  const filteredEx = allEx.filter(e=>{
    const q=search.toLowerCase();
    if(filterPat && e.pattern!==filterPat) return false;
    if(!q) return true;
    return e.name.toLowerCase().includes(q)||e.nameEn.toLowerCase().includes(q)||e.muscle.toLowerCase().includes(q);
  });

  const activeR = session ? routines.find(r=>r.id===session.rId) : null;
  const activeDay = activeR ? activeR.days[session.dIdx] : null;
  const esAlumno = readOnly || sessionData?.role==="alumno";
  const tabs2 = esAlumno
    ? [
        {k:"plan",    icon:(c)=><Ic name="calendar" size={20} color={c}/>,      lbl:es?"PLAN":"PLAN"},
        {k:"library", icon:(c)=><Ic name="activity" size={20} color={c}/>, lbl:es?"EJERCICIOS":"EXERCISES"},
        {k:"progress",icon:(c)=><Ic name="trending-up" size={20} color={c}/>,  lbl:es?"PROGRESO":"PROGRESS"}
      ]
    : [
        {k:"plan",      icon:(c)=><Ic name="bar-chart-2" size={20} color={c}/>, lbl:es?"DASHBOARD":"DASHBOARD"},
        {k:"routines",  icon:(c)=><Ic name="file-text" size={20} color={c}/>,  lbl:es?"RUTINAS":"ROUTINES"},
        {k:"biblioteca",icon:(c)=><Ic name="activity" size={20} color={c}/>, lbl:es?"EJERCICIOS":"EXERCISES"},
        {k:"alumnos",   icon:(c)=><Ic name="users" size={20} color={c}/>,  lbl:es?"ALUMNOS":"ATHLETES"}
      ];

  const generatePDF = (r) => {
    const patColors = {pierna:"#22C55E",empuje:"#2563EB",traccion:"#2563EB",core:"#8B9AB2",movil:"#8B9AB2"};
    const weeks4 = [0,1,2,3];
    let rows = [];
    r.days.forEach((d,di) => {
      rows.push({type:"day", label:"DIA "+(di+1)+(d.label&&d.label!=="Dia "+(di+1)?" — "+d.label:""), di});
      if(d.warmup && d.warmup.length>0) {
        rows.push({type:"warmup-header"});
        d.warmup.forEach((ex,ei) => {
          const info = allEx.find(e=>e.id===ex.id);
          const exName = es?(info?.name||ex.id):(info?.nameEn||info?.name||ex.id);
          const wks = weeks4.map(wi => {
            const w = (ex.weeks||[])[wi]||{};
            return {s:w.sets||ex.sets||"-", r:w.reps||ex.reps||"-", kg:w.kg||ex.kg||"", note:w.note||"", filled:!!(w.sets||w.reps||w.kg), active:wi===currentWeek};
          });
          rows.push({type:"warmup-ex", exName, ex, wks});
        });
      }
      if(d.exercises && d.exercises.length>0) {
        rows.push({type:"main-header"});
        d.exercises.forEach((ex,ei) => {
          const info = allEx.find(e=>e.id===ex.id);
          const pat = info?.pattern||"empuje";
          const col = patColors[pat]||"#2563EB";
          const exName = es?(info?.name||ex.id):(info?.nameEn||info?.name||ex.id);
          const wks = weeks4.map(wi => {
            const w = (ex.weeks||[])[wi]||{};
            return {s:w.sets||ex.sets||"-", r:w.reps||ex.reps||"-", kg:w.kg||ex.kg||"", note:w.note||"", filled:!!(w.sets||w.reps||w.kg), active:wi===currentWeek};
          });
          const lastRpe = progress[ex.id]?.sets?.[0]?.rpe||null;
          rows.push({type:"ex", exName, info, pat, col, ex, wks, lastRpe});
        });
      }
    });
    setPdfRoutine({r, rows});
  };

  const coachDashboardData = useMemo(function() {
    const COACH_TOTAL_SLOTS = 12;
    var totalSlots = COACH_TOTAL_SLOTS;
    var activeStudents = (alumnos || []).length;
    var ses = sesionesGlobales || [];
    var now = new Date();
    var dayKeys = ["L", "M", "X", "J", "V", "S", "D"];
    var ws = new Date(now);
    var wd = ws.getDay();
    var diff = wd === 0 ? -6 : 1 - wd;
    ws.setDate(ws.getDate() + diff);
    ws.setHours(0, 0, 0, 0);
    var we = new Date(ws);
    we.setDate(we.getDate() + 7);
    var counts = [0, 0, 0, 0, 0, 0, 0];
    ses.forEach(function(s) {
      var d = new Date(s.fecha || s.created_at);
      if (isNaN(d.getTime())) return;
      if (d < ws || d >= we) return;
      var idx = (d.getDay() + 6) % 7;
      counts[idx]++;
    });
    var maxC = Math.max.apply(null, counts.concat([1]));
    var todayIdx = (now.getDay() + 6) % 7;
    var weekDays = dayKeys.map(function(label, i) {
      return {
        label: label,
        id: "wd-" + i,
        sessionsCount: counts[i],
        barHeightPx: counts[i] === 0 ? 0 : Math.max(5, Math.round((counts[i] / maxC) * 56)),
        isToday: i === todayIdx,
      };
    });
    var weekTotal = counts.reduce(function(a, b) { return a + b; }, 0);
    var weekGoalTarget = 24;
    var completionPercent = Math.min(100, Math.round((weekTotal / weekGoalTarget) * 100));
    console.log("[week] sesiones recibidas:", sesionesGlobales.length,
      "primer created_at:", sesionesGlobales[0]?.created_at,
      "primer fecha:", sesionesGlobales[0]?.fecha);
    var dateSet = {};
    ses.forEach(function(s) {
      var d = new Date(s.fecha || s.created_at);
      if (isNaN(d.getTime())) return;
      d.setHours(0, 0, 0, 0);
      dateSet[d.getTime()] = true;
    });
    var streak = 0;
    var cur = new Date();
    cur.setHours(0, 0, 0, 0);
    while (dateSet[cur.getTime()]) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    function sessionsLast7Days(alumnoId) {
      var t0 = Date.now() - 7 * 86400000;
      return ses.filter(function(s) {
        if (s.alumno_id !== alumnoId) return false;
        var t = new Date(s.fecha || s.created_at).getTime();
        return t >= t0;
      }).length;
    }
    function hasRecentPR(alumnoId) {
      var regs = progresoGlobal[alumnoId];
      if (!regs || regs.length < 2) return false;
      var byEx = {};
      regs.forEach(function(r) {
        var ex = r.ejercicio_id;
        if (!byEx[ex]) byEx[ex] = [];
        byEx[ex].push(r);
      });
      for (var k in byEx) {
        if (!Object.prototype.hasOwnProperty.call(byEx, k)) continue;
        var list = byEx[k].slice().sort(function(a, b) {
          return new Date(b.fecha || b.created_at || 0) - new Date(a.fecha || a.created_at || 0);
        });
        if (list.length < 2) continue;
        var latest = parseFloat(list[0].kg) || 0;
        var olderMax = 0;
        for (var j = 1; j < list.length; j++) {
          olderMax = Math.max(olderMax, parseFloat(list[j].kg) || 0);
        }
        if (latest > olderMax) return true;
      }
      return false;
    }
    var alerts = [];
    (alumnos || []).forEach(function(a) {
      var aid = a.id;
      var s7 = sessionsLast7Days(aid);
      var compliancePct = Math.min(100, (s7 / 4) * 100);
      var level = null;
      if (s7 === 0) level = "high";
      else if (compliancePct < 60) level = "med";
      else if (hasRecentPR(aid)) level = "pos";
      if (!level) return;
      var name = a.nombre || a.email || "?";
      var initials = name.slice(0, 2).toUpperCase();
      var id = "coach-alert-" + aid;
      var avatarStyle = level === "high"
        ? { background: "rgba(239,68,68,.12)", color: "#EF4444" }
        : level === "med"
          ? { background: "rgba(245,158,11,.12)", color: "#F59E0B" }
          : { background: "rgba(34,197,94,.12)", color: "#22C55E" };
      var contextLine = level === "high"
        ? (es ? "Sin sesión en los últimos 7 días" : "No session in the last 7 days")
        : level === "med"
          ? (es ? ("Cumplimiento ~" + Math.round(compliancePct) + "% esta semana") : ("~" + Math.round(compliancePct) + "% compliance this week"))
          : (es ? "Progreso reciente en cargas (posible PR)" : "Recent load progress (possible PR)");
      var risk = level === "pos"
        ? { kind: "pr", value: "PR", badgeVariant: "p" }
        : { kind: "score", value: level === "high" ? "90" : String(Math.round(compliancePct)), badgeVariant: level === "high" ? "h" : "m" };
      alerts.push({
        id: id,
        level: level,
        initials: initials,
        avatarStyle: avatarStyle,
        name: name,
        contextLine: contextLine,
        patternQuote: level === "med" ? (es ? "Por debajo del 60% de sesiones esperadas" : "Below 60% of expected sessions") : undefined,
        risk: risk,
        factors: level === "high"
          ? [{ label: es ? "7 días sin sesión" : "7 days without session", icon: "clock" }]
          : level === "med"
            ? [{ label: es ? "Cumplimiento bajo" : "Low compliance", icon: "trend" }]
            : [{ label: es ? "Mejora vs anterior" : "Improvement vs before", icon: "trend" }],
        suggestion: {
          text: level === "pos"
            ? (es ? "Buen momento para felicitar y reforzar el hábito." : "Good time to praise and reinforce the habit.")
            : (es ? "Enviá un recordatorio amable para reenganchar." : "Send a friendly reminder to re-engage."),
          tone: level === "pos" ? "positive" : "default",
        },
        primaryAction: { label: es ? "Notificar" : "Notify", icon: "message" },
        secondaryAction: { label: es ? "Ver perfil" : "View profile", icon: "profile" },
        highlightedBorder: level === "pos",
      });
    });
    const NOMBRES_GENERICOS = ["entrenador","coach","admin",""];
    const nombreCoach = sessionData?.name || "";
    const esGenerico = NOMBRES_GENERICOS.includes(nombreCoach.toLowerCase().trim());
    const displayName = esGenerico
      ? (sessionData?.email?.split("@")[0] || "Coach")
      : nombreCoach;
    var coachInitialsGreet = displayName
      .split(" ")
      .map(function(w) { return w[0]; })
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return {
      greeting: {
        name: displayName,
        coachName: displayName,
        initials: coachInitialsGreet,
      },
      businessMetrics: {
        cards: [
          {
            id: "m-alu",
            accentColor: "#2563EB",
            icon: "users",
            label: es ? "Alumnos activos" : "Active athletes",
            value: String(activeStudents) + " / " + String(totalSlots),
            subline: es ? (Math.max(0, totalSlots - activeStudents) + " cupos disponibles") : (Math.max(0, totalSlots - activeStudents) + " slots open"),
          },
          {
            id: "m-ses",
            accentColor: "#22C55E",
            icon: "trend",
            label: es ? "Sesiones esta semana" : "Sessions this week",
            value: String(weekTotal),
            subline: es ? "Registradas en el equipo" : "Logged team-wide",
          },
        ],
      },
      weeklyActivity: {
        completionPercent: completionPercent,
        completionLabel: es ? "Cumplimiento semanal" : "Weekly completion",
        sessionsSummary: weekTotal + " / " + weekGoalTarget + (es ? " sesiones completadas" : " sessions completed"),
        days: weekDays,
      },
      aiAlerts: {
        alerts: alerts,
        urgentCount: alerts.filter(function(x) { return x.level === "high"; }).length,
        onPrimaryAction: function(alertId) {
          var raw = String(alertId).replace(/^coach-alert-/, "");
          notifyAlumno(raw, es ? "¡Tu entrenador te recuerda entrenar! 💪" : "Your coach reminds you to train! 💪")
            .then(function() { toast2(es ? "Notificación enviada" : "Notification sent"); })
            .catch(function() { toast2("Error al notificar"); });
        },
        onSecondaryAction: async function(alertId) {
          var raw = String(alertId).replace(/^coach-alert-/, "");
          var alum = (alumnos || []).find(function(x) { return String(x.id) === raw; });
          if (!alum) return;
          setAlumnoActivo(alum);
          setTab("alumnos");
          setLoadingSB(true);
          try {
            var results = await Promise.all([sb.getRutinas(alum.id), sb.getProgreso(alum.id), sb.getSesiones(alum.id)]);
            setRutinasSB(results[0] || []);
            setAlumnoProgreso(results[1] || []);
            setAlumnoSesiones(results[2] || []);
          } catch (e) { console.error("[onVerAlumno]", e); }
          setLoadingSB(false);
        },
      },
      coachGamification: {
        streakValue: String(streak),
        streakTitle: es ? "Racha del equipo" : "Team streak",
        streakSubtitle: es ? "Días seguidos con al menos una sesión" : "Consecutive days with at least one session",
        weeklyGoalLabel: es ? "Meta semanal de sesiones" : "Weekly session goal",
        weeklyGoalCurrent: weekTotal,
        weeklyGoalTarget: weekGoalTarget,
        achievements: [],
      },
    };
  }, [alumnos, sesionesGlobales, sesionesGlobales.length, progresoGlobal, es, notifyAlumno, toast2, sb, setAlumnoActivo, setTab, setLoadingSB, setRutinasSB, setAlumnoProgreso, setAlumnoSesiones, sessionData]);

  // Pantalla de login

  // ── Onboarding de 3 pasos ─────────────────────────────────────────────
  if(!sharedParam && !onboardDone) return (
    <OnboardingScreen es={es} darkMode={darkMode} onDone={()=>{
      try{localStorage.setItem('it_onboard_done','1');}catch(e){}
      setOnboardDone(true);
    }}/>
  );

  if(!sharedParam && loginScreen) return (
    <div style={{maxWidth:480,margin:"0 auto",height:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:bg,color:textMain,fontFamily:"Inter,sans-serif",padding:"0 24px"}}>
      <div style={{marginBottom:40,textAlign:"center"}}>
        <IronTrackLogo size={32} color="#2563EB" showBar={false}/>
        <div style={{fontSize:13,color:textMuted,marginTop:8,letterSpacing:1.5,fontWeight:500}}>
          {es?"ENTRENAMIENTO INTELIGENTE":"INTELLIGENT TRAINING"}
        </div>
      </div>
      <div style={{width:"100%",background:bgCard,borderRadius:16,padding:"24px",border:"1px solid "+border}}>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4}}>EMAIL</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",width:"100%",fontFamily:"Inter,sans-serif",fontSize:15,boxSizing:"border-box"}} value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="tu@email.com" type="email"/>
        </div>
        <div style={{marginBottom:loginError?12:20}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4}}>CONTRASEÑA</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",width:"100%",fontFamily:"Inter,sans-serif",fontSize:15,boxSizing:"border-box"}} value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="••••••••" type="password"/>
        </div>
        {loginError&&<div style={{color:"#2563EB",fontSize:13,marginBottom:12,textAlign:"center"}}>{loginError}</div>}
        <button style={{width:"100%",padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"Barlow Condensed,sans-serif",fontSize:18,fontWeight:700,cursor:"pointer",letterSpacing:1}} onClick={async ()=>{
          setLoginLoading(true); setLoginError("");
          try {
            const sp = typeof window!=="undefined"?(localStorage.getItem("it_tpass")||"irontrack2024"):"irontrack2024";
            const isEntrenador = loginEmail.trim().toLowerCase()==="entrenador@irontrack.app";
            if(isEntrenador){
              if(loginEmail==="entrenador@irontrack.app"&&loginPass===sp){
                localStorage.clear();
                const s={role:"entrenador",name:"Entrenador"};
                localStorage.setItem("it_session",JSON.stringify(s));
                syncStateWithLocalStorage();
              } else setLoginError("Email o contraseña incorrectos");
            } else {
              const res=await sbFetch("alumnos?email=eq."+encodeURIComponent(loginEmail)+"&password=eq."+encodeURIComponent(loginPass)+"&select=*");
              if(res&&res.length>0){
                const alumno=res[0];
                const ruts=await sbFetch("rutinas?alumno_id=eq."+alumno.id+"&select=*&order=created_at.desc&limit=1");
                localStorage.clear();
                const s={role:"alumno",name:alumno.nombre,alumnoId:alumno.id};
                localStorage.setItem("it_session",JSON.stringify(s));
                localStorage.setItem("it_show_welcome","1");
                if(ruts&&ruts[0]) localStorage.setItem("it_rt",JSON.stringify([{...ruts[0].datos,alumnoId:alumno.id}]));
                // Registrar OneSignal
                try {
                  window.OneSignalDeferred = window.OneSignalDeferred || [];
                  window.OneSignalDeferred.push(async function(OS) {
                    await OS.init({ appId: "8c5e2bd1-2ac8-497a-93eb-fd07e5ce74d7", allowLocalhostAsSecureOrigin: true });
                    const pid = OS.User?.PushSubscription?.id;
                    if(pid) await sbFetch("alumnos?id=eq."+alumno.id,"PATCH",{onesignal_id:pid});
                  });
                } catch(e) {}
                syncStateWithLocalStorage();
              } else setLoginError("Email o contraseña incorrectos");
            }
          } finally {
            setLoginLoading(false);
          }
        }}>
          {loginLoading?"INGRESANDO...":"INGRESAR"}
        </button>
        {webAuthnAvail&&savedCredential&&(
          <button className="hov" style={{...btn("#2D4057"),width:"100%",padding:"12px",fontSize:15,marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
            onClick={async()=>{
              try {
                const cred = await navigator.credentials.get({publicKey:{
                  challenge: new Uint8Array(32),
                  rpId: window.location.hostname,
                  allowCredentials:[{type:"public-key",id:Uint8Array.from(atob(savedCredential),c=>c.charCodeAt(0))}],
                  userVerification:"required",
                  timeout:60000
                }});
                if(cred) {
                  const saved = JSON.parse(localStorage.getItem("it_biometric_user")||"null");
                  if(saved) {
                    setLoginLoading(true);
                    setTimeout(function(){
                      try { localStorage.setItem("it_session", JSON.stringify(saved)); } catch(e) {}
                      syncStateWithLocalStorage();
                      setLoginLoading(false);
                    }, 500);
                  }
                }
              } catch(e){ toast2(es?"Error de biometría":"Biometric error"); }
            }}>
            <Ic name="lock" size={36} color="#2563EB"/>
            <span>{es?"Ingresar con huella / Face ID":"Sign in with biometrics"}</span>
          </button>
        )}
        {loginEmail.trim().toLowerCase()==="entrenador@irontrack.app"&&<div style={{fontSize:11,color:textMuted,textAlign:"center",marginTop:12}}>Contraseña por defecto: irontrack2024</div>}
        {loginEmail.trim().toLowerCase()!=="entrenador@irontrack.app"&&<div style={{fontSize:11,color:textMuted,textAlign:"center",marginTop:12}}>Usa el email y contrasena que te dio tu entrenador</div>}
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100dvh",background:bg,color:textMain,fontFamily:"Inter,sans-serif","--sk1":darkMode?"#1E2D40":"#E8EEF4","--sk2":darkMode?"#2D4057":"#D1DCE8",paddingBottom:72,position:"relative"}}>
      <style dangerouslySetInnerHTML={{__html:
        "@import url(https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap);" +
        "*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;line-height:1.4;-webkit-font-smoothing:antialiased}input,textarea,select{outline:none!important}" +
        "::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:"+(darkMode?"#162234":"#8B9AB2")+";border-radius:2px}" +
        ".hov{transition:all .15s ease;cursor:pointer}.hov:hover{filter:brightness(1.15)}" +
        "@keyframes successPulse{0%{transform:scale(1)}30%{transform:scale(0.94)}60%{transform:scale(1.06)}100%{transform:scale(1)}}" +
        "@keyframes pillBounce{0%{transform:scale(1)}30%{transform:scale(1.25)}50%{transform:scale(0.9)}70%{transform:scale(1.1)}100%{transform:scale(1)}}" +
        "@keyframes greenFlash{0%{filter:brightness(1)}40%{filter:brightness(1.5) saturate(1.3)}100%{filter:brightness(1)}}" +
        "@keyframes bounceIn{0%{transform:scale(0) rotate(-10deg);opacity:0}50%{transform:scale(1.2) rotate(5deg)}70%{transform:scale(0.92) rotate(-2deg)}100%{transform:scale(1) rotate(0);opacity:1}}" +
        "@keyframes rippleOut{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}100%{box-shadow:0 0 0 20px rgba(34,197,94,0)}}" +

        ".num{font-family:'Barlow Condensed',sans-serif;font-variant-numeric:tabular-nums}" +
        "*{-webkit-tap-highlight-color:transparent}[style*='overflowY']{-webkit-overflow-scrolling:touch;scroll-behavior:smooth}.card-ex{will-change:transform;contain:layout style paint}" +
        "@keyframes checkPop{0%{transform:scale(0.3) rotate(-15deg);opacity:0}60%{transform:scale(1.3) rotate(5deg);opacity:1}80%{transform:scale(0.9) rotate(-3deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}@keyframes slideUpFade{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}@keyframes prGlow{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.6);transform:scale(1)}50%{box-shadow:0 0 0 12px rgba(34,197,94,0);transform:scale(1.05)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);transform:scale(1)}}@keyframes rowComplete{0%{background:rgba(34,197,94,0.0)}15%{background:rgba(34,197,94,0.3)}100%{background:transparent}}" +
        "select{background:"+bgSub+";color:"+textMain+";border:1px solid "+border+";border-radius:8px;padding:8px 12px;font-family:Inter,sans-serif;font-size:13px;width:100%}" +
        ".app-inner{max-width:1200px;margin:0 auto;width:100%}" +
        "@media(min-width:768px){" +
        ".app-inner{font-size:142%}" +
        ".tab-content{padding:24px 32px!important}" +
        ".card-item{padding:18px 22px!important}" +
        "nav{justify-content:center;max-width:700px;margin:0 auto}" +
        "nav>*{max-width:140px;font-size:15px!important;padding:12px 0!important}" +
        "nav>* i{font-size:24px!important}" +
        ".scroll-area{padding:24px 32px!important;max-width:860px;margin:0 auto}" +
        ".sk{background:linear-gradient(90deg,var(--sk1,#1E2D40) 25%,var(--sk2,#2D4057) 50%,var(--sk1,#1E2D40) 75%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:8px;}@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
        "}"
      }}/>

      <div className="app-inner">
      {!isOnline&&(
        <div style={{
          background:"#1f1500",borderBottom:"1px solid #F59E0B44",
          padding:"8px 16px",display:"flex",alignItems:"center",gap:8,
          fontSize:12,color:"#fbbf24",fontWeight:500,
          animation:"slideUpFade .3s ease"
        }}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#F59E0B",flexShrink:0}}/>
          <span>{es?"Sin conexión — sets guardados localmente":"Offline — sets saved locally"}</span>
          {pendingSync.length>0&&(
            <span style={{marginLeft:"auto",background:"#F59E0B22",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>
              {pendingSync.length} pendiente{pendingSync.length>1?"s":""}
            </span>
          )}
        </div>
      )}
      <div style={{padding:"16px 16px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057")}}>
        <div>
          <IronTrackLogo
            size={22}
            color="#2563EB"
            showBar={true}
            mode={(readOnly||esAlumno)?(es?"MODO ALUMNO":"ATHLETE MODE"):(!esAlumno&&sessionData?(es?"MODO ENTRENADOR":"COACH MODE"):null)}
            modeColor={(readOnly||esAlumno)?"#22C55E":"#2563EB"}
          />
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",position:"relative"}}>
          {session&&<span style={{...tag("#22C55E"),fontSize:13}}>✓ Sesion activa</span>}
          <button className="hov" style={{...btn(),padding:"8px",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setSettingsOpen(true)}><Ic name="settings" size={18} color={textMuted}/></button>
          {sessionData&&esAlumno
            ? <>
              <button className="hov" style={{width:36,height:36,background:"linear-gradient(135deg,#1E3A5F,#2563EB)",border:"none",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,fontWeight:800,color:"#fff"}} onClick={()=>setUserMenuOpen(!userMenuOpen)}>
                {(sessionData.name||"U").slice(0,2).toUpperCase()}
              </button>
              {userMenuOpen&&(
                <>
                <div style={{position:"fixed",inset:0,zIndex:40}} onClick={()=>setUserMenuOpen(false)}/>
                <div style={{position:"absolute",top:44,right:0,background:"#111827",border:"1px solid #1E3A5F",borderRadius:12,width:220,overflow:"hidden",zIndex:50,boxShadow:"0 8px 32px rgba(0,0,0,.5)",animation:"fadeIn .2s ease"}}>
                  <div style={{padding:"12px 14px",background:"#0D1520",borderBottom:"1px solid #1a2535"}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{sessionData.name}</div>
                    <div style={{fontSize:11,color:"#475569",marginTop:1}}>{sessionData.email||""}</div>
                  </div>
                  <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",borderBottom:"1px solid #1a2535",fontSize:13,fontWeight:600,color:"#94A3B8"}} onClick={()=>{setUserMenuOpen(false);setSettingsOpen(true)}}>
                    <Ic name="user" size={15} color="#94A3B8"/> {es?"Mi perfil":"My profile"}
                  </div>
                  <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",borderBottom:"1px solid #1a2535",fontSize:13,fontWeight:600,color:"#94A3B8"}} onClick={()=>{setUserMenuOpen(false);setSettingsOpen(true)}}>
                    <Ic name="settings" size={15} color="#94A3B8"/> {es?"Configuración":"Settings"}
                  </div>
                  <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,fontWeight:600,color:"#EF4444"}} onClick={()=>{setUserMenuOpen(false);if(confirm(es?"¿Cerrar sesión?":"Log out?")){localStorage.clear();syncStateWithLocalStorage();}}}>
                    <Ic name="log-out" size={15} color="#EF4444"/> {es?"Cerrar sesión":"Log out"}
                  </div>
                </div>
                </>
              )}
              </>
            : sessionData
              ? <button className="hov" style={{background:"#2563EB22",color:"#2563EB",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{localStorage.clear();syncStateWithLocalStorage();}}>SALIR</button>
              : <button className="hov" style={{...btn(),padding:"4px 8px",fontSize:13}} onClick={()=>setLoginModal(true)}><Ic name="user" size={18}/></button>
          }
        </div>
      </div>
      {timer&&!session&&(
        <div style={{background:bgSub,borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),padding:"8px 16px",display:"flex",alignItems:"center",gap:12}}>
          <svg width={52} height={52} style={{flexShrink:0}}>
            <circle cx={26} cy={26} r={R} fill="none" stroke="#2D4057" strokeWidth={3}/>
            <circle cx={26} cy={26} r={R} fill="none" stroke={timer.remaining<10?"#2563EB":timer.color||"#22C55E"} strokeWidth={3}
              strokeDasharray={circ} strokeDashoffset={circ*(1-timer.remaining/timer.total)}
              style={{transform:"rotate(-90deg)",transformOrigin:"center",transition:"stroke-dashoffset .8s"}}/>
            <text x={26} y={30} textAnchor="middle" fill="#FFFFFF" fontSize={13} fontWeight={700}>{fmt(timer.remaining)}</text>
          </svg>
          <span style={{color:textMuted,fontSize:15,flex:1}}>Pausa activa</span>
          <button className="hov" style={{...btn("#2563EB33"),color:"#2563EB",padding:"4px 8px",fontSize:15}} onClick={()=>{clearInterval(timerRef.current);setTimer(null);}}>Cancelar</button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={e=>{
          const y = e.target.scrollTop;
          const dir = y > lastScrollY.current;
          if(dir && y > 60 && !headerCollapsed) setHeaderCollapsed(true);
          if(!dir && y < 20 && headerCollapsed) setHeaderCollapsed(false);
          lastScrollY.current = y;
        }}
        style={{padding:"12px 16px",overflowY:"auto",height:"calc(100dvh - 130px)",paddingBottom:100,paddingTop:12,display:session&&activeDay?"none":"block",WebkitOverflowScrolling:"touch",scrollBehavior:"smooth"}}>
        {tab==="plan"&&esAlumno&&aliasData?.alias&&<PagoAlumno aliasData={aliasData} es={es} toast2={toast2}/>}
        {tab==="plan"&&(
          <div>
            {!esAlumno&&(
              <CoachDashboard
                {...coachDashboardData}
                students={{
                  students: alumnos.map((a) => {
                    const ver = async () => {
                      setAlumnoActivo(a); setTab("alumnos"); setLoadingSB(true);
                      try {
                        const [ruts, prog, ses] = await Promise.all([sb.getRutinas(a.id), sb.getProgreso(a.id), sb.getSesiones(a.id)]);
                        setRutinasSB(ruts || []); setAlumnoProgreso(prog || []); setAlumnoSesiones(ses || []);
                      } catch (e) { console.error("[onVerAlumno]", e); }
                      setLoadingSB(false);
                    };
                    const chat = () => { setChatModal({ alumnoId: a.id, alumnoNombre: a.nombre || a.email || "Alumno" }); };
                    return {
                      id: a.id,
                      initials: (a.nombre || a.email || "?").slice(0, 2).toUpperCase(),
                      name: a.nombre || a.email || "",
                      subline: "",
                      avatarBg: "rgba(37,99,235,0.12)",
                      avatarColor: "#3B82F6",
                      dotColor: "#22C55E",
                      rateLabel: "",
                      onRowClick: ver,
                      onChart: ver,
                      onMessage: chat,
                    };
                  }),
                }}
                todayAgenda={{
                  sessions: (() => {
                    const hoyStr = new Date().toISOString().slice(0, 10);
                    const sessionesHoy = (sesionesGlobales || []).filter((s) => {
                      const campo = s.fecha || s.created_at || "";
                      return campo.slice(0, 10) === hoyStr;
                    });
                    return sessionesHoy.map((s, i) => {
                      const d = new Date(s.fecha || s.created_at || 0);
                      const alumno = alumnos.find((x) => x.id === s.alumno_id);
                      const h = d.getHours();
                      const m = d.getMinutes();
                      return {
                        id: s.id ?? i,
                        time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                        ampm: h < 12 ? "AM" : "PM",
                        studentName: alumno?.nombre || alumno?.email || "—",
                        detail: es ? "Sesión" : "Session",
                        statusLabel: es ? "Registrada" : "Logged",
                        statusVariant: "done",
                        timeTone: "muted",
                        sessionTypeIcon: "presencial",
                      };
                    });
                  })(),
                }}
              />
            )}
            
            {esAlumno&&routines.length>0&&(()=>{
              const r0 = routines[0];
              const hoy = new Date().toLocaleDateString("es-AR");
              const totalDays = r0?.days?.length||0;
              const daysCompletedThisWeek = completedDays.filter(k=>k.startsWith((r0?.id||"")+"-")&&k.endsWith("-w"+currentWeek)).length;
              // Racha: semanas consecutivas con al menos 1 día entrenado
              const rachaActual = (() => {
                if(!r0) return 0;
                let streak = 0;
                // Semana actual cuenta si ya entrenó algo
                for(let w = currentWeek; w >= 0; w--) {
                  const daysInWeek = completedDays.filter(k =>
                    k.startsWith(r0.id+"-") && k.endsWith("-w"+w)
                  ).length;
                  if(daysInWeek > 0) streak++;
                  else if(w < currentWeek) break; // semana anterior sin días = se rompe la racha
                }
                return streak;
              })();
              const nextDayIdx = daysCompletedThisWeek < totalDays ? daysCompletedThisWeek : null;
              const todayDay = nextDayIdx !== null ? r0?.days?.[nextDayIdx] : null;
              const yaEntrenoHoy = Object.values(progress||{}).some(pg=>(pg.sets||[]).some(s=>s.date===hoy&&(s.week===undefined||s.week===currentWeek)));
              return (
                <div style={{marginBottom:16}}>
                  <div style={{
                    overflow:"hidden",
                    maxHeight:headerCollapsed?"0px":"500px",
                    opacity:headerCollapsed?0:1,
                    transition:"max-height 0.35s cubic-bezier(.4,0,.2,1), opacity 0.25s ease",
                    marginBottom:headerCollapsed?0:10
                  }}>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:13,color:textMuted,fontWeight:500,letterSpacing:0.3}}>
                      {new Date().getHours()<12?(es?"BUENOS DÍAS":"GOOD MORNING"):new Date().getHours()<18?(es?"BUENAS TARDES":"GOOD AFTERNOON"):(es?"BUENAS NOCHES":"GOOD EVENING")}
                    </div>
                    <div style={{fontSize:28,fontWeight:900,color:textMain}}>{sessionData?.name?.split(" ")[0]||"Atleta"}</div>
                    {rachaActual>=2&&(
                      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                        <div style={{
                          display:"flex",alignItems:"center",gap:4,
                          background:"#F59E0B12",border:"1px solid #F59E0B33",
                          borderRadius:20,padding:"3px 10px"
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                          <span style={{fontSize:11,fontWeight:700,color:"#fbbf24"}}>
                            {rachaActual} {es?"semanas seguidas":"weeks straight"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {notaDia&&(
                    <div style={{background:"#2563EB12",border:"1px solid #2563EB33",borderRadius:12,
                      padding:"12px 16px",marginBottom:8,display:"flex",gap:8,alignItems:"flex-start",
                      animation:"slideUpFade 0.4s ease"}}>
                      <span style={{fontSize:18,flexShrink:0}}><Ic name="bookmark" size={16}/></span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#2563EB",letterSpacing:1,
                          marginBottom:4,textTransform:"uppercase"}}>
                          {es?"Nota de tu entrenador":"Coach note"}
                        </div>
                        <div style={{fontSize:15,color:textMain,lineHeight:1.5,fontWeight:400}}>{notaDia}</div>
                      </div>
                    </div>
                  )}
                  <div style={{background:bgCard,borderRadius:12,padding:"12px 16px",marginBottom:8,border:"1px solid "+border}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:800,color:textMuted,letterSpacing:0.3}}>{es?"ESTA SEMANA":"THIS WEEK"}</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#2563EB"}}>{es?"Semana":"Week"} {currentWeek+1} {es?"de":"of"} 4</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
                      <span style={{fontSize:13,fontWeight:900,color:"#2563EB"}}>{daysCompletedThisWeek}/{totalDays} {es?"días":"days"}</span>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      {(r0?.days||[]).map((d,i)=>{
                        const done = completedDays.includes((r0?.id||"")+"-"+i+"-w"+currentWeek);
                        const isNext = i===nextDayIdx;
                        return (
                          <div key={(r0?.id||"rut")+"-sem-pill-d"+i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                            <div style={{width:"100%",height:7,borderRadius:4,background:done?"#22C55E":isNext?"#2563EB":border}}/>
                            <div style={{fontSize:11,fontWeight:700,color:done?"#22C55E":isNext?"#2563EB":textMuted,textTransform:"uppercase"}}>
                              {(d.label||("D"+(i+1))).slice(0,6)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {todayDay&&!yaEntrenoHoy&&!session&&(
                    <div style={{background:"#2563EB11",borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid #243040"}}>
                      <div style={{fontSize:11,fontWeight:800,color:"#2563EB",letterSpacing:2,marginBottom:4}}>{es?"HOY":"TODAY"}</div>
                      <div style={{fontSize:22,fontWeight:900,color:textMain,marginBottom:4}}>{todayDay.label||("Día "+(nextDayIdx+1))}</div>
                      <div style={{fontSize:13,color:textMuted,marginBottom:12}}>{((todayDay.warmup||[]).length+(todayDay.exercises||[]).length)} {es?"ejercicios":"exercises"} · {r0?.name}</div>
                      <button className="hov" style={{width:"100%",padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontSize:18,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>{
                          const snap={};
                          [...(todayDay.warmup||[]),...(todayDay.exercises||[])].forEach(ex=>{snap[ex.id]=progress[ex.id]?.max||0;});
                          setPreSessionPRs({...snap});
                          setSessionPRList([]);setSession({rId:r0.id,dIdx:nextDayIdx,exIdx:0,startTime:Date.now()});
                        }}>
                        <Ic name="zap" size={16}/> {es?"EMPEZAR AHORA":"START NOW"}
                      </button>
                    </div>
                  )}
                  {yaEntrenoHoy&&!session&&(
                    <div style={{background:"#22C55E12",borderRadius:12,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:28}}>✅</span>
                      <div>
                        <div style={{fontSize:15,fontWeight:900,color:"#22C55E"}}>{es?"¡Entrenamiento completado!":"Workout done!"}</div>
                        <div style={{fontSize:13,color:textMuted}}>{es?"Descansá 💪":"Rest up 💪"}</div>
                      </div>
                    </div>
                  )}
                  </div>
                  {headerCollapsed&&(
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                      marginBottom:8,animation:"fadeIn 0.2s ease"}}>
                      <div style={{fontSize:15,fontWeight:700,color:textMain}}>
                        {sessionData?.name?.split(" ")[0]||"Atleta"}
                      </div>
                      {todayDay&&!yaEntrenoHoy&&!session&&(
                        <button className="hov"
                          style={{background:"#2563EB",color:"#fff",border:"none",
                            borderRadius:8,padding:"8px 14px",fontSize:13,
                            fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                          onClick={()=>{
                            const snap={};
                            [...(todayDay.warmup||[]),...(todayDay.exercises||[])].forEach(ex=>{snap[ex.id]=progress[ex.id]?.max||0;});
                            setPreSessionPRs({...snap});
                            setSessionPRList([]);setSession({rId:r0.id,dIdx:nextDayIdx,exIdx:0,startTime:Date.now()});
                          }}>
                          ⚡ {es?"Entrenar":"Train"}
                        </button>
                      )}
                      {yaEntrenoHoy&&<span style={{fontSize:13,color:"#22C55E",fontWeight:600}}>✅ {es?"Listo hoy":"Done today"}</span>}
                    </div>
                  )}
                  <div style={{display:"none"}}/>
                </div>
              );
            })()}

            {esAlumno&&routines.length===0&&(
              <div style={{textAlign:"center",padding:"60px 0",color:textMuted}}>
                <div style={{fontSize:48,marginBottom:12}}>📋</div>
                <div style={{fontSize:22,fontWeight:700,letterSpacing:1,marginBottom:8}}>{es?"Sin rutinas aun":"No routines yet"}</div>
                <div style={{fontSize:15}}>{es?"Crea tu primera rutina en RUTINAS":"Create your first routine in ROUTINES"}</div>
              </div>
            )}
            {esAlumno&&routines.length>0&&routines.map(r=>{
              return (<div key={r.id} style={{marginBottom:16}}>
                  <div style={{fontSize:28,fontWeight:800,letterSpacing:1,marginBottom:4}}>{r.name}</div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{fontSize:15,color:textMuted}}>{r.created} · {r.days.length} {es?"dias":"days"}{r.note?" · "+r.note:""}</div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",border:"1px solid "+border,color:textMain,borderRadius:8,padding:"8px 12px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}} onClick={()=>generatePDF(r)}>
                        <Ic name="file-text" size={14}/> PDF
                      </button>
                    </div>
                  </div>
                  {r.days.map((d,di)=>{
                    const dayKey=r.id+"-"+di+"-w"+currentWeek;
                    const isDayDone=completedDays.includes(dayKey);
                    const daysCompletedR=completedDays.filter(k=>k.startsWith(r.id+"-")&&k.endsWith("-w"+currentWeek)).length;
                    const localNextDayIdx=daysCompletedR < r.days.length ? daysCompletedR : null;
                    const isNextDay=di===localNextDayIdx;
                    const isFuture=localNextDayIdx!==null&&di>localNextDayIdx;
                    const totalEj=((d.warmup||[]).length+(d.exercises||[]).length);
                    const isOpen=expandedPlanDay===r.id+"-"+di;
                    const exNames=(d.exercises||[]).slice(0,3).map(function(ex){var inf=allEx.find(function(e){return e.id===ex.id});return inf?(es?inf.name:(inf.nameEn||inf.name)):ex.id}).join(", ");

                    return(
                      <div key={r.id+"-plan-day-"+di} style={{background:bgCard,border:"1px solid "+(isNextDay?"#2563EB":isDayDone?"#22C55E44":border),borderRadius:12,marginBottom:8,overflow:"hidden"}}>
                        {/* Header del día - siempre visible */}
                        <div onClick={function(){setExpandedPlanDay(isOpen?null:r.id+"-"+di)}} style={{padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0,
                            background:isDayDone?"#22C55E22":isNextDay?"#2563EB22":bgSub,
                            color:isDayDone?"#22C55E":isNextDay?"#2563EB":textMuted,
                            border:"1px solid "+(isDayDone?"#22C55E44":isNextDay?"#2563EB44":border)}}>
                            {isDayDone?"✓":(di+1)}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:15,fontWeight:700,color:textMain}}>{d.label||((es?"Día ":"Day ")+(di+1))}</div>
                            <div style={{fontSize:12,color:textMuted,marginTop:1}}>
                              {totalEj} {es?"ejercicios":"exercises"}{!isOpen&&exNames?" · "+exNames:""}
                            </div>
                          </div>
                          {isDayDone&&<span style={{fontSize:11,fontWeight:700,color:"#22C55E",flexShrink:0}}>{es?"Listo":"Done"}</span>}
                          {isNextDay&&!isDayDone&&<span style={{fontSize:11,fontWeight:700,color:"#2563EB",flexShrink:0}}>{es?"Siguiente":"Next"}</span>}
                          <span style={{fontSize:13,color:textMuted,flexShrink:0}}>{isOpen?"▲":"▼"}</span>
                        </div>

                        {/* Contenido expandido */}
                        {isOpen&&(
                          <div style={{padding:"0 14px 14px",borderTop:"1px solid "+border}}>
                            {(d.warmup||[]).length>0&&(
                              <div style={{marginTop:8,marginBottom:8}}>
                                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                                  <span style={{width:3,height:12,borderRadius:2,background:"#F59E0B"}}/>
                                  <span style={{fontSize:11,fontWeight:700,color:"#F59E0B",letterSpacing:1}}>{es?"ENTRADA EN CALOR":"WARM-UP"}</span>
                                </div>
                                {(d.warmup||[]).map(function(ex,ei){
                                  var inf=allEx.find(function(e){return e.id===ex.id});
                                  var vUrl=(videoOverrides&&videoOverrides[ex.id])||inf?.youtube||"";
                                  return(
                                    <div key={r.id+"-d"+di+"-wu-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:ei<(d.warmup||[]).length-1?"1px solid "+border:"none"}}>
                                      <div style={{width:3,height:20,borderRadius:2,background:"#F59E0B44",flexShrink:0}}/>
                                      <div style={{flex:1,fontSize:16,fontWeight:700,color:textMain}}>{es?inf?.name:(inf?.nameEn||inf?.name||ex.id)}</div>
                                      <span style={{fontSize:13,color:"#A3B4CC",fontWeight:600}}>{ex.sets||"-"}×{ex.reps||"-"}</span>
                                      {vUrl&&<button onClick={function(){var vid=getYTVideoId(vUrl);if(vid)setVideoModal({videoId:vid,nombre:es?inf?.name:(inf?.nameEn||inf?.name)});else window.open(vUrl,"_blank")}} style={{background:"#EF4444",color:"#fff",border:"none",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>▶</button>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{marginBottom:8}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                                <span style={{width:3,height:12,borderRadius:2,background:"#2563EB"}}/>
                                <span style={{fontSize:11,fontWeight:700,color:"#2563EB",letterSpacing:1}}>{es?"BLOQUE PRINCIPAL":"MAIN BLOCK"}</span>
                              </div>
                              {d.exercises.map(function(ex,ei){
                                var inf=allEx.find(function(e){return e.id===ex.id});
                                var vUrl=(videoOverrides&&videoOverrides[ex.id])||inf?.youtube||"";
                                var w=((ex.weeks||[])[currentWeek])||{};
                                var s=w.sets||ex.sets||"-";
                                var rp=w.reps||ex.reps||"-";
                                var kg2=w.kg||ex.kg||"";
                                return(
                                  <div key={r.id+"-d"+di+"-ex-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:ei<d.exercises.length-1?"1px solid "+border:"none"}}>
                                    <div style={{width:3,height:24,borderRadius:2,background:border,flexShrink:0}}/>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:17,fontWeight:800,color:textMain}}>{es?inf?.name:(inf?.nameEn||inf?.name||ex.id)}</div>
                                      <div style={{fontSize:13,color:"#A3B4CC",fontWeight:500,marginTop:2,display:"flex",gap:6,flexWrap:"wrap"}}>
                                        <span style={{fontWeight:700}}>{s}×{rp}</span>{kg2&&<span>{kg2}kg</span>}{ex.pause&&<span>⏱ {fmtP(ex.pause)}</span>}
                                      </div>
                                    </div>
                                    {vUrl&&<button onClick={function(){var vid=getYTVideoId(vUrl);if(vid)setVideoModal({videoId:vid,nombre:es?inf?.name:(inf?.nameEn||inf?.name)});else window.open(vUrl,"_blank")}} style={{background:"#EF4444",color:"#fff",border:"none",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>▶</button>}
                                  </div>
                                );
                              })}
                            </div>
                            {/* Botón iniciar/estado del día */}
                            {isDayDone&&(
                              <div style={{textAlign:"center",padding:"8px",color:"#22C55E",fontSize:13,fontWeight:700}}>
                                ✅ {es?"Día completado esta semana":"Day completed this week"}
                              </div>
                            )}
                            {isNextDay&&!isDayDone&&(
                              <button className="hov" style={{width:"100%",marginTop:4,padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,letterSpacing:1,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){
                                var snap={};
                                [].concat(d.warmup||[],d.exercises||[]).forEach(function(ex){snap[ex.id]=progress[ex.id]?.max||0});
                                setPreSessionPRs(snap);
                                setSessionPRList([]);setSession({rId:r.id,dIdx:di,exIdx:0,startTime:Date.now()});
                              }}>{es?"INICIAR ENTRENAMIENTO":"START WORKOUT"}</button>
                            )}
                            {isFuture&&(
                              <div style={{textAlign:"center",padding:"8px",color:textMuted,fontSize:12,fontWeight:700,background:bgSub,borderRadius:8,marginTop:4}}>
                                <Ic name="lock" size={13}/> {es?"Completá el Día "+(localNextDayIdx+1)+" primero":"Complete Day "+(localNextDayIdx+1)+" first"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                    background:bgCard,borderRadius:12,padding:"8px 16px",border:"1px solid "+border,
                    marginBottom:4}}>
                    <button className="hov"
                      onClick={()=>currentWeek>0&&setCurrentWeek(w=>w-1)}
                      style={{width:36,height:36,borderRadius:8,border:"1px solid "+border,
                        background:currentWeek>0?bgSub:"transparent",
                        color:currentWeek>0?textMain:border,
                        fontSize:18,cursor:currentWeek>0?"pointer":"default",
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
                    <div style={{flex:1,textAlign:"center",padding:"0 8px"}}>
                      <div style={{fontSize:15,fontWeight:700,color:textMain,marginBottom:8}}>
                        {es?"Semana":"Week"} <span style={{color:"#2563EB",fontWeight:800}}>{currentWeek+1}</span>
                        <span style={{fontSize:11,color:textMuted,fontWeight:400,marginLeft:8}}>
                          {completedDays.filter(k=>k.startsWith(r.id+"-")&&k.endsWith("-w"+currentWeek)).length}/{r.days.length} {es?"días":"days"}
                        </span>
                      </div>
                      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                        {[0,1,2,3].map(w=>{
                          const done=completedDays.filter(k=>k.startsWith(r.id+"-")&&k.endsWith("-w"+w)).length>0;
                          const active=w===currentWeek;
                          return(
                            <div key={w} onClick={()=>setCurrentWeek(w)} className="hov"
                              style={{height:4,borderRadius:2,transition:"all .25s ease",cursor:"pointer",
                                width:active?24:8,
                                background:active?"#2563EB":done?"#22C55E":"#2D4057"}}/>
                          );
                        })}
                      </div>
                    </div>

                    <button className="hov"
                      onClick={()=>currentWeek<3&&setCurrentWeek(w=>w+1)}
                      style={{width:36,height:36,borderRadius:8,border:"1px solid "+border,
                        background:currentWeek<3?bgSub:"transparent",
                        color:currentWeek<3?textMain:border,
                        fontSize:18,cursor:currentWeek<3?"pointer":"default",
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>›</button>
                  </div>

                  {/* Sparkline de tendencia 30 días */}
                {(()=>{
                  const setsAlu = Object.values(progress||{})
                    .flatMap(pg => (pg.sets||[]))
                    .filter(s => s.kg > 0)
                    .sort((x,y) => new Date(x.date||0) - new Date(y.date||0));
                  if(setsAlu.length < 3) return null;
                  // Agrupar por semana relativa (últimas 8 semanas)
                  const now = Date.now();
                  const buckets = {};
                  setsAlu.forEach(s => {
                    const d = new Date(s.date||now);
                    const weekAgo = Math.floor((now - d.getTime()) / (7*24*60*60*1000));
                    const bucket = Math.min(weekAgo, 7);
                    if(!buckets[bucket]) buckets[bucket] = [];
                    buckets[bucket].push(s.kg);
                  });
                  const weeks = Array.from({length:8},(_,i)=>7-i);
                  const data = weeks.map(w => {
                    const vals = buckets[w];
                    return vals ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
                  }).filter(v => v !== null);
                  if(data.length < 2) return null;
                  const first = data[0], last = data[data.length-1];
                  const pct = first>0 ? Math.round((last-first)/first*100) : 0;
                  const color = pct > 0 ? "#22C55E" : pct < -2 ? "#F59E0B" : "#2563EB";
                  const fill  = pct > 0 ? "rgba(34,197,94,.1)" : pct < -2 ? "rgba(245,158,11,.08)" : "rgba(37,99,235,.08)";
                  const min = Math.min(...data), max = Math.max(...data), range = max-min||1;
                  const W=120, H=24, pad=2;
                  const pts = data.map((v,i)=>({
                    x: pad + (i/(data.length-1))*(W-pad*2),
                    y: H - pad - ((v-min)/range)*(H-pad*2)
                  }));
                  const pathD = pts.map((p,i)=>(i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`)).join(' ');
                  const areaD = `M${pts[0].x},${H} ${pathD} L${pts[pts.length-1].x},${H} Z`;
                  return (
                    <div style={{
                      display:"flex",alignItems:"center",gap:8,
                      marginLeft:46,marginTop:6,
                      padding:"5px 8px",borderRadius:8,
                      background:_dm?"#162234":"#EEF2F7"
                    }}>
                      <span style={{fontSize:9,color:textMuted,fontWeight:600,whiteSpace:"nowrap"}}>
                        {es?"30d carga":"30d load"}
                      </span>
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{flex:1}}>
                        <path d={areaD} fill={fill}/>
                        <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
                        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="2.5" fill={color}/>
                      </svg>
                      <span style={{
                        fontSize:10,fontWeight:700,color,
                        whiteSpace:"nowrap",minWidth:30,textAlign:"right"
                      }}>
                        {pct>0?"+":""}{pct}%
                      </span>
                    </div>
                  );
                })()}
                </div>
              );
            })}
          </div>
        )}
        {tab==="library"&&(
          <div>
            {esAlumno && <LibraryAlumno allEx={allEx} darkMode={darkMode} es={es} routines={routines} videoOverrides={videoOverrides} setVideoModal={setVideoModal}/>}
            {!esAlumno && <GestionBiblioteca darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} es={es} setTab={setTab} videoOverrides={videoOverrides} setVideoOverrides={setVideoOverrides} setVideoModal={setVideoModal}/>}
          </div>
        )}
        {tab==="routines"&&!esAlumno&&(
          <RutinaView
            setTab={setTab}
            border={border}
            textMuted={textMuted}
            bgCard={bgCard}
            textMain={textMain}
            darkMode={darkMode}
            bgSub={bgSub}
            es={es}
            setFiltroRut={setFiltroRut}
            btn={btn}
            card={card}
            setNewR={setNewR}
            routines={routines}
            setRoutines={setRoutines}
            allEx={allEx}
            PATS={PATS}
            setEditEx={setEditEx}
            toast2={toast2}
            setAddExModal={setAddExModal}
            setAddExSearch={setAddExSearch}
            setAddExPat={setAddExPat}
            setAddExSelectedIds={setAddExSelectedIds}
            setDupDayModal={setDupDayModal}
            alumnos={alumnos}
            sb={sb}
            setAssignRoutineId={setAssignRoutineId}
          />
        )}
        {tab==="scanner"&&!esAlumno&&(
          <div>
            <ScannerRutina darkMode={darkMode} sb={sb} setRoutines={setRoutines} alumnos={alumnos} toast2={toast2} es={es} setTab={setTab} user={user} customEx={customEx}/>
          </div>
        )}
        {tab==="biblioteca"&&!esAlumno&&(
          <div>
            <GestionBiblioteca darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} es={es} setTab={setTab} videoOverrides={videoOverrides} setVideoOverrides={setVideoOverrides} setVideoModal={setVideoModal}/>
          </div>
        )}
        {tab==="progress"&&(readOnly||esAlumno)&&(sharedParam||sessionData?.alumnoId)&&(
          <div style={{marginBottom:24}}>
            <div style={{fontSize:15,fontWeight:800,letterSpacing:1,marginBottom:8,color:textMain}}>🏋️ MIS SESIONES</div>
            <HistorialSesiones sessionData={sessionData} darkMode={darkMode} sharedParam={sharedParam||btoa(JSON.stringify({alumnoId:sessionData?.alumnoId}))} sb={sb} EX={EX}
          es={es} sesiones={sesiones}/>
            <div style={{fontSize:15,fontWeight:800,letterSpacing:1,margin:"20px 0 10px",color:textMain}}><Ic name="image" size={16}/> FOTOS DE PROGRESO</div>
            <FotosProgreso darkMode={darkMode} sharedParam={sharedParam||btoa(JSON.stringify({alumnoId:sessionData?.alumnoId}))} sb={sb} esEntrenador={false}
          es={es} toast2={toast2} sessionData={sessionData} progress={progress}/>
          </div>
        )}
        {tab==="scanner"&&!esAlumno&&(
          <div>
            <ScannerRutina darkMode={darkMode} sb={sb} setRoutines={setRoutines} alumnos={alumnos} toast2={toast2} es={es} setTab={setTab} user={user} customEx={customEx}/>
          </div>
        )}
        {tab==="biblioteca"&&!esAlumno&&(
          <div>
            <GestionBiblioteca darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} es={es} setTab={setTab} videoOverrides={videoOverrides} setVideoOverrides={setVideoOverrides} setVideoModal={setVideoModal}/>
          </div>
        )}
        {tab==="progress"&&(
          <div style={{marginBottom:24}}>
            <div style={{fontSize:15,fontWeight:800,letterSpacing:1,marginBottom:8,color:textMain}}><Ic name="bar-chart-2" size={16}/> GRÁFICO DE PROGRESO</div>
            <GraficoProgreso allEx={allEx} es={es} darkMode={darkMode} progress={progress} EX={EX} readOnly={readOnly||esAlumno} sharedParam={sharedParam} sb={sb} sessionData={sessionData} sesiones={sesiones}/>
          </div>
        )}
        {tab==="scanner"&&!esAlumno&&(
          <div>
            <ScannerRutina darkMode={darkMode} sb={sb} setRoutines={setRoutines} alumnos={alumnos} toast2={toast2} es={es} setTab={setTab} user={user} customEx={customEx}/>
          </div>
        )}
        {tab==="biblioteca"&&!esAlumno&&(
          <div>
            <GestionBiblioteca darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} es={es} setTab={setTab} videoOverrides={videoOverrides} setVideoOverrides={setVideoOverrides} setVideoModal={setVideoModal}/>
          </div>
        )}
        {tab==="progress"&&(
          <div>
            {EX.filter(ex=>progress[ex.id]?.sets?.length>0).map(ex=>{
              const pat=PATS[ex.pattern]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"}; const pg=progress[ex.id];
              return(
                <div key={ex.id} className="hov" style={{...card,cursor:"pointer"}} onClick={()=>setDetailEx(ex)}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:22}}>{pat.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:18,fontWeight:700}}>{es?ex.name:ex.nameEn}</div>
                      <div style={{fontSize:13,color:textMuted}}>{ex.muscle}</div>
                    </div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:700,color:pat.color}}>{pg.max}kg</div><div style={{fontSize:13,color:textMuted}}>max</div></div>
                  </div>
                  <div style={{display:"flex",gap:4,overflowX:"auto"}}>
                    {(pg.sets||[]).slice(0,5).map((s2,i)=>(
                      <div key={ex.id+"-pg-mini-"+(s2.date||"")+"-"+(s2.kg??"")+"-"+(s2.reps??"")+"-"+i} style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:6,padding:"4px 8px",flexShrink:0,fontSize:13}}>
                        <div style={{fontWeight:700}}>{s2.kg}kg x {s2.reps}</div>
                        <div style={{color:textMuted,fontSize:13}}>{s2.date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* ── Rutinas asignadas (Supabase) ── */}
            {rutinasSBEntrenador.length>0&&(<div style={{marginTop:16}}>
              <div style={{fontSize:11,fontWeight:800,color:"#22C55E",letterSpacing:2,marginBottom:8,textTransform:"uppercase",borderLeft:"3px solid #22C55E",paddingLeft:8}}>{es?"RUTINAS ASIGNADAS":"ASSIGNED ROUTINES"} ({rutinasSBEntrenador.length})</div>
              {rutinasSBEntrenador.map(function(rSB,ri){
                var alumnoInfo=alumnos.find(function(al){return al.id===rSB.alumno_id});
                var diasSB=rSB.datos?.days||[];
                return(<div key={rSB.id||ri} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid "+border}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:18,fontWeight:800,color:textMain}}>{rSB.nombre}</div>
                        <span style={{background:"#22C55E22",color:"#22C55E",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>☁️</span>
                      </div>
                      {alumnoInfo&&<div style={{fontSize:13,fontWeight:700,color:textMuted,marginTop:2}}>👤 {alumnoInfo.nombre||alumnoInfo.email}</div>}
                      <div style={{fontSize:13,color:textMuted}}>{diasSB.length} {es?"días":"days"}</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="hov" style={{background:"#2563EB22",color:"#2563EB",border:"none",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){var rutLocal={id:rSB.id,...(rSB.datos||{}),name:rSB.nombre,saved:true,alumno_id:rSB.alumno_id,alumno:alumnoInfo?.nombre||""};setRoutines(function(p){var ex=p.find(function(x){return x.id===rSB.id});return ex?p:[rutLocal,...p]});toast2(es?"Abierta para editar":"Opened for editing");}}>{es?"Editar":"Edit"}</button>
                      <button className="hov" style={{background:"#22C55E22",color:"#22C55E",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){var newId=uid();var copia={id:newId,name:rSB.nombre+" (copia)",days:(rSB.datos?.days||[]).map(function(d){return{...d,warmup:(d.warmup||[]).map(function(e){return{...e}}),exercises:(d.exercises||[]).map(function(e){return{...e}})}}),collapsed:false,saved:false};setRoutines(function(p){return[...p,copia]});setAssignRoutineId(newId);toast2(es?"Duplicada":"Duplicated");}}><Ic name="copy" size={14}/></button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>{diasSB.map(function(d,di){return(<span key={(rSB.id||"rut")+"-dchip-"+di} style={{background:bgSub,borderRadius:6,padding:"2px 8px",fontSize:11,color:textMuted,fontWeight:600}}>{d.label||("Día "+(di+1))} · {((d.warmup||[]).length+(d.exercises||[]).length)} ej.</span>)})}</div>
                </div>);
              })}
            </div>)}
            {Object.keys(progress).length===0&&(
              <div style={{textAlign:"center",padding:"60px 0",color:textMuted}}>
                <div style={{fontSize:48,marginBottom:12}}>📊</div>
                <div style={{fontSize:22,fontWeight:700,letterSpacing:1}}>{es?"Sin registros aun":"No records yet"}</div>
              </div>
            )}
          </div>
        )}
        {tab==="alumnos"&&sessionData?.role==="entrenador"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:22,fontWeight:800,letterSpacing:1,color:textMain}}><Ic name="users" size={18}/> {es?"MIS ALUMNOS":"MY ATHLETES"}</div>
              <div style={{display:"flex",gap:8}}>
                <button className="hov" style={{background:"#162234",color:textMuted,border:"1px solid "+border,borderRadius:8,padding:"8px 8px",fontSize:13,cursor:"pointer"}} onClick={()=>setAliasModal(true)} aria-label={es?"Datos de pago":"Payment info"}><Ic name="share" size={16}/></button>
                <button className="hov" style={{background:"#162234",color:textMuted,border:"1px solid "+border,borderRadius:8,padding:"8px 8px",fontSize:13,cursor:"pointer"}} onClick={cargarAlumnos} aria-label={es?"Actualizar":"Refresh"}><Ic name="refresh-cw" size={16}/></button>
                <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setNewAlumnoForm(true)}>+ {es?"Nuevo":"New"}</button>
              </div>
            </div>

            {routines.length>0&&(
              <div style={{marginBottom:12,padding:"12px 14px",background:bgSub,borderRadius:12,border:"1px solid "+border}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:0.8,color:"#2563EB",marginBottom:8}}>{es?"RUTINA QUE SE ASIGNA AL TOCAR «ASIGNAR»":"ROUTINE USED WHEN YOU TAP «ASSIGN»"}</div>
                {routines.length===1 ? (
                  <div style={{fontSize:16,fontWeight:700,color:textMain}}>{routines[0].name}</div>
                ) : (
                  <select
                    style={{width:"100%",background:bgCard,color:textMain,border:"1px solid "+border,borderRadius:10,padding:"10px 12px",fontSize:15,fontWeight:600,fontFamily:"inherit",cursor:"pointer",outline:"none"}}
                    value={routineForAssign?.id||""}
                    onChange={function(e){setAssignRoutineId(e.target.value);}}>
                    {routines.map(function(r){
                      return <option key={r.id} value={r.id}>{r.name||"—"} · {(r.days||[]).length} {es?"días":"days"}</option>;
                    })}
                  </select>
                )}
                <div style={{fontSize:12,color:textMuted,marginTop:6}}>{es?"Creá o editá rutinas en RUTINAS. Con varias listas, elegí cuál mandar acá.":"Create or edit routines under ROUTINES. If you have several, pick which one to send."}</div>
              </div>
            )}

            {newAlumnoForm&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}}>
                <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxWidth:480,paddingBottom:32}} onClick={e=>e.stopPropagation()}>
                  <div style={{fontSize:15,fontWeight:800,letterSpacing:1,marginBottom:16,color:textMain}}>{es?"NUEVO ALUMNO":"NEW ATHLETE"}</div>
                  <div style={{marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>{es?"NOMBRE":"NAME"}</span>
                    <input
                      style={{background:bgSub,color:textMain,
                        border:"1px solid "+(newAlumnoErrors.nombre?"#EF4444":newAlumnoData.nombre.trim().length>1?"#22C55E":border),
                        borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15,
                        transition:"border-color .2s ease",outline:"none"}}
                      value={newAlumnoData.nombre}
                      onChange={e=>{setNewAlumnoData(p=>({...p,nombre:e.target.value}));if(e.target.value.trim().length>1)setNewAlumnoErrors(p=>({...p,nombre:false}));}}
                      onBlur={e=>{if(!e.target.value.trim())setNewAlumnoErrors(p=>({...p,nombre:true}));}}
                      placeholder={es?"Nombre completo":"Full name"}/>
                    {newAlumnoErrors.nombre&&<div style={{fontSize:11,color:"#EF4444",marginTop:4,fontWeight:700}}><Ic name="alert-triangle" size={14} color="#F59E0B"/> {es?"El nombre es obligatorio":"Name is required"}</div>}
                  </div>
                  <div style={{marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>EMAIL</span>
                    <input
                      style={{background:bgSub,color:textMain,
                        border:"1px solid "+(newAlumnoErrors.email?"#EF4444":/^[^@]+@[^@]+\.[^@]+$/.test(newAlumnoData.email)?"#22C55E":border),
                        borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15,
                        transition:"border-color .2s ease",outline:"none"}}
                      value={newAlumnoData.email} type="email"
                      onChange={e=>{setNewAlumnoData(p=>({...p,email:e.target.value}));if(/^[^@]+@[^@]+\.[^@]+$/.test(e.target.value))setNewAlumnoErrors(p=>({...p,email:false}));}}
                      onBlur={e=>{if(!/^[^@]+@[^@]+\.[^@]+$/.test(e.target.value))setNewAlumnoErrors(p=>({...p,email:true}));}}
                      placeholder="email@ejemplo.com"/>
                    {newAlumnoErrors.email&&<div style={{fontSize:11,color:"#EF4444",marginTop:4,fontWeight:700}}><Ic name="alert-triangle" size={14} color="#F59E0B"/> {es?"Email inválido (ej: nombre@mail.com)":"Invalid email (e.g. name@mail.com)"}</div>}
                  </div>
                  <div style={{marginBottom:16}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>{es?"CONTRASEÑA":"PASSWORD"}</span>
                    <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15}} value={newAlumnoData.pass} onChange={e=>setNewAlumnoData(p=>({...p,pass:e.target.value}))} placeholder="Contraseña" type="password"/>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="hov" style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:12,padding:"12px 16px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}}>{es?"Cancelar":"Cancel"}</button>
                    <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"12px 16px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flex:1}} onClick={async()=>{
                      const errNom = !newAlumnoData.nombre.trim();
                      const errEm = !/^[^@]+@[^@]+\.[^@]+$/.test(newAlumnoData.email);
                      if(errNom||errEm){setNewAlumnoErrors({nombre:errNom,email:errEm});return;}
                      setLoadingSB(true);
                      const res = await sb.createAlumno({nombre:newAlumnoData.nombre.trim(),email:newAlumnoData.email.trim(),password:newAlumnoData.pass.trim()||"irontrack2024",entrenador_id:ENTRENADOR_ID});
                      if(res&&res[0]){setAlumnos(prev=>[...prev,res[0]]);toast2(es?"Alumno creado ✓":"Athlete created ✓");setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}
                      else{toast2("Error al crear alumno");}
                      setLoadingSB(false);
                    }}>GUARDAR</button>
                  </div>
                </div>
              </div>
            )}

            {loadingSB&&(
              <div>
                {[1,2,3].map(i=>(
                  <div key={"alumno-list-skel-"+i} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid "+border}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{flex:1}}>
                        <div className="sk" style={{height:16,width:"55%",marginBottom:8}}/>
                        <div className="sk" style={{height:12,width:"35%"}}/>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <div className="sk" style={{width:32,height:32,borderRadius:8}}/>
                        <div className="sk" style={{width:52,height:32,borderRadius:8}}/>
                        <div className="sk" style={{width:32,height:32,borderRadius:8}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {alumnos.length===0&&!loadingSB&&(
              <div style={{textAlign:"center",padding:"30px 0",color:textMuted}}>
                <div style={{fontSize:36,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Ic name="users" size={34} color={textMuted}/>
                </div>
                <div style={{fontSize:15,fontWeight:700}}>{es?"Sin alumnos aún":"No athletes yet"}</div>
              </div>
            )}

            {alumnos.map(a=>(
              <div key={a.id} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:alumnoActivo?.id===a.id?"1px solid #2563EB":"1px solid "+border}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:alumnoActivo?.id===a.id?8:0,gap:8}}>
  <div style={{flex:1,minWidth:0}}>
    <div style={{fontSize:18,fontWeight:700,color:textMain,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.nombre}</div>
    <div style={{fontSize:13,color:textMuted,lineHeight:1.5,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.email}</div>
  </div>
  <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                    <button
                      className="hov"
                      style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:8,padding:"4px 8px",fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}
                      onClick={()=>{if(!confirm(es?"¿Editar alumno?":"Edit athlete?")) return; setEditAlumnoModal(a);setEditAlumnoEmail(a.email);setEditAlumnoPass("");}}
                      aria-label={es?"Editar alumno":"Edit athlete"}
                    >
                      <Ic name="edit-2" size={16} color={textMuted}/>
                    </button>
                    <button
                      className="hov"
                      style={{background:"#2563EB22",color:"#2563EB",border:"1px solid #2563EB33",borderRadius:8,padding:"4px 8px",fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}
                      onClick={function(e){e.stopPropagation();console.log("[CHAT] abriendo para",a.id,a.nombre);setChatModal({alumnoId:a.id,alumnoNombre:a.nombre||a.email||"Alumno"});}}
                      aria-label={es?"Abrir chat":"Open chat"}
                    >
                      <Ic name="message-circle" size={16} color="#2563EB"/>
                    </button>
                    <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"4px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={async()=>{
                      if(alumnoActivo?.id===a.id){setAlumnoActivo(null);return;}
                      setAlumnoActivo(a);setRegistrosSubTab(0);setLoadingSB(true);
                      const ruts=await sb.getRutinas(a.id);setRutinasSB(ruts||[]);
                      const prog=await sb.getProgreso(a.id);setAlumnoProgreso(prog||[]);
                      const ses=await sb.getSesiones(a.id);setAlumnoSesiones(ses||[]);
                      setLoadingSB(false);
                    }}>{alumnoActivo?.id===a.id?"CERRAR":"VER"}</button>
                    <button className="hov" style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:8,padding:"4px 8px",fontSize:13,cursor:"pointer"}} onClick={async()=>{
                      if(!confirm("Eliminar a "+a.nombre+"?")) return;
                      await sb.deleteAlumno?.(a.id);setAlumnos(prev=>prev.filter(x=>x.id!==a.id));toast2("Alumno eliminado");
                    }}><Ic name="trash-2" size={15}/></button>
                  </div>
                </div>
                {alumnoActivo?.id===a.id&&(
                  <div>
                    {(()=>{
                      const rutinaActiva=rutinasSB.find(r=>r.alumno_id===a.id);
                      if(!rutinaActiva) return <div style={{background:bgSub,borderRadius:12,padding:"16px",marginBottom:8,textAlign:"center",border:"1px solid "+border}}><div style={{fontSize:13,color:textMuted}}>{es?"Sin rutina asignada":"No routine assigned"}</div></div>;
                      const dias=rutinaActiva.datos?.days||[];
                      return(
                        <div style={{marginBottom:8}}>
                          <div style={{background:bgCard,border:"1px solid "+border,borderRadius:12,padding:"16px"}}>
                            <div style={{fontSize:11,fontWeight:800,color:"#2563EB",letterSpacing:2,marginBottom:4,textTransform:"uppercase"}}>{es?"RUTINA ACTIVA":"ACTIVE ROUTINE"}</div>
                            <div style={{fontSize:22,fontWeight:900,color:textMain}}>{rutinaActiva.nombre}</div>
                            <div style={{fontSize:13,color:textMuted,lineHeight:1.5,marginTop:4}}>{dias.length} {es?"días":"days"}</div>
                            {/* ── Info de semana ── */}
                            {(()=>{
                              // Usar currentWeek global (sincronizado con el alumno)
                              const semanaCiclo = currentWeek + 1;
                              // Días completados esta semana desde completedDays
                              const rId = rutinaActiva.id;
                              const diasCompletados = completedDays.filter(function(k){return k.startsWith(rId+"-") && k.endsWith("-w"+currentWeek)}).length;
                              // Semana calendario (corregido para fin de mes)
                              const hoyDate = new Date();
                              const inicioSemana = new Date(hoyDate);
                              inicioSemana.setDate(hoyDate.getDate() - ((hoyDate.getDay()+6)%7));
                              const finSemana = new Date(inicioSemana);
                              finSemana.setDate(inicioSemana.getDate() + 6);
                              const semCalLabel = inicioSemana.getDate() + "/" + (inicioSemana.getMonth()+1) + " — " + finSemana.getDate() + "/" + (finSemana.getMonth()+1);
                              return (
                                <>
                                <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                                  <div style={{background:"#2563EB15",border:"1px solid #2563EB33",borderRadius:8,padding:"4px 10px",display:"flex",alignItems:"center",gap:4}}>
                                    <Ic name="calendar" size={14} color="#2563EB"/>
                                    <span style={{fontSize:12,fontWeight:800,color:"#2563EB"}}>{es?"Semana":"Week"} {semanaCiclo} {es?"de":"of"} 4</span>
                                  </div>
                                  <div style={{background:bgSub,border:"1px solid "+border,borderRadius:8,padding:"4px 10px",display:"flex",alignItems:"center",gap:4}}>
                                    <span style={{fontSize:12,fontWeight:700,color:textMuted}}>{diasCompletados}/{dias.length} {es?"días":"days"}</span>
                                  </div>
                                  <div style={{background:bgSub,border:"1px solid "+border,borderRadius:8,padding:"4px 10px",display:"flex",alignItems:"center",gap:4}}>
                                    <span style={{fontSize:11,color:textMuted}}>{es?"Sem. cal:":"Cal. wk:"} {semCalLabel}</span>
                                  </div>
                                </div>
                                <div style={{marginTop:8,background:"#2563EB08",border:"1px solid #2563EB22",borderRadius:8,padding:"8px 10px",display:"flex",alignItems:"center",gap:6}}>
                                  <Ic name="chevron-right" size={14} color={textMain}/>
                                  <span style={{fontSize:13,fontWeight:700,color:textMain}}>
                                    {es?"Próxima sesión:":"Next session:"} {(()=>{
                                      var proxDia, proxSemana;
                                      if(diasCompletados >= dias.length) { proxDia = 1; proxSemana = semanaCiclo < 4 ? semanaCiclo + 1 : 1; }
                                      else { proxDia = diasCompletados + 1; proxSemana = semanaCiclo; }
                                      var proxLabel = dias[proxDia-1] ? (dias[proxDia-1].label || ("Día " + proxDia)) : ("Día " + proxDia);
                                      return proxLabel + " · " + (es?"Semana ":"Week ") + proxSemana + (semanaCiclo >= 4 && diasCompletados >= dias.length ? (es?" (nuevo ciclo)":" (new cycle)") : "");
                                    })()}
                                  </span>
                                </div>
                                <div style={{display:"flex",gap:8,marginTop:8}}>
                                  <button className="hov" onClick={()=>{
                                    if(!confirm(es?"¿Reiniciar semana actual? El alumno volverá a Día 1 de la semana "+semanaCiclo+".":"Reset current week? Athlete will restart at Day 1 of week "+semanaCiclo+".")) return;
                                    setCompletedDays(function(prev){return prev.filter(function(k){return !k.endsWith("-w"+(semanaCiclo-1))})});
                                    toast2(es?"Semana reiniciada ✓":"Week reset ✓");
                                  }} style={{flex:1,padding:"6px",background:"transparent",border:"1px solid #F59E0B44",borderRadius:8,fontSize:11,fontWeight:700,color:"#F59E0B",cursor:"pointer",fontFamily:"inherit"}}>
                                    <Ic name="refresh-cw" size={14} color="#F59E0B"/> {es?"Reiniciar semana":"Reset week"}
                                  </button>
                                  <button className="hov" onClick={()=>{
                                    if(!confirm(es?"¿Reiniciar rutina completa? Volverá a Semana 1, Día 1. El historial de progreso se mantiene.":"Reset entire routine? Will go back to Week 1, Day 1. Progress history is kept.")) return;
                                    setCompletedDays([]);
                                    setCurrentWeek(0);
                                    localStorage.removeItem('it_last_week_advance_date');
                                    toast2(es?"Rutina reiniciada ✓":"Routine reset ✓");
                                  }} style={{flex:1,padding:"6px",background:"transparent",border:"1px solid #EF444444",borderRadius:8,fontSize:11,fontWeight:700,color:"#EF4444",cursor:"pointer",fontFamily:"inherit"}}>
                                    <Ic name="refresh-cw" size={14} color="#EF4444"/> {es?"Reiniciar rutina":"Reset routine"}
                                  </button>
                                </div>
                                </>
                              );
                            })()}
                            {dias.map((d,di)=>(
                              <div key={(rutinaActiva?.id||"rut")+"-coach-day-"+di} style={{background:bgSub,borderRadius:12,padding:"8px 12px",marginBottom:8,marginTop:8,border:"1px solid "+border}}>
                                <div style={{fontSize:11,fontWeight:800,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{d.label||("Día "+(di+1))} · {((d.warmup||[]).length+(d.exercises||[]).length)} ej.</div>
                                {(d.warmup||[]).length>0&&(
                                  <div style={{marginBottom:8}}>
                                    <div style={{fontSize:10,fontWeight:700,color:"#F59E0B",letterSpacing:1,marginBottom:4}}>{es?"ENTRADA EN CALOR":"WARM-UP"}</div>
                                    {(d.warmup||[]).map((ex,ei)=>{
                                      const exInfo=allEx.find(e=>e.id===ex.id);
                                      return <div key={(rutinaActiva?.id||"rut")+"-d"+di+"-wu-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",gap:8,padding:"4px 0",alignItems:"center",borderBottom:ei<(d.warmup||[]).length-1?"1px solid "+border:"none"}}>
                                        <div style={{width:3,height:16,borderRadius:2,background:"#F59E0B44",flexShrink:0,marginTop:0}}/>
                                        <div style={{flex:1,fontSize:14,fontWeight:600,color:textMain}}>{es?exInfo?.name:exInfo?.nameEn||exInfo?.name||ex.id}</div>
                                        <div style={{fontSize:11,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                                        <button className="hov" onClick={()=>setEditEx({rId:rutinaActiva.id,dIdx:di,eIdx:ei,bloque:"warmup",ex:{...ex}})} style={{background:"transparent",border:"1px solid "+border,borderRadius:8,padding:"4px 8px",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color={textMuted}/></button>
                                      </div>;
                                    })}
                                    <button className="hov" onClick={()=>{setAddExModal({rId:rutinaActiva.id,dIdx:di,bloque:"warmup"});setAddExSearch("");setAddExPat(null);setAddExSelectedIds([]);}} style={{width:"100%",marginTop:4,padding:"6px",background:"transparent",border:"1px dashed #F59E0B44",borderRadius:8,fontSize:11,fontWeight:700,color:"#F59E0B",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={14} color="#F59E0B"/>{es?"Añadir entrada en calor":"Add warm-up"}</button>
                                  </div>
                                )}
                                <div style={{fontSize:10,fontWeight:700,color:"#2563EB",letterSpacing:1,marginBottom:4}}>{es?"BLOQUE PRINCIPAL":"MAIN BLOCK"}</div>
                                {(d.exercises||[]).map((ex,ei)=>{
                                  const exInfo=allEx.find(e=>e.id===ex.id);
                                  return <div key={(rutinaActiva?.id||"rut")+"-d"+di+"-ex-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",gap:8,padding:"4px 0",alignItems:"center",borderBottom:ei<(d.exercises||[]).length-1?"1px solid "+border:"none"}}>
                                    <div style={{width:3,height:16,borderRadius:2,background:border,flexShrink:0,marginTop:0}}/>
                                    <div style={{flex:1,fontSize:15,fontWeight:700,color:textMain}}>{es?exInfo?.name:exInfo?.nameEn||exInfo?.name||ex.id}</div>
                                    <div style={{fontSize:11,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                                    <button className="hov" onClick={()=>setEditEx({rId:rutinaActiva.id,dIdx:di,eIdx:ei,bloque:"exercises",ex:{...ex}})} style={{background:"transparent",border:"1px solid "+border,borderRadius:8,padding:"4px 8px",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color={textMuted}/></button>
                                  </div>;
                                })}
                                <button className="hov" onClick={()=>{setAddExModal({rId:rutinaActiva.id,dIdx:di,bloque:"exercises"});setAddExSearch("");setAddExPat(null);setAddExSelectedIds([]);}} style={{width:"100%",marginTop:8,padding:"8px",background:"transparent",border:"1px dashed "+border,borderRadius:8,fontSize:13,fontWeight:700,color:"#2563EB",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={15} color="#2563EB"/>{es?"Añadir bloque principal":"Add main block"}</button>
                              </div>
                            ))}
                            <div style={{display:"flex",gap:8,marginTop:8}}>
                              <button className="hov" style={{flex:2,padding:"8px",background:bgSub,border:"1px solid "+border,borderRadius:12,fontSize:15,fontWeight:800,color:textMuted,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={()=>{if(!confirm(es?"¿Editar esta rutina?":"Edit this routine?")) return;const rutina={id:rutinaActiva.id,...(rutinaActiva.datos||{}),name:rutinaActiva.nombre,saved:true,alumno_id:a.id,alumno:a.nombre};setRoutines(prev=>{const ex=prev.find(x=>x.id===rutinaActiva.id);return ex?prev.map(x=>x.id===rutinaActiva.id?rutina:x):[rutina,...prev]});setTab("routines");toast2(es?"Abierta en RUTINAS":"Opened in ROUTINES");}}><Ic name="edit-2" size={16} color={textMuted}/>{es?"Editar":"Edit"}</button>
                              <button className="hov" style={{padding:"8px 16px",background:bgSub,border:"1px solid "+border,borderRadius:12,fontSize:15,fontWeight:800,color:textMuted,cursor:"pointer",fontFamily:"inherit"}} onClick={async()=>{if(!confirm(es?"¿Quitar rutina?":"Remove?")) return;await sb.deleteRutina(rutinaActiva.id);setRutinasSB(prev=>prev.filter(x=>x.id!==rutinaActiva.id));toast2(es?"Quitada":"Removed");}}><Ic name="trash-2" size={15}/></button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <button className="hov" style={{background:"#162234",color:textMuted,border:"1px solid "+border,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={async()=>{
                      const rutinaLocal=routineForAssign;if(!rutinaLocal){toast2(es?"Creá una rutina en RUTINAS":"Create a routine in ROUTINES");return;}
                      const ex=rutinasSB.find(r=>r.alumno_id===a.id);
                      const rutinaNombre=rutinaLocal.name||"Rutina";
                      var msg = ex
                        ? (es?("Ya tiene: "+ex.nombre+"\n¿Reemplazar por: "+rutinaNombre+"?"):("Has: "+ex.nombre+"\nReplace with: "+rutinaNombre+"?"))
                        : (es?("¿Asignar rutina: "+rutinaNombre+" a "+a.nombre+"?"):("Assign routine: "+rutinaNombre+" to "+a.nombre+"?"));
                      if(!confirm(msg)) return;
                      if(ex){await sb.deleteRutina(ex.id);setRutinasSB(prev=>prev.filter(x=>x.id!==ex.id));}
                      setLoadingSB(true);
                      const res=await sb.createRutina({alumno_id:a.id,entrenador_id:ENTRENADOR_ID,nombre:rutinaLocal.name||"Rutina",datos:{days:rutinaLocal.days,alumno:rutinaLocal.alumno||"",note:rutinaLocal.note||""},fecha_inicio:new Date().toLocaleDateString("es-AR")});
                      if(res&&res[0]){setRutinasSB(prev=>[...prev,res[0]]);toast2("Rutina asignada ✓");}else{toast2("Error");}
                      setLoadingSB(false);
                    }}>{rutinasSB.find(r=>r.alumno_id===a.id)?(<><Ic name="refresh-cw" size={16}/>{es?"Cambiar rutina":"Change routine"}</>):(<><Ic name="plus" size={16}/>{es?"Asignar rutina":"Assign routine"}</>)}</button>
                    {/* ── SUGERENCIAS ── */}
                    {(()=>{
                      const rutSB = rutinasSB.find(r=>r.alumno_id===a.id);
                      const regsAlu = alumnoProgreso || [];
                      if(!rutSB || regsAlu.length < 2) return null;
                      const sugs = generarSugerenciasAlumno(regsAlu, rutSB.datos, EX);
                      if(sugs.length === 0) return null;
                      var open = !!sugsOpen[a.id];
                      const colores = {
                        subir: {icon:(<Ic name="trending-up" size={16} color="#22C55E"/>),bg:"#22C55E12",border:"#22C55E33",color:"#22C55E",btnBg:"#22C55E"},
                        bajar: {icon:(<Ic name="trending-up" size={16} color="#EF4444" style={{transform:"rotate(180deg)"}}/>),bg:"#EF444412",border:"#EF444433",color:"#EF4444",btnBg:"#EF4444"},
                        ajustar: {icon:(<Ic name="zap" size={16} color="#F59E0B"/>),bg:"#F59E0B12",border:"#F59E0B33",color:"#F59E0B",btnBg:"#F59E0B"},
                        cambiar: {icon:(<Ic name="refresh-cw" size={16} color="#2563EB"/>),bg:"#2563EB12",border:"#2563EB33",color:"#2563EB",btnBg:"#2563EB"},
                        mantener: {icon:(<Ic name="chevron-right" size={16} color={textMuted}/>),bg:bgSub,border:border,color:textMuted,btnBg:"#2563EB"}
                      };
                      return (
                        <div style={{marginTop:12,marginBottom:8}}>
                          <button
                            type="button"
                            className="hov"
                            onClick={function(){ setSugsOpen(function(prev){ return {...prev, [a.id]: !prev[a.id]}; }); }}
                            style={{
                              width:"100%",
                              background:bgSub,
                              border:"1px solid "+border,
                              borderRadius:12,
                              padding:"10px 12px",
                              cursor:"pointer",
                              display:"flex",
                              alignItems:"center",
                              justifyContent:"space-between",
                              gap:10
                            }}
                          >
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <Ic name="info" size={16} color="#F59E0B"/>
                              <div style={{fontSize:11,fontWeight:800,color:"#F59E0B",letterSpacing:2,textTransform:"uppercase"}}>{es?"SUGERENCIAS":"SUGGESTIONS"}</div>
                              <span style={{fontSize:12,fontWeight:800,color:textMuted,background:"#F59E0B12",border:"1px solid #F59E0B33",borderRadius:999,padding:"2px 8px"}}>{sugs.length}</span>
                            </div>
                            <Ic
                              name="chevron-right"
                              size={18}
                              color={textMuted}
                              style={{transition:"transform .18s ease", transform: open ? "rotate(90deg)" : "rotate(0deg)"}}
                            />
                          </button>
                          {open && (
                            <div style={{marginTop:10,maxHeight:260,overflowY:"auto",paddingRight:4}}>
                              {sugs.map(function(sug,si){
                                var c = colores[sug.tipo] || colores.mantener;
                                var sugKey = a.id+"-sug-"+(sug.exId||"ex")+"-"+sug.dIdx+"-"+sug.eIdx+"-"+sug.tipo;
                                return (
                                  <div key={sugKey} id={sugKey} style={{background:c.bg,border:"1px solid "+c.border,borderRadius:12,padding:"12px",marginBottom:8}}>
                                    <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                                      <div style={{flexShrink:0,marginTop:1}}>{c.icon}</div>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:13,fontWeight:800,color:c.color,marginBottom:2}}>{sug.nombre}</div>
                                        <div style={{fontSize:14,fontWeight:700,color:textMain}}>{sug.accion}</div>
                                        <div style={{fontSize:12,color:textMuted,marginTop:2,display:"flex",alignItems:"center",gap:4}}>
                                          <Ic name="chevron-right" size={12} color={textMuted}/>
                                          {sug.ajuste}
                                        </div>
                                        <div style={{display:"flex",gap:8,marginTop:8}}>
                                          <button className="hov" onClick={function(){
                                            var exConSug = {...sug.exData};
                                            if(sug.sugKg) exConSug.kg = sug.sugKg;
                                            if(sug.sugReps) exConSug.reps = sug.sugReps;
                                            if(sug.sugSets) exConSug.sets = sug.sugSets;
                                            if(sug.sugPause) exConSug.pause = sug.sugPause;
                                            setEditEx({rId:rutSB.id,dIdx:sug.dIdx,eIdx:sug.eIdx,bloque:sug.bloque,ex:exConSug});
                                          }} style={{padding:"5px 14px",background:c.btnBg,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{es?"APLICAR":"APPLY"}</button>
                                          <button className="hov" onClick={function(){
                                            var el=document.getElementById(sugKey);
                                            if(el){el.style.opacity="0";el.style.height="0";el.style.padding="0";el.style.margin="0";el.style.overflow="hidden";el.style.transition="all .3s ease";}
                                          }} style={{padding:"5px 14px",background:"transparent",color:textMuted,border:"1px solid "+border,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{es?"IGNORAR":"IGNORE"}</button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{marginTop:12,borderTop:"1px solid "+border,paddingTop:12}}>
                      <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,
                        textTransform:"uppercase",marginBottom:8}}>
                        <Ic name="bookmark" size={14} color={textMuted}/> {es?"Nota del día":"Daily note"}
                      </div>
                      <textarea
                        style={{width:"100%",background:bgSub,color:textMain,border:"1px solid "+border,
                          borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",
                          resize:"none",lineHeight:1.5,outline:"none",minHeight:80}}
                        placeholder={es?"Escribí una nota, recordatorio o indicación para el alumno...":"Write a note, reminder or instruction for this athlete..."}
                        value={notaDiaInput}
                        onChange={e=>setNotaDiaInput(e.target.value)}
                      />
                      <button className="hov" style={{width:"100%",marginTop:8,padding:"8px",
                        background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
                        fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={async()=>{
                          if(!notaDiaInput.trim()) return;
                          try{
                            await sb.setNota({
                              alumno_id:a.id,
                              entrenador_id:ENTRENADOR_ID,
                              contenido:notaDiaInput.trim(),
                              texto:notaDiaInput.trim(),
                              fecha:new Date().toLocaleDateString("es-AR")
                            });
                            toast2(es?"Nota enviada ✓":"Note sent ✓");
                            setNotaDiaInput("");
                          }catch(e){toast2("Error al enviar nota");}
                        }}>
                        {es?"Enviar nota":"Send note"}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      {esAlumno&&(sessionData?.alumnoId||(sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null))&&(
        <ChatFlotante darkMode={darkMode} es={es} alumnoId={sessionData?.alumnoId||(sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null)} alumnoNombre={sessionData?.name||"Alumno"} sb={sb} esEntrenador={false}/>
      )}
{showWelcome&&(()=>{
        const isCoach = sessionData?.role==="entrenador";
        const obStep = onboardStep||0;
        const setObStep = setOnboardStep;
        const steps = isCoach ? [
          {
            icon:"👋",title:es?"¡Bienvenido/a!":"Welcome!",
            subtitle:es?"Configurá tu cuenta en 3 pasos":"Set up your account in 3 steps",
            body:null,
            items:[
              {n:1,text:es?"Creá tu primera rutina":"Create your first routine",done:routines.length>0},
              {n:2,text:es?"Agregá un alumno":"Add an athlete",done:alumnos.length>0},
              {n:3,text:es?"Asignale la rutina":"Assign the routine",done:false},
            ],
            cta:es?"EMPEZAR →":"GET STARTED →",action:()=>setObStep(1)
          },{
            icon:"📋",title:es?"Paso 1 — Rutina":"Step 1 — Routine",
            subtitle:es?"Creá tu primera rutina":"Create your first routine",
            body:es?"Organizá los días, ejercicios y series. La podés editar cuando quieras.":"Organize days, exercises and sets. You can edit it anytime.",
            cta:routines.length>0?(es?"Rutina lista ✓ → Siguiente":"Routine ready ✓ → Next"):(es?"CREAR RUTINA →":"CREATE ROUTINE →"),
            action:()=>{if(routines.length===0){setShowWelcome(false);setOnboardStep(1);setTab("routines");}else setObStep(2);},
            skip:()=>setObStep(2)
          },{
            icon:"👥",title:es?"Paso 2 — Alumno":"Step 2 — Athlete",
            subtitle:es?"Agregá tu primer alumno":"Add your first athlete",
            body:es?"Creá su acceso con email y contraseña. Desde ALUMNOS podés ver su historial.":"Create their access. From ATHLETES you can see their history.",
            cta:alumnos.length>0?(es?"Alumno listo ✓ → Siguiente":"Athlete ready ✓ → Next"):(es?"AGREGAR ALUMNO →":"ADD ATHLETE →"),
            action:()=>{if(alumnos.length===0){setShowWelcome(false);setOnboardStep(2);setTab("alumnos");setNewAlumnoForm(true);}else setObStep(3);},
            skip:()=>setObStep(3)
          },{
            icon:"🚀",title:es?"¡Todo listo!":"All set!",
            subtitle:es?"Ya podés usar IRON TRACK":"You're ready to use IRON TRACK",
            body:es?"Desde el dashboard vas a ver la actividad de tus alumnos y quién necesita atención.":"From the dashboard see your athletes' activity and who needs attention.",
            cta:es?"ABRIR IRON TRACK 💪":"OPEN IRON TRACK 💪",
            action:()=>setShowWelcome(false)
          }
        ] : [{
          icon:"E",title:es?"¡Bienvenido/a!":"Welcome!",
          subtitle:es?"A IRON TRACK":"To IRON TRACK",
          body:null,
          items:[
            {n:1,text:es?"Deslizá → para completar cada set":"Swipe → to complete each set",done:false},
            {n:2,text:es?"Seguí tu progreso y PRs":"Track your progress & PRs",done:false},
            {n:3,text:es?"Rompé tus récords 🏆":"Break your records 🏆",done:false},
          ],
          cta:es?"EMPEZAR 💪":"LET'S GO 💪",action:()=>setShowWelcome(false)
        }];
        const step = steps[Math.min(obStep,steps.length-1)];
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.93)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:480,animation:"slideUpFade 0.35s ease"}}
              onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:24}}>
                {steps.map((_,i)=>(
                  <div key={(isCoach?"coach":"alumno")+"-welcome-dot-"+i} style={{height:4,borderRadius:2,transition:"all .35s ease",
                    width:i===obStep?32:8,
                    background:i<obStep?"#22C55E":i===obStep?"#2563EB":border}}/>
                ))}
              </div>
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{fontSize:48,marginBottom:8}}>{step.icon}</div>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#2563EB",marginBottom:4,textTransform:"uppercase"}}>{step.subtitle}</div>
                <div style={{fontSize:28,fontWeight:900,color:textMain,marginBottom:step.body?8:0}}>{step.title}</div>
                {step.body&&<div style={{fontSize:15,color:textMuted,lineHeight:1.6,marginTop:8}}>{step.body}</div>}
              </div>
              {step.items&&(
                <div style={{marginBottom:24}}>
                  {step.items.map((item,i)=>(
                    <div key={"welcome-item-"+(item.n ?? i)} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,opacity:item.done?0.6:1}}>
                      <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,
                        background:item.done?"#22C55E22":"#2563EB22",
                        border:"2px solid "+(item.done?"#22C55E":"#2563EB"),
                        color:item.done?"#22C55E":"#2563EB",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:item.done?18:15,fontWeight:900,
                        animation:item.done?"checkPop 0.4s ease":undefined}}>
                        {item.done?"✓":item.n}
                      </div>
                      <div style={{fontSize:18,fontWeight:700,color:item.done?textMuted:textMain}}>{item.text}</div>
                    </div>
                  ))}
                </div>
              )}
              <button className="hov" onClick={step.action}
                style={{width:"100%",padding:"16px",background:"#2563EB",color:"#fff",
                  border:"none",borderRadius:12,fontSize:18,fontWeight:900,cursor:"pointer",
                  fontFamily:"inherit",letterSpacing:1,boxShadow:"0 4px 20px rgba(37,99,235,0.35)",
                  marginBottom:step.skip?8:0}}>
                {step.cta}
              </button>
              {step.skip&&(
                <button className="hov" onClick={step.skip}
                  style={{width:"100%",padding:"12px",background:"transparent",color:textMuted,
                    border:"none",fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>
                  {es?"Saltar este paso":"Skip this step"}
                </button>
              )}
            </div>
          </div>
        );
      })()}
      {settingsOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={()=>setSettingsOpen(false)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480,border:"1px solid "+border}}
            onClick={e=>e.stopPropagation()}>
            <div style={{width:40,height:4,background:"#2D4057",borderRadius:2,margin:"0 auto 20px"}}></div>
            <div style={{fontSize:18,fontWeight:800,letterSpacing:1,marginBottom:24}}><Ic name="settings" size={16}/> CONFIGURACION</div>
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:2,marginBottom:8}}>IDIOMA</div>
              <div style={{display:"flex",background:bgSub,border:"1px solid "+border,borderRadius:12,padding:4,gap:4}}>
                {["es","en"].map(l=>(
                  <button key={l} className="hov"
                    style={{flex:1,padding:"8px",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",
                      background:lang===l?"#2563EB":"transparent",color:lang===l?"#fff":"#8B9AB2"}}
                    onClick={()=>{setLang(l);localStorage.setItem("it_lang",l);}}>
                    {l==="es"?"🇦🇷 ESPAÑOL":"🇺🇸 ENGLISH"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:2,marginBottom:8}}>TEMA</div>
              <div style={{display:"flex",background:bgSub,border:"1px solid "+border,borderRadius:12,padding:4,gap:4}}>
                {[["dark","NOCHE",true],["light","DÍA",false]].map(([k,lbl,val])=>(
                  <button key={k} className="hov"
                    style={{flex:1,padding:"8px",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",
                      background:darkMode===val?"#2563EB":"transparent",color:darkMode===val?"#fff":"#8B9AB2"}}
                    onClick={()=>{setDarkMode(val);localStorage.setItem("it_dark",val?"true":"false");}}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {esAlumno&&(
              <>
              <div style={{marginBottom:24}}>
                <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:2,marginBottom:8}}>{es?"SOPORTE":"SUPPORT"}</div>
                <a href="https://wa.me/541164461075" target="_blank" rel="noreferrer"
                  style={{display:"flex",alignItems:"center",gap:12,padding:"16px",
                    background:"#22C55E22",border:"1px solid #25d36633",borderRadius:12,color:"#22C55E",
                    fontSize:15,fontWeight:800,textDecoration:"none"}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                    <path d="M11.5 0C5.149 0 0 5.149 0 11.5c0 2.059.546 4.019 1.545 5.701L0 23l5.978-1.52A11.451 11.451 0 0011.5 23C17.851 23 23 17.851 23 11.5S17.851 0 11.5 0zm0 21.087a9.576 9.576 0 01-5.072-1.446l-.364-.217-3.548.902.918-3.453-.24-.378A9.567 9.567 0 011.913 11.5c0-5.289 4.299-9.587 9.587-9.587 5.289 0 9.587 4.298 9.587 9.587 0 5.288-4.298 9.587-9.587 9.587z"/>
                  </svg>
                  {es?"Contactar entrenador":"Contact trainer"}
                </a>
              </div>
              <RecordatoriosPanel es={es} darkMode={darkMode} toast2={toast2}/>
              </>
            )}
            <button className="hov"
              style={{width:"100%",padding:"12px",background:darkMode?"#162234":"#E2E8F0",border:"none",borderRadius:12,color:textMuted,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
              onClick={()=>setSettingsOpen(false)}>
              {es?"CERRAR":"CLOSE"}
            </button>
          </div>
        </div>
      )}
      {prCelebration&&(
        <div onClick={()=>setPrCelebration(null)} style={{
          position:"fixed",inset:0,zIndex:500,
          display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,0.92)",
          animation:"fadeIn .2s ease",cursor:"pointer"
        }}>
          <div style={{
            textAlign:"center",padding:"48px 32px",
            background:"linear-gradient(135deg,#1a1a1a,#2a1f00)",
            borderRadius:28,border:"2px solid #f59e0b55",
            maxWidth:340,width:"90%",
            boxShadow:"0 0 80px #f59e0b44",
            animation:"fadeIn .3s ease"
          }}>
            <div style={{fontSize:64,marginBottom:12,filter:"drop-shadow(0 0 24px #f59e0b)",animation:"pulse 1s infinite"}}>🏆</div>
            <div style={{fontSize:15,fontWeight:900,color:"#fbbf24",letterSpacing:4,marginBottom:12,textTransform:"uppercase"}}>
              {es?"¡NUEVO PR!":"NEW PR!"}
            </div>
            <div style={{fontSize:24,fontWeight:900,color:"#FFFFFF",marginBottom:8,lineHeight:1.2}}>
              {prCelebration.ejercicio}
            </div>
            <div style={{fontSize:56,fontWeight:900,color:"#fbbf24",letterSpacing:1,lineHeight:1}}>
              {prCelebration.kg} kg
            </div>
            {prCelebration.diff>0&&(
              <div style={{marginTop:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{background:"#22C55E22",border:"1px solid #22C55E44",borderRadius:8,padding:"4px 12px",fontSize:15,fontWeight:800,color:"#22C55E"}}>
                  +{prCelebration.diff}kg
                </span>
                <span style={{fontSize:13,color:"#8B9AB2"}}>
                  vs {prCelebration.prevKg}kg
                </span>
              </div>
            )}
            <div style={{fontSize:12,color:"#8B9AB244",marginTop:16}}>
              {es?"Tocá para cerrar":"Tap to close"}
            </div>
          </div>
        </div>
      )}
      {resumenSesion&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:150,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:bgCard,borderRadius:20,padding:"28px 20px",width:"100%",maxWidth:420,border:"1px solid "+border,textAlign:"center",animation:"fadeIn 0.25s ease"}}>
            <div style={{fontSize:48,marginBottom:4}}>💪</div>
            <div style={{fontSize:28,fontWeight:900,letterSpacing:1,marginBottom:4}}>ENTRENAMIENTO</div>
            <div style={{fontSize:28,fontWeight:900,letterSpacing:1,color:"#2563EB",marginBottom:4}}>COMPLETADO</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{resumenSesion.diaLabel} · {resumenSesion.rutinaName} · {resumenSesion.fecha}</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[
                ["⏱",es?"DURACIÓN":"DURATION",resumenSesion.durMin+" min","#2563EB"],
                ["🏋️",es?"EJERCICIOS":"EXERCISES",resumenSesion.ejercicios,"#2563EB"],
                ["⚖️",es?"KG LEVANTADOS":"KG LIFTED",resumenSesion.volTotal.toLocaleString()+" kg","#60A5FA"],
                [resumenSesion.prsNuevos>0?"🏆":"✓",es?"RÉCORD PERSONAL":"PERSONAL RECORD",resumenSesion.prsNuevos>0?(resumenSesion.prsNuevos+" PR!"):(es?"Sin PR":"No PR"),resumenSesion.prsNuevos>0?"#60A5FA":"#8B9AB2"],
              ].map(([icon,label,val,color])=>(
                <div key={label} style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:12,padding:"8px 12px 10px",border:"1px solid "+border}}>
                  <div style={{fontSize:18}}>{icon}</div>
                  <div style={{fontSize:18,fontWeight:700,color,marginTop:4}}>{val}</div>
                  <div style={{fontSize:11,fontWeight:400,color:textMuted,letterSpacing:0.3,marginTop:4}}>{label}</div>
                </div>
              ))}
            </div>

            {resumenSesion.prsNuevos>0&&(
              <div style={{background:"#fbbf2412",border:"1px solid #fbbf2444",borderRadius:12,padding:"12px",marginBottom:16}}>
                <div style={{fontSize:28,marginBottom:4}}>🏆</div>
                <div style={{fontSize:18,fontWeight:800,color:"#fbbf24",marginBottom:8}}>
                  {resumenSesion.prsNuevos} nuevo{resumenSesion.prsNuevos>1?"s":""} PR!
                </div>
                {sessionPRList.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {sessionPRList.map(function(pr,pi){return(
                      <div key={pi} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"6px 10px"}}>
                        <span style={{fontSize:13,fontWeight:700,color:textMain}}>{pr.ejercicio}</span>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:15,fontWeight:900,color:"#fbbf24"}}>{pr.kg}kg</span>
                          <span style={{fontSize:11,fontWeight:700,color:"#22C55E"}}>+{pr.diff}kg</span>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )}

                        <button className="hov" style={{width:"100%",padding:"12px",background:darkMode?"#162234":"#E2E8F0",border:"none",borderRadius:12,color:textMuted,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}
                onClick={()=>setResumenSesion(null)}>
                {es?"Cerrar":"Close"}
              </button>
              <div style={{marginBottom:4}}>
                <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8,textAlign:"center"}}>{es?"COMPARTIR ENTRENAMIENTO":"SHARE WORKOUT"}</div>
                <button className="hov" style={{
                  width:"100%",padding:"16px",borderRadius:12,border:"none",cursor:"pointer",
                  fontFamily:"inherit",fontSize:15,fontWeight:900,letterSpacing:1,
                  background:"linear-gradient(135deg,#FF3B30,#FF6B35)",color:"#fff",
                  boxShadow:"0 4px 14px rgba(59,130,246,0.35)"
                }} onClick={async()=>{
                  try {
                    // Generar imagen con Canvas
                    const canvas = document.createElement("canvas");
                    canvas.width = 1080; canvas.height = 1080;
                    const ctx = canvas.getContext("2d");
                    // Fondo degradado oscuro
                    const grad = ctx.createLinearGradient(0,0,0,1080);
                    grad.addColorStop(0,"#0F1923");
                    grad.addColorStop(1,"#1E2D40");
                    ctx.fillStyle = grad;
                    ctx.fillRect(0,0,1080,1080);
                    // Línea roja superior
                    ctx.fillStyle = "#2563EB";
                    ctx.fillRect(0,0,1080,8);
                    // Logo
                    ctx.fillStyle = "#2563EB";
                    ctx.font = "900 72px 'Arial Black', Arial";
                    ctx.fillText("IRON TRACK", 80, 120);
                    // Nombre rutina
                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "800 52px Arial";
                    const rName = (resumenSesion.rutinaName||"").toUpperCase();
                    ctx.fillText(rName.slice(0,22), 80, 220);
                    // Línea separadora
                    ctx.fillStyle = "#2D4057";
                    ctx.fillRect(80, 260, 920, 2);
                    // Stats grandes
                    const stats = [
                      {val: resumenSesion.durMin+"'", label: es?"DURACIÓN":"DURATION"},
                      {val: resumenSesion.ejercicios, label: es?"EJERCICIOS":"EXERCISES"},
                      {val: resumenSesion.totalSets, label: "SETS"},
                      {val: (resumenSesion.volTotal/1000).toFixed(1)+"t", label: es?"TONELAJE":"VOLUME"},
                    ];
                    stats.forEach((s,i)=>{
                      const x = 80 + i*240;
                      ctx.fillStyle = "#2563EB";
                      ctx.font = "900 80px 'Arial Black', Arial";
                      ctx.fillText(String(s.val), x, 420);
                      ctx.fillStyle = "#8B9AB2";
                      ctx.font = "700 24px Arial";
                      ctx.fillText(s.label, x, 460);
                    });
                    // PRs
                    if(resumenSesion.prsNuevos > 0){
                      ctx.fillStyle = "#60A5FA";
                      ctx.font = "900 48px 'Arial Black', Arial";
                      ctx.fillText(""+resumenSesion.prsNuevos+" PR "+(es?"NUEVO":"NEW")+(resumenSesion.prsNuevos>1?"S":"")+"!", 80, 560);
                    }
                    // Semana
                    ctx.fillStyle = "#8B9AB2";
                    ctx.font = "700 32px Arial";
                    ctx.fillText((es?"SEMANA":"WEEK")+" "+resumenSesion.semana+" / 4", 80, 650);
                    // Hashtag
                    ctx.fillStyle = "#2D4057";
                    ctx.font = "700 28px Arial";
                    ctx.fillText("#IronTrack  #Fitness  #Entrenamiento", 80, 980);
                    // Línea roja inferior
                    ctx.fillStyle = "#2563EB";
                    ctx.fillRect(0,1072,1080,8);
                    // Convertir a blob y compartir
                    canvas.toBlob(async(blob)=>{
                      if(!blob) return;
                      const file = new File([blob],"irontrack-sesion.png",{type:"image/png"});
                      const txt = "💪 "+resumenSesion.rutinaName+" | "+resumenSesion.durMin+"min | "+resumenSesion.ejercicios+" ejercicios | "+resumenSesion.volTotal.toLocaleString()+"kg"+( resumenSesion.prsNuevos>0?" | 🏆 "+resumenSesion.prsNuevos+" PR!":"")+" #IronTrack";
                      if(navigator.canShare && navigator.canShare({files:[file]})){
                        await navigator.share({files:[file], title:"IRON TRACK", text:txt});
                      } else if(navigator.share){
                        await navigator.share({title:"IRON TRACK", text:txt});
                      } else {
                        // Fallback: descargar imagen
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href=url; a.download="irontrack-sesion.png"; a.click();
                        URL.revokeObjectURL(url);
                        toast2(es?"Imagen guardada!":"Image saved!");
                      }
                    },"image/png");
                  } catch(e){ console.error(e); toast2(es?"Error al compartir":"Share error"); }
                }}>
                  <Ic name="upload" size={16}/> {es?"COMPARTIR / GUARDAR IMAGEN":"SHARE / SAVE IMAGE"}
                </button>
              </div>
          </div>
        </div>
      )}
      {detailEx&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:100,display:"flex",alignItems:"flex-end"}} onClick={()=>setDetailEx(null)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxHeight:"80dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{fontSize:36}}>{PATS[detailEx.pattern]?.icon}</span>
              <div>
                <div style={{fontSize:28,fontWeight:800,letterSpacing:1}}>{es?detailEx.name:detailEx.nameEn}</div>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <span style={tag(PATS[detailEx.pattern]?.color||"#2563EB")}>{es?PATS[detailEx.pattern]?.label:PATS[detailEx.pattern]?.labelEn}</span>
                  <span style={{fontSize:13,color:textMuted}}>{detailEx.muscle} · {detailEx.equip}</span>
                </div>
              </div>
              <button className="hov" style={{...btn(),marginLeft:"auto",fontSize:22,padding:"4px 8px"}} onClick={()=>setDetailEx(null)}>x</button>
            </div>
            <div style={{marginBottom:12}}>
              {IMGS[detailEx.id]&&(
                <div style={{borderRadius:12,overflow:"hidden",background:darkMode?"#162234":"#E2E8F0",marginBottom:8,position:"relative"}}>
                  <img src={IMGS[detailEx.id]} alt={detailEx.name}
                    style={{width:"100%",maxHeight:200,objectFit:"cover",display:"block"}}
                    onError={e=>{e.target.style.display="none"}}
                  />
                </div>
              )}
              {VIDEOS[detailEx.id]&&(
                <a href={VIDEOS[detailEx.id]} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:8,background:"#162234",border:"1px solid #2D4057",borderRadius:12,padding:"8px 16px",textDecoration:"none"}}>
                  <span style={{fontSize:28}}>▶️</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:textMain}}>{es?"Ver video en YouTube":"Watch on YouTube"}</div>
                    <div style={{fontSize:11,color:textMuted}}>{es?"Tutorial de técnica":"Technique tutorial"}</div>
                  </div>
                </a>
              )}
            </div>
            <span style={lbl}>{es?"HISTORIAL":"HISTORY"}</span>
            {(progress[detailEx.id]?.sets||[]).length===0&&<div style={{color:textMuted,fontSize:15,margin:"8px 0 10px"}}>{es?"Sin registros":"No records"}</div>}
            {(progress[detailEx.id]?.sets||[]).slice(0,10).map((s2,i)=>(
              <div key={detailEx.id+"-hist-"+(s2.date||"")+"-"+(s2.kg??"")+"-"+(s2.reps??"")+"-"+(s2.week ?? "nw")+"-"+i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),fontSize:15}}>
                <span>{s2.kg}kg x {s2.reps} reps</span>
                <span style={{color:textMuted}}>{s2.date}</span>
              </div>
            ))}
            <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",marginTop:12,padding:"8px"}} onClick={()=>{setLogModal({...detailEx});setDetailEx(null);}}>
              + LOG SET
            </button>
            {expandedR&&selDay!==null&&(
              <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",marginTop:8,padding:"8px"}} onClick={()=>{
                setRoutines(p=>p.map(r=>r.id===expandedR?{...r,days:r.days.map((d,i)=>i===selDay?{...d,exercises:[...d.exercises,{id:detailEx.id,sets:"3",reps:"8-10",kg:"",pause:90,note:"",weeks:[]}]}:d)}:r));
                toast2("Ejercicio agregado");
                setDetailEx(null);
                setTab("plan");
              }}>+ AGREGAR A RUTINA</button>
            )}
          </div>
        </div>
      )}
      {false&&logModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:110,display:"flex",alignItems:"flex-end"}} onClick={()=>setLogModal(null)}>
          <LogForm darkMode={darkMode} ex={logModal} es={es} btn={btn} inp={inp} lbl={lbl} tag={tag} fmtP={fmtP} progress={progress}
            onLog={(kg,reps,note,pause,rpe)=>{logSet(logModal.id,kg,reps,note,rpe);if(pause>0)startTimer(pause,PATS[logModal.pattern]?.color);setLogModal(null);}}
            onClose={()=>setLogModal(null)}/>
        </div>
      )}
      {editAlumnoModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:120,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setEditAlumnoModal(null)}>
          <div style={{background:bgCard,borderRadius:16,padding:20,width:"100%",maxWidth:400,border:"1px solid "+border,animation:"fadeIn 0.25s ease"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Editar alumno</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{editAlumnoModal.nombre}</div>
            <div style={{marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,display:"block",marginBottom:4}}>EMAIL</span>
              <input style={{...inp,width:"100%"}} value={editAlumnoEmail} onChange={e=>setEditAlumnoEmail(e.target.value)} placeholder="nuevo@email.com"/>
            </div>
            <div style={{marginBottom:16}}>
              <span style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,display:"block",marginBottom:4}}>CONTRASEÑA NUEVA</span>
              <input style={{...inp,width:"100%"}} type="password" value={editAlumnoPass} onChange={e=>setEditAlumnoPass(e.target.value)} placeholder="Dejar vacío para no cambiar"/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="hov" style={{flex:1,padding:"12px",background:darkMode?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setEditAlumnoModal(null)}>Cancelar</button>
              <button className="hov" style={{flex:1,padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={async()=>{
                const updates={};
                if(editAlumnoEmail&&editAlumnoEmail!==editAlumnoModal.email) updates.email=editAlumnoEmail;
                if(editAlumnoPass) updates.password=editAlumnoPass;
                if(!Object.keys(updates).length){toast2("Sin cambios");return;}
                const res=await sbFetch("alumnos?id=eq."+editAlumnoModal.id,"PATCH",updates);
                if(res!==null){
                  setAlumnos(prev=>prev.map(a=>a.id===editAlumnoModal.id?{...a,...updates}:a));
                  toast2("Alumno actualizado ✓");
                  setEditAlumnoModal(null);
                } else {toast2("Error al guardar");}
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {newR&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:120,overflowY:"auto"}} onClick={()=>setNewR(null)}>
          <div style={{background:bgCard,margin:"20px 16px",borderRadius:16,padding:"20px 16px",maxHeight:"85dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:22,fontWeight:800,letterSpacing:1,marginBottom:4}}>{es?"Nueva rutina":"New routine"}</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:14}}>{es?"Elegí una plantilla o en blanco. Podés afinar después.":"Pick a template or start blank. Refine anytime."}</div>
            <span style={lbl}>{es?"INICIO RÁPIDO":"QUICK START"}</span>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14,marginTop:6}}>
              <button type="button" className="hov" style={{...btn(newR.templateId==="blank"?"#2563EB":undefined),padding:"10px 14px",fontSize:14,fontWeight:700,borderRadius:12}} onClick={()=>setNewR(p=>({...p,templateId:"blank",numDays:p.numDays||3,days:emptyDays(p.numDays||3,es)}))}>
                {es?"En blanco":"Blank"}
              </button>
              {ROUTINE_TEMPLATES.map(function(T){
                var active=newR.templateId===T.id;
                return(
                  <button key={T.id} type="button" className="hov" style={{...btn(active?"#22C55E":undefined),padding:"10px 14px",fontSize:14,fontWeight:700,borderRadius:12,maxWidth:"100%",textAlign:"left"}} onClick={function(){
                    var tpl=getTemplateById(T.id);
                    if(!tpl) return;
                    setNewR(function(p){
                      return{...p,templateId:T.id,name:es?tpl.nameEs:tpl.nameEn,numDays:tpl.days.length,days:instantiateTemplate(tpl,es)};
                    });
                  }}>
                    {es?T.nameEs:T.nameEn}
                  </button>
                );
              })}
            </div>
            <div style={{marginBottom:10}}><span style={lbl}>{es?"NOMBRE":"NAME"}</span><input style={inp} value={newR.name} onChange={e=>setNewR(p=>({...p,name:e.target.value}))} placeholder={es?"Ej: PPL Juan":"E.g: John PPL"}/></div>
            {newR.templateId==="blank"&&(
              <div style={{marginBottom:10}}>
                <span style={lbl}>{es?"DÍAS":"DAYS"}</span>
                <div style={{display:"flex",gap:8}}>
                  {[1,2,3,4,5,6,7].map(n=>(
                    <button key={n} type="button" className="hov" style={{...btn(newR.numDays===n?"#2563EB":undefined),padding:"8px 0",flex:1,fontSize:18}} onClick={()=>setNewR(p=>({...p,numDays:n,days:emptyDays(n,es)}))}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {newR.templateId&&newR.templateId!=="blank"&&(
              <div style={{fontSize:13,color:textMuted,marginBottom:12,padding:"8px 10px",background:bgSub,borderRadius:10,border:"1px solid "+border}}>
                {(function(){
                  var T=getTemplateById(newR.templateId);
                  if(!T) return null;
                  var n=(newR.days||[]).length;
                  var ex=(newR.days||[]).reduce(function(a,d){return a+(d.exercises||[]).length;},0);
                  return(es?T.hintEs:T.hintEn)+" · "+n+(es?" días · ":" days · ")+ex+(es?" ejercicios":" exercises");
                })()}
              </div>
            )}
            <button type="button" className="hov" style={{width:"100%",padding:"10px",marginBottom:12,background:"transparent",border:"1px dashed "+border,borderRadius:12,color:textMuted,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setNewR(p=>({...p,showAdvanced:!p.showAdvanced}))}>
              {newR.showAdvanced?(es?"▲ Menos opciones":"▲ Fewer options"):(es?"▼ Nota, alumno, nombres de día":"▼ Note, client, day names")}
            </button>
            {newR.showAdvanced&&(
              <div style={{marginBottom:12}}>
                <div style={{marginBottom:8}}>
                  <span style={lbl}>{es?"NOTA (opcional)":"NOTE (optional)"}</span>
                  <input style={inp} value={newR.note||""} onChange={e=>setNewR(p=>({...p,note:e.target.value}))} placeholder={es?"Ej: Lun, Mie, Vie":"E.g. Mon, Wed, Fri"}/>
                </div>
                <div style={{marginBottom:8}}>
                  <span style={lbl}>{es?"ALUMNO (opcional)":"CLIENT (optional)"}</span>
                  <input style={inp} value={newR.alumno||""} onChange={e=>setNewR(p=>({...p,alumno:e.target.value}))} placeholder={es?"Asigná también desde la tarjeta del alumno":"Or assign from client card"}/>
                </div>
                <span style={lbl}>{es?"NOMBRE DE CADA DÍA":"NAME EACH DAY"}</span>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                  {(newR.days||[]).map(function(d,di){return(
                    <div key={"new-routine-day-"+di} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:textMuted,width:52,flexShrink:0}}>{es?"Día":"Day"} {di+1}</span>
                      <input style={{...inp,marginBottom:0,flex:1}} value={d.label||""} onChange={function(e){
                        var val=e.target.value;
                        setNewR(function(p){return{...p,days:p.days.map(function(dd,ddi){return ddi===di?{...dd,label:val}:dd})}});
                      }} placeholder={es?"Ej: Empuje, Pierna…":"E.g. Push, Legs…"}/>
                    </div>
                  )})}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button type="button" className="hov" style={{...btn(),flex:1,padding:"10px"}} onClick={()=>setNewR(null)}>{es?"CANCELAR":"CANCEL"}</button>
              <button type="button" className="hov" style={{...btn("#2563EB"),flex:2,padding:"10px",fontSize:17,fontWeight:800}} onClick={()=>{
                if(!newR.name.trim()){toast2(es?"Pon un nombre":"Add a name");return;}
                var payload={name:newR.name,numDays:newR.numDays,days:newR.days,note:newR.note||"",alumno:newR.alumno||"",collapsed:false};
                var newId=uid();
                setRoutines(p=>[...p,{...payload,id:newId,created:new Date().toLocaleDateString("es-AR")}]);
                setAssignRoutineId(newId);
                setNewR(null);
                toast2(es?"Rutina creada ✓":"Routine created ✓");
              }}>{es?"CREAR":"CREATE"}</button>
            </div>
          </div>
        </div>
      )}

                  {/* ── Modal duplicar día ── */}
      {dupDayModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setDupDayModal(null)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:20,width:"100%",maxWidth:480,border:"1px solid "+border}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,color:textMain,marginBottom:4}}>
              {es?"Duplicar":"Duplicate"} {dupDayModal.days[dupDayModal.dIdx]?.label||("Día "+(dupDayModal.dIdx+1))}
            </div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>
              {es?"Seleccioná los días destino":"Select destination days"}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              {dupDayModal.days.map(function(d,di){
                if(di===dupDayModal.dIdx) return (
                  <div key={"dup-day-src-"+dupDayModal.dIdx+"-mark-"+di} style={{padding:"10px 16px",borderRadius:12,background:"#2563EB22",border:"2px solid #2563EB",opacity:0.5}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#2563EB"}}>{d.label||("Día "+(di+1))}</div>
                    <div style={{fontSize:10,color:textMuted}}>{es?"Origen":"Source"}</div>
                  </div>
                );
                var isSelected = dupDayModal.selected.indexOf(di)!==-1;
                var tieneEj = ((d.warmup||[]).length+(d.exercises||[]).length)>0;
                return (
                  <div key={"dup-day-pick-"+dupDayModal.dIdx+"-to-"+di} onClick={function(){
                    setDupDayModal(function(prev){
                      var sel = prev.selected.indexOf(di)!==-1
                        ? prev.selected.filter(function(x){return x!==di})
                        : [...prev.selected, di];
                      return {...prev, selected:sel};
                    });
                  }} style={{padding:"10px 16px",borderRadius:12,cursor:"pointer",transition:"all .15s",
                    background:isSelected?"#22C55E22":bgSub,
                    border:isSelected?"2px solid #22C55E":"2px solid "+border}}>
                    <div style={{fontSize:13,fontWeight:800,color:isSelected?"#22C55E":textMain}}>{d.label||("Día "+(di+1))}</div>
                    <div style={{fontSize:10,color:textMuted}}>
                      {tieneEj?((d.warmup||[]).length+(d.exercises||[]).length)+" ej.":"vacío"}
                    </div>
                    {isSelected&&<div style={{fontSize:10,fontWeight:700,color:"#22C55E",marginTop:2}}>✓ {es?"Seleccionado":"Selected"}</div>}
                  </div>
                );
              })}
            </div>
            {dupDayModal.selected.some(function(di){return ((dupDayModal.days[di]?.warmup||[]).length+(dupDayModal.days[di]?.exercises||[]).length)>0})&&(
              <div style={{background:"#F59E0B12",border:"1px solid #F59E0B33",borderRadius:8,padding:"8px 10px",marginBottom:12,fontSize:12,color:"#F59E0B"}}>
                ⚠ {es?"Algunos días seleccionados tienen ejercicios. Se reemplazarán.":"Some selected days have exercises. They will be replaced."}
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDupDayModal(null)} style={{flex:1,padding:12,background:bgSub,color:textMuted,border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{es?"CANCELAR":"CANCEL"}</button>
              <button onClick={function(){
                if(dupDayModal.selected.length===0){toast2(es?"Seleccioná al menos un día":"Select at least one day");return;}
                var src=dupDayModal.sourceDay;
                var sel=dupDayModal.selected;
                setRoutines(function(p){return p.map(function(rr){
                  if(rr.id!==dupDayModal.rId) return rr;
                  return {...rr,days:rr.days.map(function(dd,ddi){
                    if(sel.indexOf(ddi)===-1) return dd;
                    return {...dd,warmup:(src.warmup||[]).map(function(e){return {...e}}),exercises:(src.exercises||[]).map(function(e){return {...e}})};
                  })};
                })});
                toast2((es?"Duplicado a ":"Duplicated to ")+sel.map(function(i){return dupDayModal.days[i]?.label||("Día "+(i+1))}).join(", ")+" ✓");
                setDupDayModal(null);
              }} style={{flex:1,padding:12,background:dupDayModal.selected.length>0?"#2563EB":"#2D4057",color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                {es?"DUPLICAR":"DUPLICATE"} {dupDayModal.selected.length>0&&("("+dupDayModal.selected.length+")")}
              </button>
            </div>
          </div>
        </div>
      )}
            {/* ── Modal video embebido ── */}
      {videoModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}} onClick={()=>setVideoModal(null)}>
          <div style={{width:"100%",maxWidth:480,padding:"0 16px"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{videoModal.nombre||""}</div>
              <button onClick={()=>setVideoModal(null)} style={{background:"none",border:"none",color:"#8B9AB2",fontSize:24,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{position:"relative",paddingBottom:"56.25%",height:0,borderRadius:12,overflow:"hidden"}}>
              <iframe
                src={"https://www.youtube.com/embed/"+videoModal.videoId+"?autoplay=1&rel=0&modestbranding=1"}
                style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}}
                allow="autoplay; encrypted-media" allowFullScreen/>
            </div>
          </div>
        </div>
      )}

            {/* ── Modal chat entrenador ── */}
      {chatModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setChatModal(null)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"16px",width:"100%",maxWidth:480,border:"1px solid "+border,maxHeight:"80dvh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"#2563EB22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#2563EB"}}>
                  {(chatModal.alumnoNombre||"?").slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:textMain}}>{chatModal.alumnoNombre}</div>
                  <div style={{fontSize:11,color:textMuted}}>{es?"Chat interno":"Internal chat"}</div>
                </div>
              </div>
              <button onClick={()=>setChatModal(null)} style={{background:"none",border:"none",color:textMuted,fontSize:22,cursor:"pointer",padding:"4px"}}><Ic name="x" size={18}/></button>
            </div>
            <div style={{flex:1,overflow:"hidden"}}>
              <Chat darkMode={darkMode} es={es} alumnoId={chatModal.alumnoId} alumnoNombre={chatModal.alumnoNombre} esEntrenador={true} sb={sb}/>
            </div>
          </div>
        </div>
      )}
      {editEx&&(
        <EditExModal darkMode={darkMode} key={editEx.rId+"-"+editEx.dIdx+"-"+editEx.eIdx} editEx={editEx} btn={btn} inp={inp} allEx={allEx} es={es} PATS={PATS}
          onSave={async(updated)=>{
            const blq = editEx.bloque||"exercises";
            // Actualizar routines locales
            setRoutines(p=>p.map(r=>r.id===editEx.rId?{...r,days:r.days.map((d,di)=>di===editEx.dIdx?{...d,[blq]:(d[blq]||[]).map((ex,ei)=>ei===editEx.eIdx?updated:ex)}:d)}:r));
            // Auto-guardar en Supabase inmediatamente
            try {
              const rActual = routines.find(x=>x.id===editEx.rId);
              if(rActual) {
                const updatedDays = rActual.days.map((d,di)=>di===editEx.dIdx?{...d,[blq]:(d[blq]||[]).map((ex,ei)=>ei===editEx.eIdx?updated:ex)}:d);
                const payload={nombre:rActual.name,alumno_id:rActual.alumno_id||null,datos:{days:updatedDays,alumno:rActual.alumno||"",note:rActual.note||""},entrenador_id:"entrenador_principal"};
                if(rActual.saved){ await sb.updateRutina(rActual.id,payload); }
                else { const res = await sb.createRutina(payload); if(res&&res[0]){setRoutines(p=>p.map(r=>r.id===rActual.id?{...r,id:res[0].id,saved:true}:r));} }
              } else {
                // Buscar en rutinasSB (edición desde vista alumno)
                const rSB = rutinasSB.find(x=>x.id===editEx.rId);
                if(rSB) {
                  const diasActualizados = (rSB.datos?.days||[]).map((d,di)=>di===editEx.dIdx?{...d,[blq]:(d[blq]||[]).map((ex,ei)=>ei===editEx.eIdx?updated:ex)}:d);
                  const payloadSB = {nombre:rSB.nombre,alumno_id:rSB.alumno_id,datos:{...rSB.datos,days:diasActualizados},entrenador_id:"entrenador_principal"};
                  await sb.updateRutina(rSB.id, payloadSB);
                  setRutinasSB(prev=>prev.map(r=>r.id===rSB.id?{...r,datos:{...r.datos,days:diasActualizados}}:r));
                }
              }
            } catch(e){ console.error("Auto-save error:",e); }
            setEditEx(null);toast2("Guardado ✓");
          }}
          onClose={()=>setEditEx(null)}
        />
      )}
      {loginModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:130,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}} onClick={()=>setLoginModal(false)}>
          <div style={{background:bgCard,borderRadius:16,padding:"24px 20px",width:"100%",maxWidth:360,animation:"fadeIn 0.25s ease"}} onClick={e=>e.stopPropagation()}>
            {user?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:48,marginBottom:8}}>👤</div>
                <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>{user.name}</div>
                <div style={{fontSize:15,color:textMuted,marginBottom:16}}>{user.email}</div>
                <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",padding:"8px"}} onClick={()=>{localStorage.removeItem("it_u");setUser(null);setLoginModal(false);toast2("Sesion cerrada");}}>SALIR</button>
              </div>
            ):(
              <LoginForm darkMode={darkMode} es={es} btn={btn} inp={inp} lbl={lbl} onLogin={u=>{setUser(u);localStorage.setItem("it_u",JSON.stringify(u));setLoginModal(false);toast2("Bienvenido/a "+u.name+"!");}} onClose={()=>setLoginModal(false)}/>
            )}
          </div>
        </div>
      )}
      {aliasModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={()=>setAliasModal(false)}>
          <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxHeight:"85dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>💰 {es?"Datos de Pago":"Payment Info"}</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{es?"Configurá tu alias o CBU para recibir pagos":"Set up your alias or CBU to receive payments"}</div>
            {(()=>{
              const form = aliasForm;
              const setForm = setAliasForm;
              const save = () => { sb.saveConfig(form).then(()=>{
                    setAliasData(form);
                    setAliasModal(false);
                    toast2(es?"Datos de pago guardados ✓":"Payment info saved ✓");
                  }).catch(()=>toast2("Error al guardar")); };
              return(
                <div>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>ALIAS</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.alias} onChange={e=>setForm(p=>({...p,alias:e.target.value}))} placeholder="tu.alias.mp"/>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>CBU (opcional)</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.cbu} onChange={e=>setForm(p=>({...p,cbu:e.target.value}))} placeholder="0000000000000000000000"/>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{es?"BANCO / BILLETERA":"BANK / WALLET"}</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.banco} onChange={e=>setForm(p=>({...p,banco:e.target.value}))} placeholder="Mercado Pago / Banco Nación / etc"/>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{es?"MONTO MENSUAL":"MONTHLY FEE"}</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.monto} onChange={e=>setForm(p=>({...p,monto:e.target.value}))} placeholder="$ 15.000"/>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{es?"NOTA (opcional)":"NOTE (optional)"}</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:16}} value={form.nota} onChange={e=>setForm(p=>({...p,nota:e.target.value}))} placeholder={es?"Ej: Transferir antes del 5 de cada mes":"E.g.: Transfer before the 5th of each month"}/>
                  <div style={{display:"flex",gap:8}}>
                    <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",color:textMain,border:"none",borderRadius:12,padding:"12px",flex:1,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setAliasModal(false)}>{es?"Cancelar":"Cancel"}</button>
                    <button className="hov" style={{background:green,color:darkMode?"#fff":"#fff",border:"none",borderRadius:12,padding:"12px",flex:2,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={save}>{es?"Guardar":"Save"}</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {pdfRoutine&&(
        <div style={{position:"fixed",inset:0,background:bg,zIndex:200,overflowY:"auto",padding:"0 0 80px"}}>
          <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),position:"sticky",top:0,background:bg,zIndex:10}}>
            <span style={{fontSize:22,fontWeight:800,letterSpacing:1,color:"#2563EB"}}>IRON TRACK · PDF</span>
            <div style={{display:"flex",gap:8}}>
              <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>{
                const el = document.getElementById("pdf-content");
                if(!el) return;
                const styles = [
                  "*{box-sizing:border-box;margin:0;padding:0}",
                  "body{background:#07080d;color:#e2e8f0;font-family:'Arial Narrow',Arial,sans-serif;padding:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
                  ".tag{display:inline-block;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700;margin-right:4px}",
                  "@media print{@page{margin:5mm;size:A4}button{display:none!important}}"
                ].join("");
                const fullHtml = "<!DOCTYPE html><html><head><meta charset=utf-8><title>"+pdfRoutine.r.name+" - Iron Track</title><style>"+styles+"</style></head><body>"+el.innerHTML+"<scr"+"ipt>window.onload=function(){window.print();}</"+"script></body></html>";
                const blob = new Blob([fullHtml],{type:"text/html"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "IronTrack-"+pdfRoutine.r.name.replace(/\s+/g,"-")+".html";
                a.click();
                URL.revokeObjectURL(url);
                toast2("Archivo descargado - abrilo y se imprime solo");
              }}>
                ⬇️ DESCARGAR PDF
              </button>
              <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",color:textMain,border:"none",borderRadius:8,padding:"8px 12px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setPdfRoutine(null)}>
                ✕
              </button>
            </div>
          </div>
          <div id="pdf-content" style={{padding:"16px"}}>
            <div style={{background:"#2563EB",borderRadius:12,padding:"8px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:22,fontWeight:900,letterSpacing:2,color:"#fff"}}>IRON TRACK</span>
              <span style={{fontSize:13,color:"#1E2D40",fontWeight:700}}>PLAN DE ENTRENAMIENTO</span>
            </div>
            <div style={{fontSize:28,fontWeight:900,letterSpacing:1,marginBottom:4}}>{pdfRoutine.r.name}</div>
            <div style={{fontSize:13,color:"#8B9AB2",marginBottom:16}}>{pdfRoutine.r.created} · {pdfRoutine.r.days.length} dias{pdfRoutine.r.note?" · "+pdfRoutine.r.note:""}</div>
            {pdfRoutine.rows.map((row,ri)=>{
              const pdfRowKey = (pdfRoutine.r?.id||"rut")+"-pdf-"+ri+"-"+row.type+"-"+(row.ex?.id||row.exName||row.label||"");
              if(row.type==="day") return(
                <div key={pdfRowKey} style={{fontSize:15,fontWeight:700,color:textMain,letterSpacing:2,borderBottom:"2px solid #243040",paddingBottom:4,margin:"16px 0 8px"}}>
                  {row.label}
                </div>
              );
              if(row.type==="warmup-header") return(
                <div key={pdfRowKey} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",background:"#2563EB11",border:"1px solid #243040",borderRadius:8,marginBottom:8}}>
                  <div style={{width:3,height:14,background:"#8B9AB2",borderRadius:2}}/>
                  <span style={{fontSize:15,fontWeight:800,color:"#8B9AB2",letterSpacing:1}}>ENTRADA EN CALOR</span>
                </div>
              );
              if(row.type==="warmup-ex") return(
                <div key={pdfRowKey} style={{background:bgCard,borderRadius:12,padding:"8px 12px",marginBottom:8,border:"1px solid "+border}}>
                  <div style={{fontSize:15,fontWeight:700,color:textMain,marginBottom:8}}>{row.exName}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                    {(row.wks||[{s:row.ex.sets||"-",r:row.ex.reps||"-",kg:"",filled:false,active:false},{s:row.ex.sets||"-",r:row.ex.reps||"-",kg:"",filled:false,active:false},{s:row.ex.sets||"-",r:row.ex.reps||"-",kg:"",filled:false,active:false},{s:row.ex.sets||"-",r:row.ex.reps||"-",kg:"",filled:false,active:false}]).map((w,wi)=>(
                      <div key={(row.ex?.id||"ex")+"-pdf-wu-sem-"+wi} style={{background:w.active?"#2563EB":"#162234",borderRadius:8,padding:w.active?"10px 4px":"7px 4px",textAlign:"center",border:w.active?"2px solid #2563EB":w.filled?"1px solid #243040":"1px solid "+border}}>
                        <div style={{fontSize:w.active?10:8,fontWeight:700,letterSpacing:1,color:w.active?"#FFFFFF":"#8B9AB2",marginBottom:w.active?5:3}}>{w.active?"→ ":" "}SEM {wi+1}</div>
                        <div style={{fontSize:w.active?16:13,fontWeight:800,color:w.active?"#FFFFFF":w.filled?"#FFFFFF":"#8B9AB2"}}>{w.s}×{w.r}</div>
                        {w.kg&&<div style={{fontSize:11,fontWeight:700,color:w.active?"#FFFFFF":"#8B9AB2",marginTop:4}}>{w.kg}kg</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
              if(row.type==="main-header") return(
                <div key={pdfRowKey} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",background:"#2563EB11",border:"2px solid #243040",borderRadius:8,marginBottom:8,marginTop:8}}>
                  <div style={{width:3,height:16,background:"#8B9AB2",borderRadius:2}}/>
                  <span style={{fontSize:15,fontWeight:800,color:"#8B9AB2",letterSpacing:1}}>BLOQUE PRINCIPAL</span>
                </div>
              );
              const {exName,col,ex,wks,pat,lastRpe} = row;
              const rpeColors2={6:"#22C55E",7:"#22C55E",8:"#60A5FA",9:"#8B9AB2",10:"#2563EB"};
              return(
                <div key={pdfRowKey} style={{background:"#1E2D40",border:"1px solid "+col+"44",borderRadius:12,padding:"12px",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:col,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:22,fontWeight:800,color:textMain,marginBottom:4}}>{exName}</div>
                      <div style={{fontSize:13,color:"#8B9AB2"}}>{row.info?.muscle||""} · {row.info?.equip||""}</div>
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
                      {ex.kg&&<span style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700,color:textMain}}>{ex.kg}kg</span>}
                      {ex.pause&&<span style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:6,padding:"4px 8px",fontSize:13,color:textMuted}}>{fmtP(ex.pause)}</span>}
                      {lastRpe&&<span style={{background:rpeColors2[lastRpe]+"33",border:"1px solid "+rpeColors2[lastRpe]+"66",borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:800,color:rpeColors2[lastRpe]}}>RPE {lastRpe}</span>}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                    {wks.map((w,wi)=>(
                      <div key={(ex?.id||"ex")+"-pdf-main-sem-"+wi} style={{background:w.active?"#2563EB":"#162234",borderRadius:8,padding:"8px 4px",textAlign:"center",border:w.active?"2px solid #2563EB":w.filled?"1px solid #243040":"1px solid "+border}}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:w.active?"#FFFFFF":"#8B9AB2",marginBottom:4}}>{w.active?"→ ":" "}SEM {wi+1}</div>
                        <div style={{fontSize:18,fontWeight:900,color:w.active?"#fff":w.filled?"#FFFFFF":"#8B9AB2"}}>{w.s}x{w.r}</div>
                        {w.kg&&<div style={{fontSize:13,fontWeight:700,color:w.active?"#FFFFFF":"#8B9AB2",marginTop:4}}>{w.kg}kg</div>}
                        {w.note&&<div style={{fontSize:11,color:"#8B9AB2",marginTop:4}}>{w.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{textAlign:"center",color:"#8B9AB2",fontSize:11,marginTop:20,paddingTop:8,borderTop:"1px solid "+border}}>
              Generado con IRON TRACK
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html:
            "@media print{" +
            "nav,#pdf-header{display:none!important}" +
            "body{background:#07080d!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
            "@page{margin:6mm;background:#07080d}" +
            "}"
          }}/>
        </div>
      )}
      {addExModal&&(
        <>
        <div
          role="presentation"
          style={{
            position:"fixed",inset:0,zIndex:150,
            display:"flex",flexDirection:"column",
            height:"100dvh",maxHeight:"100dvh",minHeight:0,
            overflow:"hidden",boxSizing:"border-box",
            background:"rgba(0,0,0,.92)",
          }}
          onClick={()=>{setAddExModal(null);setAddExSelectedIds([]);}}
        >
          <div style={{flex:"1 1 0%",minHeight:0,minWidth:0}} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-ex-modal-title"
            style={{
              flex:"0 1 auto",
              width:"100%",maxHeight:"80dvh",minHeight:0,
              display:"flex",flexDirection:"column",overflow:"hidden",boxSizing:"border-box",
              background:bgCard,borderRadius:"16px 16px 0 0",
            }}
            onClick={e=>e.stopPropagation()}
          >
            <div style={{flex:"none",padding:"16px 16px 0 16px",background:bgCard}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                <div style={{minWidth:0,paddingRight:8}}>
                  <div id="add-ex-modal-title" style={{fontSize:22,fontWeight:800,letterSpacing:1}}>{es?"Agregar ejercicios":"Add exercises"}</div>
                  <div style={{fontSize:13,color:textMuted,marginTop:4,maxWidth:320,lineHeight:1.4,wordBreak:"break-word"}}>
                    {(addExModal.bloque||"exercises")==="warmup"
                      ? (es?"Tocá para marcar varios en entrada en calor; confirmá abajo.":"Tap to select warm-up exercises, then confirm.")
                      : (es?"Tocá para marcar varios en bloque principal; confirmá abajo.":"Tap to select main exercises, then confirm.")}
                  </div>
                </div>
                <button type="button" className="hov" style={{...btn(),padding:"6px",flexShrink:0}} onClick={()=>{setAddExModal(null);setAddExSelectedIds([]);}} aria-label={es?"Cerrar":"Close"}><Ic name="x" size={20}/></button>
              </div>
              <input style={{...inp,marginBottom:8,width:"100%",boxSizing:"border-box"}} placeholder={es?"Buscar...":"Search..."} value={addExSearch} onChange={e=>setAddExSearch(e.target.value)}/>
              <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:12,paddingBottom:4,minHeight:44,alignItems:"center",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none"}}>
                {Object.entries(PATS).map(([k,p])=>(
                  <button key={k} type="button" className="hov" style={{background:addExPat===k?p.color+"44":"#2D4057",color:addExPat===k?p.color:textMuted,border:addExPat===k?"1px solid "+p.color:"1px solid "+border,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:".5px"}} onClick={()=>setAddExPat(addExPat===k?null:k)}>
                    {p.icon} {es?p.label:p.labelEn}
                  </button>
                ))}
              </div>
            </div>
            <div style={{flex:1,minHeight:0,minWidth:0,overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",padding:"8px 16px 100px 16px",boxSizing:"border-box",touchAction:"pan-y"}}>
              {allEx.filter(e=>{
                const q=addExSearch.toLowerCase();
                if(addExPat&&e.pattern!==addExPat) return false;
                if(!q) return true;
                return (e.name||"").toLowerCase().includes(q)||(e.nameEn||"").toLowerCase().includes(q)||(e.muscle||"").toLowerCase().includes(q);
              }).map(ex=>{
                const pat=PATS[ex.pattern]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"};
                const sel=addExSelectedIds.includes(ex.id);
                return(
                  <div key={ex.id} className="hov" role="button" tabIndex={0} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 10px",borderRadius:12,marginBottom:8,background:darkMode?"#162234":"#E2E8F0",cursor:"pointer",border:sel?"2px solid "+(pat.color||"#2563EB"):"2px solid transparent"}} onClick={()=>setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];})}>
                    <div style={{width:52,height:52,borderRadius:12,background:pat.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:pat.color,flexShrink:0,marginTop:2}}>{pat.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:18,fontWeight:700,lineHeight:1.25,wordBreak:"break-word"}}>{es?ex.name:ex.nameEn}</div>
                      <div style={{fontSize:12,fontWeight:700,color:pat.color,textTransform:"uppercase",letterSpacing:.4,marginTop:4,lineHeight:1.3}}>{es?pat.label:pat.labelEn}</div>
                      {(ex.muscle||ex.equip)&&<div style={{fontSize:14,color:textMuted,marginTop:2,lineHeight:1.35,wordBreak:"break-word"}}>{[ex.muscle,ex.equip].filter(Boolean).join(" · ")}</div>}
                    </div>
                    <div style={{width:28,height:28,borderRadius:"50%",border:sel?"2px solid "+pat.color:"2px solid "+border,background:sel?pat.color+"33":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:4}}>
                      {sel ? <Ic name="check-sm" size={16} color={pat.color}/> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div
          style={{
            position:"fixed",bottom:80,left:20,right:20,zIndex:9999,
            display:"flex",gap:8,
            background:darkMode?"#111":"#FFFFFF",
            padding:"12px 16px calc(12px + env(safe-area-inset-bottom, 0px)) 16px",
            borderRadius:12,
            border:darkMode?"1px solid #222":"1px solid "+border,
            boxSizing:"border-box",
            boxShadow:"0 -10px 15px -3px rgba(0,0,0,0.5), 0 -4px 6px -2px rgba(0,0,0,0.3)",
          }}
          onClick={e=>e.stopPropagation()}
        >
          <button type="button" className="hov" style={{...btn(),flex:1,padding:"12px",fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",fontSize:13}} onClick={()=>{setAddExModal(null);setAddExSelectedIds([]);}}>{es?"CANCELAR":"CANCEL"}</button>
          <button type="button" className="hov" style={{...btn("#2563EB"),flex:2,padding:"12px",fontWeight:800,opacity:addExSelectedIds.length?1:0.5,textTransform:"uppercase",letterSpacing:".5px",fontSize:13}} disabled={!addExSelectedIds.length} onClick={async function(){
            if(!addExModal||addExSelectedIds.length===0) return;
            var blk=addExModal.bloque||"exercises";
            var rId=addExModal.rId;
            var dIdx=addExModal.dIdx;
            var r=routines.find(function(rr){return rr.id===rId;});
            var day=r&&r.days?r.days[dIdx]:null;
            var existing=new Set((day&&day[blk]?day[blk]:[]).map(function(e){return e.id;}));
            var ids=addExSelectedIds.filter(function(id){return !existing.has(id);});
            if(ids.length===0){toast2(es?"Ya están en ese bloque":"Already in that block");return;}
            var newExs=ids.map(function(id){
              var ex=allEx.find(function(e){return e.id===id;});
              if(!ex) return null;
              return {id:ex.id,sets:"3",reps:"8-10",kg:"",pause:0,note:"",weeks:[]};
            }).filter(Boolean);
            setRoutines(function(p){return p.map(function(rr){
              if(rr.id!==rId) return rr;
              return {...rr,days:rr.days.map(function(d,i){
                if(i!==dIdx) return d;
                return {...d,[blk]:[...(d[blk]||[]),...newExs]};
              })};
            });});
            var rSB=rutinasSB.find(function(x){return x.id===rId;});
            if(rSB){
              try{
                var diasAct=(rSB.datos&&rSB.datos.days?rSB.datos.days:[]).map(function(d,i){
                  if(i!==dIdx) return d;
                  return {...d,[blk]:[...(d[blk]||[]),...newExs]};
                });
                await sb.updateRutina(rSB.id,{nombre:rSB.nombre,alumno_id:rSB.alumno_id,datos:{...rSB.datos,days:diasAct},entrenador_id:"entrenador_principal"});
                setRutinasSB(function(prev){return prev.map(function(rw){return rw.id===rSB.id?{...rw,datos:{...rw.datos,days:diasAct}}:rw;});});
              }catch(e){console.error("Add batch save error:",e);}
            }
            toast2((es?"Agregados ":"Added ")+newExs.length+(es?" ejercicios":" exercises"));
            setAddExModal(null);
            setAddExSelectedIds([]);
          }}>{es?"AÑADIR SELECCIONADOS":"ADD SELECTED"}{addExSelectedIds.length?" ("+addExSelectedIds.length+")":""}</button>
        </div>
        </>
      )}
      {toast&&(()=>{
        const isSuccess = toast.includes("✓")||toast.includes("💪")||toast.includes("✅")||toast.includes("listo")||toast.includes("done")||toast.includes("enviada")||toast.includes("copiado")||toast.includes("creado")||toast.includes("sent")||toast.includes("saved");
        const isError = toast.includes("Error")||toast.includes("error");
        const bg = isError?"#EF444422":isSuccess?"#22C55E22":darkMode?"#1E2D40":"#F0F4F8";
        const brd = isError?"#EF444444":isSuccess?"#22C55E44":border;
        const col = isError?"#EF4444":isSuccess?"#22C55E":textMain;
        return(
          <div style={{
            position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",
            background:bg,border:"1px solid "+brd,color:col,
            padding:"8px 20px",borderRadius:24,fontSize:15,fontWeight:600,
            zIndex:250,whiteSpace:"nowrap",
            boxShadow:"0 8px 24px rgba(0,0,0,0.3)",
            animation:"slideUpFade 0.25s ease"
          }}>{toast}</div>
        );
      })()}

      </div>
      <nav style={{
        position:"fixed",bottom:0,left:0,right:0,
        background:darkMode?"rgba(15,25,35,0.96)":"rgba(255,255,255,0.96)",
        backdropFilter:"blur(12px)",
        borderTop:"1px solid "+(darkMode?"#1E2D40":"#E2E8F0"),
        display:"flex",zIndex:40,
        paddingBottom:"env(safe-area-inset-bottom,0px)"
      }}>
        {tabs2.map(tb=>{
          const isActive = tab===tb.k;
          return(
            <button key={tb.k} onClick={()=>setTab(tb.k)}
              style={{flex:1,background:"none",border:"none",
                padding:"8px 0 12px",cursor:"pointer",
                display:"flex",flexDirection:"column",
                alignItems:"center",gap:4,
                position:"relative"}}>
              <div style={{
                position:"absolute",top:0,left:"50%",
                transform:"translateX(-50%)",
                height:3,width:isActive?28:0,
                background:"#2563EB",borderRadius:"0 0 3px 3px",
                transition:"width .25s cubic-bezier(.4,0,.2,1)"
              }}/>
              <div style={{
                background:isActive?(darkMode?"#2563EB22":"#2563EB15"):"transparent",
                borderRadius:8,
                padding:"4px 12px",
                transition:"all .2s ease",
                display:"flex",alignItems:"center",justifyContent:"center"
              }}>
                {tb.icon(isActive?"#2563EB":(darkMode?"#8B9AB2":"#64748B"))}
              </div>
              <span style={{
                fontSize:11,fontWeight:isActive?700:500,
                letterSpacing:0.3,
                color:isActive?"#2563EB":(darkMode?"#8B9AB2":"#64748B"),
                transition:"color .2s"
              }}>{tb.lbl}</span>
            </button>
          );
        })}
      </nav>
      </div>
    </div>
  );
}

function GraficoProgreso({progress, EX, readOnly, sharedParam, sb, sessionData, es, darkMode, sesiones, allEx}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [sbData, setSbData] = React.useState([]);
  const [loadingGrafico, setLoadingGrafico] = React.useState(true);
  const [expandedEx, setExpandedEx] = React.useState(null);

  React.useEffect(()=>{
    const alumnoId = sessionData?.alumnoId || (sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(!alumnoId) { setLoadingGrafico(false); return; }
    sb.getProgreso(alumnoId).then(function(prog){
      if(prog) setSbData(prog);
      setLoadingGrafico(false);
    }).catch(function(){setLoadingGrafico(false)});
  },[]);

  const getDatos = (exId) => {
    const local = (progress[exId]?.sets||[]).map(s=>({kg:parseFloat(s.kg)||0,reps:parseInt(s.reps)||0,fecha:s.date})).filter(s=>s.kg>0);
    const remote = sbData.filter(d=>d.ejercicio_id===exId&&d.kg>0).map(d=>({kg:parseFloat(d.kg),reps:parseInt(d.reps)||0,fecha:d.fecha}));
    const todos = [...local,...remote].sort(function(a,b){
      var da=a.fecha?a.fecha.split('/').reverse().join('-'):'';
      var db=b.fecha?b.fecha.split('/').reverse().join('-'):'';
      return da>db?1:-1;
    });
    const seen = new Set();
    return todos.filter(d=>{ const k=d.fecha+d.kg; if(seen.has(k))return false; seen.add(k); return true; }).slice(-20);
  };

  // Ejercicios con datos (de la rutina del alumno + cualquiera con registros)
  const exConDatos = (allEx||EX||[]).filter(function(e){
    return (progress[e.id]?.sets||[]).some(function(s){return parseFloat(s.kg)>0}) ||
           sbData.some(function(d){return d.ejercicio_id===e.id&&parseFloat(d.kg)>0});
  });

  if(loadingGrafico) return (
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div className="sk" style={{height:80,borderRadius:12,marginBottom:8}}/>
      <div className="sk" style={{height:80,borderRadius:12,marginBottom:8}}/>
      <div className="sk" style={{height:80,borderRadius:12}}/>
    </div>
  );

  if(exConDatos.length===0) return (
    <div style={{textAlign:"center",padding:"40px 16px"}}>
      <div style={{fontSize:44,marginBottom:12}}>📊</div>
      <div style={{fontSize:17,fontWeight:700,color:textMain,marginBottom:8}}>{es?"Sin datos aún":"No data yet"}</div>
      <div style={{fontSize:13,color:textMuted,lineHeight:1.6}}>{es?"Registrá sets con peso para ver tu progreso.":"Log sets with weight to see your progress."}</div>
    </div>
  );

  return (
    <div>
      <div style={{fontSize:11,fontWeight:800,color:"#2563EB",letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>
        {es?"PROGRESO POR EJERCICIO":"PROGRESS BY EXERCISE"} ({exConDatos.length})
      </div>
      {exConDatos.map(function(e){
        var datos = getDatos(e.id);
        if(datos.length===0) return null;
        var pr = Math.max.apply(null, datos.map(function(d){return d.kg}));
        var ultimo = datos[datos.length-1];
        var primero = datos[0];
        var diff = datos.length>=2 ? Math.round((ultimo.kg-primero.kg)*10)/10 : 0;
        var pct = primero.kg>0 ? Math.round((ultimo.kg-primero.kg)/primero.kg*100) : 0;
        var isExpanded = expandedEx===e.id;
        var tendDir = pct>0?"sube":pct<0?"baja":"estable";

        return (
          <div key={e.id} style={{background:bgCard,border:"1px solid "+(isExpanded?"#2563EB":border),borderRadius:12,marginBottom:8,overflow:"hidden",transition:"all .2s"}}>
            {/* Card compacta - siempre visible */}
            <div onClick={function(){setExpandedEx(isExpanded?null:e.id)}} style={{padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:40,height:40,borderRadius:10,background:tendDir==="sube"?"#22C55E15":tendDir==="baja"?"#EF444415":"#2563EB15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {tendDir==="sube"?"↑":tendDir==="baja"?"↓":"→"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:textMain,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{es?e.name:(e.nameEn||e.name)}</div>
                <div style={{display:"flex",gap:8,alignItems:"center",marginTop:2}}>
                  <span style={{fontSize:12,color:textMuted}}>{es?"Último":"Last"}: {ultimo.kg}kg×{ultimo.reps}</span>
                  {datos.length>=2&&<span style={{fontSize:11,fontWeight:700,color:tendDir==="sube"?"#22C55E":tendDir==="baja"?"#EF4444":"#8B9AB2"}}>{pct>0?"+":""}{pct}%</span>}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:18,fontWeight:900,color:"#fbbf24"}}>{pr}kg</div>
                <div style={{fontSize:10,fontWeight:700,color:"#fbbf24"}}>PR</div>
              </div>
              <div style={{fontSize:13,color:textMuted,flexShrink:0}}>{isExpanded?"▲":"▼"}</div>
            </div>

            {/* Gráfico expandido */}
            {isExpanded&&(
              <div style={{padding:"0 14px 14px",borderTop:"1px solid "+border}}>
                {/* Mini gráfico SVG inline */}
                <div style={{height:120,position:"relative",marginTop:8}}>
                  {(function(){
                    var W=300,H=100,padL=40,padR=10,padT=10,padB=20;
                    var pts=datos;
                    if(pts.length<2) return <div style={{textAlign:"center",padding:"20px 0",fontSize:13,color:textMuted}}>{es?"Necesitás al menos 2 registros":"Need at least 2 records"}</div>;
                    var kgs=pts.map(function(p){return p.kg});
                    var minK=Math.min.apply(null,kgs);
                    var maxK=Math.max.apply(null,kgs);
                    var rangeK=maxK-minK||1;
                    var points=pts.map(function(p,i){
                      var x=padL+(W-padL-padR)*i/(pts.length-1);
                      var y=padT+(H-padT-padB)*(1-(p.kg-minK)/rangeK);
                      return{x:x,y:y,kg:p.kg,reps:p.reps,fecha:p.fecha};
                    });
                    var pathD="M"+points.map(function(p){return p.x+","+p.y}).join("L");
                    var areaD=pathD+"L"+points[points.length-1].x+","+(H-padB)+"L"+points[0].x+","+(H-padB)+"Z";
                    return(
                      <svg width="100%" viewBox={"0 0 "+W+" "+H} style={{overflow:"visible"}}>
                        <defs><linearGradient id={"grad-"+e.id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity="0.3"/><stop offset="100%" stopColor="#2563EB" stopOpacity="0"/></linearGradient></defs>
                        {[0,0.25,0.5,0.75,1].map(function(f,i){
                          var y2=padT+(H-padT-padB)*f;
                          var val=Math.round(maxK-(maxK-minK)*f);
                          return(<g key={e.id+"-chart-grid-y-"+val}><line x1={padL} y1={y2} x2={W-padR} y2={y2} stroke={border} strokeWidth="0.5"/><text x={padL-4} y={y2+3} textAnchor="end" fill={textMuted} fontSize="9">{val}</text></g>);
                        })}
                        <path d={areaD} fill={"url(#grad-"+e.id+")"}/>
                        <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        {points.map(function(p,i){return(
                          <g key={e.id+"-chart-pt-"+(p.fecha||"")+"-"+p.kg+"-"+i}>
                            <circle cx={p.x} cy={p.y} r={i===points.length-1?5:3} fill={p.kg>=pr?"#fbbf24":"#2563EB"} stroke={_dm?"#0F1923":"#fff"} strokeWidth="2"/>
                            {i===points.length-1&&<text x={p.x} y={p.y-10} textAnchor="middle" fill="#2563EB" fontSize="11" fontWeight="700">{p.kg}kg</text>}
                          </g>
                        )})}
                        {pts.length<=8&&points.map(function(p,i){return(
                          <text key={e.id+"-xaxis-"+(p.fecha||"")+"-"+i} x={p.x} y={H-padB+12} textAnchor="middle" fill={textMuted} fontSize="8">{(p.fecha||"").split("/").slice(0,2).join("/")}</text>
                        )})}
                      </svg>
                    );
                  })()}
                </div>
                {/* Historial de registros */}
                <div style={{marginTop:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:textMuted,marginBottom:6}}>{es?"HISTORIAL":"HISTORY"} ({datos.length})</div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {datos.slice().reverse().slice(0,6).map(function(d,i){
                      var esPR=d.kg>=pr;
                      return(
                        <div key={e.id+"-exp-hist-"+(d.fecha||"")+"-"+d.kg+"-"+d.reps+"-"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 8px",background:esPR?"#fbbf2410":bgSub,borderRadius:6,border:esPR?"1px solid #fbbf2433":"none"}}>
                          <span style={{fontSize:12,color:textMuted}}>{d.fecha}</span>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:13,fontWeight:700,color:esPR?"#fbbf24":textMain}}>{d.kg}kg × {d.reps}</span>
                            {esPR&&<span style={{fontSize:9,fontWeight:700,color:"#fbbf24"}}>🏆</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistorialSesiones({sharedParam, sb, EX, darkMode, es, sesiones}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [sesionesData, setSesionesData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(()=>{
    const load = async () => {
      try {
        const rutData = JSON.parse(atob(sharedParam));
        const alumnoId = rutData.alumnoId;
        if(alumnoId) {
          const ses = await sb.getSesiones(alumnoId);
          setSesionesData(ses||[]);
        }
      } catch(e) {}
      setLoading(false);
    };
    load();
  },[]);

  if(loading) return (
    <div>
      {[1,2,3,4].map(i=>(
        <div key={"historial-sesiones-skel-"+i} style={{background:bgCard,borderRadius:12,padding:"8px 12px",marginBottom:8,border:"1px solid "+border}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div className="sk" style={{height:14,width:"40%"}}/>
            <div className="sk" style={{height:12,width:"20%"}}/>
          </div>
          <div className="sk" style={{height:11,width:"60%"}}/>
        </div>
      ))}
    </div>
  );

  if(sesionesData.length===0) return (
    <div style={{textAlign:"center",padding:"30px 0",color:textMuted}}>
      <div style={{fontSize:44,marginBottom:12}}>📋</div>
      <div style={{fontSize:18,fontWeight:700,color:textMain,marginBottom:8}}>{es?"Sin sesionesData aún":"No sessions yet"}</div>
      <div style={{fontSize:13,color:textMuted,lineHeight:1.5}}>{es?"Completá tu primer entrenamiento para ver el historial aquí":"Complete your first workout to see your history here"}</div>
    </div>
  );

  return (
    <div>
      {sesionesData.map((s,i)=>(
        <div key={s.id||("sesion-"+(s.fecha||"")+"-"+(s.hora||"")+"-"+i)} style={{background:bgCard,borderRadius:12,padding:"16px 18px",marginBottom:8,border:"1px solid "+border}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <div style={{fontSize:15,fontWeight:800,color:"#22C55E"}}>✅ {s.dia_label}</div>
            <div style={{fontSize:13,color:textMuted}}>{s.fecha} · {s.hora}</div>
          </div>
          <div style={{fontSize:13,color:textMuted,marginBottom:4}}>Semana {s.semana} · {s.rutina_nombre}</div>
          {s.ejercicios&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8}}>
              {s.ejercicios.split(",").map(exId=>{
                const ex = EX.find(e=>e.id===exId);
                return ex ? <span key={exId} style={{background:_dm?"#162234":"#E2E8F0",color:textMuted,borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:700}}>{ex.name}</span> : null;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FotosProgreso({sharedParam, sb, esEntrenador, darkMode, es, toast2}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [fotos, setFotos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [fotoGrande, setFotoGrande] = React.useState(null);
  const [confirmarId, setConfirmarId] = React.useState(null);
  const fileRef = React.useRef();

  const alumnoId = React.useMemo(()=>{
    try { return JSON.parse(atob(sharedParam)).alumnoId; } catch(e) { return null; }
  },[sharedParam]);

  React.useEffect(()=>{
    if(!alumnoId) { setLoading(false); return; }
    sb.getFotos(alumnoId).then(f=>{ setFotos(f||[]); setLoading(false); });
  },[]);

  const subirFoto = async (e) => {
    const file = e.target.files[0];
    if(!file || !alumnoId) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      const fecha = new Date().toLocaleDateString("es-AR");
      const res = await sb.addFoto({alumno_id: alumnoIdSync, imagen: base64, fecha, nota:""});
      if(res && res[0]) setFotos(prev=>[res[0],...prev]);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const borrarFoto = async (id) => {
    await sb.deleteFoto(id);
    setFotos(prev=>prev.filter(f=>f.id!==id));
    setConfirmarId(null);
  };

  if(loading) return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
      {[1,2,3,4,5,6].map(i=>(
        <div key={"fotos-progreso-skel-"+i} className="sk" style={{aspectRatio:"1",borderRadius:12}}/>
      ))}
    </div>
  );

  return (
    <div>
      {!esEntrenador&&(
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={subirFoto} capture="environment"/>
      )}
      {!esEntrenador&&(
        <button style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"12px",width:"100%",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:12}} onClick={()=>fileRef.current.click()}>
          {uploading ? "Subiendo..." : "📸 SUBIR FOTO DE PROGRESO"}
        </button>
      )}
      {fotos.length>=2&&<FotosSlider es={es} darkMode={darkMode} toast2={toast2} sb={sb} sessionData={sessionData}/>}

      {fotos.length===0&&(
      <div style={{textAlign:"center",padding:"32px 16px"}}>
        <div style={{fontSize:44,marginBottom:12}}>📸</div>
        <div style={{fontSize:18,fontWeight:700,color:textMain,marginBottom:8}}>{es?"Sin fotos aún":"No photos yet"}</div>
        <div style={{fontSize:13,color:textMuted,lineHeight:1.5,marginBottom:16}}>
          {es?"Subí tu primera foto para empezar a trackear tu cambio físico":"Upload your first photo to start tracking your physical progress"}
        </div>
        {!esEntrenador&&(
          <button onClick={()=>fileRef.current?.click()}
            style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
              padding:"12px 24px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            📸 {es?"Subir primera foto":"Upload first photo"}
          </button>
        )}
      </div>
    )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {fotos.map((f,i)=>(
          <div key={f.id!=null?String(f.id):"foto-row-"+i} style={{borderRadius:12,overflow:"hidden",position:"relative"}}>
            <img src={f.imagen} style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",display:"block",cursor:"pointer"}} onClick={()=>setFotoGrande(f)}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(0,0,0,.8),transparent)",padding:"20px 8px 6px"}}>
              <div style={{fontSize:11,color:textMain,fontWeight:700}}>{f.fecha}</div>
            </div>
            <div style={{position:"absolute",top:6,right:6,display:"flex",gap:8}}>
              <button style={{width:28,height:28,borderRadius:6,border:"none",background:"rgba(0,0,0,.65)",color:"#fff",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setFotoGrande(f)}><Ic name="zoom-in" size={15}/></button>
              {!esEntrenador&&(
                <button style={{width:28,height:28,borderRadius:6,border:"none",background:"rgba(239,68,68,.85)",color:"#fff",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setConfirmarId(f.id||i)}><Ic name="trash-2" size={15}/></button>
              )}
            </div>
          </div>
        ))}
        {!esEntrenador&&(
          <div style={{borderRadius:12,border:"2px dashed #2d3748",aspectRatio:"3/4",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",background:bgSub}} onClick={()=>fileRef.current.click()}>
            <div style={{fontSize:28,color:textMuted}}>+</div>
            <div style={{fontSize:11,color:textMuted,fontWeight:500}}>Nueva foto</div>
          </div>
        )}
      </div>
      {fotoGrande&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:300,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setFotoGrande(null)}>
          <img src={fotoGrande.imagen} style={{maxWidth:"100%",maxHeight:"80dvh",objectFit:"contain",borderRadius:12}}/>
          <div style={{color:textMuted,marginTop:12,fontSize:15}}>{fotoGrande.fecha}</div>
          <button style={{marginTop:12,background:_dm?"#162234":"#E2E8F0",color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 20px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setFotoGrande(null)}>Cerrar</button>
        </div>
      )}
      {confirmarId!==null&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:310,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setConfirmarId(null)}>
          <div style={{background:bgCard,borderRadius:16,padding:20,width:"100%",maxWidth:320,border:"1px solid "+border,textAlign:"center",animation:"fadeIn 0.25s ease"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:36,marginBottom:8}}>🗑️</div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Borrar esta foto?</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>Esta accion no se puede deshacer</div>
            <div style={{display:"flex",gap:8}}>
              <button style={{flex:1,padding:"8px",background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setConfirmarId(null)}>Cancelar</button>
              <button style={{flex:1,padding:"8px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>borrarFoto(confirmarId)}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GestionBiblioteca({sb, customEx, setCustomEx, toast2, es, darkMode, videoOverrides, setVideoOverrides, setVideoModal}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const allEx = React.useMemo(()=>[...EX,...(customEx||[])],[customEx]);
  const [tab, setTab] = React.useState(0);
  const [busq, setBusq] = React.useState("");
  const [filtPat, setFiltPat] = React.useState("todos");
  const [filtMus, setFiltMus] = React.useState("todos");
  const [modoFiltro, setModoFiltro] = React.useState("patron");
  const [editModal, setEditModal] = React.useState(null);
  const [editNombre, setEditNombre] = React.useState("");
  const [editYT, setEditYT] = React.useState("");
  const [newNombre, setNewNombre] = React.useState("");
  const [newPat, setNewPat] = React.useState("empuje");
  const [newMus, setNewMus] = React.useState("");
  const [newEquip, setNewEquip] = React.useState("");
  const [newYT, setNewYT] = React.useState("");
  const [borrarId, setBorrarId] = React.useState(null);
  const ytOverrides = videoOverrides || {};

  const patrones = ["todos","empuje","traccion","rodilla","bisagra","core","movilidad","cardio","oly"];
  const musculos = ["todos","Cuadriceps","Gluteo","Isquios","Pecho","Dorsal","Hombro","Biceps","Triceps","Core","Pantorrilla"];
  const patColors = {empuje:"#8B9AB2",traccion:"#8B9AB2",rodilla:"#8B9AB2",bisagra:"#8B9AB2",core:"#8B9AB2",movilidad:"#8B9AB2",cardio:"#8B9AB2",oly:"#8B9AB2"};
  const patLabel = p => ({
    todos:es?"TODOS":"ALL", empuje:es?"EMPUJE":"PUSH", traccion:es?"TRACCION":"PULL",
    rodilla:es?"RODILLA":"KNEE", bisagra:es?"BISAGRA":"HINGE", core:"CORE",
    movilidad:es?"MOVILIDAD":"MOBILITY", cardio:"CARDIO", oly:es?"OLIMPICO":"OLYMPIC",
  })[p] || p.toUpperCase();
  const musLabel = m => m==="todos"?(es?"TODOS":"ALL"):m==="Dorsal"?(es?"DORSAL":"BACK"):m==="Gluteo"?(es?"GLUTEO":"GLUTE"):m==="Isquios"?(es?"ISQUIOS":"HAMSTRINGS"):m==="Pecho"?(es?"PECHO":"CHEST"):m==="Hombro"?(es?"HOMBRO":"SHOULDER"):m==="Pantorrilla"?(es?"PANTORRILLA":"CALVES"):m.toUpperCase();

  const exFiltrados = allEx.filter(e=>{
    const nombre = es?e.name:(e.nameEn||e.name);
    const matchQ = !busq || nombre.toLowerCase().includes(busq.toLowerCase());
    const matchPat = filtPat==="todos" || e.pattern===filtPat;
    const matchMus = filtMus==="todos" || (e.muscle||"").toLowerCase().includes(filtMus.toLowerCase());
    return matchQ && (modoFiltro==="patron"?matchPat:matchMus);
  });

  const counts = {};
  allEx.forEach(e=>{ counts[e.name.toLowerCase()]=(counts[e.name.toLowerCase()]||0)+1; });
  const dupCount = Object.values(counts).filter(v=>v>1).length;

  const guardarEdicion = async () => {
    if(!editNombre.trim()){toast2(es?"Ingresa un nombre":"Enter a name");return;}
    const isCustom = !!(customEx||[]).find(c=>c.id===editModal.id);
    if(isCustom) {
      const updated = customEx.map(e=>e.id===editModal.id?{...e,name:editNombre,youtube:editYT}:e);
      setCustomEx(updated);
      localStorage.setItem("it_cex", JSON.stringify(updated));
      // Actualizar en Supabase
      try { await sb.updateCustomEx(editModal.id, {name:editNombre, youtube:editYT}); } catch(e){}
    }
    // Guardar override de youtube en Supabase
    if(editYT) {
      try {
        await sb.setVideoOverride(editModal.id, editYT);
        if(setVideoOverrides) setVideoOverrides(function(prev){return {...prev, [editModal.id]: editYT}});
      } catch(e){ console.error("[videoOverride]",e); }
    }
    setEditModal(null); toast2(es?"Link actualizado ✓":"Link updated ✓");
  };
  const borrarEjercicio = async (id) => {
    const updated = customEx.filter(e=>e.id!==id);
    setCustomEx(updated);
    localStorage.setItem("it_cex", JSON.stringify(updated));
    try { await sb.deleteCustomEx(id); } catch(e){}
    setBorrarId(null); toast2(es?"Ejercicio eliminado ✓":"Exercise deleted ✓");
  };
  const agregarEjercicio = async () => {
    if(!newNombre.trim()){toast2(es?"Ingresa un nombre":"Enter a name");return;}
    const newEx = {id:"custom_"+Date.now(), name:newNombre, nameEn:newNombre, pattern:newPat, muscle:newMus, equip:newEquip||"Libre", youtube:newYT};
    const updated = [...(customEx||[]), newEx];
    setCustomEx(updated);
    localStorage.setItem("it_cex", JSON.stringify(updated));
    // Guardar en Supabase
    try {
      await sb.addCustomEx({id:newEx.id, name:newEx.name, name_en:newEx.nameEn, pattern:newEx.pattern, muscle:newEx.muscle, equip:newEx.equip, youtube:newEx.youtube, entrenador_id:"entrenador_principal"});
    } catch(e){ console.error("[addCustomEx]",e); }
    setNewNombre(""); setNewPat("empuje"); setNewMus(""); setNewEquip(""); setNewYT("");
    setTab(0); toast2(es?"Ejercicio agregado ✓":"Exercise added ✓");
  };
  const inpS = {background:bg,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",color:textMain,fontSize:15,width:"100%",fontFamily:"inherit",outline:"none",marginBottom:8};

  return (
    <div>
      <div style={{display:"flex",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),marginBottom:12}}>
        {[es?"GESTIONAR":"MANAGE", es?"+ NUEVO":"+ NEW"].map((t,i)=>(
          <button key={i===0?"bib-tab-manage":"bib-tab-new"} onClick={()=>setTab(i)} style={{flex:1,padding:"16px",border:"none",background:"none",
            fontFamily:"inherit",fontSize:18,fontWeight:800,cursor:"pointer",
            color:tab===i?"#2563EB":"#8B9AB2",borderBottom:tab===i?"2px solid #3B82F6":"2px solid transparent"}}>
            {t}{i===0&&dupCount>0?(
              <span
                title={es?`Hay ${dupCount} nombres de ejercicio duplicados`:`There are ${dupCount} duplicate exercise names`}
                style={{marginLeft:8,background:"#2563EB",color:"#fff",borderRadius:12,padding:"1px 7px",fontSize:13,display:"inline-flex",alignItems:"center",justifyContent:"center"}}
              >
                <Ic name="alert-triangle" size={12} color="#fff"/>
              </span>
            ):null}
          </button>
        ))}
      </div>

      {tab===0&&(
        <div>
          <input style={{...inpS,marginBottom:8}} placeholder={es?"🔍 Buscar ejercicio...":"🔍 Search exercise..."} value={busq} onChange={e=>setBusq(e.target.value)}/>

          <div style={{display:"flex",background:bgSub,border:"1px solid "+border,borderRadius:12,padding:4,gap:4,marginBottom:8}}>
            {[es?"POR PATRON":"BY PATTERN", es?"POR MUSCULO":"BY MUSCLE"].map((t,i)=>(
              <button key={i===0?"bib-filt-patron":"bib-filt-muscle"} onClick={()=>{setModoFiltro(i===0?"patron":"musculo");setFiltPat("todos");setFiltMus("todos");}}
                style={{flex:1,padding:"8px",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",
                  background:modoFiltro===(i===0?"patron":"musculo")?"#2563EB":"transparent",
                  color:modoFiltro===(i===0?"patron":"musculo")?"#fff":"#8B9AB2"}}>
                {t}
              </button>
            ))}
          </div>

          {modoFiltro==="patron"&&(
            <div style={{overflowX:"auto",paddingBottom:8,marginBottom:8}}>
              <div style={{display:"flex",gap:8,width:"max-content"}}>
                {patrones.map(p=>(
                  <button key={p} onClick={()=>setFiltPat(p)} style={{padding:"8px 16px",borderRadius:20,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",
                    border:filtPat===p?"1px solid "+patColors[p]:filtPat==="todos"&&p==="todos"?"1px solid #243040":"1px solid "+border,
                    background:filtPat===p?patColors[p]+"22":filtPat==="todos"&&p==="todos"?"#2563EB22":"#1E2D40",
                    color:filtPat===p?patColors[p]:filtPat==="todos"&&p==="todos"?"#2563EB":"#8B9AB2"}}>
                    {patLabel(p)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {modoFiltro==="musculo"&&(
            <div style={{overflowX:"auto",paddingBottom:8,marginBottom:8}}>
              <div style={{display:"flex",gap:8,width:"max-content"}}>
                {musculos.map(m=>(
                  <button key={m} onClick={()=>setFiltMus(m==="todos"?"todos":m)} style={{padding:"8px 16px",borderRadius:20,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",
                    border:filtMus===m?"1px solid #60a5fa":"1px solid "+border,
                    background:filtMus===m?"#2563EB22":"#1E2D40",
                    color:filtMus===m?"#2563EB":"#8B9AB2"}}>
                    {musLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{fontSize:15,color:textMuted,marginBottom:8,fontWeight:700}}>
            {es?"Mostrando":"Showing"} {exFiltrados.length} {es?"ejercicios de":"exercises of"} {allEx.length}
          </div>

          <div>
          {exFiltrados.map(e=>{
            const isDup = counts[e.name.toLowerCase()]>1;
            const patCol = patColors[e.pattern]||"#8B9AB2";
            const isCustom = !!(customEx||[]).find(c=>c.id===e.id);
            const nombre = es?e.name:(e.nameEn||e.name);
            const ytUrl = ytOverrides[e.id] || e.youtube || "";
            return (
              <div key={e.id} style={{background:bgCard,border:"1px solid #2D4057",borderRadius:12,padding:"16px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:18,fontWeight:800,color:textMain,marginBottom:8,lineHeight:1.2}}>{nombre}</div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{background:"#162234",color:"#8B9AB2",padding:"4px 8px",borderRadius:20,fontSize:11,fontWeight:700,border:"1px solid #2D4057",letterSpacing:.5}}>{patLabel(e.pattern)}</span>
                      {e.muscle&&<span style={{color:textMuted,fontSize:11,fontWeight:600}}>{e.muscle}</span>}
                      {isCustom&&<span style={{background:"#2563EB18",color:"#2563EB",padding:"4px 8px",borderRadius:20,fontSize:11,fontWeight:700,border:"1px solid #2563EB33"}}>CUSTOM</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
                    {ytUrl&&(
                      <a href={ytUrl} target="_blank" rel="noreferrer"
                        style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",
                          background:"#162234",color:"#8B9AB2",border:"1px solid #2D4057",
                          borderRadius:12,textDecoration:"none",fontSize:18,flexShrink:0}}>▶</a>
                    )}
                    <button onClick={()=>{setEditModal(e);setEditNombre(e.name);setEditYT(ytUrl);}}
                      style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",
                        background:"#162234",color:"#8B9AB2",border:"1px solid #2D4057",
                        borderRadius:12,cursor:"pointer",fontSize:15,flexShrink:0}}><Ic name="link" size={15}/></button>
                    {isCustom&&(
                      <button onClick={()=>setBorrarId(e.id)}
                        style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",
                          background:"#162234",color:"#8B9AB2",border:"1px solid #2D4057",
                          borderRadius:12,cursor:"pointer",fontSize:15,flexShrink:0}}><Ic name="trash-2" size={15}/></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {tab===1&&(
        <div>
          <div style={{fontSize:15,color:textMuted,marginBottom:16}}>{es?"El ejercicio quedara disponible en la biblioteca para armar rutinas.":"The exercise will be available in the library to build routines."}</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{es?"NOMBRE *":"NAME *"}</div>
            <input style={inpS} value={newNombre} onChange={e=>setNewNombre(e.target.value)} placeholder={es?"Ej: Press inclinado con mancuernas":"Ex: Incline Dumbbell Press"}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{es?"PATRON":"PATTERN"}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["empuje","traccion","rodilla","bisagra","core","movilidad","cardio","oly"].map(p=>(
                <button key={p} onClick={()=>setNewPat(p)} style={{padding:"8px 14px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  border:newPat===p?"1px solid "+(patColors[p]||"#2563EB"):"1px solid "+border,
                  background:newPat===p?(patColors[p]||"#2563EB")+"22":"#1E2D40",
                  color:newPat===p?(patColors[p]||"#2563EB"):"#8B9AB2"}}>
                  {patLabel(p)}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{es?"MUSCULO":"MUSCLE"}</div>
            <input style={inpS} value={newMus} onChange={e=>setNewMus(e.target.value)} placeholder={es?"Ej: Pecho, Triceps":"Ex: Chest, Triceps"}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{es?"EQUIPAMIENTO":"EQUIPMENT"}</div>
            <input style={inpS} value={newEquip} onChange={e=>setNewEquip(e.target.value)} placeholder={es?"Ej: Barra, Mancuernas, Libre":"Ex: Barbell, Dumbbells, Bodyweight"}/>
          </div>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>LINK YOUTUBE</div>
            <input style={inpS} value={newYT} onChange={e=>setNewYT(e.target.value)} placeholder="https://youtube.com/..."/>
            {newYT&&(newYT.includes("youtube")||newYT.includes("youtu.be"))&&(
              <div style={{marginTop:8,fontSize:13,color:"#22C55E",fontWeight:700}}>▶️ {es?"Link valido ✓":"Valid link ✓"}</div>
            )}
          </div>
          <button onClick={agregarEjercicio} style={{width:"100%",padding:12,background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
            {es?"+ AGREGAR EJERCICIO":"+ ADD EXERCISE"}
          </button>
        </div>
      )}



      {editModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setEditModal(null)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"16px",paddingBottom:"calc(16px + env(safe-area-inset-bottom, 0px))",width:"100%",maxHeight:"80dvh",minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>{es?"Editar ejercicio":"Edit exercise"}</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{es?"NOMBRE":"NAME"}</div>
              <input style={inpS} value={editNombre} onChange={e=>setEditNombre(e.target.value)}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>LINK YOUTUBE</div>
              <div style={{fontSize:11,color:"#60A5FA",marginBottom:8}}><Ic name="info" size={14} color="#60a5fa"/> {es?"Ideal: video corto -30 seg (YouTube Shorts)":"Ideal: short video -30 sec (YouTube Shorts)"}</div>
              <input style={inpS} value={editYT} onChange={e=>setEditYT(e.target.value)} placeholder="https://youtube.com/shorts/..."/>
              {editYT&&(editYT.includes("youtube")||editYT.includes("youtu.be"))&&(()=>{
                var videoId = null;
                try {
                  if(editYT.includes("shorts/")) videoId = editYT.split("shorts/")[1].split("?")[0].split("&")[0];
                  else if(editYT.includes("v=")) videoId = editYT.split("v=")[1].split("&")[0];
                  else if(editYT.includes("youtu.be/")) videoId = editYT.split("youtu.be/")[1].split("?")[0];
                } catch(e){}
                if(!videoId) return <div style={{marginTop:8,fontSize:13,color:"#22C55E",fontWeight:700}}>✓ {es?"Link detectado":"Link detected"}</div>;
                return (
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:textMuted,marginBottom:6}}>{es?"PREVIEW":"PREVIEW"}</div>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <img loading="lazy" src={"https://img.youtube.com/vi/"+videoId+"/mqdefault.jpg"} style={{width:120,height:68,borderRadius:8,objectFit:"cover",border:"1px solid "+border}} onError={function(e){e.target.style.display="none"}}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"#22C55E"}}>✓ {es?"Video detectado":"Video detected"}</div>
                        <div style={{fontSize:11,color:textMuted,marginTop:2}}>ID: {videoId}</div>
                        <a href={editYT} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#2563EB",textDecoration:"none",marginTop:4,display:"inline-block"}}>{es?"Abrir en YouTube ↗":"Open in YouTube ↗"}</a>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {editYT&&!(editYT.includes("youtube")||editYT.includes("youtu.be"))&&(
                <div style={{marginTop:8,fontSize:12,color:"#F59E0B"}}>⚠ {es?"No parece un link de YouTube":"Doesn't look like a YouTube link"}</div>
              )}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditModal(null)} style={{flex:1,padding:12,background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{es?"CANCELAR":"CANCEL"}</button>
              <button onClick={guardarEdicion} style={{flex:1,padding:12,background:"#2563EB",color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{es?"GUARDAR":"SAVE"}</button>
            </div>
          </div>
        </div>
      )}

      {borrarId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}} onClick={()=>setBorrarId(null)}>
          <div style={{background:bgCard,borderRadius:16,padding:20,width:"100%",maxWidth:320,border:"1px solid "+border,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
            <div style={{fontSize:15,fontWeight:800,marginBottom:8}}>{es?"Borrar ejercicio?":"Delete exercise?"}</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{es?"Esta accion no se puede deshacer":"This action cannot be undone"}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setBorrarId(null)} style={{flex:1,padding:8,background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{es?"CANCELAR":"CANCEL"}</button>
              <button onClick={()=>borrarEjercicio(borrarId)} style={{flex:1,padding:8,background:"#2563EB",color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{es?"BORRAR":"DELETE"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function ScannerRutina({sb, routines, setRoutines, alumnos, toast2, setTab, es, user, darkMode}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [paso, setPaso] = React.useState(1);
  const [procesando, setProcesando] = React.useState(false);
  const [progreso, setProgreso] = React.useState(0);
  const [statusMsg, setStatusMsg] = React.useState("");
  const [resultado, setResultado] = React.useState(null);
  const [nombreRutina, setNombreRutina] = React.useState("");
  const [alumnoSel, setAlumnoSel] = React.useState(null);
  const [filtroRut, setFiltroRut] = React.useState("todas");
  const fileRef = React.useRef();
  const fileGalRef = React.useRef();
  const allEx = React.useMemo(()=>{
    try{ const c=JSON.parse(localStorage.getItem("it_customEx")||"[]"); return [...EX,...c]; }catch(e){return EX;}
  },[]);

  const procesarImagen = async (base64) => {
    setPaso(2); setProcesando(true); setProgreso(0);
    const msgs = ["Detectando texto...","Reconociendo ejercicios...",es?"Buscando en biblioteca...":"Searching library...","Analizando series y reps...","Finalizando..."];
    let i=0;
    const timer = setInterval(()=>{ if(i<msgs.length){setProgreso((i+1)*18);setStatusMsg(msgs[i]);i++;}else{clearInterval(timer);} },600);

    try {
      const resp = await fetch("/api/scan",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:"image/jpeg",data:base64.split(",")[1]||base64}},
            {type:"text",text:"Sos un asistente de gimnasio. Analiza esta imagen de una rutina de entrenamiento escrita a mano o impresa. Extrae todos los ejercicios con sus series y repeticiones. Responde SOLO con JSON valido, sin texto extra, sin backticks: {\"nombreRutina\":\"nombre detectado o Rutina Escaneada\",\"ejercicios\":[{\"nombre\":\"nombre exacto del ejercicio\",\"series\":4,\"reps\":\"8\",\"notas\":\"notas si hay\"}]} Si no ves un valor claro de series o reps, usa null. Maximo 20 ejercicios."}
          ]}]}
        )
      });
      clearInterval(timer);
      const data = await resp.json();
      const txt = data.content?.find(c=>c.type==="text")?.text||"{}";
      let parsed;
      try{ parsed=JSON.parse(txt); }catch(e){ parsed={nombreRutina:"Rutina Escaneada",ejercicios:[]}; }
      setProgreso(100); setStatusMsg(es?"Analisis completo":"Analysis complete");

      // Cruzar con biblioteca
      const exConMatch = (parsed.ejercicios||[]).map(ej=>{
        const nombre = ej.nombre||"";
        const match = allEx.find(e=>
          e.name.toLowerCase().includes(nombre.toLowerCase().slice(0,5)) ||
          nombre.toLowerCase().includes(e.name.toLowerCase().slice(0,5))
        );
        return {...ej, match, busqueda:"", selManual:null};
      });
      setResultado({nombre:parsed.nombreRutina||"Rutina Escaneada", ejercicios:exConMatch});
      setNombreRutina(parsed.nombreRutina||"Rutina Escaneada");
      setTimeout(()=>{ setProcesando(false); setPaso(3); },600);
    } catch(err) {
      clearInterval(timer);
      toast2("Error al procesar la imagen"); setProcesando(false); setPaso(1);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => procesarImagen(ev.target.result);
    reader.readAsDataURL(file);
  };

  const buscarEnBib = (idx, q) => {
    if(!resultado) return;
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,busqueda:q,selManual:null}:e);
    setResultado({...resultado, ejercicios:upd});
  };

  const seleccionarMatch = (idx, ex) => {
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,selManual:ex,busqueda:""}:e);
    setResultado({...resultado, ejercicios:upd});
  };

  const agregarAutoEx = (idx) => {
    const ej = resultado.ejercicios[idx];
    const newEx = {id:"scan_"+Date.now()+"_"+idx, name:ej.nombre, nameEn:ej.nombre, pattern:"core", muscle:"", equip:"", custom:true, scanned:true};
    const customEx = JSON.parse(localStorage.getItem("it_customEx")||"[]");
    localStorage.setItem("it_customEx", JSON.stringify([...customEx, newEx]));
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,selManual:newEx,autoAdded:true}:e);
    setResultado({...resultado, ejercicios:upd});
    toast2("Ejercicio agregado a biblioteca ✓");
  };

  const guardarRutina = async () => {
    if(!nombreRutina.trim()){toast2("Ingresa un nombre");return;}
    const dias = [{
      id:"d1", name:"Dia 1", label:"DIA 1",
      exercises: resultado.ejercicios.map((ej,i)=>{
        const exRef = ej.selManual||ej.match;
        return {
          exId: exRef?.id||"custom_scan_"+i,
          exName: exRef?.name||ej.nombre,
          sets: ej.series||3,
          reps: ej.reps||"10",
          note: ej.notas||""
        };
      })
    }];
    const rutina = {id:"scan_"+Date.now(), name:nombreRutina, days:dias, scanned:true, created:new Date().toLocaleDateString("es-AR")};
    setRoutines(prev=>[...prev, rutina]);
    if(alumnoSel) {
      await sb.saveRutina(alumnoSel, {nombre:nombreRutina, datos:rutina});
      toast2("Rutina creada y asignada a "+alumnos.find(a=>a.id===alumnoSel)?.nombre+" ✓");
    } else {
      toast2("Rutina guardada ✓");
    }
    setPaso(4);
  };

  const inpS = {background:bg,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",color:textMain,fontSize:15,width:"100%",fontFamily:"inherit",outline:"none"};

  return (
    <div>
      {paso===1&&(
        <div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{es?"Escanear rutina en papel":"Scan paper routine"}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{es?"La IA detecta ejercicios, series y repeticiones automaticamente.":"AI automatically detects exercises, sets and reps."}</div>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFile}/>
          <input ref={fileGalRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>

          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button onClick={()=>fileRef.current.click()} style={{flex:1,padding:"16px 10px",background:"#2563EB22",border:"2px solid #243040",borderRadius:12,color:"#2563EB",fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:8}}>📸</div>
              <div>{es?"SACAR FOTO":"TAKE PHOTO"}</div>
              <div style={{fontSize:11,color:textMuted,marginTop:4}}>{es?"Abrir camara":"Open camera"}</div>
            </button>
            <button onClick={()=>fileGalRef.current.click()} style={{flex:1,padding:"16px 10px",background:_dm?"#162234":"#E2E8F0",border:"2px solid #2d3748",borderRadius:12,color:textMuted,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:8}}>🖼️</div>
              <div>{es?"CARGAR ARCHIVO":"UPLOAD FILE"}</div>
              <div style={{fontSize:11,color:textMuted,marginTop:4}}>{es?"Foto de galeria":"From gallery"}</div>
            </button>
          </div>

          <div style={{background:bgSub,border:"1px solid "+border,borderRadius:12,padding:12}}>
            <div style={{fontSize:13,fontWeight:500,color:textMuted,marginBottom:8,letterSpacing:.5}}>{es?"CONSEJOS":"TIPS"}</div>
            <div style={{fontSize:13,color:textMuted,display:"flex",flexDirection:"column",gap:8}}>
              <div>{es?"✅ Buena iluminacion, sin sombras":"✅ Good lighting, no shadows"}</div>
              <div>{es?"✅ Hoja bien centrada y legible":"✅ Sheet centered and legible"}</div>
              <div>{es?"✅ Formatos: \"4x8\", \"3 series de 10\"":"✅ Formats: \"4x8\", \"3 sets of 10\""}</div>
            </div>
          </div>
        </div>
      )}
      {paso===2&&(
        <div style={{textAlign:"center",padding:"30px 0"}}>
          <div style={{fontSize:48,marginBottom:12}}>{progreso===100?"✅":"🔍"}</div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>{progreso===100?"Analisis completo":"Procesando rutina..."}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{statusMsg}</div>
          <div style={{height:5,background:_dm?"#162234":"#E2E8F0",borderRadius:2,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",background:"#2563EB",borderRadius:2,width:progreso+"%",transition:"width .5s"}}/>
          </div>
          <div style={{fontSize:13,color:textMuted}}>{progreso}%</div>
        </div>
      )}
      {paso===3&&resultado&&(
        <div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{es?"Revisa la rutina detectada":"Review detected routine"}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:12}}>{es?"Podes editar antes de guardar.":"You can edit values before saving."}</div>

          <div style={{background:"#22c55e15",border:"1px solid #22c55e33",borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>✅</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#22C55E"}}>{resultado.ejercicios.length} ejercicios detectados</div>
              <div style={{fontSize:11,color:textMuted}}>{resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length} no encontrados en biblioteca</div>
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{es?"NOMBRE":"NAME"}</div>
            <input style={inpS} value={nombreRutina} onChange={e=>setNombreRutina(e.target.value)}/>
          </div>
          {resultado.ejercicios.filter(e=>e.match||e.selManual).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#22C55E",letterSpacing:0.3,marginBottom:8}}>{es?"✅ ENCONTRADOS":"✅ FOUND"} ({resultado.ejercicios.filter(e=>e.match||e.selManual).length})</div>
              {resultado.ejercicios.map((ej,i)=>{
                if(!ej.match&&!ej.selManual) return null;
                const ref = ej.selManual||ej.match;
                return (
                  <div key={(ref.id||"ex")+"-scan-ok-"+i+"-"+(ej.nombre||"")} style={{background:bg,border:"1px solid "+border,borderRadius:12,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800}}>{ref.name}</div>
                      <div style={{fontSize:11,color:textMuted}}>{ej.nombre!==ref.name?`Detectado: "${ej.nombre}"`:""}</div>
                    </div>
                    <input style={{background:bgSub,border:"1px solid "+border,borderRadius:6,padding:"4px 7px",color:textMain,fontSize:13,width:38,textAlign:"center",fontFamily:"inherit"}} defaultValue={ej.series||3}/>
                    <span style={{color:textMuted}}>x</span>
                    <input style={{background:bgSub,border:"1px solid "+border,borderRadius:6,padding:"4px 7px",color:textMain,fontSize:13,width:42,textAlign:"center",fontFamily:"inherit"}} defaultValue={ej.reps||"10"}/>
                  </div>
                );
              })}
            </div>
          )}
          {resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#8B9AB2",letterSpacing:0.3,margin:"16px 0 7px"}}>{es?"⚠️ NO ENCONTRADOS":"⚠️ NOT FOUND"} ({resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length})</div>
              {resultado.ejercicios.map((ej,i)=>{
                if(ej.match||ej.selManual) return null;
                const resBib = ej.busqueda?.length>=2 ? allEx.filter(e=>e.name.toLowerCase().includes(ej.busqueda.toLowerCase())).slice(0,4) : [];
                return (
                  <div key={"scan-miss-"+(ej.nombre||"ej")+"-"+i} style={{background:bgCard,border:"1px solid #243040",borderRadius:12,padding:12,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:800,color:"#8B9AB2"}}>(es?"Detectado":"Detected")+": \""+ej.nombre+"\""</div>
                        <div style={{fontSize:11,color:textMuted,marginTop:4}}>{ej.series||"?"} series · {ej.reps||"?"} reps</div>
                      </div>
                      <span style={{background:"#2563EB22",color:"#8B9AB2",border:"1px solid #243040",borderRadius:6,padding:"2px 7px",fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>SIN MATCH</span>
                    </div>
                    <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:.8,marginBottom:8}}>BUSCAR EN BIBLIOTECA</div>
                    <input style={inpS} placeholder={es?"Escribi el nombre correcto...":"Type the correct name..."} value={ej.busqueda||""} onChange={e=>buscarEnBib(i,e.target.value)}/>
                    {resBib.length>0&&(
                      <div style={{background:bg,border:"1px solid "+border,borderRadius:12,overflow:"hidden",marginTop:8}}>
                        {resBib.map(ex=>(
                          <div key={ex.id} onClick={()=>seleccionarMatch(i,ex)} style={{padding:"8px 12px",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:800}}>{ex.name}</div>
                              <div style={{fontSize:11,color:textMuted}}>{ex.pattern} · {ex.muscle}</div>
                            </div>
                            <span style={{color:"#22C55E",fontSize:15}}>✓</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ej.busqueda?.length>=2&&resBib.length===0&&(
                      <div style={{fontSize:13,color:textMuted,textAlign:"center",padding:"8px 0"}}>{es?"Sin resultados — agregalo abajo":"No results — add it below"}</div>
                    )}
                    <div style={{fontSize:11,color:textMuted,textAlign:"center",margin:"8px 0 7px"}}>— o si no esta en biblioteca —</div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>agregarAutoEx(i)} style={{flex:1,padding:"8px",background:green,color:darkMode?"#fff":"#fff",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>⚡ AUTO</button>
                      <button style={{flex:1,padding:"8px",background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={()=>toast2("Ir a Biblioteca > + Nuevo para agregarlo manualmente")}>✏️ MANUAL</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {}
          <div style={{marginTop:16,marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{es?"Asignar a alumno":"Assign to athlete"} <span style={{color:textMuted,fontWeight:400}}>(opcional)</span></div>
            {alumnos.map(a=>(
              <div key={a.id} onClick={()=>setAlumnoSel(alumnoSel===a.id?null:a.id)} style={{background:bg,border:"2px solid "+(alumnoSel===a.id?"#2563EB":"#2D4057"),borderRadius:12,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <div style={{width:32,height:32,background:"#2563EB22",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#2563EB",flexShrink:0}}>{a.nombre?.[0]}</div>
                <div style={{flex:1,fontSize:15,fontWeight:700}}>{a.nombre}</div>
                <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(alumnoSel===a.id?"#2563EB":"#2D4057"),background:alumnoSel===a.id?"#2563EB":"transparent"}}/>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>setPaso(1)} style={{flex:1,padding:"8px",background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>← Volver</button>
            <button onClick={guardarRutina} style={{flex:2,padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>GUARDAR RUTINA →</button>
          </div>
        </div>
      )}
      {paso===4&&(
        <div style={{textAlign:"center",paddingTop:30}}>
          <div style={{fontSize:48,marginBottom:8}}><Ic name="check-circle" size={40} color="#22C55E"/></div>
          <div style={{fontSize:22,fontWeight:900,color:"#22C55E",marginBottom:4}}>Rutina creada!</div>
          <div style={{fontSize:15,color:textMuted,marginBottom:24}}>{nombreRutina}</div>
          <div style={{background:"#22c55e15",border:"1px solid #22c55e33",borderRadius:12,padding:16,marginBottom:24,display:"flex",justifyContent:"space-around"}}>
            <div><div style={{fontSize:22,fontWeight:900,color:"#22C55E"}}>{resultado?.ejercicios?.length||0}</div><div style={{fontSize:11,color:textMuted}}>ejercicios</div></div>
            <div><div style={{fontSize:22,fontWeight:900,color:"#2563EB"}}>📷</div><div style={{fontSize:11,color:textMuted}}>Escaneada</div></div>
            {alumnoSel&&<div><div style={{fontSize:22,fontWeight:900,color:"#2563EB"}}>✓</div><div style={{fontSize:11,color:textMuted}}>Asignada</div></div>}
          </div>
          <button onClick={()=>{setPaso(1);setResultado(null);setAlumnoSel(null);}} style={{width:"100%",padding:12,background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>
            Escanear otra rutina
          </button>
        </div>
      )}
    </div>
  );
}


function DashboardEntrenador({alumnos, sesiones, es, onVerAlumno, onChatAlumno, darkMode, progress={}, progresoGlobal={}, session=null, routines=[], pagosEstado={}, togglePago=()=>{}, customEx=[]}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#1E2D40":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";
  const green = _dm?"#22C55E":"#16A34A";
  const greenSoft = _dm?"rgba(34,197,94,0.12)":"rgba(22,163,74,0.1)";
  const greenBorder = _dm?"rgba(50,215,75,0.25)":"rgba(26,158,53,0.25)";

  const [modalPR, setModalPR] = React.useState(null);

  const totalAlumnos = alumnos.length || 0;
  const totalSesiones = sesiones?.length || 0;

  // Alumnos sin entrenar (basado en datos reales de sesiones)
  const hoy = new Date();
  const alumnosSinEntrenar = alumnos.filter(a => {
    const ultimaSesion = sesiones?.filter(s=>s.alumno_id===a.id)
      .sort((a,b)=>new Date(b.created_at||b.fecha)-new Date(a.created_at||a.fecha))[0];
    if(!ultimaSesion) return true;
    const fecha = new Date(ultimaSesion.created_at||ultimaSesion.fecha||0);
    const dias = Math.floor((hoy - fecha)/(1000*60*60*24));
    return dias >= 3;
  }).slice(0,3);

  // Próxima acción: el alumno más urgente
  const proximaAccion = alumnosSinEntrenar[0] || alumnos[0];

  const ava = (col) => ({width:46,height:46,borderRadius:12,background:col+"22",color:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,flexShrink:0});
  const sec = {fontSize:18,fontWeight:900,color:textMain,letterSpacing:1.5,marginBottom:12,textTransform:"uppercase",borderLeft:"3px solid #8B9AB2",paddingLeft:8};

  return (
    <div style={{paddingBottom:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingTop:4}}>
        <div>
          <div style={{fontSize:13,fontWeight:500,color:textMuted,letterSpacing:0.3}}>
            {new Date().getHours()<12?(es?"BUENOS DÍAS":"GOOD MORNING"):new Date().getHours()<18?(es?"BUENAS TARDES":"GOOD AFTERNOON"):(es?"BUENAS NOCHES":"GOOD EVENING")}
          </div>
          <div style={{fontSize:28,fontWeight:900,color:textMain,letterSpacing:0.5}}>IRON TRACK 💪</div>
        </div>
        <div style={{background:"#2563EB11",border:"1px solid #243040",borderRadius:12,padding:"8px 16px",textAlign:"center"}}>
          <div style={{fontSize:28,fontWeight:900,color:"#2563EB",lineHeight:1}}>{totalAlumnos}</div>
          <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3}}>{es?"ALUMNOS":"ATHLETES"}</div>
        </div>
      </div>
      {proximaAccion&&(
        <div style={{background:"linear-gradient(135deg,#243040,#24304008)",border:"1px solid #243040",borderRadius:16,padding:"16px",marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:800,color:"#2563EB",letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>
            ⚡ {es?"ACCIÓN RECOMENDADA":"RECOMMENDED ACTION"}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={ava("#2563EB")}>{(proximaAccion.nombre||proximaAccion.email||"?").slice(0,2).toUpperCase()}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:22,fontWeight:900,color:textMain}}>{proximaAccion.nombre||proximaAccion.email}</div>
              <div style={{fontSize:13,color:textMuted,fontWeight:500}}>
                {alumnosSinEntrenar.includes(proximaAccion)
                  ? (es?"Sin actividad hace 3+ días":"No activity for 3+ days")
                  : (es?"Revisar progreso":"Review progress")}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="hov" onClick={()=>onVerAlumno?.(proximaAccion)}
              style={{flex:1,padding:"8px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
              <><Ic name="eye" size={14}/> {es?"Ver progreso":"View progress"}</>
            </button>
            <button className="hov" onClick={()=>onChatAlumno?.(proximaAccion)}
              style={{padding:"8px 16px",background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
              💬
            </button>
          </div>
        </div>
      )}
      <AtencionHoy
  alumnos={alumnos.map(a => {
    const ulS = sesiones?.filter(s => s.alumno_id === a.id)
      .sort((x,y) => new Date(y.created_at||y.fecha) - new Date(x.created_at||x.fecha))[0];
    const diasSinEntrenar = ulS
      ? Math.floor((new Date() - new Date(ulS.created_at||ulS.fecha)) / 86400000)
      : 99;
    return {
      id: a.id,
      nombre: a.nombre || a.email,
      diasSinEntrenar,
      pagoVencidoDias: pagosEstado[a.id] === "vencido" ? 5 : 0,
      tieneRutina: routines?.some(r => r.alumno_id === a.id) ?? true,
      tieneNuevoPR: false,
      descripcion: diasSinEntrenar >= 5 ? `${diasSinEntrenar} días sin entrenar` : "",
    };
  })}
  onVerProgreso={(a) => onVerAlumno?.({ id: a.id })}
  onAccion={(a) => onChatAlumno?.({ id: a.id })}
/>
      <div style={{...sec}}>{es?"ESTA SEMANA":"THIS WEEK"}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:20}}>
        {[
          {v:totalSesiones,       lbl:es?"SESIONES":"SESSIONS",   col:"#22C55E"},
          {v:alumnosSinEntrenar.length, lbl:es?"SIN ENTRENAR":"INACTIVE",  col:textMuted},
          {v:alumnos.filter(a=>(pagosEstado[a.id]||"pendiente")==="pendiente").length, lbl:es?"PAGO PEND.":"PAYMENT DUE", col:"#fbbf24"},
          {v:alumnos.filter(a=>pagosEstado[a.id]==="vencido").length, lbl:es?"VENCIDOS":"OVERDUE", col:"#f87171"},
        ].map((s,i)=>(
          <div key={"dash-kpi-"+String(s.lbl).replace(/\s/g,"-")+"-"+i} style={{background:bgCard,border:"1px solid "+s.col+"33",borderRadius:12,padding:"16px 14px"}}>
            <div style={{fontSize:36,fontWeight:900,color:s.col,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:13,fontWeight:800,color:textMuted,letterSpacing:0.3,marginTop:8}}>{s.lbl}</div>
          </div>
        ))}
      </div>
      {alumnosSinEntrenar.length>0&&(
        <>
          <div style={{...sec}}><Ic name="alert-triangle" size={14} color="#F59E0B"/> {es?"INACTIVOS +3 DÍAS":"INACTIVE +3 DAYS"}</div>
          <div style={{background:bgCard,border:"1px solid #243040",borderRadius:12,marginBottom:20,overflow:"hidden"}}>
            {alumnosSinEntrenar.map((a,i)=>{
              const ulS=sesiones?.filter(s=>s.alumno_id===a.id).sort((x,y)=>new Date(y.created_at||y.fecha)-new Date(x.created_at||x.fecha))[0];
              const dias=ulS?Math.floor((hoy-new Date(ulS.created_at||ulS.fecha))/(1000*60*60*24)):null;
              const tel=a.telefono||"";
              const waMsg=encodeURIComponent((es?"Hola ":"Hey ")+a.nombre+(es?"! 👋 Vi que no entrenaste en los últimos días. ¿Todo bien? Cuando puedas retomamos 💪":"! 👋 Noticed you haven't trained in a few days. Everything ok? Let's get back at it 💪"));
              return(
              <div key={a.id||i} style={{display:"flex",alignItems:"center",gap:12,padding:"16px",
                borderBottom:i<alumnosSinEntrenar.length-1?"1px solid "+border:"none"}}>
                <div style={ava("#8B9AB2")}>{(a.nombre||a.email||"?").slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:18,fontWeight:800,color:textMain}}>{a.nombre||a.email}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>
                    <div style={{fontSize:13,color:"#EF4444",fontWeight:700}}>
                      {dias===null?(es?"Sin sesiones registradas":"No sessions yet"):
                       dias===1?(es?"1 día sin entrenar":"1 day inactive"):
                       (es?`${dias} días sin entrenar`:`${dias} days inactive`)}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="hov" onClick={function(e){e.stopPropagation();console.log("[CHAT-DASH] abriendo para",a.id);onChatAlumno&&onChatAlumno(a)}}
                    style={{background:"#2563EB22",color:"#2563EB",border:"1px solid #2563EB33",
                      borderRadius:8,padding:"8px 10px",fontSize:18,cursor:"pointer",
                      display:"flex",alignItems:"center"}}>💬</button>
                  {a.onesignal_id&&(
                    <button className="hov"
                      onClick={()=>{
                        if(onNotificar) onNotificar(a.id, es?"¡Es hora de entrenar! 💪 Tu entrenador te espera.":"Time to train! 💪 Your coach is waiting.");
                      }}
                      style={{background:"#EF444422",color:"#EF4444",border:"1px solid #EF444433",
                        borderRadius:8,padding:"8px 10px",fontSize:18,cursor:"pointer",fontFamily:"inherit"}}>
                      🔔
                    </button>
                  )}
                  <button className="hov" onClick={()=>onVerAlumno?.(a)}
                    style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,
                      padding:"8px 12px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    {es?"VER":"VIEW"}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
      {alumnos.length>0&&(
        <>
          <div style={{...sec,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>{es?"ALUMNOS":"ATHLETES"}</span>
            <span style={{fontSize:11,color:textMuted,fontWeight:500}}>{alumnos.length} {es?"activos":"active"}</span>
          </div>
          <div style={{background:bgCard,border:"1px solid "+border,borderRadius:12,marginBottom:20,overflow:"hidden"}}>
            {alumnos.map((a,i)=>{
              const alumnoProgress = progresoGlobal[a.id] || [];

              // ── Datos del alumno desde Supabase ──────────────────
              const regsAlumno = progresoGlobal[a.id] || [];
              const sesAlumno = (sesiones||[]).filter(function(s){return s.alumno_id===a.id})
                .sort(function(x,y){return new Date(y.created_at||y.fecha)-new Date(x.created_at||x.fecha)});
              const ultimaSes = sesAlumno[0];

              // PRs por ejercicio
              const prsPorEj = {};
              regsAlumno.forEach(function(reg){
                var exId = reg.ejercicio_id;
                var kg = parseFloat(reg.kg)||0;
                if(!prsPorEj[exId] || kg > prsPorEj[exId].kg) {
                  prsPorEj[exId] = {kg:kg, fecha:reg.fecha};
                }
              });

              // Últimos pesos por ejercicio
              const ultimosPesos = {};
              regsAlumno.forEach(function(reg){
                var exId = reg.ejercicio_id;
                if(!ultimosPesos[exId]) ultimosPesos[exId] = {kg:parseFloat(reg.kg)||0, reps:parseInt(reg.reps)||0, fecha:reg.fecha};
              });

              // Top 3 PRs
              const topPRs = Object.entries(prsPorEj)
                .sort(function(a2,b2){return b2[1].kg-a2[1].kg})
                .slice(0,3)
                .map(function(entry){
                  var exInfo = [...EX,...(customEx||[])].find(function(e){return e.id===entry[0]});
                  return {id:entry[0], nombre:exInfo?exInfo.name:entry[0], kg:entry[1].kg};
                });

              // Tendencia
              var tendencia = null;
              if(regsAlumno.length >= 6) {
                var sortedRegs = regsAlumno.slice().sort(function(a2,b2){return new Date(b2.created_at||b2.fecha)-new Date(a2.created_at||a2.fecha)});
                var recientes = sortedRegs.slice(0,3);
                var anteriores = sortedRegs.slice(3,6);
                var avgRec = recientes.reduce(function(acc,r){return acc+(parseFloat(r.kg)||0)},0)/3;
                var avgAnt = anteriores.reduce(function(acc,r){return acc+(parseFloat(r.kg)||0)},0)/3;
                if(avgAnt > 0) {
                  var pctCambio = Math.round((avgRec-avgAnt)/avgAnt*100);
                  tendencia = {pct:pctCambio, dir:pctCambio>2?"sube":pctCambio<-2?"baja":"estable"};
                }
              }

              // ── Narrativa inteligente ──────────────────────────────
              const getNarrativaAlumno = () => {
                // PR reciente: algún set del alumno supera el máximo anterior
                let prReciente = null;
                let mejorPct = 0;
                let ejercicioCaida = null;

                var regsAlu = progresoGlobal[a.id] || []; var progData = {}; regsAlu.forEach(function(r){if(!progData[r.ejercicio_id])progData[r.ejercicio_id]={sets:[],max:0};progData[r.ejercicio_id].sets.push({kg:parseFloat(r.kg)||0,reps:parseInt(r.reps)||0,date:r.fecha,week:0});progData[r.ejercicio_id].max=Math.max(progData[r.ejercicio_id].max,parseFloat(r.kg)||0);});
                Object.entries(progData).forEach(([exId, pg])=>{
                  const sets = pg?.sets||[];
                  if(sets.length < 2) return;
                  const sorted = [...sets].sort((a,b)=>parseFloat(b.kg||0)-parseFloat(a.kg||0));
                  const maxKg = parseFloat(sorted[0]?.kg||0);
                  const semana1Sets = sets.filter(s=>s.week===0);
                  const semanaUltSets = sets.filter(s=>s.week===Math.max(...sets.map(s2=>s2.week||0)));
                  if(!semana1Sets.length||!semanaUltSets.length) return;
                  const kgS1 = Math.max(...semana1Sets.map(s=>parseFloat(s.kg||0)));
                  const kgSU = Math.max(...semanaUltSets.map(s=>parseFloat(s.kg||0)));
                  const pct = kgS1>0 ? Math.round((kgSU-kgS1)/kgS1*100) : 0;
                  // PR: máximo de todos los sets es del set más reciente
                  const lastSet = sets[0];
                  if(lastSet&&parseFloat(lastSet.kg||0)>=maxKg&&sets.length>1) {
                    const exInfo = (routines.flatMap(r=>r.days||[]).flatMap(d=>[...(d.exercises||[]),...(d.warmup||[])]).find(e=>e?.id===exId));
                    if(!prReciente) prReciente = {exId, kg:maxKg, nombre:exInfo?.name||exId};
                  }
                  if(pct>mejorPct) mejorPct = pct;
                  // Caída: última semana bajó vs semana anterior
                  if(semanaUltSets.length&&kgSU<kgS1&&!ejercicioCaida) {
                    const exInfo2 = routines.flatMap(r=>r.days||[]).flatMap(d=>[...(d.exercises||[]),...(d.warmup||[])]).find(e=>e?.id===exId);
                    ejercicioCaida = exInfo2?.name||null;
                  }
                });

                const ultimaSesionA = sesiones?.filter(s=>s.alumno_id===a.id)
                  .sort((x,y)=>new Date(y.created_at||y.fecha)-new Date(x.created_at||x.fecha))[0];
                const diasDesdeA = ultimaSesionA ? Math.floor((hoy-new Date(ultimaSesionA.created_at||ultimaSesionA.fecha||0))/(1000*60*60*24)) : null;
                const sinEntrenarMucho = diasDesdeA===null||diasDesdeA>=5;

                // Prioridad de mensajes: PR > mejora > caída > sin entrenar
                if(prReciente) return {
                  tipo:"pr",
                  msg: es ? `Rompió récord en ${prReciente.nombre} · ${prReciente.kg}kg` : `New PR on ${prReciente.nombre} · ${prReciente.kg}kg`,
                  color:"#22C55E", bg:"#0c2a1a", border:"#1a4a2a"
                };
                if(mejorPct>=10) return {
                  tipo:"sube",
                  msg: es ? `Subió ${mejorPct}% de carga desde la semana 1` : `${mejorPct}% load increase from week 1`,
                  color:"#2563EB", bg:"#0d1e33", border:"#1a3a5c"
                };
                if(sinEntrenarMucho&&diasDesdeA>=5) return {
                  tipo:"alerta",
                  msg: es ? `Sin entrenar hace ${diasDesdeA}d — puede perder la progresión` : `${diasDesdeA}d without training — may lose progression`,
                  color:"#F59E0B", bg:"#1f1500", border:"#3d2e00"
                };
                if(ejercicioCaida) return {
                  tipo:"baja",
                  msg: es ? `Bajó el peso en ${ejercicioCaida} — revisá la recuperación` : `Weight dropped on ${ejercicioCaida} — check recovery`,
                  color:"#EF4444", bg:"#1a0808", border:"#3a1010"
                };
                if(sinEntrenarMucho&&diasDesdeA===null) return {
                  tipo:"nuevo",
                  msg: es ? "Todavía no registró ningún entrenamiento" : "No workouts logged yet",
                  color:"#8B9AB2", bg:"#162234", border:"#2D4057"
                };
                return null;
              };

              const ultimaSesion = sesiones?.filter(s=>s.alumno_id===a.id)
                .sort((x,y)=>new Date(y.created_at||y.fecha)-new Date(x.created_at||x.fecha))[0];
              const diasDesde = ultimaSesion ? Math.floor((hoy-new Date(ultimaSesion.created_at||ultimaSesion.fecha||0))/(1000*60*60*24)) : null;
              const statusColor = diasDesde===null?"#8B9AB2":diasDesde===0?"#22C55E":diasDesde<7?"#2563EB":diasDesde<14?"#F59E0B":"#EF4444";
              const statusLabel = diasDesde===null?(es?"Sin sesiones":"No sessions"):diasDesde===0?(es?"Hoy":"Today"):diasDesde===1?(es?"Ayer":"Yesterday"):`${diasDesde}d`;
              const narrativa = getNarrativaAlumno();

              return(
                <div key={a.id||i} className="hov" onClick={()=>onVerAlumno?.(a)}
                  style={{padding:"12px 16px",
                    borderBottom:i<alumnos.length-1?"1px solid "+border:"none",
                    cursor:"pointer",transition:"background .15s ease"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:narrativa?8:0}}>
                    <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,
                      background:statusColor+"22",border:"2px solid "+statusColor+"44",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:13,fontWeight:700,color:statusColor}}>
                      {(a.nombre||a.email||"?").slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:600,color:textMain,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {a.nombre||a.email}
                      </div>
                      <div style={{fontSize:11,color:textMuted,marginTop:1,display:"flex",alignItems:"center",gap:6}}>
                        <span>{diasDesde===null?(es?"Sin actividad":"No activity"):diasDesde===0?(es?"Entrenó hoy":"Trained today"):`${statusLabel} ${es?"sin entrenar":"without training"}`}</span>
                        {(()=>{
                          // Calcular racha del alumno desde sus sesiones en Supabase
                          const sesAlu = (sesiones||[]).filter(s=>s.alumno_id===a.id)
                            .sort((x,y)=>new Date(y.created_at||y.fecha)-new Date(x.created_at||x.fecha));
                          if(sesAlu.length<2) return null;
                          // Contar semanas consecutivas con al menos una sesión
                          const semanas = [...new Set(sesAlu.map(s=>{
                            const d=new Date(s.created_at||s.fecha);
                            return Math.floor((Date.now()-d.getTime())/(7*24*60*60*1000));
                          }))].sort((a,b)=>a-b);
                          let streak=0;
                          for(let i=0;i<semanas.length;i++){
                            if(i===0||semanas[i]-semanas[i-1]===1) streak++;
                            else break;
                          }
                          if(streak<2) return null;
                          return (
                            <span style={{display:"flex",alignItems:"center",gap:3,background:"#F59E0B12",border:"1px solid #F59E0B22",borderRadius:10,padding:"1px 7px"}}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                              <span style={{fontSize:10,color:"#fbbf24",fontWeight:700}}>{streak}sem</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <button
                    onClick={e=>{e.stopPropagation();togglePago(a.id);}}
                    style={{
                      flexShrink:0,background:"transparent",border:"none",
                      cursor:"pointer",padding:"2px",display:"flex",flexDirection:"column",
                      alignItems:"center",gap:2
                    }}>
                    {(()=>{
                      const estado = pagosEstado[a.id]||"pendiente";
                      const cfg = {
                        pagado:  {bg:"#0c2a1a",border:"#1a4a2a",color:"#4ade80",label:es?"Pagó":"Paid"},
                        pendiente:{bg:"#1f1500",border:"#3d2e00",color:"#fbbf24",label:es?"Pendiente":"Due"},
                        vencido: {bg:"#1a0808",border:"#3a1010",color:"#f87171",label:es?"Vencido":"Overdue"},
                      }[estado];
                      return (
                        <div style={{
                          background:cfg.bg,border:"1px solid "+cfg.border,
                          borderRadius:6,padding:"3px 7px",
                          fontSize:9,fontWeight:700,color:cfg.color,
                          letterSpacing:.3,whiteSpace:"nowrap"
                        }}>
                          {cfg.label}
                        </div>
                      );
                    })()}
                  </button>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{flexShrink:0,opacity:0.5}}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                  {narrativa&&(
                    <div style={{
                      background:narrativa.bg,
                      border:"1px solid "+narrativa.border,
                      borderRadius:8,padding:"8px 10px",
                      marginLeft:46,
                      fontSize:12,color:narrativa.color,
                      fontWeight:500,lineHeight:1.4
                    }}>
                      {narrativa.tipo==="pr"&&<span style={{background:"#22C55E",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,marginRight:8}}>PR</span>}
                      {narrativa.tipo==="alerta"&&<span style={{fontSize:12,marginRight:4}}>⚠</span>}
                      {narrativa.msg}
                    </div>
                  )}
                  {/* ── Info expandida de progreso ── */}
                  {regsAlumno.length>0&&(
                    <div style={{marginLeft:46,marginTop:8}}>
                      {ultimaSes&&(
                        <div style={{fontSize:11,color:textMuted,marginBottom:6}}>
                          <span style={{fontWeight:700}}>{es?"Última sesión":"Last session"}:</span> {ultimaSes.dia_label||"?"} · {ultimaSes.fecha||"?"} {ultimaSes.hora?" · "+ultimaSes.hora:""}
                        </div>
                      )}
                      {tendencia&&(
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                          <span style={{fontSize:11,fontWeight:700,color:tendencia.dir==="sube"?"#22C55E":tendencia.dir==="baja"?"#EF4444":"#8B9AB2"}}>
                            {tendencia.dir==="sube"?"↑":tendencia.dir==="baja"?"↓":"→"} {tendencia.pct>0?"+":""}{tendencia.pct}%
                          </span>
                          <span style={{fontSize:10,color:textMuted}}>{es?"tendencia carga":"load trend"}</span>
                        </div>
                      )}
                      {topPRs.length>0&&(
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                          {topPRs.map(function(pr){return(
                            <span key={pr.id} style={{background:"#22C55E15",border:"1px solid #22C55E33",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700,color:"#22C55E"}}>
                              🏆 {pr.nombre.substring(0,15)} {pr.kg}kg
                            </span>
                          )})}
                        </div>
                      )}
                      {Object.keys(ultimosPesos).length>0&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          {Object.entries(ultimosPesos).slice(0,4).map(function(entry){
                            var exInfo = [...EX,...(customEx||[])].find(function(e){return e.id===entry[0]});
                            var nombre = exInfo?exInfo.name:entry[0];
                            return(
                              <span key={entry[0]} style={{background:bgSub,borderRadius:6,padding:"2px 6px",fontSize:9,color:textMuted,fontWeight:600}}>
                                {nombre.substring(0,12)} {entry[1].kg}kg×{entry[1].reps}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {modalPR&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:100,display:"flex",alignItems:"flex-end"}}
          onClick={()=>setModalPR(null)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480,margin:"0 auto"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <span style={{fontSize:36}}><Ic name="award" size={28} color="#fbbf24"/></span>
              <div>
                <div style={{fontSize:22,fontWeight:900,color:textMain}}>{modalPR.ejercicio}</div>
                <div style={{fontSize:15,color:textMuted}}>{modalPR.alumno}</div>
              </div>
            </div>
            <button className="hov" onClick={()=>setModalPR(null)}
              style={{width:"100%",marginTop:12,padding:12,background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {es?"Cerrar":"Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


const LibraryAlumno = React.memo(function LibraryAlumno({allEx, es, darkMode, routines, videoOverrides, setVideoModal}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  // Obtener ejercicios únicos de todas las rutinas del alumno
  const rutina = (routines||[])[0];
  const dias = rutina?.days || [];
  const ejerciciosUnicos = {};
  dias.forEach(function(d, di) {
    (d.warmup||[]).forEach(function(ex) {
      if(!ejerciciosUnicos[ex.id]) ejerciciosUnicos[ex.id] = {ex:ex, dia:d.label||("Día "+(di+1)), bloque:"warmup"};
    });
    (d.exercises||[]).forEach(function(ex) {
      if(!ejerciciosUnicos[ex.id]) ejerciciosUnicos[ex.id] = {ex:ex, dia:d.label||("Día "+(di+1)), bloque:"principal"};
    });
  });

  const lista = Object.entries(ejerciciosUnicos).map(function(entry) {
    var exId = entry[0], data = entry[1];
    var info = (allEx||[]).find(function(e) { return e.id === exId; });
    return { id: exId, info: info, ex: data.ex, dia: data.dia, bloque: data.bloque };
  });

  if(lista.length === 0) return (
    <div style={{textAlign:"center",padding:"60px 0",color:textMuted}}>
      <div style={{fontSize:48,marginBottom:12}}>💪</div>
      <div style={{fontSize:18,fontWeight:700}}>{es?"Sin ejercicios en tu rutina":"No exercises in your routine"}</div>
      <div style={{fontSize:13,marginTop:4,color:textMuted}}>{es?"Tu entrenador te asignará una rutina":"Your coach will assign you a routine"}</div>
    </div>
  );

  return (
    <div>
      <div style={{fontSize:11,fontWeight:800,color:"#2563EB",letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>
        {es?"MIS EJERCICIOS":"MY EXERCISES"} ({lista.length})
      </div>
      {lista.map(function(item) {
        var info = item.info;
        var ex = item.ex;
        var nombre = info ? (es ? info.name : (info.nameEn||info.name)) : item.id;
        var musculo = info?.muscle || "";
        var patron = info?.pattern || "";
        var tieneVideo = (videoOverrides&&videoOverrides[item.id]) || info?.youtube;
        var videoUrl = (videoOverrides&&videoOverrides[item.id]) || info?.youtube || "";
        var PAT_COLORS = {rodilla:"#22C55E",bisagra:"#8B9AB2",empuje:"#2563EB",traccion:"#60A5FA",core:"#F59E0B",movilidad:"#A78BFA",cardio:"#EF4444",oly:"#8B9AB2"};
        var barColor = PAT_COLORS[patron] || "#2563EB";

        return (
          <div key={item.id} style={{background:bgCard,border:"1px solid "+border,borderRadius:12,padding:"14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:barColor,flexShrink:0,minHeight:36}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:800,color:textMain,marginBottom:2}}>{nombre}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {musculo&&<span style={{fontSize:11,color:textMuted}}>{musculo}</span>}
                  <span style={{fontSize:10,color:textMuted,background:bgSub,borderRadius:4,padding:"1px 5px"}}>{item.dia}</span>
                  {ex.sets&&ex.reps&&<span style={{fontSize:11,fontWeight:700,color:"#2563EB"}}>{ex.sets}×{ex.reps}</span>}
                  {ex.kg&&<span style={{fontSize:11,color:textMuted}}>{ex.kg}kg</span>}
                </div>
              </div>
              {tieneVideo&&(
                <button onClick={function(){var vid=getYTVideoId(videoUrl);if(vid&&setVideoModal){setVideoModal({videoId:vid,nombre:nombre})}else{window.open(videoUrl,"_blank")}}}
                  style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",
                    background:"#EF4444",color:"#fff",border:"none",
                    borderRadius:10,fontSize:16,flexShrink:0,fontWeight:700,cursor:"pointer"}}>▶</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});




/* ─── TOKENS ─────────────────────────────────────────────── */
const C = {
  blue:"#2563EB", blueL:"#3B82F6", blueD:"#1E40AF",
  green:"#22C55E", greenD:"#16A34A",
  bg:"#0A1120", bg2:"#0F1A2E", bg3:"#162035",
  border:"rgba(59,130,246,0.15)", borderSub:"rgba(255,255,255,0.06)",
  text:"#FFFFFF", sub:"#94A3B8", muted:"#4B6480",
};
const BLUE_GRAD  = "linear-gradient(135deg,#1E40AF 0%,#2563EB 55%,#3B82F6 100%)";
const GREEN_GRAD = "linear-gradient(135deg,#16A34A,#22C55E)";
const GLOW       = "0 0 36px rgba(37,99,235,0.5),0 8px 24px rgba(0,0,0,0.4)";
const GLOW_G     = "0 0 32px rgba(34,197,94,0.4)";

/*
  FLUJO COMPLETO:
  ─────────────────────────────────────────────────
  Paso 0 → Landing (splash)
  Paso 1 → Rol (entrenador / atleta)
  Paso 2 → Nombre (TODOS)
  Paso 3 → Alumnos (SOLO entrenador) ← condicional
  Paso 4 → Final / dashboard preview
  ─────────────────────────────────────────────────
  Entrenador: 0 → 1 → 2 → 3 → 4
  Atleta:     0 → 1 → 2 → 4  (salta paso 3)
*/

/* ═══════════════════════ SVG ICONS ═══════════════════════ */
const BarSVG = ({w=56}) => (
  <svg width={w} height={Math.round(w*0.56)} viewBox="0 0 78 44" fill="none">
    <rect x="20" y="19" width="38" height="6" rx="3" fill="white"/>
    <rect x="20" y="19" width="38" height="2" rx="1" fill="rgba(255,255,255,0.2)"/>
    <rect x="4"  y="16" width="4"  height="12" rx="1.5" fill="rgba(255,255,255,0.45)"/>
    <rect x="8"  y="10" width="6"  height="24" rx="2.5" fill="white"/>
    <rect x="14" y="10" width="6"  height="24" rx="2.5" fill="rgba(255,255,255,0.75)"/>
    <rect x="19" y="17" width="3"  height="10" rx="1.5" fill="#93C5FD"/>
    <rect x="56" y="17" width="3"  height="10" rx="1.5" fill="#93C5FD"/>
    <rect x="58" y="10" width="6"  height="24" rx="2.5" fill="rgba(255,255,255,0.75)"/>
    <rect x="64" y="10" width="6"  height="24" rx="2.5" fill="white"/>
    <rect x="70" y="16" width="4"  height="12" rx="1.5" fill="rgba(255,255,255,0.45)"/>
  </svg>
);

const CoachSVG = ({color="#64748B",size=26}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const AthleteSVG = ({color="#64748B",size=26}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const UserOneSVG = ({color,size=32}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

const UserGroupSVG = ({color,size=32}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9"  cy="7" r="3.5"/>
    <circle cx="16" cy="8" r="2.5"/>
    <path d="M1 20c0-3.3 3.1-6 8-6s8 2.7 8 6"/>
    <path d="M18 14c2.5.5 4 2 4 4"/>
  </svg>
);

const UserTeamSVG = ({color,size=32}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5"  cy="8" r="2.5"/>
    <circle cx="12" cy="6" r="3"/>
    <circle cx="19" cy="8" r="2.5"/>
    <path d="M1 20c0-2.5 1.8-4.5 4-5"/>
    <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/>
    <path d="M19 15c2.2.5 4 2.5 4 5"/>
  </svg>
);

const ChartSVG = ({color="#3B82F6",size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const CalSVG = ({color="#22C55E",size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
  </svg>
);

const CheckSVG = ({color="white",size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const ArrowSVG = ({size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const InfoSVG = ({color="#3B82F6",size=13}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const TrendSVG = ({color="#22C55E",size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const PersonSVG = ({color="#3B82F6",size=22}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

const BackArrowSVG = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
);

/* ═══════════════════════ SHARED UI ════════════════════════ */

/* Dots — total visible según rol */
const Dots = ({total,current}) => (
  <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:18}}>
    {Array.from({length:total}).map((_,i)=>(
      <div key={i} style={{
        height:4,borderRadius:2,transition:"all .35s",
        width:i===current?28:6,
        background:i===current?C.blue:i<current?"rgba(37,99,235,0.45)":"rgba(255,255,255,0.12)",
      }}/>
    ))}
  </div>
);

const Tag = ({children,color}) => (
  <div style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:9,fontWeight:700,
    letterSpacing:"2.5px",color:color||C.blueL,textTransform:"uppercase",marginBottom:12}}>
    <div style={{width:3,height:10,background:color||C.blue,borderRadius:2}}/>
    {children}
  </div>
);

/* Altura fija compartida — única fuente de verdad */
const BTN_H = 58;

const BtnPrimary = ({children,onClick,done=false,disabled=false}) => (
  <button onClick={onClick} disabled={disabled} style={{
    flex:1,                       /* ocupa el espacio restante */
    height:BTN_H,
    minWidth:0,                   /* permite shrink si hace falta */
    background:done?GREEN_GRAD:disabled?"rgba(255,255,255,0.05)":BLUE_GRAD,
    border:"none",borderRadius:16,color:disabled?C.muted:C.text,
    fontFamily:"system-ui,sans-serif",
    fontSize:13,fontWeight:800,letterSpacing:"1px",
    textTransform:"uppercase",
    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
    cursor:disabled?"not-allowed":"pointer",
    boxShadow:done?GLOW_G:disabled?"none":GLOW,
    transition:"all .35s cubic-bezier(.16,1,.3,1)",
    display:"flex",alignItems:"center",justifyContent:"center",gap:8,
  }}>
    {done && <CheckSVG size={18}/>}
    {!done && !disabled && <ArrowSVG size={16}/>}
    {children}
  </button>
);

const BtnBack = ({onClick}) => (
  <button onClick={onClick} style={{
    flexShrink:0,                 /* nunca se achica */
    height:BTN_H,                 /* idéntico al BtnPrimary */
    width:100,                    /* ancho fijo */
    background:"none",
    border:`1px solid ${C.borderSub}`,
    borderRadius:12,color:C.sub,
    fontSize:13,fontWeight:600,
    cursor:"pointer",
    display:"flex",alignItems:"center",justifyContent:"center",gap:6,
    fontFamily:"system-ui,sans-serif",
    whiteSpace:"nowrap",
  }}>
    <BackArrowSVG/> Atrás
  </button>
);

/* Contenedor de botones — siempre perfecto */
const BtnRow = ({dots,total,current,children}) => (
  <div style={{padding:"14px 24px 36px",flexShrink:0,background:C.bg}}>
    <Dots total={total} current={current}/>
    <div style={{
      display:"flex",flexDirection:"row",
      gap:10,
      height:BTN_H,              /* altura fija del row = altura de los botones */
    }}>
      {children}
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   PASO 0 — LANDING
═══════════════════════════════════════════ */
const Step0 = ({onNext, onYaTengoCuenta}) => {
  const [vis,setVis] = React.useState(false);
  React.useEffect(()=>{const t=setTimeout(()=>setVis(true),100);return()=>clearTimeout(t);},[]);
  const a = (d=0) => ({
    opacity:vis?1:0,
    transform:vis?"translateY(0)":"translateY(16px)",
    transition:`all .6s cubic-bezier(.16,1,.3,1) ${d}ms`,
  });

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",minHeight:780}}>
      {/* Foto gym */}
      <div style={{position:"absolute",inset:0,backgroundImage:"url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80)",backgroundSize:"cover",backgroundPosition:"center 25%",filter:"brightness(0.27) saturate(0.55)",backgroundColor:"#050C18"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(5,12,24,0.4) 0%,rgba(5,12,24,0.05) 20%,rgba(5,12,24,0.68) 56%,rgba(5,12,24,1) 86%)"}}/>
      <div style={{position:"absolute",top:-80,left:"50%",transform:"translateX(-50%)",width:440,height:440,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,0.2) 0%,transparent 70%)",pointerEvents:"none"}}/>

      <div style={{position:"relative",zIndex:5,flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"68px 28px 36px",boxSizing:"border-box"}}>

        {/* Logo */}
        <div style={{...a(0),display:"flex",flexDirection:"column",alignItems:"center",gap:16,marginBottom:18}}>
          <div style={{width:92,height:92,borderRadius:24,background:BLUE_GRAD,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:GLOW,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:"45%",borderRadius:"24px 24px 50% 50%",background:"linear-gradient(to bottom,rgba(255,255,255,0.14),transparent)",pointerEvents:"none"}}/>
            <BarSVG w={58}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:3,height:58,background:C.blue,borderRadius:2,boxShadow:`0 0 12px ${C.blue}`}}/>
            <div>
              <div style={{fontSize:58,fontWeight:900,color:C.text,letterSpacing:4,lineHeight:.93,textShadow:"0 2px 20px rgba(0,0,0,0.9)"}}>IRON</div>
              <div style={{fontSize:58,fontWeight:900,color:C.blue,letterSpacing:4,lineHeight:.93,textShadow:`0 0 28px rgba(37,99,235,0.85)`}}>TRACK</div>
            </div>
          </div>
        </div>

        {/* Propuesta de valor */}
        <div style={{...a(130),textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:20,fontWeight:800,color:"rgba(255,255,255,0.92)",lineHeight:1.35,marginBottom:6}}>
            Todo lo que necesitás<br/>para entrenar mejor.
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.38)",letterSpacing:"0.4px"}}>
            Rutinas, alumnos y progresión — en un solo lugar
          </div>
        </div>

        {/* Feature pills */}
        <div style={{...a(210),width:"100%",display:"flex",flexDirection:"column",gap:10,marginBottom:"auto"}}>
          {[
            {icon:<CoachSVG  color="#3B82F6" size={16}/>, text:"Panel de alumnos con seguimiento en tiempo real"},
            {icon:<ChartSVG  color="#60A5FA" size={16}/>, text:"Progresión de cargas y PRs automáticos"},
            {icon:<CalSVG    color="#22C55E" size={16}/>, text:"Planificación por bloques y semanas"},
          ].map((f,i)=>(
            <div key={i} style={{height:52,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,backdropFilter:"blur(8px)",display:"flex",alignItems:"center",gap:12,padding:"0 16px"}}>
              <div style={{width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {f.icon}
              </div>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:500}}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{...a(300),width:"100%",display:"flex",flexDirection:"column",gap:8,marginTop:28}}>
          <Dots total={5} current={0}/>
          <BtnPrimary onClick={onNext}>Empezar gratis</BtnPrimary>
          {/* ✅ Botón "ya tengo cuenta" funcional */}
          <button
            onClick={onYaTengoCuenta}
            style={{
              background:"none",border:"none",
              color:"rgba(255,255,255,0.35)",
              fontFamily:"system-ui,sans-serif",fontSize:12,fontWeight:600,
              letterSpacing:"1.5px",textTransform:"uppercase",
              cursor:"pointer",height:40,
              transition:"color .2s",
            }}
            onMouseEnter={e=>e.target.style.color="rgba(255,255,255,0.65)"}
            onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.35)"}
          >
            Ya tengo cuenta — ingresar
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   PASO 1 — ROL
═══════════════════════════════════════════ */
const Step1 = ({onNext,onBack,role,setRole}) => {
  const roles = [
    {
      id:"entrenador",label:"Entrenador",
      desc:"Creás rutinas, asignás planes y seguís el progreso de cada alumno.",
      color:C.blue,selBg:"rgba(37,99,235,0.1)",selBorder:C.blue,
      chipBg:"rgba(59,130,246,0.12)",chipColor:"#93C5FD",
      chips:["Rutinas","Alumnos","Progresión","Chat"],
      icon:(sel)=><CoachSVG color={sel?"#3B82F6":"#64748B"} size={26}/>,
      preview:(
        <div style={{marginTop:14,background:"rgba(0,0,0,0.28)",borderRadius:12,padding:"14px"}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",color:"#3B82F6",textTransform:"uppercase",marginBottom:10}}>Vista previa del panel</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,color:C.sub}}>Alumnos activos</span>
            <span style={{fontSize:15,fontWeight:900,color:"#3B82F6"}}>—</span>
          </div>
          <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,marginBottom:10}}/>
          {[{icon:<CoachSVG color="#3B82F6" size={13}/>,text:"Agregar primer alumno"},{icon:<CalSVG color="#22C55E" size={13}/>,text:"Crear primera rutina"}].map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i===0?"1px solid rgba(255,255,255,0.05)":"none"}}>
              {s.icon}
              <span style={{fontSize:11,color:C.sub,flex:1}}>{s.text}</span>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#3B82F6",opacity:.7}}/>
            </div>
          ))}
        </div>
      ),
    },
    {
      id:"atleta",label:"Atleta",
      desc:"Seguís el plan de tu entrenador y registrás cada sesión con orden.",
      color:C.green,selBg:"rgba(34,197,94,0.08)",selBorder:C.green,
      chipBg:"rgba(34,197,94,0.1)",chipColor:"#86EFAC",
      chips:["Mi plan","Sesiones","Historial","PRs"],
      icon:(sel)=><AthleteSVG color={sel?"#22C55E":"#64748B"} size={26}/>,
      preview:(
        <div style={{marginTop:14,background:"rgba(0,0,0,0.28)",borderRadius:12,padding:"14px"}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",color:"#22C55E",textTransform:"uppercase",marginBottom:10}}>Vista previa de tu semana</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {[{d:"LUN",ok:true},{d:"MIÉ",ok:true},{d:"VIE",ok:false}].map(day=>(
              <div key={day.d} style={{flex:1,background:day.ok?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 4px",textAlign:"center",border:`1px solid ${day.ok?"rgba(34,197,94,0.25)":"rgba(255,255,255,0.05)"}`}}>
                <div style={{fontSize:9,color:day.ok?"#22C55E":C.muted,fontWeight:700,marginBottom:4}}>{day.d}</div>
                {day.ok?<CheckSVG color="#22C55E" size={12}/>:<div style={{width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.1)",margin:"0 auto"}}/>}
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,color:C.muted}}>Próximo entrenamiento</div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>Pierna A — hoy</div>
            </div>
            <div style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:8,padding:"4px 10px",display:"flex",alignItems:"center",gap:5}}>
              <TrendSVG color="#22C55E" size={12}/>
              <span style={{fontSize:11,fontWeight:700,color:"#22C55E"}}>PR activo</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.bg,boxSizing:"border-box",overflow:"hidden"}}>
      {/* Header fijo */}
      <div style={{padding:"52px 24px 0",flexShrink:0}}>
        <Tag>Tu perfil</Tag>
        <div style={{fontSize:32,fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.5px",marginBottom:8}}>¿CÓMO USÁS<br/>LA APP?</div>
        <div style={{fontSize:14,color:C.sub,lineHeight:1.6,marginBottom:16}}>Elegí tu perfil. Podés cambiarlo después en ajustes.</div>
      </div>

      {/* Cards — scrollable cuando la preview se expande */}
      <div style={{flex:1,overflowY:"auto",padding:"0 24px",paddingBottom:8}}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {roles.map(r=>{
          const sel=role===r.id;
          return (
            <div key={r.id} onClick={()=>setRole(r.id)} style={{
              background:sel?r.selBg:C.bg2,
              border:`2px solid ${sel?r.selBorder:C.borderSub}`,
              borderRadius:18,padding:"16px 18px",cursor:"pointer",
              transition:"all .25s",boxShadow:sel?`0 0 24px ${r.selBorder}22`:"none",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{width:52,height:52,borderRadius:14,flexShrink:0,background:sel?`${r.color}18`:"rgba(255,255,255,0.04)",border:`1px solid ${sel?`${r.color}28`:C.borderSub}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .25s"}}>
                  {r.icon(sel)}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:3}}>{r.label}</div>
                  <div style={{fontSize:12,color:C.sub,lineHeight:1.45}}>{r.desc}</div>
                </div>
                <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${sel?r.selBorder:C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:r.color,opacity:sel?1:0,transform:sel?"scale(1)":"scale(0)",transition:"all .25s"}}/>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {r.chips.map(c=><span key={c} style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:r.chipBg,color:r.chipColor}}>{c}</span>)}
              </div>
              <div style={{maxHeight:sel?"220px":"0",overflow:"hidden",transition:"max-height .45s cubic-bezier(.16,1,.3,1)"}}>
                {r.preview}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Botones — siempre visibles, pegados al fondo */}
      <BtnRow total={5} current={1}>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={onNext} disabled={!role}>
          {role==="entrenador"?"Soy entrenador":role==="atleta"?"Soy atleta":"Elegí tu perfil"}
        </BtnPrimary>
      </BtnRow>
    </div>
  );
};

/* ═══════════════════════════════════════════
   PASO 2 — NOMBRE (TODOS los usuarios)
═══════════════════════════════════════════ */
const Step2Name = ({onNext,onBack,role,name,setName}) => {
  const isCoach = role==="entrenador";
  const inputRef = React.useRef(null);
  const [vis,setVis] = React.useState(false);

  React.useEffect(()=>{
    const t1=setTimeout(()=>setVis(true),60);
    const t2=setTimeout(()=>inputRef.current?.focus(),300);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[]);

  /* Dots: coach ve 5 pasos, atleta ve 4 */
  const totalDots = isCoach ? 5 : 4;
  const currentDot = 2;

  return (
    <div style={{
      flex:1,display:"flex",flexDirection:"column",
      padding:"52px 24px 0",background:C.bg,
      minHeight:780,boxSizing:"border-box",
      opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(18px)",
      transition:"all .5s cubic-bezier(.16,1,.3,1)",
    }}>
      <Tag>{isCoach?"Tu identidad profesional":"Sobre vos"}</Tag>
      <div style={{fontSize:32,fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.5px",marginBottom:8}}>
        ¿CÓMO TE<br/>LLAMÁS?
      </div>
      <div style={{fontSize:14,color:C.sub,lineHeight:1.6,marginBottom:32}}>
        {isCoach
          ?"Tus alumnos van a ver tu nombre en la app."
          :"Tu coach va a ver tu perfil con este nombre."}
      </div>

      {/* Input con feedback visual */}
      <div style={{position:"relative",marginBottom:24}}>
        <div style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
          <PersonSVG color={name?C.blue:"#4B6480"} size={20}/>
        </div>
        <input
          ref={inputRef}
          value={name}
          onChange={e=>setName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&name.trim()&&onNext()}
          placeholder={isCoach?"ej. Carlos Méndez":"ej. Julieta Ros"}
          style={{
            width:"100%",height:60,
            background:name?"rgba(37,99,235,0.08)":C.bg2,
            border:`1.5px solid ${name?C.blue:C.borderSub}`,
            borderRadius:16,color:C.text,fontSize:18,fontWeight:600,
            padding:"0 52px 0 48px",outline:"none",
            fontFamily:"system-ui,sans-serif",boxSizing:"border-box",
            transition:"all .2s",
          }}
        />
        {/* Check cuando hay nombre */}
        {name.trim() && (
          <div style={{
            position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",
            width:28,height:28,borderRadius:"50%",background:C.blue,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 0 12px rgba(37,99,235,0.5)",
          }}>
            <CheckSVG size={14}/>
          </div>
        )}
      </div>

      {/* Preview personalizada en tiempo real */}
      <div style={{
        background:C.bg2,border:`1px solid ${C.border}`,borderRadius:18,
        padding:"18px",flex:1,
        opacity:name.trim()?1:0.25,transition:"opacity .35s",
      }}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",color:C.muted,textTransform:"uppercase",marginBottom:14}}>
          Así va a aparecer tu perfil
        </div>

        {/* Header del panel */}
        <div style={{background:C.bg3,borderRadius:12,padding:"14px",marginBottom:10}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:3}}>Buenos días,</div>
          <div style={{fontSize:20,fontWeight:900,color:C.text,marginBottom:10}}>
            {name.trim()||"Tu nombre"}
          </div>
          {isCoach ? (
            <>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:11,color:C.sub}}>Alumnos activos</span>
                <span style={{fontSize:13,fontWeight:900,color:C.blueL}}>0 / 0</span>
              </div>
              <div style={{height:3,background:"rgba(255,255,255,0.07)",borderRadius:2}}/>
            </>
          ) : (
            <div style={{display:"flex",gap:6}}>
              {["LUN","MIÉ","VIE"].map((d,i)=>(
                <div key={d} style={{flex:1,background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"7px 4px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:9,color:C.muted,fontWeight:700,marginBottom:3}}>{d}</div>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"rgba(255,255,255,0.1)",margin:"0 auto"}}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirmación */}
        <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(34,197,94,0.07)",borderRadius:10,padding:"9px 12px",border:"1px solid rgba(34,197,94,0.14)"}}>
          <CheckSVG color={C.green} size={12}/>
          <span style={{fontSize:11,color:"#4ADE80"}}>
            {isCoach?"Tu cuenta de entrenador está lista.":"Tu perfil de atleta está listo."}
          </span>
        </div>
      </div>

      <BtnRow total={totalDots} current={currentDot}>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={onNext} disabled={!name.trim()}>
          {name.trim()?"Continuar":"Ingresá tu nombre"}
        </BtnPrimary>
      </BtnRow>
    </div>
  );
};

/* ═══════════════════════════════════════════
   PASO 3 — ALUMNOS (solo entrenadores)
═══════════════════════════════════════════ */
const Step3Alumnos = ({onNext,onBack,alumnosRange,setAlumnosRange}) => {
  const [vis,setVis] = React.useState(false);
  React.useEffect(()=>{const t=setTimeout(()=>setVis(true),60);return()=>clearTimeout(t);},[]);

  const options = [
    {id:"1-5",  label:"1 — 5 alumnos",     desc:"Trabajo personalizado o estás empezando",  tag:"Personalizado",  icon:(s)=><UserOneSVG  color={s?"#3B82F6":"#64748B"} size={32}/>},
    {id:"5-10", label:"5 — 10 alumnos",    desc:"Grupo consolidado, buscás más organización", tag:"En crecimiento", icon:(s)=><UserGroupSVG color={s?"#3B82F6":"#64748B"} size={32}/>},
    {id:"10+",  label:"Más de 10 alumnos", desc:"Cartera amplia, necesitás escalar el sistema",tag:"Escala",         icon:(s)=><UserTeamSVG  color={s?"#3B82F6":"#64748B"} size={32}/>},
  ];

  return (
    <div style={{
      flex:1,display:"flex",flexDirection:"column",
      padding:"52px 24px 0",background:C.bg,
      minHeight:780,boxSizing:"border-box",
      opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(20px)",
      transition:"all .5s cubic-bezier(.16,1,.3,1)",
    }}>
      <Tag>Tu situación actual</Tag>
      <div style={{fontSize:32,fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.5px",marginBottom:8}}>
        ¿CUÁNTOS ALUMNOS<br/>TENÉS AHORA?
      </div>
      <div style={{fontSize:14,color:C.sub,lineHeight:1.6,marginBottom:28}}>
        Esto nos ayuda a mostrarte las funciones más útiles para tu situación.
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:14,flex:1}}>
        {options.map((opt,i)=>{
          const sel = alumnosRange===opt.id;
          return (
            <div
              key={opt.id}
              onClick={()=>setAlumnosRange(opt.id)}
              style={{
                background:sel?"rgba(37,99,235,0.1)":C.bg2,
                border:`2px solid ${sel?C.blue:C.borderSub}`,
                borderRadius:20,padding:"18px 20px",cursor:"pointer",
                transition:"all .25s cubic-bezier(.16,1,.3,1)",
                boxShadow:sel?"0 0 0 1px rgba(37,99,235,0.3),0 0 28px rgba(37,99,235,0.22),0 0 52px rgba(37,99,235,0.08)":"none",
                position:"relative",overflow:"hidden",
                opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(10px)",
                transitionDelay:`${60+i*55}ms`,
              }}
            >
              {/* Línea acento izquierda */}
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,borderRadius:"2px 0 0 2px",background:sel?BLUE_GRAD:"transparent",transition:"background .25s"}}/>

              <div style={{display:"flex",alignItems:"center",gap:16}}>
                {/* Ícono SVG */}
                <div style={{width:60,height:60,borderRadius:16,flexShrink:0,background:sel?"rgba(37,99,235,0.14)":"rgba(255,255,255,0.04)",border:`1.5px solid ${sel?"rgba(37,99,235,0.3)":C.borderSub}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .25s"}}>
                  {opt.icon(sel)}
                </div>

                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:16,fontWeight:800,color:C.text}}>{opt.label}</span>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,letterSpacing:"0.8px",textTransform:"uppercase",background:sel?"rgba(37,99,235,0.18)":"rgba(255,255,255,0.06)",color:sel?"#93C5FD":C.muted,transition:"all .25s"}}>
                      {opt.tag}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:C.sub,lineHeight:1.5}}>{opt.desc}</div>
                </div>

                {/* Radio */}
                <div style={{width:24,height:24,borderRadius:"50%",flexShrink:0,border:`2px solid ${sel?C.blue:C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .25s",boxShadow:sel?"0 0 10px rgba(37,99,235,0.4)":"none"}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:C.blue,opacity:sel?1:0,transform:sel?"scale(1)":"scale(0)",transition:"all .25s cubic-bezier(.16,1,.3,1)"}}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota privacidad */}
      <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.12)",borderRadius:12,padding:"10px 14px",marginTop:16}}>
        <InfoSVG color="#3B82F6" size={13}/>
        <span style={{fontSize:11,color:C.muted,lineHeight:1.45}}>Solo usamos esto para personalizar tu experiencia inicial.</span>
      </div>

      <BtnRow total={5} current={3}>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={onNext} disabled={!alumnosRange}>
          {alumnosRange?"Continuar":"Seleccioná una opción"}
        </BtnPrimary>
      </BtnRow>
    </div>
  );
};

/* ═══════════════════════════════════════════
   PASO FINAL — Dashboard preview
═══════════════════════════════════════════ */
const StepFinal = ({onDone,onBack,role,name,alumnosRange}) => {
  const isCoach = role==="entrenador";
  const [done,setDone] = React.useState(false);
  const finish = ()=>{ setDone(true); setTimeout(onDone,950); };

  const rangeLabel = alumnosRange==="1-5"?"1 a 5":alumnosRange==="5-10"?"5 a 10":"más de 10";
  const totalDots  = isCoach ? 5 : 4;
  const currentDot = isCoach ? 4 : 3;

  const steps = isCoach
    ? [
        {icon:<CoachSVG  color="#3B82F6" size={14}/>, label:"Agregar tu primer alumno",  status:"pendiente",  c:"#3B82F6"},
        {icon:<CalSVG    color="#22C55E" size={14}/>, label:"Crear tu primera rutina",    status:"pendiente",  c:"#22C55E"},
        {icon:<ChartSVG  color="#94A3B8" size={14}/>, label:"Ver el panel de progreso",   status:"disponible", c:"#94A3B8"},
      ]
    : [
        {icon:<CalSVG    color="#3B82F6" size={14}/>, label:"Tu plan ya está disponible", status:"listo",      c:"#3B82F6"},
        {icon:<ChartSVG  color="#22C55E" size={14}/>, label:"Registrá tu primera sesión", status:"pendiente",  c:"#22C55E"},
        {icon:<TrendSVG  color="#94A3B8" size={14}/>, label:"Ver tu historial de PRs",    status:"disponible", c:"#94A3B8"},
      ];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.bg,minHeight:780,boxSizing:"border-box",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-80,left:"50%",transform:"translateX(-50%)",width:420,height:420,borderRadius:"50%",background:done?"radial-gradient(circle,rgba(34,197,94,0.14) 0%,transparent 65%)":"radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 65%)",pointerEvents:"none",transition:"background .6s"}}/>

      <div style={{position:"relative",zIndex:5,flex:1,display:"flex",flexDirection:"column",padding:"52px 24px 0"}}>

        {/* Checkmark */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
          <div style={{width:68,height:68,borderRadius:20,background:done?GREEN_GRAD:BLUE_GRAD,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:done?GLOW_G:GLOW,transition:"all .5s"}}>
            <CheckSVG size={30}/>
          </div>
        </div>

        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:34,fontWeight:900,color:C.text,lineHeight:1.1,marginBottom:8}}>
            Todo listo,<br/>{name||"Hernan"}
          </div>
          <div style={{fontSize:14,color:C.sub,lineHeight:1.6}}>
            {isCoach?"Tu cuenta está lista. Empezá agregando tu primer alumno.":"Tu perfil está activo. Tu coach puede asignarte rutinas."}
          </div>
        </div>

        {/* Dashboard preview */}
        <div style={{background:C.bg2,borderRadius:18,padding:"16px",marginBottom:12,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",color:C.muted,textTransform:"uppercase",marginBottom:12}}>Tu panel en IronTrack</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Buenos días,</div>
            <div style={{fontSize:20,fontWeight:900,color:C.text}}>{name||"Hernan"}</div>
          </div>

          {/* Chip con dato de alumnos capturado */}
          {isCoach && alumnosRange && (
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:20,padding:"4px 12px",marginBottom:12}}>
              <CoachSVG color="#3B82F6" size={11}/>
              <span style={{fontSize:11,fontWeight:600,color:"#93C5FD"}}>{rangeLabel} alumnos</span>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {steps.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",background:C.bg3,borderRadius:10,border:"1px solid rgba(255,255,255,0.04)"}}>
                <div style={{width:28,height:28,borderRadius:8,background:`${s.c}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.icon}</div>
                <span style={{fontSize:12,color:C.sub,flex:1}}>{s.label}</span>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,background:`${s.c}14`,color:s.c,letterSpacing:"0.5px",textTransform:"uppercase"}}>{s.status}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(37,99,235,0.07)",borderRadius:10,padding:"8px 12px",border:"1px solid rgba(37,99,235,0.14)"}}>
            <InfoSVG color="#3B82F6" size={12}/>
            <span style={{fontSize:11,color:"#60A5FA"}}>Así va a verse tu panel. Todo listo para empezar.</span>
          </div>
        </div>
      </div>

      <div style={{padding:"0 24px 36px",position:"relative",zIndex:5}}>
        <Dots total={totalDots} current={currentDot}/>
        <BtnPrimary onClick={finish} done={done}>
          {done?"Redirigiendo...":"Ir a mi panel"}
        </BtnPrimary>
        {!done&&(
          <button onClick={onBack} style={{display:"block",width:"100%",marginTop:10,background:"none",border:"none",color:C.muted,fontSize:12,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer",fontFamily:"system-ui,sans-serif",height:32}}>
            Atrás
          </button>
        )}
      </div>
    </div>
  );
};

function OnboardingScreen({es, darkMode, onDone}) {

  const [step, setStep]                 = React.useState(0);
  const [role, setRole]                 = React.useState(null);
  const [name, setName]                 = React.useState("");
  const [alumnosRange, setAlumnosRange] = React.useState(null);

  const isCoach = role === "entrenador";

  const next = () => {
    if (step === 2 && !isCoach) setStep(4);
    else setStep(s => s + 1);
  };

  const back = () => {
    if (step === 4 && !isCoach) setStep(2);
    else setStep(s => s - 1);
  };

  const restart = () => { setStep(0); setRole(null); setName(""); setAlumnosRange(null); };

  const screens = {
    0: <Step0        onNext={next}    onYaTengoCuenta={onDone}/>,
    1: <Step1        onNext={next}    onBack={back} role={role} setRole={setRole}/>,
    2: <Step2Name    onNext={next}    onBack={back} role={role} name={name} setName={setName}/>,
    3: <Step3Alumnos onNext={next}    onBack={back} alumnosRange={alumnosRange} setAlumnosRange={setAlumnosRange}/>,
    4: <StepFinal    onDone={onDone}  onBack={back} role={role} name={name} alumnosRange={alumnosRange}/>,
  };

  return (
    <div style={{minHeight:"100dvh",width:"100%",background:"#0A1120",fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      {screens[step]}
    </div>
  );
}

function LoginForm({es, btn, inp, lbl, onLogin, onClose, darkMode}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [mode,setMode]=useState("login");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [errors,setErrors]=useState({email:false,pass:false,name:false});
  const emailOk = /^[^@]+@[^@]+\.[^@]+$/.test(email);
  const passOk = pass.length >= 6;
  return(
    <div>
      <div style={{fontSize:28,fontWeight:800,letterSpacing:2,marginBottom:12,textAlign:"center"}}>{mode==="login"?(es?"INICIAR SESION":"LOG IN"):(es?"REGISTRO":"REGISTER")}</div>
      {mode==="register"&&<div style={{marginBottom:8}}><span style={lbl}>{es?es?"NOMBRE":"NAME":"NAME"}</span><input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></div>}
      <div style={{marginBottom:8}}><span style={lbl}>EMAIL</span><input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@ejemplo.com"/></div>
      <div style={{marginBottom:12}}><span style={lbl}>{es?"CONTRASENA":"PASSWORD"}</span><input style={inp} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="*****"/></div>
      <button className="hov" style={{...btn("#2563EB"),width:"100%",padding:"8px",fontSize:18,marginBottom:8}} onClick={()=>{
          const eErr=!emailOk;
          const pErr=!passOk;
          const nErr=mode==="register"&&!name.trim();
          if(eErr||pErr||nErr){setErrors({email:eErr,pass:pErr,name:nErr});return;}
          onLogin({name:mode==="register"?name:email.split("@")[0],email,id:email});
        }}>ENTRAR</button>
      <div style={{textAlign:"center",fontSize:15,color:textMuted,cursor:"pointer",marginBottom:8}} onClick={()=>setMode(m=>m==="login"?"register":"login")}>
        {mode==="login"?(es?"No tenes cuenta? Registrate":"No account? Register"):(es?"Ya tenes cuenta? Iniciá sesion":"Already have an account? Log in")}
      </div>
      <button className="hov" style={{...btn(),width:"100%",padding:"8px",fontSize:15}} onClick={onClose}>CANCELAR</button>
    </div>
  );
}

function EditExModal({editEx, btn, inp, es, onSave, onClose, PATS, darkMode, allEx}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const info = (allEx||[]).find(e=>e.id===editEx.ex.id);
  const safePATS = PATS||{};
  const pat = safePATS[info?.pattern] || safePATS["core"] || Object.values(safePATS)[0] || {color:"#2563EB",icon:"E",label:"Ejercicio"};
  const initWeeks = () => {
    const w = [...(editEx.ex.weeks||[])];
    while(w.length<4) w.push({sets:"",reps:"",kg:"",note:"",pausa:""});
    return w.map(wk=>({sets:wk.sets||"",reps:wk.reps||"",kg:wk.kg||"",note:wk.note||"",pausa:wk.pausa||""}));
  };
  const METODOS = [
    {id:"carga",  label:"+ Carga",   desc:"Subir kg c/semana",  color:"#2563EB"},
    {id:"reps",   label:"+ Reps",    desc:"Más reps, mismo peso",color:"#22C55E"},
    {id:"series", label:"+ Series",  desc:"Más series c/semana", color:"#8B5CF6"},
    {id:"pausa",  label:"− Pausa",   desc:"Reducir descanso",    color:"#F59E0B"},
    {id:"manual", label:"Manual",    desc:"Definís vos c/semana",color:"#8B9AB2"},
  ];
  const [sets, setSets] = useState(editEx.ex.sets||"3");
  const [reps, setReps] = useState(editEx.ex.reps||"8-10");
  const [kg, setKg] = useState(editEx.ex.kg||"");
  const [pause, setPause] = useState(editEx.ex.pause||90);
  const [weeks, setWeeks] = useState(initWeeks);
  const [progresion, setProgresion] = useState(editEx.ex.progresion||"manual");

  const updW = (wi,field,val) => setWeeks(prev=>prev.map((w,i)=>i===wi?{...w,[field]:val}:w));
  const color = pat?.color||"#2563EB";

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:125,overflowY:"auto"}} onClick={onClose}>
      <div style={{background:bgCard,margin:"20px 16px",borderRadius:16,padding:"20px 16px",maxHeight:"85dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:color,flexShrink:0}}>{pat?.icon||"·"}</div>
          <div style={{fontSize:22,fontWeight:800,flex:1}}>{es?info?.name:info?.nameEn}</div>
          <button className="hov" style={{...btn(),fontSize:22,padding:"4px 8px"}} onClick={onClose}>x</button>
        </div>

        <div style={{fontSize:13,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:8}}>CONFIGURACION BASE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,marginBottom:4}}>SERIES</div>
            <input style={{...inp,padding:"8px 6px",fontSize:15,textAlign:"center"}} value={sets} onChange={e=>setSets(e.target.value)}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,marginBottom:4}}>REPS</div>
            <input style={{...inp,padding:"8px 6px",fontSize:15,textAlign:"center"}} value={reps} onChange={e=>setReps(e.target.value)}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,marginBottom:4}}>KG</div>
            <input style={{...inp,padding:"8px 6px",fontSize:15,textAlign:"center"}} value={kg} onChange={e=>setKg(e.target.value)} placeholder="-"/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,marginBottom:4}}>PAUSA</div>
            <input style={{...inp,padding:"8px 6px",fontSize:15,textAlign:"center"}} value={pause} onChange={e=>setPause(e.target.value)} placeholder="seg"/>
          </div>
        </div>

                <div style={{fontSize:12,fontWeight:700,letterSpacing:0.5,color:textMuted,marginBottom:8}}>{es?"MÉTODO DE PROGRESIÓN":"PROGRESSION METHOD"}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
          {METODOS.map(m=>(
            <button key={m.id} className="hov" onClick={()=>setProgresion(m.id)}
              style={{padding:"8px 12px",borderRadius:8,border:"1px solid "+(progresion===m.id?m.color:"#2D4057"),
                background:progresion===m.id?m.color+"22":"transparent",
                color:progresion===m.id?m.color:textMuted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {m.label}
            </button>
          ))}
        </div>
        {progresion!=="manual"&&(
          <div style={{background:_dm?"#162234":"#EEF2F7",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:textMuted}}>
            {METODOS.find(m=>m.id===progresion)?.desc} — completá los valores de cada semana abajo
          </div>
        )}
        <div style={{fontSize:12,fontWeight:700,letterSpacing:0.5,color:textMuted,marginBottom:8}}>{es?"VALORES POR SEMANA":"VALUES PER WEEK"}</div>
        {weeks.map((w,wi)=>(
          <div key={(editEx.ex?.id||"ex")+"-edit-wk-"+wi} style={{background:_dm?"#162234":"#EEF2F7",borderRadius:12,padding:"8px 12px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:color}}>SEM {wi+1}</div>
              {wi>0&&progresion!=="manual"&&(()=>{
                const prev=weeks[wi-1];
                const cur=w;
                let hint="";
                if(progresion==="carga"&&prev.kg&&cur.kg) hint=(parseFloat(cur.kg)-parseFloat(prev.kg)>0?"+":"")+Math.round((parseFloat(cur.kg)-parseFloat(prev.kg))*10)/10+" kg";
                if(progresion==="reps"&&prev.reps&&cur.reps) hint=(parseInt(cur.reps)-parseInt(prev.reps)>0?"+":"")+( parseInt(cur.reps)-parseInt(prev.reps))+" reps";
                if(progresion==="series"&&prev.sets&&cur.sets) hint=(parseInt(cur.sets)-parseInt(prev.sets)>0?"+":"")+( parseInt(cur.sets)-parseInt(prev.sets))+" series";
                if(progresion==="pausa"&&prev.pausa&&cur.pausa) hint=(parseInt(cur.pausa)-parseInt(prev.pausa)>0?"+":"")+( parseInt(cur.pausa)-parseInt(prev.pausa))+"s pausa";
                return hint?(<span style={{fontSize:11,color:"#22C55E",fontWeight:700}}>{hint}</span>):null;
              })()}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:4,marginBottom:8}}>
              <div>
                <div style={{fontSize:10,color:textMuted,marginBottom:4,fontWeight:600}}>SERIES</div>
                <input style={{...inp,padding:"8px 4px",fontSize:13,textAlign:"center"}}
                  value={w.sets} onChange={e=>updW(wi,"sets",e.target.value)} placeholder={sets}/>
              </div>
              <div>
                <div style={{fontSize:10,color:textMuted,marginBottom:4,fontWeight:600}}>REPS</div>
                <input style={{...inp,padding:"8px 4px",fontSize:13,textAlign:"center"}}
                  value={w.reps} onChange={e=>updW(wi,"reps",e.target.value)} placeholder={reps}/>
              </div>
              <div>
                <div style={{fontSize:10,color:textMuted,marginBottom:4,fontWeight:600}}>KG</div>
                <input style={{...inp,padding:"8px 4px",fontSize:13,textAlign:"center"}}
                  value={w.kg} onChange={e=>updW(wi,"kg",e.target.value)} placeholder={kg||"—"}/>
              </div>
              <div>
                <div style={{fontSize:10,color:textMuted,marginBottom:4,fontWeight:600}}>PAUSA</div>
                <input style={{...inp,padding:"8px 4px",fontSize:13,textAlign:"center"}}
                  value={w.pausa} onChange={e=>updW(wi,"pausa",e.target.value)} placeholder={pause+"s"}/>
              </div>
            </div>
            <input style={{...inp,padding:"8px 8px",fontSize:12}} value={w.note}
              onChange={e=>updW(wi,"note",e.target.value)}
              placeholder={es?"Nota de semana (opcional)":"Week note (optional)"}/>
          </div>
        ))}
<div style={{display:"flex",gap:8,marginTop:8}}>
          <button className="hov" style={{...btn(),flex:1,padding:"8px"}} onClick={onClose}>CANCELAR</button>
          <button className="hov" style={{...btn("#2563EB"),flex:2,padding:"8px",fontSize:18}} onClick={()=>onSave({...editEx.ex,sets,reps,kg,pause,weeks:weeks.map(w=>({...w,pausa:w.pausa||pause})),progresion})}>
            GUARDAR
          </button>
        </div>
      </div>
    </div>
  );
}

export default GymApp;