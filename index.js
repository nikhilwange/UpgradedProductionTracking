// Dummy index.cjs to prevent static shim from crashing
console.log("Dummy index.cjs loaded");
module.exports = {};
setInterval(() => {}, 1000 * 60 * 60); // Keep alive for 1 hour

