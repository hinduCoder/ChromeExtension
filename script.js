(function() {
	chrome.runtime.onMessage.addListener(function(message){
		angular.element($('body')).scope().ctrl.getPosts(message);
	});

	$(document).ready(function(){
	   $('body').on('click', 'a', function(e){
	     chrome.tabs.create({url: $(this).attr('href')});
	     e.stopPropagation();
	     return false;
	   });
	   $("body").on('click', '.post', function() {
	   		var post = angular.element($(this)).scope().post;
	   		var url = "http://vk.com/" + (post.owner_id < 0 ? 'club' : 'id') + Math.abs(post.owner_id).toString() + "?w=wall" 
	   		+ post.owner_id.toString() + "_" + post.id.toString();
	   		chrome.tabs.create({url: url});
	   });
	   $('body').on('click', '.showComments', function(e) {
	   		e.stopPropagation();
	   		$(this).toggleClass('opened');
	   });
	   $('body').on('click', '.form', function(e) {
	   		e.stopPropagation();
	   });
	   $('body').on('click', 'input', function(e) {
	   		e.stopPropagation();
	   });
	});

	chrome.browserAction.setBadgeText({text: ''});
	angular.module('VkModule', [])
	.factory('vk', ['$http', function($http) {
		var VkApiQuery = function (method, params, token, success)
		{
			var url = "https://api.vk.com/method/"+method +"?";
			if (typeof params == "string")
				url += params + "&";
			else {
				for (var p in params) {
					url += p + "=" + params[p] +"&";
				}
			}
			if (token)
				url += "access_token="+token+"&";
			url += "callback=JSON_CALLBACK&v=5.27";
			console.log(url);
			$http.jsonp(url).success(function(res) {
				success(res);
			}).error(function(data, status, headers, config, statusText)
				{ 
					console.log(status+": "+statusText); 
				});
		};
		var executeProcedure = function(proc, params, success) {
			VkApiQuery("execute."+proc, params, localStorage.token, success)
		};
		var getPosts = function(count, success) {
			VkApiQuery('wall.get', { domain: localStorage.domain, count: count, extended: 1} , localStorage.token, success);
		};
		var getComments = function(ownerId, postId, success) {
			executeProcedure('getComments', { owner_id: ownerId, post_id: postId, count: 50}, success);
		};
		var addComment = function(ownerId, postId, text, success) {
			VkApiQuery("wall.addComment", {owner_id:ownerId, post_id: postId, text: text}, localStorage.token, success);
		};
		var addVote = function(ownerId, pollId, answerId, success) {
			VkApiQuery("polls.addVote", {owner_id: ownerId, poll_id: pollId, answer_id: answerId}, localStorage.token, success)
		};
		return {
			getPosts: getPosts,
			getComments: getComments,
			addComment: addComment,
			addVote: addVote,
			executeProcedure: executeProcedure
		};
	}]);

	angular.module('AppModule', ['ngSanitize', 'VkModule'])
	.controller('WallController', ['vk', function(vk) {
		var wall = this;
		this.getPosts = function() {
			vk.getPosts(10, function(res) {
	  			wall.posts = res.response.items;
	  			var addInfo = function(post) {
					if (post.from_id > 0) {
	  					var profile = res.response.profiles.filter(function(i) { return i.id == post.from_id; })[0];
	  					post.name = profile.first_name + ' ' + profile.last_name;
	  					post.photo_50 = profile.photo_50;
	  				} else {
	  					var group = res.response.groups.filter(function(i) { return i.id == -post.from_id; })[0];
	  					post.name = group.name;
	  					post.photo_50 = group.photo_50;
	  				}
	  			};
	  			for (var i = 0; i < wall.posts.length; i++) {
	  				var post = wall.posts[i];
	  				addInfo(post);
	  				if (post.copy_history)
	  				for (var j = 0; j < post.copy_history.length; j++) {
	  					var repost = post.copy_history[j];
	  					addInfo(repost);
	  				};
	  			}
	  			var lastPost = res.response.count == 0 ? null : wall.posts[0].isPinned == 1 ? wall.posts[1].date : wall.posts[0].date;
	  			if (lastPost)
		  			localStorage.lastPost = lastPost;
		  		else
		  			console.log("foreground: ", lastPost)
	  		});
		};
	}])
	.controller('CommentsController', ['vk', function(vk) {
		this.newCommentText = "";
		var controller = this;
		this.getComments = function(post) {
			vk.getComments(post.owner_id, post.id, function(res) {
				controller.comments = res.response;
				console.log(res);
				if (res.response == null)
					setInterval(function() {
						controller.comments = res.response;
					},100);	
			});
		};
		this.postComment = function(post) {
			vk.addComment(post.owner_id, post.id, controller.newCommentText, function(res) {
				controller.getComments(post);
				controller.newCommentText = "";
			});
		};
	}])
	.controller('PollController', ['vk', function(vk) {
		var thePoll = this;
		this.init = function(poll) {
			if (poll) //он достал
			poll.answers.forEach(function(a) {
				a.selected = false;
			});
			thePoll.poll = poll;
		};
		this.vote = function(answerId) {
			vk.addVote(thePoll.poll.owner_id, thePoll.poll.id, answerId, function() {
				alert('OK');//temp
			});
		};
	}])
	.directive('item', function() {
		return {
			restrict: 'E',
			templateUrl: 'item.html',
		};
	})
	.filter('mentionable', function() {
		return function(s) {
			var regex = /\[id\d+\|[\W\w\d\s]+\]/igm;
			if (!regex.test(s)) return s;
			return s.replace(regex, function(match) {
				var subs = match.slice(1, match.length-1).split('|');
				var result = '<a href="http://vk.com/' + subs[0] + '">'+  subs[1] +'</a>';
				return result;
			});
		}
	});
}) ();

