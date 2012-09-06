// Compiles a new pattern matching function given a syntax tree.
function compile (tree) {
  var source = ["var ret = [];"];

  source.push(compilePatternList(tree));
  source.push("return ret;");

  console.log(source.join("\n"));
  var fn = new Function(["args", "runt"], source.join("\n"));
  return fn;
}

// Export
exports.compile = compile;

var compilers = {
  "wildcard"       : compileWildcard,
  "null"           : compileNull,
  "undefined"      : compileUndefined,
  "boolean"        : compileBoolean,
  "number"         : compileNumber,
  "string"         : compileString,
  "identifier"     : compileIdentifier,
  "array"          : compileArray,
  "arrayRest"      : compileArrayRest,
  "object"         : compileObject,
  "objectKeys"     : compileObjectKeys,
  "typeLiteral"    : compileTypeLiteral
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

function compileUndefined (argName) {
  return "if (" + argName + " !== void 0) return false;";
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

  source.push(
    "if (!(" + argName + " instanceof Array) || " + 
    argName + ".length !== " + node.value.length + ") return false;"
  );

  for (var i = 0, argName2; i < node.value.length; i++) {
    argName2 = argName + "_" + i;
    source.push("var " + argName2 + " = " + argName + "[" + i + "];");
    source.push(compilePattern(argName2, node.value[i]));
  }
  return source.join("\n");
}

function compileArrayRest (argName, node) {
  var source = [];
  var minLength = node.value.length - 1;

  source.push(
    "if (!(" + argName + " instanceof Array) || " + 
    argName + ".length < " + minLength + ") return false;"
  );

  var posName = argName + "_pos";
  source.push("var " + posName + " = 0;");

  for (var i = 0, node2, argName2, isRestIdent; i < node.value.length; i++) {
    node2 = node.value[i];
    argName2 = argName + "_" + i;
    isRestIdent = node2.type === "restIdentifier";

    if (isRestIdent || node2.type === "rest") {
      // Rest is at the end of the array.
      if (i === minLength && isRestIdent) {
        source.push("ret.push(" + argName + ".slice(" + i + "));");
      }
      
      // Rest is at the beginning of the array.
      else if (i === 0) {
        source.push(posName + " = " + argName + ".length - " + minLength + ";")
        if (isRestIdent) source.push("ret.push(" + argName + ".slice(0, " + posName + "));");
      }
      
      // Rest is in the middle of the array.
      else {
        source.push(posName + " = " + argName + ".length - " + (minLength - i) + ";")
        if (isRestIdent) source.push("ret.push(" + argName + ".slice(" + i + ", " + posName + "));");
      }
    }

    else {
      source.push("var " + argName2 + " = " + argName + "[" + posName + "++];");
      source.push(compilePattern(argName2, node2));
    }
  }

  return source.join("\n");
}

function compileObject (argName, node) {
  var source = [];
  var kvpairs = node.value.map(function (pair) {
    return pair[0] + ":1";
  });

  source.push("if (!(" + argName + " instanceof Object) return false;");
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

  source.push("if (!(" + argName + " instanceof Object)) return false;");
  source.push("var " + argName + "_keys = {" + kvpairs.join(",") + "};");
  source.push("var " + argName + "_count = 0;");

  var iName = argName + "_i";
  source.push(
    "for (var " + iName + " in "+ argName + ") {",
      "if (!(" + iName + " in " + argName + "_keys)) return false;",
      "else " + argName + "_count += 1;",
    "}"
  );

  source.push("if (" + argName + "_count !== " + node.value.length + ") return false;");
  node.value.forEach(function (key) {
    source.push("ret.push(" + argName + "." + key + ");");
  });

  return source.join("\n");
}

function compileTypeLiteral (argName, node) {
  return "if (typeof " + argName + " !== 'object' ||" +
         "!runt.matchesTypeName(" + argName + ", '" + node.value + "')) return false;"
}
