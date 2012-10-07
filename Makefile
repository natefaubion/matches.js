DIR     = lib
MODULES = parser compiler runtime matcher matches
UGLIFY  = $(shell find node_modules -name "uglifyjs" -type f)
MOCHA   = $(shell find node_modules -name "mocha" -type f)

all: matches.min.js

matches.min.js: matches.js
	@$(UGLIFY) $< > $@

matches.js:
	@bash support/browser.sh $(DIR) $(MODULES) > $@

clean:
	@rm -f matches.js matches.min.js

test:
	@$(MOCHA) --ui tdd

.PHONY: clean test
