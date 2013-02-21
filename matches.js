// matches.js
// ----------
// Powerful pattern matching for Javascript
//
// version : 0.5.1
// author  : Nathan Faubion <nathan@n-son.com>
// repo    : https://github.com/natefaubion/matches.js
// license : MIT

;(function (window, module) {
  "use strict";

  // Parser
  // ------

  function parse (str) {
    var inp = new Input(str);
    var tree = start(inp);
    return tree;
  }

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
  };

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

  // The entry point of the parser.
  function start (inp) {
    var res = parseArgumentList(inp.skipWs());
  
    // If there is any leftover, we have input that did not match our grammar,
    // so throw a generic syntax error.
    if (inp.skipWs().buffer) syntaxError(inp);
    return res;
  }

  // The root of the tree. An argument list is just like an array, but doesn't
  // have the brackets around it.
  function parseArgumentList (inp) {
    return nodeArgumentList(parseRestPatterns(inp));
  }

  // A comma-separated list of patterns. Patterns are everything except rest
  // expressions.
  function parsePatterns (inp) {
    return commaSeparated(parsePattern, inp);
  }

  // A comma-separated list of patterns, including rest expressions. Rest
  // expressions only apply within an array-like context.
  function parseRestPatterns (inp) {
    return commaSeparated(parseRestPattern, inp, multiRestCallback());
  }

  // Matches a single rest expression or pattern.
  function parseRestPattern (inp) {
    return parseRest(inp)
        || parsePattern(inp);
  }

  // Matches a single pattern expression.
  function parsePattern (inp) {
    return parseWildcard(inp)
        || parseNullLiteral(inp)
        || parseUndefinedLiteral(inp)
        || parseBooleanLiteral(inp)
        || parseNumberLiteral(inp)
        || parseStringLiteral(inp)
        || parseClassPattern(inp)
        || parseExtractor(inp)
        || parseArray(inp)
        || parseObject(inp)
        || parseIdentPattern(inp);
  }
  
  // Parses a rest expression. A rest expressions is an ellipsis followed by
  // another pattern (ie. mapping the pattern over a list). If the pattern is
  // left off, a wildcard is implied.
  function parseRest (inp) {
    var res = inp.takeAPeek("...");
    if (res) return nodeRest(parsePattern(inp) || nodeWildcard());
  }
  
  // Parses a wildcard.
  function parseWildcard (inp) {
    if (inp.takeAPeek("_")) return nodeWildcard();
  }
  
  // Parses `null`.
  function parseNullLiteral (inp) {
    if (inp.takeAPeek(NULL)) return nodeNullLiteral();
  }
  
  // Parses `undefined`.
  function parseUndefinedLiteral (inp) {
    if (inp.takeAPeek(UNDEF)) return nodeUndefinedLiteral();
  }

  // Parses `true` or `false`.
  function parseBooleanLiteral (inp) {
    var match = inp.takeAPeek(BOOL);
    if (match) return nodeBooleanLiteral(match[0]);
  }

  // Parses a number. Numbers a fairly complicated and can appear in a variety
  // of forms. You'll see the helper functions later on.
  function parseNumberLiteral (inp) {
    var res = parseNumber(inp);
    if (res) return nodeNumberLiteral(res);
  }
    
  // Parses a string. Like numbers, strings are are quite compilcated. You'll
  // see these helper functions later on.
  function parseStringLiteral (inp) {
    var res = parseString(inp);
    if (res) return nodeStringLiteral(res);
  }
  
  // Parses class names and class destructuring. Classes can either be
  // destructured with object-like matching or array-like matching. Object
  // matching uses the curly-brace notation, while array matching uses paren
  // notation (this differs from array literals which use brackets).
  function parseClassPattern (inp) {
    var match = inp.takeAPeek(CLASS);
    if (match) {
      var name = match[0];
  
      // Object-like destructuring.
      var res = parseObject(inp);
      if (res) return nodeClass(name, res);
  
      // Array-like destructuring, but uses parens instead of brackets so we 
      // need to use a custom wrapper instead of reusing the array helper.
      res = wrapped("(", ")", parseRestPatterns, nodeArray, inp);
      if (res) return nodeClass(name, res);
  
      // Just a class name.
      return nodeClass(name);
    }
  }

  // Parses custom extractors. Extractors are identifiers that begin with a
  // dollar sign.
  function parseExtractor (inp) {
    var match = inp.takeAPeek(EXTRACTOR);
    if (match)
      return wrapped("(", ")", parsePattern, extractorRes, inp)
          || nodeExtractor(match[1]);
  
    function extractorRes (res) {
      return nodeExtractor(match[1], res);
    }
  }
  
  // Parses array destructuring.
  function parseArray (inp) {
    return wrapped("[", "]", parseRestPatterns, nodeArray, inp);
  }

  // Parses object destructuring.
  function parseObject (inp) {
    return wrapped("{", "}", parseObjectPatterns, nodeObject, inp);
  }
  
  // Comma-separated list of object patterns.
  function parseObjectPatterns (inp) {
    return commaSeparated(parseObjectPattern, inp);
  }

  // Objects can only contain keys or key-value pairs.
  function parseObjectPattern (inp) {
    var res = parseKey(inp);
    if (res) {
      if (inp.skipWs().takeAPeek(":")) {
        var patt = parsePattern(inp.skipWs());
        if (patt) return nodeKeyValue(res, patt);
      }
      return nodeKey(res);
    }
  }
  
  // Keys can be strings or JS identifiers.
  function parseKey (inp) {
    var res = parseString(inp);
    if (res) return res;
  
    var match = inp.takeAPeek(JS_IDENT);
    if (match) return match[0]
  }

  // Parses identifiers and binders, which are for when you want to destructure
  // the value but also pass the original value to the function. Binders are
  // an identifier, followed by an @ and another pattern.
  function parseIdentPattern (inp) {
    var match = inp.takeAPeek(IDENT);
    if (match) {
      if (inp.takeAPeek("@")) {
        var patt = parseBinderPattern(inp);
        if (patt) return nodeBinder(match[0], patt);
      }
      return nodeIdentifier(match[0])
    }
  }

  // Binders don't allow just any expression. Literals are left out because if
  // you are matching on a literal, you already know what the value is so why
  // would ou need to pass it on to the function?
  function parseBinderPattern (inp) {
    return parseClassPattern(inp)
        || parseArray(inp)
        || parseObject(inp);
  }
  
  // Parses a wrapped pattern, like an array or object.
  function wrapped (del1, del2, pattFn, nodeFn, inp) {
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
      if (res.type === "rest" && ++count > 1) {
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

  function parseString (inp) {
    return parseQuotedString('"', DOUBLE_QUOTED_CHAR, inp)
        || parseQuotedString("'", SINGLE_QUOTED_CHAR, inp);
  }
  
  function parseQuotedString (q, regx, inp) {
    if (inp.takeAPeek(q)) {
      var str = parseQuotedStringChars(regx, inp);
      if (inp.takeAPeek(q)) return str;
      else syntaxError(inp, "Expected " + q);
    }
  }
  
  function parseQuotedStringChars (regx, inp) {
    var str = "";
    while (1) {
      var res = inp.takeAPeek(regx);
      if (res) str += res;
      else if (inp.peek("\\")){
        res = parseEscapeSeq(inp);
        if (res) str += res;
        else break;
      } else break;
    }
    return str;
  }
  
  function parseEscapeSeq (inp) {
    return parseNullEscapeSeq(inp)
        || parseSpecialEscapeSeq(HEX_SEQ, inp)
        || parseSpecialEscapeSeq(UNICODE_SEQ, inp)
        || parseCharEscapeSeq(inp);
  }
  
  function parseNullEscapeSeq (inp) {
    if (inp.takeAPeek(NULL_ESCAPE_CHAR)) return "\0";
  }
  
  function parseSpecialEscapeSeq (regx, inp) {
    var match = inp.takeAPeek(regx);
    if (match) return String.fromCharCode(parseInt("0x" + match[1]));
  }
  
  function parseCharEscapeSeq (inp) {
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
  
  function parseNumber (inp) {
    var res = "";
    if (inp.takeAPeek("-")) res += "-";
  
    var match = parseInteger(inp);
    if (match) res += match;
  
    match = parseFraction(inp);
    if (match) res += match;
  
    if (res && res !== "-") {
      match = parseExponent(inp);
      if (match) res += match;
    }
  
    if (res === "-") syntaxError(inp, "Expected number");
    return res || null;
  }
  
  function parseFraction (inp) {
    if (inp.takeAPeek(".")) {
      var ds = inp.takeAPeek(DIGITS);
      if (ds) return "." + ds;
      syntaxError(inp, "Expected digit");
    }
  }
  
  function parseExponent (inp) {
    var match = inp.takeAPeek(E_SIGN);
    if (match) {
      var ds = inp.takeAPeek(DIGITS);
      if (ds) return match[0] + ds;
    }
  }
  
  function parseInteger (inp) {
    return inp.takeAPeek(DIGIT_TEN_PLUS)
        || inp.takeAPeek(DIGIT);
  }
  
  // Parser RegExps
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

  // Parser Nodes
  // ------------

  // Nodes are comprised of a type, a normalized pattern, and optionally a
  // value and/or children. The `children` attribute is always used for child
  // patterns even if there is no `value`. The `value` attribute is always
  // used for simple values (like for booleans or numbers), never for patterns.

  function node (type, pattern, val, children) {
    var ret = { pattern: pattern, type: type };
    if (val !== undefined) ret.value = val;
    if (children !== undefined) ret.children = children;
    return ret;
  }
  
  function nodeArgumentList (res) {
    return node("argumentList", patternStrings(res).join(","), undefined, res);
  }
  
  function nodeRest (res) {
    return node("rest", "..." + res.pattern, undefined, [res]);
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
  
  function nodeBinder (res, patt) {
    return node("binder", res + "@" + patt.pattern, res, [patt]);
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
  
  // Array-like class destructuring results in a child array node, but the
  // pattern is inacurately reflected as being surrounded by brackets. We
  // check for that and correct it.
  function nodeClass (name, res) {
    var patt = name;
    if (res) {
      patt += res.type === "array"
        ? "(" + res.pattern.substring(1, res.pattern.length - 1) + ")"
        : res.pattern;
    }
    return node("class", patt, name, res ? [res] : undefined);
  }
  
  function nodeExtractor (name, res) {
    return res
      ? node("extractor", "$" + name + "(" + res.pattern + ")", name, [res])
      : node("extractor", "$" + name, name);
  }

  // Parser Utility Functions
  // ------------------------

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

  // Compiler
  // --------
  
  function compile (tree) {
    if (typeof tree === "string") tree = parse(tree);

    // Every compiled function gets called with a reference to the runtime.
    return new Function(["args", "runt"], [
      'var ret = [];',
      compileArgumentList(tree),
      'return ret;'
    ].join('\n'));
  }

  // Mapping of node types to compiler functions
  var compilers = {
    "wildcard"    : compileWildcard,
    "null"        : compileLiteral,
    "undefined"   : compileLiteral,
    "boolean"     : compileLiteral,
    "number"      : compileLiteral,
    "string"      : compileLiteral,
    "identifier"  : compileIdentifier,
    "binder"      : compileBinder,
    "array"       : compileArray,
    "object"      : compileObject,
    "class"       : compileClass,
    "extractor"   : compileExtractor
  };

  function compileArgumentList (node) {
    return compileArray('args', node);
  }
  
  function compilePattern (argName, node) {
    return compilers[node.type](argName, node);
  }
  
  // Wildcards don't perform any matching or stash any values, so just return
  // an empty string.
  function compileWildcard () {
    return '';
  }

  // The simple literals like null, undefined, booleans, strings, numbers can
  // all use the same checking.
  function compileLiteral (argName, node) {
    return 'if (' + argName + ' !== ' + node.pattern + ') return false;';
  }
  
  function compileIdentifier (argName) {
    return 'ret[ret.length] = ' + argName + ';';
  }
  
  function compileBinder (argName, node) {
    var source = [
      compileIdentifier(argName),
      compilePattern(argName, node.children[0])
    ];
    return source.join('\n');
  }
  
  function compileArray (argName, node) {
    return hasRest(node)
      ? compileArrayRest(argName, node)
      : compileArrayStrict(argName, node);
  }
  
  function compileArrayStrict (argName, node) {
    var arrLen = node.children.length;
    var source = [
      'if (!(' + argName + ' instanceof Array) || ' +
        argName + '.length !== ' + arrLen + ') return false;'
    ];
  
    var i = 0, len = node.children.length, childArgName;
    for (; i < len; i++) {
      childArgName = argName + '_' + i;
      source.push(
        'var ' + childArgName + ' = ' + argName + '[' + i + '];',
        compilePattern(childArgName, node.children[i])
      );
    }
  
    return source.join('\n');
  }
  
  function compileArrayRest (argName, node) {
    var arrLen = node.children.length;
    var minLen = arrLen - 1;
    var posName = argName + '_pos'; // Used for calculating the slice position
    var restName = argName + '_rest'; // Used for storing the rest
    var source = [
      'if (!(' + argName + ' instanceof Array) ||' +
        argName + '.length < ' + minLen + ') return false;',
      'var ' + posName + ' = 0;',
      'var ' + restName + ';'
    ];

    var i = 0, len = node.children.length, childArgName, child, restType;
    for (; i < len; i++) {
      child = node.children[i];
      childArgName = argName + '_' + i;
  
      if (child.type !== "rest") {
        source.push(
          'var ' + childArgName + ' = ' + argName + '[' + posName + '++];',
          compilePattern(childArgName, child)
        );
        continue;
      }

      // If the current child is a rest token, perform the appropriate slicing
      // and stashing. Different slices are used depending on whether the token
      // is in the middle of the child patterns or at the end.

      // Rest is at the end.
      if (i === minLen) {
        source.push(restName + ' = ' + argName + '.slice(' + i + ');');
      }

      // Rest is at the beginning.
      else if (i === 0) {
        source.push(
          posName + ' = ' + argName + '.length - ' + minLen + ';',
          restName + ' = ' + argName + '.slice(0, ' + posName + ');'
        );
      }

      // Rest is in the middle.
      else {
        source.push(
          posName + ' = ' + argName + '.length - ' + (minLen - i) + ';',
          restName + ' = ' + argName + '.slice(' + i + ', ' + posName + ');'
        );
      }

      // The type of the rest expression.
      restType = child.children[0].type;

      // Just stash slice if its an identifier.
      if (restType === "identifier") {
        source.push(compileIdentifier(restName));
      }

      // No need to do anything for wildcards, otherwise compile the rest
      // expression.
      else if (restType !== "wildcard") {
        source.push(compileRest(restName, child));
      }
    }
  
    return source.join('\n');
  }
  
  function compileObject (argName, node) {
    var source = [
      'if (!(' + argName + ' instanceof Object)) return false;'
    ];

    var i = 0, len = node.children.length, childArgName, child;
    for (; i < len; i++) {
      child = node.children[i];
      childArgName = argName + '_' + i;

      // Check that the key exists in the object.
      source.push('if (!(' + child.value + ' in ' + argName + ')) return false;');

      // If the child is just a key, stash it
      if (child.type === "key") {
        source.push(compileIdentifier(argName + '[' + child.value + ']'));
      }

      // If the child is a keyValue, perform further compilation.
      else {
        source.push(
          'var ' + childArgName + ' = ' + argName + '[' + child.value + '];',
          compilePattern(childArgName, child.children[0])
        );
      }
    }
  
    return source.join('\n');
  }
  
  function compileClass (argName, node) {
    var source = [
      'if (!runt.matchesTypeName(' + argName + ', "' + node.value + '")) return false;'
    ];

    if (node.children) {
      var isArray = node.children[0].type === 'array';
      var unapply = isArray ? 'unapply' : 'unapplyObj';
      var compFn  = isArray ? compileArray : compileObject;
      var valsName = argName + '_vals';
      source.push(
        'if (!' + argName + '.constructor || ' +
            '!' + argName + '.constructor.' + unapply + ') return false;',
        'var ' + valsName + ' = ' + argName + '.constructor.' + unapply + '(' + argName +');',
        compFn(valsName, node.children[0])
      );
    }

    return source.join('\n');
  }
  
  function compileExtractor (argName, node) {
    var extName = argName + '_ext';
    var valName = argName + '_val';
    var source = [
      'var ' + extName + ' = runt.callExtractor("' + node.value  + '", ' + argName + ');',
      'if (!' + extName + ' || !(' + extName + ' instanceof runt.Pass)) return false;'
    ];
    
    if (node.children) {
      source.push('var ' + valName + ' = ' + extName + '.val;');
      source.push(compilePattern(valName , node.children[0]));
    }
  
    return source.join('\n');
  }

  // The basic idea of rest expressions is that we create another matching
  // function and call that function on all items in the array. We then
  // aggregate all the stashed values and concat them with the `ret` array.
  // We need to know ahead of time how many values are going to be stashed,
  // so we call `countIdentifiers` to traverse the children, returning the
  // number of nodes that can cause a value to be stashed.
  function compileRest (argName, node) {
    var source = [];
    var retInit = [];
    
    // Count the number of identifiers we will need to stash.
    var i = 0, len = countIdentifiers(node);
    for (; i < len; i++) retInit.push('[]');
  
    var retName     = argName + '_ret';
    var loopName    = argName + '_loop';
    var iName       = argName + '_i';
    var lenName     = argName + '_len';
    var retArgsName = argName + '_retargs';
  
    source.push(
      'var ' + retName + ' = [' + retInit.join(',') + '];',
      'var ' + loopName + ' = function (val) {',
      '  var ret = [];',

      indent(2, compilePattern('val', node.children[0])),

      '  return ret;',
      '};',
      'var ' + iName + ' = 0, ' + lenName + ' = ' + argName + '.length, ' + retArgsName + ';',
      'for (; ' + iName + ' < ' + lenName + '; ' + iName + '++) {',
      '  ' + retArgsName + ' = ' + loopName + '(' + argName + '[' + iName + ']);',
      '  if (!' + retArgsName + ') return false;',

      (function () {
        var src = [];
        for (i = 0; i < len; i++) {
          src.push('  ' + retName + '[' + i + '].push(' + retArgsName + '[' + i + ']);');
        }
        return src.join('\n');
      })(),

      '}',
      'ret = Array.prototype.concat.call(ret, ' + retName + ');'
    );
  
    return source.join('\n');
  }
  
  // Checks if a rest expression is present in the node's children.
  function hasRest (node) {
    for (var i = 0, child; (child = node.children[i]); i++) {
      if (child.type === "rest") return true;
    }
    return false;
  }
  
  // Scans all children for a node and counts the number of identifier patterns.
  // Identifier patterns include captures and object keys.
  function countIdentifiers (node) {
    if (!node.children) return 0;
    var count = 0, i = 0, len = node.children.length, type;
    for (; i < len; i++) {
      type = node.children[i].type;
      if (type === "identifier" || type === "binder" || type === "key") count += 1;
      else count += countIdentifiers(node.children[i]);
    }
    return count;
  }

  // Indents a section of code by the specified number of spaces. This is just
  // so the compiled code looks nice.
  function indent (spaces, str) {
    return str.replace(/^/gm, Array(spaces + 1).join(" "));
  }

  // Runtime
  // -------

  var runtime = {};
  var extractors = {};

  // Given an object and a class name, tries to determine if the object is an
  // instance of said class.
  runtime.matchesTypeName = function (obj, name) {
    // Check the toString name first. This is for core Javascript types like
    // String, Number, Boolean, etc.
    var typeStr = Object.prototype.toString.call(obj);
    if (typeStr.substring(8, typeStr.length - 1) === name) {
      return true;
    }
  
    // Check the function name.
    if (obj.constructor) {
      if (obj.constructor.className === name || 
          obj.constructor.name === name) {
        return true;
      }
    }
  
    // No match
    return false;
  };
  
  // Given a name and value, looks up an extractor and calls it. If the
  // extractor does not exist, it will throw an error.
  runtime.callExtractor = function (name, val) {
    if (!extractors.hasOwnProperty(name)) {
      throw new Error("Extractor does not exist: " + name);
    }
    return extractors[name](val, runtime.Pass);
  };
  
  // Extractors must return an instance of `Pass` to count as a successful 
  // match. We can't use a sentinal value like `undefined` to count as a fail
  // since its a valid value to match on.
  runtime.Pass = function (val) {
    if (!(this instanceof runtime.Pass)) return new runtime.Pass(val);
    this.val = val;
  };

  // Matcher
  // -------
  
  // Matcher constructor that acts as a linked list of match alternatives.
  function Matcher (patternFn, successFn, next) {
    this.patternFn = patternFn;
    this.successFn = successFn;
    this.next = next;
  }
  
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

  // Matches.js Core
  // ---------------

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
      tree = parse(patternStr);
      if (!normalized.hasOwnProperty(tree.pattern)) {
        fn = compile(tree);
        fn.pattern = tree.pattern;
        normalized[tree.pattern] = fn;
      }
      patterns[patternStr] = normalized[tree.pattern];
    }
    return patterns[patternStr];
  }

  // Creates a pattern matching function given a string and a fn to execute.
  // The `chain` argument is for internal use only. It's a reference to the
  // chain that we are adding a pattern to.
  function pattern () {
    var targ0 = typeof arguments[0];
    var targ1 = typeof arguments[1];
    var targ2 = typeof arguments[2];
  
    // Shared vars
    var matcherFn, patternObj, patternFn, patternStr, successFn, chain, tree, last;
  
    // pattern(matcherFn, chain)
    if (targ0 == "function" && (targ1 == "undefined" || targ1 == "object")) { 
      matcherFn = arguments[0];
      chain = arguments[1];
  
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
      patternObj = arguments[0];
      chain = arguments[1] ? arguments[1].clone() : null;
      for (patternStr in patternObj) {
        matcherFn = pattern(patternStr, patternObj[patternStr], chain);
        chain = matcherFn.__matchChain;
      }
      return matcherFn;
    }
  
    // pattern(patternFn, successFn, chain)
    else if (targ0 == "function" && targ1 == "function") {
      chain = arguments[2] ? arguments[2].clone() : null;
      return matcher(arguments[0], arguments[1], chain);
    }
  
    // pattern(patternStr, successFn, chain)
    else {
      patternStr = arguments[0];
      successFn = arguments[1];
      chain = arguments[2] ? arguments[2].clone() : null;
      patternFn = getOrCompile(patternStr);
      return matcher(patternFn, successFn, chain);
    }
  }
  
  // Creates a function that tries a match and executes the given fn if
  // successful. If not it tries subsequent patterns.
  function matcher (patternFn, successFn, chain) {
    var matcherObj = new Matcher(patternFn, successFn);
  
    // If a chain was provided, add the new matcher to the end of the chain.
    if (chain) {
      chain.last().next = matcherObj;
    } else {
      chain = matcherObj;
    }
  
    var fn = function () {
      // This seems like an odd optimization, but manually copying the
      // arguments object over to an array instead of calling `slice` can
      // speed up dispatch time 2-3x.
      var args = [], i = 0, len = arguments.length;
      for (; i < len; i++) args[i] = arguments[i];
      return chain.match(args, this);
    };
  
    fn.alt = function () {
      var args = slice.call(arguments);
      args.push(chain);
      return pattern.apply(null, args);
    };
  
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
  
  // Like extract, but returns the first extracted value or undefined.
  function extractOne (/* pattern, ...args */) {
    var res = extract.apply(this, arguments);
    return res === null ? void 0 : res[0];
  }

  // Export
  // ------

  window.matches = module.exports = {
    pattern    : pattern,
    caseOf     : caseOf,
    extract    : extract,
    extractOne : extractOne,
    extractors : extractors,
    parse      : parse,
    compile    : compile,
    compilers  : compilers,
    runtime    : runtime,
    Matcher    : Matcher
  };
})(
  typeof window !== "undefined" ? window : {},
  typeof module !== "undefined" ? module : {}
);
