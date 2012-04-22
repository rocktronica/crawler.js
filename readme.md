# crawler.js

An in-browser webcrawler written in JavaScript.

Work in progress! Constructive criticism appreciated.

## Instantiation and Arguments

Make a new crawler and pass settings as arguments:

	var crawler = new Crawler({
		wait: 5000,
		max: 20,
		deep: 2,
		onInitialize: function(output, $output) {
			$output.css("white-space", "pre").append("<strong>onInitialize</strong> \n");
		},
		onFrameload: function(output, $output, $doc, page) {
			$output.append("  <strong>onFrameLoad</strong> " + page.get("url") + "\n");
		},
		onDone: function(output, $output) {
			$output.append("<strong>onDone</strong> \n");
		},
		onLimit: function(output, $output) {
			$output.append("<strong>onLimit</strong> \n");
		}
	});

Settings and their defaults:

	title ["crawler.js"]
	wait [1000,
	deep [5,
	max [25,
	match: [location.pathname.substr(0,location.pathname.lastIndexOf("/")]
	separator ["»"],
	cssurl ["http://rocktronica.github.com/crawler.js/crawler.css"]
	pluginsurl ["http://rocktronica.github.com/crawler.js/plugins.js"]
	onInitialize [function(output,$output){}]
	onFrameload [function(output,$output,$doc,page){}]
	onDone [function(output,$output){}]
	onLimit [function(output,$output){}]

All of that subject to change as I get smarter...

## Known Caveats

- Site cannot disallow iFrames<br />
    "Refused to display document because display forbidden by X-Frame-Options."

## Attribution

Backbone, Underscore, jQuery, jQuery UI

## License

MIT/GPL or as components require.