DIR     = lib
MODULES = parser compiler runtime matcher matches
UGLIFY  = $(shell find node_modules -name "uglifyjs" -type f)
MOCHA   = $(shell find node_modules -name "mocha" -type f)
PEGJS   = $(shell find node_modules -name "pegjs" -type f)

all: matches.min.js

matches.min.js: matches.js
	@$(UGLIFY) -nmf $< > $@

matches.js: lib/parser.js
	@bash support/browser.sh $(DIR) $(MODULES) > $@

lib/parser.js:
	@$(PEGJS) lib/grammar.pegjs $@

clean:
	@rm -f matches.js matches.min.js lib/parser.js

test:
	@$(MOCHA) --ui tdd

.PHONY: clean test
