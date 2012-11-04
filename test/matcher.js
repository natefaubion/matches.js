var Matcher = require("../matches").Matcher;
var assert  = require("assert");

suite("Matcher", function () {
  var count, chain;

  function _ () {}
  function pass () { return false; }
  function match () { return []; }
  function plus (num) { 
    return function () {
      count += num;
    };
  }

  setup(function () {
    count = 0;
    chain = null;
  });

  test("match()", function () {
    chain = new Matcher(pass, plus(1));
    chain.next = new Matcher(pass, plus(2));
    chain.next.next = new Matcher(match, plus(4));
    chain.match();
    assert.equal(count, 4);

    count = 0;
    chain.next.patternFn = match;
    chain.match();
    assert.equal(count, 2);

    count = 0;
    chain.patternFn = match;
    chain.match();
    assert.equal(count, 1);

    chain = new Matcher(pass, _);
    assert.throws(function () {
      chain.match();
    });
  });

  test("clone()", function () {
    var chain1 = new Matcher(pass, _, new Matcher(pass, _));
    var chain2 = chain1.clone();
    assert.ok(chain1 !== chain2 && chain1.next !== chain2.next);
  });

  test("last()", function () {
    chain = new Matcher(pass, _);
    chain.next = new Matcher(pass, _);
    chain.next.next = new Matcher(match, _);

    var last = chain.last();
    assert.equal(last, chain.next.next);
  });

  test("pop()", function () {
    chain = new Matcher(pass, _);
    chain.next = new Matcher(pass, _);
    
    var last = chain.next;
    assert.equal(chain.pop(), last);
    assert.equal(chain.next, null);
    assert.equal(chain.pop(), chain);
  });

});
