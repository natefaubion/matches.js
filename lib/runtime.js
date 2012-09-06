var adt;
try {
  adt = require("adt");
} catch (e) {
  adt = null;
}

// Given an object and a class name, tries to determin if the object is an
// instance of said class.
function matchesTypeName (obj, name) {
  if (name === "Number") {
    return typeof obj === "number";
  }

  else if (name === "String") {
    return typeof obj === "string";
  }

  else if (name === "Function") {
    return obj instanceof Function;
  }

  else if (name === "Object") {
    return obj instanceof Object;
  }

  else if (adt && isADT(obj)) {
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
  return obj instanceof adt.__Base__;
}

// Export
module.exports = {
  matchesTypeName: matchesTypeName,
  isADT: isADT
};
