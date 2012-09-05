// Compiles a new pattern matching function given a syntax tree.
function compile (tree) {
  var source = ["var ret = [];"];

  source.push(compilePatternList(tree));
  source.push("return ret;");

  var fn = new Function(["args"], source.join("\n"));
  return fn;
}

// Export
exports.compile = compile;

var compilers = {
  "wildcard"    : compileWildcard,
  "null"        : compileNull,
  "boolean"     : compileBoolean,
  "number"      : compileNumber,
  "string"      : compileString,
  "identifier"  : compileIdentifier,
  "array"       : compileArray,
  "object"      : compileObject,
  "objectKeys"  : compileObjectKeys
};

function compilePatternList (node) {
  var numArgs = node.value.length;
  var source = [];

  source.push("if (args.length !== " + numArgs + ") throw new Error('Wrong number of arguments');");

  for (var i = 0, argName; i < numArgs; i++) {
    argName = "args_" + i;
    source.push("var " + argName + " = args[" + i + "];");
    source.push(compilePattern(argName, node.value[i]));
  }

  return source.join("\n");
}

function compilePattern (argName, node) {
  return compilers[node.type](argName, node);
}

function compileWildcard (argName) {
  return "";
}

function compileNull (argName) {
  return "if (" + argName + " !== null) return false;";
}

function compileBoolean (argName, node) {
  return "if (" + argName + " !== " + node.pattern + ") return false;";
}

function compileNumber (argName, node) {
  return "if (" + argName + " !== " + node.value + ") return false;";
}

function compileString (argName, node) {
  return "if (" + argName + " !== " + node.pattern + ") return false;";
}

function compileIdentifier (argName, node) {
  return "ret.push(" + argName + ");";
}

function compileArray (argName, node) {
  var source = [];
  source.push("if (" + argName + ".length !== " + node.value.length + ") return false;");
  for (var i = 0, argName2; i < node.value.length; i++) {
    argName2 = argName + "_" + i;
    source.push("var " + argName2 + " = " + argName + "[" + i + "];");
    source.push(compilePattern(argName2, node.value[i]));
  }
  return source.join("\n");
}

function compileObject (argName, node) {
  var source = [];
  var kvpairs = node.value.map(function (pair) {
    return pair[0] + ":1";
  });

  source.push("var " + argName + "_keys = {" + kvpairs.join(",") + "};");

  var iName = argName + "_i";
  source.push(
    "for (var " + iName + " in "+ argName + ") {",
      "if (!(" + iName + " in " + argName + "_keys)) return false;",
    "}"
  );

  for (var i = 0, argName2; i < node.value.length; i++) {
    argName2 = argName + "_" + i;
    source.push("var " + argName2 + " = " + argName + "." + node.value[i][0]);
    source.push(compilePattern(argName2, node.value[i][1]));
  }

  return source.join("\n");
}

function compileObjectKeys (argName, node) {
  var source = [];
  var kvpairs = node.value.map(function (key) {
    return key + ":1";
  });

  source.push("var " + argName + "_keys = {" + kvpairs.join(",") + "};");

  var iName = argName + "_i";
  source.push(
    "for (var " + iName + " in "+ argName + ") {",
      "if (!(" + iName + " in " + argName + "_keys)) return false;",
    "}"
  );

  node.value.forEach(function (key) {
    source.push("ret.push(" + argName + "." + key + ");");
  });
  return source.join("\n");
}
