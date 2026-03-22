import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useAlumnos } from './hooks/useAlumnos.js';


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
  getRutinas: (alumnoId) => sbFetch("rutinas?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc&limit=10"),
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
};



const uid = () => Math.random().toString(36).slice(2,9);
const fmt = s => String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
const fmtP = s => { const n=parseInt(s)||0; if(!n) return "No"; if(n<60) return n+"s"; const m=Math.floor(n/60),r=n%60; return r===0?(m+"min"):(m+"m"+r+"s"); };


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
        <button key={i} onClick={()=>toggleDia(i)}
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

// ── Icon system — Feather Icons ─────────────────────────────────────────
const Ic = ({name, size=18, color="currentColor", strokeWidth=2, style={}}) => {
  const p = {
    "activity":      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
    "alert-triangle":<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    "arrow-left":    <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    "award":         <><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></>,
    "bar-chart-2":   <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    "bell":          <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    "bookmark":      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>,
    "calendar":      <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    "camera":        <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    "check-circle":  <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
    "check-sm":      <polyline points="5 12 10 17 19 7"/>,
    "chevron-right": <polyline points="9 18 15 12 9 6"/>,
    "chevron-left":  <polyline points="15 18 9 12 15 6"/>,
    "copy":          <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    "edit-2":        <><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></>,
    "eye":           <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    "file-text":     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    "image":         <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    "info":          <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    "link":          <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    "lock":          <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    "log-out":       <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    "message-circle":<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    "moon":          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
    "plus":          <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    "save":          <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
    "settings":      <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    "share":         <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
    "sun":           <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    "trash-2":       <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
    "trending-up":   <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    "upload":        <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    "user":          <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    "users":         <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    "x":             <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    "zap":           <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    "zoom-in":       <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  };
  const icon = p[name] || p["x"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",...style}}>
      {icon}
    </svg>
  );
};

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
  const [newR, setNewR] = useState(null);
  const [editEx, setEditEx] = useState(null);
  const [loginModal, setLoginModal] = useState(false);
  const [session, setSession] = useState(null);
  const [preSessionPRs, setPreSessionPRs] = useState({});
  const [prCelebration, setPrCelebration] = useState(null); // {ejercicio, kg}
  const [swipeState, setSwipeState] = useState({});
  const [btnFlash, setBtnFlash] = useState(false); // {[setKey]: {x, swiping}}
  const [notaDia, setNotaDia] = useState(""); // nota del entrenador al alumno
  const [notaDiaInput, setNotaDiaInput] = useState(""); // input del entrenador
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const scrollRef = useRef(null);
  const lastScrollY = useRef(0);
  const [resumenSesion, setResumenSesion] = useState(null);
  const [chatOpenId, setChatOpenId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      const alumnoIdSync = sessionData?.alumnoId;
      if(!alumnoIdSync) return;
      pending.forEach(item => {
        try {
          sb.addProgreso({
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
            setRoutines([{...ruts[0].datos, alumnoId: sessionData.alumnoId}]);
          }
        
      // Cargar nota del día
      sb.getNota(sessionData.alumnoId).then(res=>{
        if(res && res[0]) setNotaDia(res[0].contenido||res[0].texto||"");
      }).catch(()=>{});
    } catch(e) {}
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
  }, []);

  const toast2 = msg => { setToast(msg); setTimeout(()=>setToast(null),2200); };


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

  const logSet = (exId, kg, reps, note, rpe) => {
    const d = new Date().toLocaleDateString("es-AR");
    setProgress(prev=>{
      const ex = {...(prev[exId]||{sets:[],max:0})};
      ex.sets = [{kg:parseFloat(kg)||0,reps:parseInt(reps)||0,date:d,week:currentWeek,note,rpe:rpe||null},...(ex.sets||[])].slice(0,50);
      ex.max = Math.max(ex.max||0,parseFloat(kg)||0);
      return {...prev,[exId]:ex};
    });
    // Guardar en Supabase — si offline, guardar en cola local
    const alumnoIdSync = sessionData?.alumnoId || (readOnly&&sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(alumnoIdSync) {
      try {
        const rutData = JSON.parse(atob(sharedParam));
        if(alumnoIdSync) {
          if(!isOnline) {
            // Guardar en cola local para sincronizar después
            const item = {exId, kg:parseFloat(kg)||0, reps:parseInt(reps)||0, note:note||'', date:d};
            const updated = [...pendingSync, item];
            setPendingSync(updated);
            try{localStorage.setItem('it_pending_sync', JSON.stringify(updated));}catch(e){}
          } else {
            sb.addProgreso({
              alumno_id: alumnoId,
              ejercicio_id: exId,
              kg: parseFloat(kg)||0,
              reps: parseInt(reps)||0,
              nota: note||"",
              fecha: d
            });
          }
        }
      } catch(e) {}
    }
    // Detectar PR y celebrar (fuera del setter para tener acceso al scope)
    const exPrevData = progress[exId]||{sets:[],max:0};
    const newKgVal = parseFloat(kg)||0;
    if(newKgVal > (exPrevData.max||0) && (exPrevData.max||0) > 0) {
      const exInfoCel = [...EX,...(customEx||[])].find(e=>e.id===exId);
      setPrCelebration({ejercicio: exInfoCel?.name||exId, kg: newKgVal});
      setTimeout(()=>setPrCelebration(null), 2500);
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

  const allEx = [...EX, ...customEx];
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

  // Pantalla de login

  // ── Onboarding de 3 pasos ─────────────────────────────────────────────
  if(!sharedParam && !onboardDone) return (
    <OnboardingScreen es={es} darkMode={darkMode} onDone={()=>{
      try{localStorage.setItem('it_onboard_done','1');}catch(e){}
      setOnboardDone(true);
    }}/>
  );

  if(!sharedParam && loginScreen) return (
    <div style={{maxWidth:480,margin:"0 auto",height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:bg,color:textMain,fontFamily:"Inter,sans-serif",padding:"0 24px"}}>
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
          const sp = typeof window!=="undefined"?(localStorage.getItem("it_tpass")||"irontrack2024"):"irontrack2024";
          const isEntrenador = loginEmail.trim().toLowerCase()==="entrenador@irontrack.app";
          if(isEntrenador){
            if(loginEmail==="entrenador@irontrack.app"&&loginPass===sp){
              localStorage.clear();
              const s={role:"entrenador",name:"Entrenador"};
              localStorage.setItem("it_session",JSON.stringify(s));
              window.location.reload();
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
              window.location.reload();
            } else setLoginError("Email o contraseña incorrectos");
          }
          setLoginLoading(false);
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
                  if(saved) { setLoginLoading(true); setTimeout(()=>{ localStorage.setItem("it_session",JSON.stringify(saved)); window.location.reload(); },500); }
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
    <div style={{minHeight:"100vh",background:bg,color:textMain,fontFamily:"Inter,sans-serif","--sk1":darkMode?"#1E2D40":"#E8EEF4","--sk2":darkMode?"#2D4057":"#D1DCE8",paddingBottom:72,position:"relative"}}>
      <style dangerouslySetInnerHTML={{__html:
        "@import url(https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap);" +
        "*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;line-height:1.4;-webkit-font-smoothing:antialiased}input,textarea,select{outline:none!important}" +
        "::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:"+(darkMode?"#162234":"#8B9AB2")+";border-radius:2px}" +
        ".hov{transition:all .15s ease;cursor:pointer}.hov:hover{filter:brightness(1.15)}" +
        "@keyframes successPulse{0%{transform:scale(1)}30%{transform:scale(0.94)}60%{transform:scale(1.06)}100%{transform:scale(1)}}" +
        "@keyframes greenFlash{0%{filter:brightness(1)}40%{filter:brightness(1.5) saturate(1.3)}100%{filter:brightness(1)}}" +
        "@keyframes bounceIn{0%{transform:scale(0) rotate(-10deg);opacity:0}50%{transform:scale(1.2) rotate(5deg)}70%{transform:scale(0.92) rotate(-2deg)}100%{transform:scale(1) rotate(0);opacity:1}}" +
        "@keyframes rippleOut{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}100%{box-shadow:0 0 0 20px rgba(34,197,94,0)}}" +

        ".num{font-family:'Barlow Condensed',sans-serif;font-variant-numeric:tabular-nums}" +
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
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {session&&<span style={{...tag("#22C55E"),fontSize:13}}>✓ Sesion activa</span>}
          {sessionData&&<span style={{fontSize:13,color:textMuted,fontWeight:500,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sessionData.name}</span>}
          <button className="hov" style={{...btn(),padding:"8px",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setSettingsOpen(true)}><Ic name="settings" size={18} color={textMuted}/></button>
          {sessionData
            ? <button className="hov" style={{background:esAlumno?"#2563EB":"#2563EB22",color:esAlumno?"#fff":"#2563EB",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:.5}} onClick={()=>{localStorage.clear();window.location.reload();}}>{esAlumno?(es?"FINALIZAR SESIÓN":"END SESSION"):"SALIR"}</button>
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
      {session&&activeDay&&(
        <WorkoutScreen allEx={allEx}           session={session}
          activeDay={activeDay}
          activeR={activeR}
          progress={progress}
          logSet={logSet}
          startTimer={startTimer}
          timer={timer}
          setSession={setSession}
          setCompletedDays={setCompletedDays}
          completedDays={completedDays}
          currentWeek={currentWeek}
          setCurrentWeek={setCurrentWeek}
          preSessionPRs={preSessionPRs}
          setResumenSesion={setResumenSesion}
          readOnly={readOnly}
          sharedParam={sharedParam}
          sb={sb}
          es={es}
          darkMode={darkMode}
          prCelebration={prCelebration}
          setPrCelebration={setPrCelebration} activeExIdx={activeExIdx} setActiveExIdx={setActiveExIdx}/>
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
        style={{padding:"12px 16px",overflowY:"auto",height:"calc(100vh - 130px)",paddingBottom:100,paddingTop:12,display:session&&activeDay?"none":"block"}}>
        {tab==="plan"&&esAlumno&&aliasData?.alias&&<PagoAlumno aliasData={aliasData} es={es} toast2={toast2}/>}
        {tab==="plan"&&(
          <div>
            {session&&activeDay&&esAlumno&&(()=>{
              const hoy = new Date().toLocaleDateString("es-AR");
              const exs = activeDay.exercises||[];
              const curEx = exs[activeExIdx]||exs[0];
              const curInfo = curEx ? allEx.find(e=>e.id===curEx.id) : null;
              const curPat = curInfo ? (PATS[curInfo.pattern]||{icon:"E",color:"#8B9AB2"}) : {icon:"E",color:"#8B9AB2"};
              const setsHoy = curEx ? (progress[curEx.id]?.sets||[]).filter(s=>s.date===hoy&&(s.week===undefined||s.week===currentWeek)) : [];
              const totalSets = curEx ? (parseInt(curEx.sets)||3) : 3;
              const targetReps = curEx ? (parseInt((curEx.reps||"8").toString().split(/[-x]/)[0])||8) : 8;
              const lastKg = setsHoy.length>0 ? setsHoy[0].kg : (progress[curEx?.id]?.sets?.[0]?.kg||parseFloat(curEx?.kg)||0);
              const isPR = lastKg > 0 && lastKg > (progress[curEx?.id]?.max||0);
              const nextEx = exs[activeExIdx+1];
              const nextInfo = nextEx ? allEx.find(e=>e.id===nextEx.id) : null;
              const allDone = exs.every(ex=>(progress[ex.id]?.sets||[]).filter(s=>s.date===hoy&&(s.week===undefined||s.week===currentWeek)).length >= (parseInt(ex.sets)||3));

              // kg y reps locales para quick-log inline
              // Usamos un truco: el estado de kg/reps se maneja por logModal
              // pero aqui lo hacemos directamente inline

              return (
                <div style={{minHeight:"calc(100vh - 280px)"}}>
                  <div style={{background:bgCard,borderRadius:20,padding:"20px 16px",marginBottom:12,border:"1px solid "+curPat.color+"33",boxShadow:"0 4px 24px "+curPat.color+"11"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                      <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:curPat.color,flexShrink:0,minHeight:60}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:800,color:curPat.color,letterSpacing:2,marginBottom:4,textTransform:"uppercase"}}>
                          {es?"EJERCICIO "+(activeExIdx+1)+" DE "+exs.length:"EXERCISE "+(activeExIdx+1)+" OF "+exs.length}
                        </div>
                        <div style={{fontSize:28,fontWeight:900,color:textMain,lineHeight:1.1,marginBottom:4}}>
                          {es?curInfo?.name:curInfo?.nameEn||curInfo?.name||curEx?.id}
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{fontSize:13,color:curPat.color,fontWeight:700}}>{es?curPat.label:curPat.labelEn}</span>
                          <span style={{fontSize:13,color:textMuted}}>·</span>
                          <span style={{fontSize:13,color:textMuted,fontWeight:500}}>{totalSets} sets × {targetReps} reps</span>
                          {curInfo?.youtube&&(
                            <a href={curInfo.youtube} target="_blank" rel="noreferrer"
                              style={{background:"#2563EB22",color:"#2563EB",border:"1px solid #243040",borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:700,textDecoration:"none"}}>
                              ▶ VIDEO
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    {progress[curEx?.id]?.max>0&&(
                      <div style={{background:bgSub,borderRadius:12,padding:"8px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontSize:13,color:textMuted,fontWeight:500}}><Ic name="award" size={14} color="#fbbf24"/> PR</div>
                        <div style={{fontSize:15,fontWeight:900,color:"#60A5FA"}}>{progress[curEx.id].max} kg</div>
                        <div style={{fontSize:13,color:textMuted,fontWeight:500}}>{es?"Último":"Last"}</div>
                        <div style={{fontSize:15,fontWeight:900,color:textMain}}>
                          {progress[curEx.id]?.sets?.[0]?.kg||"-"} kg × {progress[curEx.id]?.sets?.[0]?.reps||"-"}
                        </div>
                      </div>
                    )}
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:11,fontWeight:800,color:textMuted,letterSpacing:0.3,marginBottom:8,display:"flex",justifyContent:"space-between"}}>
                        <span>#</span><span>PESO (kg)</span><span>REPS</span><span></span>
                      </div>
                      {Array.from({length:totalSets},(_,si)=>{
                        const isDone = si < setsHoy.length;
                        const isActive = si === setsHoy.length;
                        const swKey = curEx.id+"-"+si;
                        const swX = swipeState[swKey]?.x||0;
                        const isSwiping = swipeState[swKey]?.swiping;
                        const THRESHOLD = 90;
                        const swProgress = Math.min(Math.abs(swX)/THRESHOLD,1);
                        return(
                          <div key={si} style={{
                            position:"relative",overflow:"hidden",
                            borderBottom:si<totalSets-1?"1px solid "+border:"none",
                            borderRadius:8,marginBottom:4,
                            animation:isDone?"rowComplete 0.6s ease both":"slideUpFade 0.3s ease both",
                            animationDelay:isDone?"0ms":(si*60)+"ms"
                          }}>
                            {!isDone&&isActive&&(
                              <div style={{
                                position:"absolute",inset:0,background:"#22C55E",
                                display:"flex",alignItems:"center",paddingLeft:16,
                                opacity:swProgress,borderRadius:8
                              }}>
                                <span style={{fontSize:22,color:"#fff",fontWeight:900}}>✓</span>
                                <span style={{fontSize:13,color:"rgba(255,255,255,0.9)",fontWeight:700,marginLeft:8}}>
                                  {swProgress>=1?(es?"¡Listo!":"Done!"):(es?"Completar set":"Complete set")}
                                </span>
                              </div>
                            )}
                            <div
                              style={{
                                display:"flex",alignItems:"center",justifyContent:"space-between",
                                padding:"8px 4px",
                                opacity:isDone?0.75:1,
                                transform:(!isDone&&isActive&&swX>0)?`translateX(${swX}px)`:"none",
                                transition:isSwiping?"none":"transform 0.25s cubic-bezier(.25,.46,.45,.94)",
                                background:bgCard,
                                userSelect:"none", touchAction:"pan-y"
                              }}
                              onTouchStart={(!isDone&&isActive)?(e)=>{
                                setSwipeState(p=>({...p,[swKey]:{x:0,swiping:true,startX:e.touches[0].clientX}}));
                              }:undefined}
                              onTouchMove={(!isDone&&isActive)?(e)=>{
                                const dx=e.touches[0].clientX-(swipeState[swKey]?.startX||e.touches[0].clientX);
                                if(dx>0) setSwipeState(p=>({...p,[swKey]:{...p[swKey],x:Math.min(dx,THRESHOLD*1.2)}}));
                              }:undefined}
                              onTouchEnd={(!isDone&&isActive)?(e)=>{
                                const dx=swipeState[swKey]?.x||0;
                                if(dx>=THRESHOLD){
                                  const kgInp=document.getElementById("kg-inp-"+activeExIdx);
                                  const rpInp=document.getElementById("rp-inp-"+activeExIdx);
                                  const kgVal=parseFloat(kgInp?.value)||lastKg||0;
                                  const rpVal=parseInt(rpInp?.value)||targetReps;
                                  if(kgVal>0){
                                    logSet(curEx.id,kgVal,rpVal,"",null);
                                    const pauseSec=parseInt(curEx?.pause)||90;
                                    if(pauseSec>0) startTimer(pauseSec,"#22C55E");
                                    const newCnt=setsHoy.length+1;
                                    if(newCnt>=totalSets&&activeExIdx+1<exs.length) setTimeout(()=>setActiveExIdx(activeExIdx+1),350);
                                  }
                                }
                                setSwipeState(p=>({...p,[swKey]:{x:0,swiping:false}}));
                              }:undefined}
                            >
                              <div style={{width:28,height:28,borderRadius:8,
                                background:isDone?"#22C55E20":isActive?"#22C55E18":bgSub,
                                border:"1px solid "+(isDone?"#22C55E44":isActive?"#22C55E44":"transparent"),
                                display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:isDone?16:13,fontWeight:900,
                                color:isDone?"#22C55E":isActive?"#22C55E":textMuted,
                                animation:isDone?"checkPop 0.4s cubic-bezier(.36,.07,.19,.97) both":undefined,
                                transition:"all .2s ease"}}>
                                {isDone?"✓":si+1}
                              </div>
                              <div style={{fontSize:18,fontWeight:900,color:isDone?textMuted:textMain,minWidth:60,textAlign:"center"}}>
                                {isDone?(setsHoy[totalSets-1-si]||setsHoy[si])?.kg||"-":(si===0?lastKg||"—":setsHoy[si-1]?.kg||"—")}
                              </div>
                              <div style={{fontSize:18,fontWeight:900,color:isDone?textMuted:textMain,minWidth:60,textAlign:"center"}}>
                                {isDone?(setsHoy[totalSets-1-si]||setsHoy[si])?.reps||"-":(targetReps)}
                              </div>
                              <div style={{fontSize:13,fontWeight:700,color:isDone?"#22C55E":isActive?"#22C55E":textMuted,minWidth:64,textAlign:"right"}}>
                                {isDone?es?"hecho ✓":"done ✓":isActive?es?"deslizá →":"swipe →":es?"pendiente":"pending"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {setsHoy.length < totalSets && (
                      <div style={{background:bgSub,borderRadius:16,padding:"16px",border:"1px solid "+curPat.color+"33"}}>
                        <div style={{fontSize:11,fontWeight:800,color:curPat.color,letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>
                          {es?"REGISTRAR SET "+(setsHoy.length+1):"LOG SET "+(setsHoy.length+1)}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                          <div style={{background:bgSub,borderRadius:12,padding:"8px 6px",textAlign:"center",border:"1px solid "+border}}>
                            <div style={{fontSize:11,fontWeight:800,color:textMuted,letterSpacing:0.3,marginBottom:8}}>PESO (KG)</div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                              <button className="hov" id={"kg-minus-"+activeExIdx}
                                style={{width:44,height:44,background:bgCard,border:"1px solid "+border,borderRadius:12,
                                  fontSize:22,fontWeight:900,color:textMain,cursor:"pointer",flexShrink:0,
                                  display:"flex",alignItems:"center",justifyContent:"center"}}
                                onClick={()=>{
                                  const el=document.getElementById("kg-inp-"+activeExIdx);
                                  if(el) el.value=String(Math.max(0,(parseFloat(el.value)||0)-2.5));
                                }}>−</button>
                              <input id={"kg-inp-"+activeExIdx}
                                type="number" defaultValue={lastKg||""}
                                placeholder={lastKg||"0"}
                                style={{...inp,textAlign:"center",fontSize:26,fontWeight:900,color:textMain,
                                  width:0,flex:1,height:44,padding:"0 2px",minWidth:0}}/>
                              <button className="hov" id={"kg-plus-"+activeExIdx}
                                style={{width:44,height:44,background:bgCard,border:"1px solid "+border,borderRadius:12,
                                  fontSize:22,fontWeight:900,color:textMain,cursor:"pointer",flexShrink:0,
                                  display:"flex",alignItems:"center",justifyContent:"center"}}
                                onClick={()=>{
                                  const el=document.getElementById("kg-inp-"+activeExIdx);
                                  if(el) el.value=String((parseFloat(el.value)||0)+2.5);
                                }}>+</button>
                            </div>
                          </div>
                          <div style={{background:bgSub,borderRadius:12,padding:"8px 6px",textAlign:"center",border:"1px solid "+border}}>
                            <div style={{fontSize:11,fontWeight:800,color:textMuted,letterSpacing:0.3,marginBottom:8}}>REPS</div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                              <button className="hov" id={"rp-minus-"+activeExIdx}
                                style={{width:44,height:44,background:bgCard,border:"1px solid "+border,borderRadius:12,
                                  fontSize:22,fontWeight:900,color:textMain,cursor:"pointer",flexShrink:0,
                                  display:"flex",alignItems:"center",justifyContent:"center"}}
                                onClick={()=>{
                                  const el=document.getElementById("rp-inp-"+activeExIdx);
                                  if(el) el.value=String(Math.max(1,(parseInt(el.value)||0)-1));
                                }}>−</button>
                              <input id={"rp-inp-"+activeExIdx}
                                type="number" defaultValue={targetReps}
                                style={{...inp,textAlign:"center",fontSize:26,fontWeight:900,color:textMain,
                                  width:0,flex:1,height:44,padding:"0 2px",minWidth:0}}/>
                              <button className="hov" id={"rp-plus-"+activeExIdx}
                                style={{width:44,height:44,background:bgCard,border:"1px solid "+border,borderRadius:12,
                                  fontSize:22,fontWeight:900,color:textMain,cursor:"pointer",flexShrink:0,
                                  display:"flex",alignItems:"center",justifyContent:"center"}}
                                onClick={()=>{
                                  const el=document.getElementById("rp-inp-"+activeExIdx);
                                  if(el) el.value=String((parseInt(el.value)||0)+1);
                                }}>+</button>
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                          {[targetReps-2,targetReps-1,targetReps,targetReps+1,targetReps+2].filter(n=>n>0).map(n=>(
                            <button key={n} className="hov"
                              style={{padding:"8px 12px",border:"1px solid "+(n===targetReps?curPat.color:border),
                                borderRadius:8,background:n===targetReps?curPat.color+"22":"transparent",
                                color:n===targetReps?curPat.color:textMuted,fontSize:15,fontWeight:800,
                                cursor:"pointer",fontFamily:"inherit"}}
                              onClick={()=>{
                                const inp=document.getElementById("rp-inp-"+activeExIdx);
                                if(inp) inp.value=String(n);
                              }}>{n}</button>
                          ))}
                        </div>
                                                <button className="hov"
                          style={{width:"100%",padding:"16px",
                            background:btnFlash?"#22C55E":(curPat.color==="#22C55E"?green:curPat.color),
                            color:"#fff",
                            borderRadius:12,fontSize:22,fontWeight:900,
                            cursor:"pointer",fontFamily:"inherit",letterSpacing:1,
                            transition:"background 0.2s ease, transform 0.15s ease",
                            animation:btnFlash?"successPulse 0.4s ease":"none",
                            boxShadow:btnFlash?"0 4px 20px rgba(34,197,94,0.5)":"0 4px 14px rgba(59,130,246,0.4)"}}                          onClick={()=>{
                            const kgInp = document.getElementById("kg-inp-"+activeExIdx);
                            const rpInp = document.getElementById("rp-inp-"+activeExIdx);
                            const kgVal = parseFloat(kgInp?.value)||0;
                            const rpVal = parseInt(rpInp?.value)||targetReps;
                            if(kgVal<=0){kgInp?.focus();return;}
                            // Flash del botón
                            setBtnFlash(true);
                            setTimeout(()=>setBtnFlash(false), 500);
                            logSet(curEx.id, kgVal, rpVal, "", null);
                            const newSetsCount = setsHoy.length + 1;
                            if(newSetsCount >= totalSets) {
                              const nextIdx = activeExIdx + 1;
                              if(nextIdx < exs.length) {
                                setTimeout(()=>setActiveExIdx(nextIdx), 350);
                              }
                            }
                            const pauseDefault = parseInt(curEx?.pause)||90;
                            if(pauseDefault>0) startTimer(pauseDefault, curPat.color);
                          }}>
                          {btnFlash?<Ic name="check-circle" size={18} color="#22C55E"/>:<Ic name="check-sm" size={18} color="currentColor"/>} {es?(btnFlash?"¡SET LISTO!":"REGISTRAR SET "+(setsHoy.length+1)):(btnFlash?"SET DONE!":"LOG SET "+(setsHoy.length+1))}
                        </button>
                      </div>
                    )}
                    {setsHoy.length >= totalSets && (
                      <div style={{background:"#22C55E12",border:"1px solid #22c55e33",borderRadius:12,padding:"16px",textAlign:"center"}}>
                        <div style={{fontSize:22,marginBottom:4}}><Ic name="check-circle" size={22} color="#22C55E"/></div>
                        <div style={{fontSize:15,fontWeight:900,color:"#22C55E"}}>{es?"¡Ejercicio completado!":"Exercise complete!"}</div>
                        {nextEx&&(
                          <button className="hov"
                            style={{marginTop:8,padding:"8px 20px",background:green,color:darkMode?"#fff":"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={()=>setActiveExIdx(activeExIdx+1)}>
                            {es?"→ Siguiente ejercicio":"→ Next exercise"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {timer&&(
                    <div style={{background:timer.remaining<10?"#2563EB18":"#22C55E18",border:"1px solid "+(timer.remaining<10?"#2563EB33":"#22C55E30"),borderRadius:16,padding:"16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{position:"relative",width:56,height:56,flexShrink:0}}>
                        <svg width="56" height="56" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
                          <circle cx="28" cy="28" r="24" fill="none" stroke={darkMode?"#2D4057":"#E2E8F0"} strokeWidth="4"/>
                          <circle cx="28" cy="28" r="24" fill="none"
                            stroke={timer.remaining<10?"#2563EB":"#22C55E"} strokeWidth="4"
                            strokeDasharray={`${2*Math.PI*24}`}
                            strokeDashoffset={`${2*Math.PI*24*(1-timer.remaining/timer.total)}`}
                            strokeLinecap="round"
                            style={{transition:"stroke-dashoffset 1s linear"}}/>
                        </svg>
                        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:timer.remaining<10?"#2563EB":"#22C55E"}}>
                          {timer.remaining}
                        </div>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:15,fontWeight:900,color:textMain}}>{es?"DESCANSANDO":"RESTING"}</div>
                        <div style={{fontSize:13,color:textMuted}}>{es?"El próximo set en":"Next set in"} {timer.remaining}s</div>
                      </div>
                      <button className="hov" onClick={()=>startTimer(0)}
                        style={{background:"transparent",border:"1px solid "+border,borderRadius:8,padding:"8px 14px",color:textMuted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        {es?"Saltar":"Skip"}
                      </button>
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    {activeExIdx>0&&(
                      <button className="hov" onClick={()=>setActiveExIdx(activeExIdx-1)}
                        style={{flex:1,padding:"8px",background:bgCard,border:"1px solid "+border,borderRadius:12,color:textMuted,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        ← {es?"Anterior":"Prev"}
                      </button>
                    )}
                    {activeExIdx<exs.length-1&&(
                      <button className="hov" onClick={()=>setActiveExIdx(activeExIdx+1)}
                        style={{flex:2,padding:"8px",background:bgCard,border:"1px solid "+border,borderRadius:12,color:textMain,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        {es?"Siguiente":"Next"} → {((es?nextInfo?.name:nextInfo?.nameEn||nextInfo?.name)||"").slice(0,18)}
                      </button>
                    )}
                  </div>
                  {nextEx&&(
                    <div style={{background:bgCard,borderRadius:12,padding:"12px 16px",border:"1px solid "+border,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{fontSize:11,fontWeight:800,color:textMuted,letterSpacing:0.3,minWidth:60}}>{es?"PRÓXIMO":"NEXT UP"}</div>
                      <div style={{width:1,height:30,background:border}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:15,fontWeight:800,color:textMain}}>{es?nextInfo?.name:nextInfo?.nameEn||nextInfo?.name}</div>
                        <div style={{fontSize:13,color:textMuted}}>{nextEx.sets}×{nextEx.reps} {nextEx.kg?("· "+nextEx.kg+"kg"):""}</div>
                      </div>
                      <div style={{fontSize:22}}>{PATS[nextInfo?.pattern]?.icon||"💪"}</div>
                    </div>
                  )}
                  {allDone&&(
                    <div style={{background:"#22C55E12",border:"1px solid #22c55e33",borderRadius:16,padding:"16px",textAlign:"center",marginTop:12}}>
                      <div style={{fontSize:36,marginBottom:8}}><Ic name="check-circle" size={40} color="#22C55E"/></div>
                      <div style={{fontSize:22,fontWeight:900,color:"#22C55E",marginBottom:4}}>{es?"¡Todos los ejercicios!":"All exercises done!"}</div>
                      <div style={{fontSize:15,color:textMuted,marginBottom:12}}>{es?"Finalizá el entrenamiento":"Finish your workout"}</div>
                    </div>
                  )}

                </div>
              );
            })()}

            {!esAlumno&&(
              <DashboardEntrenador sb={sb} routines={routines} alumnos={alumnos}
                sesiones={alumnoSesiones}
                es={es}
                darkMode={darkMode}
                progress={progress}
                session={session}
                pagosEstado={pagosEstado}
                togglePago={togglePago}
                onVerAlumno={(a)=>{setAlumnoActivo(a); setTab("alumnos");}}
                onChatAlumno={(a)=>{setAlumnoActivo(a); setTab("alumnos");}}
                onNotificar={(alumnoId, msg)=>notifyAlumno(alumnoId, msg).then(()=>toast2(es?"Notificación enviada":"Notification sent")).catch(()=>toast2("Error al notificar"))}
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
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:13,fontWeight:800,color:textMuted,letterSpacing:0.3}}>{es?"ESTA SEMANA":"THIS WEEK"}</span>
                      <span style={{fontSize:13,fontWeight:900,color:"#2563EB"}}>{daysCompletedThisWeek}/{totalDays} {es?"días":"days"}</span>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      {(r0?.days||[]).map((d,i)=>{
                        const done = completedDays.includes((r0?.id||"")+"-"+i+"-w"+currentWeek);
                        const isNext = i===nextDayIdx;
                        return (
                          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                            <div style={{width:"100%",height:7,borderRadius:4,background:done?"#22C55E":isNext?"#2563EB":border}}/>
                            <div style={{fontSize:11,fontWeight:700,color:done?"#22C55E":isNext?"#2563EB":textMuted,textTransform:"uppercase"}}>
                              {(d.label||("D"+(i+1))).slice(0,3)}
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
                      <div style={{fontSize:13,color:textMuted,marginBottom:12}}>{(todayDay.exercises||[]).length} {es?"ejercicios":"exercises"} · {r0?.name}</div>
                      <button className="hov" style={{width:"100%",padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontSize:18,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>{
                          const snap={};
                          [...(todayDay.warmup||[]),...(todayDay.exercises||[])].forEach(ex=>{snap[ex.id]=progress[ex.id]?.max||0;});
                          setPreSessionPRs({...snap});
                          setSession({rId:r0.id,dIdx:nextDayIdx,exIdx:0,startTime:Date.now()});
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
                            setSession({rId:r0.id,dIdx:nextDayIdx,exIdx:0,startTime:Date.now()});
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
              const diasJSX = r.days.map((d,di)=>{ return (
                <div key={di} style={{marginBottom:24}}>
                  <div style={{fontSize:18,fontWeight:700,letterSpacing:1,color:textMuted,marginBottom:8,paddingBottom:8,borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057")}}>
                    {es?"Dia ":"Day "}{di+1}
                  </div>
                  {(d.warmup||[]).length>0&&(
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",background:bgSub,border:"1px solid "+border,borderRadius:12,marginBottom:8,cursor:"pointer"}}
                        onClick={()=>setRoutines(p=>p.map(r2=>r2.id===r.id?{...r2,days:r2.days.map((dd,ddi)=>ddi===di?{...dd,showWarmup:!dd.showWarmup}:dd)}:r2))}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span>🔥</span>
                          <span style={{fontSize:15,fontWeight:800,color:textMain,letterSpacing:.5}}>{es?"ENTRADA EN CALOR":"WARM UP"}</span>
                          <span style={{fontSize:15,color:textMuted,fontWeight:700}}>({(d.warmup||[]).length} {es?"ejercicios":"exercises"})</span>
                        </div>
                        <span style={{fontSize:13,color:textMuted}}>{d.showWarmup?"▲":"▼"}</span>
                      </div>
                      <div>
                      {d.showWarmup&&(d.warmup||[]).map((ex,ei)=>{
                        const info=allEx.find(e=>e.id===ex.id);
                        const pat=PATS[info?.pattern]||PATS["core"]||Object.values(PATS)[0]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"};
                        return(
                          <div key={ei} style={{background:"#3B82F608",border:"1px solid "+border,borderRadius:12,padding:"8px 12px",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:"#8B9AB2",flexShrink:0,marginRight:4}}/>
                            <div style={{flex:1}}>
                              <div style={{fontSize:15,fontWeight:700}}>{es?info?.name:info?.nameEn||info?.name}</div>
                             {info?.youtube&&<a href={info.youtube} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,background:"#2563EB22",color:"#8B9AB2",border:"1px solid #243040",borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:700,textDecoration:"none",marginTop:4}}>▶ VER</a>}
                              {(()=>{
                                const weeks4=Array.from({length:4},(_,wi)=>(ex.weeks||[])[wi]||{});
                                const s0=ex.sets||"-"; const r0=ex.reps||"-";
                                return(
                                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:8}}>
                                    {weeks4.map((w,wi)=>{
                                      const active=wi===currentWeek;
                                      const s=w.sets||s0; const r=w.reps||r0;
                                      const kg2=w.kg||ex.kg||"";
                                      const metodo=ex.progresion||"manual";
                                      const pausa2=w.pausa||ex.pause||"";
                                      const filled=!!(w.sets||w.reps||w.kg);
                                      const objLabel = active ? (
                                        metodo==="carga"&&kg2 ? kg2+"kg" :
                                        metodo==="reps" ? (w.reps||ex.reps||"")+" reps" :
                                        metodo==="series" ? (w.sets||ex.sets||"")+" series" :
                                        metodo==="pausa"&&pausa2 ? pausa2+"s pausa" :
                                        null
                                      ) : null;
                                      return(
                                        <div key={wi} style={{background:active?"#2563EB":"#162234",borderRadius:12,padding:active?"12px 6px":"9px 5px",textAlign:"center",border:active?"2px solid #2563EB":filled?"1px solid #243040":"1px solid "+border,transition:"all .2s"}}>
                                          <div style={{fontSize:active?11:9,fontWeight:700,letterSpacing:1,color:active?"#FFFFFF":"#8B9AB2",marginBottom:active?6:4}}>{active?"→ ":" "}SEM {wi+1}</div>
                                          <div style={{fontSize:active?18:14,fontWeight:800,color:active?"#FFFFFF":filled?"#FFFFFF":"#8B9AB2"}}>{s}×{r}</div>
                                          {active&&objLabel?(<div style={{fontSize:14,fontWeight:800,color:"#FFFFFF",marginTop:4}}>{objLabel}</div>):(kg2?<div style={{fontSize:active?12:10,fontWeight:700,color:active?"#FFFFFF":"#8B9AB2",marginTop:4}}>{kg2}kg</div>:null)}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  )}
                  {d.exercises.length>0&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:bgSub,border:"1px solid "+border,borderRadius:12,marginBottom:8}}>
                      <span>💪</span>
                      <span style={{fontSize:15,fontWeight:800,color:textMain,letterSpacing:.5}}>{es?"BLOQUE PRINCIPAL":"MAIN BLOCK"}</span>
                      <span style={{fontSize:15,color:textMuted,fontWeight:700}}>({d.exercises.length} {es?"ejercicios":"exercises"})</span>
                    </div>
                  )}
                  {d.exercises.length===0&&(d.warmup||[]).length===0&&<div style={{color:"#8B9AB2",fontSize:15,padding:"8px 0"}}>Sin ejercicios</div>}
                  {d.exercises.map((ex,ei)=>{
                    const info=allEx.find(e=>e.id===ex.id);
                    const pat=PATS[info?.pattern]||PATS["core"]||Object.values(PATS)[0]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"};
                    const col="#2563EB"; // paleta fija - sin colores de patrón
                    const weeks=Array.from({length:4},(_,wi)=>(ex.weeks||[])[wi]||{});
                    return(
                      <div key={ei} style={{background:bgCard,border:"1px solid "+border,borderRadius:12,padding:"16px",marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                          <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:border,flexShrink:0,minHeight:54}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:28,fontWeight:800,color:textMain,letterSpacing:0.5}}>{es?info?.name:info?.nameEn||info?.name}</div>
                            {info?.youtube&&<a href={info.youtube} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,background:"#162234",color:"#8B9AB2",border:"1px solid #243040",borderRadius:6,padding:"4px 9px",fontSize:13,fontWeight:700,textDecoration:"none",marginTop:4}}>▶ VER VIDEO</a>}
                            <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                              {ex.kg&&<span style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:6,padding:"4px 8px",fontSize:15,fontWeight:700,color:textMain}}>{ex.kg} kg</span>}
                              {ex.pause&&<span style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:6,padding:"4px 8px",fontSize:15,color:textMuted}}>⏱ {fmtP(ex.pause)}</span>}
                            </div>
                          </div>
                          <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"Barlow Condensed,sans-serif",fontSize:18,fontWeight:700,cursor:"pointer",flexShrink:0}} onClick={()=>setLogModal({...info,...ex})}>Registrar</button>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                          {weeks.map((w,wi)=>{
                            const active=wi===currentWeek;
                            const s=w.sets||ex.sets||"-";
                            const rp=w.reps||ex.reps||"-";
                            const kg2=w.kg||ex.kg||"";
                            const metodo=ex.progresion||"manual";
                            const pausa2=w.pausa||ex.pause||"";
                            const filled=w.sets||w.reps||w.kg;
                            const objLabel = active ? (
                              metodo==="carga"&&kg2 ? kg2+"kg" :
                              metodo==="reps" ? (w.reps||ex.reps||"")+" reps" :
                              metodo==="series" ? (w.sets||ex.sets||"")+" series" :
                              metodo==="pausa"&&pausa2 ? pausa2+"s pausa" :
                              null
                            ) : null;
                            return(
                              <div key={wi} style={{background:active?"#2563EB":"#162234",borderRadius:12,padding:active?"12px 6px":"9px 5px",textAlign:"center",border:active?"2px solid #2563EB":filled?"1px solid #243040":"1px solid "+border,transition:"all .2s"}}>
                                <div style={{fontSize:active?11:9,fontWeight:700,letterSpacing:1,color:active?"#FFFFFF":filled?"#8B9AB2":"#8B9AB2",marginBottom:active?6:4}}>{active?"→ ":""}SEM {wi+1}</div>
                                <div style={{fontSize:active?18:14,fontWeight:800,color:active?"#FFFFFF":filled?"#FFFFFF":"#8B9AB2"}}>{s}x{rp}</div>
                                {active&&objLabel?(<div style={{fontSize:15,fontWeight:800,color:"#FFFFFF",marginTop:4}}>{objLabel}</div>):(kg2?<div style={{fontSize:active?14:12,fontWeight:700,color:active?"#FFFFFF":"#8B9AB2",marginTop:4}}>{kg2}kg</div>:null)}
                                {w.note&&<div style={{fontSize:11,color:active?"#8B9AB2":"#8B9AB2",marginTop:4,lineHeight:1.2}}>{w.note}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {(()=>{
                    const dayKey=r.id+"-"+di+"-w"+currentWeek;
                    const isDayDone=completedDays.includes(dayKey);
                    // Calcular nextDayIdx localmente para esta rutina r
                    const daysCompletedR=completedDays.filter(k=>k.startsWith(r.id+"-")&&k.endsWith("-w"+currentWeek)).length;
                    const localNextDayIdx=daysCompletedR < r.days.length ? daysCompletedR : null;
                    const isNextDay=di===localNextDayIdx;
                    const isFuture=localNextDayIdx!==null&&di>localNextDayIdx;
                    if(isDayDone) return(
                      <div style={{textAlign:"center",padding:"8px",color:"#22C55E",fontSize:15,fontWeight:700}}>
                        ✅ {es?"Día completado esta semana":"Day completed this week"}
                      </div>
                    );
                    if(isNextDay) return(
                      <button className="hov" style={{...btn("#2563EB"),color:"#fff",width:"100%",marginTop:4,padding:"12px",fontSize:15,fontWeight:900,letterSpacing:1}} onClick={()=>{
                        const snap={};
                        [...(r.days[di]?.warmup||[]),...(r.days[di]?.exercises||[])].forEach(ex=>{snap[ex.id]=progress[ex.id]?.max||0;});
                        setPreSessionPRs({...snap});
                        setSession({rId:r.id,dIdx:di,exIdx:0,startTime:Date.now()});
                      }}>⚡ {es?"INICIAR ENTRENAMIENTO":"START WORKOUT"}</button>
                    );
                    if(isFuture) return(
                      <div style={{textAlign:"center",padding:"8px",color:textMuted,fontSize:13,fontWeight:700,background:bgSub,borderRadius:12,marginTop:4}}>
                        <Ic name="lock" size={14}/> {es?`Completá el Día ${localNextDayIdx+1} primero`:`Complete Day ${localNextDayIdx+1} first`}
                      </div>
                    );
                    return null;
                  })()}
                </div>
              );
              });
              return (<div key={r.id} style={{marginBottom:16}}>
                  <div style={{fontSize:28,fontWeight:800,letterSpacing:1,marginBottom:4}}>{r.name}</div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{fontSize:15,color:textMuted}}>{r.created} · {r.days.length} {es?es?"dias":"days":"days"}{r.note?" · "+r.note:""}</div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",border:"1px solid "+border,color:textMain,borderRadius:8,padding:"8px 12px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}} onClick={()=>generatePDF(r)}>
                        <Ic name="file-text" size={14}/> PDF
                      </button>
                    </div>
                  <div>{diasJSX}</div>
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
                  const setsAlu = Object.values(a.progress||{})
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
            {esAlumno && <LibraryAlumno allEx={allEx} darkMode={darkMode} es={es}/>}
            {!esAlumno && <GestionBiblioteca darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} es={es} setTab={setTab}/>}
          </div>
        )}
        {tab==="routines"&&!esAlumno&&(
          <div>
            <button className="hov" onClick={()=>setTab("scanner")}
              style={{width:"100%",marginBottom:12,padding:"8px 16px",
                background:"transparent",border:"1px solid "+border,
                borderRadius:12,color:textMuted,fontSize:15,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",display:"flex",
                alignItems:"center",justifyContent:"center",gap:8}}>
              <Ic name="camera" size={16}/> {es?"Escanear rutina existente":"Scan existing routine"}
            </button>
            <div style={{overflowX:"auto",paddingBottom:8,marginBottom:12}}>
              <div style={{display:"flex",gap:8,width:"max-content"}}>
                {["todas","app","scan"].map(f=>(
                  <button key={f} className="hov" onClick={()=>setFiltroRut&&setFiltroRut(f)} style={{padding:"8px 16px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer",border:"1px solid",fontFamily:"Barlow Condensed,sans-serif",background:bgCard,borderColor:"#2D4057",color:textMuted}}>
                    {f==="todas"?"TODAS":f==="app"?"✏️ APP":"📷 ESCANEADAS"}
                  </button>
                ))}
              </div>
            </div>
            <button className="hov" style={{...btn("#2563EB"),width:"100%",marginBottom:12,padding:"8px",fontSize:18}} onClick={()=>setNewR({name:"",numDays:3,days:Array.from({length:3},(_,i)=>({label:"Dia "+(i+1),warmup:[],exercises:[],showWarmup:false,showMain:true})),note:""})}>
              {es?"+ NUEVA RUTINA":"+ NEW ROUTINE"}
            </button>
            {routines.map(r=>{
              const daysJSX = !r.collapsed ? r.days.map((d,di)=>{
                const moveEx = (bloque, fromIdx, toIdx) => {
                  setRoutines(p=>p.map(rr=>rr.id===r.id?{...rr,days:rr.days.map((dd,ddi)=>{
                    if(ddi!==di) return dd;
                    const arr=[...(dd[bloque]||[])];
                    const [item]=arr.splice(fromIdx,1);
                    arr.splice(toIdx,0,item);
                    return {...dd,[bloque]:arr};
                  })}:rr));
                };
                const renderExList = (exList, bloque) => exList.map((ex,ei)=>{
                  const info=allEx.find(e=>e.id===ex.id);
                  const pat=PATS[info?.pattern]||PATS["core"]||Object.values(PATS)[0]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"};
                  const removeEx = () => setRoutines(p=>p.map(rr=>rr.id===r.id?{...rr,days:rr.days.map((dd,ddi)=>ddi===di?{...dd,[bloque]:dd[bloque].filter((_,eei)=>eei!==ei)}:dd)}:rr));
                  const canUp = ei>0;
                  const canDown = ei<exList.length-1;
                  return(
                    <div key={ei} style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:12,padding:"16px 18px",marginBottom:4,border:"1px solid "+border}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
                          <button className="hov" style={{background:canUp?"#2D4057":"#162234",border:"none",borderRadius:4,padding:"2px 5px",fontSize:11,color:canUp?"#8B9AB2":"#2D4057",cursor:canUp?"pointer":"default",lineHeight:1}} onClick={()=>canUp&&moveEx(bloque,ei,ei-1)}>▲</button>
                          <button className="hov" style={{background:canDown?"#2D4057":"#162234",border:"none",borderRadius:4,padding:"2px 5px",fontSize:11,color:canDown?"#8B9AB2":"#2D4057",cursor:canDown?"pointer":"default",lineHeight:1}} onClick={()=>canDown&&moveEx(bloque,ei,ei+1)}>▼</button>
                        </div>
                        <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:border,flexShrink:0,minHeight:32}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:22,fontWeight:900,color:textMain,lineHeight:1.2}}>{es?info?.name:info?.nameEn||info?.name}</div>
                          {(ex.sets||ex.reps)&&(
                            <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                              {(ex.sets||ex.reps) ? (
                                <span style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:800,letterSpacing:0.5}}>
                                  {ex.sets||"—"}×{ex.reps||"—"}
                                </span>
                              ) : (
                                <span style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700}}>
                                  {es?"Sin series":"No sets"}
                                </span>
                              )}
                              {ex.kg&&(
                                <span style={{background:bgSub,color:textMuted,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700}}>
                                  {ex.kg}kg
                                </span>
                              )}
                              {ex.pause&&parseInt(ex.pause)>0&&(
                                <span style={{background:bgSub,color:textMuted,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700}}>
                                  ⏱{fmtP(ex.pause)}
                                </span>
                              )}
                              {ex.progresion&&ex.progresion!=="manual"&&(
                                <span style={{
                                  background:ex.progresion==="carga"?"#1a3a5c":ex.progresion==="reps"?"#0c2a1a":ex.progresion==="series"?"#1e1040":"#2a1f0a",
                                  color:ex.progresion==="carga"?"#60a5fa":ex.progresion==="reps"?"#4ade80":ex.progresion==="series"?"#a78bfa":"#fbbf24",
                                  borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:700,border:"none"
                                }}>
                                  {ex.progresion==="carga"?"↑ CARGA":ex.progresion==="reps"?"↑ REPS":ex.progresion==="series"?"↑ SERIES":"↓ PAUSA"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",border:"none",borderRadius:8,padding:"4px 8px",fontSize:13,color:textMuted,cursor:"pointer"}} onClick={()=>setEditEx({rId:r.id,dIdx:di,eIdx:ei,bloque,ex:{...ex}})}><Ic name="edit-2" size={15}/></button>
                        <button className="hov" style={{background:"#2563EB22",border:"none",borderRadius:6,padding:"4px 9px",fontSize:13,color:"#2563EB",cursor:"pointer",fontWeight:700}} onClick={removeEx}><Ic name="trash-2" size={15}/></button>
                      </div>
                      {info?.youtube&&(
                        <div style={{paddingLeft:40,marginTop:4}}>
                          <a href={info.youtube} target="_blank" rel="noreferrer"
                            style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700,textDecoration:"none"}}>
                            ▶ VIDEO
                          </a>
                        </div>
                      )}
                      {(ex.weeks||[]).length>0&&(
                        <div style={{marginTop:8,paddingLeft:34}}>
                          <div style={{display:"flex",gap:4,overflowX:"auto"}}>
                            {ex.weeks.map((w,wi)=>{
                              const prev = wi>0?ex.weeks[wi-1]:null;
                              const m = ex.progresion||"manual";
                              let delta = null;
                              if(prev&&m==="carga"&&w.kg&&prev.kg) delta=(parseFloat(w.kg)-parseFloat(prev.kg)>0?"+":"")+Math.round((parseFloat(w.kg)-parseFloat(prev.kg))*10)/10+"kg";
                              if(prev&&m==="reps"&&w.reps&&prev.reps) delta=(parseInt(w.reps)-parseInt(prev.reps)>0?"+":"")+(parseInt(w.reps)-parseInt(prev.reps))+"r";
                              if(prev&&m==="series"&&w.sets&&prev.sets) delta=(parseInt(w.sets)-parseInt(prev.sets)>0?"+":"")+(parseInt(w.sets)-parseInt(prev.sets))+"s";
                              if(prev&&m==="pausa"&&w.pausa&&prev.pausa) delta=(parseInt(w.pausa)-parseInt(prev.pausa)>0?"+":"")+(parseInt(w.pausa)-parseInt(prev.pausa))+"s";
                              return(
                                <div key={wi} style={{background:bgSub,borderRadius:8,padding:"8px 8px",fontSize:12,color:textMuted,flexShrink:0,minWidth:56,textAlign:"center",border:"1px solid "+border}}>
                                  <div style={{fontWeight:700,color:textMain,marginBottom:2}}>S{wi+1}</div>
                                  <div style={{fontSize:11}}>{w.sets||ex.sets||"—"}×{w.reps||ex.reps||"—"}</div>
                                  {(w.kg||ex.kg)&&<div style={{fontSize:11,color:"#60a5fa"}}>{w.kg||ex.kg}kg</div>}
                                  {w.pausa&&<div style={{fontSize:10,color:textMuted}}>⏱{w.pausa}s</div>}
                                  {delta&&<div style={{fontSize:10,color:"#4ade80",fontWeight:700,marginTop:2}}>{delta}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
                const toggleBlock = (blk) => setRoutines(p=>p.map(rr=>rr.id===r.id?{...rr,days:rr.days.map((dd,ddi)=>ddi===di?{...dd,[blk]:!dd[blk]}:dd)}:rr));
                const hasWarmup = (d.warmup||[]).length>0;
                return(
                <div key={di+"-"+d.exercises.length+"-"+(d.warmup||[]).length} style={{borderLeft:"2px solid #1a1d2e",paddingLeft:8,marginBottom:8}}>
                  <div style={{fontSize:22,fontWeight:700,color:textMuted,marginBottom:8,letterSpacing:1}}>{es?"DIA ":"DAY "}{di+1}</div>
                  <div style={{marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:hasWarmup||d.showWarmup?6:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:15}}>🔥</span>
                        <span style={{fontSize:15,fontWeight:800,color:textMain,letterSpacing:.5}}>{es?"ENTRADA EN CALOR":"WARM UP"}</span>
                        {hasWarmup&&<span style={{fontSize:15,color:textMuted,fontWeight:700}}>({(d.warmup||[]).length})</span>}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button className="hov" style={{...btn("#2563EB22"),color:"#8B9AB2",fontSize:13,padding:"4px 9px"}} onClick={()=>{setAddExModal({rId:r.id,dIdx:di,bloque:"warmup"});setAddExSearch("");setAddExPat(null);}}>+ add</button>
                        {hasWarmup&&<button className="hov" style={{...btn(),fontSize:13,padding:"4px 9px",background:darkMode?"#162234":"#E2E8F0",color:textMuted}} onClick={()=>toggleBlock("showWarmup")}>{d.showWarmup?"▲":"▼"}</button>}
                      </div>
                    </div>
                    {(d.showWarmup||false)&&hasWarmup&&renderExList(d.warmup||[],"warmup")}
                    {!hasWarmup&&<div style={{fontSize:13,color:"#8B9AB2",padding:"8px 0"}}>Sin ejercicios - tocá + add para agregar</div>}
                  </div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:15}}>💪</span>
                        <span style={{fontSize:15,fontWeight:800,color:textMain,letterSpacing:.5}}>{es?"BLOQUE PRINCIPAL":"MAIN BLOCK"}</span>
                        <span style={{fontSize:15,color:textMuted,fontWeight:700}}>({d.exercises.length})</span>
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button className="hov" style={{...btn("#22C55E20"),color:"#22C55E",fontSize:13,padding:"4px 9px"}} onClick={()=>{setAddExModal({rId:r.id,dIdx:di,bloque:"exercises"});setAddExSearch("");setAddExPat(null);}}>+ add</button>
                        {d.exercises.length>0&&<button className="hov" style={{...btn(),fontSize:13,padding:"4px 9px",background:darkMode?"#162234":"#E2E8F0",color:textMuted}} onClick={()=>toggleBlock("showMain")}>{d.showMain!==false?"▲":"▼"}</button>}
                      </div>
                    </div>
                    {d.showMain!==false&&renderExList(d.exercises,"exercises")}
                    {d.exercises.length===0&&<div style={{fontSize:13,color:"#8B9AB2",padding:"8px 0"}}>Sin ejercicios - tocá + add para agregar</div>}
                  </div>
                </div>
                );
              }) : null;
              return (<div key={r.id} style={card}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div style={{fontSize:28,fontWeight:800}}>{r.name}</div>
                      {r.scanned&&<span style={{background:"#2563EB22",color:"#2563EB",border:"1px solid #60a5fa33",borderRadius:6,padding:"1px 7px",fontSize:11,fontWeight:700}}>📷 Escaneada</span>}
                    </div>
                    {r.alumno&&<div style={{fontSize:15,fontWeight:700,color:textMuted,marginTop:4}}>👤 {r.alumno}</div>}
                    <div style={{fontSize:18,color:textMuted,fontWeight:700}}>{r.days.length} {es?"dias":"days"}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",border:"none",borderRadius:8,padding:"8px 12px",fontSize:13,fontWeight:500,color:textMuted,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setRoutines(p=>p.map(rr=>rr.id===r.id?{...rr,collapsed:!rr.collapsed}:rr))}>
                      {r.collapsed?("▼ "+(es?"VER":"VIEW")):("▲ "+(es?"CERRAR":"CLOSE"))}
                    </button>
                    <button className="hov" style={{background:"#2563EB22",color:"#2563EB",border:"none",borderRadius:8,padding:"8px 12px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setRoutines(p=>p.filter(x=>x.id!==r.id));toast2((es?"Rutina eliminada":"Routine deleted")+" ✓");}}><Ic name="trash-2" size={15}/></button>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                  <select style={{flex:1,minWidth:120}} value={r.alumno_id||""} onChange={e=>{
                    const v=e.target.value;
                    setRoutines(p=>p.map(rr=>rr.id===r.id?{...rr,alumno_id:v,alumno:alumnos.find(a=>a.id===v)?.nombre||""}:rr));
                  }}>
                    <option value="">👤 Sin asignar</option>
                    {alumnos.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                  <button className="hov" style={{...btn(),padding:"8px 14px",fontSize:15,fontWeight:700}} onClick={async()=>{
                    try{
                      // Leer siempre la versión más reciente del estado para evitar closures viejos
                      const rActual = routines.find(x=>x.id===r.id)||r;
                      const payload={nombre:rActual.name,alumno_id:rActual.alumno_id||null,datos:{days:rActual.days,alumno:rActual.alumno||"",note:rActual.note||""},entrenador_id:"entrenador_principal"};
                      if(rActual.saved){
                        await sb.updateRutina(rActual.id,payload);
                      } else {
                        await sb.createRutina({...payload,id:rActual.id});
                        setRoutines(p=>p.map(rr=>rr.id===rActual.id?{...rr,saved:true}:rr));
                      }
                      toast2(es?"Rutina guardada ✓":"Routine saved ✓");
                    }catch(e){toast2("Error al guardar");}
                  }}><Ic name="save" size={15}/> {es?"Guardar":"Save"}</button>
                </div>
                {daysJSX}
              </div>
              );
            })}
          </div>
        )}
        {tab==="scanner"&&!esAlumno&&(
          <div>
            <ScannerRutina darkMode={darkMode} sb={sb} setRoutines={setRoutines} alumnos={alumnos} toast2={toast2} es={es} setTab={setTab} user={user} customEx={customEx}/>
          </div>
        )}
        {tab==="biblioteca"&&!esAlumno&&(
          <div>
            <GestionBiblioteca darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} es={es} setTab={setTab}/>
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
            <GestionBiblioteca darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} es={es} setTab={setTab}/>
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
            <GestionBiblioteca darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} es={es} setTab={setTab}/>
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
                      <div key={i} style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:6,padding:"4px 8px",flexShrink:0,fontSize:13}}>
                        <div style={{fontWeight:700}}>{s2.kg}kg x {s2.reps}</div>
                        <div style={{color:textMuted,fontSize:13}}>{s2.date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
                <button className="hov" style={{background:"#162234",color:textMuted,border:"1px solid "+border,borderRadius:8,padding:"8px 8px",fontSize:13,cursor:"pointer"}} onClick={()=>setAliasModal(true)}>💰</button>
                <button className="hov" style={{background:"#162234",color:textMuted,border:"1px solid "+border,borderRadius:8,padding:"8px 8px",fontSize:13,cursor:"pointer"}} onClick={cargarAlumnos}>↺</button>
                <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setNewAlumnoForm(true)}>+ {es?"Nuevo":"New"}</button>
              </div>
            </div>

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
                  <div key={i} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid "+border}}>
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
                <div style={{fontSize:36,marginBottom:8}}>👥</div>
                <div style={{fontSize:15,fontWeight:700}}>{es?"Sin alumnos aún":"No athletes yet"}</div>
              </div>
            )}

            {alumnos.map(a=>(
              <div key={a.id} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:alumnoActivo?.id===a.id?"1px solid #2563EB":"1px solid "+border}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:alumnoActivo?.id===a.id?8:0}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:textMain}}>{a.nombre}</div>
                    <div style={{fontSize:13,color:textMuted,lineHeight:1.5,marginTop:4}}>{a.email}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="hov" style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:8,padding:"4px 8px",fontSize:13,cursor:"pointer"}} onClick={()=>{setEditAlumnoModal(a);setEditAlumnoEmail(a.email);setEditAlumnoPass("");}}>✏️</button>
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
                            {dias.map((d,di)=>(
                              <div key={di} style={{background:bgSub,borderRadius:12,padding:"8px 12px",marginBottom:8,marginTop:8,border:"1px solid "+border}}>
                                <div style={{fontSize:11,fontWeight:800,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{d.label||("Día "+(di+1))} · {(d.exercises||[]).length} ej.</div>
                                {(d.exercises||[]).map((ex,ei)=>{
                                  const exInfo=allEx.find(e=>e.id===ex.id);
                                  return <div key={ei} style={{display:"flex",gap:8,padding:"4px 0",borderBottom:ei<(d.exercises||[]).length-1?"1px solid "+border:"none"}}>
                                    <div style={{width:3,height:16,borderRadius:2,background:border,flexShrink:0,marginTop:4}}/>
                                    <div style={{flex:1,fontSize:15,fontWeight:700,color:textMain}}>{es?exInfo?.name:exInfo?.nameEn||exInfo?.name||ex.id}</div>
                                    <div style={{fontSize:11,color:textMuted}}>{ex.sets}×{ex.reps}</div>
                                  </div>;
                                })}
                              </div>
                            ))}
                            <div style={{display:"flex",gap:8,marginTop:8}}>
                              <button className="hov" style={{flex:2,padding:"8px",background:bgSub,border:"1px solid "+border,borderRadius:12,fontSize:15,fontWeight:800,color:textMuted,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{const rutina={id:rutinaActiva.id,...(rutinaActiva.datos||{}),name:rutinaActiva.nombre,saved:true,alumno_id:a.id,alumno:a.nombre};setRoutines(prev=>{const ex=prev.find(x=>x.id===rutinaActiva.id);return ex?prev.map(x=>x.id===rutinaActiva.id?rutina:x):[rutina,...prev]});setTab("routines");toast2(es?"Abierta en RUTINAS":"Opened in ROUTINES");}}>✏️ {es?"Editar":"Edit"}</button>
                              <button className="hov" style={{padding:"8px 16px",background:bgSub,border:"1px solid "+border,borderRadius:12,fontSize:15,fontWeight:800,color:textMuted,cursor:"pointer",fontFamily:"inherit"}} onClick={async()=>{if(!confirm(es?"¿Quitar rutina?":"Remove?")) return;await sb.deleteRutina(rutinaActiva.id);setRutinasSB(prev=>prev.filter(x=>x.id!==rutinaActiva.id));toast2(es?"Quitada":"Removed");}}><Ic name="trash-2" size={15}/></button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <button className="hov" style={{background:"#162234",color:textMuted,border:"1px solid "+border,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}} onClick={async()=>{
                      const rutinaLocal=routines[0];if(!rutinaLocal){toast2("Creá una rutina en RUTINAS");return;}
                      const ex=rutinasSB.find(r=>r.alumno_id===a.id);
                      if(ex&&!confirm((es?"Ya tiene: ":"Has: ")+ex.nombre+(es?"\n¿Reemplazar?":"\nReplace?"))) return;
                      if(ex){await sb.deleteRutina(ex.id);setRutinasSB(prev=>prev.filter(x=>x.id!==ex.id));}
                      setLoadingSB(true);
                      const res=await sb.createRutina({alumno_id:a.id,entrenador_id:ENTRENADOR_ID,nombre:rutinaLocal.name||"Rutina",datos:{days:rutinaLocal.days,alumno:rutinaLocal.alumno||"",note:rutinaLocal.note||""},fecha_inicio:new Date().toLocaleDateString("es-AR")});
                      if(res&&res[0]){setRutinasSB(prev=>[...prev,res[0]]);toast2("Rutina asignada ✓");}else{toast2("Error");}
                      setLoadingSB(false);
                    }}>{es?"+ Asignar rutina actual":"+ Assign current routine"}</button>
                    {alumnoSesiones.length>0&&alumnoSesiones.slice(0,3).map((s,i)=>(
                      <div key={i} style={{background:bgSub,borderRadius:8,padding:"8px 10px",marginBottom:4,display:"flex",justifyContent:"space-between"}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#22C55E"}}>✅ {s.dia_label}</div>
                        <div style={{fontSize:11,color:textMuted}}>{s.fecha}</div>
                      </div>
                    ))}
                    <div style={{marginTop:12,borderTop:"1px solid "+border,paddingTop:12}}>
                      <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,
                        textTransform:"uppercase",marginBottom:8}}>
                        📌 {es?"Nota del día":"Daily note"}
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
        <ChatFlotante darkMode={darkMode} alumnoId={sessionData?.alumnoId||(sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null)} alumnoNombre={sessionData?.name||"Alumno"} sb={sb} esEntrenador={false}/>
      )}
      {false&&session&&activeDay&&(
        <div style={{
          position:"fixed",top:0,left:0,right:0,zIndex:95,
          background:darkMode?"rgba(30,41,59,0.97)":"rgba(240,240,240,0.97)",
          backdropFilter:"blur(12px)",
          borderBottom:"2px solid #3B82F6",
          padding:"8px 16px",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:"#2563EB",letterSpacing:2,textTransform:"uppercase"}}>
                {es?"ENTRENANDO":"TRAINING"}
              </div>
              <div style={{fontSize:18,fontWeight:900,color:textMain,letterSpacing:0.5}}>
                {activeR?.name} — {activeDay.label||("Dia "+(session.dIdx+1))}
              </div>
            </div>
            <div style={{textAlign:"center",padding:"4px 8px",background:"#2563EB22",borderRadius:20,border:"1px solid #243040"}}>
              <div style={{fontSize:15,fontWeight:900,color:"#2563EB"}}>
                {(()=>{
                  const done = activeDay.exercises.filter((ex,i)=>{
                    const hoy=new Date().toLocaleDateString("es-AR");
                    return (progress[ex.id]?.sets||[]).some(s=>s.date===hoy);
                  }).length;
                  return done+"/"+activeDay.exercises.length;
                })()}
              </div>
              <div style={{fontSize:11,color:"#2563EB",fontWeight:700}}>{es?"EJERC":"EXER"}</div>
            </div>
            <button className="hov"
              style={{background:"transparent",border:"1px solid "+border,borderRadius:8,padding:"8px 8px",color:textMuted,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}
              onClick={()=>{
              if(window.confirm(es?"¿Salir del entrenamiento?":"Exit workout?")) setSession(null);
            }}><Ic name="x" size={16}/></button>
          </div>
          <div>
          {(()=>{
            const total = activeDay.exercises.length;
            const hoy = new Date().toLocaleDateString("es-AR");
            const done = activeDay.exercises.filter(ex=>(progress[ex.id]?.sets||[]).some(s=>s.date===hoy)).length;
            const pct = total>0 ? (done/total)*100 : 0;
            return (
              <div style={{height:4,background:darkMode?"#2D4057":"#E2E8F0",borderRadius:2,marginBottom:8,overflow:"hidden"}}>
                <div style={{height:"100%",width:pct+"%",background:"#2563EB",borderRadius:2,transition:"width .4s ease"}}/>
              </div>
            );
          })()}
          </div>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
            {activeDay.exercises.map((ex,i)=>{
              const hoy=new Date().toLocaleDateString("es-AR");
              const setsHoy=(progress[ex.id]?.sets||[]).filter(s=>s.date===hoy).length;
              const totalSets=parseInt(ex.sets)||3;
              const done=setsHoy>=totalSets;
              const active=i===activeExIdx;
              return(
                <div key={i} onClick={()=>setActiveExIdx(i)}
                  style={{
                    flexShrink:0,width:active?28:10,height:10,
                    borderRadius:6,cursor:"pointer",
                    transition:"all .3s ease",
                    background:done?"#22C55E":active?"#2563EB":(darkMode?"#2D4057":"#2D4057"),
                  }}/>
              );
            })}
          </div>
          <button className="hov" style={{
            width:"100%",marginTop:8,padding:"8px",
            background:"#2563EB",color:"#fff",border:"none",
            borderRadius:12,fontSize:15,fontWeight:900,
            cursor:"pointer",fontFamily:"inherit",letterSpacing:1
          }}
          onClick={()=>{
              const r=activeR;
              const dayKey=session.rId+"-"+session.dIdx+"-w"+currentWeek;
              const newCompleted=completedDays.includes(dayKey)?completedDays:[...completedDays,dayKey];
              const totalDays=r?r.days.length:1;
              const daysThisWeek=newCompleted.filter(k=>k.startsWith(session.rId+"-")&&k.endsWith("-w"+currentWeek)).length;
              setCompletedDays(newCompleted);
              const durMin=Math.round((Date.now()-(session.startTime||Date.now()))/60000)||1;
              const exsCompleted=[...(activeDay.warmup||[]),...(activeDay.exercises||[])];
              const hoyFin=new Date().toLocaleDateString("es-AR");
              const volTotal=exsCompleted.reduce((acc,ex)=>{
                const setsHoy=(progress[ex.id]?.sets||[]).filter(s=>s.date===hoyFin);
                return acc+setsHoy.reduce((a,s)=>a+(s.kg||0)*(s.reps||0),0);
              },0);
              const prsNuevos=exsCompleted.filter(ex=>{
                const pg=progress[ex.id];
                if(!pg) return false;
                const setsHoy=(pg.sets||[]).filter(s=>s.date===hoyFin);
                if(setsHoy.length===0) return false;
                const maxHoy=Math.max(...setsHoy.map(s=>s.kg||0));
                const maxAntes=preSessionPRs[ex.id]||0;
                // Solo PR si habia registro previo Y supero el maximo
                return maxAntes>0 && maxHoy>maxAntes;
              }).length;
              setResumenSesion({durMin,ejercicios:exsCompleted.length,totalSets:exsCompleted.reduce((a,e)=>a+(parseInt(e.sets)||3),0),volTotal:Math.round(volTotal),prsNuevos,diaLabel:activeDay.label||("Dia "+(session.dIdx+1)),rutinaName:r?.name||"Entrenamiento",fecha:new Date().toLocaleDateString("es-AR")});
              setSession(null);
              if(readOnly&&sharedParam){try{const rutData=JSON.parse(atob(sharedParam));const alumnoId=rutData.alumnoId;if(alumnoId){sb.addSesion({alumno_id:alumnoId,rutina_nombre:r?.name||"",dia_label:activeDay.label||("Dia "+(session.dIdx+1)),dia_idx:session.dIdx,semana:currentWeek+1,ejercicios:exsCompleted.map(e=>e.id).join(","),fecha:new Date().toLocaleDateString("es-AR"),hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})});}}catch(e){}}
              // Avanzar SIEMPRE a la semana siguiente al terminar cada sesión
              if(currentWeek < 3){
                setCurrentWeek(currentWeek + 1);
                toast2((es?"Sesión lista! Arrancás semana":"Session done! Starting week ")+(currentWeek+2)+" 💪");
              } else {
                toast2(es?"Semana 4 terminada! Ciclo completo 🏆":"Week 4 done! Cycle complete 🏆");
              }
            }}>
          ✅ {es?"FINALIZAR ENTRENAMIENTO":"FINISH WORKOUT"}
          </button>
        </div>
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
                  <div key={i} style={{height:4,borderRadius:2,transition:"all .35s ease",
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
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,opacity:item.done?0.6:1}}>
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
        <div style={{
          position:"fixed",inset:0,zIndex:500,
          display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,0.85)",
          animation:"fadeIn .2s ease"
        }}>
          <div style={{
            textAlign:"center",padding:"40px 32px",
            background:"linear-gradient(135deg,#1a1a1a,#2a1f00)",
            borderRadius:28,border:"2px solid #f59e0b55",
            maxWidth:320,width:"90%",
            boxShadow:"0 0 60px #f59e0b33"
          }}>
            <div style={{fontSize:48,marginBottom:8,filter:"drop-shadow(0 0 20px #f59e0b)"}}>🏆</div>
            <div style={{fontSize:13,fontWeight:800,color:"#60A5FA",letterSpacing:3,marginBottom:8,textTransform:"uppercase"}}>
              {es?"NUEVO RÉCORD":"NEW RECORD"}
            </div>
            <div style={{fontSize:28,fontWeight:900,color:"#FFFFFF",marginBottom:4,lineHeight:1.1}}>
              {prCelebration.ejercicio}
            </div>
            <div style={{fontSize:48,fontWeight:900,color:"#60A5FA",letterSpacing:1}}>
              {prCelebration.kg} kg
            </div>
            <div style={{fontSize:13,color:"#8B9AB2",marginTop:12}}>
              {es?"¡Superaste tu máximo personal!":"You beat your personal best!"}
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
              <div style={{background:"#60A5FA22",border:"1px solid #f59e0b44",borderRadius:12,padding:"12px",marginBottom:16}}>
                <div style={{fontSize:28}}>🏆</div>
                <div style={{fontSize:18,fontWeight:800,color:"#60A5FA",marginTop:4}}>
                  {resumenSesion.prsNuevos} nuevo{resumenSesion.prsNuevos>1?"s":""} PR!
                </div>
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
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
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
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),fontSize:15}}>
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
          <div style={{background:bgCard,margin:"20px 16px",borderRadius:16,padding:"20px 16px",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,fontWeight:800,letterSpacing:2,marginBottom:12}}>NUEVA RUTINA</div>
            <div style={{marginBottom:8}}><span style={lbl}>NOMBRE DE LA RUTINA</span><input style={inp} value={newR.name} onChange={e=>setNewR(p=>({...p,name:e.target.value}))} placeholder="Ej: PPL Fuerza"/></div>
            <div style={{marginBottom:8}}><span style={lbl}>NOMBRE DEL ALUMNO</span><input style={inp} value={newR.alumno||""} onChange={e=>setNewR(p=>({...p,alumno:e.target.value}))} placeholder="Ej: Agustin Sevita"/></div>
            <div style={{marginBottom:8}}>
              <span style={lbl}>{es?"CANTIDAD DE DIAS":"NUMBER OF DAYS"}</span>
              <div style={{display:"flex",gap:8}}>
                {[1,2,3,4,5,6,7].map(n=>(
                  <button key={n} className="hov" style={{...btn(newR.numDays===n?"#2563EB":undefined),padding:"8px 0",flex:1,fontSize:18}} onClick={()=>setNewR(p=>({...p,numDays:n,days:Array.from({length:n},(_,i)=>({label:"Dia "+(i+1),warmup:[],exercises:[],showWarmup:false,showMain:true}))}))}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}><span style={lbl}>NOTA</span><input style={inp} value={newR.note} onChange={e=>setNewR(p=>({...p,note:e.target.value}))} placeholder="Ej: Lun/Mie/Vie"/></div>
            <div style={{display:"flex",gap:8}}>
              <button className="hov" style={{...btn(),flex:1,padding:"8px"}} onClick={()=>setNewR(null)}>CANCELAR</button>
              <button className="hov" style={{...btn("#2563EB"),flex:2,padding:"8px",fontSize:18}} onClick={()=>{
                if(!newR.name.trim()){toast2("Pon un nombre");return;}
                setRoutines(p=>[...p,{...newR,id:uid(),created:new Date().toLocaleDateString("es-AR")}]);
                setNewR(null); toast2("Rutina creada ✓");
              }}>CREAR</button>
            </div>
          </div>
        </div>
      )}
      {editEx&&(
        <EditExModal darkMode={darkMode} key={editEx.rId+"-"+editEx.dIdx+"-"+editEx.eIdx} editEx={editEx} btn={btn} inp={inp} allEx={allEx} es={es} PATS={PATS}
          onSave={async(updated)=>{
            const blq = editEx.bloque||"exercises";
            setRoutines(p=>p.map(r=>r.id===editEx.rId?{...r,days:r.days.map((d,di)=>di===editEx.dIdx?{...d,[blq]:(d[blq]||[]).map((ex,ei)=>ei===editEx.eIdx?updated:ex)}:d)}:r));
            // Auto-guardar en Supabase inmediatamente
            try {
              const rActual = routines.find(x=>x.id===editEx.rId);
              if(rActual) {
                const updatedDays = rActual.days.map((d,di)=>di===editEx.dIdx?{...d,[blq]:(d[blq]||[]).map((ex,ei)=>ei===editEx.eIdx?updated:ex)}:d);
                const payload={nombre:rActual.name,alumno_id:rActual.alumno_id||null,datos:{days:updatedDays,alumno:rActual.alumno||"",note:rActual.note||""},entrenador_id:"entrenador_principal"};
                if(rActual.saved){ await sb.updateRutina(rActual.id,payload); }
                else { await sb.createRutina({...payload,id:rActual.id}); setRoutines(p=>p.map(r=>r.id===rActual.id?{...r,saved:true}:r)); }
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
          <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
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
              if(row.type==="day") return(
                <div key={ri} style={{fontSize:15,fontWeight:700,color:textMain,letterSpacing:2,borderBottom:"2px solid #243040",paddingBottom:4,margin:"16px 0 8px"}}>
                  {row.label}
                </div>
              );
              if(row.type==="warmup-header") return(
                <div key={ri} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",background:"#2563EB11",border:"1px solid #243040",borderRadius:8,marginBottom:8}}>
                  <div style={{width:3,height:14,background:"#8B9AB2",borderRadius:2}}/>
                  <span style={{fontSize:15,fontWeight:800,color:"#8B9AB2",letterSpacing:1}}>ENTRADA EN CALOR</span>
                </div>
              );
              if(row.type==="warmup-ex") return(
                <div key={ri} style={{background:bgCard,borderRadius:12,padding:"8px 12px",marginBottom:8,border:"1px solid "+border}}>
                  <div style={{fontSize:15,fontWeight:700,color:textMain,marginBottom:8}}>{row.exName}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                    {(row.wks||[{s:row.ex.sets||"-",r:row.ex.reps||"-",kg:"",filled:false,active:false},{s:row.ex.sets||"-",r:row.ex.reps||"-",kg:"",filled:false,active:false},{s:row.ex.sets||"-",r:row.ex.reps||"-",kg:"",filled:false,active:false},{s:row.ex.sets||"-",r:row.ex.reps||"-",kg:"",filled:false,active:false}]).map((w,wi)=>(
                      <div key={wi} style={{background:w.active?"#2563EB":"#162234",borderRadius:8,padding:w.active?"10px 4px":"7px 4px",textAlign:"center",border:w.active?"2px solid #2563EB":w.filled?"1px solid #243040":"1px solid "+border}}>
                        <div style={{fontSize:w.active?10:8,fontWeight:700,letterSpacing:1,color:w.active?"#FFFFFF":"#8B9AB2",marginBottom:w.active?5:3}}>{w.active?"→ ":" "}SEM {wi+1}</div>
                        <div style={{fontSize:w.active?16:13,fontWeight:800,color:w.active?"#FFFFFF":w.filled?"#FFFFFF":"#8B9AB2"}}>{w.s}×{w.r}</div>
                        {w.kg&&<div style={{fontSize:11,fontWeight:700,color:w.active?"#FFFFFF":"#8B9AB2",marginTop:4}}>{w.kg}kg</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
              if(row.type==="main-header") return(
                <div key={ri} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",background:"#2563EB11",border:"2px solid #243040",borderRadius:8,marginBottom:8,marginTop:8}}>
                  <div style={{width:3,height:16,background:"#8B9AB2",borderRadius:2}}/>
                  <span style={{fontSize:15,fontWeight:800,color:"#8B9AB2",letterSpacing:1}}>BLOQUE PRINCIPAL</span>
                </div>
              );
              const {exName,col,ex,wks,pat,lastRpe} = row;
              const rpeColors2={6:"#22C55E",7:"#22C55E",8:"#60A5FA",9:"#8B9AB2",10:"#2563EB"};
              return(
                <div key={ri} style={{background:"#1E2D40",border:"1px solid "+col+"44",borderRadius:12,padding:"12px",marginBottom:8}}>
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
                      <div key={wi} style={{background:w.active?"#2563EB":"#162234",borderRadius:8,padding:"8px 4px",textAlign:"center",border:w.active?"2px solid #2563EB":w.filled?"1px solid #243040":"1px solid "+border}}>
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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:150,display:"flex",alignItems:"flex-end"}} onClick={()=>setAddExModal(null)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"16px",width:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <span style={{fontSize:22,fontWeight:800,letterSpacing:1}}>{es?"AGREGAR EJERCICIO":"ADD EXERCISE"}</span>
              <button className="hov" style={{...btn(),fontSize:18,padding:"4px 8px"}} onClick={()=>setAddExModal(null)}>x</button>
            </div>
            <input style={{...inp,marginBottom:8}} placeholder={es?"Buscar...":"Search..."} value={addExSearch} onChange={e=>setAddExSearch(e.target.value)}/>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              {Object.entries(PATS).map(([k,p])=>(
                <button key={k} className="hov" style={{background:addExPat===k?p.color+"44":"#2D4057",color:addExPat===k?p.color:textMuted,border:addExPat===k?"1px solid "+p.color:"1px solid "+border,borderRadius:8,padding:"8px 14px",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setAddExPat(addExPat===k?null:k)}>
                  {p.icon} {es?p.label:p.labelEn}
                </button>
              ))}
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              {EX.filter(e=>{
                const q=addExSearch.toLowerCase();
                if(addExPat&&e.pattern!==addExPat) return false;
                if(!q) return true;
                return e.name.toLowerCase().includes(q)||e.nameEn.toLowerCase().includes(q)||e.muscle.toLowerCase().includes(q);
              }).map(ex=>{
                const pat=PATS[ex.pattern]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"};
                return(
                  <div key={ex.id} className="hov" style={{display:"flex",alignItems:"center",gap:12,padding:"16px 10px",borderRadius:12,marginBottom:8,background:darkMode?"#162234":"#E2E8F0",cursor:"pointer"}} onClick={()=>{
                    const blk=addExModal.bloque||"exercises"; setRoutines(p=>p.map(r=>r.id===addExModal.rId?{...r,days:r.days.map((d,i)=>i===addExModal.dIdx?{...d,[blk]:[...(d[blk]||[]),{id:ex.id,sets:"",reps:"",kg:"",pause:0,note:"",weeks:[]}]}:d)}:r));
                    toast2((es?"Agregado":"Added")+": "+(es?ex.name:ex.nameEn));
                    setAddExModal(null);
                  }}>
                    <div style={{width:52,height:52,borderRadius:12,background:pat.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{pat.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:18,fontWeight:700}}>{es?ex.name:ex.nameEn}</div>
                      <div style={{fontSize:15,color:textMuted}}>{ex.muscle} · {ex.equip}</div>
                    </div>
                    <div style={{color:pat.color,fontSize:28,fontWeight:700}}>+</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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

function WorkoutScreen({session, activeDay, activeR, allEx, progress, logSet, startTimer, timer, setSession, setCompletedDays, completedDays, currentWeek, setCurrentWeek, preSessionPRs, setResumenSesion, readOnly, sharedParam, sb, es, darkMode, prCelebration, setPrCelebration, activeExIdx, setActiveExIdx}) {

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

  const [kg, setKg] = React.useState("");
  const [reps, setReps] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [setFlash, setSetFlash] = React.useState(false);
  const [showCheckAnim, setShowCheckAnim] = React.useState(false);
  const [swipeDelta, setSwipeDelta] = React.useState(0);
  const [swiping, setSwiping] = React.useState(false);
  const swipeStartX = React.useRef(null);
  const [note, setNote] = React.useState("");
  const [pause, setPause] = React.useState(90);
  const [rpe, setRpe] = React.useState(null);

  const hoy = new Date().toLocaleDateString("es-AR");
  const exercises = activeDay?.exercises||[];
  const ex = exercises[activeExIdx];
  const info = ex ? allEx.find(e=>e.id===ex.id) : null;
  const pat = info ? ({"empuje":{icon:"E",color:"#2563EB"},"traccion":{icon:"🔄",color:"#2563EB"},
    "rodilla":{icon:"R",color:"#22C55E"},"bisagra":{icon:"B",color:"#8B9AB2"},
    "core":{icon:"M",color:"#8B9AB2"},"movilidad":{icon:"M",color:"#2563EB"}}[info?.pattern]||{icon:"E",color:"#8B9AB2"}) : {icon:"E",color:"#8B9AB2"};

  // Sets registrados hoy para el ejercicio activo
  const setsHoy = ex ? (progress[ex.id]?.sets||[]).filter(s=>s.date===hoy&&(s.week===undefined||s.week===currentWeek)) : [];
  const totalSets = parseInt(ex?.sets)||3;
  const setsRestantes = Math.max(0, totalSets - setsHoy.length);
  const setActualNum = setsHoy.length + 1;
  const ultimoSet = setsHoy[0];
  const pr = ex ? (progress[ex.id]?.max||0) : 0;
  const kgNum = parseFloat(kg)||0;
  const isPR = kgNum > 0 && kgNum > pr && pr > 0;

  // Precargar kg del ultimo set
  React.useEffect(()=>{
    if(ex) {
      const lastKg = setsHoy[0]?.kg || progress[ex.id]?.sets?.[0]?.kg || ex.kg || "";
      setKg(lastKg ? String(lastKg) : "");
      setReps(ex.reps ? String(ex.reps) : "");
      setPause(ex.pause||90);
      setNote("");
      setRpe(null);
    }
  }, [activeExIdx]);

  const adjustKg = (d) => setKg(v=>String(Math.max(0,(parseFloat(v)||0)+d)));
  const fmtTime = s => s>=60?Math.floor(s/60)+"m"+(s%60>0?s%60+"s":""):s+"s";

  const handleLogSet = () => {
    if(!kg || !reps) return;
    // Haptic feedback — vibración corta al registrar set
    try { if(navigator.vibrate) navigator.vibrate([40]); } catch(e){}
    // Micro-feedback: flash + check animation
    setSetFlash(true);
    setShowCheckAnim(true);
    setTimeout(()=>setSetFlash(false), 600);
    setTimeout(()=>setShowCheckAnim(false), 800);
    // Detectar PR
    const newKgVal = parseFloat(kg)||0;
    if(newKgVal > pr && pr > 0) {
      // Haptic doble para PR
      try { if(navigator.vibrate) navigator.vibrate([60,40,120]); } catch(e){}
      setPrCelebration({ejercicio: es?info?.name:info?.nameEn||info?.name, kg: newKgVal});
      setTimeout(()=>setPrCelebration(null), 2500);
    }
    logSet(ex.id, parseFloat(kg), parseInt(reps), note, rpe);
    if(pause>0) startTimer(pause, pat.color);
    setNote("");
    setRpe(null);
    // Si completó todos los sets, avanzar al siguiente ejercicio
    if(setsHoy.length + 1 >= totalSets) {
      const nextIdx = activeExIdx + 1;
      if(nextIdx < exercises.length) {
        setTimeout(()=>setActiveExIdx(nextIdx), 300);
      }
    }
  };

  // Calcular progreso total
  const totalExDone = exercises.filter(e=>(progress[e.id]?.sets||[]).some(s=>s.date===hoy)).length;
  const pct = exercises.length>0 ? (totalExDone/exercises.length)*100 : 0;

  // Funcion finalizar (igual que antes)
  const finalizarSesion = () => {
    const r = activeR;
    const dayKey = session.rId+"-"+session.dIdx+"-w"+currentWeek;
    const newCompleted = completedDays.includes(dayKey)?completedDays:[...completedDays,dayKey];
    const totalDays = r?r.days.length:1;
    const daysThisWeek = newCompleted.filter(k=>k.startsWith(session.rId+"-")&&k.endsWith("-w"+currentWeek)).length;
    setCompletedDays(newCompleted);
    const durMin = Math.round((Date.now()-(session.startTime||Date.now()))/60000)||1;
    const exsCompleted = [...(activeDay?.warmup||[]), ...(exercises||[])];
    const hoyFin = new Date().toLocaleDateString("es-AR");
    const volTotal = exsCompleted.reduce((acc,ex2)=>{
      const s=(progress[ex2.id]?.sets||[]).filter(s=>s.date===hoyFin);
      return acc+s.reduce((a,s2)=>a+(s2.kg||0)*(s2.reps||0),0);
    },0);
    const prsNuevos = exsCompleted.filter(ex2=>{
      const pg=progress[ex2.id];
      if(!pg) return false;
      const sHoy=(pg.sets||[]).filter(s=>s.date===hoyFin);
      if(!sHoy.length) return false;
      const maxHoy=Math.max(...sHoy.map(s2=>s2.kg||0));
      if(maxHoy<=0) return false;
      // PR si supera el máximo previo a la sesión (incluye primer registro)
      return maxHoy > (preSessionPRs[ex2.id]||0);
    }).length;
    setResumenSesion({durMin,ejercicios:exsCompleted.length,
      totalSets:exsCompleted.reduce((a,e)=>a+(parseInt(e.sets)||3),0),
      volTotal:Math.round(volTotal),prsNuevos,
      diaLabel:activeDay.label||("Dia "+(session.dIdx+1)),
      rutinaName:r?.name||"Entrenamiento",fecha:hoyFin});
    setSession(null);
    if(readOnly&&sharedParam){try{
      const rutData=JSON.parse(atob(sharedParam));
      if(rutData.alumnoId)sb.addSesion({alumno_id:rutData.alumnoId,rutina_nombre:r?.name||"",
        dia_label:activeDay.label||("Dia "+(session.dIdx+1)),dia_idx:session.dIdx,
        semana:currentWeek+1,ejercicios:exercises.map(e=>e.id).join(","),
        fecha:hoyFin,hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})});
    }catch(e){}}
    // Avanzar semana solo cuando se completan TODOS los días de la semana
    if(daysThisWeek >= totalDays && currentWeek < 3){
      setCompletedDays(prev=>prev.filter(k=>!k.endsWith("-w"+currentWeek)));
      setCurrentWeek(currentWeek + 1);
    }
  };

  const nextEx = exercises[activeExIdx+1];
  const nextInfo = nextEx ? allEx.find(e=>e.id===nextEx.id) : null;

  return (
    <div style={{position:"fixed",inset:0,background:bg,zIndex:80,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:bgCard,borderBottom:"2px solid #3B82F6",padding:"8px 16px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <button className="hov" onClick={()=>{
            if(window.confirm(es?"¿Salir del entrenamiento? Perderás los sets no guardados.":"Exit workout? Unsaved sets will be lost.")){
              setSession(null);
            }
          }}
            style={{background:"transparent",border:"none",color:textMuted,fontSize:22,padding:"0 4px",cursor:"pointer"}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"#2563EB",letterSpacing:2}}>{es?"ENTRENANDO":"TRAINING"}</div>
            <div style={{fontSize:15,fontWeight:900,color:textMain}}>{activeR?.name} — {activeDay.label||("Día "+(session.dIdx+1))}</div>
          </div>
          <div style={{fontSize:13,fontWeight:900,color:"#2563EB",background:"#2D4057",borderRadius:20,padding:"4px 12px",border:"1px solid #243040"}}>
            {totalExDone}/{exercises.length}
          </div>
        </div>
        <div style={{height:4,background:_dm?"#2D4057":"#E2E8F0",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:pct+"%",background:"#2563EB",borderRadius:2,transition:"width .5s ease"}}/>
        </div>
      </div>
      {timer&&(
        <div style={{background:"#22C55E18",borderBottom:"1px solid #22c55e33",padding:"8px 16px",
          display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:"50%",border:"3px solid #22c55e",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#22C55E",
            background:timer.remaining<10?"#2D4057":"transparent",borderColor:timer.remaining<10?"#2563EB":"#22C55E",
            color:timer.remaining<10?"#2563EB":"#22C55E"}}>
            {timer.remaining}
          </div>
          <div style={{flex:1,fontSize:15,fontWeight:700,color:textMuted}}>{es?"Descansando...":"Resting..."}</div>
          <button className="hov" onClick={()=>startTimer(0)}
            style={{background:"transparent",border:"1px solid "+border,borderRadius:8,padding:"4px 12px",
              color:textMuted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {es?"Saltar":"Skip"}
          </button>
        </div>
      )}
      <div style={{display:"flex",gap:4,padding:"8px 16px 0",flexShrink:0,overflowX:"auto"}}>
        {exercises.map((e,i)=>{
          const done=(progress[e.id]?.sets||[]).filter(s=>s.date===hoy).length>=(parseInt(e.sets)||3);
          const active=i===activeExIdx;
          return(
            <button key={i} onClick={()=>setActiveExIdx(i)}
              style={{flexShrink:0,width:active?32:10,height:10,borderRadius:6,border:"none",cursor:"pointer",
                background:done?"#22C55E":active?"#2563EB":(darkMode?"#2D4057":"#2D4057"),
                transition:"all .25s ease"}}>
            </button>
          );
        })}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px 0"}}>

        {ex&&(
          <>
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{width:48,height:48,borderRadius:12,background:pat.color+"22",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>
                  {pat.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:28,fontWeight:900,color:textMain,lineHeight:1.1}}>
                    {es?info?.name:info?.nameEn||info?.name}
                  </div>
                  <div style={{fontSize:13,color:pat.color,fontWeight:700,marginTop:4}}>
                    {ex.sets}×{ex.reps} {ex.kg?("· "+ex.kg+"kg"):""} {ex.pause?("· "+fmtTime(ex.pause)+" desc"):""}
                  </div>
                </div>
                {info?.youtube&&(
                  <a href={info.youtube} target="_blank" rel="noreferrer"
                    style={{background:"#2D4057",color:"#2563EB",border:"1px solid #243040",
                      borderRadius:8,padding:"8px 8px",fontSize:13,fontWeight:700,textDecoration:"none",flexShrink:0}}>
                    ▶
                  </a>
                )}
              </div>
              {(pr>0||ultimoSet)&&(
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  {pr>0&&<span style={{background:"#f59e0b15",border:"1px solid #f59e0b33",borderRadius:6,
                    padding:"4px 8px",fontSize:13,fontWeight:700,color:"#60A5FA"}}>
                    🏆 PR {pr}kg
                  </span>}
                  {ultimoSet&&<span style={{background:bgSub,borderRadius:6,padding:"4px 8px",
                    fontSize:13,fontWeight:500,color:textMuted}}>
                    {es?"Último":"Last"}: {ultimoSet.kg}kg×{ultimoSet.reps}
                  </span>}
                </div>
              )}
            </div>
            {setsHoy.length>0&&(
              <div style={{background:bgCard,borderRadius:12,border:"1px solid "+border,marginBottom:12,overflow:"hidden"}}>
                <div style={{padding:"8px 14px",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),
                  fontSize:11,fontWeight:800,color:textMuted,letterSpacing:0.3}}>
                  {es?"SETS DE HOY":"TODAY'S SETS"}
                </div>
                <div>
                {setsHoy.slice().reverse().map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",
                    borderBottom:i<setsHoy.length-1?"1px solid "+border:"none"}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:"#22C55E20",
                      color:"#22C55E",display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:13,fontWeight:900,flexShrink:0}}>✓</div>
                    <div style={{flex:1,fontSize:18,fontWeight:800,color:textMain}}>
                      {s.kg}kg × {s.reps} reps
                    </div>
                    {s.rpe&&<span style={{fontSize:13,color:textMuted,fontWeight:500}}>RPE {s.rpe}</span>}
                  </div>
                ))}
                </div>
              </div>
            )}
            {setsRestantes>0?(
              <div
                style={{background:bgCard,borderRadius:16,border:"1px solid #243040",
                  marginBottom:12,overflow:"hidden",
                  transform:swiping?`translateX(${Math.min(swipeDelta,0)}px)`:"translateX(0)",
                  transition:swiping?"none":"transform .25s cubic-bezier(.34,1.56,.64,1)",
                  position:"relative",userSelect:"none",
                  boxShadow:swipeDelta>60?"0 0 0 2px #22C55E44":"none"
                }}
                onTouchStart={e=>{
                  swipeStartX.current = e.touches[0].clientX;
                  setSwiping(true);
                  setSwipeDelta(0);
                }}
                onTouchMove={e=>{
                  if(swipeStartX.current===null) return;
                  const dx = e.touches[0].clientX - swipeStartX.current;
                  if(dx > 0) { setSwipeDelta(0); return; } // solo swipe izquierda
                  setSwipeDelta(dx);
                }}
                onTouchEnd={()=>{
                  setSwiping(false);
                  if(swipeDelta < -80 && kg && reps) {
                    // Haptic fuerte al completar por swipe
                    try { if(navigator.vibrate) navigator.vibrate([30,30,60]); } catch(e){}
                    handleLogSet();
                  }
                  setSwipeDelta(0);
                  swipeStartX.current = null;
                }}
              >
                {/* Fondo verde que aparece al swipear */}
                <div style={{
                  position:"absolute",top:0,bottom:0,right:0,
                  width:Math.max(0,-swipeDelta),
                  background:"linear-gradient(90deg,transparent,#22C55E33)",
                  display:"flex",alignItems:"center",justifyContent:"flex-end",
                  paddingRight:16,pointerEvents:"none",zIndex:0
                }}>
                  {-swipeDelta > 50 && <Ic name="check-sm" size={22} color="#22C55E"/>}
                </div>
                <div style={{position:"relative",zIndex:1}}>
                <div style={{padding:"8px 16px",background:"#2D4057",borderBottom:"1px solid #24304022",
                  display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:13,fontWeight:800,color:"#2563EB",letterSpacing:0.3}}>
                    {es?"SET":"SET"} {setActualNum} {es?"de":"of"} {totalSets}
                  </div>
                  {setActualNum===1&&!swipeDelta&&(
                    <div style={{fontSize:10,color:"#4A5C72",display:"flex",alignItems:"center",gap:3}}>
                      <Ic name="arrow-left" size={10} color="#4A5C72"/> deslizá
                    </div>
                  )}
                  {isPR&&(
                    <div style={{fontSize:13,fontWeight:900,color:"#60A5FA",
                      background:"#f59e0b15",border:"1px solid #f59e0b44",
                      borderRadius:20,padding:"2px 10px"}}>
                      🏆 PR
                    </div>
                  )}
                </div>

                <div style={{padding:"16px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>KG</div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <button className="hov" onClick={()=>adjustKg(-2.5)}
                          style={{width:44,height:52,background:bgSub,border:"1px solid "+border,
                            borderRadius:12,color:textMain,fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>−</button>
                        <input style={{flex:1,background:bgSub,border:"1px solid "+(isPR?"#60A5FA":border),
                          borderRadius:12,color:isPR?"#60A5FA":textMain,fontSize:28,fontWeight:900,
                          textAlign:"center",padding:"8px 4px",fontFamily:"inherit",height:52}}
                          type="number" value={kg} onChange={e=>setKg(e.target.value)}
                          placeholder="0"/>
                        <button className="hov" onClick={()=>adjustKg(2.5)}
                          style={{width:44,height:52,background:bgSub,border:"1px solid "+border,
                            borderRadius:12,color:textMain,fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>+</button>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>REPS</div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <button className="hov" onClick={()=>setReps(v=>String(Math.max(1,(parseInt(v)||0)-1)))}
                          style={{width:44,height:52,background:bgSub,border:"1px solid "+border,
                            borderRadius:12,color:textMain,fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>−</button>
                        <input style={{flex:1,background:bgSub,border:"1px solid "+border,
                          borderRadius:12,color:textMain,fontSize:28,fontWeight:900,
                          textAlign:"center",padding:"8px 4px",fontFamily:"inherit",height:52}}
                          type="number" value={reps} onChange={e=>setReps(e.target.value)}
                          placeholder="0"/>
                        <button className="hov" onClick={()=>setReps(v=>String((parseInt(v)||0)+1))}
                          style={{width:44,height:52,background:bgSub,border:"1px solid "+border,
                            borderRadius:12,color:textMain,fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>+</button>
                      </div>
                    </div>
                  </div>
                  {ex.reps&&(
                    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                      {(()=>{
                        const target=parseInt(ex.reps)||8;
                        return [target-2,target-1,target,target+1,target+2].filter(v=>v>0).map(v=>(
                          <button key={v} className="hov"
                            onClick={()=>setReps(String(v))}
                            style={{padding:"4px 12px",borderRadius:8,fontSize:13,fontWeight:800,
                              cursor:"pointer",fontFamily:"inherit",border:"1px solid "+(parseInt(reps)===v?pat.color:border),
                              background:parseInt(reps)===v?pat.color+"22":"transparent",
                              color:parseInt(reps)===v?pat.color:textMuted}}>
                            {v}
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                  <button className={"hov"+(showCheckAnim?" check-pulse":"")} onClick={handleLogSet}
                    disabled={!kg||!reps}
                    style={{width:"100%",padding:"16px",
                      background:(!kg||!reps)?(darkMode?"#2D4057":"#E2E8F0"):showCheckAnim?"#22C55E":(isPR?"#60A5FA":"#2563EB"),
                      color:(!kg||!reps)?textMuted:"#fff",border:"none",borderRadius:12,
                      fontSize:22,fontWeight:900,cursor:(!kg||!reps)?"default":"pointer",
                      fontFamily:"inherit",letterSpacing:1,marginBottom:8,
                      transition:"background .15s ease",
                      boxShadow:(!kg||!reps)?"none":(isPR?"0 4px 20px #f59e0b44":"0 4px 20px #243040")}}>
                    {showCheckAnim
                      ?(<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="4 12 9 17 20 7"/>
                          </svg>
                          {es?"SET REGISTRADO":"SET LOGGED"}
                        </span>)
                      :(<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Ic name="check-sm" size={20} color="#fff"/>{es?"REGISTRAR SET "+setActualNum:"LOG SET "+setActualNum}</span>)
                    }
                  </button>
                  <button onClick={()=>setShowAdvanced(v=>!v)}
                    style={{width:"100%",background:"transparent",border:"none",color:textMuted,
                      fontSize:13,fontWeight:700,cursor:"pointer",padding:"2px",fontFamily:"inherit"}}>
                    {showAdvanced?"▲":"▼"} {es?"Pausa · Nota · RPE":"Rest · Note · RPE"}
                  </button>
                  {showAdvanced&&(
                    <div style={{marginTop:8}}>
                      <div style={{fontSize:11,color:textMuted,fontWeight:500,letterSpacing:0.3,marginBottom:8}}>
                        {es?"PAUSA":"REST"}
                      </div>
                      <div style={{display:"flex",gap:8,marginBottom:8}}>
                        {[0,60,90,120,180].map(p=>(
                          <button key={p} className="hov" onClick={()=>setPause(p)}
                            style={{flex:1,padding:"8px 4px",border:"1px solid "+(pause===p?pat.color:border),
                              borderRadius:8,background:pause===p?pat.color+"22":"transparent",
                              color:pause===p?pat.color:textMuted,fontSize:13,fontWeight:700,
                              cursor:"pointer",fontFamily:"inherit"}}>
                            {p===0?"Off":fmtTime(p)}
                          </button>
                        ))}
                      </div>
                      <input style={{width:"100%",background:bgSub,border:"1px solid "+border,
                        borderRadius:8,color:textMain,padding:"8px 10px",fontSize:13,fontFamily:"inherit",marginBottom:8}}
                        value={note} onChange={e=>setNote(e.target.value)}
                        placeholder={es?"Nota del set...":"Set note..."}/>
                      <div style={{display:"flex",gap:4}}>
                        {[6,7,8,9,10].map(v=>(
                          <button key={v} className="hov" onClick={()=>setRpe(rpe===v?null:v)}
                            style={{flex:1,padding:"8px 2px",border:"1px solid "+(rpe===v?"#2563EB":border),
                              borderRadius:8,background:rpe===v?"#2563EB22":"transparent",
                              color:rpe===v?"#2563EB":textMuted,fontSize:13,fontWeight:800,
                              cursor:"pointer",fontFamily:"inherit"}}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            ):(
              /* Ejercicio completado */
              <div style={{background:"#22c55e15",border:"1px solid #22c55e33",borderRadius:12,
                padding:"16px",marginBottom:12,textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:4}}><Ic name="check-circle" size={22} color="#22C55E"/></div>
                <div style={{fontSize:18,fontWeight:900,color:"#22C55E"}}>
                  {es?"Ejercicio completado":"Exercise complete"}
                </div>
                <div style={{fontSize:13,color:textMuted,marginTop:4}}>
                  {setsHoy.length} sets · {setsHoy.reduce((a,s)=>a+(s.kg||0)*(s.reps||0),0).toLocaleString()} kg
                </div>
                {activeExIdx<exercises.length-1&&(
                  <button className="hov" onClick={()=>setActiveExIdx(activeExIdx+1)}
                    style={{marginTop:12,padding:"8px 24px",background:"#22C55E",color:"#fff",
                      border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                    {es?"Siguiente ejercicio →":"Next exercise →"}
                  </button>
                )}
              </div>
            )}
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {activeExIdx>0&&(
                <button className="hov" onClick={()=>setActiveExIdx(activeExIdx-1)}
                  style={{flex:1,padding:"8px",background:bgSub,border:"1px solid "+border,
                    borderRadius:12,color:textMuted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  ← {es?"Anterior":"Prev"}
                </button>
              )}
              {activeExIdx<exercises.length-1&&(
                <button className="hov" onClick={()=>setActiveExIdx(activeExIdx+1)}
                  style={{flex:1,padding:"8px",background:bgSub,border:"1px solid "+border,
                    borderRadius:12,color:textMuted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  {es?"Siguiente":"Next"} →
                </button>
              )}
            </div>
          </>
        )}
        {nextEx&&nextInfo&&(
          <div style={{background:bgSub,borderRadius:12,padding:"8px 16px",marginBottom:12,
            border:"1px solid "+border,display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,flexShrink:0}}>
              {es?"SIGUIENTE":"NEXT"}
            </div>
            <div style={{flex:1,fontSize:15,fontWeight:800,color:textMuted}}>
              {es?nextInfo.name:nextInfo.nameEn||nextInfo.name}
            </div>
            <div style={{fontSize:13,color:textMuted,fontWeight:500,flexShrink:0}}>
              {nextEx.sets}×{nextEx.reps}
            </div>
          </div>
        )}
      </div>
      <div style={{padding:"8px 16px 20px",flexShrink:0,background:bgCard,
        borderTop:"1px solid "+border}}>
        <button className="hov" onClick={finalizarSesion}
          style={{width:"100%",padding:"16px",background:"#2563EB",color:"#fff",border:"none",
            borderRadius:12,fontSize:18,fontWeight:900,cursor:"pointer",fontFamily:"inherit",letterSpacing:1}}>
          ✅ {es?"FINALIZAR ENTRENAMIENTO":"FINISH WORKOUT"}
        </button>
      </div>
    </div>
  );
}


function LogForm({ex, es, btn, inp, lbl, tag, fmtP, progress, onLog, onClose, darkMode, PATS}) {
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

  const lastKg = progress[ex.id]?.sets?.[0]?.kg;
  const [kg,setKg]=useState(lastKg?String(lastKg):"");
  const [reps,setReps]=useState(ex.reps||"");
  const [note,setNote]=useState("");
  const [pause,setPause]=useState(ex.pause||90);
  const [rpe,setRpe]=useState(null);
  const [showAdvanced,setShowAdvanced]=useState(false);
  const pat=PATS[ex.pattern]||{icon:"E",color:"#8B9AB2",label:"Otro",labelEn:"Other"};
  const lastSet=progress[ex.id]?.sets?.[0];
  const isPR = parseFloat(kg)>0 && parseFloat(kg)>(progress[ex.id]?.max||0);
  const rpeColors={6:"#22C55E",7:"#22C55E",8:"#60A5FA",9:"#8B9AB2",10:"#2563EB"};
  const rpeLabels={6:es?"Muy facil":"Easy",7:es?"Controlado":"Moderate",8:es?"Exigente":"Hard",9:es?"Muy duro":"Very Hard",10:es?"Al limite":"Max"};
  const kgNum = parseFloat(kg)||0;
  const adjustKg = (delta) => setKg(v=>String(Math.max(0,(parseFloat(v)||0)+delta)));

  return(
    <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:"20px 16px 28px",width:"100%"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <div style={{width:44,height:44,borderRadius:12,background:pat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>
          {pat.icon}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:22,fontWeight:900,color:textMain,lineHeight:1.1}}>{es?ex.name:ex.nameEn||ex.name}</div>
          <div style={{fontSize:13,color:pat.color,fontWeight:700,marginTop:4}}>{es?pat.label:pat.labelEn} · {ex.sets}×{ex.reps}</div>
        </div>
        <button className="hov" style={{background:"transparent",border:"none",color:textMuted,fontSize:22,padding:"4px 8px",cursor:"pointer"}} onClick={onClose}><Ic name="x" size={16}/></button>
      </div>
      {lastSet&&(
        <div style={{background:bgSub,borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:13,color:textMuted}}>{es?"Última vez":"Last time"}</span>
          <span style={{fontSize:15,fontWeight:800,color:textMain}}>{lastSet.kg}kg × {lastSet.reps} reps</span>
        </div>
      )}
      {isPR&&(
        <div style={{background:"#60A5FA22",border:"1px solid #f59e0b55",borderRadius:12,padding:"8px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:28}}><Ic name="award" size={28} color="#fbbf24"/></span>
          <div>
            <div style={{fontSize:15,fontWeight:900,color:"#60A5FA"}}>{es?"¡NUEVO RÉCORD PERSONAL!":"NEW PERSONAL RECORD!"}</div>
            <div style={{fontSize:13,color:"#f59e0b88"}}>{kgNum}kg {es?"supera tu máximo anterior":"beats your previous max"}</div>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div>
          <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>KG {isPR?"🏆":""}</div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button className="hov" onClick={()=>adjustKg(-2.5)}
              style={{width:36,height:44,background:bgSub,border:"1px solid "+border,borderRadius:8,color:textMain,fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>−</button>
            <input
              style={{...inp,textAlign:"center",fontSize:22,fontWeight:900,color:isPR?"#60A5FA":textMain,
                borderColor:isPR?"#60A5FA":border,flex:1,height:44,padding:"0"}}
              type="number" value={kg} onChange={e=>setKg(e.target.value)}
              placeholder={lastSet?.kg?String(lastSet.kg):"0"}/>
            <button className="hov" onClick={()=>adjustKg(2.5)}
              style={{width:36,height:44,background:bgSub,border:"1px solid "+border,borderRadius:8,color:textMain,fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>+</button>
          </div>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>REPS</div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button className="hov" onClick={()=>setReps(v=>String(Math.max(1,(parseInt(v)||0)-1)))}
              style={{width:36,height:44,background:bgSub,border:"1px solid "+border,borderRadius:8,color:textMain,fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>−</button>
            <input
              style={{...inp,textAlign:"center",fontSize:22,fontWeight:900,color:textMain,flex:1,height:44,padding:"0"}}
              type="number" value={reps} onChange={e=>setReps(e.target.value)}
              placeholder={ex.reps||"0"}/>
            <button className="hov" onClick={()=>setReps(v=>String((parseInt(v)||0)+1))}
              style={{width:36,height:44,background:bgSub,border:"1px solid "+border,borderRadius:8,color:textMain,fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>+</button>
          </div>
        </div>
      </div>
      <button className="hov"
        style={{width:"100%",padding:"16px",background:isPR?"#60A5FA":(pat?.color||"#2563EB"),
          color:"#fff",border:"none",borderRadius:12,fontSize:22,fontWeight:900,
          cursor:"pointer",fontFamily:"inherit",letterSpacing:1,marginBottom:8,
          boxShadow:isPR?"0 4px 20px #f59e0b44":"0 4px 20px "+(pat?.color||"#2563EB")+"44"}}
        onClick={()=>{
          if(!kg||!reps) return;
          onLog(parseFloat(kg),parseInt(reps),note,pause,rpe);
        }}>
        {isPR?"":""}{es?"+ REGISTRAR SET":"+ LOG SET"}
      </button>
      <button onClick={()=>setShowAdvanced(v=>!v)}
        style={{width:"100%",background:"transparent",border:"none",color:textMuted,fontSize:13,fontWeight:700,cursor:"pointer",padding:"4px",fontFamily:"inherit",marginBottom:showAdvanced?10:0}}>
        {showAdvanced?"▲ ":(es?"▼ Pausa · Nota · RPE":"▼ Rest · Note · RPE")}
      </button>

      {showAdvanced&&(
        <div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>
              {es?"PAUSA":"REST"}: {fmtP(pause)}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[0,60,90,120,180,240].map(p=>(
                <button key={p} className="hov"
                  style={{padding:"8px 12px",border:"1px solid "+(pause===p?pat?.color:border),borderRadius:8,
                    background:pause===p?pat?.color+"22":"transparent",color:pause===p?pat?.color:textMuted,
                    fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                  onClick={()=>setPause(p)}>
                  {p===0?(es?"No":"Off"):fmtP(p)}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{es?"NOTA":"NOTE"}</div>
            <input style={{...inp,width:"100%"}} value={note} onChange={e=>setNote(e.target.value)} placeholder={es?"Sensaciones, técnica...":"How did it feel?"}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>
              RPE {rpe?<span style={{color:rpeColors[rpe]}}>— {rpeLabels[rpe]}</span>:null}
            </div>
            <div style={{display:"flex",gap:4}}>
              {[6,7,8,9,10].map(v=>(
                <button key={v} className="hov"
                  style={{flex:1,padding:"8px 2px",border:"1px solid "+(rpe===v?rpeColors[v]:border),
                    borderRadius:8,background:rpe===v?rpeColors[v]+"33":"transparent",
                    color:rpe===v?rpeColors[v]:textMuted,fontSize:15,fontWeight:800,
                    cursor:"pointer",fontFamily:"inherit"}}
                  onClick={()=>setRpe(v===rpe?null:v)}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function Chat({alumnoId, alumnoNombre, esEntrenador, sb, darkMode, es}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [mensajes, setMensajes] = React.useState([]);
  const [texto, setTexto] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [enviando, setEnviando] = React.useState(false);
  const endRef = React.useRef();

  React.useEffect(()=>{
    sb.getMensajes(alumnoId).then(m=>{ setMensajes(m||[]); setLoading(false); });
    // Polling cada 10 segundos
    const interval = setInterval(()=>{
      sb.getMensajes(alumnoId).then(m=>{ if(m) setMensajes(m); });
    }, 10000);
    return ()=>clearInterval(interval);
  },[]);

  React.useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[mensajes]);

  const enviar = async () => {
    if(!texto.trim() || enviando) return;
    setEnviando(true);
    const msg = {alumno_id:alumnoId, texto:texto.trim(), de_entrenador:esEntrenador, nombre:esEntrenador?"Entrenador":alumnoNombre};
    const res = await sb.addMensaje(msg);
    if(res&&res[0]) setMensajes(prev=>[...prev,res[0]]);
    setTexto("");
    setEnviando(false);
  };

  if(loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:8,padding:"8px 0"}}>
      {[1,2,3].map(i=>(
        <div key={i} style={{display:"flex",gap:8,justifyContent:i%2===0?"flex-end":"flex-start"}}>
          <div className="sk" style={{height:36,width:"65%",borderRadius:12}}/>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",height:400}}>
      <div style={{flex:1,overflowY:"auto",padding:"8px 0",marginBottom:8}}>
        {mensajes.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:textMuted,fontSize:13}}>Sin mensajes aún. ¡Escribí el primero!</div>}
        {mensajes.map((m,i)=>{
          const esMio = esEntrenador ? m.de_entrenador : !m.de_entrenador;
          return (
            <div key={i} style={{display:"flex",justifyContent:esMio?"flex-end":"flex-start",marginBottom:8}}>
              <div style={{maxWidth:"78%",
                background:m.de_entrenador?"#2563EB":"#16A34A",
                borderRadius:esMio?"14px 14px 2px 14px":"14px 14px 14px 2px",
                padding:"8px 16px"}}>
                <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.7)",marginBottom:4,letterSpacing:0.5}}>
                  {m.de_entrenador?"🏋️ Entrenador":"👤 "+m.nombre}
                </div>
                <div style={{fontSize:15,color:textMain,lineHeight:1.4}}>{m.texto}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4,textAlign:"right"}}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}) : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <input style={{flex:1,background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"12px 14px",fontFamily:"Inter,sans-serif",fontSize:15}} value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Escribí un mensaje..." onKeyDown={e=>e.key==="Enter"&&enviar()}/>
        <button style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"8px 16px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={enviar}>
          {enviando?"...":"▶"}
        </button>
      </div>
    </div>
  );
}

function ChatFlotante({alumnoId, alumnoNombre, sb, esEntrenador, darkMode}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [abierto, setAbierto] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [lastCount, setLastCount] = React.useState(0);

  React.useEffect(()=>{
    if(!alumnoId) return;
    const check = ()=>sb.getMensajes(alumnoId).then(m=>{
      if(m && m.length > lastCount && !abierto) { setUnread(m.length-lastCount); }
      setLastCount(m?.length||0);
    });
    check();
    const interval = setInterval(check, 15000);
    return ()=>clearInterval(interval);
  },[alumnoId, abierto]);

  if(!alumnoId) return null;

  return (
    <div>
      {abierto&&(
        <div style={{position:"fixed",bottom:76,right:14,width:290,maxWidth:"calc(100vw - 28px)",background:bgCard,borderRadius:16,border:"1px solid "+border,zIndex:150,padding:16,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMain}}><Ic name="message-circle" size={18}/> Chat con Entrenador</div>
            <button onClick={()=>setAbierto(false)} style={{background:"none",border:"none",color:textMuted,fontSize:22,cursor:"pointer"}}><Ic name="x" size={16}/></button>
          </div>
          <Chat darkMode={darkMode} _dm={_dm} alumnoId={alumnoId} alumnoNombre={alumnoNombre} esEntrenador={esEntrenador} sb={sb}
          es={es}/>
        </div>
      )}
      <button onClick={()=>{setAbierto(a=>!a);setUnread(0);}} style={{position:"fixed",bottom:86,right:14,background:"#2563EB",color:"#fff",border:"none",borderRadius:"50%",width:40,height:40,fontSize:15,cursor:"pointer",zIndex:149,boxShadow:"0 4px 12px rgba(239,68,68,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        💬
        {unread>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#22C55E",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}
      </button>
    </div>
  );
}

function GraficoProgreso({progress, EX, readOnly, sharedParam, sb, sessionData, es, darkMode, sesiones, allEx}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [vista, setVista] = React.useState("ejercicio"); // ejercicio | semanas | volumen
  const [selEx, setSelEx] = React.useState(null);
  const [sbData, setSbData] = React.useState([]);
  const [sesionesData, setSesionesData] = React.useState(sesiones||[]);
  const canvasRef = React.useRef();
  const canvasSem = React.useRef();
  const canvasVol = React.useRef();

  React.useEffect(()=>{
    const alumnoId = sessionData?.alumnoId || (sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(!alumnoId) return;
    sb.getProgreso(alumnoId).then(d=>{ if(d) setSbData(d); });
    sb.getSesiones(alumnoId).then(d=>{ if(d) setSesionesLocal(d); });
  },[]);

  const getDatos = (exId) => {
    const local = (progress[exId]?.sets||[]).map(s=>({kg:parseFloat(s.kg)||0,reps:parseInt(s.reps)||0,fecha:s.date})).filter(s=>s.kg>0);
    const remote = sbData.filter(d=>d.ejercicio_id===exId&&d.kg>0).map(d=>({kg:parseFloat(d.kg),reps:parseInt(d.reps)||0,fecha:d.fecha}));
    const todos = [...local,...remote].sort((a,b)=>a.fecha>b.fecha?1:-1);
    const seen = new Set();
    return todos.filter(d=>{ const k=d.fecha+d.kg; if(seen.has(k))return false; seen.add(k); return true; }).slice(-20);
  };

  const exConDatos = EX.filter(e=>{
    const local = (progress[e.id]?.sets||[]).some(s=>parseFloat(s.kg)>0);
    const remote = sbData.some(d=>d.ejercicio_id===e.id&&d.kg>0);
    return local || remote;
  });

  // PR por ejercicio
  const getPR = (exId) => {
    const datos = getDatos(exId);
    if(!datos.length) return null;
    return Math.max(...datos.map(d=>d.kg));
  };

  // Grupo muscular por ejercicio
  const MUSCULOS = {
    sq:"Piernas",leg:"Piernas",legcurl:"Piernas",legext:"Piernas",
    bp:"Pecho",inc:"Pecho",fly:"Pecho",
    row:"Espalda",pull:"Espalda",dead:"Espalda",suppu:"Espalda",
    press:"Hombros",lateralfly:"Hombros",
    curl:"Bíceps",hammer:"Bíceps",
    trico:"Tríceps",
    plank:"Core",crunch:"Core",ab:"Core"
  };
  const getMus = (id) => {
    for(const k in MUSCULOS) { if(id.includes(k)) return MUSCULOS[k]; }
    return "Otros";
  };

  // Datos de volumen semanal
  const getVolumenSemanal = () => {
    // Agrupar por s.week (semana de la rutina: 0,1,2,3)
    // Así funciona aunque el alumno haya entrenado todo en el mismo día
    const semanas = {};
    Object.values(progress||{}).forEach(pg=>{
      (pg.sets||[]).forEach(s=>{
        const w = s.week !== undefined ? s.week : 0;
        const key = "sem_"+w;
        if(!semanas[key]) semanas[key] = {series:0, tonelaje:0, maxKg:0, totalReps:0, semKey:key, week:w};
        semanas[key].series += 1;
        semanas[key].tonelaje += (parseFloat(s.kg)||0)*(parseInt(s.reps)||0);
        semanas[key].maxKg = Math.max(semanas[key].maxKg, parseFloat(s.kg)||0);
        semanas[key].totalReps += parseInt(s.reps)||0;
      });
    });
    // Ordenar por número de semana
    const ordenadas = Object.values(semanas).sort((a,b)=>a.week-b.week);
    return ordenadas.map((s,i)=>({...s, label:"Sem "+(s.week+1)}));
  };

  // Series por patron de movimiento a lo largo de semanas
  const getVolumenPorPatron = () => {
    // Usar progress real: cada set registrado tiene kg, reps, date
    const semanas = {};
    Object.entries(progress||{}).forEach(([exId, pg])=>{
      const exInfo = EX.find(e=>e.id===exId);
      const patron = exInfo?.pattern||"otros";
      (pg.sets||[]).forEach(s=>{
        const fecha = s.date||"";
        if(!fecha) return;
        // Convertir fecha a comienzo de semana
        const parts = fecha.split("/");
        let d;
        if(parts.length===3) {
          // formato dd/mm/yyyy
          d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
        } else {
          d = new Date(fecha);
        }
        if(isNaN(d.getTime())) return;
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        const semKey = startOfWeek.toISOString().slice(0,10);
        if(!semanas[semKey]) semanas[semKey] = {semKey, patrones:{}};
        if(!semanas[semKey].patrones[patron]) semanas[semKey].patrones[patron] = {series:0, reps:0, tonelaje:0};
        semanas[semKey].patrones[patron].series += 1;
        semanas[semKey].patrones[patron].reps += parseInt(s.reps)||0;
        semanas[semKey].patrones[patron].tonelaje += (parseFloat(s.kg)||0)*(parseInt(s.reps)||0);
      });
    });
    const semsOrdenadas = Object.values(semanas).sort((a,b)=>a.semKey>b.semKey?1:-1).slice(-8);
    const todosPatrones = [...new Set(semsOrdenadas.flatMap(s=>Object.keys(s.patrones)))];
    return {semanas: semsOrdenadas.map((s,i)=>({...s,label:"Sem "+(i+1)})), patrones: todosPatrones};
  };

  // Total por musculo (para el tab volumen - resumen)
  const getVolumenMuscular = () => {
    const musculos = {};
    sesionesData.forEach(ses=>{
      const ejercicios = Array.isArray(ses.ejercicios) ? ses.ejercicios : [];
      ejercicios.forEach(ex=>{
        const mus = getMus(ex.id||"");
        const sets = (ex.sets||[]).filter(s=>parseFloat(s.kg)>0);
        if(!musculos[mus]) musculos[mus] = {series:0, tonelaje:0};
        musculos[mus].series += sets.length;
        sets.forEach(s=>{ musculos[mus].tonelaje += (parseFloat(s.kg)||0)*(parseInt(s.reps)||0); });
      });
    });
    return Object.entries(musculos).map(([k,v])=>({nombre:k,...v})).sort((a,b)=>b.series-a.series);
  };

  // CANVAS: curva de progreso por ejercicio
  React.useEffect(()=>{
    try {
    if(vista!=="ejercicio"||!selEx||!canvasRef.current) return;
    const datos = getDatos(selEx);
    if(datos.length<2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W=canvas.width, H=canvas.height;
    const pad={top:30,right:20,bottom:44,left:50};
    const maxKg = Math.max(...datos.map(d=>d.kg));
    const minKg = Math.min(...datos.map(d=>d.kg));
    const range = maxKg-minKg||1;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#162234"; ctx.fillRect(0,0,W,H);
    // Grid lines
    for(let i=0;i<=4;i++){
      const y=pad.top+(H-pad.top-pad.bottom)*i/4;
      ctx.strokeStyle="#2D4057"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
      ctx.fillStyle="#8B9AB2"; ctx.font="11px DM Sans,Arial"; ctx.textAlign="right";
      ctx.fillText(Math.round(maxKg-range*i/4)+"kg",pad.left-4,y+4);
    }
    const pts = datos.map((d,i)=>({
      x:pad.left+(W-pad.left-pad.right)*i/(datos.length-1),
      y:pad.top+(H-pad.top-pad.bottom)*(1-(d.kg-minKg)/range),
      kg:d.kg, fecha:d.fecha
    }));
    // Área
    ctx.beginPath(); ctx.moveTo(pts[0].x,H-pad.bottom);
    pts.forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.lineTo(pts[pts.length-1].x,H-pad.bottom); ctx.closePath();
    ctx.fillStyle="rgba(239,68,68,0.12)"; ctx.fill();
    // Línea
    ctx.beginPath(); ctx.strokeStyle="#2563EB"; ctx.lineWidth=2.5;
    pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
    // PR line
    const prY = pad.top+(H-pad.top-pad.bottom)*(1-(maxKg-minKg)/range);
    ctx.setLineDash([4,4]); ctx.strokeStyle="#8B9AB2"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.left,prY); ctx.lineTo(W-pad.right,prY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle="#8B9AB2"; ctx.font="bold 10px DM Sans,Arial"; ctx.textAlign="left";
    ctx.fillText("PR "+maxKg+"kg",pad.left+4,prY-4);
    // Puntos
    pts.forEach((p,i)=>{
      const isPR = p.kg===maxKg;
      ctx.beginPath(); ctx.arc(p.x,p.y,isPR?6:4,0,Math.PI*2);
      ctx.fillStyle=isPR?"#8B9AB2":"#2563EB"; ctx.fill();
      if(isPR){ctx.fillStyle="#8B9AB2";ctx.font="bold 11px DM Sans,Arial";ctx.textAlign="center";ctx.fillText("★",p.x,p.y-10);}
      ctx.fillStyle="#FFFFFF"; ctx.font="10px DM Sans,Arial"; ctx.textAlign="center";
      ctx.fillText(p.kg+"kg",p.x,p.y-(isPR?22:10));
    });
    // Fechas
    ctx.fillStyle="#8B9AB2"; ctx.font="10px DM Sans,Arial"; ctx.textAlign="center";
    const step=Math.ceil(pts.length/4);
    pts.forEach((p,i)=>{ if(i%step===0||i===pts.length-1) ctx.fillText(p.fecha.slice(5),p.x,H-pad.bottom+14); });
    } catch(e){ console.error("canvas err",e); }
  },[selEx,sbData,vista]);

  // CANVAS: comparar semanas (barras)
  React.useEffect(()=>{
    try {
    if(vista!=="semanas"||!canvasSem.current) return;
    const datos = getVolumenSemanal();
    if(!datos.length) return;
    const canvas=canvasSem.current;
    const ctx=canvas.getContext("2d");
    const W=canvas.width,H=canvas.height;
    const pad={top:20,right:10,bottom:50,left:55};
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#162234"; ctx.fillRect(0,0,W,H);
    const maxSeries=Math.max(...datos.map(d=>d.series))||1;
    const maxTon=Math.max(...datos.map(d=>d.tonelaje))||1;
    const bw=(W-pad.left-pad.right)/datos.length-6;
    datos.forEach((d,i)=>{
      const x=pad.left+i*(W-pad.left-pad.right)/datos.length+3;
      // Series (azul)
      const hS=(H-pad.top-pad.bottom)*(d.series/maxSeries);
      ctx.fillStyle="#2563EB"; ctx.fillRect(x,H-pad.bottom-hS,bw*0.45,hS);
      // Tonelaje (rojo)
      const hT=(H-pad.top-pad.bottom)*(d.tonelaje/maxTon);
      ctx.fillStyle="#2563EB"; ctx.fillRect(x+bw*0.48,H-pad.bottom-hT,bw*0.45,hT);
      // Label semana
      ctx.fillStyle="#8B9AB2"; ctx.font="10px DM Sans,Arial"; ctx.textAlign="center";
      ctx.fillText(d.label,x+bw/2,H-pad.bottom+14);
      // Valores
      if(d.series>0){ctx.fillStyle="#2563EB";ctx.font="9px DM Sans,Arial";ctx.textAlign="center";ctx.fillText(d.series,x+bw*0.22,H-pad.bottom-hS-3);}
    });
    // Leyenda
    ctx.fillStyle="#2563EB"; ctx.fillRect(pad.left,8,12,10);
    ctx.fillStyle="#2D4057"; ctx.font="10px DM Sans,Arial"; ctx.textAlign="left"; ctx.fillText("Series",pad.left+15,17);
    ctx.fillStyle="#2563EB"; ctx.fillRect(pad.left+70,8,12,10);
    ctx.fillStyle="#2D4057"; ctx.fillText("Tonelaje",pad.left+85,17);
    // Eje Y
    for(let i=0;i<=4;i++){
      const y=pad.top+(H-pad.top-pad.bottom)*i/4;
      ctx.strokeStyle="#2D4057";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();
      ctx.fillStyle="#8B9AB2";ctx.font="10px DM Sans,Arial";ctx.textAlign="right";
      ctx.fillText(Math.round(maxSeries*(1-i/4)),pad.left-3,y+4);
    }
    } catch(e){ console.error("Canvas semanas:",e); }
  },[sesiones,vista]);

  const volMuscular = vista==="volumen" ? getVolumenMuscular() : [];
  const COLORS = ["#2563EB","#2563EB","#22C55E","#8B9AB2","#2563EB","#8B9AB2","#2563EB"];

  if(exConDatos.length===0 && sesionesData.length===0) return (
    <div style={{textAlign:"center",padding:"30px 0",color:textMuted}}>
      <div style={{fontSize:36,marginBottom:8}}>📊</div>
      <div style={{fontSize:15,fontWeight:700}}>Sin datos aún</div>
      <div style={{fontSize:13,marginTop:4}}>Registrá series con peso para ver el gráfico</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {[
          {k:"ejercicio", lbl:<><Ic name="activity" size={13}/> {es?"Ejercicio":"Exercise"}</>},
          {k:"semanas",   lbl:<><Ic name="calendar" size={13}/> {es?"Semanas":"Weeks"}</>},
          {k:"volumen",   lbl:<><Ic name="bar-chart-2" size={13}/> {es?"Volumen":"Volume"}</>},
        ].map(({k,lbl})=>(          <button key={k} onClick={()=>setVista(k)} style={{background:vista===k?"#2563EB":"#2D4057",color:vista===k?"#fff":"#8B9AB2",border:"none",borderRadius:8,padding:"8px 12px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",flex:1}}>
            {lbl}
          </button>
        ))}
      </div>
            {vista==="ejercicio"&&(()=>{
        // ── helpers de narrativa ──────────────────────────────
        const getNarrativa = (exId) => {
          const datos = getDatos(exId);
          if(!datos||datos.length<2) return null;
          const pr = getPR(exId);
          const primero = datos[0];
          const ultimo  = datos[datos.length-1];
          const totalSets = (progress[exId]?.sets||[]).length;
          const semanas = [...new Set((progress[exId]?.sets||[]).map(s=>s.week))].length;

          // ── Variación de carga ──
          const diffKg = pr - primero.kg;
          const pctKg  = primero.kg>0 ? Math.round(diffKg/primero.kg*100) : 0;

          // ── Frase principal ──
          let frase = "";
          if(pctKg>0){
            frase = es
              ? `Pasaste de ${primero.kg} kg a ${pr} kg — subiste un ${pctKg}% de carga.`
              : `You went from ${primero.kg} kg to ${pr} kg — a ${pctKg}% load increase.`;
          } else if(pctKg===0){
            frase = es
              ? `Mantuviste ${pr} kg en todos los registros. Intentá subir el peso la próxima semana.`
              : `You maintained ${pr} kg across all records. Try increasing weight next session.`;
          } else {
            frase = es
              ? `El máximo registrado es ${pr} kg con ${totalSets} sets en ${semanas} semana${semanas!==1?"s":""}.`
              : `Your best is ${pr} kg across ${totalSets} sets over ${semanas} week${semanas!==1?"s":""}.`;
          }

          // ── Tendencia reciente (últimos 3 registros) ──
          let tendencia = null;
          if(datos.length>=3){
            const rec = datos.slice(-3);
            const subio = rec[2].kg > rec[0].kg;
            const igual = rec[2].kg === rec[0].kg;
            tendencia = igual
              ? (es ? "Tendencia: estable en los últimos 3 registros." : "Trend: stable over last 3 records.")
              : subio
                ? (es ? `Tendencia: en alza (+${Math.round((rec[2].kg-rec[0].kg)*10)/10} kg en últimas 3 sesiones).` : `Trend: rising (+${Math.round((rec[2].kg-rec[0].kg)*10)/10} kg last 3 sessions).`)
                : (es ? `Tendencia: bajó ${Math.round((rec[0].kg-rec[2].kg)*10)/10} kg en últimas 3 sesiones — revisá la técnica o el descanso.` : `Trend: dropped ${Math.round((rec[0].kg-rec[2].kg)*10)/10} kg last 3 sessions — check form or recovery.`);
          }

          // ── PR reciente ──
          const sets = (progress[exId]?.sets||[]);
          const esPRReciente = sets.length>0 && parseFloat(sets[0]?.kg||0)===pr;
          const prMsg = esPRReciente
            ? (es ? "Rompiste tu récord personal en el último registro." : "You broke your personal record in your last session.")
            : null;

          return { frase, tendencia, prMsg, pctKg, pr, primero, ultimo, totalSets, semanas };
        };

        const exConDatosLocal = (allEx||[]).filter(e=>
          (progress[e.id]?.sets||[]).some(s=>parseFloat(s.kg)>0)
        );

        if(exConDatosLocal.length===0) return (
          <div style={{textAlign:"center",padding:"40px 16px"}}>
            <div style={{fontSize:44,marginBottom:12}}>📊</div>
            <div style={{fontSize:17,fontWeight:700,color:textMain,marginBottom:8}}>{es?"Sin datos aún":"No data yet"}</div>
            <div style={{fontSize:13,color:textMuted,lineHeight:1.6}}>{es?"Registrá sets con peso en tu entrenamiento para ver tu progreso.":"Log sets with weight to see your progress here."}</div>
          </div>
        );

        const narrativa = selEx ? getNarrativa(selEx) : null;

        return (
          <div>
            {/* Selector de ejercicios */}
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
              {exConDatosLocal.map(e=>{
                const pr=getPR(e.id);
                const nar=getNarrativa(e.id);
                const isUp = nar&&nar.pctKg>0;
                return (
                  <button key={e.id} onClick={()=>setSelEx(e.id)}
                    style={{background:selEx===e.id?"#2563EB":bgSub,
                      border:"1px solid "+(selEx===e.id?"#2563EB":border),
                      borderRadius:20,padding:"8px 12px",cursor:"pointer",
                      display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
                    <span style={{fontSize:12,color:selEx===e.id?"#fff":textMain,fontWeight:600}}>{e.name}</span>
                    {pr>0&&<span style={{fontSize:10,color:selEx===e.id?"rgba(255,255,255,0.8)":isUp?"#22C55E":"#8B9AB2",fontWeight:700}}>{pr}kg</span>}
                    {isUp&&<span style={{fontSize:9,color:selEx===e.id?"#90EE90":"#22C55E",fontWeight:700}}>+{nar.pctKg}%</span>}
                  </button>
                );
              })}
            </div>

            {selEx&&narrativa&&(
              <div>
                {/* Tarjeta de narrativa */}
                <div style={{background:narrativa.prMsg?"#0c1f12":bgSub,
                  border:"1px solid "+(narrativa.prMsg?"#1a3d22":border),
                  borderRadius:14,padding:"16px",marginBottom:12}}>
                  {narrativa.prMsg&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{background:"#22C55E",borderRadius:6,padding:"4px 8px",fontSize:11,color:"#fff",fontWeight:700}}>PR</div>
                      <div style={{fontSize:12,color:"#4ade80",fontWeight:600}}>{narrativa.prMsg}</div>
                    </div>
                  )}
                  <div style={{fontSize:14,color:narrativa.prMsg?"#d1fae5":textMain,lineHeight:1.65,marginBottom:narrativa.tendencia?10:0,fontWeight:500}}>
                    {narrativa.frase}
                  </div>
                  {narrativa.tendencia&&(
                    <div style={{fontSize:12,color:textMuted,lineHeight:1.5,borderTop:"1px solid "+(narrativa.prMsg?"#1a3d22":border),paddingTop:8,marginTop:4}}>
                      {narrativa.tendencia}
                    </div>
                  )}
                </div>

                {/* Stats compactos */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                  <div style={{background:bgSub,borderRadius:10,padding:"8px 8px",textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:800,color:"#2563EB"}}>{narrativa.pr}kg</div>
                    <div style={{fontSize:10,color:textMuted,marginTop:2}}>PR</div>
                  </div>
                  <div style={{background:bgSub,borderRadius:10,padding:"8px 8px",textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:800,color:narrativa.pctKg>0?"#22C55E":narrativa.pctKg<0?"#EF4444":textMuted}}>
                      {narrativa.pctKg>0?"+":""}{narrativa.pctKg}%
                    </div>
                    <div style={{fontSize:10,color:textMuted,marginTop:2}}>{es?"vs inicio":"vs start"}</div>
                  </div>
                  <div style={{background:bgSub,borderRadius:10,padding:"8px 8px",textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:800,color:textMain}}>{narrativa.totalSets}</div>
                    <div style={{fontSize:10,color:textMuted,marginTop:2}}>sets</div>
                  </div>
                </div>

                {/* Gráfico de línea con canvas */}
                {getDatos(selEx).length>=2&&(
                  <div style={{borderRadius:12,overflow:"hidden",marginBottom:8}}>
                    <canvas ref={canvasRef} width={340} height={180} style={{width:"100%",height:"auto",display:"block"}}/>
                  </div>
                )}

                {/* Mini historial de últimos registros */}
                <div style={{marginTop:8}}>
                  <div style={{fontSize:11,color:textMuted,fontWeight:600,marginBottom:8,letterSpacing:.5}}>{es?"ÚLTIMOS REGISTROS":"RECENT RECORDS"}</div>
                  {getDatos(selEx).slice(-5).reverse().map((d,i)=>{
                    const isPR2 = d.kg===narrativa.pr;
                    return(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid "+border}}>
                        <div style={{fontSize:12,color:textMuted,minWidth:70}}>{d.fecha||"—"}</div>
                        <div style={{flex:1,background:bgSub,borderRadius:6,height:6,overflow:"hidden"}}>
                          <div style={{height:"100%",background:isPR2?"#22C55E":"#2563EB",borderRadius:6,width:Math.round(d.kg/narrativa.pr*100)+"%",transition:"width .3s"}}/>
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:isPR2?"#22C55E":textMain,minWidth:50,textAlign:"right"}}>{d.kg}kg</div>
                        {isPR2&&<div style={{fontSize:10,color:"#22C55E",fontWeight:700}}>PR</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selEx&&!narrativa&&(
              <div style={{textAlign:"center",padding:"32px 16px"}}>
                <div style={{fontSize:40,marginBottom:8}}>🏋️</div>
                <div style={{fontSize:15,fontWeight:700,color:textMain,marginBottom:8}}>{es?"Falta un registro más":"One more record needed"}</div>
                <div style={{fontSize:13,color:textMuted,lineHeight:1.6}}>{es?"Registrá al menos 2 sesiones de este ejercicio para ver tu evolución.":"Log at least 2 sessions of this exercise to see your evolution."}</div>
              </div>
            )}
          </div>
        );
      })()}
{vista==="semanas"&&(()=>{
        const sem = getVolumenSemanal();
        if(sem.length===0) return (
          <div style={{textAlign:"center",padding:"40px 16px"}}>
            <div style={{fontSize:44,marginBottom:12}}>📅</div>
            <div style={{fontSize:17,fontWeight:700,color:textMain,marginBottom:8}}>{es?"Sin datos aún":"No data yet"}</div>
            <div style={{fontSize:13,color:textMuted,lineHeight:1.6}}>{es?"Registrá sets en tu entrenamiento para ver tu evolución.":"Log sets in your workout to see your evolution."}</div>
          </div>
        );
        const maxSeries = Math.max(...sem.map(s=>s.series), 1);
        const maxKg     = Math.max(...sem.map(s=>s.maxKg), 1);
        const maxTon    = Math.max(...sem.map(s=>s.tonelaje), 1);
        const ultima    = sem[sem.length-1];
        const anterior  = sem.length>=2 ? sem[sem.length-2] : null;
        const diffSeries = anterior&&anterior.series>0 ? Math.round((ultima.series-anterior.series)/anterior.series*100) : null;
        const diffKg     = anterior&&anterior.maxKg>0   ? Math.round((ultima.maxKg-anterior.maxKg)/anterior.maxKg*100)   : null;
        return (
          <div>
            {anterior&&(
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <div style={{background:bgSub,borderRadius:10,padding:"8px 10px",textAlign:"center",flex:1}}>
                  <div style={{fontSize:20,fontWeight:800,color:"#2563EB"}}>{ultima.series}</div>
                  <div style={{fontSize:10,color:textMuted}}>{es?"Series":"Sets"}</div>
                  {diffSeries!==null&&<div style={{fontSize:11,fontWeight:700,color:diffSeries>=0?"#22C55E":"#EF4444"}}>{diffSeries>=0?"+":""}{diffSeries}%</div>}
                </div>
                <div style={{background:bgSub,borderRadius:10,padding:"8px 10px",textAlign:"center",flex:1}}>
                  <div style={{fontSize:20,fontWeight:800,color:"#22C55E"}}>{ultima.maxKg}kg</div>
                  <div style={{fontSize:10,color:textMuted}}>{es?"Max kg":"Max kg"}</div>
                  {diffKg!==null&&<div style={{fontSize:11,fontWeight:700,color:diffKg>=0?"#22C55E":"#EF4444"}}>{diffKg>=0?"+":""}{diffKg}%</div>}
                </div>
                <div style={{background:bgSub,borderRadius:10,padding:"8px 10px",textAlign:"center",flex:1}}>
                  <div style={{fontSize:20,fontWeight:800,color:"#8B9AB2"}}>{Math.round(ultima.tonelaje/1000*10)/10}t</div>
                  <div style={{fontSize:10,color:textMuted}}>{es?"Tonelaje":"Volume"}</div>
                </div>
              </div>
            )}
            <div style={{fontSize:12,color:textMuted,marginBottom:8,fontWeight:600}}>{es?"Series por semana":"Sets per week"}</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:4,height:120,marginBottom:16}}>
              {sem.map((s,i)=>{
                const pct = Math.max((s.series/maxSeries)*100, 3);
                const isLast = i===sem.length-1;
                return (
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <div style={{fontSize:10,color:isLast?"#2563EB":textMuted,fontWeight:700}}>{s.series}</div>
                    <div style={{width:"100%",height:pct+"%",background:isLast?"#2563EB":"#2563EB55",borderRadius:"3px 3px 0 0",minHeight:4}}/>
                    <div style={{fontSize:10,color:isLast?textMain:textMuted,fontWeight:isLast?700:400}}>{s.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:12,color:textMuted,marginBottom:8,fontWeight:600}}>{es?"Kg máximo por semana":"Max kg per week"}</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100,marginBottom:8}}>
              {sem.map((s,i)=>{
                const pct = Math.max((s.maxKg/maxKg)*100, 3);
                const isLast = i===sem.length-1;
                return (
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <div style={{fontSize:10,color:isLast?"#22C55E":textMuted,fontWeight:700}}>{s.maxKg>0?s.maxKg+"kg":""}</div>
                    <div style={{width:"100%",height:pct+"%",background:isLast?"#22C55E":"#22C55E55",borderRadius:"3px 3px 0 0",minHeight:4}}/>
                    <div style={{fontSize:10,color:isLast?textMain:textMuted,fontWeight:isLast?700:400}}>{s.label}</div>
                  </div>
                );
              })}
            </div>
            {sem.length===1&&(
              <div style={{textAlign:"center",padding:"8px",fontSize:12,color:textMuted,background:bgSub,borderRadius:8}}>
                {es?"💪 Completá la Semana 2 para ver tu evolución":"💪 Complete Week 2 to see your evolution"}
              </div>
            )}
          </div>
        );
      })()}
      {vista==="volumen"&&(()=>{
        const {semanas:semsVol, patrones:patsVol} = getVolumenPorPatron();
        const PAT_COLORS = {empuje:"#2563EB",traccion:"#2563EB",rodilla:"#22C55E",bisagra:"#8B9AB2",core:"#8B9AB2",movilidad:"#2563EB",cardio:"#60A5FA",oly:"#8B9AB2",otros:"#8B9AB2"};
        const PAT_LABELS = {empuje:"Empuje",traccion:"Traccion",rodilla:"Rodilla/Cuads",bisagra:"Bisagra/Glu",core:"Core",movilidad:"Movilidad",cardio:"Cardio",oly:"Olimpico",otros:"Otros"};
        // Calcular totales por patron
        const totalesPorPatron = {};
        patsVol.forEach(pat=>{
          totalesPorPatron[pat] = semsVol.reduce((acc,s)=>{
            const d = s.patrones[pat]||{series:0,reps:0,tonelaje:0};
            return {series:acc.series+(d.series||0), reps:acc.reps+(d.reps||0), tonelaje:acc.tonelaje+(d.tonelaje||0)};
          }, {series:0,reps:0,tonelaje:0});
        });
        if(semsVol.length===0) return (
          <div style={{textAlign:"center",padding:"32px 16px"}}>
            <div style={{fontSize:44,marginBottom:12}}>💪</div>
            <div style={{fontSize:18,fontWeight:700,color:textMain,marginBottom:8}}>{es?"Sin sesiones aún":"No sessions yet"}</div>
            <div style={{fontSize:13,color:textMuted,lineHeight:1.5}}>{es?"Completá tu primer entrenamiento para ver el análisis de volumen por patrón muscular":"Complete your first workout to unlock volume analysis by muscle pattern"}</div>
          </div>
        );
        return (
          <div>
            <div style={{fontSize:15,color:textMuted,marginBottom:12,fontWeight:700}}>Series por patron — {semsVol.length} semanas</div>
            {patsVol.map((pat,pi)=>{
              const col = PAT_COLORS[pat]||"#8B9AB2";
              const maxVal = Math.max(...semsVol.map(s=>(s.patrones[pat]?.series||0)),1);
              return (
                <div key={pat} style={{marginBottom:16}}>
                  <div style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:22,fontWeight:900,color:col}}>{PAT_LABELS[pat]||pat}</span>
                      <span style={{fontSize:18,fontWeight:900,color:col}}>{totalesPorPatron[pat]?.series||0} series</span>
                    </div>
                    <div style={{fontSize:15,color:textMuted,marginBottom:8}}>
                      {totalesPorPatron[pat]?.reps||0} reps totales · {Math.round(totalesPorPatron[pat]?.tonelaje||0).toLocaleString()} kg tonelaje
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"flex-end",height:60}}>
                    {semsVol.map((s,si)=>{
                      const val = s.patrones[pat]?.series||0;
                      const pct = val/maxVal;
                      return (
                        <div key={si} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                          <div style={{fontSize:13,color:col,fontWeight:900}}>{val>0?val:""}</div>
                          <div style={{width:"100%",background:col,borderRadius:"3px 3px 0 0",height:Math.max(pct*50,val>0?4:0),opacity:0.85}}/>
                          <div style={{fontSize:13,color:textMuted,whiteSpace:"nowrap",fontWeight:700}}>{s.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
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
          setSesionesLocal(ses||[]);
        }
      } catch(e) {}
      setLoading(false);
    };
    load();
  },[]);

  if(loading) return (
    <div>
      {[1,2,3,4].map(i=>(
        <div key={i} style={{background:bgCard,borderRadius:12,padding:"8px 12px",marginBottom:8,border:"1px solid "+border}}>
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
        <div key={i} style={{background:bgCard,borderRadius:12,padding:"16px 18px",marginBottom:8,border:"1px solid "+border}}>
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
      const res = await sb.addFoto({alumno_id: alumnoId, imagen: base64, fecha, nota:""});
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
        <div key={i} className="sk" style={{aspectRatio:"1",borderRadius:12}}/>
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
          <div key={f.id||i} style={{borderRadius:12,overflow:"hidden",position:"relative"}}>
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
          <img src={fotoGrande.imagen} style={{maxWidth:"100%",maxHeight:"80vh",objectFit:"contain",borderRadius:12}}/>
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

function GestionBiblioteca({sb, customEx, setCustomEx, toast2, es, darkMode}) {
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
  const [ytOverrides, setYtOverrides] = React.useState(()=>{try{return JSON.parse(localStorage.getItem("it_yt_ov")||"{}")}catch(e){return {}}});

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
    } else {
      // Ejercicio base: guardar solo el override de youtube
      const newOverrides = {...ytOverrides, [editModal.id]: editYT};
      setYtOverrides(newOverrides);
      localStorage.setItem("it_yt_ov", JSON.stringify(newOverrides));
    }
    setEditModal(null); toast2(es?"Link actualizado ✓":"Link updated ✓");
  };
  const borrarEjercicio = (id) => {
    const updated = customEx.filter(e=>e.id!==id);
    setCustomEx(updated);
    localStorage.setItem("it_cex", JSON.stringify(updated));
    setBorrarId(null); toast2(es?"Ejercicio eliminado ✓":"Exercise deleted ✓");
  };
  const agregarEjercicio = () => {
    if(!newNombre.trim()){toast2(es?"Ingresa un nombre":"Enter a name");return;}
    const newEx = {id:"custom_"+Date.now(), name:newNombre, nameEn:newNombre, pattern:newPat, muscle:newMus, equip:newEquip||"Libre", youtube:newYT};
    const updated = [...(customEx||[]), newEx];
    setCustomEx(updated);
    localStorage.setItem("it_cex", JSON.stringify(updated));
    setNewNombre(""); setNewPat("empuje"); setNewMus(""); setNewEquip(""); setNewYT("");
    setTab(0); toast2(es?"Ejercicio agregado ✓":"Exercise added ✓");
  };
  const inpS = {background:bg,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",color:textMain,fontSize:15,width:"100%",fontFamily:"inherit",outline:"none",marginBottom:8};

  return (
    <div>
      <div style={{display:"flex",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),marginBottom:12}}>
        {[es?"GESTIONAR":"MANAGE", es?"+ NUEVO":"+ NEW"].map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)} style={{flex:1,padding:"16px",border:"none",background:"none",
            fontFamily:"inherit",fontSize:18,fontWeight:800,cursor:"pointer",
            color:tab===i?"#2563EB":"#8B9AB2",borderBottom:tab===i?"2px solid #3B82F6":"2px solid transparent"}}>
            {t}{i===0&&dupCount>0?<span style={{marginLeft:8,background:"#2563EB",color:"#fff",borderRadius:12,padding:"1px 7px",fontSize:13}}>{dupCount}</span>:null}
          </button>
        ))}
      </div>

      {tab===0&&(
        <div>
          <input style={{...inpS,marginBottom:8}} placeholder={es?"🔍 Buscar ejercicio...":"🔍 Search exercise..."} value={busq} onChange={e=>setBusq(e.target.value)}/>

          <div style={{display:"flex",background:bgSub,border:"1px solid "+border,borderRadius:12,padding:4,gap:4,marginBottom:8}}>
            {[es?"POR PATRON":"BY PATTERN", es?"POR MUSCULO":"BY MUSCLE"].map((t,i)=>(
              <button key={i} onClick={()=>{setModoFiltro(i===0?"patron":"musculo");setFiltPat("todos");setFiltMus("todos");}}
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
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:20,width:"100%",maxWidth:480,border:"1px solid "+border}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>{es?"Editar ejercicio":"Edit exercise"}</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{es?"NOMBRE":"NAME"}</div>
              <input style={inpS} value={editNombre} onChange={e=>setEditNombre(e.target.value)}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>LINK YOUTUBE</div>
              <div style={{fontSize:11,color:"#60A5FA",marginBottom:8}}><Ic name="info" size={14} color="#60a5fa"/> {es?"Ideal: video corto -30 seg (YouTube Shorts)":"Ideal: short video -30 sec (YouTube Shorts)"}</div>
              <input style={inpS} value={editYT} onChange={e=>setEditYT(e.target.value)} placeholder="https://youtube.com/shorts/..."/>
              {editYT&&(editYT.includes("youtube")||editYT.includes("youtu.be"))&&(
                <div style={{marginTop:8,fontSize:13,color:"#22C55E",fontWeight:700}}>▶️ {es?"Link valido ✓":"Valid link ✓"}</div>
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
                  <div key={i} style={{background:bg,border:"1px solid "+border,borderRadius:12,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
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
                  <div key={i} style={{background:bgCard,border:"1px solid #243040",borderRadius:12,padding:12,marginBottom:8}}>
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


function DashboardEntrenador({alumnos, sesiones, es, onVerAlumno, onChatAlumno, darkMode, progress={}, session=null, routines=[], pagosEstado={}, togglePago=()=>{}}) {
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
      <div style={{...sec}}>{es?"ESTA SEMANA":"THIS WEEK"}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:20}}>
        {[
          {v:totalSesiones,       lbl:es?"SESIONES":"SESSIONS",   col:"#22C55E"},
          {v:alumnosSinEntrenar.length, lbl:es?"SIN ENTRENAR":"INACTIVE",  col:textMuted},
          {v:alumnos.filter(a=>(pagosEstado[a.id]||"pendiente")==="pendiente").length, lbl:es?"PAGO PEND.":"PAYMENT DUE", col:"#fbbf24"},
          {v:alumnos.filter(a=>pagosEstado[a.id]==="vencido").length, lbl:es?"VENCIDOS":"OVERDUE", col:"#f87171"},
        ].map((s,i)=>(
          <div key={i} style={{background:bgCard,border:"1px solid "+s.col+"33",borderRadius:12,padding:"16px 14px"}}>
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
                  {tel&&(
                    <a href={"https://wa.me/549"+tel+"?text="+waMsg} target="_blank"
                      style={{background:"#25D36622",color:"#25D366",border:"1px solid #25D36633",
                        borderRadius:8,padding:"8px 10px",fontSize:18,textDecoration:"none",
                        display:"flex",alignItems:"center"}}>💬</a>
                  )}
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
              const alumnoProgress = routines
                .filter(r=>r.alumno_id===a.id)
                .flatMap(r=>r.days||[])
                .flatMap(d=>[...(d.exercises||[]),(d.warmup||[])].flat())
                .reduce((acc,ex)=>{
                  if(ex?.id && a.progress?.[ex.id]) acc[ex.id]=a.progress[ex.id];
                  return acc;
                }, {});

              // ── Narrativa inteligente ──────────────────────────────
              const getNarrativaAlumno = () => {
                // PR reciente: algún set del alumno supera el máximo anterior
                let prReciente = null;
                let mejorPct = 0;
                let ejercicioCaida = null;

                const progData = a.progress||{};
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


function LibraryAlumno({allEx, es, darkMode}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [grupoActivo, setGrupoActivo] = React.useState("todos");
  const [q, setQ] = React.useState("");

  const GRUPOS = [
    {key:"todos",     label:"TODO",       labelEn:"ALL",        icon:"⚡",  color:"#2563EB"},
    {key:"cuad",      label:"CUADRICEPS", labelEn:"QUADS",      icon:"R",  color:"#22C55E"},
    {key:"isquios",   label:"ISQUIOS",    labelEn:"HAMSTRINGS", icon:"R",  color:"#8B9AB2"},
    {key:"gluteos",   label:"GLUTEOS",    labelEn:"GLUTES",     icon:"GL",  color:"#8B9AB2"},
    {key:"pecho",     label:"PECHO",      labelEn:"CHEST",      icon:"E",  color:"#2563EB"},
    {key:"espalda",   label:"ESPALDA",    labelEn:"BACK",       icon:"T",  color:"#2563EB"},
    {key:"brazos",    label:"BRAZOS",     labelEn:"ARMS",       icon:"BR", color:"#2563EB"},
    {key:"core",      label:"CORE",       labelEn:"CORE",       icon:"·",  color:"#8B9AB2"},
    {key:"movilidad", label:"MOVILIDAD",  labelEn:"MOBILITY",   icon:"·",  color:"#2563EB"},
    {key:"cardio",    label:"CARDIO",     labelEn:"CARDIO",     icon:"C",  color:"#60A5FA"},
    {key:"oly",       label:"OLIMPICOS",  labelEn:"OLYMPIC",    icon:"B",  color:"#8B9AB2"},
  ];

  const matchGrupo = (e, key) => {
    if (key === "todos")    return true;
    if (key === "cuad")     return e.pattern === "rodilla";
    if (key === "isquios")  return e.pattern === "bisagra" && !/glut/i.test(e.muscle||"");
    if (key === "gluteos")  return e.pattern === "bisagra" && /glut/i.test(e.muscle||"");
    if (key === "pecho")    return e.pattern === "empuje"  && /pecho/i.test(e.muscle||"");
    if (key === "espalda")  return e.pattern === "traccion" && !/bicep|tricep/i.test(e.muscle||"");
    if (key === "brazos")   return (e.pattern === "empuje" || e.pattern === "traccion") && /bicep|tricep/i.test(e.muscle||"");
    if (key === "core")     return e.pattern === "core";
    if (key === "movilidad")return e.pattern === "movilidad";
    if (key === "cardio")   return e.pattern === "cardio";
    if (key === "oly")      return e.pattern === "oly";
    return false;
  };

  const filtered = (allEx||[]).filter(e => {
    const nombre = es ? e.name : (e.nameEn || e.name);
    const matchQ = !q || nombre.toLowerCase().includes(q.toLowerCase());
    return matchQ && matchGrupo(e, grupoActivo);
  });

  const g = GRUPOS.find(x => x.key === grupoActivo);
  const card = {background:bgCard,border:"1px solid "+border,borderRadius:12,padding:"16px 18px",marginBottom:8};
  const tagStyle = col => ({background:"#162234",color:"#8B9AB2",padding:"2px 7px",borderRadius:6,fontSize:11,fontWeight:700,border:"1px solid #2D4057"});
  const PAT_COLORS = {rodilla:"#8B9AB2",bisagra:"#8B9AB2",empuje:"#8B9AB2",traccion:"#8B9AB2",core:"#8B9AB2",movilidad:"#2563EB",cardio:"#60A5FA",oly:"#8B9AB2"};

  return (
    <div>
      <input
        placeholder={es?"Buscar ejercicio...":"Search exercise..."}
        value={q} onChange={e=>setQ(e.target.value)}
        style={{background:bgSub,border:"1px solid "+border,borderRadius:12,padding:"12px 14px",
          color:textMain,fontSize:15,width:"100%",marginBottom:12,fontFamily:"inherit",outline:"none"}}
      />
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:12,scrollbarWidth:"none"}}>
        {GRUPOS.map(gr=>(
          <button key={gr.key} onClick={()=>{setGrupoActivo(gr.key);setQ("");}}
            style={{padding:"8px 13px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer",
              border: grupoActivo===gr.key ? "1px solid "+gr.color : "1px solid "+border,
              background: grupoActivo===gr.key ? "#2563EB22" : "#162234",
              color: grupoActivo===gr.key ? "#2563EB" : "#8B9AB2",
              whiteSpace:"nowrap",fontFamily:"inherit"}}>
            {gr.icon} {es?gr.label:gr.labelEn}
          </button>
        ))}
      </div>
      {grupoActivo !== "todos" && !q && g && (
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"8px 12px",
          background:g.color+"15",border:"1px solid "+g.color+"33",borderRadius:12}}>
          <span style={{fontSize:22}}>{g.icon}</span>
          <div style={{fontSize:18,fontWeight:900,color:g.color}}>{es?g.label:g.labelEn}</div>
          <div style={{marginLeft:"auto",fontSize:13,color:g.color,fontWeight:700}}>{filtered.length} {es?"ejercicios":"exercises"}</div>
        </div>
      )}
      <div style={{fontSize:13,color:textMuted,marginBottom:8}}>{filtered.length} {es?"ejercicios":"exercises"}</div>
      {filtered.map(e => {
        const nombre = es ? e.name : (e.nameEn || e.name);
        const patCol = PAT_COLORS[e.pattern] || "#8B9AB2";
        return (
          <div key={e.id} style={{background:bgCard,border:"1px solid "+border,borderRadius:12,padding:"16px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:18,fontWeight:800,color:textMain,marginBottom:8}}>{nombre}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{background:"#162234",color:"#8B9AB2",padding:"4px 8px",borderRadius:20,fontSize:11,fontWeight:700,border:"1px solid "+border}}>{e.pattern?.toUpperCase()}</span>
                  {e.muscle&&<span style={{color:textMuted,fontSize:11}}>{e.muscle}</span>}
                </div>
              </div>
              {e.youtube&&(
                <a href={e.youtube} target="_blank" rel="noopener noreferrer"
                  style={{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",
                    background:"#162234",color:"#8B9AB2",border:"1px solid "+border,
                    borderRadius:12,textDecoration:"none",fontSize:18,flexShrink:0}}>▶</a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function OnboardingScreen({es, darkMode, onDone}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg      = _dm?"#0F1923":"#F0F4F8";
  const bgCard  = _dm?"#1E2D40":"#FFFFFF";
  const bgSub   = _dm?"#162234":"#EEF2F7";
  const border  = _dm?"#2D4057":"#E2E8F0";
  const textMain= _dm?"#FFFFFF":"#0F1923";
  const textMuted=_dm?"#8B9AB2":"#64748B";

  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState(null); // "entrenador" | "alumno"

  const STEPS = [
    {
      id: "welcome",
      icon: <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
      title: es?"Bienvenido a IRON TRACK":"Welcome to IRON TRACK",
      subtitle: es?"La herramienta de entrenamiento que se adapta a tu método, no al revés.":"The training tool that adapts to your method, not the other way around.",
      content: null,
    },
    {
      id: "role",
      icon: <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      title: es?"¿Cómo vas a usar la app?":"How will you use the app?",
      subtitle: es?"Esto ajusta la experiencia para vos.":"This customizes the experience for you.",
      content: "role",
    },
    {
      id: "features",
      icon: <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      title: es?"Todo listo":"You're all set",
      subtitle: es?"Empezá a entrenar con sistema.":"Start training with a system.",
      content: "features",
    },
  ];

  const cur = STEPS[step];
  const canNext = step !== 1 || role !== null;

  const FEATURES_COACH = [
    {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
     text: es?"Armá rutinas con progresión automática de carga":"Build routines with auto load progression"},
    {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
     text: es?"Seguí el progreso de cada alumno en tiempo real":"Track each athlete's progress in real time"},
    {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
     text: es?"Chat integrado dentro del entrenamiento":"Chat integrated into the workout flow"},
  ];

  const FEATURES_ALUMNO = [
    {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
     text: es?"Sabés exactamente qué levantar cada semana":"Know exactly what to lift each week"},
    {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
     text: es?"Ve tu progreso en palabras, no solo números":"See your progress in words, not just numbers"},
    {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
     text: es?"Célébrate tus récords personales automáticamente":"Celebrate your PRs automatically"},
  ];

  const features = role === "alumno" ? FEATURES_ALUMNO : FEATURES_COACH;

  // Animación de step
  return (
    <div style={{
      minHeight:"100vh", background:bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:"24px 20px",
      fontFamily:"Inter,sans-serif"
    }}>
      {/* Logo */}
      <div style={{marginBottom:32}}>
        <IronTrackLogo size={24} color="#2563EB" showBar={true}/>
      </div>

      {/* Indicador de pasos */}
      <div style={{display:"flex",gap:8,marginBottom:40}}>
        {STEPS.map((_,i)=>(
          <div key={i} style={{
            height:4, borderRadius:2, transition:"all .3s",
            width: i===step ? 28 : 12,
            background: i<=step ? "#2563EB" : border,
          }}/>
        ))}
      </div>

      {/* Card principal */}
      <div style={{
        width:"100%", maxWidth:400,
        background:bgCard, borderRadius:20, padding:"32px 24px",
        border:"1px solid "+border,
      }}>
        {/* Ícono */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
          <div style={{
            width:88, height:88, borderRadius:24,
            background:"#2563EB12", border:"1px solid #2563EB22",
            display:"flex",alignItems:"center",justifyContent:"center"
          }}>
            {cur.icon}
          </div>
        </div>

        {/* Texto */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:22,fontWeight:800,color:textMain,lineHeight:1.3,marginBottom:10}}>
            {cur.title}
          </div>
          <div style={{fontSize:14,color:textMuted,lineHeight:1.7}}>
            {cur.subtitle}
          </div>
        </div>

        {/* Contenido dinámico por paso */}
        {cur.content==="role"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:8}}>
            {[
              {id:"entrenador",
               icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
               label: es?"Soy entrenador / coach":"I'm a coach",
               desc:  es?"Gestiono alumnos y armo rutinas":"I manage athletes and build routines"},
              {id:"alumno",
               icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
               label: es?"Soy atleta / alumno":"I'm an athlete",
               desc:  es?"Sigo el plan de mi entrenador":"I follow my coach's program"},
            ].map(opt=>(
              <button key={opt.id} onClick={()=>setRole(opt.id)}
                style={{
                  display:"flex",alignItems:"center",gap:14,
                  padding:"14px 16px",borderRadius:12,cursor:"pointer",
                  fontFamily:"inherit",textAlign:"left",
                  background: role===opt.id ? "#2563EB18" : bgSub,
                  border:"2px solid "+(role===opt.id?"#2563EB":border),
                  transition:"all .15s"
                }}>
                <div style={{
                  width:40,height:40,borderRadius:10,flexShrink:0,
                  background: role===opt.id?"#2563EB":"#2D405788",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color: role===opt.id?"#fff":textMuted,
                }}>
                  {opt.icon}
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:textMain}}>{opt.label}</div>
                  <div style={{fontSize:12,color:textMuted,marginTop:2}}>{opt.desc}</div>
                </div>
                {role===opt.id&&(
                  <div style={{marginLeft:"auto",flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 11 4 6"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {cur.content==="features"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:8}}>
            {features.map((f,i)=>(
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:12,
                padding:"12px 14px",borderRadius:10,
                background:bgSub,border:"1px solid "+border
              }}>
                <div style={{
                  width:34,height:34,borderRadius:8,flexShrink:0,
                  background:"#2563EB12",
                  display:"flex",alignItems:"center",justifyContent:"center"
                }}>{f.icon}</div>
                <div style={{fontSize:13,color:textMuted,lineHeight:1.5}}>{f.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botones de navegación */}
      <div style={{width:"100%",maxWidth:400,marginTop:16,display:"flex",gap:10}}>
        {step > 0 && (
          <button onClick={()=>setStep(s=>s-1)}
            style={{
              flex:1,padding:"14px",borderRadius:12,
              background:"transparent",border:"1px solid "+border,
              color:textMuted,fontSize:14,fontWeight:600,
              cursor:"pointer",fontFamily:"inherit"
            }}>
            {es?"Atrás":"Back"}
          </button>
        )}
        <button
          disabled={!canNext}
          onClick={()=>{ step < STEPS.length-1 ? setStep(s=>s+1) : onDone(); }}
          style={{
            flex:3,padding:"14px",borderRadius:12,
            background: canNext?"#2563EB":"#2D4057",
            color: canNext?"#fff":textMuted,
            border:"none",fontSize:15,fontWeight:700,
            cursor: canNext?"pointer":"default",
            fontFamily:"inherit",transition:"all .2s",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8
          }}>
          {step < STEPS.length-1
            ? <>{es?"Continuar":"Continue"} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
            : <>{es?"Ingresar a la app":"Enter the app"} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 11 4 6"/></svg></>
          }
        </button>
      </div>

      {/* Skip */}
      {step < STEPS.length-1 && (
        <button onClick={onDone}
          style={{
            marginTop:16,background:"transparent",border:"none",
            color:textMuted,fontSize:12,cursor:"pointer",
            fontFamily:"inherit",textDecoration:"underline"
          }}>
          {es?"Saltar introducción":"Skip intro"}
        </button>
      )}
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
      <div style={{background:bgCard,margin:"20px 16px",borderRadius:16,padding:"20px 16px",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
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
          <div key={wi} style={{background:_dm?"#162234":"#EEF2F7",borderRadius:12,padding:"8px 12px",marginBottom:8}}>
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
