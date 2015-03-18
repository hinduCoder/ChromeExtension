var notificationLinks = [];
function decreaseBadge() {
	chrome.browserAction.getBadgeText({}, function(result) {
		var count = parseInt(result);
		count--;
		chrome.browserAction.setBadgeText({text: count == 0 ? '' : count.toString()});
	});
}
chrome.notifications.onClicked.addListener(function (notificationId) {
	var entry = notificationLinks.filter(function(e) { return e.id == notificationId })[0];
	if (entry == null) return;
	chrome.tabs.create({url: entry.link});
	var index = notificationLinks.indexOf(entry);
	if (index > -1)
		notificationLinks.splice(index, 1);
	decreaseBadge();
});
chrome.notifications.onClosed.addListener(function (id) {
	var entry = notificationLinks.filter(function(e) { return e.id == notificationId })[0];
	var index = notificationLinks.indexOf(entry);
	if (index > -1)
		notificationLinks.splice(index, 1);
});
function update() {
	if (localStorage.token == null) return;
	$.ajax("https://api.vk.com/method/execute.getNewPosts?v=5.28&callback=JSON_CALLBACK&domain=" + localStorage.domain + "&last_time=" + localStorage.lastPost + "&access_token="+localStorage.token,
	
		{
			dataType: "jsonp",
			success: function(data) {
				var posts = data.response;
				if (posts.length == 0) return;
				chrome.browserAction.setBadgeText({text: posts.length.toString()});
				for (var i in posts) {
					chrome.notifications.create("", 
					{
						type: "basic", 
						iconUrl: posts[i].photo_100, 
						title: posts[i].name, 
						message: posts[i].text
					}, function(id){
						notificationLinks.push({ id: id, link: "http://vk.com/" + (posts[i].owner_id < 0 ? 'club' : 'id') + Math.abs(posts[i].owner_id).toString() + "?w=wall" 
	   		+ posts[i].owner_id.toString() + "_" + posts[i].id.toString()});
					});
				}
				if (posts[0].date)
					localStorage.lastPost = posts[0].date;
				else
					console.log("background: ", posts[0])
			},
			error: function(er) {
				console.log(er);
			}
		});
}
function getUrlParameterValue(url, parameterName) {
    "use strict";

    var urlParameters  = url.substr(url.indexOf("#") + 1),
        parameterValue = "",
        index,
        temp;

    urlParameters = urlParameters.split("&");

    for (index = 0; index < urlParameters.length; index += 1) {
        temp = urlParameters[index].split("=");

        if (temp[0] === parameterName) {
            return temp[1];
        }
    }

    return parameterValue;
}
chrome.runtime.onInstalled.addListener(function () {
	if (localStorage.token == null) {
		var url = "https://oauth.vk.com/authorize?client_id=4537037&scope=groups,wall,offline&redirect_uri=https://oauth.vk.com/blank.html&display=page&v=5.27&response_type=token";
		chrome.tabs.create({url: url}, function(tab){
			var updateListener = function (tabId, change) {
				if (tab.id === tabId) {
					localStorage.token = getUrlParameterValue(change.url, "access_token"); //TODO after first time do not save
					if (localStorage.token != null && localStorage.token.length > 0)
					chrome.tabs.onUpdated.removeListener(updateListener);
				}
			}
			chrome.tabs.onUpdated.addListener(updateListener);
		});
	}
	if (localStorage.domain == null) localStorage.domain = 'itd72';
	localStorage.lastPost = Math.trunc(Date.now()/1000);
});
chrome.alarms.onAlarm.addListener(function(alarm) {
	update();
});
chrome.alarms.create("alarm1", {periodInMinutes: 15});
chrome.storage.onChanged.addListener(function(changes) {
	localStorage.domain = changes.domain.newValue;
	localStorage.lastPost = Math.trunc(Date.now()/1000);
});