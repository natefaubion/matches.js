var matches = require("../matches");
var pattern = matches.pattern;
var caseOf = matches.caseOf;
var assert = require("assert");
var adt = require("adt");

suite("Patterns", function () {
  var func;

  function OK () { return true; }
  function notOK () { return false; }

  function single (pat, fn) { 
    return pattern(pat, fn || OK).alt("...", notOK); 
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
  testPattern("12.6", 12.6);
  testPattern("1e+42", 1e+42);

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

  testPattern("[...x, y, z]", [1, 1, 1, 2, 3], function (x, y, z) {
    return x.length === 3
        && x[0] === 1
        && x[1] === 1
        && x[2] === 1
        && y === 2
        && z === 3;
  });

  testPattern("[x, ...y, z]", [1, 2, 2, 2, 3], function (x, y, z) {
    return y.length === 3 
        && y[0] === 2
        && y[1] === 2
        && y[2] === 2
        && x === 1
        && z === 3;
  });

  testPattern("[x, y, ...z]", [1, 2, 3, 3, 3], function (x, y, z) {
    return z.length === 3 
        && z[0] === 3
        && z[1] === 3
        && z[2] === 3
        && x === 1
        && y === 2;
  });

  testPattern("[...]", [1, 2, 3], function (a) {
    return a === void 0;
  });

  // Rest Arguments
  // --------------

  test("a, ...b", function () {
    assert.ok(caseOf(1, 2, 3, {
      "a, ...b": function (a, b) {
        return a === 1
            && b.length === 2
            && b[0] === 2
            && b[1] === 3;
      }
    }));
  });

  // Rest Expressions
  // ----------------
  var rest1 = [1, 2, 3];
  testPattern("[...Number]", rest1);

  var rest2 = [{x: 1}, {x: 2}, {x: 3}];
  testPattern("[...{x: _}]", rest2);
  testPattern("[...{x}]", rest2, function (x) {
    return x.length === 3 && x[0] === 1 && x[1] === 2 && x[2] === 3;
  });

  var rest3 = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  testPattern("[...[...Number]]", rest3);
  testPattern("[...[x, y, z]]", rest3, function (x, y, z) {
    return x.length === 3 && x[0] === 1 && x[1] === 4 && x[2] === 7
        && y.length === 3 && y[0] === 2 && y[1] === 5 && y[2] === 8
        && z.length === 3 && z[0] === 3 && z[1] === 6 && z[2] === 9;
  });

  testPattern("[...[head, ...tail]]", rest3, function (h, t) {
    return h.length === 3 && h[0] === 1 && h[1] === 4 && h[2] === 7
        && t.length === 3
        && t[0].length === 2 && t[0][0] === 2 && t[0][1] === 3
        && t[1].length === 2 && t[1][0] === 5 && t[1][1] === 6
        && t[2].length === 2 && t[2][0] === 8 && t[2][1] === 9;
  });

  // Objects
  // -------

  testPattern("{}", {});
  testPattern("{a, b}", {a: 1, b: 2});
  testPattern("{e, f}", {e: 1, f: 2, g: 3});

  testPattern("{x, y}", {x: 1, y: 2}, function (x, y) {
    return x === 1 && y === 2;
  });

  testPattern("{a:x, b:y}", {a: 1, b: 2}, function (x, y) {
    return x === 1 && y === 2;
  });

  testPattern("{a:_, b:x}", {a: 1, b: 2}, function (x) {
    return x === 2; 
  });

  testPattern("{a, b:x}", {a: 1, b: 2}, function (a, x) {
    return a === 1 && x === 2;
  });

  testPattern("{'a b c':x}", {'a b c': 2}, function (x) {
    return x === 2;
  })

  // Binders
  // -------

  var arr = [1, 2, 3];
  testPattern("x@[head, ...tail]", arr, function (x, head, tail) {
    return x === arr && head === 1 && tail.length === 2;
  });

  // adt.js types
  // ------------

  var Foo = adt.data({
    Bar: adt.record("a", "b", "c"),
    Baz: adt.record("d")
  });

  var bar = Foo.Bar(1, 2, 3);
  var baz = Foo.Baz(42);
  var bar2 = Foo.Bar(baz, 2, 3);

  testPattern("Bar(a, 2, Number)", bar);
  testPattern("Bar(1, ...)", bar);

  testPattern("Bar(a@Baz(b), _, _)", bar2, function (a, b) {
    return a === baz && b === 42;
  });

  testPattern("Bar(a, ...b)", bar, function (a, b) {
    return a === 1
        && b[0] === 2
        && b[1] === 3;
  });

  testPattern("Bar{a, b, c}", bar, function (a, b, c) {
    return a === 1
        && b === 2
        && c === 3;
  });

  testPattern("Bar{a: 1, b: 2, c: 3}", bar);

  // Custom types
  // ------------

  function Test () {
    this.a = 1;
  }

  Test.unapply = function (obj) {
    return [obj.a];
  };

  Test.unapplyObj = function (obj) {
    return {a: obj.a};
  };

  var t = new Test();
  testPattern("Test", t);
  testPattern("Test(1)", t);
  testPattern("Test{a: 1}", t);

  // Extractors
  // ----------

  matches.extractors.email = function (val, pass) {
    if (typeof val === "string" && val.indexOf("@") > 0) {
      var parts = val.split("@");
      return pass({
        user: parts[0],
        domain: parts[1]
      });
    }
  };

  testPattern("$email(x)", "foo@bar.com", function (x) {
    return x.user === "foo"
        && x.domain === "bar.com";
  });

  failPattern("$email(x)", "not an email");

});
