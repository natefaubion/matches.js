var parser = require("./parser");
var compiler = require("./compiler");
var runtime = require("./runtime");
var Matcher = require("./matcher").Matcher;

// Cache slice
var slice = Array.prototype.slice;

// Internal cache of all patterns
var patterns = {};

// Internal cache of all unique, normalized patterns
var normalized = {};

// Retrieves a patternFn from the cache or compiles it if it's not there.
function getOrCompile (patternStr) {
  var tree, fn;
  if (!patterns.hasOwnProperty(patternStr)) {
    tree = parser.parse(patternStr);
    if (!normalized.hasOwnProperty(tree.pattern)) {
      fn = compiler.compile(tree);
      fn.pattern = tree.pattern;
      normalized[tree.pattern] = fn;
    }
    patterns[patternStr] = normalized[tree.pattern];
  }
  return patterns[patternStr];
}

// Creates a pattern matching function given a string and a fn to execute.
function pattern () {
  var args = slice.call(arguments);

  // types
  var targ0 = typeof args[0];
  var targ1 = typeof args[1];
  var targ2 = typeof args[2];

  // Shared vars
  var matcherFn, patternObj, patternFn, patternStr, successFn, chain, tree, last;

  // pattern(matcherFn, chain)
  if (targ0 == "function" && (targ1 == "undefined" || targ1 == "object")) { 
    matcherFn = args[0];
    chain = args[1];

    // Throw an error if the supplied function does not have a match chain.
    if (!matcherFn.__matchChain) throw new Error("Not a matcher function");

    // Splice the chains together.
    if (chain) {
      chain = chain.clone();
      chain.last().next = matcherFn.__matchChain.clone();
    } else {
      chain = matcherFn.__matchChain.clone();
    }

    last = chain.pop();
    return matcher(last.patternFn, last.successFn, chain);
  }

  // pattern(patternObj, chain)
  else if (targ0 == "object" && (targ1 == "undefined" || targ1 == "object")) {
    patternObj = args[0];
    chain = args[1] ? args[1].clone() : null;
    for (patternStr in patternObj) {
      matcherFn = pattern(patternStr, patternObj[patternStr], chain);
      chain = matcherFn.__matchChain;
    }
    return matcherFn;
  }

  // pattern(patternFn, successFn, chain)
  else if (targ0 == "function" && targ1 == "function") {
    chain = args[2] ? args[2].clone() : null;
    return matcher(args[0], args[1], chain);
  }

  // pattern(patternStr, successFn, chain)
  else {
    patternStr = args[0];
    successFn = args[1];
    chain = args[2] ? args[2].clone() : null;
    patternFn = getOrCompile(patternStr);
    return matcher(patternFn, successFn, chain);
  }
}

// Creates a function that tries a match and executes the given fn if
// successful. If not it tries subsequent patterns.
function matcher (patternFn, successFn, chain) {
  var matcherObj = new Matcher(patternFn, successFn);

  if (chain) {
    chain.last().next = matcherObj;
  } else {
    chain = matcherObj;
  }

  var fn = function () {
    var args = slice.call(arguments);
    return chain.match(args, this);
  };

  fn.alt = function () {
    var args = slice.call(arguments);
    args.push(chain);
    return pattern.apply(null, args);
  }

  fn.__matchChain = chain;

  return fn;
}

// Sugar for creating a new pattern and immediately invoking it with arguments.
// This just lets you put the arguments first instead of after the patterns.
function caseOf (/* ...args, matcher */) {
  var args = slice.call(arguments, 0, -1);
  var matcher = arguments[arguments.length - 1];
  var context = this === exports ? null : this;

  if (typeof matcher === "function") {
    // Throw an error if the supplied function does not have a match chain.
    if (!matcher.__matchChain) throw new Error("Not a matcher function");
    return matcher.apply(context, args);
  }

  return pattern(matcher).apply(context, args);
}

// Extract works similar to regular expression matching on strings. If the
// pattern fails to match, it returns null. If it is successful it will return 
// an array of extracted values.
function extract (/* pattern, ...args */) {
  var args = slice.call(arguments, 1);
  var context = this === exports ? null : this;
  var patternFn = getOrCompile(arguments[0]);
  return patternFn.call(context, args, runtime) || null;
}

// Like extract, but returns the first extracted value or null.
function extractOne (/* pattern, ...args */) {
  var res = extract.apply(this, arguments);
  return res === null ? null : res[0];
}

// Extract helpers
function retNull () { return null; }
function retArgs () { return slice.call(arguments, 0); }
function retEmpty () { return []; }

// Export
exports.pattern = pattern;
exports.caseOf = caseOf;
exports.extract = extract;
exports.extractOne = extractOne;
exports.parser = parser;
exports.compiler = compiler;
exports.extractors = runtime.extractors;
