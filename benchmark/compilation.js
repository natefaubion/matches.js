var Benchmark = require("benchmark");
var bench = Benchmark({
  util: require("./util"),
  pattern: require("../matches").pattern,
  setup: function () {
    var c = this.count;
    var patterns = [];
    this.psum = 0;
    while (c--) {
      var pat = this.util.randPattern();
      patterns.push(pat[0]);
      this.psum += pat[1];
    }
    this.pavg = this.psum / this.count;
  },
  fn: function () {
    this.pattern(patterns.pop(), function () {});
  },
  initCount: 10000,
  onComplete: function () {
    console.log("Avg number of sub-patterns", this.pavg.toFixed(1));
    console.log("Total time:", this.times.elapsed.toFixed(3) + "s");
    console.log("Avg time per pattern:", (this.times.period * 1000).toFixed(3) + "ms");
  }
});

bench.run();
