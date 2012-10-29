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

// Lookup table of extractors
var extractors = {};

// Given a name and value, looks up an extractor and calls it. If the extractor
// does not exist, it will throw an error.
function callExtractor(name, val) {
  if (!extractors.hasOwnProperty(name)) {
    throw new Error("Extractor does not exist: " + name);
  }
  return extractors[name](val, Pass);
}

// Extractors must return an instance of `Pass` to count as a successful match.
// We can't use a sentinal value like `undefined` to count as a fail since
// its a valid value to match on.
function Pass (val) {
  if (!(this instanceof Pass)) return new Pass(val);
  this.val = val;
}

// Export
exports.matchesTypeName = matchesTypeName;
exports.extractors = extractors;
exports.callExtractor = callExtractor;
exports.Pass = Pass;
