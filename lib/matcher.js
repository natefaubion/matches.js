var runtime = require("./runtime");

// Matcher constructor that acts as a linked list of match alternatives.
function Matcher (patternFn, successFn, scope, next) {
  this.patternFn = patternFn;
  this.successFn = successFn;
  this.scope = scope;
  this.next = next;
}

// Export
exports.Matcher = Matcher;

// Tries to match a given array of args. If not successful, passes it on to
// the `next` matcher.
Matcher.prototype.match = function (args, context) {
  var args2 = this.patternFn(args, runtime, this.scope);
  if (args2) return this.successFn.apply(context, args2);
  else if (this.next) return this.next.match(args, context);
  else throw new TypeError("All patterns exhausted");
};

// Clones itself and the next item in the list.
Matcher.prototype.clone = function () {
  var clone = new Matcher(this.patternFn, this.successFn, this.scope);
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
  prev.next = null;
  return m;
};
