var output = { pages: {} };
var crawler = new Crawler({
	onInitialize: function($output) {
		$("<div id='d' />").appendTo($output);
		$("<style>#d img{ margin: 10px; }</style>").appendTo($output);
	},
	onFrameload: function($output, $doc, page) {
		var sTitle = $doc.find("title").text();
		if (sTitle.indexOf("«") > -1) { sTitle = sTitle.substr(0, sTitle.indexOf("«")).trim(); }
		var $images = $doc.find("body").find("img").removeAttr("id").removeAttr("class").removeAttr("align").removeAttr("style");
		output.pages[sTitle] = output.pages[sTitle] || {
			url: page.get("url"),
			images: []
		};
		$images.each(function(){
			output.pages[sTitle].images.push($(this).attr("src"));
		});
		$output.find("#d").append($images).end().scrollTop($output.contents().height());
	}
});