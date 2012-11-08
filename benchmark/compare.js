var Benchmark = require("benchmark");
var pattern = require("../matches").pattern;
var suite = Benchmark.Suite();

function ok () {
  return true;
}

// Pattern matching fn
// -------------------

var patternFn = pattern({
  '[]': ok,
  '[x]': ok,
  '[head, ...tail]': ok,
  '{x, y}': ok,
  'Number': ok
});

suite.add("Matches.js", {
  testFn: patternFn,
  fn: function () {
    this.testFn([]);
    this.testFn([1]);
    this.testFn([1, 2, 3]);
    this.testFn({x: 1, y: 2});
    this.testFn(12);
  }
});

// Handwritten fn
// --------------

var handwrittenFn = function (arg) {
  if (arg instanceof Array) {
    if (arg.length === 0) return ok.call(this);
    if (arg.length === 1) return ok.call(this, arg[0]);
    if (arg.length >= 2) {
      var head = arg[0];
      var tail = arg.slice(1);
      return ok.call(this, head, tail);
    }
  }
  if (arg instanceof Object) {
    if ("x" in arg && "y" in arg) {
      return ok.call(this, arg.x, arg.y);
    }
  }
  if (typeof arg === "number") {
    return ok.call(this);
  }
}

suite.add("Handwritten", {
  testFn: handwrittenFn,
  fn: function () {
    this.testFn([]);
    this.testFn([1]);
    this.testFn([1, 2, 3]);
    this.testFn({x: 1, y: 2});
    this.testFn(12);
  }
});

// Results
// -------

suite.on("complete", function (e) {
  var matches = this['0'].times;
  var handwritten = this['1'].times;
  var diff;

  console.log("Matches.js:", (matches.period * 1000 * 1000).toFixed(1) + "µs");
  console.log("Handwritten:", (handwritten.period * 1000 * 1000).toFixed(1) + "µs");

  if (matches.period > handwritten.period) {
    diff = (matches.period / handwritten.period).toFixed(1);
    console.log("Matches.js is " + diff + "x slower than hand optimized.");
  } else {
    diff = (handwritten.period / matches.period).toFixed(1);
    console.log("Matches.js is " + diff + "x faster than hand optimized.");
  }
});

suite.run();
