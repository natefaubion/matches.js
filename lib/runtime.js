var adt;
try {
  adt = require("adt");
} catch (e) {
  adt = null;
}

// Given an object and a class name, tries to determine if the object is an
// instance of said class.
function matchesTypeName (obj, name) {
  switch (name) {
    case "Number"   : return typeof obj === "number";
    case "String"   : return typeof obj === "string";
    case "Date"     : return obj instanceof Date;
    case "RegExp"   : return obj instanceof RegExp;
    case "Function" : return obj instanceof Function;
    case "Array"    : return obj instanceof Array;
    case "Object"   : return obj instanceof Object;
  }

  if (adt && isADT(obj)) {
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
