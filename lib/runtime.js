var adt;
try {
  adt = require("adt");
} catch (e) {
  adt = null;
}

// Check if we are in the browser
if (!adt && window) adt = window.adt;

var toString = Object.prototype.toString;

// Given an object and a class name, tries to determine if the object is an
// instance of said class.
function matchesTypeName (obj, name) {
  var typeStr = toString.call(obj);
  if (typeStr.substring(8, typeStr.length - 1) === name) {
    return true;
  }

  if (isADT(obj)) {
    var types = adt.lookup(name);
    if (types) {
      for (var i = 0, len = types.length; i < len; i++) {
        if (obj instanceof types[i]) return true;
      }
    }
    return false;
  }

  return false;
}

// Checks whether an object is an adt.js type.
function isADT (obj) {
  return !!adt && obj instanceof adt.__Base__;
}

// Looks up an adt.js type and returns it
function findADT (obj, name) {
  if (isADT(obj)) {
    var types = adt.lookup(name);
    if (types) {
      for (var i = 0, len = types.length; i < len; i++) {
        if (obj instanceof types[i]) return types[i];
      }
    }
  }

  return undefined;
}

function errorADT (name, pattern) {
  throw new TypeError("Wrong number of arguments applied to " + name + " in sub-pattern " + pattern);
}

// Export
module.exports = {
  matchesTypeName: matchesTypeName,
  isADT: isADT,
  findADT: findADT,
  errorADT: errorADT
};
