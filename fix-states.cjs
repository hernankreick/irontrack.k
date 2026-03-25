const fs=require("fs");
let c=fs.readFileSync("App.jsx","utf8");
const marker="} = useAlumnos({ sb });";
const idx=c.indexOf(marker);
if(idx===-1){console.log("ERROR: no encontre useAlumnos");process.exit(1);}
const insert=marker+"\n  const [rutinasSB, setRutinasSB] = useState([]);\n  const [registrosSubTab, setRegistrosSubTab] = useState(0);\n  const [sesionesGlobales, setSesionesGlobales] = useState([]);\n  const [progresoGlobal, setProgresoGlobal] = useState({});\n  const [sugerencias, setSugerencias] = useState({});";
c=c.replace(marker,insert);
fs.writeFileSync("App.jsx",c,"utf8");
console.log("LISTO - states agregados");
