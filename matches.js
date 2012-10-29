// matches.js
// ----------
// Powerful pattern matching for Javascript
//
// version : 0.3.1
// author  : Nathan Faubion <nathan@n-son.com>
// license : MIT

;(function () {
  function require (path) {
    return require.modules[path];
  }
  require.modules = {};

  require.modules['./parser'] = (function () {
    var module = {exports: {}}, exports = module.exports;
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
          || extractor(inp)
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
        var name = match[0];
    
        // Object-like destructuring.
        var res = object(inp);
        if (res) return nodeClass(name, res);
    
        // Array-like dstructuring, but uses parens instead of brackets so we need
        // to use a custom series.
        res = series("(", ")", restPatterns, nodeArray, inp);
        if (res) return nodeClass(name, res);
    
        // Just a class name.
        return nodeClass(name);
      }
    }
    
    // Parses custom extractors.
    function extractor (inp) {
      var match = inp.takeAPeek(EXTRACTOR);
      if (match)
        return series("(", ")", pattern, extractorRes, inp)
            || nodeExtractor(match[1]);
    
      function extractorRes (res) {
        return nodeExtractor(match[1], res);
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
        // Is this a capture?)
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
    
    // Parses patterns that have a name and optional destructuring like classes
    // and extractors.
    function classLikePattern (nameRegx, matchIndex, nodeFn, inp) {
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
    var EXTRACTOR          = /^\$([_$a-zA-Z][_$a-zA-Z0-9]*)/;
    
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
    
    function nodeClass (name, children) {
      var patt = name;
      if (children)
        patt += children.type === "array"
          ? "(" + children.pattern.substring(1, children.pattern.length - 1) + ")"
          : children.pattern;
      return node("class", patt, name, children);
    }
    
    function nodeExtractor (name, children) {
      return children
        ? node("extractor", "$" + name + "(" + children.pattern + ")", name, children)
        : node("extractor", "$" + name, name);
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
    return module.exports;
  })();

  require.modules['./compiler'] = (function () {
    var module = {exports: {}}, exports = module.exports;
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
        if (child.type === "rest" || child.type === "restIdentifier") return true;
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
      return hasRest(node)
        ? compileObjectRest(argName, node)
        : compileObjectStrict(argName, node);
    }
    
    function compileObjectStrict (argName, node) {
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
          "if (!(" + keysName + ".hasOwnProperty(" + iName + "))) return false;",
          "else " + countName + " += 1;",
        "}",
        "if (" + countName + " !== " + node.children.length + ") return false;"
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
    
    function compileObjectRest (argName, node) {
      // Helper var names
      var keysName = argName + "_keys";
      var countName = argName + "_count";
      var restName = argName + "_rest";
      var iName = argName + "_i";
    
      var minLen = node.children.length - 1;
      var hasRestIdent = false;
      var keys = [];
    
      node.children.forEach(function (child) {
        if (child.type === "restIdentifier") hasRestIdent = true;
        else if (child.type !== "rest") keys.push(child.value + ":1");
      });
    
      var source = [
        "if (!(" + argName + " instanceof Object)) return false;",
        "var " + keysName + " = {" + keys.join(",") + "};",
        "var " + countName + " = 0;"
      ];
    
      if (hasRestIdent) source.push("var " + restName + " = {};");
      source.push("for (var " + iName + " in " + argName + ") {");
    
      // If there's a rest identifier, non-matching keys need to be stashed in a
      // secondary object.
      if (hasRestIdent) {
        source.push(
          "if (!(" + keysName + ".hasOwnProperty(" + iName + "))) " + restName + "[" + iName + "] = " + argName + "[" + iName + "];",
          "else " + countName + " += 1;"
        );
      } 
      // Just check that all supplied keys are there.
      else {
        source.push(
          "if (" + keysName + ".hasOwnProperty(" + iName + ")) " + countName + " += 1;"
        );
      }
    
      source.push(
        "}", 
        "if (" + countName + " !== " + minLen + ") return false;"
      );
    
      node.children.forEach(function (child, i) {
        var childArgName = argName + "_" + i;
        // If the child is just a key, stash it.
        if (child.type === "key") {
          source.push("ret.push(" + argName + "[" + child.value + "]);");
        }
        // If the child is a keyValue, perform further compilation.
        else if (child.type === "keyValue") {
          source.push(
            "var " + childArgName + " = " + argName + "[" + child.value + "];",
            compilePattern(childArgName, child.children[0])
          );
        }
        // If the child is a restIdentifier, stash the clone.
        else if (child.type === "restIdentifier") {
          source.push("ret.push(" + restName + ");")
        }
      });
    
      return source.join("\n");
    }
    
    function compileClass (argName, node) {
      var fn = compileClassName;
      if (node.children) {
        fn = node.children.type === "array"
          ? compileClassArray
          : compileClassObject;
      }
      return fn(argName, node);
    }
    
    function compileClassName (argName, node) {
      return "if (!runt.matchesTypeName(" + argName + ", '" + node.value + "')) return false;"
    }
    
    function compileClassArray (argName, node) {
      var valsName = argName + "_vals";
      var source = [
        "if (!(" + argName + " instanceof Object)) return false;",
        compileClassName(argName, node),
        "if (!" + argName + ".constructor || !" + argName + ".constructor.unapply) return false;",
        "var " + valsName + " = " + argName + ".constructor.unapply(" + argName +");",
        compileArray(valsName, node.children)
      ];
      return source.join("\n");
    }
    
    function compileClassObject (argName, node) {
      var valsName = argName + "_vals";
      var source = [
        "if (!(" + argName + " instanceof Object)) return false;",
        compileClassName(argName, node),
        "if (!" + argName + ".constructor || !" + argName + ".constructor.unapplyObj) return false;",
        "var " + valsName + " = " + argName + ".constructor.unapplyObj(" + argName +");",
        compileObject(valsName, node.children)
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
        source.push(compilePattern(valName , node.children));
      }
    
      return source.join("\n");
    }
    return module.exports;
  })();

  require.modules['./runtime'] = (function () {
    var module = {exports: {}}, exports = module.exports;
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
    return module.exports;
  })();

  require.modules['./matcher'] = (function () {
    var module = {exports: {}}, exports = module.exports;
    var runtime = require("./runtime");
    
    // Matcher constructor that acts as a linked list of match alternatives.
    function Matcher (patternFn, successFn, next) {
      this.patternFn = patternFn;
      this.successFn = successFn;
      this.next = next;
    }
    
    // Export
    exports.Matcher = Matcher;
    
    // Tries to match a given array of args. If not successful, passes it on to
    // the `next` matcher.
    Matcher.prototype.match = function (args, context) {
      var args2 = this.patternFn(args, runtime);
      if (args2) return this.successFn.apply(context, args2);
      else if (this.next) return this.next.match(args, context);
      else throw new TypeError("All patterns exhausted");
    };
    
    // Clones itself and the next item in the list.
    Matcher.prototype.clone = function () {
      var clone = new Matcher(this.patternFn, this.successFn);
      if (this.next) clone.next = this.next.clone();
      return clone;
    };
    
    // Finds the last Matcher in the chain.
    Matcher.prototype.last = function () {
      var m = this;
      while (m.next) m = m.next;
      return m;
    };
    
    // Remove and return the last item off the chain.
    Matcher.prototype.pop = function () {
      var m = this, prev; 
      while (m.next) {
        prev = m;
        m = m.next;
      }
      if (prev) prev.next = null;
      return m;
    };
    return module.exports;
  })();

  require.modules['./matches'] = (function () {
    var module = {exports: {}}, exports = module.exports;
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
    
        // Check if we've already compiled the same patternStr before.
        if (patternStr in patterns) {
          patternFn = patterns[patternStr];
        }
    
        else {
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
    
    // Sugar for creating a new pattern and immediately invoking it with arguments.
    // This just lets you put the arguments first instead of after the patterns.
    function caseOf (/* args..., matcher */) {
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
    
    // Export
    exports.pattern = pattern;
    exports.caseOf = caseOf;
    exports.parser = parser;
    exports.compiler = compiler;
    exports.extractors = require("./runtime").extractors;
    return module.exports;
  })();

  window.matches = require('./matches');
})();
