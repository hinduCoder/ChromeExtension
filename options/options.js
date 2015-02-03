
$(document).ready(function() {
	var update = function(text) {
		if (text)
			$("#saved-domain").text(text);
		else
			chrome.storage.sync.get("domain", function(items) {
				$("#saved-domain").text(items.domain);
			});
	};
	update();
	$("#domain").on('change', function() {
		chrome.storage.sync.set({
			domain: $(this).val()
		});
		update($(this).val());
	});
});