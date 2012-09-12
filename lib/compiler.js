// Compiles a new pattern matching function given a syntax tree.
function compile (tree) {
  var source = [
    "var ret = [];",
    compileArgumentList(tree),
    "return ret;"
  ];
  console.log(source.join("\n"), "\n\n");
  return new Function(["args", "runt"], source.join("\n"));
}

// Export
exports.compile = compile;

// Mapping of tokens to compiler functions
var compilers = {
  "wildcard"   : compileWildcard,
  "null"       : compileNull,
  "undefined"  : compileUndefined,
  "boolean"    : compileBoolean,
  "number"     : compileNumber,
  "string"     : compileString,
  "identifier" : compileIdentifier,
  "array"      : compileArray,
  "arrayRest"  : compileArrayRest,
  "object"     : compileObject,
  "capture"    : compileCapture,
  "className"  : compileClassName,
  "adtClass"   : compileAdtClass
};


// Compiler Functions
// ------------------

function compileArgumentList (node) {
  var source = [];
  for (var i = 0, len = node.value.length, argName; i < len; i++) {
    argName = "arg_" + i;
    source.push(
      "var " + argName + " = args[" + i + "];",
      compilePattern(argName, node.value[i])
    );
  }
  return source.join("\n");
}

function compilePattern (argName, node) {
  return compilers[node.type](argName, node);
}

function compileWildcard () {
  // Wildcards don't perform any matching or stash any values, so just return
  // an empty string.
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
  return "if (" + argName + " !== " + node.pattern + ") return false;";
}

function compileString (argName, node) {
  return "if (" + argName + " !== " + node.pattern + ") return false;";
}

function compileIdentifier (argName) {
  return "ret.push(" + argName + ");";
}

function compileClassName (argName, node) {
  return "if (!runt.matchesTypeName(" + argName + ", '" + node.value + "')) return false;"
}

function compileCapture (argName, node) {
  var source = [
    "ret.push(" + argName + ");",
    compilePattern(argName, node.children[0])
  ];
  return source.join("\n");
}

function compileArray (argName, node) {
  var arrLen = node.children.length;
  var source = [
    "if (!(" + argName + " instanceof Array) || " + 
    argName + ".length !== " + arrLen + ") return false;"
  ];
  node.children.forEach(function (child, i) {
    var childArgName = argName + "_" + i;
    source.push(
      "var " + childArgName + " = " + argName + "[" + i + "];",
      compilePattern(childArgName, child)
    );
  });
  return source.join("\n");
}

function compileArrayRest (argName, node) {
  var arrLen = node.children.length;
  var minLen = arrLen - 1;

  // Used for calculating the slice position
  var posName = argName + "_pos";

  var source = [
    "if (!(" + argName + " instanceof Array) || " + 
      argName + ".length < " + minLen + ") return false;",
    "var " + posName + " = 0;"
  ];

  node.children.forEach(function (child, i) {
    var childArgName = argName + "_" + i;
    var isRestIdent = child.type === "restIdentifier";

    // If the current child is a rest token, perform the appropriate slicing
    // and stashing. Different slices are used depending on whether the token
    // is in the middle of the child patterns or at the end.
    if (isRestIdent || child.type === "rest") {
      // Rest is at the end. This only matters if the rest needs to be stashed,
      // otherwise it can be ignored.
      if (i === minLen && isRestIdent) {
        source.push("ret.push(" + argName + ".slice(" + i + "));");
      }
      // Rest is at the beginning.
      else if (i === 0) {
        source.push(posName + " = " + argName + ".length - " + minLen + ";")
        if (isRestIdent) source.push("ret.push(" + argName + ".slice(0, " + posName + "));");
      }
      // Rest is in the middle.
      else {
        source.push(posName + " = " + argName + ".length - " + (minLen - i) + ";")
        if (isRestIdent) source.push("ret.push(" + argName + ".slice(" + i + ", " + posName + "));");
      }
    }
    // The current child is a non-rest pattern.
    else {
      source.push("var " + childArgName + " = " + argName + "[" + posName + "++];");
      source.push(compilePattern(childArgName, child));
    }
  });

  return source.join("\n");
}

function compileObject (argName, node) {
  // Helper var names
  var keysName = argName + "_keys";
  var countName = argName + "_count";
  var iName = argName + "_i";

  // Used to generate a key lookup table
  var keys = node.children.map(function (child) {
    return child.value + ":1";
  });

  var source = [
    "if (!(" + argName + " instanceof Object)) return false;",
    "var " + keysName + " = {" + keys.join(",") + "};",
    "var " + countName + " = 0;",
    "for (var " + iName + " in " + argName + ") {",
      "if (!(" + iName + " in " + keysName + ")) return false;",
      "else " + countName + " += 1;",
    "}",
    "if (" + countName + " !== " + node.children.length + ") return false;"
  ];

  node.children.forEach(function (child, i) {
    var childArgName = argName + "_" + i;
    // If the child is just a key, stash it.
    if (child.type === "key") {
      source.push("ret.push(" + argName + "." + child.value + ");");
    }
    // If the child is a keyValue, perform further compilation.
    else {
      source.push(
        "var " + childArgName + " = " + argName + "." + child.value + ";",
        compilePattern(childArgName, child.children[0])
      );
    }
  });

  return source.join("\n");
}

function compileAdtClass (argName, node) {
  var clsName = argName + "_class";
  var source = [
    "var " + clsName + " = runt.findADT(" + argName + ", '" + node.value + "');",
    "if (!" + clsName + ") return false;",
    "if (" + clsName + ".__names.length !== " + node.children.length + ") {",
      "runt.errorADT('" + node.value + "', '" + node.pattern + "');",
    "}"
  ];

  node.children.forEach(function (child, i) {
    var childArgName = argName + "_" + i;
    source.push(
      "var " + childArgName + " = " + argName + ".slot(" + i + ");",
      compilePattern(childArgName, child)
    );
  });

  return source.join("\n");
}
