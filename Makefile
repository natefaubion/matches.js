DIR = lib
MODULES = parser compiler runtime matcher matches
UGLIFY = $(shell find node_modules -name "uglifyjs" -type f)

all: matches.min.js

matches.js:
	@bash support/browser.sh $(DIR) $(MODULES) > $@

matches.min.js: matches.js
	@$(UGLIFY) -nmf $< > $@

clean:
	rm -f matches.js matches.min.js

.PHONY: clean
