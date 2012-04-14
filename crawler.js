// My 1st proj w/ backbone. Entirely prepared to rewrite _all of it_.
// If it were cleaner, I'd incline to call it a crawler boilerplate.
// Tinker tinker.   - Tommy

// do: localstorage chk, backbone cleanup!, ul.click !== cycle
// consider: throttled animation add, page.parents(page1,page2), draggable panes, regex link test
// fix: unselectable nav buttons
// hmmm: safe to use var crawler = this; even when not being called with new ()?

(function($){

	var root = this;
	
	root.Crawler = function(settings) {
	
		// cancel if inside a frame
		if (root.self !== root.top) { return false; };
		
		var crawler = this; // to return, useful for console

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
		crawler.settings = settings;

		var init = function(){
		
			var $body = $("body");
		
			var original = {
				title: root.document.title,
				background: $body.css("background")
			};
			crawler.original = original;

			$("link[rel='stylesheet']").not("#style").remove();
			$body.empty().append("<link href='" + settings.cssurl + "' rel='stylesheet' id='style' type='text/css'>");
			root.document.title = settings.title+' '+settings.separator+' '+original.title;
		
			var $output = $("<div />", {
				id: "output"
			}).appendTo($body);
			$('<input />', {
				type: "checkbox",
				id: "chkOutputFullscreen",
				checked: localStorage.chkOutputFullscreen
			}).insertBefore($output);
			var output = {}; crawler.output = output;
			
			function relativePath(sUrl) {
				var a = root.document.createElement('a');
				a.href = sUrl;
				return a.pathname
			}
			
			var PageView = Backbone.View.extend({
				tagName: "li",
				template: _.template('<a href="<%= url %>" id=""><%= urlshort %></a>'),
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
					if (this.model.get("crawled") && app.get("autoscroll")) {
						app.set("scrollTo", $(this.el).position().top);
					}
					return this;
				}
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
				progress: function() {
					return Math.round(this.crawled().length / this.length * 100);
				}
			});
			var pages = new PageList();
			crawler.pages = pages;
			
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
						if (root.location.hostname === $a[0].hostname) {
							if (sUrl.indexOf("#") > -1) { sUrl = sUrl.substr(0, sUrl.indexOf("#")); }
							if (sUrl.indexOf("?") > -1) { sUrl = sUrl.substr(0, sUrl.indexOf("?")); }
							links.push(sUrl);
						}
					});
					links = _.uniq(links);
					return links;
				},
			});
			var frame = new Frame();
			crawler.frame = frame;
			
			var App = Backbone.Model.extend({
				defaults: {
					pages: pages,
					running: false, busy: false,
					wait: settings.wait,
					deep: settings.deep,
					max: settings.max,
					limitreached: false,
					done: false,
					autoscroll: true,
					scrollTo: 0
				},
				initialize: function() {
					this.add(location.pathname, 0);
					settings.onInitialize(output, $output);
					this.start();
				},
				start: function() {
					this.set({ running: true });
					this.cycle();
				},
				stop: function() { this.set({ running: false }); },
				toggle: function() { this.set({ running: !this.get("running") }); this.cycle(); },
				cycle: function() {
	
					if (this.get("busy") || !this.get("running")) { return false; }
					var _app = this;
					var page = this.get("pages").getNext();
					if (!page) {
						this.done();
						return false;
					}
					_app.set("busy", true);

					this.trigger("cycle");
	
					var killBusy = setTimeout(function(){
						_app.set("busy", false);
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
							settings.onFrameload(output, $output, $doc, page);
						}
						
						var links = frame.getAllLinks();
						_.each(links, function(link){
							_app.add(link, page.get("deep") + 1);
						});
						setTimeout(function(){
							_app.cycle();
						}, _app.get("wait"));
						_app.set("busy", false);
						
					});
				},
				done: function() {
					this.stop();
					if (!this.get("done")) {
						settings.onDone(output, $output);
					}
					this.set("done", true);
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
					this.get("pages").add(page);
					return page;
				},
				reset: function(){
					// sometimes this runs _after_ new pages get added. hmph!
					this.stop();
					this.get("pages").reset();
					this.add(location.pathname, 0);
					$output.empty();
					settings.onInitialize(output, $output);
				}
			});
			var app = new App();
			crawler.app = app;

			var AppView = Backbone.View.extend({
				el: $("<ul />").prependTo("body"),
				initialize: function(){
					_.bindAll(this, 'addOne', 'render', 'reset', 'setScroll');
					pages.bind("add", this.addOne);
					pages.bind("reset", this.reset);
					var view = this;
					$(document).keyup(function(e){
						if (e.keyCode === 27) { view.model.toggle(); }
					});
					this.model.bind("change:scrollTo", this.setScroll);
				},
				reset: function(){
					$(this.el).empty();
				},
				addOne: function(page){
					var view = new PageView({model: page});
					$(this.el).append(view.render().el);
				},
				hoverOn: function() { this.model.set("autoscroll", false); },
				hoverOff: function() { this.model.set("autoscroll", true); },
				setScroll: function(){
					var iElementTop = this.model.get("scrollTo");
					$(this.el).stop().animate({
						scrollTop: $(this.el).scrollTop() + iElementTop - ($(this.el).height() / 2)
					}, 250);
				},
				events: {
					"mouseover": "hoverOn",
					"mouseout": "hoverOff"
				}
			});
			var appview = new AppView({model:app});
			crawler.appview = appview;
			
			var Header = Backbone.Model.extend({
				defaults: {
					apptitle: settings.title,
					pagetitle: original.title,
					progress: 0,
					toggleAction: "stop"
				},
				initialize: function(){
					_.bindAll(this, 'updateToggle', 'updateProgress');
					this.updateToggle();
					pages.bind("all", this.updateProgress);
					app.bind("change:running", this.updateToggle);
				},
				updateToggle: function(){
					this.set("toggleAction", app.get("running") ? "stop" : "start");
				},
				updateProgress: function(){
					var iProgress = pages.progress();
					this.set("progress", iProgress);
				}
			});
			
			var header = new Header();
			crawler.header = header;

			var HeaderView = Backbone.View.extend({
				el: $("<header id='header' />").prependTo("body"),
				template: _.template('<h1><a href="#" id="h1a"><%= apptitle %></a> <kbd>' + settings.separator + '</kbd> <%= pagetitle %></h1><nav><kbd id="toggle" class="<%= toggleAction %>"></kbd><kbd id="restart" class="restart"></kbd></nav><div id="progress"><b style="width:<%= progress %>%;"></b></div>'),
				initialize: function(){
					_.bindAll(this, 'stop', 'start', 'restart', 'render', 'updateProgress');
					this.model.bind('change:progress', this.updateProgress);
					this.model.bind("change:toggleAction", this.render);
					this.render();
				},
				events: {
					"click #h1a": "restart",
					"click .stop": "stop",
					"click .start": "start",
					"click .restart": "restart"
				},
				stop: function() {
					app.stop();
					return false;
				},
				start: function() {
					app.start()
					return false;
				},
				restart: function() {
					this.stop();
					app.reset();
					return false;
				},
				updateProgress: function() {
					var iProgress = this.model.get("progress");
					$("#progress").find("b").css("width", iProgress + "%");
				},
				render: function(){
					var sHtml = this.template(this.model.toJSON());
					$(this.el).html(sHtml)
					return this;
				},
			});
			var headerView = new HeaderView({model:header});
			
		}
	
		// loading dependencies from CDN. could be smarter.
		$.getScript("http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.3.1/underscore-min.js", function(){
			$.getScript("http://cdnjs.cloudflare.com/ajax/libs/backbone.js/0.9.2/backbone-min.js", init);
		});
	
	};

}(jQuery));