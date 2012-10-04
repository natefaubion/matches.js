DIR=$1
shift 1

echo "// matches.js
// ----------
// Powerful pattern matching for Javascript
//
// version : 0.3.1
// author  : Nathan Faubion <nathan@n-son.com>
// license : MIT

;(function () {
  function require (path) {
    return require.modules[path];
  }
  require.modules = {};"

for f in $@; do
  echo "
  require.modules['./$f'] = (function () {
    var module = {exports: {}}, exports = module.exports;
$(sed 's/^/    /' <$DIR/$f.js)
    return module.exports;
  })();"
done

echo "
  window.matches = require('./matches');
})();"
