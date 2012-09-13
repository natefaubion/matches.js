
var patternTable = {
  wildcard: function () {
    return ['_', 1];
  },

  number: function () {
    var num = randRange(1, 1000);
    return [num.toString(), 1];
  },

  string: function () {
    var str = '"' + randString(letters) + '"';
    return [str, 1];
  },

  identifier: function () {
    var ident = randString(lower, 3);
    return [ident, 1];
  },

  className: function () {
    var name = randString(upper, 3);
    return [name, 1];
  },

  array: function (maxLen) {
    var pats = [];
    var count = 1;
    var len = randRange(1, maxLen || 5);
    while (len--) {
      var pat = randPattern(simpleTypes, 1);
      pats.push(pat[0]);
      count += pat[1];
    }
    var arr = "[" + pats.join(",") + "]";
    return [arr, count];
  },

  object: function (maxLen, rec) {
    var pats = [];
    var count = 1;
    var len = randRange(1, maxLen || 5);
    while (len--) {
      var key = randString(lower, 3);
      var pat = randPattern(simpleTypes, 1);
      pats.push(key + ":" + pat[0]);
      count += pat[1];
    }
    var obj = "{" + pats.join(",") + "}";
    return [obj, count];
  }
};

var allTypes = Object.keys(patternTable);
var simpleTypes = ["wildcard", "number", "string", "identifier", "className"];

var lower = "abcdefghijklmnopqrstuvwxyz".split("");
var upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
var letters = lower.concat(upper);

function randRange (min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randString (chars, maxLen) {
  var str = [];
  var len = randRange(1, maxLen || 20);
  while (len--) str.push(chars[randRange(0, chars.length - 1)]);
  return str.join("");
}

function randPattern (types, maxArgLen) {
  types = types || allTypes;
  var pats = [];
  var count = 0;
  var len = randRange(1, maxArgLen || 5);
  while (len--) {
    var pat = patternTable[types[randRange(0, types.length - 1)]]();
    pats.push(pat[0]);
    count += pat[1];
  }
  return [pats.join(","), count];
}

exports.randPattern = randPattern;
exports.randRange = randRange;
exports.randString = randString;
exports.lower = lower;
exports.upper = upper;
exports.letters = letters;
exports.allTypes = allTypes;
exports.simpleTypes = simpleTypes;
