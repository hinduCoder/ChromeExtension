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
	   		var url = "http://vk.com/" + localStorage.domain + "?w=wall" 
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
	   $(document).on('scroll', function() {
	   		var scrollPercentage = 100 * $(document).scrollTop() / ($(document).height() - 600);
	   		if (scrollPercentage > 99) { //TODO избавиться от повторных запросов, ибо запросы надо минимизировать, ну ты понял
	   			var wallController = angular.element($('body')).controller();
	   			wallController.getPosts(wallController.posts.length);
	   		}
	   })
	});


	chrome.browserAction.setBadgeText({text: ''});
	angular.module('VkModule', [])
	.factory('vk', ['$http', function($http) {
		var VkApiQuery = function (method, params, success)
		{
			var url = "https://api.vk.com/method/"+method +"?";
			if (typeof params == "string")
				url += params + "&";
			else {
				for (var p in params) {
					url += p + "=" + params[p] +"&";
				}
			}

            url += "access_token="+localStorage.token+"&callback=JSON_CALLBACK&v=5.27";
			console.log(url);
			$http.jsonp(url).success(function(res) {
				success(res);
			}).error(function(data, status, headers, config, statusText)
				{ 
					console.log(status+": "+statusText); 
				});
		};
		var executeProcedure = function(proc, params, success) {
			VkApiQuery("execute."+proc, params, success)
		};
		var getPosts = function(count, offset, success) {
			VkApiQuery('wall.get', { domain: localStorage.domain, offset: offset, count: count, extended: 1}, success);
		};
		var getComments = function(ownerId, postId, success) {
			executeProcedure('getComments', { owner_id: ownerId, post_id: postId, count: 50}, success);
		};
		var addComment = function(ownerId, postId, text, success) {
			VkApiQuery("wall.addComment", {owner_id:ownerId, post_id: postId, text: text}, success);
		};
		var addVote = function(ownerId, pollId, answerId, success) {
			VkApiQuery("polls.addVote", {owner_id: ownerId, poll_id: pollId, answer_id: answerId}, success)
		};
		var post = function(text, success) {
			executeProcedure("post", {domain: localStorage.domain, message: text}, success)
		}
		return {
			getPosts: getPosts,
			getComments: getComments,
			addComment: addComment,
			addVote: addVote,
			post: post,
			executeProcedure: executeProcedure
		};
	}]);

	angular.module('AppModule', ['ngSanitize', 'VkModule'])
	.controller('WallController', ['vk', function(vk) {
		this.newPostText = ""
		var wall = this;
		
		this.post = function() {
			vk.post(wall.newPostText, function () {
				vk.getPosts(1, 0, function(data) {
					var post = data.response.items[0];
					if (post.from_id > 0) {
						var profile = data.response.profiles[0];
						post.name = profile.first_name + ' ' + profile.last_name;
						post.photo_50 = profile.photo_50;
					} else {
						var group = data.response.groups[0];
						post.name = group.name;
						post.photo_50 = group.photo_50;
					}
					wall.posts.unshift(post);
                    localStorage.lastPost = Math.trunc(Date.now()/1000);
				});
			});
		};
		this.getPosts = function(_offset) {
			var offset = _offset || 0;

			vk.getPosts(10, offset, function(res) {
				if (wall.posts && wall.posts.length > offset)
					return;
				//console.log(offset);
				if (wall.posts)
					wall.posts = wall.posts.concat(res.response.items);
				else
					wall.posts = res.response.items;
	  			addInfo = function(post) {
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
	  			
	  			for (var i = offset; i < wall.posts.length; i++) {
	  				var post = wall.posts[i];
	  				addInfo(post);
	  				if (post.copy_history)
	  				for (var j = 0; j < post.copy_history.length; j++) {
	  					var repost = post.copy_history[j];
	  					addInfo(repost);
	  				};
	  			}
	  			var lastPost = res.response.count == 0 ? null : wall.posts[0].is_pinned ? wall.posts[1].date : wall.posts[0].date;
	  			if (lastPost)
		  			localStorage.lastPost = lastPost;
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

