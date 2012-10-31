// Compiles a new pattern matching function given a syntax tree.
function compile (tree) {
  var source = [
    "var ret = [];",
    compileArgumentList(tree),
    "return ret;"
  ];

  return new Function(["args", "runt"], source.join("\n"));
}

// Export
exports.compile = compile;

// Mapping of tokens to compiler functions
var compilers = {
  "wildcard"    : compileWildcard,
  "null"        : compileNull,
  "undefined"   : compileUndefined,
  "boolean"     : compileBoolean,
  "number"      : compileNumber,
  "string"      : compileString,
  "identifier"  : compileIdentifier,
  "capture"     : compileCapture,
  "array"       : compileArray,
  "object"      : compileObject,
  "class"       : compileClass,
  "extractor"   : compileExtractor
};


// Compiler Functions
// ------------------

function compileArgumentList (node) {
  return compileArray('args', node);
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

function compileCapture (argName, node) {
  var source = [
    "ret.push(" + argName + ");",
    compilePattern(argName, node.children[0])
  ];

  return source.join("\n");
}

function hasRest (node) {
  for (var i = 0, child; (child = node.children[i]); i++) {
    if (child.type === "rest") return true;
  }
  return false;
}

function compileArray (argName, node) {
  return hasRest(node)
    ? compileArrayRest(argName, node)
    : compileArrayStrict(argName, node);
}

function compileArrayStrict (argName, node) {
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
  // Used for storing the rest
  var restName = argName + "_rest";

  var source = [
    "if (!(" + argName + " instanceof Array) || " + 
      argName + ".length < " + minLen + ") return false;",
    "var " + posName + " = 0;",
    "var " + restName + ";"
  ];

  node.children.forEach(function (child, i) {
    var childArgName = argName + "_" + i;

    // If the current child is a rest token, perform the appropriate slicing
    // and stashing. Different slices are used depending on whether the token
    // is in the middle of the child patterns or at the end.
    if (child.type === "rest") {
      // Rest is at the end.
      if (i === minLen) {
        source.push(restName + " = " + argName + ".slice(" + i + ");");
      }
      // Rest is at the beginning.
      else if (i === 0) {
        source.push(
          posName + " = " + argName + ".length - " + minLen + ";",
          restName + " = " + argName + ".slice(0, " + posName + ");"
        );
      }
      // Rest is in the middle.
      else {
        source.push(
          posName + " = " + argName + ".length - " + (minLen - i) + ";",
          restName + " = " + argName + ".slice(" + i + ", " + posName + ");"
        );
      }

      var restType = child.children[0].type;
      // If its an identifier, just stash it.
      if (restType === "identifier") {
        source.push("ret.push(" + restName + ");");
      }
      // No need to do anything for wildcards
      else if (restType !== "wildcard") {
        source.push(compileRest(restName, child));
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
  var keysName = argName + "_keys";
  var iName = argName + "_i";
  var keys = node.children.map(function (child) {
    return child.value;
  });

  var source = [
    "if (!(" + argName + " instanceof Object)) return false;",
    "var " + keysName + " = [" + keys.join(",") + "];",
    "for (var " + iName + " = 0; " + iName + " < " + keys.length + "; " + iName + "++) {",
      "if (!(" + keysName + "[" + iName + "] in " + argName + ")) return false;",
    "}"
  ];

  node.children.forEach(function (child, i) {
    var childArgName = argName + "_" + i;
    // If the child is just a key, stash it.
    if (child.type === "key") {
      source.push("ret.push(" + argName + "[" + child.value + "]);");
    }
    // If the child is a keyValue, perform further compilation.
    else {
      source.push(
        "var " + childArgName + " = " + argName + "[" + child.value + "];",
        compilePattern(childArgName, child.children[0])
      );
    }
  });

  return source.join("\n");
}

function compileClass (argName, node) {
  var fn = node.children ? compileClassDeconstruct : compileClassName;
  return fn(argName, node);
}

function compileClassName (argName, node) {
  return "if (!runt.matchesTypeName(" + argName + ", '" + node.value + "')) return false;"
}

function compileClassDeconstruct (argName, node) {
  var isArray = node.children[0].type === "array";
  var unapply = isArray ? "unapply" : "unapplyObj";
  var compFn  = isArray ? compileArray : compileObject;
  var valsName = argName + "_vals";
  var source = [
    "if (!(" + argName + " instanceof Object)) return false;",
    compileClassName(argName, node),
    "if (!" + argName + ".constructor || !" + argName + ".constructor." + unapply + ") return false;",
    "var " + valsName + " = " + argName + ".constructor." + unapply + "(" + argName +");",
    compFn(valsName, node.children[0])
  ];
  return source.join("\n");
}

function compileExtractor (argName, node) {
  // The name for the extracted Pass/Fail object.
  var extName = argName + "_ext";
  // The name of the extracted value.
  var valName = argName + "_val";
  var source = [
    "var " + extName + " = runt.callExtractor('" + node.value  + "', " + argName + ");",
    "if (!" + extName + " || !(" + extName + " instanceof runt.Pass)) return false;"
  ];
  
  if (node.children) {
    source.push("var " + valName + " = " + extName + ".val;");
    source.push(compilePattern(valName , node.children[0]));
  }

  return source.join("\n");
}

// The basic idea of rest expressions is that we create another matching
// function and call that function on all items in the array. We then aggregate
// all the stashed values and combine them into the ret array. We need to know
// ahead of time how many values are going to be stashed, so we use
// `countIdentifiers` to traverse children, returning the number of nodes that
// cause a value to be stashed.
function compileRest (argName, node) {
  var source = [];
  var retInit = [];
  
  // Count the number of identifiers we will need to stash.
  var i = 0, len = countIdentifiers(node);
  for (; i < len; i++) retInit.push("[]");

  var retName = argName + "_ret";
  var loopName = argName + "_loop";
  var iName = argName + "_i";
  var lenName = argName + "_len";
  var retArgsName = argName + "_retargs";

  source.push(
    "var " + retName + " = [" + retInit.join(", ") + "];",
    "var " + loopName + " = function (val) {",
      "var ret = [];",
      compilePattern("val", node.children[0]),
      "return ret;",
    "};",
    "var " + iName + " = 0, " + lenName + " = " + argName + ".length, " + retArgsName + ";",
    "for (; " + iName + " < " + lenName + "; " + iName + "++) {",
      retArgsName + " = " + loopName + "(" + argName + "[" + iName + "]);",
      "if (!" + retArgsName +") return false;",
      pushRetArgs(),
    "}",
    "ret = Array.prototype.concat.call(ret, " + retName + ");"
  );

  function pushRetArgs () {
    var src = [];
    for (i = 0; i < len; i++) {
      src.push(retName + "[" + i + "].push(" + retArgsName + "[" + i + "]);")
    }
    return src.join("\n");
  }

  return source.join("\n");
}

// Scans all children for a node and counts the number of identifier patterns.
// Identifier patterns include captures and object keys.
function countIdentifiers (node) {
  if (!node.children) return 0;
  var count = 0, i = 0, len = node.children.length, type;
  for (; i < len; i++) {
    type = node.children[i].type;
    if (type === "identifier" || type === "capture" || type === "key") count += 1;
    else count += countIdentifiers(node.children[i]);
  }
  return count;
}
