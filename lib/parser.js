function parse (str) {
  var inp = new Input(str);
  var tree = start(inp);
  return tree;
}

// Export
exports.parse = parse;

// Input
// -----

// The Input class represents the state of our parse. The `input` is the
// original string, while the `buffer` is the string that we consume.
function Input (str) {
  this.input = str;
  this.buffer = str;
  this.pos = 0;
}

// Removes a chunk of length `len` from the buffer and returns it.
Input.prototype.take = function (len) {
  var res = this.buffer.substr(0, len);
  this.buffer = this.buffer.substring(len);
  this.pos += res.length;
  return res;
}

// Checks if the start of the buffer matches the given string or RegExp. If
// a RegExp is passed, it will return the subsequent match array.
Input.prototype.peek = function (str) {
  return str instanceof RegExp
    ? this.buffer.match(str)
    : this.buffer.substr(0, str.length) === str ? str : null;
};

// Tries the peek first, and if successful takes the length of the str.
Input.prototype.takeAPeek = function (str) {
  var match = this.peek(str);
  if (match) {
    this.take((str instanceof RegExp ? match[0] : match).length);
    return match;
  }
};

// Consumes any whitespace at the beginning of the buffer.
Input.prototype.skipWs = function () {
  while (this.takeAPeek(" ")) continue;
  return this;
};

// Puts a string back on the buffer. This is rarely needed, and it's use is
// usually a sign that the parse function can be refactored to be clearer and
// more efficient.
Input.prototype.put = function (str) {
  this.buffer = str + this.buffer;
  var newpos = this.pos - str.length;
  this.pos = newpos < 0 ? 0 : newpos;
  return this;
};

// Parser
// ------

// The entry point of the parser.
function start (inp) {
  var res = argumentList(inp.skipWs());

  // If there is any leftover, we have input that did not match our grammar,
  // so throw a generic syntax error.
  if (inp.skipWs().buffer) syntaxError(inp);
  return res;
}

// The root of the tree.
function argumentList (inp) {
  return nodeArgumentList(restPatterns(inp));
}

// A comma-separated list of patterns expressions.
function patterns (inp) {
  return commaSeparated(pattern, inp);
}

// A comma-separated list of patterns, including rest patterns.
function restPatterns (inp) {
  return commaSeparated(restPattern, inp, multiRestCallback());
}

// Matches a rest expression or pattern expression.
function restPattern (inp) {
  return rest(inp)
      || pattern(inp);
}

// Matches a single pattern expression.
function pattern (inp) {
  return wildcard(inp)
      || nullLiteral(inp)
      || undefinedLiteral(inp)
      || booleanLiteral(inp)
      || numberLiteral(inp)
      || stringLiteral(inp)
      || classPattern(inp)
      || array(inp)
      || object(inp)
      || identPattern(inp);
}

// Parses a rest identifier or '...'
function rest (inp) {
  var res = inp.takeAPeek("...");
  if (res) {
    var match = inp.takeAPeek(IDENT)
    if (match) return nodeRestIdentifier(match[0]);
    else return nodeRest();
  }
}

// Parses a wildcard character.
function wildcard (inp) {
  if (inp.takeAPeek("_")) return nodeWildcard();
}

// Parses `null`.
function nullLiteral (inp) {
  if (inp.takeAPeek(NULL)) return nodeNullLiteral();
}

// Parses `undefined`.
function undefinedLiteral (inp) {
  if (inp.takeAPeek(UNDEF)) return nodeUndefinedLiteral();
}

// Parses `true` or `false`.
function booleanLiteral (inp) {
  var match = inp.takeAPeek(BOOL);
  if (match) return nodeBooleanLiteral(match[0]);
}

// Parses a number.
function numberLiteral (inp) {
  var res = number(inp);
  if (res) return nodeNumberLiteral(res);
}

// Parses a string.
function stringLiteral (inp) {
  var res = string(inp);
  if (res) return nodeStringLiteral(res);
}

// Parses class names and class destructuring.
function classPattern (inp) {
  var match = inp.takeAPeek(CLASS);
  if (match) {
    // Object-like destructuring.
    var res = object(inp);
    if (res) return nodeClassObject(match[0], res);

    // Array-like dstructuring, but uses parens instead of brackets so we need
    // to use a custom series.
    res = series("(", ")", restPatterns, nodeArray, inp);
    if (res) return nodeClassArray(match[0], res);

    // Just a class name.
    return nodeClassName(match[0]);
  }
}

// Parses array destructuring.
function array (inp) {
  return series("[", "]", restPatterns, nodeArray, inp);
}

// Parses object destructuring.
function object (inp) {
  return series("{", "}", objectPatterns, nodeObject, inp);
}

// Comma-separated list of object patterns.
function objectPatterns (inp) {
  return commaSeparated(objectPattern, inp, multiRestCallback());
}

// Objects can only contain rest expressions, keys, or key-value pairs.
function objectPattern (inp) {
  var res = rest(inp);
  if (res) return res;

  res = key(inp);
  if (res) {
    if (inp.skipWs().takeAPeek(":")) {
      var patt = pattern(inp.skipWs());
      if (patt) return nodeKeyValue(res, patt);
    }
    return nodeKey(res);
  }
}

// Keys can be strings or JS identifiers.
function key (inp) {
  var res = string(inp);
  if (res) return res;

  var match = inp.takeAPeek(JS_IDENT);
  if (match) return match[0]
}

// Parses identifiers and captures, which are for when you want to destructure
// the value but also pass the original value to the function.
function identPattern (inp) {
  var match = inp.takeAPeek(IDENT);
  if (match) {
    // Is this a capture?
    if (inp.takeAPeek("@")) {
      var patt = capturePattern(inp);
      if (patt) return nodeCapture(match[0], patt);
    }

    // Just an identifier
    return nodeIdentifier(match[0])
  }
}

// Captures don't allow just any expression. Literals are left out because if
// you are matching on a literal, you already know what the value is.
function capturePattern (inp) {
  return classPattern(inp)
      || array(inp)
      || object(inp);
}

// Parses a series, like an array or object.
function series (del1, del2, pattFn, nodeFn, inp) {
  if (inp.takeAPeek(del1)) {
    var res = pattFn(inp.skipWs());
    if (inp.skipWs().takeAPeek(del2)) return nodeFn(res);
    else syntaxError(inp, "Expected " + del2);
  }
}

// Matches a comma separated list of tokens. Can take a callback to validate
// the input on each iteration. Note: this always returns a list. The calling 
// function should determine if an empty list is a syntax error or not.
function commaSeparated (fn, inp, cb) {
  var all = [], res;
  while (1) {
    res = fn(inp);
    if ((res && !cb) || (res && cb(res, inp))) {
      all.push(res);
      if (inp.skipWs().takeAPeek(",")) {
        inp.skipWs();
      } else break;
    } else break;
  }
  return all;
}

// Returns a function that can be used as a callback to `commaSeparated`. It
// checks that only one rest expression is used in a series.
function multiRestCallback () {
  var count = 0;
  return function (res, inp) {
    if ((res.type === "rest" || res.type === "restIdentifier") && ++count > 1) {
      // Put the pattern back on the buffer so the error reporting points to
      // the beginning of the rest instead of at the end since its already
      // been consumed.
      inp.put(res.pattern);
      syntaxError(inp, "Multiple ...'s not allowed");
    }
    return true;
  };
}

// String Parsers
// --------------

function string (inp) {
  return quotedString('"', DOUBLE_QUOTED_CHAR, inp)
      || quotedString("'", SINGLE_QUOTED_CHAR, inp);
}

function quotedString (q, regx, inp) {
  if (inp.takeAPeek(q)) {
    var str = quotedStringChars(regx, inp);
    if (inp.takeAPeek(q)) return str;
    else syntaxError(inp, "Expected " + q);
  }
}

function quotedStringChars (regx, inp) {
  var str = "";
  while (1) {
    var res = inp.takeAPeek(regx);
    if (res) str += res;
    else if (inp.peek("\\")){
      res = escapeSeq(inp);
      if (res) str += res;
      else break;
    } else break;
  }
  return str;
}

function escapeSeq (inp) {
  return nullEscapeSeq(inp)
      || specialEscapeSeq(HEX_SEQ, inp)
      || specialEscapeSeq(UNICODE_SEQ, inp)
      || charEscapeSeq(inp);
}

function nullEscapeSeq (inp) {
  if (inp.takeAPeek(NULL_ESCAPE_CHAR)) return "\0";
}

function specialEscapeSeq (regx, inp) {
  var match = inp.takeAPeek(regx);
  if (match) return String.fromCharCode(parseInt("0x" + match[1]));
}

function charEscapeSeq (inp) {
  var match = inp.takeAPeek(ESC_CHAR);
  if (match) {
    return match[1]
      .replace("b", "\b")
      .replace("f", "\f")
      .replace("n", "\n")
      .replace("r", "\r")
      .replace("t", "\t")
      .replace("v", "\x0B");
  }

  match = inp.takeAPeek(ESC_ANY);
  if (match) return match[1];
}

// Number Parsers
// --------------

function number (inp) {
  var res = "";
  if (inp.takeAPeek("-")) res += "-";

  var match = integer(inp);
  if (match) res += match;

  match = fraction(inp);
  if (match) res += match;

  if (res && res !== "-") {
    match = exponent(inp);
    if (match) res += match;
  }

  if (res === "-") syntaxError(inp, "Expected number");
  return res || null;
}

function fraction (inp) {
  if (inp.takeAPeek(".")) {
    var ds = inp.takeAPeek(DIGITS);
    if (ds) return "." + ds;
    syntaxError(inp, "Expected digit");
  }
}

function exponent (inp) {
  var match = inp.takeAPeek(E_SIGN);
  if (match) {
    var ds = inp.takeAPeek(DIGITS);
    if (ds) return match[0] + ds;
  }
}

function integer (inp) {
  return inp.takeAPeek(DIGIT_TEN_PLUS)
      || inp.takeAPeek(DIGIT);
}

// Helper RegExps
// --------------

var UNDEF              = /^(undefined)\b/;
var NULL               = /^(null)\b/;
var BOOL               = /^(true|false)\b/;

var IDENT              = /^[a-z][_$a-zA-Z0-9]*/;
var JS_IDENT           = /^[_$a-zA-Z][_$a-zA-Z0-9]*/;
var CLASS              = /^[A-Z][_$a-zA-Z0-9]*/;

var DOUBLE_QUOTED_CHAR = /^(?!["\\])./;
var SINGLE_QUOTED_CHAR = /^(?!['\\])./;
var ESC_ANY            = /^\\(.)/;
var ESC_CHAR           = /^\\(['"\\bfnrtv])/;
var NULL_ESCAPE_CHAR   = /^\\0(?![0-9])/;
var UNICODE_SEQ        = /^\\u([0-9a-fA-F]{4})/;
var HEX_SEQ            = /^\\x([0-9a-fA-F]{2})/;

var E_SIGN             = /^[eE](\+|-)?/;
var DIGIT_HEX          = /^[0-9a-fA-F]/;
var DIGIT_TEN_PLUS     = /^[1-9][0-9]+/;
var DIGITS             = /^[0-9]+/;
var DIGIT              = /^[0-9]/;

// Nodes
// -----

function node (type, pattern, val, children) {
  var ret = { pattern: pattern, type: type };
  var len = arguments.length;
  if (val !== undefined) ret.value = val;
  if (children !== undefined) ret.children = children;
  return ret;
}

function nodeArgumentList (res) {
  return node("argumentList", patternStrings(res).join(","), undefined, res);
}

function nodeRest () {
  return node("rest", "...");
}

function nodeRestIdentifier (res) {
  return node("restIdentifier", "..." + res, res);
}

function nodeWildcard () {
  return node("wildcard", "_");
}

function nodeNullLiteral () {
  return node("null", "null");
}

function nodeUndefinedLiteral () {
  return node("undefined", "undefined");
}

function nodeBooleanLiteral (res) {
  return node("boolean", res, res === "true");
}

function nodeNumberLiteral (res) {
  return node("number", res, parseFloat(res));
}

function nodeStringLiteral (res) {
  return node("string", quote(res), res);
}

function nodeClassName (res) {
  return node("className", res, res);
}

function nodeClassArray (res, arr) {
  return node("classArray", res + arr.pattern, res, arr.children);
}

function nodeClassObject (res, obj) {
  return node("classObject", res + obj.pattern, res, obj.children);
}

function nodeArray (res) {
  return node("array", "[" + patternStrings(res).join(",") + "]", undefined, res);
}

function nodeObject (res) {
  return node("object", "{" + patternStrings(res).join(",") + "}", undefined, res);
}

function nodeCapture (res, patt) {
  return node("capture", res + "@" + patt.pattern, res, [patt]);
}

function nodeIdentifier (res) {
  return node("identifier", res, res);
}

function nodeKey (res) {
  res = quote(res);
  return node("key", res, res);
}

function nodeKeyValue (key, value) {
  key = quote(key);
  return node("keyValue", key + ":" + value.pattern, key, [value]);
}

// Utility Functions
// -----------------

function patternStrings (children) {
  return children.map(function (child) {
    return child.pattern;
  });
}

// Takes a string and wraps it in quotes, properly escaping everything that
// needs to be escaped so we have a string of a string.
function quote (s) {
  return '"' + s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\x08/g, '\\b')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\f/g, '\\f')
    .replace(/\r/g, '\\r')
    .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
    + '"';
}

function escape (ch) {
  var code = ch.charCodeAt(0), esc, len;
  if (code <= 0xFF) {
    esc = 'x';
    len = 2;
  } else {
    esc = 'u';
    len = 4;
  }
  var seq = code.toString(16);
  return '\\' + esc + (Array(len - seq.length).join("0")) + seq;
}

function syntaxError (inp, reason) {
  reason || (reason = "Unexpected character");
  reason += " at column " + (inp.pos + 1);
  throw new SyntaxError(reason
    + "\n" + inp.input + "\n"
    + Array(inp.input.length - inp.buffer.length + 1).join(" ")
    + "^"
  );
}
