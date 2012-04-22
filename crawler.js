// My 1st proj w/ backbone. Entirely prepared to rewrite _all of it_.
// Tinker tinker.   - Tommy

// do: save draggable to localstorage, smarter windowResize, followCanonical, allowParams, allowHash
// consider: page.parents(page1,page2), trycatch on frameload
// hmmm: safe to use var crawler = this; even when not being called with new ()?

(function($){

	var root = this;
	root.localStorage = root.localStorage || {};
	
	root.Crawler = function(settings) {
	
		// cancel if inside a frame
		if (root.self !== root.top) { return false; };
		
		var crawler = this; // to return, useful for console

		var settings = settings || {}; settings = {
			title: settings.title || "crawler.js",
			wait: settings.wait || 1000,
			deep: settings.deep || 5,
			max: settings.max || 25,
			match: settings.match || location.pathname.substr(0,location.pathname.lastIndexOf("/")),
			separator: settings.separator || "»",
			cssurl: settings.cssurl || "http://rocktronica.github.com/crawler.js/crawler.css",
			pluginsurl: settings.pluginsurl || "http://rocktronica.github.com/crawler.js/plugins.js",
			onInitialize: settings.onInitialize || function($output) { },
			onFrameload: settings.onFrameload || function($output, $doc, page) { },
			onDone: settings.onDone || function($output) { },
			onLimit: settings.onLimit || function($output) { }
		};
		crawler.settings = settings;

		var init = function(){
		
			var $body = $("body");
		
			var original = {
				title: root.document.title,
				background: $body.css("background")
			};
			crawler.original = original;

			$("style, link[rel='stylesheet']").not("#style").remove();
			$body.empty().append("<link href='" + settings.cssurl + "' rel='stylesheet' id='style' type='text/css'>");
			root.document.title = settings.title+' '+settings.separator+' '+original.title;
		
			var $output = $("<div />", {
				id: "output"
			}).appendTo($body);
			$('<input />', {
				type: "checkbox",
				id: "chkOutputFullscreen",
				checked: !!localStorage.chkOutputFullscreen
			}).insertBefore($output).on("change", function(){
				localStorage.chkOutputFullscreen = !!$(this).attr("checked") ? "checked" : "";
				$body.toggleClass("nodrag", !!localStorage.chkOutputFullscreen);
			});
			// var output = {}; crawler.output = output;
			
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
					if (!app || !app.get("done")) {
						alert("Wait until everything's done!");
					} else {
						frame.load(this.model);
					}
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
							if (sUrl.match(settings.match)) {
								links.push(sUrl);
							}
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
					settings.onInitialize($output);
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
							settings.onFrameload($output, $doc, page);
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
						settings.onDone($output);
					}
					this.set("done", true);
				},
				add: function(sUrl, iDeep) {
					if (!sUrl || this.get("pages").has(sUrl)) { return false; }
					if (this.get("pages").length > this.get("max") || iDeep > this.get("deep")) {
						if (!this.get("limitreached")) {
							settings.onLimit($output);
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
					settings.onInitialize($output);
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
					var pageview = new PageView({model: page});
					var $el = $(this.el);
					$el.append(pageview.render().el);
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
			
			// do jqUI stuff after CSS is loaded and elements ready
			var waitForCss = setInterval(function(){
				
				var bReady = !!parseInt($("#progress").css("top"),10) && !!$("ul").find("li").size();
				if (!bReady) { return false; }
				
				var $ul = $(appview.el), $framewrapper = $("#iframewrapper"), 
					iHeaderHeight = $(headerView.el).height(), iHandleSize = 20,
					throttle = {}, debounce = {};

				var $dragUl = $("<div />", {
					"class": "draggable",
					id: "dragUl"
				});
				var dragUlEvent = function() {
					$body.addClass("notransitions");
					throttle.dragUl = throttle.dragUl || setTimeout(function(){
						var pUlWidth = Math.ceil(($dragUl.position().left + (iHandleSize/2)) / $body.width() * 100);
						$ul.css("width", pUlWidth + "%");
						$framewrapper.css("left", pUlWidth + "%");
						$output.css("left", pUlWidth + "%");
						throttle.dragUl = undefined;
					}, 100);
					clearTimeout(debounce.notransitions);
					debounce.notransitions = setTimeout(function(){
						$body.removeClass("notransitions");
					}, 200);
				};
				$dragUl.appendTo($body).draggable({
					axis: "x",
					containment: [iHeaderHeight, 0, $body.width() - iHeaderHeight, 0],
					create: function(event, ui){
						$dragUl.css({
							left: $("ul").width() - (iHandleSize/2)
						});
					},
					drag: dragUlEvent
				});

				var $dragOutput = $("<div />", {
					"class": "draggable",
					id: "dragOutput"
				});
				var dragOutputEvent = function() {
					$body.addClass("notransitions");
					throttle.dragOutput = throttle.dragOutput || setTimeout(function(){
						var pOutputTop = Math.ceil(($dragOutput.position().top + (iHandleSize/2)) / $body.height() * 100);
						$output.css("top", pOutputTop + "%");
						var pFramewrapperBottom = Math.ceil(($output.height() + iHeaderHeight - (iHandleSize/2)) / $body.height() * 100);
						$framewrapper.css("bottom", pFramewrapperBottom + "%");
						throttle.dragOutput = undefined;
					}, 100);
					clearTimeout(debounce.notransitions);
					debounce.notransitions = setTimeout(function(){
						$body.removeClass("notransitions");
					}, 200);
				};
				$dragOutput.appendTo($body).draggable({
					axis: "y",
					containment: [0, iHeaderHeight, 0, $body.height() - iHeaderHeight],
					create: function(){
						$dragOutput.css({
							top: $output.position().top -(iHandleSize/2)
						})
					},
					drag: dragOutputEvent
				});

				// this should use % instead of px...
				$(window).on("resize", function(){
					clearTimeout(debounce.windowResize);
					debounce.windowResize = setTimeout(function(){
						dragUlEvent();
						dragOutputEvent();
					}, 50);
				});

				// covers iframe for better dragging
				var $dragCover = $("<div />", {
					id: "dragCover"
				}).appendTo($body);
				
				clearInterval(waitForCss);
				
			}, 1);
			
		}; // init

		function getScriptsAndInit(){ $.getScript(settings.pluginsurl, init); }

		if (!$ || !$.fn || !$.fn.jquery < "1.7") {
			(function(url,success){
				var head = document.getElementsByTagName("head")[0], done = false;
				var script = document.createElement("script");
				script.src = url;
				script.onload = script.onreadystatechange = function(){
					if ( !done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete") ) {
						done = true;
						$ = jQuery.noConflict();
						success();
					}
				};
				head.appendChild(script);
			}('http://ajax.googleapis.com/ajax/libs/jquery/1.7/jquery.min.js', getScriptsAndInit));
		} else { getScriptsAndInit(); }

	};

}(jQuery));