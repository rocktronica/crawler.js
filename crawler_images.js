var Settings = {
	onInitialize: function(output, $output) {
		output = {
			pages: {}
		};
		$("<pre id='pre' />").appendTo($output);
		return output; // for the life of me, can't trace why output won't persists when other vars do... hmph!
	},
	onFrameload: function(output, $output, $doc, page) {
		var sTitle = $doc.find("title").text();
		if (sTitle.indexOf("«") > -1) { sTitle = sTitle.substr(0, sTitle.indexOf("«")).trim(); }
		var $images = $doc.find("#main").find("img").removeAttr("id").removeAttr("class").removeAttr("align").removeAttr("style");
		output.pages[sTitle] = output.pages[sTitle] || {
			url: page.get("url"),
			images: []
		};
		$images.each(function(){
			output.pages[sTitle].images.push($(this).attr("src"));
		});
		$output.append($images).scrollTop($output.contents().height());
		return output;
	},
	onDone: function(output, $output) {
		console.warn("All done.");
	},
	onLimit: function(output, $output) {
		console.warn("Limit reached.");
	}
};