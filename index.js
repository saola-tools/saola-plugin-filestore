module.exports = require("@saola/core").registerLayerware(__dirname, [
  "@saola/plugin-errorlist",
  "@saola/plugin-logtracer",
  "@saola/plugin-secrets-hub",
  "@saola/plugin-webweaver"
], [
  "@saola/linker-mongojs"
]);
