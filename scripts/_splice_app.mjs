import fs from "fs";
const p = new URL("../App.jsx", import.meta.url);
let text = fs.readFileSync(p, "utf8");
let lines = text.split(/\r?\n/);

const removeRange = (start1, end1) => {
  const n = end1 - start1 + 1;
  lines.splice(start1 - 1, n);
};

removeRange(1335, 1694);
removeRange(2629 - 360, 2739 - 360);

fs.writeFileSync(p, lines.join("\n"), "utf8");
console.log("done, lines:", lines.length);
