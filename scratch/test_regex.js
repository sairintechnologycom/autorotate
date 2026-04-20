const regex = /\bsk-proj-[A-Za-z0-9_-]{32,}\b/;
const val = "sk-proj-" + "0".repeat(30);
console.log("Value:", val);
console.log("Length:", val.length);
console.log("Match:", val.match(regex));
