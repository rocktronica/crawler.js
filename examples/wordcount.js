var crawler = new Crawler({
	onInitialize: function($output) {
		var $table = $("<table />").html("<tr><td><strong>Page</strong></td><td><strong>Word&nbsp;Count</strong></td></tr>").appendTo($output);
		output.$table = $table;
		output.totalwordcount = 0;
	},
	onFrameload: function($output, $doc, page) {
		var sTitle = $doc.find("title").html().trim();
		var iWordCount = $doc.text().trim().split(/\s+/).length;
		output.totalwordcount += iWordCount;
		output.$table.append("<tr><td>" + sTitle + "<br /><small>" + page.get("urlshort") + "</small></td><td>" + iWordCount + "<td></tr>");
		$output.scrollTop($output.contents().height());
	},
	onDone: function($output) {
		output.$table.append("<tr><td><strong>Total</strong></td><td><em>" + output.totalwordcount + "</em><td></tr>");
	}
});