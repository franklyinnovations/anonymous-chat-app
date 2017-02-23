var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require("socket.io")(server);
var bodyParser = require('body-parser');

var assert = require('assert');


var gcm = require('node-gcm');

// var mongo = require('mongodb'), Server = mongo.Server, Db = mongo.Db;
var mongoclient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId;

// Replace these with your own values.
// var apiKey = "replace with API key";
// var deviceID = "my device id";
// var service = new gcm.Sender(apiKey);
// var message = new gcm.Message();
// message.addData('title', 'Test Push');
// message.addData('message', 'Push number 2');
// service.send(message, { registrationTokens: [ deviceID ] }, function (err, response) {
//     if(err) console.error(err);
//     else    console.log(response);
// });


// var servermg = new Server('localhost', 27017, {  
//   auto_reconnect: true
// });
// var db = new Db('chatApp', servermg);  

var users = [];
app.use(bodyParser.json());
// access control
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//----------

var db;

mongoclient.connect("mongodb://localhost:27017/chatApp", function(err, datab) {
    if (err) {
        console.log(err);
    } else {
        db = datab;
    }

});

app.get('/', function(req, res) {
    var dta = [];
    db.collection("topics").find().toArray(function(err, result) {
        res.json(result);
    });




});
app.post('/register', function(req, res) {
    // var uuid = req.body.uuid;
    // var device_token = req.body.device_token;
    var data = {
        uuid: req.body.uuid,
        device_token: req.body.device_token,
        messages: [],
        notificationEnabled: true,
        notificationSent: false,

        newTopics: [],
        leftChats: []
    };

    db.collection("users").find({
        "uuid": req.body.uuid
    }).toArray(function(err, result) {
        if (!err) {
            if (result.length) {
                res.send(result[0]._id);
            } else {
                db.collection("users").insertOne(data, function(err, result) {
                    if (!err) {
                        // console.log(result.insertedId);
                        res.send(result.insertedId);
                    }
                });
            }
        }
    });






});

app.post('/topicList', function(req, res) {


    var page = req.body.page;
    var category = req.body.category;
    var data = {
        category: {
            $in: category
        },
        joined: false
    };
    if (category.length == 0) {
        data = {
            joined: false
        };
    }
    db.collection("topics").find(data).skip((page - 1) * 40).limit(40).toArray(function(err, result) {
        if (!err) {
            // console.log(JSON.stringify(result));
            res.json(result);
            // console.log("after send");
        } else {
            // console.log()
        }
    });

});
app.post("/deleteTopic", function(req, res) {
	console.log(req.body.topicId);
    db.collection("topics").removeOne({
        "_id": ObjectId(req.body.topicId)
    }, function(err, result) {
        if (!err) {
            res.send("success");
        }
    });
});
app.post('/addTopic', function(req, res) {
    var data = {
        topic: req.body.topic,
        byUser: req.body.byUser,
        category: req.body.category,
        joined: false,
    }
    db.collection("topics").insertOne(data, function(err, result1) {
        if (!err) {
            res.send(result1.insertedId);
        }
    });

});

app.post('/joinTopic', function(req, res) {
    var topicByUser = null;
    db.collection("topics").find({
        "_id": ObjectId(req.body.topicId)
    }).toArray(function(err, result) {


        if (!err) {
            topicByUser = result[0].byUser;
            if (result[0].joined)
                res.send("oops");
            else {
                db.collection("topics").updateOne({
                    "_id": ObjectId(req.body.topicId)
                }, {
                    $set: {
                        "joined": req.body.joined
                    }
                }, function(err, result1) {
                    if (!err) {
                        db.collection("users").updateOne({
                            "_id": ObjectId(topicByUser)
                        }, {
                            $push: {
                                "newTopics": {
                                    topicName: result[0].topic,
                                    joined: req.body.joined,
                                    topicId: req.body.topicId
                                }
                            }
                        }, function(e, r) {});
                        res.send("done");
                        var sock = findSocket(result[0].byUser);
                        if (sock) {
                            sock.emit("joinTopic", {
                                topicId: req.body.topicId,
                                joined: req.body.joined
                            });
                        }
                    }

                });
            }
        }
    });

});



app.post('/reportTopic', function(req, res) {
    db.collection("reports").insertOne({
        "topicId": req.body.topicId,
        "byUser": req.body.userId
    }, function(e, r) {});
});


app.post('/deleteAccount', function(req, res) {

    db.collection("topics").find({
        "byUser": req.body.userId,
        "joined": {
            $ne: false
        }
    }).toArray(function(err, doc) {

        for (var i = 0; i < doc.length; i++) {

            db.collection("topics").updateOne({
                "_id": ObjectId(doc[i]._id)
            }, {
                $set: {
                    "byUser": doc[i].joined,
                    "joined": false

                }
            }, function(e, r) {});
            db.collection("users").updateOne({
                "_id": ObjectId(doc[i].joined)
            }, {
                $push: {
                    "leftChats": doc[i]._id
                }
            }, function(e, r) {});
        }
    });

    db.collection("topics").find({
        "byUser": req.body.userId,
        "joined": false
    }).toArray(function(err, doc) {
        for (var i = 0; i < doc.length; i++) {
            db.collection("topics").deleteOne({
                "_id": ObjectId(doc[i]._id)
            }, function(e, r) {});
        }
    });

    db.collection("users").deleteOne({
        "_id": ObjectId(req.body.userId)
    }, function(err, resu) {
        if (!err) {
            res.send("success");
        }
    });




});

app.post("/leaveChat", function(req, res) {

    
        db.collection("topics").find({
            "_id": ObjectId(req.body.topicId)
        }).toArray(function(err, result) {
            // console.log("leave " + req.body.topicId + " " + req.body.userId + " " + JSON.stringify(result));
            if (!err && result.length) {
                if (req.body.userId == result[0].byUser && result[0].joined) {
                    db.collection("users").updateOne({
                        "_id": ObjectId(result[0].joined)
                    }, {
                        $push: {
                            "leftChats": req.body.topicId
                        }
                    }, function(e, r) {});
                    db.collection("topics").updateOne({
                        "_id": ObjectId(req.body.topicId)
                    }, {
                        $set: {
                            "joined": false,
                            "byUser": result[0].joined
                        }
                    }, function(e, r) {});
                } else if(result[0].joined){
                    db.collection("users").updateOne({
                        "_id": ObjectId(result[0].joined)
                    }, {
                        $push: {
                            "leftChats": req.body.topicId
                        }
                    }, function(e, r) {});
                    db.collection("topics").updateOne({
                        "_id": ObjectId(req.body.topicId)
                    }, {
                        $set: {
                            "joined": false
                        }
                    }, function(e, r) {});

                }
                // console.log("sending response to leave chat");
                res.send("success");
                var sock = findSocket(result[0].joined);
                if (sock) {
                    sock.emit("leaveChat", req.body.topicId);
                }
            } else {
                res.send("failed");
            }

        });
    
});

app.post('/getData', function(req, res) {
    var userId = req.body.userId;
    db.collection("users").find({
        "_id": ObjectId(userId)
    }).toArray(function(err, result) {
        //
        //console.log(req.body.userId);
        //console.log(result.length);
        if (result.length) {
            
            // 
            //console.log(JSON.stringify(result));
            // console.log("_____");
            // console.log(result)
            // console.log(result[0].messages);
            res.json({
                messages: result[0].messages,
                newTopics: result[0].newTopics,
                leftChats: result[0].leftChats
            });

        } else {
            res.send("noUser");
        }
    });

    // testing
    db.collection("topics").find({}).each(function(err, doc) {
        // console.log("++++");
        // console.log(doc);
    })
});

app.post("/getPrevious",function(req,res){
	db.collection("topics").find({$or: [{
		"byUser" : req.body.userId}, {"joined" : req.body.userId
	}]}).toArray(function(err,result){
		console.log(JSON.stringify(result));
		if(result.length){
			res.json(result);
		}
	});
});


io.on('connection', function(socket) {

    if (!socket.userId) {
        socket.emit("needId", {});
    }
    // console.log("new connection");
    users.push(socket);


    socket.on('register', function(data) {
        socket.userId = data;
        // console.log("user registerd with " + data);

    });

    socket.on("gettest", function(data) {
        // console.log("emitting test");
        socket.emit('testemit', data);
    })


    socket.on('sendMessage', function(data) {

        // check if user is online
        // console.log(data.toChat);
        var soc = findSocket(data.toChat);
        if (soc) {
            soc.emit("sendMessage", data);
           
            // console.log("send via socket");
        } else {
            // console.log("stored to database " + JSON.stringify(data));
            db.collection("users").updateOne({
                "_id": ObjectId(data.toChat)
            }, {
                $push: {
                    "messages": data
                }
            }, function(err, result) {
            	
            });
        }

        // send data via socket 

        // else . store to users database 



    });



    socket.on('disconnect', function() {
        console.log("disconnected");

        users.splice(users.indexOf(socket), 1);

        console.log("connected Users : " + users.length);



    });

    socket.on("getNotifications",function(data){
    	if(data){
    		db.collection("users").updateOne({
                "_id": ObjectId(data)
            }, {
                $set: {
                    "messages": [],
                    "newTopics": [],
                    "leftChats": []
                }
            }, function(err, result2) {

            });
    	}
    })



});




server.listen(8181);


function findSocket(id) {
    // console.log("list of online ->" + users.length);
    for (var i = 0; i < users.length; i++) {
        // console.log(users[i].userId);
        if (users[i].userId == id)
            return users[i];
    }
    return false;
}