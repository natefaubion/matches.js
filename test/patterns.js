var patterns = require("../lib");
var pattern = patterns.pattern;
var assert = require("assert");

suite("Patterns", function () {
  var func;

  function OK () { return true; }
  function notOK () { return false; }

  function single (pat, fn) { 
    return pattern(pat, fn || OK).alt("_", notOK); 
  }

  function testPattern (pat, val, fn) {
    test(pat + " -> OK", function () {
      func = single(pat, fn);
      assert.ok(func(val));
    });
  }

  function failPattern (pat, val, fn) {
    test(pat + " -> FAIL", function () {
      func = single(pat, fn);
      assert.ok(!func(val));
    });
  }

  // Simple literals
  // ---------------

  testPattern("null", null);
  testPattern("undefined", undefined);
  testPattern("42", 42);

  testPattern("true", true);
  testPattern("false", false);

  testPattern("'foo'", "foo");
  testPattern('"\'quoted\'\\n\\t"', "'quoted'\n\t");

  // Core types
  // ----------

  testPattern("Number", 12);
  testPattern("String", "foo");
  testPattern("Date", new Date());
  testPattern("RegExp", /^/);
  testPattern("Function", function () {});
  testPattern("Array", []);
  testPattern("Object", {});

  // Identifiers
  // -----------

  testPattern("x", 42, function (x) {
    return x === 42;
  });

  // Arrays
  // ------

  testPattern("[]", []);
  testPattern("[1, false, 'foo']", [1, false, "foo"]);
  testPattern("[_, _, _]", [12, 34, "foo"]);

  testPattern("[x]", [42], function (x) {
    return x === 42;
  });

  failPattern("[x]", [1, 2]);

  testPattern("[_, x]", [1, 42], function (x) {
    return x === 42;
  });

  testPattern("[x..., y, z]", [1, 1, 1, 2, 3], function (x, y, z) {
    return x.length === 3 && y === 2 && z === 3;
  });

  testPattern("[x, y..., z]", [1, 2, 2, 2, 3], function (x, y, z) {
    return y.length === 3 && x === 1 && z === 3;
  });

  testPattern("[x, y, z...]", [1, 2, 3, 3, 3], function (x, y, z) {
    return z.length === 3 && x === 1 && y === 2;
  });

  testPattern("[...]", [1, 2, 3], function (a) {
    return a === void 0;
  });

  // Objects
  // -------

  testPattern("{}", {});
  testPattern("{a, b}", {a: 1, b: 2});
  failPattern("{c, d}", {c: 1, e: 2});
  failPattern("{e, f}", {e: 1, f: 2, g: 3});

  testPattern("{x, y}", {x: 1, y: 2}, function (x, y) {
    return x === 1 && y === 2;
  });

  testPattern("{a:x, b:y}", {a: 1, b: 2}, function (x, y) {
    return x === 1 && y === 2;
  });

  testPattern("{a:_, b:x}", {a: 1, b: 2}, function (x) {
    return x === 2; 
  });

  // Captures
  // --------

  var arr = [1, 2, 3];
  testPattern("x@[head, tail...]", arr, function (x, head, tail) {
    return x === arr && head === 1 && tail.length === 2;
  });

});
