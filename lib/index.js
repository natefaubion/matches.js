// patterns.js : Powerful pattern matching for Javascript
// Nathan Faubion <nathan@n-son.com>

var parser = require("./parser");
var compiler = require("./compiler");
var Matcher = require("./matcher").Matcher;

// Cache slice
var slice = Array.prototype.slice;

// Internal cache of all patterns
var patterns = {};

// Internal cache of all unique, normalized patterns
var normalized = {};

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
    tree = parser.parse(patternStr);

    // Check if we've already compiled a pattern function for the normalized
    // pattern. If so, just use that and don't bother compiling.
    if (tree.pattern in normalized) {
      patternFn = (patterns[patternStr] = normalized[tree.pattern]);
    }

    // Compile the pattern function and cache it.
    else {
      patternFn = compiler.compile(tree);
      patternFn.pattern = tree.pattern;
      patterns[patternStr] = patternFn;
      normalized[tree.pattern] = patternFn;
    }

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

// Export
exports.pattern = pattern;
exports.parser = parser;
exports.compiler = compiler;
