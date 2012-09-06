var adt;
try {
  adt = require("adt");
} catch (e) {
  adt = null;
}

// Given an object and a class name, tries to determin if the object is an
// instance of said class. Optionally provide a scope for lookup.
function matchesTypeName (obj, name, scope) {
  scope || (scope = {});

  if (adt && isADT(obj)) {
    var types = adt.lookup(name);
    if (types) {
      for (var i = 0, len = types.length; i < len; i++) {
        if (obj instanceof types[i]) return true;
      }
    } else if ((name in scope) && obj instanceof scope[name]) {
      return true
    }
    return false;
  }

  if (obj.constructor && obj.constructor.name && obj.constructor.name === name) {
    return true;
  }

  if ((name in scope) && obj instanceof scope[name]) {
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
