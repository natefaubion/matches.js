var adt;
try {
  adt = require("adt");
} catch (e) {
  adt = null;
}

// Given an object and a class name, tries to determin if the object is an
// instance of said class.
function matchesTypeName (obj, name) {
  if (adt && isADT(obj)) {
    var types = adt.lookup(name);
    if (types) {
      for (var i = 0, len = types.length; i < len; i++) {
        if (obj instanceof types[i]) return true;
      }
    }
    return false;
  }

  if (obj.constructor && obj.constructor.name && obj.constructor.name === name) {
    return true;
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
