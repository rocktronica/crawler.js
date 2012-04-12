// My 1st proj w/ backbone. Entirely prepared to rewrite _all of it_.
// If it were cleaner, I'd incline to call it a crawler boilerplate.
// Tinker tinker.   - Tommy

// do: backbone cleanup!, ul.click !== cycle, nav listens to .running
// consider: page.parents(page1,page2), alternating iframes to avoid load flash, draggable panes

(function(exports, $){

	// this is admittedly awkward
	exports.Crawler = function(settings) {

		// cancel if inside a frame
		if (exports.self !== top) { return false; };
		
		var settings = settings || {}; settings = {
			title: settings.title || "crawler.js",
			wait: settings.wait || 1000,
			deep: settings.deep || 5,
			max: settings.max || 25,
			separator: settings.separator || "»",
			cssurl: settings.cssurl || "http://rocktronica.github.com/crawler.js/crawler.css",
			onInitialize: settings.onInitialize || function(output, $output) {
				var $table = $("<table />").html("<tr><td><strong>Page</strong></td><td><strong>Word&nbsp;Count</strong></td></tr>").appendTo($output);
				output.$table = $table;
				output.totalwordcount = 0;
				return output;
			},
			onFrameload: settings.onFrameload || function(output, $output, $doc, page) {
				var sTitle = $doc.find("title").html().trim();
				var iWordCount = $doc.text().trim().split(/\s+/).length;
				output.totalwordcount += iWordCount;
				output.$table.append("<tr><td>" + sTitle + "<br /><small>" + page.get("urlshort") + "</small></td><td>" + iWordCount + "<td></tr>");
				$output.scrollTop($output.contents().height());
				return output;
			},
			onDone: settings.onDone || function(output, $output) {
				console.warn("All done.");
				output.$table.append("<tr><td><strong>Total</strong></td><td><em>" + output.totalwordcount + "</em><td></tr>");
			},
			onLimit: settings.onLimit || function(output, $output) {
				console.warn("Limit reached.");
			}
		};

		var init = function(){
		
			var $body = $("body");
		
			var original = {
				title: exports.document.title,
				background: $body.css("background")
			}
			
			$("link[rel='stylesheet']").not("#style").remove();
			$body.empty().append("<link href='" + settings.cssurl + "' rel='stylesheet' id='style' type='text/css'>");
		
			var $output = $("<div />", {
				id: "output"
			}).appendTo($body).before('<input type="checkbox" id="chkOutputFullscreen" />');
			
			function relativePath(sUrl) {
				var a = exports.document.createElement('a');
				a.href = sUrl;
				return a.pathname
			}
			
			var PageView = Backbone.View.extend({
				tagName: "li",
				template: _.template('<a href="<%= url %>"><%= url %></a>'),
				events: {
					"click": "load"
				},
				initialize: function(){
					_.bindAll(this, 'render');
					this.model.bind('change', this.render);
				},
				load: function(){
					frame.load(this.model);
					return false;
				},
				render: function() {
					var sHtml = this.template(this.model.toJSON());
					$(this.el)
						.html(sHtml)
						.toggleClass("crawled", this.model.get("crawled"))
						.toggleClass("duplicate", this.model.get("duplicate"))
						.toggleClass("invalid", this.model.get("invalid"));
					if (this.model.get("crawled") && crawler.get("autoscroll")) {
						$(crawler.view.el).stop().animate({
							scrollTop: $(crawler.view.el).scrollTop() + $(this.el).position().top - ($(crawler.view.el).height() / 2)
						}, Math.min(settings.wait, 250));
					}
					return this;
				}
			});
			
			var Frame = Backbone.View.extend({
				tagName: "iframe", id: "iframe",
				initialize: function() {
					// background css hack minimizes load flicker
					$('<div id="iframewrapper" />').css({ background: original.background }).append(this.el).appendTo($body);
				},
				// callback fires with jQ'd document payload
				load: function(page, callback) {
					var _frame = this;
					if (typeof callback !== "function") { var callback = function(){}; }
					$(this.el).attr("src", page.get("url")).on("load", function() {
						var $doc = $(_frame.el).contents();
						var _callback = function() {
							callback($doc);
						};
						$doc.ready(_callback);
						page.set("crawled", true);
						$(_frame.el).off("load");
					});
				},
				getAllLinks: function(){
					var $links = $(this.el).contents().find("a"), links = [];
					$links.each(function(){
						var $a = $(this);
						var sUrl = $a[0].pathname;
						if (exports.location.hostname === $a[0].hostname) {
							if (sUrl.indexOf("#") > -1) { sUrl = sUrl.substr(0, sUrl.indexOf("#")); }
							if (sUrl.indexOf("?") > -1) { sUrl = sUrl.substr(0, sUrl.indexOf("?")); }
							links.push(sUrl);
						}
					});
					links = _.uniq(links);
					return links;
				},
			});
			
			var Page = Backbone.Model.extend({
				defaults: {
					url: "",
					urlshort: "",
					crawled: false,
					deep: 0,
					invalid: false,
					duplicate: false
				},
				initialize: function() {
					this.set("urlshort", relativePath(this.get("url")));
				}
			});
			
			var PageList = Backbone.Collection.extend({
				model: Page,
				has: function(sUrl) {
					var sUrl = sUrl.toLowerCase();
					// this should use include(), something like...
					// return this.include(sUrl);
					return (function(that){
						var b = false;
						that.each(function(page){
							if (page.get("url") === sUrl) { b = true; }
						});
						return b;
					}(this));
				},
				getNext: function() {
					return this.find(function(page){
						return !page.get("crawled");
					});
				},
				crawled: function() {
					return this.filter(function(page){ return page.get('crawled'); });
				},
				uncrawled: function() {
					return this.without.apply(this, this.crawled());
				},
			});
			
			var CrawlerView = Backbone.View.extend({
				el: $("<ul id='crawler' />").prependTo("body"),
				initialize: function(){
					var view = this;
					$(document).keyup(function(e){
						if (e.keyCode === 27) { view.model.toggle(); }
					});
				},
				hoverOn: function() { this.model.set("autoscroll", false); },
				hoverOff: function() { this.model.set("autoscroll", true); },
				events: {
					"mouseover": "hoverOn",
					"mouseout": "hoverOff"
				}
			});
			
			var Crawler = Backbone.Model.extend({
				view: undefined,  // i feel bad about this...
				defaults: {
					pages: new PageList(),
					running: false, busy: false,
					wait: settings.wait,
					deep: settings.deep,
					max: settings.max,
					limitreached: false,
					done: false,
					autoscroll: true
				},
				initialize: function() {
					exports.document.title =  settings.title + " " + settings.separator + " " + original.title;
					this.view = new CrawlerView({model:this});
					this.add(location.pathname, 0);
					output = settings.onInitialize(output, $output);
					this.start();
				},
				start: function() {
					this.set({ running: true });
					this.cycle();
				},
				stop: function() { this.set({ running: false }); },
				toggle: function() { this.set({ running: !this.get("running") }); this.cycle(); },
				cycle: function() {
	
					// wtf?
					header && header.set("progress", Math.round(this.get("pages").crawled().length / this.get("pages").length * 100));
	
					if (this.get("busy") || !this.get("running")) { return false; }
					var _crawler = this;
					var page = this.get("pages").getNext();
					if (!page) {
						this.done();
						return false;
					}
					_crawler.set("busy", true);
	
					var killBusy = setTimeout(function(){
						_crawler.set("busy", false);
					}, 2000);
					frame.load(page, function($doc){
		
						clearTimeout(killBusy);
		
						if (!!$doc.find("head").find("link[rel='canonical']").size()) {
							var sCanonical = relativePath($doc.find("head").find("link[rel='canonical']").attr("href").trim().toLowerCase());
							if (sCanonical !== page.get("url")) {
								page.set("invalid", true).set("duplicate", true);
							}
						} else if (!$doc.find("body").size() || !$doc.find("title").size()) {
							page.set("invalid", true);
						}
		
						if (!page.get("invalid")) {
							output = settings.onFrameload(output, $output, $doc, page);
						}
						
						var links = frame.getAllLinks();
						_.each(links, function(link){
							_crawler.add(link, page.get("deep") + 1);
						});
						setTimeout(function(){
							_crawler.cycle();
						}, _crawler.get("wait"));
						_crawler.set("busy", false);
						
					});
				},
				done: function() {
					this.stop();
					if (!this.get("done")) {
						settings.onDone(output, $output);
					}
					this.set("done", true);
					// need to tell headerview too
				},
				add: function(sUrl, iDeep) {
					if (!sUrl || this.get("pages").has(sUrl)) { return false; }
					if (this.get("pages").length > this.get("max") || iDeep > this.get("deep")) {
						if (!this.get("limitreached")) {
							settings.onLimit(output, $output);
							this.set("limitreached", true);
						}
						return false;
					}
					var page = new Page({
						url: sUrl,
						deep: iDeep || 0
					});
					var view = new PageView({ model: page });
					$(this.view.el).append(view.render().el);
					this.get("pages").add(page);
					return page;
				},
				reset: function(){
					this.get("pages").reset();
					$(this.view.el).empty();
					this.add(location.pathname, 0);
					$output.empty();
					output = settings.onInitialize(output, $output);
				}
			});
			
			var frame = new Frame(); //{ model: page }
			
			var crawler = new Crawler();
			exports.crawler = crawler;
	
			var HeaderView = Backbone.View.extend({
				el: $("<header id='header' />").prependTo("body"),
				template: _.template('<h1><a href="#" id="h1a"><%= apptitle %></a> <kbd>' + settings.separator + '</kbd> <%= pagetitle %></h1><nav><kbd id="toggle" class="stop"></kbd><kbd id="restart" class="restart"></kbd></nav><div id="progress"><b></b></div>'),
				initialize: function(){
	//				_.bindAll(this, 'render');
	//				this.model.bind('change', this.render);
					this.model.bind("change", this.updateProgress);
					this.render();
				},
				events: {
					"click #h1a": "restart",
					"click .stop": "stop",
					"click .start": "start",
					"click .restart": "restart"
				},
				// these should listen to crawler's .running...
				stop: function() {
					$(this.el).find("#toggle").attr("class", "start");
					crawler.stop();
					return false;
				},
				start: function() {
					$(this.el).find("#toggle").attr("class", "stop");
					crawler.start()
					return false;
				},
				restart: function() {
					this.stop();
					crawler.reset();
					return false;
				},
				updateProgress: function() {
					$("#progress").find("b").css("width", this.get("progress") + "%");
				},
				render: function(){
					var sHtml = this.template(this.model.toJSON());
					$(this.el).html(sHtml)
					return this;
				},
			});
			
			var Header = Backbone.Model.extend({
				defaults: {
					apptitle: settings.title,
					pagetitle: "Undefined",
					progress: 0
				}
			});
			
			var header = new Header({
				pagetitle: original.title,
				total: crawler.get("pages").length
			});
			
			var headerView = new HeaderView({ model: header });
			
		}
	
		// loading dependencies from CDN. convince me otherwise.
		$.getScript("http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.3.1/underscore-min.js", function(){
			$.getScript("http://cdnjs.cloudflare.com/ajax/libs/backbone.js/0.9.2/backbone-min.js", init);
		});
	
	};

}(this, jQuery));