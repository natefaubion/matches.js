var matches = require("../lib/matches");
var pattern = matches.pattern;
var Matcher = require("../lib/matcher").Matcher;
var assert  = require("assert");

suite("Core", function () {
  var patFn;

  test("pattern(patternStr, fn)", function () {
    patFn = pattern("[]", function () { return 42; });
    assert.ok(patFn instanceof Function);
    assert.ok(patFn.__matchChain instanceof Matcher);
    assert.equal(patFn.__matchChain.patternFn.pattern, '[]');
    assert.equal(patFn([]), 42);
  });

  test("pattern(patternObj)", function () {
    patFn = pattern({
      "[]" : function () { return 1; },
      "{}" : function () { return 2; },
      "_"  : function () { return 3; }
    });
    assert.ok(patFn instanceof Function);
    assert.ok(patFn.__matchChain instanceof Matcher);

    var chain = patFn.__matchChain;
    assert.ok(chain.next && chain.next.next);
    assert.equal(chain.patternFn.pattern, '[]');
    assert.equal(chain.next.patternFn.pattern, '{}');
    assert.equal(chain.next.next.patternFn.pattern, '_');
  });

  test("pattern(patternFn, fn)", function () {
    patFn = pattern(
      function (args) { return [42]; },
      function (val) { return val; }
    );
    assert.ok(patFn instanceof Function);
    assert.ok(patFn.__matchChain instanceof Matcher);
    assert.equal(patFn(12), 42);
  });

  test("pattern.alt()", function () {
    patFn =
      pattern("[]", function () { return 1; })
         .alt("{}", function () { return 2; })
         .alt("_",  function () { return 3; });

    assert.ok(patFn instanceof Function);
    assert.ok(patFn.__matchChain instanceof Matcher);

    var chain = patFn.__matchChain;
    assert.ok(chain.next && chain.next.next);
    assert.equal(chain.patternFn.pattern, '[]');
    assert.equal(chain.next.patternFn.pattern, '{}');
    assert.equal(chain.next.next.patternFn.pattern, '_');
  });

});
