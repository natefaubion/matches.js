var toString = Object.prototype.toString;

// Given an object and a class name, tries to determine if the object is an
// instance of said class.
function matchesTypeName (obj, name) {
  var typeStr = toString.call(obj);
  if (typeStr.substring(8, typeStr.length - 1) === name) {
    return true;
  }

  if (obj.constructor) {
    if (obj.constructor.name === name || obj.constructor.className === name) {
      return true;
    }
  }

  return false;
}

// Export
exports.matchesTypeName = matchesTypeName;
