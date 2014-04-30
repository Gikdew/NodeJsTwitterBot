//Modules
var Twit = require('twit');
var config = require('./config');
var colors = require('colors');
var fs = require('fs');

var T = new Twit(config);

var startTime = new Date() getTime();
var now = new Date();

//VARIABLES
var followers = [];
var following = [];
var followQueue = [];
var unfollowQueue = [];
var tweetQueue = [];

//Milliseconds
var tweetEvery = 1000 * 60 * 60;
var followEvery = 1000 * 87.2; //990 per day 87.2
var unfollowEvery = 1000 * 300; //390 per day 221.6
var statsEvery = 1000 * 85.3;
var retweetEvery = 1000 * 60 * 60 * 3;
var tweetEvery = 1000 * 60;

//USERS
//Your user Name
var mainUser = 'Gikdew';
//The user you are going to scrape users from
var secondUser = 'photonstorm';

//Counter
var followCounter = 0;
var unfollowCounter = 0;

//INTERVALS
var followInterval;
var unfollowInterval;
var statInterval;
var retweetInterval;
var tweetInterval;

//RETWEET SEARCH
var qs = ["#ludumdare", "gamedev", "indie game", "html5 game"];
var mediaArtsSearch = {
    q: qs[Math.floor(Math.random() * qs.length)],
    count: 10,
    result_type: "recent",
    lang: 'en',
    include_entities: 'false'
};

//STARTING
getFollowers(secondUser);

//SCRAPING
//GET IDS OF THE NEW USERS I WILL BE FOLLOWING
function getFollowers(user) {
    logConsole(" GetFollowers".cyan);
    T.get('followers/ids', {
        screen_name: user
    }, function(err, reply) {
        if (!err) {
            followers = reply.ids;
            logConsole((" Added " + followers.length + " to follow - " + user));
            getFollowing(mainUser);
        } else {
            handleError('getFollowers', err);
        }
    })
}

//GET IDS OF THE USERS I'M FOLLOWING
function getFollowing(user) {
    logConsole(" GetFollowing".cyan);
    T.get('friends/ids', {
        screen_name: user
    }, function(err, reply) {
        if (!err) {
            following = reply.ids;
            logConsole((" Added " + following.length + " followed - " + user));
            followqueue = removeDuplicates(followers, following);
            followqueue = removeDuplicates(followers, readFileIds());

            //START ALL THE INTERVALS
            unfollowQueue = following;
            startFollowing(followqueue);
            startUnfollowing(unfollowQueue);
            startStats();
            startTweeting();
            startRetweet();

        } else {
            handleError('getFollowing', err);
        }
    })
}

//REMOVE DUPLICATES FROM TWO ARRAYS
function removeDuplicates(array1, array2) {
    logConsole(" RemoveDuplicates".cyan);
    for (var i = 0; i < array2.length; i++) {
        var arrlen = array1.length;
        for (var j = 0; j < arrlen; j++) {
            if (array2[i] == array1[j]) {
                array1.splice(j, 1);
            } //if close
        } //for close
    } //for close    
    logConsole(" The final list has " + array1.length + " ids");
    return array1;
    /**/
}

function readFileIds() {
    var str = fs.readFileSync('logId.txt').toString();
    return str.split('\r\n');
}

function followUser(id) {
    logConsole(" FollowUser".cyan);
    if (followCounter > 990) {
        handleError("followUser limit: ", followCounter)
    } else {
        followqueue.splice(followqueue.indexOf(id), 1);
        T.post('friendships/create', {
            user_id: id
        }, function(err, data) {
            if (!err) {
                followCounter++;
                logConsole(" Success!".green);
                logConsole((" User: " + id + " has been followed").green);
                fileLogger('logId.txt', id);
            } else {
                handleError('FollowUser', err);
            }
        });
    }
}

function startFollowing(queue) {
    logConsole(" StartFollowing".cyan);
    followInterval = setInterval(function() {
        if ((following.length + followCounter) < 1990) {
            followUser(queue[0]);
        } else {
            handleError("startFollowing", "+2000 limit! " + (following.length + followCounter))
        }

    }, followEvery);
}

//Reset variables every day
function resetVariables() {
    now = new Date();
    now = now.getTime();
    if ((now - startTime) > (1000 * 60 * 60 * 24)) {
        unfollowCounter = 0;
        followCounter = 0;
        logConsole(" Resetting Variables --> New Day!".green);
    } else {
        //logConsole(" No New Day!".red);
    }
}

//UNFOLLOW MODULE
function startUnfollowing(queue) {
    logConsole(" StartUnfollowing".cyan);
    unfollowInterval = setInterval(function() {
        resetVariables();
        unfollowUser(queue[queue.length - 1]);
    }, unfollowEvery);
}

function unfollowUser(id) {
    logConsole(" UnfollowUser".cyan);
    unfollowCounter++;
    if (unfollowCounter > 380) {
        handleError("unfollowUser limit: ", unfollowCounter)
    } else {
        T.post('friendships/destroy', {
            user_id: id
        }, function(err, data) {
            unfollowQueue.splice(unfollowQueue.length - 1, 1);
            if (!err) {
                logConsole(" Success!".green);
                logConsole((" User: " + id + " has been unfollowed").green);
            } else {
                handleError("unfollowUser", err)
            }
        })
    }
}

//STATS MODULE
function getUserData(user) {
    logConsole(" Stats".cyan);
    T.get('users/lookup', {
        screen_name: user
    }, function(err, reply) {
        if (!err) {
            var writting = " - " + user + " - " + reply[0].friends_count + " " + reply[0].followers_count;
            logConsole((" " + user + " - " + reply[0].friends_count + " " + reply[0].followers_count).yellow);
            fileLogger('stats.txt', getDate() + writting);
        } else {
            handleError('getUserData', err);
        }
    })
}

function startStats() {
    logConsole(" StartStats".cyan);
    statInterval = setInterval(function() {
        now = new Date();
        if (now.getMinutes() % 10 == 0) {
            getUserData(mainUser);
        }
    }, 1000 * 60);
}

//RETWEET MODULE
function startRetweet() {
    logConsole(" StartRetweeting".cyan);
    retweetInterval = setInterval(function() {
        postRetweet();
    }, retweetEvery);
}

function postRetweet() {
    logConsole(" PostRetweet".cyan);
    T.get('search/tweets', mediaArtsSearch, function(error, data) {
        if (!error) {
            var retweetId = data.statuses[0].id_str;
            T.post('statuses/retweet/' + retweetId, {}, function(error, response) {
                if (response) {
                    logConsole((' Success! Retweet Posted').green);
                    logConsole((' RT - ' + data.statuses[0].text).green);
                } else if (error) {
                    handleError('postRetweet', error);
                }
            })
        } else {
            handleError('getRetweet', error)
        }
    });
}

//TWEET MODULE
function startTweeting() {
    logConsole(" StartTweeting".cyan);
    tweetInterval = setInterval(function() {
        checkTweets(readFile());
    }, 1000 * 60);
}

function readFile() {
    var fs = require('fs');
    var data = fs.readFileSync('tweets.txt');
    array = data.toString().split("\n");
    for (i in array) {
        tweetQueue[i] = {
            time: array[i].substring(0, array[i].indexOf(' ', 6)),
            tweet: array[i].substring(array[i].indexOf(' ', 6), array[i].length)
        }
        if (tweetQueue[i].tweet.length < 10 || tweetQueue[i].time.length < 5) {
            tweetQueue.splice(i, 1);
        }
    }
    return tweetQueue;
}

function checkTweets(tweets) {
    for (i in tweets) {
        if (tweets[i].time === getDate()) {
            if (tweetQueue[i].tweet.length > 10) {
                //POST TWEET
                postTweet(tweetQueue[i].tweet);
                //REMOVE LINE
                tweetQueue.splice(i, 1);
                fs.writeFileSync('tweets.txt', '');
                tweetQueue.forEach(function(line) {
                    fs.appendFileSync("tweets.txt", line.time + line.tweet + "\n");
                });

            } else {
                handleError('checkTweets', 'Error: Short Tweet ' + tweetQueue[i].tweet.length)
            }
        }
    }
}

function postTweet(text) {
    logConsole(" PostTweet".cyan);
    T.post('statuses/update', {
        status: text
    }, function(err, replay) {
        if (!err) {
            logConsole((" Tweet Posted: " + text).green);
        } else {
            handleError('postTweet', err);
        }

    })
}

//Console and File loggers
function handleError(func, err) {
    var date = (getHours() + ":" + getMinutes());
    console.log((" " + date + " " + func + " " + err).red);
    fileLogger('consoleLog.txt', " " + getDate() + " " + func + " " + err);
}

function logConsole(txt) {
    var date = (getHours() + ":" + getMinutes());
    console.log(" " + date + txt);
    fileLogger('consoleLog.txt', " " + getDate() + txt.replace('[39m', '').replace('[36m', '').replace('[32m', '').replace('[33m',
        ''));
}

function fileLogger(path, text) {
    fs.appendFile(path, '\r\n' + text, function(err) {
        if (err) {
            handleError("fileLogger", path + " " + err);
        } else {
            //logConsole(path + " has been updated with " + text);
        }
    });
}

//Functions for Getting and Formatting the date
function getMinutes() {
    var minutes = new Date().getMinutes();
    if (minutes < 10) {
        return "0" + minutes.toString();
    } else {
        return minutes.toString();
    }
}

function getHours() {
    var hours = new Date().getHours();
    if (hours < 10) {
        return "0" + hours.toString();
    } else {
        return hours.toString();
    }
}

function getMonth() {
    var month = (new Date().getMonth()) + 1;
    if (month < 10) {
        return "0" + month.toString();
    } else {
        return month.toString();
    }
}

function getDay() {
    var day = new Date().getDate();
    if (day < 10) {
        return "0" + day.toString();
    } else {
        return day.toString();
    }
}

function getDate() {
    return getMonth() + "/" + getDay() + /*"/" + aDate.getYear() +*/ " " + getHours() + ":" + getMinutes();
}